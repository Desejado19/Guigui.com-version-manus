import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';

async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  await page.addInitScript((user: any) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

test('painel de bilhetes vendidos não mostra nenhuma ação de reembolso', async ({ page }) => {
  await signIn(page, BUSINESS_EMAIL);
  await page.goto('/');

  // Abrir o módulo de Eventos, onde o painel de bilhetes vendidos é apresentado.
  const eventsNav = page.getByRole('button', { name: /Eventos/i }).first();
  if (await eventsNav.isVisible().catch(() => false)) {
    await eventsNav.click();
  } else {
    await page.getByText(/Eventos/i).first().click();
  }

  // Garantir que o painel de bilhetes vendidos carregou.
  await expect(page.getByText(/Bilhetes vendidos|Vendidos/i).first()).toBeVisible({ timeout: 20_000 });

  // Nenhuma ação de reembolso deve estar presente (botões ou texto).
  const refundTerms = /reembols|refund|devolv/i;
  const refundButtons = page.getByRole('button', { name: refundTerms });
  await expect(refundButtons).toHaveCount(0);

  const refundText = page.getByText(refundTerms);
  await expect(refundText).toHaveCount(0);
});