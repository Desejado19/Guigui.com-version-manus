/**
 * FEED — leituras que a página inicial faz, sem sessão.
 *
 * Endpoints reais:
 * - GET /api/posts (feed aprovado, com e sem filtro `neighborhood`/`q`)
 * - GET /api/posts/engagements (contadores agregados)
 * - GET /api/sync/bootstrap (empresas, eventos, publicações e stories)
 * - GET /api/businesses
 */

import { check, sleep } from 'k6';
import { BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { getJson } from './lib/api.js';

const NEIGHBOURHOOD = __ENV.NEIGHBOURHOOD || 'Bandim';

export const options = {
  scenarios: {
    feed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: BASE_THRESHOLDS,
};

export default function feed() {
  const posts = getJson('/api/posts');
  check(posts, {
    'feed: 200': (res) => res.status === 200,
    'feed: lista de publicações': (res) => Array.isArray(res.json('posts')),
  });

  const filtered = getJson(`/api/posts?neighborhood=${encodeURIComponent(NEIGHBOURHOOD)}`);
  check(filtered, { 'feed filtrado: 200': (res) => res.status === 200 });

  const search = getJson('/api/posts?q=guigui');
  check(search, { 'feed pesquisa: 200': (res) => res.status === 200 });

  const engagements = getJson('/api/posts/engagements');
  check(engagements, { 'interações do feed: 200': (res) => res.status === 200 });

  const bootstrap = getJson('/api/sync/bootstrap');
  check(bootstrap, {
    'bootstrap: 200': (res) => res.status === 200,
    'bootstrap: dados presentes': (res) => Boolean(res.json('data')),
  });

  const businesses = getJson('/api/businesses');
  check(businesses, { 'empresas: 200': (res) => res.status === 200 });

  sleep(numericEnv('THINK_TIME', 1));
}
