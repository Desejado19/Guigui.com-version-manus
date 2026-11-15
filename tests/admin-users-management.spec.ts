import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };
const TARGET_EMAIL = 'cidadao.teste@guigui.com';

async function loginAsAdmin(page: Page) {
  const login = await page.request.post('/api/auth/login', { data: ADMIN });
  expect(login.ok(), await login.text()).toBeTruthy();
  const payload = await login.json();
  await page.addInitScript((user: any) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

test('admin: lista de utilizadores, pesquisa, edição e suspensão/reativação', async ({ page }) => {
  await loginAsAdmin(page);

  // Abrir módulo Utilizadores.
  const usersNav = page.getByRole('button', { name: 'Utilizadores', exact: true }).first();
  await expect(usersNav).toBeVisible({ timeout: 20_000 });
  await usersNav.click();
  await page.waitForTimeout(1500);

  // Abrir submódulo Cidadãos.
  const citizensNav = page.getByRole('button', { name: 'Cidadãos' }).first();
  await expect(citizensNav).toBeVisible({ timeout: 20_000 });
  await citizensNav.click();
  await page.waitForTimeout(2000);

  // Pesquisa.
  const search = page.getByPlaceholder(/Pesquisar por nome, email ou telefone/i).first();
  await expect(search).toBeVisible({ timeout: 10_000 });
  await search.fill('cidadao.teste');
  await page.waitForTimeout(1500);
  await expect(page.getByText(TARGET_EMAIL).first()).toBeVisible({ timeout: 10_000 });

  // Abrir detalhe (Editar).
  const editButton = page.getByRole('button', { name: 'Editar' }).first();
  await expect(editButton).toBeVisible({ timeout: 10_000 });
  await editButton.click();
  await page.waitForTimeout(1500);

  // Detalhe abre já em modo de edição.
  const nameField = page.locator('label:has-text("Nome completo") input').first();
  await expect(nameField).toBeVisible({ timeout: 10_000 });
  const originalName = await nameField.inputValue();
  const newName = `Cidadão Teste ${Date.now()}`;
  await nameField.fill(newName);

  // Guardar.
  const saveButton = page.getByRole('button', { name: 'Guardar alterações' }).first();
  await saveButton.click();
  await expect(page.getByText(/Guardado|alterações guardadas|sucesso/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => {});

  // Voltar ao view mode e verificar nome actualizado.
  await page.waitForTimeout(1500);
  await expect(page.getByText(newName).first()).toBeVisible({ timeout: 15_000 });

  // Suspender conta.
  page.on('dialog', async (dialog) => {
    await dialog.accept('Teste automatizado de suspensão');
  });
  const suspendButton = page.getByRole('button', { name: 'Suspender conta' }).first();
  await expect(suspendButton).toBeVisible({ timeout: 10_000 });
  await suspendButton.click();
  await expect(page.getByText(/Conta suspensa/i).first()).toBeVisible({ timeout: 15_000 });

  // Reativar conta.
  const reactivateButton = page.getByRole('button', { name: 'Reativar conta' }).first();
  await expect(reactivateButton).toBeVisible({ timeout: 10_000 });
  await reactivateButton.click();
  await expect(page.getByText(/Conta reativada/i).first()).toBeVisible({ timeout: 15_000 });

  // Restaurar nome original.
  const editAgain = page.getByRole('button', { name: 'Editar cidadão' }).first();
  await editAgain.click();
  await page.waitForTimeout(500);
  const nameField2 = page.locator('label:has-text("Nome completo") input').first();
  await nameField2.fill(originalName);
  await page.getByRole('button', { name: 'Guardar alterações' }).first().click();
  await page.waitForTimeout(1500);
});