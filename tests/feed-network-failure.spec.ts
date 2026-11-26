import { expect, test, type Page } from './fixtures';

/**
 * Falha de rede no feed: sem a página seguinte a lista já carregada mantém-se
 * (com aviso e «Tentar novamente»); sem a primeira página o feed cai para a
 * lista guardada localmente, em vez de ficar vazio.
 */

const INITIAL_PAGE = 30;

/** Publicações guardadas no cache local da sessão anónima (`guigui_user_posts`). */
const LOCAL_POSTS = [
  {
    id: 'e2e-offline-post-1',
    businessId: 'biz-local-1',
    businessName: 'Empresa local offline',
    title: 'Publicação local guardada A',
    content: 'Conteúdo que já estava no dispositivo antes de a rede falhar.',
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    status: 'approved' as const,
  },
  {
    id: 'e2e-offline-post-2',
    businessId: 'biz-local-2',
    businessName: 'Empresa local offline',
    title: 'Publicação local guardada B',
    content: 'Segunda publicação do cache local, visível sem servidor.',
    createdAt: new Date(Date.now() - 65 * 60_000).toISOString(),
    status: 'approved' as const,
  },
];

async function articleCount(page: Page): Promise<number> {
  return page.locator('article').count();
}

/** Rola até à 5.ª publicação a contar do fim, que é o que dispara o pedido. */
async function reachPreloadThreshold(page: Page): Promise<void> {
  await page.evaluate(() => {
    const articles = document.querySelectorAll('article');
    const target = articles[Math.max(0, articles.length - 5)];
    target?.scrollIntoView({ block: 'center' });
  });
}

