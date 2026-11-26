/**
 * Configuração comum dos testes de carga do Guigui.com.
 *
 * Tudo vem de variáveis de ambiente do k6 (`-e CHAVE=valor`). Nada aqui inventa
 * rotas: os caminhos são os que existem em `server.ts`.
 */

export const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

/** Contas exclusivamente de teste/demonstração. */
export const ACCOUNTS = {
  citizen: {
    email: __ENV.CITIZEN_EMAIL || 'cidadao.teste@guigui.com',
    password: __ENV.CITIZEN_PASSWORD || 'Guigui@2026!',
  },
  citizenSeed: {
    email: __ENV.SEED_CITIZEN_EMAIL || 'cidadao.seed02@guigui.test',
    password: __ENV.SEED_CITIZEN_PASSWORD || 'Guigui2026!',
  },
  business: {
    email: __ENV.BUSINESS_EMAIL || 'empresa.teste@guigui.com',
    password: __ENV.BUSINESS_PASSWORD || 'Guigui@2026!',
  },
  admin: {
    email: __ENV.ADMIN_EMAIL || 'admin.teste@guigui.com',
    password: __ENV.ADMIN_PASSWORD || 'Guigui2026!',
  },
};

/**
 * Escritas (gostos, comentários) estão desligadas por omissão: sem
 * ALLOW_WRITES=1 os testes só leem dados e nunca alteram o estado da conta.
 */
export const ALLOW_WRITES = __ENV.ALLOW_WRITES === '1';

export const USER_AGENT = __ENV.USER_AGENT || 'Guigui-k6-load-test/1.0';

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': USER_AGENT,
};

// Consulta opcional para medir `/api/sync/bootstrap` paginado, ex.:
// BOOTSTRAP_QUERY='?sections=businesses&limit=20&view=summary'
export const BOOTSTRAP_QUERY = __ENV.BOOTSTRAP_QUERY || '';

export const ACCEPT_HEADERS = {
  'Accept': 'application/json',
  // O k6 não envia Accept-Encoding por omissão; sem isto os testes mediriam
  // respostas sem compressão, ao contrário de qualquer browser real.
  'Accept-Encoding': 'gzip, deflate',
  'User-Agent': USER_AGENT,
};

export function numericEnv(name, fallback) {
  const raw = __ENV[name];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Perfil progressivo: subida, patamar e descida.
 * `VUS` define o patamar; `DURATION` a duração total aproximada em segundos.
 */
export function progressiveStages(totalSeconds = 60) {
  const target = numericEnv('VUS', 100);
  const rampUp = Math.max(5, Math.round(totalSeconds * 0.2));
  const hold = Math.max(10, Math.round(totalSeconds * 0.6));
  const rampDown = Math.max(5, totalSeconds - rampUp - hold);
  return [
    { duration: `${rampUp}s`, target: Math.max(1, Math.round(target * 0.5)) },
    { duration: `${hold}s`, target },
    { duration: `${rampDown}s`, target: 0 },
  ];
}

/** Limites de sucesso usados como referência (não são promessas de capacidade). */
export const BASE_THRESHOLDS = {
  http_req_failed: ['rate<0.02'],
  http_req_duration: ['p(95)<1500', 'p(99)<3000'],
};
