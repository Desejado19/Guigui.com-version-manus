/**
 * HEALTH CHECK — leitura pura, sem sessão.
 *
 * Endpoints reais: GET /api/health (createHealthHandler, verifica base de
 * dados e IA), GET /api/features e GET /api/locations.
 */

import { check, sleep } from 'k6';
import { BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { getJson } from './lib/api.js';

export const options = {
  scenarios: {
    health: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: BASE_THRESHOLDS,
};

export default function healthCheck() {
  const health = getJson('/api/health');
  check(health, {
    'health: 200': (res) => res.status === 200,
    'health: base de dados reportada': (res) => {
      const body = res.json();
      return Boolean(body && (body.database || body.status));
    },
  });

  const features = getJson('/api/features');
  check(features, { 'features: 200': (res) => res.status === 200 });

  const locations = getJson('/api/locations');
  check(locations, { 'locations: 200': (res) => res.status === 200 });

  sleep(numericEnv('THINK_TIME', 1));
}
