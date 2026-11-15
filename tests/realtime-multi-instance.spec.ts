import { expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CANAL DE TEMPO REAL COM VÁRIOS PROCESSOS.
 *
 * Sobe duas instâncias reais do servidor (portas 3101 e 3102) a partilhar a
 * mesma base de dados. Um utilizador ligado a uma instância e outro ligado à
 * outra têm de receber as mesmas interações, sem recarregar a página — o que só
 * acontece se o canal partilhado (PostgreSQL LISTEN/NOTIFY) estiver a funcionar.
 */

const ENTRY = path.join(process.cwd(), 'dist', 'server.mjs');
const PORT_A = 3101;
const PORT_B = 3102;
const ORIGIN_A = `http://127.0.0.1:${PORT_A}`;
const ORIGIN_B = `http://127.0.0.1:${PORT_B}`;

const PASSWORD = 'Guigui@2026!';
const SEED_PASSWORD = 'Guigui2026!';

const running = new Map<number, ChildProcess>();

function startInstance(port: number): void {
  const child = spawn(process.execPath, [ENTRY], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', () => undefined);
  child.stderr?.on('data', () => undefined);
  running.set(port, child);
}

async function waitReady(origin: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/posts`);
      if (response.ok) return;
    } catch {
      /* ainda a arrancar */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`A instância ${origin} não ficou disponível.`);
}

async function stopInstance(port: number): Promise<void> {
  const child = running.get(port);
  if (!child) return;
  running.delete(port);
  child.kill();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/api/posts`);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function signIn(page: Page, origin: string, email: string, password: string): Promise<void> {
  const login = await page.request.post(`${origin}/api/auth/login`, { data: { email, password } });
  expect(login.ok(), `login de ${email}`).toBeTruthy();
  const payload = await login.json() as { user?: { id: string } };
  const cookieHeader = login.headers()['set-cookie'];
  const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader ?? '');
  const match = cookieString.match(/guigui_session=([^;]+)/);
  if (match) {
    await page.context().addCookies([{ name: 'guigui_session', value: match[1], url: origin, httpOnly: true, sameSite: 'Lax', secure: false }]);
  }
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

interface FeedPost { id: string; title: string; businessId?: string; status: string }

async function feedPost(page: Page, origin: string): Promise<FeedPost> {
  const response = await page.request.get(`${origin}/api/posts`);
  const payload = await response.json() as { posts: FeedPost[] };
  const post = payload.posts.find((entry) => Boolean(entry.businessId) && entry.title && entry.status === 'approved');
  expect(post, 'publicação de empresa disponível').toBeTruthy();
  return post as FeedPost;
}

async function likes(page: Page, origin: string, postId: string): Promise<number> {
  const response = await page.request.get(`${origin}/api/posts/engagements`);
  const payload = await response.json() as { engagements: Record<string, { likes: number }> };
  return payload.engagements[postId]?.likes ?? 0;
}

async function openFeed(page: Page, origin: string): Promise<void> {
  await page.goto(`${origin}/`);
  await expect(page.locator('article').first()).toBeVisible({ timeout: 25000 });
}

function card(page: Page, title: string) {
  return page.locator('article').filter({ hasText: title }).first();
}

test.describe('Tempo real entre instâncias', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    expect(fs.existsSync(ENTRY), 'dist/server.mjs tem de existir (npm run build)').toBeTruthy();
    startInstance(PORT_A);
    startInstance(PORT_B);
    await waitReady(ORIGIN_A);
    await waitReady(ORIGIN_B);
  });

  test.afterAll(async () => {
    await stopInstance(PORT_A);
    await stopInstance(PORT_B);
    for (const child of running.values()) child.kill();
    running.clear();
  });

  test('1. gosto numa instância chega ao utilizador ligado à outra', async ({ browser }) => {
    const contextA = await browser.newContext({ baseURL: ORIGIN_A });
    const contextB = await browser.newContext({ baseURL: ORIGIN_B });
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      await signIn(pageA, ORIGIN_A, 'cidadao.teste@guigui.com', PASSWORD);
      await signIn(pageB, ORIGIN_B, 'cidadao.seed02@guigui.test', SEED_PASSWORD);

      const post = await feedPost(pageA, ORIGIN_A);
      await pageA.request.post(`${ORIGIN_A}/api/posts/${post.id}/reaction`, { data: { reaction: null } });

      await openFeed(pageB, ORIGIN_B);
      const cardB = card(pageB, post.title);
      const baseline = await likes(pageA, ORIGIN_A, post.id);
      await expect(cardB.getByTestId('post-likes')).toHaveText(String(baseline), { timeout: 15000 });

      await openFeed(pageA, ORIGIN_A);
      const cardA = card(pageA, post.title);
      const reacted = pageA.waitForResponse((response) => response.url().includes('/reaction') && response.ok());
      await cardA.getByRole('button', { name: /Gostar/i }).first().click();
      await reacted;

      await expect(cardB.getByTestId('post-likes')).toHaveText(String(baseline + 1), { timeout: 6000 });
      expect(await likes(pageB, ORIGIN_B, post.id)).toBe(baseline + 1);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('2. comentário na instância B aparece na instância A', async ({ browser }) => {
    const contextA = await browser.newContext({ baseURL: ORIGIN_A });
    const contextB = await browser.newContext({ baseURL: ORIGIN_B });
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      await signIn(pageA, ORIGIN_A, 'cidadao.teste@guigui.com', PASSWORD);
      await signIn(pageB, ORIGIN_B, 'cidadao.seed02@guigui.test', SEED_PASSWORD);

      const post = await feedPost(pageA, ORIGIN_A);
      await openFeed(pageA, ORIGIN_A);
      await openFeed(pageB, ORIGIN_B);

      const cardA = card(pageA, post.title);
      const cardB = card(pageB, post.title);
      await cardA.getByTestId('post-comments').click();

      const text = `Comentário entre instâncias ${Date.now()}`;
      await cardB.getByTestId('post-comments').click();
      const commented = pageB.waitForResponse((response) => response.url().includes('/comments') && response.request().method() === 'POST' && response.ok());
      await cardB.getByPlaceholder(/Comentar como|Escreva um comentário/).fill(text);
      await cardB.getByLabel('Publicar comentário').click();
      await commented;

      await expect(cardA.getByText(text)).toBeVisible({ timeout: 6000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('3. instância reiniciada recupera o estado e volta a receber eventos', async ({ browser }) => {
    test.setTimeout(120_000);
    const contextA = await browser.newContext({ baseURL: ORIGIN_A });
    try {
      const pageA = await contextA.newPage();
      await signIn(pageA, ORIGIN_A, 'cidadao.teste@guigui.com', PASSWORD);
      const post = await feedPost(pageA, ORIGIN_A);
      const persisted = await likes(pageA, ORIGIN_A, post.id);

      await stopInstance(PORT_B);
      startInstance(PORT_B);
      await waitReady(ORIGIN_B);

      const contextB = await browser.newContext({ baseURL: ORIGIN_B });
      try {
        const pageB = await contextB.newPage();
        await signIn(pageB, ORIGIN_B, 'cidadao.seed02@guigui.test', SEED_PASSWORD);
        expect(await likes(pageB, ORIGIN_B, post.id)).toBe(persisted);

        await openFeed(pageB, ORIGIN_B);
        const cardB = card(pageB, post.title);
        await expect(cardB.getByTestId('post-likes')).toHaveText(String(persisted), { timeout: 15000 });

        await openFeed(pageA, ORIGIN_A);
        const cardA = card(pageA, post.title);
        const reacted = pageA.waitForResponse((response) => response.url().includes('/reaction') && response.ok());
        await cardA.getByRole('button', { name: /Gostar/i }).first().click();
        await reacted;

        const expected = await likes(pageA, ORIGIN_A, post.id);
        await expect(cardB.getByTestId('post-likes')).toHaveText(String(expected), { timeout: 6000 });
      } finally {
        await contextB.close();
      }
    } finally {
      await contextA.close();
    }
  });

  test('4. sem eventos duplicados e diagnóstico do canal disponível', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN_A });
    try {
      const page = await context.newPage();
      await signIn(page, ORIGIN_A, 'admin.teste@guigui.com', SEED_PASSWORD);
      const post = await feedPost(page, ORIGIN_A);

      // A mesma reação repetida não cria uma segunda interação.
      await page.request.post(`${ORIGIN_A}/api/posts/${post.id}/reaction`, { data: { reaction: null } });
      const baseline = await likes(page, ORIGIN_A, post.id);
      await page.request.post(`${ORIGIN_A}/api/posts/${post.id}/reaction`, { data: { reaction: 'like' } });
      await page.request.post(`${ORIGIN_A}/api/posts/${post.id}/reaction`, { data: { reaction: 'like' } });
      expect(await likes(page, ORIGIN_A, post.id)).toBe(baseline + 1);

      const status = await page.request.get(`${ORIGIN_A}/api/realtime/status`);
      expect(status.ok()).toBeTruthy();
      const payload = await status.json() as { channel: string; connected: boolean; received: number; duplicatesDropped: number; mode: string };
      expect(payload.channel).toBe('guigui_realtime');
      expect(payload.mode).toBe('postgres');
      expect(payload.connected).toBe(true);
      expect(payload.received).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});
