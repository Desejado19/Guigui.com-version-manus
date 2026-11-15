import { expect, test, type Page } from '@playwright/test';

/**
 * SINCRONIZAÇÃO GLOBAL DAS PUBLICAÇÕES E INTERAÇÕES.
 *
 * O feed e a ficha da empresa são duas apresentações da MESMA publicação: os
 * gostos, comentários, respostas e partilhas têm de coincidir nos dois locais,
 * nos dois sentidos (Feed → Ficha e Ficha → Feed), e sobreviver ao recarregar
 * da página. Os testes usam as contas reais da demonstração.
 */

const DEMO_PASSWORD = 'Guigui@2026!';
const CITIZEN = 'cidadao.teste@guigui.com';
const SECOND_CITIZEN = 'cidadao.seed02@guigui.test';
const SEED_PASSWORD = 'Guigui2026!';

async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    const login = await page.request.post('/api/auth/login', { data: { email, password } });
    if (login.ok()) {
      const payload = await login.json() as { user?: { id: string } };
      const setCookie = login.headers()['set-cookie'];
      const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie ?? '');
      const cookieMatch = cookieString.match(/guigui_session=([^;]+)/);
      if (cookieMatch) {
        const cookieURL = test.info().project.use.baseURL ?? 'http://localhost:3000';
        await page.context().addCookies([{
          name: 'guigui_session',
          value: cookieMatch[1],
          url: cookieURL,
          httpOnly: true,
          sameSite: 'Lax',
          secure: false,
        }]);
      }
      await page.addInitScript((account) => {
        window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
        window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      }, payload.user);
      return;
    }
    await page.waitForTimeout(2000);
  }
  throw new Error(`Não foi possível autenticar ${email}.`);
}

interface FeedPost {
  id: string;
  title: string;
  businessId?: string;
  businessName?: string;
  status: string;
}

async function feedPost(page: Page): Promise<FeedPost> {
  const response = await page.request.get('/api/posts');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { posts: FeedPost[] };
  const post = payload.posts.find((entry) => Boolean(entry.businessId) && entry.title && entry.status === 'approved');
  expect(post, 'deve existir uma publicação de empresa aprovada no feed').toBeTruthy();
  return post as FeedPost;
}

async function engagements(page: Page, postId: string) {
  const response = await page.request.get('/api/posts/engagements');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { engagements: Record<string, { likes: number; shares: number; comments: Array<{ id: string; content: string }> }> };
  return payload.engagements[postId] ?? { likes: 0, shares: 0, comments: [] };
}

async function openFeed(page: Page) {
  const loaded = page.waitForResponse((response) => response.url().includes('/api/posts/engagements') && response.status() === 200);
  await page.goto('/');
  await loaded.catch(() => undefined);
  await expect(page.locator('article').first()).toBeVisible({ timeout: 20000 });
}

function feedCard(page: Page, title: string) {
  return page.locator('article').filter({ hasText: title }).first();
}

async function openBusinessProfile(page: Page, card: ReturnType<typeof feedCard>) {
  await card.getByRole('button', { name: /Ver Ficha/i }).first().click();
  const modal = page.locator('div.fixed.inset-0.z-50').last();
  await expect(modal).toBeVisible({ timeout: 15000 });
  await modal.getByRole('button', { name: /Publicações/i }).first().click();
  return modal;
}

async function closeProfile(page: Page) {
  await page.mouse.click(4, 4);
  await expect(page.locator('div.fixed.inset-0.z-50')).toHaveCount(0, { timeout: 10000 });
}

