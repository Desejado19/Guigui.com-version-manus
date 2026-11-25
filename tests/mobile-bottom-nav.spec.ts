import { expect, patchApiContext, request as playwrightRequest, test, type Page } from './fixtures';

/**
 * Barra de navegação inferior do cidadão (mobile).
 *
 * Visitantes vêem apenas Feed, Diretório, Ofertas e Agenda. Mensagens, Suporte
 * e Conta aparecem depois de `/api/auth/session` confirmar a sessão e
 * desaparecem assim que a sessão termina ou expira.
 */

const DEMO_PASSWORD = 'Guigui@2026!';
const CITIZEN_EMAIL = 'cidadao.teste@guigui.com';
const PUBLIC_LABELS = ['Feed', 'Diretório', 'Ofertas', 'Agenda'];
// O Suporte deixou de estar na barra inferior: vive no menu principal e no
// menu do painel (ver CitizenBottomNav).
const PRIVATE_LABELS = ['Mensagens', 'Conta'];

const nav = (page: Page) => page.getByTestId('citizen-bottom-nav');

async function expectVisitorNav(page: Page) {
  for (const label of PUBLIC_LABELS) {
    await expect(nav(page).getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  for (const label of PRIVATE_LABELS) {
    await expect(nav(page).getByRole('button', { name: label, exact: true })).toHaveCount(0);
    await expect(nav(page).getByText(label, { exact: true })).toHaveCount(0);
  }
}

async function expectAuthenticatedNav(page: Page) {
  for (const label of [...PUBLIC_LABELS, ...PRIVATE_LABELS]) {
    await expect(nav(page).getByRole('button', { name: label, exact: true })).toBeVisible();
  }
}

async function loginThroughUi(page: Page) {
  const loginButton = page.locator('button:has-text("Entrar"), a:has-text("Entrar")').first();
  await expect(loginButton).toBeVisible({ timeout: 15_000 });
  await loginButton.click();
  const email = page.locator('input[type="email"]').first();
  await expect(email).toBeVisible({ timeout: 10_000 });
  await email.fill(CITIZEN_EMAIL);
  await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await expectAuthenticatedNav(page);
}

test.describe('Barra de navegação inferior mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(180_000);

  test('visitante vê apenas Feed, Diretório, Ofertas e Agenda', async ({ page }) => {
    await page.goto('/');
    await expect(nav(page)).toBeVisible({ timeout: 20_000 });
    await expectVisitorNav(page);
    await expect(nav(page).getByRole('button')).toHaveCount(PUBLIC_LABELS.length);
  });

  test('ícones privados continuam ocultos ao navegar como visitante', async ({ page }) => {
    await page.goto('/');
    await expect(nav(page)).toBeVisible({ timeout: 20_000 });

    for (const label of ['Diretório', 'Ofertas', 'Agenda', 'Feed']) {
      await nav(page).getByRole('button', { name: label, exact: true }).click();
      await expect(nav(page).getByRole('button', { name: label, exact: true }))
        .toHaveAttribute('aria-current', 'page');
      for (const privateLabel of PRIVATE_LABELS) {
        await expect(nav(page).getByRole('button', { name: privateLabel, exact: true })).toHaveCount(0);
      }
    }
  });

  test('iniciar sessão pela interface revela Mensagens e Conta', async ({ page }) => {
    await page.goto('/');
    await expect(nav(page)).toBeVisible({ timeout: 20_000 });
    await expectVisitorNav(page);

    await loginThroughUi(page);

    // Os destinos privados abrem as respectivas áreas.
    await nav(page).getByRole('button', { name: 'Conta', exact: true }).click();
    await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(nav(page).getByRole('button', { name: 'Suporte', exact: true })).toHaveCount(0);
    await nav(page).getByRole('button', { name: 'Mensagens', exact: true }).click();
    await expect(nav(page).getByRole('button', { name: 'Mensagens', exact: true }))
      .toHaveAttribute('aria-current', 'page');
  });

  test('terminar sessão volta imediatamente à navegação de visitante', async ({ page }) => {
    await page.goto('/');
    await loginThroughUi(page);

    // O menu principal (gaveta) contém a opção real de terminar sessão.
    await page.getByLabel('Abrir Menu Principal').click();
    const logout = page.getByText('Terminar sessão', { exact: true }).first();
    await expect(logout).toBeVisible({ timeout: 10_000 });
    await logout.click();
    await page.getByRole('button', { name: 'Sair', exact: true }).last().click();

    await expectVisitorNav(page);
    await expect(nav(page).getByRole('button')).toHaveCount(PUBLIC_LABELS.length);
  });

  test('sessão expirada regressa automaticamente à navegação de visitante', async ({ page }) => {
    const baseURL = (test.info().project.use as { baseURL?: string }).baseURL;
    await page.goto('/');
    await loginThroughUi(page);

    // Revoga a sessão no servidor, como um administrador a suspender a conta.
    const api = patchApiContext(await playwrightRequest.newContext({ baseURL }));
    const login = await api.post('/api/auth/login', { data: { email: CITIZEN_EMAIL, password: DEMO_PASSWORD } });
    expect(login.ok()).toBeTruthy();
    expect((await api.post('/api/auth/sessions/revoke-all')).ok()).toBeTruthy();
    await api.dispose();

    // A página revalida a sessão ao recuperar foco; o estado privado desaparece.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expectVisitorNav(page);
  });

  test('após actualizar a página os ícones correspondem à sessão real', async ({ page }) => {
    await page.goto('/');
    await expect(nav(page)).toBeVisible({ timeout: 20_000 });
    await expectVisitorNav(page);

    await page.reload();
    await expect(nav(page)).toBeVisible({ timeout: 20_000 });
    await expectVisitorNav(page);

    await loginThroughUi(page);
    await page.reload();
    await expect(nav(page)).toBeVisible({ timeout: 20_000 });
    await expectAuthenticatedNav(page);
  });
});
