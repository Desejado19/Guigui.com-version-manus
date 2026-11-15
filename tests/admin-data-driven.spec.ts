import { test, expect, type Page } from '@playwright/test';

/**
 * Admin panel data-driven verification (Phase 1 + 2).
 * Confirms the painel reflects PostgreSQL data instead of invented numbers:
 *  - stats API returns internally-consistent real counts (no fabricated figures)
 *  - the "Utilizadores" tab lists real accounts from the database
 * Counts are asserted dynamically (API as source of truth) because the demo
 * dataset evolves (seed + real usage) — hardcoded totals rot.
 * Uses page.request login (sets the session cookie shared with the page) plus
 * localStorage session injection, matching the robust pattern already used in
 * seed-demo.spec.ts / admin-overview-real.spec.ts.
 */

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui2026!' };

async function loginAsAdmin(page: Page) {
  const login = await page.request.post('/api/auth/login', { data: ADMIN });
  const payload = await login.json().catch(() => ({}));
  expect(login.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, (payload as { user: unknown }).user);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

test.describe('seed-admin: painel reflecte dados reais do banco', () => {
  test('API de estatisticas devolve contagens reais e coerentes', async ({ page }) => {
    await loginAsAdmin(page);

    const stats = await page.request.get('/api/admin/stats');
    expect(stats.ok()).toBeTruthy();
    const body = await stats.json();

    // Totals must equal the sum of their breakdowns (real aggregation, not invented).
    const roleSum = Object.values(body.users.byRole as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(body.users.total).toBe(roleSum);
    expect(body.users.total).toBeGreaterThan(0);

    const statusSum = Object.values(body.companies.byStatus as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(body.companies.total).toBe(statusSum);
    expect(body.companies.total).toBeGreaterThan(0);

    expect(body.events.total).toBeGreaterThan(0);
    expect(body.tickets.total).toBeGreaterThan(0);
    // Revenue is a real sum, not the invented 24.5M XOF.
    expect(typeof body.revenue.grossXOF).toBe('number');
    expect(body.revenue.grossXOF).toBeGreaterThan(0);
  });

  test('API de utilizadores lista contas reais com empresa associada', async ({ page }) => {
    await loginAsAdmin(page);

    const stats = await page.request.get('/api/admin/stats');
    const expectedTotal = (await stats.json()).users.total as number;

    const users = await page.request.get('/api/admin/users?limit=1000');
    expect(users.ok()).toBeTruthy();
    const body = await users.json();
    expect(body.total).toBe(expectedTotal);
    expect(body.users.length).toBeGreaterThan(0);

    // Business accounts carry their company name.
    const aBusiness = body.users.find((u: { role: string; companyName?: string | null }) => u.role === 'business' && u.companyName);
    expect(aBusiness).toBeTruthy();
    expect(aBusiness.companyName).toBeTruthy();

    // Search filters by email/name.
    const found = await page.request.get('/api/admin/users?search=seed01');
    const foundBody = await found.json();
    expect(foundBody.total).toBeGreaterThanOrEqual(2);
  });

  test('aba Utilizadores renderiza a lista real do banco (UI)', async ({ page }) => {
    await loginAsAdmin(page);

    const stats = await page.request.get('/api/admin/stats');
    const total = (await stats.json()).users.total as number;

    // Open the Gestão → Utilizadores section in the sidebar.
    const usersNav = page.getByRole('button', { name: 'Utilizadores', exact: true }).first();
    await usersNav.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Todas as contas/ }).first().click();

    // The hub header reports the real total from the database.
    await expect(page.getByText(`${total} conta`, { exact: false })).toBeVisible({ timeout: 10000 });

    // A real seed business account is listed.
    await expect(page.getByText('empresa.seed01@guigui.test').first()).toBeVisible();

    await page.screenshot({ path: 'test-results/seed-admin-users.png', fullPage: false });
  });

  test('overview nao mostra o numero inventado 25.430', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await page.waitForTimeout(3000);
    // The old hardcoded figure must be gone from the rendered overview.
    await expect(page.getByText('25.430')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/seed-admin-overview.png', fullPage: false });
  });
});

