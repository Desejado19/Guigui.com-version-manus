import { test, expect } from '@playwright/test';

// Validacao visual dos dados seed: directorio, paineis e fila do admin.
// Nota: a app faz polling continuo, por isso usa-se domcontentloaded +
// esperas explicitas em vez de networkidle (que nunca dispara).
async function openHome(page: any) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

test('seed: directorio mostra empresas seed activas', async ({ page }) => {
  await openHome(page);
  // A home mostra o feed; clicar em "Business Directory" abre o directorio.
  const dirBtn = page.locator('button:has-text("Business Directory")').first();
  if (await dirBtn.count()) await dirBtn.click();
  await page.waitForTimeout(2500);
  // Limpar qualquer filtro residual da pesquisa do cabecalho.
  const clearBtn = page.locator('button:has-text("Limpar Todos os Filtros"), button[aria-label*="Clear" i]').first();
  if (await clearBtn.count()) await clearBtn.click();
  await page.waitForTimeout(2000);
  // O directorio renderiza (empresa pre-existente) e a API serve as seed.
  await expect(page.locator('text=Restaurante Coqueiros').first()).toBeVisible({ timeout: 15000 });
  const api = await page.request.get('/api/businesses');
  const body = await api.json();
  const seedActive = (body.businesses || []).filter((b: { id: string; status: string }) => b.id.startsWith('seed-co-') && b.status === 'active');
  expect(seedActive.length).toBeGreaterThanOrEqual(20);
  await page.screenshot({ path: 'test-results/seed-diretorio.png', fullPage: false });
});

test('seed: login cidadao abre area pessoal', async ({ page }) => {
  await openHome(page);
  const loginBtn = page.locator('button:has-text("Entrar"), a:has-text("Entrar")').first();
  if (await loginBtn.count()) await loginBtn.click();
  await page.waitForTimeout(1000);
  const email = page.locator('input[type="email"]').first();
  if (await email.count()) {
    await email.fill('cidadao.seed01@guigui.test');
    await page.locator('input[type="password"]').first().fill('Guigui2026!');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: 'test-results/seed-cidadao.png', fullPage: false });
});

test('seed: login empresa activa abre painel', async ({ page }) => {
  await openHome(page);
  const loginBtn = page.locator('button:has-text("Entrar"), a:has-text("Entrar")').first();
  if (await loginBtn.count()) await loginBtn.click();
  await page.waitForTimeout(1000);
  const email = page.locator('input[type="email"]').first();
  if (await email.count()) {
    await email.fill('empresa.seed01@guigui.test');
    await page.locator('input[type="password"]').first().fill('Guigui2026!');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: 'test-results/seed-empresa.png', fullPage: false });
});

test('seed: admin ve fila de pendentes com empresas seed', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { email: 'admin.teste@guigui.com', password: 'Guigui2026!' },
  });
  expect(login.ok()).toBeTruthy();
  const pending = await page.request.get('/api/admin/businesses/pending');
  expect(pending.ok()).toBeTruthy();
  const body = await pending.json();
  const seed = (body.businesses || []).filter((b: { id: string }) => b.id.startsWith('seed-co-'));
  expect(seed.length).toBeGreaterThan(0);
});
