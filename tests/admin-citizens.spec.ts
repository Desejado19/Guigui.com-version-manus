import { test, expect, type Page } from './fixtures';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const SEED_CITIZEN_ID = 'usr-seed-cid-01';
const SEED_CITIZEN_EMAIL = 'cidadao.seed01@guigui.test';

async function signInAdmin(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
    window.sessionStorage.clear();
  }, payload.user);
}

async function openAdminUsers(page: Page) {
  await signInAdmin(page);
  await page.goto('/');
  if (!(await page.getByText('PAINEL ADMINISTRATIVO').count())) {
    await page.locator('button[title="Sessão Iniciada"]').first().click();
    await page.getByRole('button', { name: 'Administração Guigui.com' }).click();
  }
  await expect(page.getByText('PAINEL ADMINISTRATIVO').first()).toBeVisible({ timeout: 20000 });
  await page.locator('aside').getByRole('button', { name: /Utilizadores/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Utilizadores', exact: true }).first()).toBeVisible();
}

async function openCitizens(page: Page) {
  await page.getByRole('button', { name: /^Cidadãos/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Cidadãos', exact: true })).toBeVisible();
}

test.describe('Admin — Utilizadores e cidadãos', () => {
  test('módulo mostra as seis subáreas e a lista de cidadãos pesquisa e pagina', async ({ page }) => {
    await openAdminUsers(page);

    for (const section of ['Todas as contas', 'Cidadãos', 'Empresas', 'Administradores', 'Contas suspensas', 'Histórico de atividades']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${section}`) }).first()).toBeVisible();
    }

    await openCitizens(page);
    await expect(page.getByText(/conta\(s\) encontrada\(s\)/)).toBeVisible();
    await expect(page.getByText(/Mostrando 1–20 de/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar', exact: true }).first()).toBeVisible();

    const search = page.getByPlaceholder('Pesquisar por nome, email ou telefone…');
    await search.fill(SEED_CITIZEN_EMAIL);
    await expect(page.getByText('1 conta(s) encontrada(s)', { exact: true })).toBeVisible();
    await expect(page.getByText('Fatou Fernandes')).toBeVisible();

    await search.fill('');
    await expect(page.getByText(/Mostrando 1–20 de/)).toBeVisible();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(page.getByText(/Mostrando 21–40 de/)).toBeVisible();

    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: 'LIMPAR' }).click();
    await expect(page.getByText(/Mostrando 1–20 de/)).toBeVisible();
  });

  test('edição valida, persiste após reload, audita e permite suspender/reativar', async ({ page }) => {
    test.setTimeout(60_000);
    await openAdminUsers(page);
    await openCitizens(page);

    const search = page.getByPlaceholder('Pesquisar por nome, email ou telefone…');
    await search.fill(SEED_CITIZEN_EMAIL);
    await expect(page.getByText('1 conta(s) encontrada(s)', { exact: true })).toBeVisible();

    const fatouRow = page.getByRole('row', { name: /Fatou Fernandes/ });
    await expect(fatouRow).toBeVisible();
    await fatouRow.getByRole('button', { name: 'Editar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Fatou Fernandes').first()).toBeVisible();
    await expect(dialog.locator('input[readonly]').nth(0)).toBeDisabled();
    await expect(dialog.locator('input[readonly]').nth(1)).toBeDisabled();

    await dialog.getByLabel(/localização/i).fill('Bandim Teste');
    await dialog.locator('input[type="date"]').fill('1995-04-12');
    await dialog.getByRole('button', { name: 'Guardar alterações' }).click();
    await expect(dialog.getByText('Alterações guardadas e registadas na auditoria.')).toBeVisible();
    await expect(dialog.getByText('Bandim Teste')).toBeVisible();

    await dialog.getByRole('button', { name: 'Fechar ficha' }).click();
    await page.reload();
    await expect(page.getByText('PAINEL ADMINISTRATIVO').first()).toBeVisible({ timeout: 20000 });
    await page.locator('aside').getByRole('button', { name: /Utilizadores/ }).first().click();
    await openCitizens(page);
    await page.getByPlaceholder('Pesquisar por nome, email ou telefone…').fill(SEED_CITIZEN_EMAIL);
    await expect(page.getByText('1 conta(s) encontrada(s)', { exact: true })).toBeVisible();
    const reloadedFatouRow = page.getByRole('row', { name: /Fatou Fernandes/ });
    await expect(reloadedFatouRow).toContainText('Bandim Teste');
    await reloadedFatouRow.getByRole('button', { name: 'Editar', exact: true }).click();
    const reloadedDialog = page.getByRole('dialog');
    await expect(reloadedDialog).toBeVisible();
    await expect(reloadedDialog.getByLabel(/localização/i)).toHaveValue('Bandim Teste');

    await reloadedDialog.getByRole('button', { name: /^Histórico \(/ }).click();
    await expect(reloadedDialog.getByText(/admin user updated/).first()).toBeVisible();
    await expect(reloadedDialog.getByText(/Administração Guigui/).first()).toBeVisible();
    await expect(reloadedDialog.getByText(/Campos: .*neighborhood/).first()).toBeVisible();
    await expect(reloadedDialog.getByText(/Campos: .*birthDate/).first()).toBeVisible();

    await reloadedDialog.getByRole('button', { name: 'Perfil', exact: true }).click();
    await reloadedDialog.getByLabel(/localização/i).fill('Bandim');
    await reloadedDialog.locator('input[type="date"]').fill('');
    await reloadedDialog.getByRole('button', { name: 'Guardar alterações' }).click();
    await expect(reloadedDialog.getByText('Alterações guardadas e registadas na auditoria.')).toBeVisible();

    page.once('dialog', (prompt) => prompt.accept('Suspensão de teste automatizado'));
    await reloadedDialog.getByRole('button', { name: 'Suspender conta' }).click();
    await expect(reloadedDialog.getByRole('status')).toContainText('Conta suspensa');
    await expect(reloadedDialog.getByRole('button', { name: 'Reativar conta' })).toBeVisible();
    await reloadedDialog.getByRole('button', { name: 'Reativar conta' }).click();
    await expect(reloadedDialog.getByRole('status')).toContainText('Conta reativada');

    await reloadedDialog.getByRole('button', { name: 'Fechar ficha' }).click();
    await page.getByRole('button', { name: /Voltar ao módulo/ }).click();
    await page.getByRole('button', { name: /^Histórico de atividades/ }).click();
    await expect(page.getByRole('heading', { name: 'Histórico de atividades' })).toBeVisible();
  });

  test('conta de empresa não pode editar cidadãos nem consultar sessões', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: BUSINESS_EMAIL, password: ADMIN_PASSWORD } });
    expect(login.ok()).toBeTruthy();

    const patch = await request.patch(`/api/admin/users/${SEED_CITIZEN_ID}`, { data: { name: 'Não autorizado' } });
    expect(patch.status()).toBe(403);

    const detail = await request.get(`/api/admin/users/${SEED_CITIZEN_ID}`);
    expect(detail.status()).toBe(403);

    const sessions = await request.get('/api/admin/sessions');
    expect(sessions.status()).toBe(403);
  });
});
