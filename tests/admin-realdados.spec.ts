import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui2026!';

// Autentica via API (fluxo estavel) e injeta a sessao no localStorage antes do
// primeiro render — o App.tsx le `guigui_current_user`, nao so o cookie.
async function signInAdmin(page: Page) {
  const login = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const payload = await login.json().catch(() => ({}));
  expect(login.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

test.describe('Admin painel - dados reais', () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
  });

  test('overview mostra utilizadores reais do banco', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.getByText('25.430')).toHaveCount(0);
    await expect(page.getByText('127 Total')).toHaveCount(0);

    // Total real de utilizadores agregado pelo PostgreSQL.
    const stats = await page.request.get('/api/admin/stats');
    expect(stats.ok()).toBeTruthy();
    const total = String((await stats.json()).users.total);
    const body = page.locator('body');
    await expect(body).toContainText(total, { timeout: 10000 });
  });

  test('aba Utilizadores lista contas reais com busca', async ({ page }) => {
    const usersLink = page.getByRole('button', { name: /utilizadores/i }).first();
    await expect(usersLink).toBeVisible({ timeout: 10000 });
    await usersLink.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Todas as contas/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Visão geral de utilizadores' })).toBeVisible({ timeout: 10000 });
    const search = page.getByPlaceholder(/pesquisar por nome/i);
    await expect(search).toBeVisible();
    await search.fill('seed01');
    await page.waitForTimeout(1500);
    await expect(page.getByText(/seed01@guigui\.test/).first()).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'test-results/admin-utilizadores.png', fullPage: false });
  });
});
