import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { GoogleIdTokenVerifier, VerifiedGoogleIdentity } from '../application/authentication';

/** Chave pública RSA no formato JWKS publicado pelo Google. */
export interface GoogleJwksKey {
  kid?: string;
  kty?: string;
  alg?: string;
  n?: string;
  e?: string;
}

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const JWKS_TIMEOUT_MS = 5000;
const JWKS_DEFAULT_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 300;

let cachedJwks: { keys: GoogleJwksKey[]; expiresAt: number } | null = null;

async function fetchGoogleJwks(): Promise<GoogleJwksKey[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) return cachedJwks.keys;

  const response = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Google JWKS indisponível (${response.status}).`);
  const body = await response.json() as { keys?: GoogleJwksKey[] };
  const keys = Array.isArray(body?.keys)
    ? body.keys.filter((key): key is GoogleJwksKey => key?.kty === 'RSA' && Boolean(key.n) && Boolean(key.e))
    : [];
  if (keys.length === 0) throw new Error('Google JWKS sem chaves RSA utilizáveis.');

  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 0);
  cachedJwks = {
    keys,
    expiresAt: now + Math.min(Math.max(maxAge * 1000, 60_000), JWKS_DEFAULT_TTL_MS),
  };
  return keys;
}

function decodeJwtSegment(segment: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/**
 * Verifica ID tokens do Google Identity Services: assinatura RS256 contra o
 * JWKS oficial, emissor, audiência (client ID), validade e e-mail confirmado.
 * Qualquer falha devolve null — nunca se confia apenas no payload descodificado.
 */
export function createGoogleIdTokenVerifier(options: {
  clientId: string;
  /** Injeção usada nos testes; por omissão lê o JWKS oficial do Google. */
  loadKeys?: () => Promise<GoogleJwksKey[]>;
  now?: () => number;
}): GoogleIdTokenVerifier {
  const clientId = options.clientId.trim();
  const loadKeys = options.loadKeys ?? fetchGoogleJwks;
  const now = options.now ?? Date.now;

  return async (idToken: string): Promise<VerifiedGoogleIdentity | null> => {
    if (!clientId || typeof idToken !== 'string') return null;
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const header = decodeJwtSegment(parts[0]);
    const payload = decodeJwtSegment(parts[1]);
    if (!header || !payload) return null;
    if (header.alg !== 'RS256') return null;

    let keys: GoogleJwksKey[];
    try {
      keys = await loadKeys();
    } catch {
      return null;
    }
    const candidates = typeof header.kid === 'string'
      ? keys.filter((key) => key.kid === header.kid)
      : keys;
    if (candidates.length === 0) return null;

    const signedData = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
    const signature = Buffer.from(parts[2], 'base64url');
    const signatureValid = candidates.some((key) => {
      try {
        const publicKey = createPublicKey({
          key: { kty: 'RSA', n: key.n, e: key.e },
          format: 'jwk',
        });
        return verifySignature('RSA-SHA256', signedData, publicKey, signature);
      } catch {
        return false;
      }
    });
    if (!signatureValid) return null;

    if (typeof payload.iss !== 'string' || !GOOGLE_ISSUERS.has(payload.iss)) return null;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(clientId)) return null;

    const nowSeconds = Math.floor(now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
    if (typeof payload.iat === 'number' && payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) return null;

    // Sem e-mail confirmado pela Google, o endereço não identifica ninguém.
    if (payload.email_verified !== true && payload.email_verified !== 'true') return null;
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    if (typeof payload.email !== 'string' || !payload.email.includes('@')) return null;

    return {
      googleId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      ...(typeof payload.name === 'string' && payload.name ? { name: payload.name } : {}),
      ...(typeof payload.picture === 'string' && payload.picture ? { avatarUrl: payload.picture } : {}),
    };
  };
}
