import { expect, test, type Page } from '@playwright/test';

/**
 * SAÚDE DO SISTEMA — óptica de desenvolvedor.
 *
 * Verifica o backend e o browser como um engenheiro de plataforma faria:
 * a API está saudável e ligada ao PostgreSQL, os dados seed continuam
 * íntegros (guard de regressão da corrupção de app-state), as respostas
 * nunca são cacheáveis, a autenticação/autorização funciona e não vaza
 * segredos, o analytics aceita eventos — e a home carrega no browser sem
 * erros JS, sem respostas 5xx e sem imagens sem atributo alt.
 *
 * Todos os testes são read-only: nenhum altera o directório nem o estado
 * das empresas, para não interferir com o resto da suíte.
 */

test.describe('backend: APIs públicas e de plataforma', () => {
  test('health: API reports the process and persistence state accurately', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.app).toBe('Guigui.com Bissau');
    expect(typeof body.database.configured).toBe('boolean');
    expect(typeof body.database.connected).toBe('boolean');
    expect(body.status).toBe(
      body.database.configured && !body.database.connected ? 'degraded' : 'ok',
    );
    expect(typeof body.geminiActive).toBe('boolean');
    expect(typeof body.timestamp).toBe('string');
    expect(body.observability.inProcess).toBe(true);
    expect(body.observability.persistent).toBe(body.database.connected);
  });

  test('metrics: Prometheus remains publicly accessible as plain text', async ({ page }) => {
    const response = await page.request.get('/metrics');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(await response.text()).toContain('# TYPE guigui_http_requests_total counter');
  });

  test('features: flags do produto devolvem booleanos coerentes', async ({ page }) => {
    const response = await page.request.get('/api/features');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('productAnalytics');
    for (const value of Object.values(body)) {
      expect(typeof value).toBe('boolean');
    }
  });

  test('directório: 20 empresas seed base activas e 30+ registos íntegros', async ({ page }) => {
    const response = await page.request.get('/api/businesses');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const businesses = body.businesses as Array<{ id: string; name: string; status: string }>;
    expect(Array.isArray(businesses)).toBeTruthy();
    expect(businesses.length).toBeGreaterThanOrEqual(30);

    // Regressão: o directório nunca pode ser vítima da corrupção em massa
    // (watchdog de subscrição + snapshot envenenado). Os 20 registos base
    // continuam activos; empresas 21-30 podem mudar de estado pelo admin.
    const seedActiveIds = new Set(
      businesses
        .filter((b) => b.id.startsWith('seed-co-') && b.status === 'active')
        .map((b) => b.id),
    );
    for (let index = 1; index <= 20; index += 1) {
      const id = `seed-co-${String(index).padStart(2, '0')}`;
      expect(seedActiveIds.has(id), `empresa seed base inactiva: ${id}`).toBe(true);
    }

    // Shape mínimo de cada registo — o frontend depende destes campos.
    for (const business of businesses.slice(0, 50)) {
      expect(typeof business.id).toBe('string');
      expect(typeof business.name).toBe('string');
      expect(typeof business.status).toBe('string');
    }
  });

  test('categorias: 13 categorias primárias servidas pela API', async ({ page }) => {
    const response = await page.request.get('/api/admin/categories');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const categories = body.categories as Array<{ id: string; name: string; groupId: string | null }>;
    expect(Array.isArray(categories)).toBeTruthy();
    expect(categories.length).toBeGreaterThanOrEqual(13);
    expect(categories.some((c) => c.name === 'Restauração e Bebidas')).toBeTruthy();
    const ids = new Set(categories.map((c) => c.id));
    expect(ids.size, 'ids de categorias duplicados').toBe(categories.length);
  });

  test('bootstrap: snapshot de sincronização coerente com o directório', async ({ page }) => {
    const bootstrap = await page.request.get('/api/sync/bootstrap');
    expect(bootstrap.ok()).toBeTruthy();
    const body = await bootstrap.json();
    expect(body.success).toBe(true);
    expect(body.database.connected).toBe(true);
    expect(Array.isArray(body.data.businesses)).toBeTruthy();
    expect(body.data.businesses.length).toBeGreaterThanOrEqual(30);
  });

  test('reviews: endpoint público de avaliações devolve array', async ({ page }) => {
    const response = await page.request.get('/api/businesses/biz-1/reviews');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body.reviews ?? body)).toBeTruthy();
  });

  test('cache: respostas da API nunca são cacheáveis', async ({ page }) => {
    for (const path of ['/api/businesses', '/api/app-state/guigui_businesses']) {
      const response = await page.request.get(path);
      expect(response.ok(), `${path} devolveu ${response.status()}`).toBeTruthy();
      const cacheControl = response.headers()['cache-control'] || '';
      expect(cacheControl, `${path} sem header anti-cache`).toContain('no-store');
      expect(response.headers()['surrogate-control'] || '').toContain('no-store');
    }
  });

  test('analytics: evento de produto aceite com 202; inválido rejeitado com 400', async ({ page }) => {
    const valid = await page.request.post('/api/product-events', {
      data: { eventName: 'test_system_health_probe', source: 'playwright', context: { spec: 'system-health' } },
    });
    expect(valid.status()).toBe(202);
    expect((await valid.json()).accepted).toBe(true);

    const invalid = await page.request.post('/api/product-events', { data: { eventName: '' } });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).code).toBe('PRODUCT_EVENT_INVALID');
  });
});

