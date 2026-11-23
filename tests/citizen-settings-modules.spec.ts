import { expect, test, type Page } from './fixtures';

const DEMO_PASSWORD = 'Guigui@2026!';
const CITIZEN_EMAIL = 'cidadao.teste@guigui.com';

async function openCitizenAccount(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: CITIZEN_EMAIL, password: DEMO_PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);

  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Sessão Iniciada').click();
  await page.getByRole('button', { name: /Área Pessoal|Minha Conta|A minha conta/i }).first().click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
  return page.locator('aside').first();
}

test.describe('Configurações do cidadão reorganizadas', () => {
  test.setTimeout(180_000);

  test('«Conta e perfil» reúne dados da conta e perfil sem alterar os formulários', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      // Ruído do servidor de desenvolvimento (HMR), não da aplicação.
      if (!/WebSocket/i.test(error.message)) pageErrors.push(error.message);
    });
    const aside = await openCitizenAccount(page);

    // O menu mostra apenas os dois módulos agregados.
    await expect(aside.getByRole('button', { name: 'Conta e perfil' })).toBeVisible();
    await expect(aside.getByRole('button', { name: 'Segurança e definições' })).toBeVisible();
    for (const old of ['Dados e conta', 'Perfil e preferências', 'Segurança e privacidade', 'Definições do sistema']) {
      await expect(aside.getByRole('button', { name: old, exact: true }), `"${old}" não deve estar no menu`).toHaveCount(0);
    }

    await aside.getByRole('button', { name: 'Conta e perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Conta e perfil' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Dados e conta' })).toHaveAttribute('aria-selected', 'true');

    // Secção interna 1: operações de conta originais.
    await expect(page.getByRole('button', { name: 'Desativar a minha conta' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eliminar a minha conta' })).toBeVisible();

    // Secção interna 2: formulário de perfil e preferências originais.
    await page.getByRole('tab', { name: 'Perfil e preferências' }).click();
    await expect(page.getByRole('tab', { name: 'Perfil e preferências' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('label', { hasText: /^Nome/ }).locator('input').first()).toBeVisible();
    await expect(page.locator('label', { hasText: /^E-mail/ }).locator('input').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar dados pessoais/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bilhete digital' })).toBeVisible();

    // Regressar à primeira secção mantém tudo funcional, sem duplicação de conteúdo.
    await page.getByRole('tab', { name: 'Dados e conta' }).click();
    await expect(page.getByRole('button', { name: 'Eliminar a minha conta' })).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar dados pessoais/i })).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test('«Segurança e definições» reúne privacidade e definições do sistema', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      if (!/WebSocket/i.test(error.message)) pageErrors.push(error.message);
    });
    const aside = await openCitizenAccount(page);

    await aside.getByRole('button', { name: 'Segurança e definições' }).click();
    await expect(page.getByRole('heading', { name: 'Segurança e definições' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Segurança e privacidade' })).toHaveAttribute('aria-selected', 'true');

    // Secção interna 1: os quatro interruptores de privacidade originais.
    for (const toggle of ['Perfil privado', 'Alertas de segurança', 'Comunicação protegida', 'Personalização de dados']) {
      await expect(page.getByText(toggle, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('checkbox')).toHaveCount(4);

    // Secção interna 2: alteração de palavra-passe e preferência de comunicação.
    await page.getByRole('tab', { name: 'Definições do sistema' }).click();
    await expect(page.getByRole('tab', { name: 'Definições do sistema' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Nova palavra-passe', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Confirmar nova palavra-passe', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Atualizar palavra-passe' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'E-mail e telefone' })).toBeVisible();

    // Voltar à privacidade não deixa vestígios do formulário anterior.
    await page.getByRole('tab', { name: 'Segurança e privacidade' }).click();
    await expect(page.getByPlaceholder('Nova palavra-passe', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Perfil privado', { exact: true })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
