import { expect, test, type Page } from './fixtures';

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };

async function signInAdmin(page: Page) {
  const response = await page.request.post('/api/auth/login', { data: ADMIN });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  // A conta pode ter uma preferência de idioma persistida; estes testes
  // verificam os rótulos em português, por isso fixam a leitura em PT.
  await page.route('**/api/app-state/user_language_*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { value: { language: 'pt' } } });
    } else {
      await route.continue();
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Visão Geral/i }).first()).toBeVisible({ timeout: 30000 });
}

const openAdminModule = async (page: Page, label: RegExp) => {
  await page.locator('aside').getByRole('button', { name: label }).first().click();
};

test.describe('Administração — submódulos em páginas próprias', () => {
  test('moderação: cada submódulo abre isolado, com breadcrumbs e sem erros', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signInAdmin(page);

    // Os dois módulos removidos já não aparecem na navegação administrativa.
    await expect(page.locator('aside').getByRole('button', { name: /Configurações Globais|Global settings/ })).toHaveCount(0);

    await openAdminModule(page, /^Moderação$/);
    const tabs = page.getByRole('tablist', { name: 'Submódulos de Moderação' });
    await expect(tabs).toBeVisible({ timeout: 20000 });
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    await expect(tabs.getByRole('tab', { name: /Stories/ })).toHaveCount(0);

    // Vista inicial: apenas o pipeline.
    await expect(page.getByText(/Pipeline Automático de Segurança/).first()).toBeVisible();
    await expect(page.getByText('Filtros do pipeline')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: /Localização em Moderação/ })).toContainText('Pipeline IA');

    // Fila de revisão: só filtros e quadro, sem o banner do pipeline.
    await tabs.getByRole('tab', { name: 'Fila de revisão' }).click();
    await expect(page.getByText('Filtros do pipeline')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Pipeline Automático de Segurança/)).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: /Localização em Moderação/ })).toContainText('Fila de revisão');

    expect(errors.filter((message) => !/WebSocket|vite/i.test(message))).toEqual([]);
  });

  test('notificações: envio e preferências em páginas separadas', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signInAdmin(page);

    await openAdminModule(page, /Notificações/);
    const tabs = page.getByRole('tablist', { name: 'Submódulos de Notificações' });
    await expect(tabs).toBeVisible({ timeout: 20000 });
    await expect(tabs.getByRole('tab')).toHaveCount(2);

    await expect(page.getByRole('button', { name: /Emitir|Enviar/ }).first()).toBeVisible();
    await expect(page.getByText(/Preferências de notifica/i).first()).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: /Localização em Notificações/ })).toContainText('Enviar notificação');

    await tabs.getByRole('tab', { name: 'Preferências' }).click();
    await expect(page.getByText(/Preferências de notifica/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Emitir|Enviar/ })).toHaveCount(0);

    expect(errors.filter((message) => !/WebSocket|vite/i.test(message))).toEqual([]);
  });

  test('responsivo: submódulos continuam acessíveis em telemóvel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAdmin(page);
    await page.getByRole('button', { name: /Abrir menu lateral|Open side menu/i }).first().click();
    await expect(page.locator('aside').first()).toBeInViewport({ timeout: 10000 });
    await openAdminModule(page, /^Moderação$/);
    const tabs = page.getByRole('tablist', { name: 'Submódulos de Moderação' });
    await expect(tabs).toBeVisible({ timeout: 20000 });
    await tabs.getByRole('tab', { name: 'Fila de revisão' }).click();
    await expect(tabs.getByRole('tab', { name: 'Fila de revisão' })).toHaveAttribute('aria-selected', 'true');
  });
});
