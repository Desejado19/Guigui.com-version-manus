/**
 * STRESS — empurra a taxa de chegada para além da capacidade medida (~70 rps
 * no ambiente local) e observa onde começam os erros.
 *
 * Só leituras públicas, por isso é seguro interromper a qualquer momento.
 * Executar apenas depois de 100/250/500 VUs estarem validados.
 */

import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, numericEnv } from './lib/config.js';
import http from 'k6/http';

const serverErrors = new Counter('stress_server_errors');
const thresholdMisses = new Counter('stress_threshold_misses');

const BASE_RPS = numericEnv('BASE_RPS', 50);
const TARGET_RPS = numericEnv('TARGET_RPS', 400);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: BASE_RPS,
      timeUnit: '1s',
      preAllocatedVUs: numericEnv('PRE_VUS', 100),
      maxVUs: numericEnv('MAX_VUS', 1500),
      stages: [
        { target: BASE_RPS, duration: '20s' },
        { target: Math.round(TARGET_RPS / 2), duration: '40s' },
        { target: TARGET_RPS, duration: '40s' },
        { target: TARGET_RPS, duration: '20s' },
        { target: 0, duration: '20s' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
    dropped_iterations: [`count<${numericEnv('MAX_DROPPED', 5000)}`],
  },
};

export default function stress() {
  const response = http.get(`${BASE_URL}/api/posts`, {
    tags: { endpoint: '/api/posts', phase: 'stress' },
  });

  if (response.status >= 500) serverErrors.add(1);
  const ok = check(response, {
    'stress: 200': (res) => res.status === 200,
    'stress: resposta em menos de 5 s': (res) => res.timings.duration < 5000,
  });
  if (!ok) thresholdMisses.add(1);
}
