/**
 * PUBLICAÇÕES — leitura das publicações e das métricas reais por empresa.
 *
 * Endpoints reais:
 * - GET /api/businesses, GET /api/businesses/featured
 * - GET /api/businesses/:id/reviews
 * - GET /api/businesses/:businessId/post-metrics (só empresa dona ou admin)
 *
 * Não cria publicações: escrever conteúdo alteraria dados reais. O único
 * utilizador autenticado é a conta de administração de teste, para poder ler
 * as métricas de uma empresa existente.
 */

import { check, sleep } from 'k6';
import { ACCOUNTS, BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { firstBusinessId, getJson, login } from './lib/api.js';

export const options = {
  // O k6 limpa o cookie jar entre iterações por omissão; a sessão de teste
  // iniciada no primeiro ciclo tem de sobreviver aos seguintes.
  noCookiesReset: true,
  scenarios: {
    publications: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: BASE_THRESHOLDS,
};

export function setup() {
  // Só o identificador: os cookies de `setup` não passam para os VUs.
  return { businessId: firstBusinessId() };
}

// Cada VU autentica-se uma vez (admin lê as métricas de qualquer empresa).
let signedIn = false;

export default function publications(data) {
  if (!signedIn) signedIn = login(ACCOUNTS.admin).ok;
  const businesses = getJson('/api/businesses');
  check(businesses, {
    'empresas: 200': (res) => res.status === 200,
    'empresas: com publicações': (res) => {
      const list = res.json('businesses') || [];
      return list.length > 0 && Array.isArray(list[0].posts);
    },
  });

  const featured = getJson('/api/businesses/featured');
  check(featured, { 'destaques: 200': (res) => res.status === 200 });

  if (data.businessId) {
    const reviews = getJson(`/api/businesses/${encodeURIComponent(data.businessId)}/reviews`);
    check(reviews, { 'avaliações: 200': (res) => res.status === 200 });

    if (signedIn) {
      const metrics = getJson(`/api/businesses/${encodeURIComponent(data.businessId)}/post-metrics`);
      check(metrics, {
        'métricas: 200': (res) => res.status === 200,
        'métricas: totais reais': (res) => Boolean(res.json('totals')),
      });
    }
  }

  sleep(numericEnv('THINK_TIME', 1));
}
