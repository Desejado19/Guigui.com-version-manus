/**
 * TEMPO REAL — o Guigui.com usa Server-Sent Events, não WebSocket.
 *
 * Endpoint real: GET /api/posts/engagements/stream (text/event-stream).
 * O k6 não tem cliente SSE: medimos aqui o handshake e a manutenção da ligação
 * com um timeout curto. Um timeout é o comportamento correto (o servidor deixa
 * o stream aberto), por isso os limites HTTP genéricos não se aplicam a este
 * teste — só a métrica de falhas de handshake conta.
 *
 * Ligação autenticada (por utilizador) é coberta por /api/conversations/events,
 * que exige sessão; aqui usamos o canal público de interações.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { ALLOW_WRITES, BASE_URL, progressiveStages, numericEnv, USER_AGENT } from './lib/config.js';

const handshakeFailures = new Counter('sse_handshake_failures');
const handshakeDuration = new Trend('sse_handshake_duration');

export const options = {
  scenarios: {
    realtime: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    sse_handshake_failures: ['count<5'],
    sse_handshake_duration: ['p(95)<3000'],
  },
};

export default function realtime() {
  const holdMs = numericEnv('SSE_HOLD_MS', 1200);
  const response = http.get(`${BASE_URL}/api/posts/engagements/stream`, {
    headers: { Accept: 'text/event-stream', 'User-Agent': USER_AGENT },
    timeout: `${holdMs}ms`,
    tags: { endpoint: 'realtime', kind: 'sse' },
  });

  // 0/1050 = o k6 cortou a ligação ao fim do timeout: stream aberto, como esperado.
  const expectedHold = response.status === 0 && response.error_code === 1050;
  const unexpected = !expectedHold;

  handshakeDuration.add(response.timings.duration);
  if (unexpected) handshakeFailures.add(1);

  check(response, {
    'sse: ligação aceite (stream mantido aberto)': () => expectedHold,
  });

  sleep(numericEnv('THINK_TIME', 1));
}

/**
 * ALLOW_WRITES=1 emite um gosto na publicação em falta de parâmetro? Não:
 * este script não escreve nada. A variável existe só para documentar que o
 * timestamp das interações é medido em interactions.js.
 */
void ALLOW_WRITES;
