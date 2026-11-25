import { expect, patchApiContext, request as playwrightRequest, test, type Page } from './fixtures';

const DEMO_PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const ADMIN_EMAIL = 'admin.teste@guigui.com';

async function signIn(page: Page, email: string): Promise<Record<string, unknown>> {
  const response = await page.request.post('/api/auth/login', { data: { email, password: DEMO_PASSWORD } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const user = payload.user as Record<string, unknown>;
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, user);
  return user;
}

async function openBusinessDashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Sessão Iniciada').click();
  await page.getByRole('button', { name: /Área da Minha Empresa/ }).first().click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
}

async function openNav(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).first().click();
}

test.describe('Segurança, Relatórios e Exportação', () => {
  test.setTimeout(180_000);

  test('lista sessões reais e impede revogar sessões de outra conta', async ({ page, request }) => {
    const anonymous = await request.get('/api/auth/sessions');
    expect(anonymous.status()).toBe(401);
    const anonymousEvents = await request.get('/api/security/events');
    expect(anonymousEvents.status()).toBe(401);

    const businessLogin = await request.post('/api/auth/login', { data: { email: BUSINESS_EMAIL, password: DEMO_PASSWORD } });
    expect(businessLogin.ok()).toBeTruthy();

    const sessionsResponse = await request.get('/api/auth/sessions');
    expect(sessionsResponse.status()).toBe(200);
    const payload = await sessionsResponse.json() as {
      sessions: Array<{ id: string; current: boolean; createdAt: string; userAgent: string | null }>;
    };
    expect(Array.isArray(payload.sessions)).toBe(true);
    expect(payload.sessions.length).toBeGreaterThanOrEqual(1);
    expect(payload.sessions.filter((session) => session.current)).toHaveLength(1);

    // Encerrar uma sessão inexistente desta conta responde 404 sem efeitos.
    const missing = await request.delete('/api/auth/sessions/00000000-0000-0000-0000-000000000000');
    expect(missing.status()).toBe(404);

    // A sessão do administrador pertence a outra conta: a empresa não a pode encerrar.
    const adminContext = patchApiContext(await playwrightRequest.newContext({
      baseURL: (test.info().project.use as { baseURL?: string }).baseURL,
    }));
    const adminLogin = await adminContext.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: DEMO_PASSWORD } });
    expect(adminLogin.ok()).toBeTruthy();
    const adminSessions = await adminContext.get('/api/auth/sessions');
    expect(adminSessions.ok()).toBeTruthy();
    const adminPayload = await adminSessions.json() as { sessions: Array<{ id: string; current: boolean }> };
    const adminSessionId = adminPayload.sessions.find((session) => session.current)?.id;
    expect(adminSessionId).toBeTruthy();

    const forbidden = await request.delete(`/api/auth/sessions/${adminSessionId}`);
    expect(forbidden.status()).toBe(404);
    const adminStillValid = await adminContext.get('/api/auth/session');
    expect(adminStillValid.ok()).toBeTruthy();
    await adminContext.dispose();

    // O histórico de segurança devolve apenas eventos da própria conta.
    const eventsResponse = await request.get('/api/security/events?limit=10');
    expect(eventsResponse.status()).toBe(200);
    const eventsPayload = await eventsResponse.json() as { events?: Array<{ action: string; createdAt: string }>; source?: string };
    expect(eventsPayload.source).toBe('audit_logs');
    expect(Array.isArray(eventsPayload.events)).toBe(true);

    // A alteração de palavra-passe é validada no servidor: password actual errada é recusada.
    const wrongPassword = await request.post('/api/auth/change-password', {
      data: { email: BUSINESS_EMAIL, currentPassword: 'errada-2026', newPassword: 'Outra@2026!' },
    });
    expect(wrongPassword.ok()).toBeFalsy();

    await page.goto('/');
  });

  test('centro de segurança lista sessões, histórico e alertas', async ({ page }) => {
    await signIn(page, BUSINESS_EMAIL);
    await openBusinessDashboard(page);
    await openNav(page, 'Segurança');

    await expect(page.getByRole('heading', { name: /Proteção e acessos de/ })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'Sessões e dispositivos' }).click();
    await expect(page.getByText('Sessão actual').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Encerrar todas as sessões' })).toBeVisible();

    await page.getByRole('tab', { name: 'Histórico de segurança' }).click();
    await expect(page.getByRole('heading', { name: 'Histórico de segurança' })).toBeVisible();
    await expect(page.getByText(/origem: audit_logs/)).toBeVisible();

    await page.getByRole('tab', { name: /^Alertas/ }).first().click();
    await expect(page.getByText('Sessão actual protegida por cookie HttpOnly')).toBeVisible();
    await expect(page.getByText('Recomendações')).toBeVisible();
  });

  test('relatórios calculam indicadores a partir dos dados reais e exportam em CSV', async ({ page }) => {
    await signIn(page, BUSINESS_EMAIL);
    await openBusinessDashboard(page);

    await openNav(page, 'Relatórios');
    await expect(page.getByRole('heading', { name: /Desempenho de/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Origem: Encomendas registadas no painel')).toBeVisible();
    await expect(page.getByText('Total de vendas')).toBeVisible();

    // Mudar o período actualiza o rótulo e mantém a tabela coerente.
    await page.getByLabel('Período', { exact: true }).selectOption('90d');
    await expect(page.getByText('Últimos 90 dias').first()).toBeVisible();
    await page.getByLabel('Período', { exact: true }).selectOption('all');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar relatório' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);

    // A exportação fica registada no histórico integrado no módulo Relatórios.
    await page.getByRole('button', { name: 'Exportação de dados' }).click();
    const historyTable = page.getByTestId('export-history-table');
    await expect(historyTable).toBeVisible({ timeout: 20_000 });
    await expect(historyTable.getByText('Relatórios · Comercial')).toBeVisible();

    // A exportação individual passou a ser feita pelo formulário guiado.
    await page.getByTestId('prepare-export').click();
    await page.getByTestId('wizard-area').selectOption('sales');
    await page.getByTestId('wizard-report-orders').check();
    await page.getByTestId('wizard-period-all').click();
    await page.getByTestId('wizard-format-csv').click();
    await expect(page.getByTestId('preview-records')).toContainText('registo(s)');

    const downloadDataset = page.waitForEvent('download');
    await page.getByTestId('generate-export').click();
    const datasetFile = await downloadDataset;
    expect(datasetFile.suggestedFilename()).toMatch(/\.csv$/);
    await expect(historyTable.getByText(/\.csv/).first()).toBeVisible();
  });

  test('navegação entre Segurança, Relatórios, Configurações e Exportação integrada mantém o módulo correto', async ({ page }) => {
    await signIn(page, BUSINESS_EMAIL);
    await openBusinessDashboard(page);

    await openNav(page, 'Relatórios');
    await expect(page.getByRole('button', { name: 'Exportação de dados' })).toBeVisible();
    await page.getByRole('button', { name: 'Exportação de dados' }).click();
    await expect(page.getByRole('heading', { name: 'Histórico de exportações' })).toBeVisible();

    await openNav(page, 'Segurança');
    await expect(page.getByRole('heading', { name: 'Alterar palavra-passe' })).toBeVisible();

    await openNav(page, 'Configurações da conta');
    await expect(page.getByRole('heading', { name: /Configurações da conta/ })).toBeVisible();
  });
});