test.describe('Publicações sincronizadas entre Feed e Ficha', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, CITIZEN);
  });

  test('1. gosto no feed aparece na ficha com o mesmo número', async ({ page }) => {
    const post = await feedPost(page);
    // Estado conhecido: sem reação do cidadão na publicação.
    await page.request.post(`/api/posts/${post.id}/reaction`, { data: { reaction: null } });
    await openFeed(page);

    const card = feedCard(page, post.title);
    await expect(card).toBeVisible();
    const before = (await engagements(page, post.id)).likes;
    await expect(card.getByTestId('post-likes')).toHaveText(String(before));

    const reacted = page.waitForResponse((response) => response.url().includes('/reaction') && response.ok());
    await card.getByRole('button', { name: /Gostar/i }).first().click();
    await reacted;
    const after = before + 1;
    await expect(card.getByTestId('post-likes')).toHaveText(String(after));
    expect((await engagements(page, post.id)).likes).toBe(after);

    const modal = await openBusinessProfile(page, card);
    await expect(modal.getByTestId('post-likes').filter({ hasText: String(after) }).first()).toBeVisible({ timeout: 10000 });
  });

  test('2. gosto na ficha atualiza o feed', async ({ page }) => {
    const post = await feedPost(page);
    await page.request.post(`/api/posts/${post.id}/reaction`, { data: { reaction: null } });
    await openFeed(page);
    const card = feedCard(page, post.title);
    const modal = await openBusinessProfile(page, card);

    const fichaCard = modal.locator('article').filter({ hasText: post.title }).first();
    await expect(fichaCard).toBeVisible({ timeout: 10000 });
    const before = (await engagements(page, post.id)).likes;
    await expect(fichaCard.getByTestId('post-likes')).toHaveText(String(before));
    const reacted = page.waitForResponse((response) => response.url().includes('/reaction') && response.ok());
    await fichaCard.getByRole('button', { name: /Gostar/i }).first().click();
    await reacted;
    const after = before + 1;
    await expect(fichaCard.getByTestId('post-likes')).toHaveText(String(after));

    await closeProfile(page);
    await expect(card.getByTestId('post-likes')).toHaveText(String(after));
    expect((await engagements(page, post.id)).likes).toBe(after);
  });

  test('3. comentário no feed aparece na ficha e comentário na ficha aparece no feed', async ({ page }) => {
    const post = await feedPost(page);
    await openFeed(page);
    const card = feedCard(page, post.title);
    const feedText = `Comentário feed ${Date.now()}`;

    await card.getByTestId('post-comments').click();
    const commented = page.waitForResponse((response) => response.url().includes('/comments') && response.request().method() === 'POST' && response.ok());
    await card.getByPlaceholder(/Comentar como|Escreva um comentário/).fill(feedText);
    await card.getByLabel('Publicar comentário').click();
    await commented;
    await expect(card.getByText(feedText)).toBeVisible();

    const modal = await openBusinessProfile(page, card);
    const fichaCard = modal.locator('article').filter({ hasText: post.title }).first();
    await fichaCard.getByTestId('post-comments').click();
    await expect(fichaCard.getByText(feedText)).toBeVisible({ timeout: 10000 });

    const fichaText = `Comentário ficha ${Date.now()}`;
    const fichaInput = fichaCard.getByPlaceholder(/Comentar como|Escreva um comentário/);
    if (!(await fichaInput.isVisible())) await fichaCard.getByTestId('post-comments').click();
    await expect(fichaInput).toBeVisible();
    const commentedFromFicha = page.waitForResponse((response) => response.url().includes('/comments') && response.request().method() === 'POST' && response.ok());
    await fichaInput.fill(fichaText);
    await fichaCard.getByLabel('Publicar comentário').click();
    await commentedFromFicha;
    await expect(fichaCard.getByText(fichaText)).toBeVisible();
    await closeProfile(page);

    await expect(card.getByText(fichaText)).toBeVisible();
    const stored = await engagements(page, post.id);
    expect(stored.comments.map((comment) => comment.content)).toEqual(expect.arrayContaining([feedText, fichaText]));
  });

  test('4. respostas a comentários aparecem nos dois locais', async ({ page }) => {
    const post = await feedPost(page);
    await openFeed(page);
    const card = feedCard(page, post.title);

    await card.getByTestId('post-comments').click();
    const commentText = `Comentário base ${Date.now()}`;
    const commented = page.waitForResponse((response) => response.url().includes('/comments') && response.request().method() === 'POST' && response.ok());
    await card.getByPlaceholder(/Comentar como|Escreva um comentário/).fill(commentText);
    await card.getByLabel('Publicar comentário').click();
    await commented;

    const replyText = `Resposta ${Date.now()}`;
    await card.getByRole('button', { name: 'Responder', exact: true }).last().click();
    const replied = page.waitForResponse((response) => response.url().includes('/comments/reply') && response.ok());
    await card.getByLabel(/Responder a /).fill(replyText);
    await card.getByLabel('Publicar resposta').click();
    await replied;
    await expect(card.getByText(replyText).first()).toBeVisible();

    const modal = await openBusinessProfile(page, card);
    const fichaCard = modal.locator('article').filter({ hasText: post.title }).first();
    await fichaCard.getByTestId('post-comments').click();
    await expect(fichaCard.getByText(commentText)).toBeVisible({ timeout: 10000 });
    await expect(fichaCard.getByText(replyText)).toBeVisible({ timeout: 10000 });
  });

  test('5. dados permanecem corretos depois de recarregar a página', async ({ page }) => {
    const post = await feedPost(page);
    await openFeed(page);
    const card = feedCard(page, post.title);

    const reacted = page.waitForResponse((response) => response.url().includes('/reaction') && response.ok());
    await card.getByRole('button', { name: /Gostar/i }).first().click();
    await reacted;
    const expected = await engagements(page, post.id);

    await page.reload();
    await expect(page.locator('article').first()).toBeVisible({ timeout: 20000 });
    const reloaded = feedCard(page, post.title);
    await expect(reloaded.getByTestId('post-likes')).toHaveText(String(expected.likes));
    expect((await engagements(page, post.id)).likes).toBe(expected.likes);
  });

  test('6. contagens iguais para uma segunda conta de utilizador', async ({ page, browser }) => {
    const post = await feedPost(page);
    await openFeed(page);
    const card = feedCard(page, post.title);
    const reacted = page.waitForResponse((response) => response.url().includes('/reaction') && response.ok());
    await card.getByRole('button', { name: /Gostar/i }).first().click();
    await reacted;
    const shared = (await engagements(page, post.id)).likes;

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await signIn(otherPage, SECOND_CITIZEN, SEED_PASSWORD);
      await openFeed(otherPage);
      const otherCard = feedCard(otherPage, post.title);
      await expect(otherCard).toBeVisible({ timeout: 15000 });
      await expect(otherCard.getByTestId('post-likes')).toHaveText(String(shared), { timeout: 15000 });
    } finally {
      await otherContext.close();
    }
  });

  test('9. a interação de outro utilizador aparece de imediato (SSE, sem recarregar)', async ({ page, browser }) => {
    const post = await feedPost(page);
    await page.request.post(`/api/posts/${post.id}/reaction`, { data: { reaction: null } });

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    try {
      await signIn(otherPage, SECOND_CITIZEN, SEED_PASSWORD);
      await openFeed(otherPage);
      const otherCard = feedCard(otherPage, post.title);
      const baseline = (await engagements(page, post.id)).likes;
      await expect(otherCard.getByTestId('post-likes')).toHaveText(String(baseline));

      await openFeed(page);
      const card = feedCard(page, post.title);
      const reacted = page.waitForResponse((response) => response.url().includes('/reaction') && response.ok());
      await card.getByRole('button', { name: /Gostar/i }).first().click();
      await reacted;

      // O outro utilizador vê o novo valor sem recarregar e sem esperar polling.
      await expect(otherCard.getByTestId('post-likes')).toHaveText(String(baseline + 1), { timeout: 4000 });
    } finally {
      await otherContext.close();
    }
  });

  test('8. partilha na ficha atualiza a contagem no feed', async ({ page, context }) => {
    await context.route('**api.whatsapp.com**', (route) => route.abort());
    const post = await feedPost(page);
    await openFeed(page);
    const card = feedCard(page, post.title);
    const before = (await engagements(page, post.id)).shares;
    await expect(card.getByTestId('post-shares')).toContainText(String(before));

    const modal = await openBusinessProfile(page, card);
    const fichaCard = modal.locator('article').filter({ hasText: post.title }).first();
    await expect(fichaCard).toBeVisible();
    const shared = page.waitForResponse((response) => response.url().includes('/share') && response.ok());
    await fichaCard.getByRole('button', { name: /Partilhar/i }).first().click();
    await shared;
    const after = before + 1;
    await expect(fichaCard.getByTestId('post-shares')).toContainText(String(after));

    await closeProfile(page);
    await expect(card.getByTestId('post-shares')).toContainText(String(after));
    expect((await engagements(page, post.id)).shares).toBe(after);
  });

  test('7. cada publicação tem um único identificador no feed e na ficha', async ({ page }) => {
    const post = await feedPost(page);
    await openFeed(page);
    const card = feedCard(page, post.title);
    const modal = await openBusinessProfile(page, card);
    const fichaCard = modal.locator('article').filter({ hasText: post.title }).first();
    await expect(fichaCard).toBeVisible();

    const feedPosts = (await (await page.request.get('/api/posts')).json()) as { posts: FeedPost[] };
    const matching = feedPosts.posts.filter((entry) => entry.title === post.title && entry.businessId === post.businessId);
    expect(matching.length).toBeGreaterThan(0);
    expect(new Set(matching.map((entry) => entry.id)).size).toBe(1);
    expect((await engagements(page, post.id)).likes).toBeGreaterThanOrEqual(0);
  });
});
