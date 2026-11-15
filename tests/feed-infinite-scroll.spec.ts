import { expect, test, type Page } from '@playwright/test';

/**
 * Paginação do feed: a primeira página traz 30 publicações e, sempre que o
 * utilizador chega às 5 últimas carregadas, chegam mais 20 — até esgotar.
 * O teste fixa as invariantes visíveis: contagens exactas, ordem de offsets na
 * API, ausência de duplicados e «Fim do feed» só no final.
 */

const INITIAL_PAGE = 30;
const NEXT_PAGE = 20;

interface FeedState {
  articles: number;
  uniqueArticles: number;
  hasEndMarker: boolean;
}

async function readFeedState(page: Page): Promise<FeedState> {
  return page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('article'));
    const ids = articles.map((article) => article.getAttribute('data-post-id') || '');
    return {
      articles: articles.length,
      uniqueArticles: new Set(ids).size,
      hasEndMarker: (document.body.innerText || '').includes('Fim do feed'),
    };
  });
}

/** Rola até à 5.ª publicação a contar do fim, que é o que dispara o pedido. */
async function reachPreloadThreshold(page: Page): Promise<void> {
  await page.evaluate(() => {
    const articles = document.querySelectorAll('article');
    const target = articles[Math.max(0, articles.length - 5)];
    target?.scrollIntoView({ block: 'center' });
  });
}

/** Rola e espera que o feed cresça para o total esperado. */
async function loadNextPage(page: Page, expectedTotal: number): Promise<void> {
  await reachPreloadThreshold(page);
  await expect
    .poll(async () => (await readFeedState(page)).articles, { timeout: 20_000 })
    .toBe(expectedTotal);
}

function pagingRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/posts' && url.searchParams.has('limit')) {
      requests.push(`limit=${url.searchParams.get('limit')}&offset=${url.searchParams.get('offset')}`);
    }
  });
  return requests;
}

test('o feed carrega 30 e depois 20 de cada vez até esgotar', async ({ page }) => {
  const requests = pagingRequests(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (!error.message.includes('WebSocket')) pageErrors.push(error.message);
  });

  await page.goto('/');

  // 1. Abertura do feed: exactamente 30 publicações.
  await expect.poll(async () => (await readFeedState(page)).articles, { timeout: 20_000 }).toBe(INITIAL_PAGE);
  let state = await readFeedState(page);
  expect(state.uniqueArticles).toBe(INITIAL_PAGE);
  expect(state.hasEndMarker).toBe(false);
  expect(requests[0]).toBe(`limit=${INITIAL_PAGE}&offset=0`);

  // 2–4. Chegar às 5 últimas carrega mais 20: 50, 70 e 90.
  for (const total of [50, 70, 90]) {
    await loadNextPage(page, total);
    state = await readFeedState(page);
    expect(state.uniqueArticles).toBe(total);
    expect(state.hasEndMarker).toBe(false);
  }

  // 5. Última página: só as publicações restantes e o fim do feed.
  await loadNextPage(page, 104);
  state = await readFeedState(page);
  expect(state.articles).toBe(104);
  expect(state.uniqueArticles).toBe(104);
  await expect.poll(async () => (await readFeedState(page)).hasEndMarker, { timeout: 10_000 }).toBe(true);

  // 6–7. Exactamente uma requisição por página, com os limites e offsets certos.
  expect(requests).toEqual([
    'limit=30&offset=0',
    'limit=20&offset=30',
    'limit=20&offset=50',
    'limit=20&offset=70',
    'limit=20&offset=90',
  ]);

  // 8. Nenhum erro de render durante o carregamento progressivo.
  expect(pageErrors).toEqual([]);
});

test('o feed não pede mais páginas depois de chegar ao fim', async ({ page }) => {
  const requests = pagingRequests(page);

  await page.goto('/');
  await expect.poll(async () => (await readFeedState(page)).articles, { timeout: 20_000 }).toBe(INITIAL_PAGE);

  // Percorrer até aparecer o fim do feed.
  for (let round = 0; round < 6; round += 1) {
    if ((await readFeedState(page)).hasEndMarker) break;
    const before = (await readFeedState(page)).articles;
    await reachPreloadThreshold(page);
    await expect
      .poll(async () => (await readFeedState(page)).articles, { timeout: 20_000 })
      .toBeGreaterThan(before);
  }

  await expect.poll(async () => (await readFeedState(page)).hasEndMarker, { timeout: 10_000 }).toBe(true);
  const finalCount = (await readFeedState(page)).articles;
  const settledRequests = requests.length;
  expect(finalCount).toBe(104);

  // Continuar a rolar no fim não pode gerar mais pedidos nem mais cartões.
  await reachPreloadThreshold(page);
  await page.waitForTimeout(1500);

  expect((await readFeedState(page)).articles).toBe(finalCount);
  expect(requests.length).toBe(settledRequests);
});
