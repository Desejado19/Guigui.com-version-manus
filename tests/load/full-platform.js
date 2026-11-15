/**
 * FULL PLATFORM — percurso misto com o peso aproximado do uso real de leitura.
 *
 * 60% navegação do feed, 15% agenda/stories, 15% autenticação, 10% interações.
 * Todos os pedidos usam endpoints reais e, por omissão, nenhum escreve dados.
 * Com ALLOW_WRITES=1 a componente de interações faz gosto e remove-o de seguida.
 */

import { check, sleep } from 'k6';
import { ACCOUNTS, ALLOW_WRITES, BASE_THRESHOLDS, progressiveStages, numericEnv } from './lib/config.js';
import { firstBusinessId, firstPost, getJson, interactionRoundTrip, login, logout } from './lib/api.js';

export const options = {
  scenarios: {
    full: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: progressiveStages(numericEnv('DURATION', 90)),
      gracefulRampDown: '15s',
    },
  },
  thresholds: BASE_THRESHOLDS,
};

export function setup() {
  const post = firstPost();
  return { postId: post ? post.id : null, businessId: firstBusinessId() };
}

export default function fullPlatform(data) {
  const roll = Math.random();

  if (roll < 0.6) {
    const posts = getJson('/api/posts');
    check(posts, { 'feed: 200': (res) => res.status === 200 });

    const businesses = getJson('/api/businesses');
    check(businesses, { 'empresas: 200': (res) => res.status === 200 });

    if (data.businessId) {
      getJson(`/api/businesses/${encodeURIComponent(data.businessId)}/reviews`);
    }
  } else if (roll < 0.75) {
    const events = getJson('/api/events');
    check(events, { 'eventos: 200': (res) => res.status === 200 });

    const bootstrap = getJson('/api/sync/bootstrap');
    check(bootstrap, { 'stories/bootstrap: 200': (res) => res.status === 200 });
  } else if (roll < 0.9) {
    const session = login(ACCOUNTS.citizen);
    if (session.ok) {
      const current = getJson('/api/auth/session');
      check(current, { 'sessão: 200': (res) => res.status === 200 });
      logout();
    }
  } else {
    interactionRoundTrip(data.postId);
  }

  if (!ALLOW_WRITES) {
    // Sem escrita, as interações são apenas leitura do mapa agregado.
    getJson('/api/posts/engagements');
  }

  sleep(numericEnv('THINK_TIME', 1));
}
