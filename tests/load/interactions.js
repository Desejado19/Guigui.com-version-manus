/**
 * INTERAÇÕES — gostos, comentários e partilhas.
 *
 * Endpoints reais:
 * - GET  /api/posts/engagements
 * - POST /api/posts/:postId/reaction   (só com ALLOW_WRITES=1)
 * - POST /api/posts/:postId/share      (só com ALLOW_WRITES=1)
 *
 * Por omissão o teste é apenas de leitura. As escritas usam a conta de teste e
 * são revertidas quando possível (gosto retirado logo a seguir); partilhas
 * incrementam um contador real e por isso estão fora do perfil padrão.
 */

import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { ACCOUNTS, ALLOW_WRITES, BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { firstPost, getJson, interactionRoundTrip, login, postJson } from './lib/api.js';

const shareWrites = new Counter('interaction_share_writes');

export const options = {
  // O k6 limpa o cookie jar entre iterações por omissão; a sessão de teste
  // iniciada no primeiro ciclo tem de sobreviver aos seguintes.
  noCookiesReset: true,
  scenarios: {
    interactions: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 60)),
      gracefulRampDown: '10s',
    },
  },
  thresholds: BASE_THRESHOLDS,
};

export function setup() {
  const post = firstPost();
  return { postId: post ? post.id : null };
}

// Cada VU tem o seu cookie jar: inicia sessão uma vez, só se for escrever.
let signedIn = false;

export default function interactions(data) {
  if (ALLOW_WRITES && !signedIn) signedIn = login(ACCOUNTS.citizen).ok;
  const engagements = getJson('/api/posts/engagements');
  check(engagements, {
    'engajamentos: 200': (res) => res.status === 200,
    'engajamentos: mapa de contadores': (res) => Boolean(res.json('engagements')),
  });

  interactionRoundTrip(data.postId);

  if (ALLOW_WRITES && data.postId && __ENV.ALLOW_SHARES === '1') {
    const share = postJson(`/api/posts/${encodeURIComponent(data.postId)}/share`, {});
    check(share, { 'partilha: 200': (res) => res.status === 200 });
    if (share.status === 200) shareWrites.add(1);
  }

  sleep(numericEnv('THINK_TIME', 1));
}
