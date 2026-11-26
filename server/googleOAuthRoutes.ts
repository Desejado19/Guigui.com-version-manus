import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import type { AuthenticationResult } from './modules/identity-access/application/authentication';
import { SESSION_COOKIE_NAME } from './modules/identity-access/infrastructure/sessionRepository';

/**
 * Login com Google por redireccionamento (OAuth 2.0 authorization code).
 *
 * O browser navega para /api/auth/google/start, a Google devolve o utilizador a
 * /api/auth/google/callback com um código de autorização de uso único e é aqui
 * que o código é trocado pelo ID token com o client secret. O secret nunca
 * chega ao browser e o ID token continua a ser verificado pelo JWKS oficial
 * antes de qualquer sessão ser criada.
 *
 * O router é criado por uma factory para poder ser testado sem levantar o
 * servidor completo nem contactar a Google: `fetchImpl` permite substituir a
 * troca do código e `authenticate` permite usar um verificador mockado.
 */

const GOOGLE_AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_STATE_COOKIE = 'guigui_google_oauth_state';
const GOOGLE_OAUTH_STATE_PATH = '/api/auth/google';
const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 600;
// Tolerância para relógios ligeiramente adiantados em relação ao servidor.
const GOOGLE_OAUTH_STATE_CLOCK_SKEW_SECONDS = 300;
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface GoogleOAuthAuthenticateInput {
  googleIdToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GoogleOAuthRouterDependencies {
  authenticate(input: GoogleOAuthAuthenticateInput): Promise<AuthenticationResult>;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, 'error'>;
}

export function createGoogleOAuthRouter(dependencies: GoogleOAuthRouterDependencies): Router {
  const env = dependencies.env ?? process.env;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const logger = dependencies.logger ?? console;

  /**
   * Origem efectiva do pedido. Atrás de um proxy (Vercel, Cloudflare, nginx) o
   * Express vê `http` no socket, por isso os cabeçalhos encaminhados mandam;
   * sem eles o redirect_uri sairia em `http://` e a Google recusava o callback.
   */
  function requestOrigin(req: Request) {
    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
    const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    const protocol = (forwardedProto || req.protocol || 'https').trim();
    const host = (forwardedHost || req.get('host') || 'localhost').trim();
    return { protocol, host, origin: `${protocol}://${host}` };
  }

  function settings(req: Request) {
    const clientId = (env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();
    const { protocol, origin } = requestOrigin(req);
    // O mesmo valor tem de ser usado no /start e no /callback e estar registado
    // em "URIs de redireccionamento autorizados" do cliente OAuth. Quando não
    // há URI configurado, deriva-se do próprio pedido para que o regresso seja
    // sempre ao host onde o utilizador começou.
    const redirectUri = (env.GOOGLE_REDIRECT_URI || '').trim()
      || `${origin}/api/auth/google/callback`;
    const secure = protocol === 'https' ? '; Secure' : '';
    return { clientId, clientSecret, redirectUri, secure };
  }

  /**
   * O `state` é assinado (HMAC) e leva o instante de emissão: não depende de
   * cookie, por isso sobrevive a diferenças de host entre o arranque
   * (ex.: 127.0.0.1) e o callback (ex.: localhost), que antes faziam o login
   * falhar com "sessão expirada" mesmo com o consentimento concedido.
   */
  function stateSecret() {
    return (env.SESSION_COOKIE_SECRET || '').trim() || (env.GOOGLE_CLIENT_SECRET || '').trim();
  }

  function signState(payload: string): string {
    return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  }

  function createState(): string {
    const payload = `${randomBytes(18).toString('base64url')}.${Math.floor(Date.now() / 1000)}`;
    return `${payload}.${signState(payload)}`;
  }

  function isValidState(state: string): boolean {
    if (!stateSecret()) return false;
    const parts = state.split('.');
    if (parts.length !== 3) return false;
    const [nonce, issuedAtRaw, signature] = parts;
    const issuedAt = Number(issuedAtRaw);
    if (!nonce || !Number.isFinite(issuedAt)) return false;
    const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
    if (ageSeconds < -GOOGLE_OAUTH_STATE_CLOCK_SKEW_SECONDS || ageSeconds > GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS) return false;
    const expected = Buffer.from(signState(`${nonce}.${issuedAtRaw}`), 'utf8');
    const received = Buffer.from(signature, 'utf8');
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  function clearStateCookie(secure: string): string {
    return `${GOOGLE_OAUTH_STATE_COOKIE}=; Path=${GOOGLE_OAUTH_STATE_PATH}; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }

  function sessionCookie(token: string, secure: string): string {
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
  }

  const router = Router();

  router.get('/start', (req, res) => {
    const { clientId, clientSecret, redirectUri, secure } = settings(req);
    if (!clientId || !clientSecret) return res.redirect(302, '/?google_login=unavailable');

    // O `state` assinado protege o callback contra CSRF sem depender de cookies.
    const state = createState();
    res.setHeader('Set-Cookie', clearStateCookie(secure));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
      access_type: 'online',
    });
    res.redirect(302, `${GOOGLE_AUTHORIZE_ENDPOINT}?${params.toString()}`);
  });

  router.get('/callback', async (req, res) => {
    const { clientId, clientSecret, redirectUri, secure } = settings(req);
    const fail = (reason: string) => res.redirect(302, `/?google_login=error&google_reason=${encodeURIComponent(reason)}`);

    // Limpa o cookie do antigo fluxo com estado guardado no browser.
    res.setHeader('Set-Cookie', clearStateCookie(secure));

    if (typeof req.query.error === 'string') return fail('cancelled');
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state || !isValidState(state)) return fail('state');
    if (!clientId || !clientSecret) return fail('unavailable');

    let idToken: string;
    try {
      const tokenResponse = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const tokenPayload = await tokenResponse.json().catch(() => ({})) as { id_token?: string };
      if (!tokenResponse.ok || typeof tokenPayload.id_token !== 'string') {
        logger.error('google-oauth-token-exchange-failed', tokenResponse.status);
        return fail('exchange');
      }
      idToken = tokenPayload.id_token;
    } catch {
      return fail('exchange');
    }

    // Uma falha inesperada na verificação/criação da conta devolve uma mensagem
    // tratada à aplicação em vez de um erro 500 sem contexto.
    let result;
    try {
      result = await dependencies.authenticate({
        googleIdToken: idToken,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (error) {
      logger.error('google-oauth-authentication-failed', error);
      return fail('server');
    }
    if (result.kind === 'rejected') return fail(result.reason);

    res.setHeader('Set-Cookie', sessionCookie(result.sessionToken, secure));
    res.append('Set-Cookie', clearStateCookie(secure));
    res.redirect(302, '/?google_login=ok');
  });

  return router;
}