test('falha de rede na primeira página mantém a lista local visível', async ({ page }) => {
  const firstPageRequests: string[] = [];

  // Só a primeira página falha: qualquer pedido de offset 0 é cortado.
  await page.route('**/api/posts**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/posts' && (url.searchParams.get('offset') || '0') === '0') {
      firstPageRequests.push(`limit=${url.searchParams.get('limit')}&offset=0`);
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (!error.message.includes('WebSocket')) pageErrors.push(error.message);
  });

  // O dispositivo já tem publicações guardadas antes de abrir o feed.
  await page.addInitScript((posts) => {
    window.localStorage.setItem('guigui:state:anon:guigui_user_posts', JSON.stringify(posts));
  }, LOCAL_POSTS);

  await page.goto('/');

  // 1. O pedido da primeira página foi tentado e falhou.
  await expect.poll(() => firstPageRequests.length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(firstPageRequests[0]).toBe(`limit=${INITIAL_PAGE}&offset=0`);

  // 2. Sem servidor, o feed mostra a lista local em vez de ficar vazio.
  await expect(page.locator('article[data-post-id="e2e-offline-post-1"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('article[data-post-id="e2e-offline-post-2"]')).toBeVisible();
  await expect(page.getByText('Publicação local guardada A')).toBeVisible();
  expect(await articleCount(page)).toBeGreaterThanOrEqual(LOCAL_POSTS.length);

  // 3. Tudo o que está no ecrã existe na lista guardada localmente.
  const feedIds = await page.evaluate(async () => {
    // As colecções grandes vivem no IndexedDB; o localStorage legado é migrado
    // e removido no arranque (src/utils/browserStorage.ts).
    const read = (key: string) => new Promise<Array<Record<string, unknown>>>((resolve) => {
      const request = indexedDB.open('guigui-browser-cache', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('state')) {
          request.result.createObjectStore('state', { keyPath: 'key' });
        }
      };
      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        try {
          const get = request.result.transaction('state', 'readonly').objectStore('state').get(key);
          get.onsuccess = () => resolve(Array.isArray(get.result?.value) ? get.result.value : []);
          get.onerror = () => resolve([]);
        } catch { resolve([]); }
      };
    });
    const [userPosts, businesses] = await Promise.all([
      read('guigui:state:anon:guigui_user_posts'),
      read('guigui_businesses'),
    ]);
    const localPosts = [
      ...userPosts,
      ...businesses.flatMap((business) => (business.posts as unknown[]) || []),
    ] as Array<{ id: string; status: string }>;
    const visible = Array.from(document.querySelectorAll('article'))
      .map((article) => article.getAttribute('data-post-id') || '');
    return {
      visible,
      localIds: localPosts.filter((post) => post.status === 'approved').map((post) => post.id),
    };
  });
  expect(feedIds.visible.length).toBeGreaterThanOrEqual(LOCAL_POSTS.length);
  expect(new Set(feedIds.visible).size).toBe(feedIds.visible.length);
  const localIds = new Set(feedIds.localIds);
  for (const id of LOCAL_POSTS) expect(localIds.has(id.id), `post local ausente: ${id.id}`).toBeTruthy();
  expect(feedIds.visible.filter((id) => !localIds.has(id))).toEqual([]);

  // 4. A falha não deixa aviso de paginação nem erros de render.
  await expect(page.getByText('Não foi possível carregar mais publicações.')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('recarregar a página sem rede mantém publicação criada localmente no feed', async ({ page }) => {
  const localPost = {
    id: 'e2e-created-local-1',
    businessId: 'biz-local-created',
    businessName: 'Empresa local offline',
    title: 'Publicação criada localmente',
    content: 'Criada no dispositivo sem ligação ao servidor.',
    createdAt: new Date().toISOString(),
    status: 'approved' as const,
  };

  // A publicação já existe no dispositivo (criada localmente) antes do reload.
  await page.addInitScript((posts) => {
    window.localStorage.setItem('guigui:state:anon:guigui_user_posts', JSON.stringify(posts));
  }, [localPost]);

  // Sem rede no feed: bloquear apenas as chamadas de posts.
  await page.route('**/api/posts**', (route) => route.abort('failed'));

  // Primeira carga (com rede bloqueada no feed).
  await page.goto('/');
  await expect(page.locator('article[data-post-id="e2e-created-local-1"]')).toBeVisible({ timeout: 20_000 });

  // Recarregar a página sem rede no feed.
  await page.reload();

  // A publicação criada localmente continua visível no feed após o reload.
  await expect(page.locator('article[data-post-id="e2e-created-local-1"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Publicação criada localmente')).toBeVisible();
});

test('falha de rede na página seguinte mostra aviso e recupera ao tentar novamente', async ({ page }) => {
  const nextPageOffsets: string[] = [];
  let failNextPage = true;

  await page.route('**/api/posts**', async (route) => {
    const url = new URL(route.request().url());
    const offset = url.searchParams.get('offset') || '0';
    if (url.pathname === '/api/posts' && offset !== '0') {
      nextPageOffsets.push(offset);
      if (failNextPage) {
        await route.abort('failed');
        return;
      }
    }
    await route.continue();
  });

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (!error.message.includes('WebSocket')) pageErrors.push(error.message);
  });

  await page.goto('/');
  await expect.poll(() => articleCount(page), { timeout: 20_000 }).toBe(INITIAL_PAGE);

  // 1. Chegar ao limiar dispara o pedido da página seguinte, que falha.
  //    Repetir a rolagem cobre a ligação tardia do observador.
  await expect.poll(async () => {
    await reachPreloadThreshold(page);
    return nextPageOffsets.length;
  }, { timeout: 20_000 }).toBeGreaterThan(0);

  const retryButton = page.getByRole('button', { name: 'Tentar novamente' });
  await expect(retryButton).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Não foi possível carregar mais publicações.')).toBeVisible();

  // 2. As 30 publicações já carregadas continuam visíveis e não há duplicados.
  expect(await articleCount(page)).toBe(INITIAL_PAGE);
  const uniqueIds = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('article')).map((article) => article.getAttribute('data-post-id') || '');
    return new Set(ids).size;
  });
  expect(uniqueIds).toBe(INITIAL_PAGE);
  expect(nextPageOffsets).toEqual(['30']);

  // 3. Com a rede de volta, o botão recupera e traz as 20 seguintes.
  failNextPage = false;
  await retryButton.click();

  await expect.poll(() => articleCount(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(INITIAL_PAGE + 20);
  await expect(page.getByText('Não foi possível carregar mais publicações.')).toHaveCount(0);
  await expect(retryButton).toHaveCount(0);

  // 4. O pedido repetido usou o mesmo offset e o feed voltou a crescer sem erros.
  expect(nextPageOffsets[0]).toBe('30');
  expect(nextPageOffsets[1]).toBe('30');
  expect(pageErrors).toEqual([]);
});
