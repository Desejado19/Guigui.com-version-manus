import { test as base, expect, type APIRequestContext } from '@playwright/test';

// Reexporta tudo o que os specs já importavam (`request`, `Download`,
// `APIRequestContext`, tipos, etc.), mantendo-os a apontar para esta fixture.
export * from '@playwright/test';

/**
 * Fixture partilhada dos testes E2E.
 *
 * O guia de boas-vindas (WelcomeTour) abre automaticamente uma vez por conta e
 * usa um `div` modal de ecrã inteiro (`aria-modal="true"`, `z-[70]`). Num
 * contexto de browser novo o estado do guia está vazio, por isso o modal abre
 * em cada teste e intercepta todos os cliques, o que faz falhar os testes de
 * administração/empresa por timeout, não por defeito da aplicação.
 *
 * Em vez de repetir limpezas de localStorage em cada spec, esta fixture
 * instala um init script que faz o guia considerar-se já visto (skipped) para
 * qualquer conta: os testes nunca ficam bloqueados pelo overlay e o guia
 * continua a abrir normalmente em browsers reais.
 */
const CSRF_ORIGIN = (() => {
  const configured = process.env.PW_BASE_URL?.trim();
  if (configured) return new URL(configured).origin;
  return `http://localhost:${process.env.PW_PORT?.trim() || '3000'}`;
})();

const patchedContexts = new WeakSet<APIRequestContext>();
const contextTokens = new WeakMap<APIRequestContext, string>();
const CSRF_COOKIE = '_csrf';
const CSRF_COOKIE_PATTERN = /(?:^|;\s*)_csrf=/;

/**
 * Os testes usam `request`/`page.request` diretamente, sem passar pelo wrapper
 * de fetch da aplicação. Este adaptador obtém o cookie `_csrf` uma vez e
 * acrescenta token, Origin e Referer a todos os métodos que alteram estado.
 */
export function patchApiContext(context: APIRequestContext): APIRequestContext {
  if (patchedContexts.has(context)) return context;
  patchedContexts.add(context);

  const ensureToken = async (): Promise<string> => {
    const cached = contextTokens.get(context);
    // `clearCookies()` pode apagar o `_csrf`; nesse caso o token em cache já
    // não serve e é preciso voltar a pedir um cookie novo.
    const state = await context.storageState();
    const cookieToken = state.cookies.find((cookie) => cookie.name === CSRF_COOKIE)?.value;
    if (cached && cookieToken === cached) return cached;
    const response = await context.get('/api/csrf');
    const payload = await response.json().catch(() => ({}));
    const token = typeof payload?.csrfToken === 'string' ? payload.csrfToken : '';
    if (token) contextTokens.set(context, token);
    return token;
  };

  const wrap = (method: 'post' | 'put' | 'patch' | 'delete' | 'fetch') => {
    const original = context[method].bind(context) as (...args: any[]) => Promise<any>;
    (context as any)[method] = async (url: any, options: any = {}) => {
      const requestMethod = method === 'fetch' ? String(options.method || 'GET').toUpperCase() : method.toUpperCase();
      if (['GET', 'HEAD', 'OPTIONS'].includes(requestMethod)) return original(url, options);
      const token = await ensureToken();
      const headers: Record<string, string> = {
        ...(options.headers || {}),
        Origin: CSRF_ORIGIN,
        Referer: `${CSRF_ORIGIN}/`,
        ...(token ? { 'X-CSRF-Token': token } : {}),
      };
      // Um cabeçalho `Cookie` explícito substitui o jar do contexto (os specs
      // passam a sessão de cada conta assim). Como o jar deixa de ser enviado,
      // o `_csrf` desaparecia e o servidor respondia 403 CSRF_TOKEN_MISSING
      // apesar do `X-CSRF-Token` correto. O token tem de viajar nos dois sítios
      // (padrão de duplo envio), por isso volta a ser acrescentado aqui.
      const cookieHeaderKey = Object.keys(headers).find((key) => key.toLowerCase() === 'cookie');
      if (token && cookieHeaderKey) {
        const explicitCookies = String(headers[cookieHeaderKey] || '');
        if (!CSRF_COOKIE_PATTERN.test(explicitCookies)) {
          const trimmed = explicitCookies.trim().replace(/;\s*$/, '');
          headers[cookieHeaderKey] = trimmed ? `${trimmed}; ${CSRF_COOKIE}=${token}` : `${CSRF_COOKIE}=${token}`;
        }
      }
      return original(url, { ...options, headers });
    };
  };
  wrap('post');
  wrap('put');
  wrap('patch');
  wrap('delete');
  wrap('fetch');
  return context;
}

export const test = base.extend({
  request: async ({ request }, use) => {
    await use(patchApiContext(request));
  },
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const prefix = 'guigui_onboarding_v1';
      const storageProto = Storage.prototype;
      const originalGetItem = storageProto.getItem;
      storageProto.getItem = function getItem(key: string) {
        if (typeof key === 'string' && key.startsWith(prefix)) {
          return JSON.stringify({ status: 'skipped', step: 0, updatedAt: new Date().toISOString() });
        }
        return originalGetItem.call(this, key);
      };
    });
    patchApiContext(page.request);
    await use(page);
  },
});

export { expect };
