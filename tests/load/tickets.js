/**
 * BILHETES — apenas leitura. Nenhuma compra, reserva ou validação é executada.
 *
 * Endpoints reais:
 * - GET /api/tickets/mine   (cidadão autenticado)
 * - GET /api/tickets/sold   (empresa autenticada)
 * - GET /api/events         (agenda onde os bilhetes nascem)
 */

import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { ACCOUNTS, BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { getJson, login } from './lib/api.js';

const ticketReadFailures = new Counter('ticket_read_failures');

export const options = {
  // O k6 limpa o cookie jar entre iterações por omissão; a sessão de teste
  // iniciada no primeiro ciclo tem de sobreviver aos seguintes.
  noCookiesReset: true,
  scenarios: {
    tickets: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ...BASE_THRESHOLDS,
    ticket_read_failures: ['count<5'],
  },
};

// O jar de cookies é por VU: cada utilizador virtual inicia a sua sessão uma vez.
let signedIn = false;

export default function tickets() {
  if (!signedIn) signedIn = login(ACCOUNTS.citizen).ok;
  const mine = getJson('/api/tickets/mine');
  const mineOk = check(mine, {
    'meus bilhetes: 200': (res) => res.status === 200,
    'meus bilhetes: lista': (res) => Array.isArray(res.json('tickets')),
  });
  if (!mineOk) ticketReadFailures.add(1);

  const agenda = getJson('/api/events');
  check(agenda, { 'agenda: 200': (res) => res.status === 200 });

  sleep(numericEnv('THINK_TIME', 1));
}
