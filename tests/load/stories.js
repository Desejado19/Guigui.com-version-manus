/**
 * STORIES — o Guigui.com não tem endpoint próprio de stories.
 *
 * As stories chegam ao cliente dentro de `GET /api/sync/bootstrap`
 * (`data.stories`, chave `guigui_stories`) e são apresentadas na barra de
 * stories do feed. Este teste mede esse payload real, sem inventar rotas.
 */

import { check, sleep } from 'k6';
import { BASE_THRESHOLDS, BOOTSTRAP_QUERY, progressiveStages, numericEnv } from './lib/config.js';
import { getJson } from './lib/api.js';

export const options = {
  scenarios: {
    stories: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: BASE_THRESHOLDS,
};

export default function stories() {
  const bootstrap = getJson(`/api/sync/bootstrap${BOOTSTRAP_QUERY}`);
  check(bootstrap, {
    'stories: bootstrap 200': (res) => res.status === 200,
    'stories: chave presente no payload': (res) => {
      const data = res.json('data');
      return Boolean(data) && Object.prototype.hasOwnProperty.call(data, 'stories');
    },
  });

  sleep(numericEnv('THINK_TIME', 1));
}
