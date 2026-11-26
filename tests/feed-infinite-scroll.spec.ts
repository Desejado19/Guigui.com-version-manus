import { expect, test, type Page } from './fixtures';

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
    // Dispara o observador: sobe um pouco e depois desce até ao fim, para
    // garantir que o sentinela (5.º a contar do fim) entra na zona de
    // pré-carregamento de 400px e o observer re-dispara.
    window.scrollBy(0, -300);
    const articles = document.querySelectorAll('article');
    const target = articles[Math.max(0, articles.length - 5)];
    if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    window.scrollBy(0, 400);
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(800);
}

/** Rola e espera que o feed cresça para o total esperado. */
async function loadNextPage(page: Page, expectedTotal: number): Promise<void> {
  // A primeira tentativa pode acontecer antes de o observador estar ligado ao
  // nó final; repetir a rolagem torna o teste estável sem enfraquecer a
  // asserção do total exacto.
  const deadline = Date.now() + 20_000;
  while ((await readFeedState(page)).articles < expectedTotal && Date.now() < deadline) {
    await reachPreloadThreshold(page);
  }
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

test('o feed carrega 30 e depois 20 de cada vez até esgotar', async ({ page, request }) => {
  test.setTimeout(180_000);
  // O total de publicações aprovadas varia com o seed e com os dados criados
  // pelos testes; a paginação é validada contra o total real da API.
  const payload = await (await request.get('/api/posts?limit=30&offset=0')).json();
  const totalPosts = Number(payload.total);
  expect(totalPosts).toBeGreaterThan(INITIAL_PAGE);
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

  // 2–4. Chegar às 5 últimas carrega as páginas seguintes de 20 em 20.
  const expectedTotals: number[] = [];
  for (let total = INITIAL_PAGE + NEXT_PAGE; total < totalPosts; total += NEXT_PAGE) {
    expectedTotals.push(total);
  }
  expectedTotals.push(totalPosts);
  for (const total of expectedTotals) {
    await loadNextPage(page, total);
    state = await readFeedState(page);
    expect(state.uniqueArticles).toBe(total);
  }

  // 5. A última página traz as publicações restantes e marca o fim do feed.
  expect(state.articles).toBe(totalPosts);
  await expect.poll(async () => (await readFeedState(page)).hasEndMarker, { timeout: 10_000 }).toBe(true);

  // 6–7. Exactamente uma requisição por página, com os limites e offsets certos.
  const expectedRequests = ['limit=30&offset=0'];
  for (let offset = INITIAL_PAGE; offset < totalPosts; offset += NEXT_PAGE) {
    expectedRequests.push(`limit=20&offset=${offset}`);
  }
  expect(requests).toEqual(expectedRequests);

  // 8. Nenhum erro de render durante o carregamento progressivo.
  expect(pageErrors).toEqual([]);
});

test('o feed não pede mais páginas depois de chegar ao fim', async ({ page, request }) => {
  const payload = await (await request.get('/api/posts?limit=30&offset=0')).json();
  const totalPosts = Number(payload.total);
  const requests = pagingRequests(page);

  await page.goto('/');
  await expect.poll(async () => (await readFeedState(page)).articles, { timeout: 20_000 }).toBe(INITIAL_PAGE);

  // Percorrer até aparecer o fim do feed.
  for (let round = 0; round < 12; round += 1) {
    if ((await readFeedState(page)).hasEndMarker) break;
    const before = (await readFeedState(page)).articles;
    let grew = false;
    for (let attempt = 0; attempt < 10 && !grew; attempt += 1) {
      await reachPreloadThreshold(page);
      await page.waitForTimeout(400);
      grew = (await readFeedState(page)).articles > before;
    }
    expect(grew, `o feed não cresceu a partir de ${before} artigos`).toBe(true);
  }

  await expect.poll(async () => (await readFeedState(page)).hasEndMarker, { timeout: 10_000 }).toBe(true);
  const finalCount = (await readFeedState(page)).articles;
  const settledRequests = requests.length;
  expect(finalCount).toBe(totalPosts);

  // Continuar a rolar no fim não pode gerar mais pedidos nem mais cartões.
  await reachPreloadThreshold(page);
  await page.waitForTimeout(1500);

  expect((await readFeedState(page)).articles).toBe(finalCount);
  expect(requests.length).toBe(settledRequests);
});
