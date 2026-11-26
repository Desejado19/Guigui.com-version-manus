/**
 * EVENTOS — agenda cultural e publicações agendadas públicas.
 *
 * Endpoints reais:
 * - GET /api/events
 * - GET /api/marketing/scheduled-items/public
 * - GET /api/businesses (contexto da agenda)
 */

import { check, sleep } from 'k6';
import { BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { getJson } from './lib/api.js';

export const options = {
  scenarios: {
    events: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: BASE_THRESHOLDS,
};

export default function events() {
  const agenda = getJson('/api/events');
  check(agenda, {
    'eventos: 200': (res) => res.status === 200,
    'eventos: lista': (res) => Array.isArray(res.json('events')),
  });

  const scheduled = getJson('/api/marketing/scheduled-items/public');
  check(scheduled, { 'agendados públicos: 200': (res) => res.status === 200 });

  const businesses = getJson('/api/businesses');
  check(businesses, { 'empresas da agenda: 200': (res) => res.status === 200 });

  sleep(numericEnv('THINK_TIME', 1));
}
