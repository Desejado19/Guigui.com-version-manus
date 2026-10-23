import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui2026!';

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
  return user as { id: string; role: string };
}

test.describe('Painel Admin — Finanças com dados reais', () => {
  test('financas mostra historico real do banco + fluxo de reconciliacao intacto', async ({ page }) => {
    await signInAdmin(page);
    await page.goto('/');

    // A visao geral do admin deve aparecer
    await expect(page.getByText('Visão Geral', { exact: false }).first()).toBeVisible({ timeout: 20000 });

    // Navegar para a aba Financas
    await page.getByRole('button', { name: /finan/i }).first().click();

    // 1) Historico real do banco aparece (endpoint /api/admin/payments)
    await expect(page.getByText(/Histórico real de pagamentos/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/registada.*no PostgreSQL/i)).toBeVisible({ timeout: 20000 });

    // 2) Fluxo de reconciliacao continua intacto (Secao 10)
    await expect(page.getByText(/reconciliação da plataforma/i).first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/financas-historico-real.png', fullPage: false });
  });
});

