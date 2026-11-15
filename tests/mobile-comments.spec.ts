import { expect, test, type Page } from '@playwright/test';

/**
 * Comentários mobile (painel inferior estilo Instagram).
 *
 * Verifica que abrir o teclado não provoca zoom, que os cartões mantêm as
 * dimensões, que o Feed volta à mesma posição e que o comentário é realmente
 * gravado no servidor e mostrado de imediato.
 */

const DEMO_PASSWORD = 'Guigui@2026!';
const CITIZEN_EMAIL = 'cidadao.teste@guigui.com';

async function signInCitizen(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: CITIZEN_EMAIL, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

async function firstPost(page: Page) {
  const card = page.locator('article[data-post-id]').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  const postId = await card.getAttribute('data-post-id');
  expect(postId).toBeTruthy();
  return { card, postId: postId as string };
}

const sheet = (page: Page) => page.getByTestId('post-comments-sheet');

const zoomState = (page: Page) =>
  page.evaluate(() => ({
    scale: window.visualViewport?.scale ?? 1,
    scrollX: window.scrollX,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

test.describe('Comentários mobile — painel inferior', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.setTimeout(180_000);

  test('abrir comentários não faz zoom nem altera o cartão', async ({ page }) => {
    await signInCitizen(page);
    await page.goto('/');
    const { card } = await firstPost(page);
    const before = await card.boundingBox();
    expect(before).not.toBeNull();

    // Espera fontes/imagens para o cartão já estar no tamanho final.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const beforeStable = await card.boundingBox();

    await card.getByTestId('post-comment-button').click();
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByLabel('Escrever comentário')).toBeFocused();
    await expect(page.getByLabel('Escrever comentário')).toBeVisible();

    // Campo com 16px: abaixo disso o Safari iOS aplica zoom automático.
    const fontSize = await page
      .getByLabel('Escrever comentário')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    await page.waitForTimeout(300);
    const after = await card.boundingBox();
    expect(Math.round(after!.width)).toBe(Math.round(beforeStable!.width));
    expect(Math.round(after!.height)).toBe(Math.round(beforeStable!.height));

    const state = await zoomState(page);
    expect(state.scale).toBe(1);
    expect(state.scrollX).toBe(0);
    expect(state.overflowX).toBeLessThanOrEqual(0);

    // Scroll da página bloqueado enquanto o painel está aberto.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  });

  test('publica o comentário, mostra-o de imediato e guarda-o no servidor', async ({ page }) => {
    await signInCitizen(page);
    await page.goto('/');
    const { card, postId } = await firstPost(page);
    const unique = `Comentário mobile ${Date.now()}`;

    const countBefore = Number.parseInt((await card.getByTestId('post-comments').innerText()).trim(), 10);

    await card.getByTestId('post-comment-button').click();
    const input = page.getByLabel('Escrever comentário');
    await expect(input).toBeFocused();
    await input.fill(unique);
    await page.getByLabel('Publicar comentário').click();

    await expect(page.getByTestId('post-comments-sheet')).toContainText(unique);
    await expect(input).toHaveValue('');
    await expect(card.getByTestId('post-comments')).toHaveText(`${countBefore + 1} Comentários`, { timeout: 20_000 });

    // Persistência real: o servidor devolve o comentário na publicação certa.
    const engagements = await (await page.request.get('/api/posts/engagements')).json() as {
      engagements?: Record<string, { comments?: Array<{ content?: string }> }>;
    };
    const stored = engagements.engagements?.[postId]?.comments ?? [];
    expect(stored.some((comment) => comment.content === unique)).toBeTruthy();
  });

  test('aceita comentários longos sem quebrar a estrutura', async ({ page }) => {
    await signInCitizen(page);
    await page.goto('/');
    const { card } = await firstPost(page);
    const longText = `Texto longo ${Date.now()} ${'palavra '.repeat(60)}fim`;

    await card.getByTestId('post-comment-button').click();
    await page.getByLabel('Escrever comentário').fill(longText.slice(0, 900));
    await page.getByLabel('Publicar comentário').click();

    await expect(page.getByTestId('post-comments-sheet')).toContainText(longText.slice(0, 60));
    const state = await zoomState(page);
    expect(state.overflowX).toBeLessThanOrEqual(0);

    const panel = await page.getByRole('dialog').boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(-1);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(391);
  });

  test('fechar devolve o Feed à mesma posição e permite reabrir', async ({ page }) => {
    await signInCitizen(page);
    await page.goto('/');
    await firstPost(page);

    const card = page.locator('article[data-post-id]').first();
    const openButton = card.getByTestId('post-comment-button');

    // O primeiro clique pode deslocar a página para trazer o botão à vista
    // (comportamento do próprio teste); a posição de referência é depois disso.
    await openButton.click();
    await expect(sheet(page)).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(sheet(page)).toBeHidden();

    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);
    const cardBefore = await card.boundingBox();

    for (let round = 0; round < 3; round += 1) {
      await openButton.click();
      await expect(sheet(page)).toBeVisible();
      await page.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(sheet(page)).toBeHidden();
    }

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    const cardAfter = await card.boundingBox();
    expect(Math.round(cardAfter!.width)).toBe(Math.round(cardBefore!.width));
    expect(Math.round(cardAfter!.height)).toBe(Math.round(cardBefore!.height));
    expect((await zoomState(page)).scale).toBe(1);
  });

  test('respeita ecrãs pequenos e o espaço visível', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await signInCitizen(page);
    await page.goto('/');
    const { card } = await firstPost(page);
    await card.getByTestId('post-comment-button').click();

    const panel = await page.getByRole('dialog').boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.width).toBeLessThanOrEqual(320);
    expect(panel!.y).toBeGreaterThanOrEqual(0);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(568);

    // Simula teclado: área visível reduzida (VisualViewport) mantém o painel dentro.
    await page.evaluate(() => {
      const viewport = window.visualViewport as (VisualViewport & { __fake?: boolean }) | null;
      if (viewport && !viewport.__fake) {
        viewport.__fake = true;
        Object.defineProperty(viewport, 'height', { configurable: true, value: 300 });
      }
      window.visualViewport?.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(250);
    const compact = await page.getByRole('dialog').boundingBox();
    expect(compact!.y + compact!.height).toBeLessThanOrEqual(569);
  });
});
