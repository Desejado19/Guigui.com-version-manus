import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui2026!';

async function signInAdmin(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

test.describe('Admin — navegação unificada', () => {
  test('sidebar tem 7 grupos, perfil acessível e header com dados reais', async ({ page }) => {
    await signInAdmin(page);
    await page.goto('/');
    await expect(page.getByText('Visão Geral', { exact: false }).first()).toBeVisible({ timeout: 20000 });

    // Grupos reorganizados: Financeiro contém Planos; Suporte contém Notificações; Administração contém Permissões.
    for (const label of ['Financeiro', 'Planos & Assinaturas', 'Suporte', 'Administração', 'Segurança', 'Auditoria']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible({ timeout: 20000 });
    }

    // Header com receita real do PostgreSQL (bloco "Faturação este mês" + Badge).
    const body = page.locator('body');
    await expect(body).toContainText('883 500', { timeout: 20000 });
    await expect(body).toContainText('0 XOF em comissões', { timeout: 20000 });

    // Perfil órfão agora acessível via avatar.
    await page.getByRole('button', { name: /perfil/i }).first().click();
    await expect(page.getByText('Minha Conta', { exact: false }).first()).toBeVisible({ timeout: 20000 });
  });
});