test.describe('segurança: autenticação e autorização', () => {
  const adminPaths = ['/api/admin/stats', '/api/admin/users', '/api/admin/businesses/pending'];

  test('login: password errada é rejeitada sem vazar segredos', async ({ page }) => {
    const response = await page.request.post('/api/auth/login', {
      data: { email: 'admin.teste@guigui.com', password: 'password-incorreta-playwright' },
    });
    expect([400, 401]).toContain(response.status());
    const raw = await response.text();
    expect(raw).not.toMatch(/passwordHash/);
    const body = JSON.parse(raw) as { error?: string; code?: string };
    expect(typeof body.error === 'string' || typeof body.code === 'string').toBeTruthy();
  });

  test('login: sessão válida devolve utilizador sem credenciais', async ({ page }) => {
    const response = await page.request.post('/api/auth/login', {
      data: { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const body = await response.json() as { user?: Record<string, unknown> };
    expect(body.user).toBeTruthy();
    expect(typeof body.user?.id).toBe('string');
    expect(body.user?.role).toBeTruthy();
    expect(response.text).toBeTruthy();
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/password/i);
  });

  for (const path of adminPaths) {
    test(`autorização: ${path} exige sessão de administração`, async ({ page }) => {
      const response = await page.request.get(path);
      expect([401, 403], `${path} devolveu ${response.status()} sem sessão`).toContain(response.status());
    });
  }

  test('autorização: endpoint legado de verificação de tokens exige sessão', async ({ page }) => {
    const response = await page.request.post('/api/system/security/verify-token', { data: { token: 'abc' } });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('browser: a home carrega limpa e substancial', () => {
  test.setTimeout(120_000);

  test('sem erros JS, sem falhas de rede na API e sem 5xx', async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const apiFailures: string[] = [];
    page.on('pageerror', (error) => {
      const message = String(error);
      // O cliente HMR do Vite tenta abrir um WebSocket mesmo com ws desligado em
      // middleware mode — ruído exclusivo do dev server, não da aplicação.
      if (/WebSocket closed without opened/i.test(message)) return;
      pageErrors.push(message);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // Falha ao carregar recursos estáticos ausentes (favicon) é ruído do
      // browser, não erro da aplicação — fica registado mas não falha.
      if (/favicon/i.test(message.text())) return;
      // O cliente HMR do Vite tenta abrir um WebSocket mesmo com ws desligado em
      // middleware mode — ruído exclusivo do dev server, não da aplicação.
      if (/failed to connect to websocket/i.test(message.text())) return;
      if (/WebSocket connection to .*failed/i.test(message.text())) return;
      // Sondas da SPA sem sessão a endpoints protegidos devolvem 401 e a
      // aplicação trata-o normalmente; o browser é que regista a resposta como
      // erro de consola ("Failed to load resource").
      if (/Failed to load resource.*401/i.test(message.text())) return;
      consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => {
      if (request.url().includes('/api/')) {
        apiFailures.push(`${request.method()} ${request.url()} → ${request.failure()?.errorText}`);
      }
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        apiFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('guigui_current_lang', 'pt');
    });
    const startedAt = Date.now();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible({ timeout: 30_000 });
    // Drena o polling contínuo da app antes de auditar a rede.
    await page.waitForTimeout(4000);
    testInfo.annotations.push({ type: 'performance', description: `home interactiva em ${Date.now() - startedAt}ms` });

    expect(pageErrors, `erros JS não capturados: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `erros de consola: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(apiFailures, `falhas de API durante a home: ${apiFailures.join(' | ')}`).toEqual([]);
    await page.screenshot({ path: 'test-results/system-home-limpa.png', fullPage: false });
  });

  test('SPA renderiza conteúdo real — nunca uma tela branca', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('guigui_current_lang', 'pt');
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);

    // Root do React preenchido e texto substancial visível.
    const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
    expect(rootChildren).toBeGreaterThan(0);
    const visibleText = (await page.locator('body').innerText()).trim();
    expect(visibleText.length, 'home renderizou quase nada visível').toBeGreaterThan(400);
    await expect(page.getByPlaceholder(/Procurar restaurantes/i)).toBeVisible({ timeout: 10_000 });
  });

  test('acessibilidade básica: todas as imagens têm atributo alt', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('guigui_current_lang', 'pt');
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);

    const imagesWithoutAlt = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((image) => !image.hasAttribute('alt'))
        .map((image) => (image as HTMLImageElement).src.slice(0, 120)),
    );
    expect(imagesWithoutAlt, `imagens sem alt: ${imagesWithoutAlt.join(', ')}`).toEqual([]);
  });
});
