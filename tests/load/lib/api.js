/**
 * Ajudantes das APIs reais do Guigui.com.
 *
 * Autenticação: `POST /api/auth/login` devolve `Set-Cookie: guigui_session=…`.
 * O k6 mantém o cookie jar por VU, por isso o login no início do teste chega
 * para todas as chamadas seguintes do mesmo utilizador virtual.
 */

import http from 'k6/http';
import { check } from 'k6';
import { ACCEPT_HEADERS, ALLOW_WRITES, BASE_URL, JSON_HEADERS, numericEnv } from './config.js';

export function getJson(path, params = {}) {
  return http.get(`${BASE_URL}${path}`, {
    headers: ACCEPT_HEADERS,
    tags: { endpoint: path.split('?')[0] },
    ...params,
  });
}

export function postJson(path, body, params = {}) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: JSON_HEADERS,
    tags: { endpoint: path.split('?')[0] },
    ...params,
  });
}

/** Inicia sessão com uma conta de teste. Devolve true quando autenticou. */
export function login(account) {
  const response = postJson('/api/auth/login', { email: account.email, password: account.password });
  const ok = check(response, {
    'login: 200': (res) => res.status === 200,
    'login: sessão devolvida': (res) => Boolean(res.json('user')),
  });
  return { ok, response };
}

export function logout() {
  return postJson('/api/auth/logout', {});
}

/** Identificador da primeira empresa pública (para leituras por empresa). */
export function firstBusinessId() {
  const response = getJson('/api/businesses');
  if (response.status !== 200) return null;
  const body = response.json();
  const businesses = body && body.businesses ? body.businesses : [];
  return businesses.length ? businesses[0].id : null;
}

/** Primeira publicação aprovada do feed (id real para métricas/interações). */
export function firstPost() {
  const response = getJson('/api/posts');
  if (response.status !== 200) return null;
  const body = response.json();
  const posts = body && body.posts ? body.posts : [];
  const post = posts.find((entry) => entry && entry.status === 'approved');
  return post || null;
}

/**
 * Leitura de interações. Com ALLOW_WRITES=1 faz também um gosto e retira-o de
 * seguida (o utilizador de teste fica como estava).
 */
export function interactionRoundTrip(postId) {
  const engagements = getJson('/api/posts/engagements');
  check(engagements, { 'interações: 200': (res) => res.status === 200 });

  if (!ALLOW_WRITES || !postId) return;

  const like = postJson(`/api/posts/${encodeURIComponent(postId)}/reaction`, { reaction: 'like' });
  check(like, { 'gosto: 200': (res) => res.status === 200 });
  const clear = postJson(`/api/posts/${encodeURIComponent(postId)}/reaction`, { reaction: null });
  check(clear, { 'gosto removido: 200': (res) => res.status === 200 });
}

/** Ritmo de leitura configurável (segundos entre iterações). */
export function thinkTime() {
  return numericEnv('THINK_TIME', 1);
}
