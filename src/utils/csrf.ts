/**
 * Token CSRF de duplo envio.
 *
 * O servidor emite `_csrf` legível pelo JavaScript e exige o mesmo valor no
 * cabeçalho `X-CSRF-Token` em todos os métodos que alteram estado. Em vez de
 * repetir o cabeçalho em cada uma das chamadas fetch da aplicação, este wrapper
 * central acrescenta-o apenas a pedidos same-origin não seguros.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = '_csrf';
const originalFetch = window.fetch.bind(window);

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

async function csrfToken(): Promise<string> {
  const fromCookie = readCookie(CSRF_COOKIE);
  if (fromCookie) return fromCookie;
  // Sem cookie (expirado ou limpo) o token em memória também já não é aceite:
  // pede sempre um novo para não ficar preso a um valor sem cookie par.
  const response = await originalFetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  return typeof payload?.csrfToken === 'string' ? payload.csrfToken : readCookie(CSRF_COOKIE);
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof Request) return new URL(input.url, window.location.href);
  return new URL(String(input), window.location.href);
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = requestUrl(input);
  if (url.origin !== window.location.origin || SAFE_METHODS.has(requestMethod(input, init))) {
    return originalFetch(input, init);
  }
  const token = await csrfToken();
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (token) headers.set(CSRF_HEADER, token);
  return originalFetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'same-origin',
  });
};

/** Exposto para testes e para pedidos que precisem de forçar renovação. */
export function currentCsrfToken(): string {
  return readCookie(CSRF_COOKIE);
}
