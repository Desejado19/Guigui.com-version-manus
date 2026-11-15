/**
 * AUTENTICAÇÃO — login, sessão e logout com contas de teste.
 *
 * Endpoints reais: POST /api/auth/login, GET /api/auth/session,
 * POST /api/auth/logout. Cada iteração autentica e termina a sessão, para não
 * acumular sessões no servidor.
 */

import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { ACCOUNTS, BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { getJson, login, logout } from './lib/api.js';

const authFailures = new Counter('auth_login_failures');
const sessionFailures = new Rate('auth_session_failure_rate');

export const options = {
  // O k6 limpa o cookie jar entre iterações por omissão; a sessão de teste
  // iniciada no primeiro ciclo tem de sobreviver aos seguintes.
  noCookiesReset: true,
  scenarios: {
    auth: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ...BASE_THRESHOLDS,
    auth_login_failures: ['count<1'],
    auth_session_failure_rate: ['rate<0.02'],
  },
};

export default function authentication() {
  const account = __ITER % 2 === 0 ? ACCOUNTS.citizen : ACCOUNTS.citizenSeed;

  const { ok } = login(account);
  if (!ok) authFailures.add(1);

  const session = getJson('/api/auth/session');
  sessionFailures.add(!check(session, { 'sessão activa: 200': (res) => res.status === 200 }));

  logout();
  sleep(numericEnv('THINK_TIME', 1));
}
