import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';

async function signInAdmin(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  const user = payload.user;
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, user);
}

test.describe('Painel Admin — Finanças com dados reais', () => {
  test('finanças mostra resumo real e transações numa página independente', async ({ page }) => {
    await signInAdmin(page);
    await page.goto('/');

    await expect(page.getByText('PAINEL ADMINISTRATIVO').first()).toBeVisible({ timeout: 20000 });
    await page.locator('aside').getByRole('button', { name: /^Financeiro/ }).first().click();

    await expect(page.getByRole('heading', { name: 'Financeiro', exact: true }).first()).toBeVisible();
    await expect(page.getByText('Volume financeiro registado')).toBeVisible();
    await expect(page.getByText('Indicadores e operações financeiras da plataforma.')).toBeVisible();
    const summaryResponse = await page.request.get('/api/admin/finance/summary');
    expect(summaryResponse.ok()).toBeTruthy();
    const summary = await summaryResponse.json() as { platform: { transactionCount: number } };
    await expect(page.getByText(new RegExp(`${summary.platform.transactionCount} transações de plataforma`))).toBeVisible();

    await page.getByRole('button', { name: /Transações/ }).click();
    await expect(page.getByRole('heading', { name: 'Transações', exact: true })).toBeVisible();
    await expect(page.getByText('TXN-2026-9011')).toBeVisible();
    await expect(page.getByText('Plataforma Guigui.com')).toBeVisible();
    await expect(page.getByText(/receita de bilhetes pertence às empresas organizadoras/i)).toBeVisible();
  });
});
