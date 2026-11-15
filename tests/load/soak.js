/**
 * RESISTÊNCIA (soak) — carga constante durante muito tempo, para descobrir
 * fugas de memória, crescimento do pool PostgreSQL e degradação progressiva.
 *
 * Perfil de leitura moderado que imita utilizadores a navegar. Ver
 * `tests/load/monitor.mjs` para registar RAM/CPU/conexões em paralelo.
 *
 *   k6 run -e SOAK_VUS=50 -e SOAK_DURATION=30m tests/load/soak.js
 */

import { check, sleep } from 'k6';
import { BASE_THRESHOLDS, numericEnv } from './lib/config.js';
import { getJson } from './lib/api.js';

const VUS = numericEnv('SOAK_VUS', 50);

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: VUS,
      duration: __ENV.SOAK_DURATION || '30m',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    ...BASE_THRESHOLDS,
    // Numa execução longa, o p95 tolera o ruído da máquina de trabalho.
    http_req_duration: ['p(95)<1500', 'p(99)<4000'],
  },
};

export default function soak() {
  const posts = getJson('/api/posts');
  check(posts, { 'soak feed: 200': (res) => res.status === 200 });

  const events = getJson('/api/events');
  check(events, { 'soak eventos: 200': (res) => res.status === 200 });

  sleep(numericEnv('THINK_TIME', 3));
}
