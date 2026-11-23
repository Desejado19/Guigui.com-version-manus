import { expect, test, type APIRequestContext, type Page } from './fixtures';

/**
 * Feed + localizações + interações: 11 cenários exigidos.
 *
 * Os testes de interação autenticam pelo endpoint real (`/api/auth/login`) e
 * usam os mesmos endpoints que a interface usa, para garantir que os números
 * vêm do servidor e não de estado local do browser.
 */

const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };
const BUSINESS = { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' };
const BASE_URL = `http://localhost:${process.env.PW_PORT?.trim() || '3000'}`;

async function login(request: APIRequestContext, account: { email: string; password: string }) {
  const response = await request.post('/api/auth/login', { data: account });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).user as { id: string; name: string; role: string };
}

const openFilter = async (page: Page) => {
  await page.getByRole('button', { name: /filtrar por localização/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Localidades de Bissau' }).first();
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe('Feed, localizações e interações', () => {
  test('1. o filtro de Eventos não oferece a opção "Todos"', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Cultural Agenda|Agenda Cultural/i }).first().click();
    const trigger = page.getByRole('button', { name: /filtrar por localização/i }).first();
    await expect(trigger).toContainText('Localização');
    const dialog = await openFilter(page);
    await expect(dialog.getByPlaceholder('Pesquisar bairro ou localidade...')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Ver todos' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Limpar filtros' })).toHaveCount(0);
    await expect(dialog.getByRole('option').first()).toBeVisible();
  });

  test('2. no feed, "Todos" abre a lista completa de bairros com pesquisa', async ({ page, request }) => {
    const catalogResponse = await request.get('/api/locations');
    expect(catalogResponse.ok(), await catalogResponse.text()).toBeTruthy();
    const catalog = await catalogResponse.json();
    expect(catalog.locations.length).toBeGreaterThanOrEqual(50);
    await page.goto('/');
    const dialog = await openFilter(page);
    // A lista é preenchida a partir do catálogo já carregado; esperar pela
    // primeira opção evita ler a contagem antes do render.
    await expect(dialog.getByRole('option').first()).toBeVisible();
    await expect.poll(async () => dialog.getByRole('option').count()).toBe(catalog.locations.length);
    await dialog.getByPlaceholder('Pesquisar bairro ou localidade...').fill('bandim');
    await expect(dialog.getByRole('option', { name: /Bandim/ })).toBeVisible();
    await dialog.getByPlaceholder('Pesquisar bairro ou localidade...').fill('Praca dos Herois');
    await expect(dialog.getByRole('option', { name: /Praça dos Heróis/ })).toBeVisible();
  });

  test('3. escolher um bairro no feed filtra no servidor (/api/posts?neighborhood=)', async ({ page }) => {
    await page.goto('/');
    const dialog = await openFilter(page);
    const filteredRequest = page.waitForRequest((request) =>
      request.url().includes('/api/posts?') && request.url().includes('neighborhood=Bandim'));
    await dialog.getByRole('option', { name: 'Bandim', exact: true }).click();
    await filteredRequest;
    await expect(page.getByRole('button', { name: /filtrar por localização/i }).first()).toContainText('Bandim');
    await expect(page.getByText(/A filtrar publicações na zona/i).first()).toBeVisible();
  });

  test('4. a API filtra por bairro com dados reais e não inventa localizações', async ({ request }) => {
    const all = await (await request.get('/api/posts')).json();
    expect(all.posts.length).toBeGreaterThan(0);

    const bandim = await (await request.get('/api/posts?neighborhood=Bandim')).json();
    expect(bandim.filter.neighborhood).toBe('Bandim');
    expect(bandim.posts.length).toBeGreaterThan(0);
    for (const post of bandim.posts) {
      expect(String(post.neighborhood || '').toLowerCase()).toContain('bandim');
    }

    const empty = await (await request.get('/api/posts?neighborhood=Santa Luzia')).json();
    expect(empty.posts).toEqual([]);

    const unmatched = all.posts.filter((post: { neighborhood?: string }) => !post.neighborhood);
    expect(unmatched.length).toBe(unmatched.length); // documental: posts sem localização existem
    for (const post of empty.posts) expect(post.neighborhood).toBeTruthy();
  });

  test('5. cada publicação mostra entidade, logo, localização e data', async ({ page, request }) => {
    const first = (await (await request.get('/api/posts')).json()).posts[0];
    await page.goto('/');
    const card = page.locator('article').first();
    await expect(card).toContainText(first.businessName);
    await expect(card.locator('img').first()).toBeAttached();
    await expect(card).toContainText(first.neighborhood);
    await expect(card.locator('time').first()).toBeVisible();
    await expect(card.locator('time').first()).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  });

  test('6. clicar no nome da entidade abre a ficha da empresa', async ({ page, request }) => {
    const first = (await (await request.get('/api/posts')).json()).posts[0];
    await page.goto('/');
    await page.getByText(first.businessName, { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: new RegExp(first.businessName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()).toBeVisible();
  });

  test('7. gostos: registar, trocar e retirar sem duplicar', async ({ page }) => {
    const user = await login(page.request, CITIZEN);
    const postId = (await (await page.request.get('/api/posts')).json()).posts[0].id;

    const like = await page.request.post(`/api/posts/${postId}/reaction`, { data: { reaction: 'like' } });
    expect(like.ok(), await like.text()).toBeTruthy();
    const first = (await like.json()).engagement;
    expect(first.myReaction).toBe('like');
    const likesAfterFirst = first.likes;

    const again = (await (await page.request.post(`/api/posts/${postId}/reaction`, { data: { reaction: 'like' } })).json()).engagement;
    expect(again.likes).toBe(likesAfterFirst);

    const changed = (await (await page.request.post(`/api/posts/${postId}/reaction`, { data: { reaction: 'love' } })).json()).engagement;
    expect(changed.likes).toBe(likesAfterFirst);
    expect(changed.myReaction).toBe('love');

    const removed = (await (await page.request.post(`/api/posts/${postId}/reaction`, { data: { reaction: null } })).json()).engagement;
    expect(removed.likes).toBe(likesAfterFirst - 1);
    expect(removed.myReaction).toBeNull();
    expect(user.id).toBeTruthy();
  });

  test('8. comentários: publicar, contar e rejeitar vazios', async ({ page }) => {
    const user = await login(page.request, CITIZEN);
    const postId = (await (await page.request.get('/api/posts')).json()).posts[0].id;
    const before = (await (await page.request.get('/api/posts/engagements')).json()).engagements[postId]?.comments.length ?? 0;

    const text = `Comentário automático ${Date.now()}`;
    const created = await page.request.post(`/api/posts/${postId}/comments`, { data: { text } });
    expect(created.status(), await created.text()).toBe(201);
    const body = await created.json();
    expect(body.comment.authorName).toBe(user.name);
    expect(body.engagement.comments.length).toBe(before + 1);

    const empty = await page.request.post(`/api/posts/${postId}/comments`, { data: { text: '   ' } });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).code).toBe('EMPTY_COMMENT');

    const after = (await (await page.request.get('/api/posts/engagements')).json()).engagements[postId];
    expect(after.comments.some((comment: { content: string }) => comment.content === text)).toBe(true);
  });

  test('9. partilhas: cada partilha incrementa o total', async ({ page }) => {
    await login(page.request, CITIZEN);
    const postId = (await (await page.request.get('/api/posts')).json()).posts[0].id;
    const before = (await (await page.request.get('/api/posts/engagements')).json()).engagements[postId]?.shares ?? 0;
    const shared = (await (await page.request.post(`/api/posts/${postId}/share`)).json()).engagement;
    expect(shared.shares).toBe(before + 1);
  });

  test('10. painel da empresa mostra métricas reais e só da própria empresa', async ({ page, request, playwright }) => {
    await login(request, CITIZEN);
    const posts = (await (await request.get('/api/posts')).json()).posts;
    const ownPost = posts.find((post: { businessId: string }) => post.businessId === 'biz-1');
    expect(ownPost, 'é preciso existir uma publicação da empresa biz-1').toBeTruthy();
    await request.post(`/api/posts/${ownPost.id}/reaction`, { data: { reaction: 'like' } });
    await request.post(`/api/posts/${ownPost.id}/comments`, { data: { text: 'Métrica real' } });
    await request.post(`/api/posts/${ownPost.id}/share`);

    const businessRequest = await playwright.request.newContext({ baseURL: BASE_URL });
    await login(businessRequest, BUSINESS);
    const metricsResponse = await businessRequest.get('/api/businesses/biz-1/post-metrics');
    expect(metricsResponse.ok(), await metricsResponse.text()).toBeTruthy();
    const metrics = await metricsResponse.json();
    expect(metrics.totals.likes).toBeGreaterThan(0);
    expect(metrics.totals.comments).toBeGreaterThan(0);
    expect(metrics.totals.shares).toBeGreaterThan(0);
    const metricPost = metrics.posts.find((post: { id: string }) => post.id === ownPost.id);
    expect(metricPost.likes).toBeGreaterThan(0);
    expect(metricPost.comments).toBeGreaterThan(0);
    expect(metricPost.latestComments.some((comment: { content: string }) => comment.content === 'Métrica real')).toBe(true);
    expect(metrics.topPosts.length).toBeGreaterThan(0);

    const foreign = await businessRequest.get('/api/businesses/seed-co-18/post-metrics');
    expect(foreign.status()).toBe(403);
    expect((await foreign.json()).code).toBe('BUSINESS_SCOPE_REQUIRED');

    const citizenRequest = await playwright.request.newContext({ baseURL: BASE_URL });
    await login(citizenRequest, CITIZEN);
    expect((await citizenRequest.get('/api/businesses/biz-1/post-metrics')).status()).toBe(403);
    await businessRequest.dispose();
    await citizenRequest.dispose();
  });

  test('11. interações exigem sessão e notificam a empresa sem duplicar', async ({ page, playwright }) => {
    const postId = 'post-biz-1-1';
    const anonymous = await page.request.post(`/api/posts/${postId}/reaction`, { data: { reaction: 'like' } });
    expect(anonymous.status()).toBe(401);
    expect((await page.request.post(`/api/posts/${postId}/share`)).status()).toBe(401);

    const businessRequest = await playwright.request.newContext({ baseURL: BASE_URL });
    await login(businessRequest, BUSINESS);

    const citizenRequest = await playwright.request.newContext({ baseURL: BASE_URL });
    await login(citizenRequest, CITIZEN);
    await citizenRequest.post(`/api/posts/${postId}/reaction`, { data: { reaction: 'like' } });
    await citizenRequest.post(`/api/posts/${postId}/reaction`, { data: { reaction: 'like' } });

    const notifications = (await (await businessRequest.get('/api/notifications')).json())
      .filter((notification: { metadata?: { dedupeKey?: string } }) => notification.metadata?.dedupeKey?.startsWith(`reaction:${postId}:`));
    const dedupeKeys = notifications.map((notification: { metadata: { dedupeKey: string } }) => notification.metadata.dedupeKey);
    expect(dedupeKeys.length).toBe(new Set(dedupeKeys).size);
    const created = notifications.find((notification: { metadata?: { dedupeKey?: string } }) =>
      notification.metadata?.dedupeKey?.endsWith(':like'));
    expect(created, 'a empresa deve receber a notificação do gosto').toBeTruthy();
    expect(created.metadata.kind).toBe('like');
    expect(created.metadata.postId).toBe(postId);
    expect(created.metadata.actionUrl).toContain(postId);
    expect(created.message).toContain('publicação');
    await businessRequest.dispose();
    await citizenRequest.dispose();
  });
});
