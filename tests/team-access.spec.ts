import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';

const DEMO_PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const MEMBER_PASSWORD = 'Colab@2026!';

async function signIn(page: Page, email: string, password = DEMO_PASSWORD): Promise<Record<string, unknown>> {
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  return payload.user as Record<string, unknown>;
}

async function openBusinessDashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Sessão Iniciada').click();
  await page.getByRole('button', { name: /Área da Minha Empresa/ }).first().click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
}

test.describe('Gestão de utilizadores, acessos e permissões', () => {
  test.setTimeout(240_000);

  test('aplica permissões no servidor, isola empresas e encerra sessões ao suspender', async ({ request }) => {
    const stamp = Date.now();
    const email = `colab.api.${stamp}@guigui.com`;
    const owner = await request.post('/api/auth/login', { data: { email: BUSINESS_EMAIL, password: DEMO_PASSWORD } });
    expect(owner.ok()).toBeTruthy();

    const access = await request.get('/api/me/access');
    expect((await access.json()).fullAccess).toBe(true);

    const created = await request.post('/api/business/team/members', {
      data: {
        name: 'Colaborador API',
        email,
        password: MEMBER_PASSWORD,
        jobTitle: 'Marketing',
        role: 'marketing',
        access: { overview: ['view'], marketing: ['view', 'create'], content: ['view'] },
      },
    });
    expect(created.status()).toBe(201);
    const memberId = (await created.json()).member.userId as string;
    expect(memberId).toBeTruthy();

    // Duplicação de e-mail é recusada.
    const duplicate = await request.post('/api/business/team/members', {
      data: { name: 'Duplicado', email, password: MEMBER_PASSWORD, access: { overview: ['view'] } },
    });
    expect(duplicate.status()).toBe(409);

    // Contexto próprio do colaborador para verificar sessão e permissões reais.
    const memberContext = await playwrightRequest.newContext({
      baseURL: (test.info().project.use as { baseURL?: string }).baseURL,
    });
    const memberLogin = await memberContext.post('/api/auth/login', { data: { email, password: MEMBER_PASSWORD } });
    expect(memberLogin.ok()).toBeTruthy();
    const memberAccess = await (await memberContext.get('/api/me/access')).json();
    expect(memberAccess.fullAccess).toBe(false);
    expect(Object.keys(memberAccess.access).sort()).toEqual(['content', 'marketing', 'overview']);
    expect(memberAccess.access.tickets).toBeUndefined();

    // Sem permissão: bilhetes, financeiro e equipa bloqueados no backend.
    expect((await memberContext.get('/api/tickets/sold')).status()).toBe(403);
    expect((await memberContext.get('/api/payments/transactions')).status()).toBe(403);
    expect((await memberContext.get('/api/business/team/members')).status()).toBe(403);

    // A alteração de permissões produz efeitos imediatos.
    const patched = await request.patch(`/api/business/team/members/${memberId}`, {
      data: { access: { overview: ['view'], tickets: ['view'] } },
    });
    expect(patched.status()).toBe(200);
    expect((await memberContext.get('/api/tickets/sold')).status()).toBe(200);
    expect((await memberContext.get('/api/marketing/scheduled-items')).status()).toBe(403);

    // Um colaborador não pode revogar a sessão do titular.
    const ownerSessions = await (await request.get('/api/auth/sessions')).json();
    const ownerSessionId = ownerSessions.sessions.find((session: { current: boolean }) => session.current).id;
    expect((await memberContext.delete(`/api/auth/sessions/${ownerSessionId}`)).status()).toBe(403);

    // Suspensão: login recusado e sessão imediatamente invalidada.
    const suspended = await request.patch(`/api/business/team/members/${memberId}`, { data: { status: 'suspended' } });
    expect(suspended.status()).toBe(200);
    expect((await memberContext.get('/api/me/access')).status()).toBe(401);
    const blockedLogin = await memberContext.post('/api/auth/login', { data: { email, password: MEMBER_PASSWORD } });
    expect(blockedLogin.status()).toBe(403);
    expect((await blockedLogin.json()).code).toBe('ACCESS_SUSPENDED');

    // Titular não pode ser suspenso por esta via.
    const ownerId = (await request.get('/api/auth/session').then((response) => response.json())).userId;
    const protectOwner = await request.patch(`/api/business/team/members/${ownerId}`, { data: { status: 'suspended' } });
    expect(protectOwner.status()).toBe(403);

    // Remoção revoga a conta.
    expect((await request.patch(`/api/business/team/members/${memberId}`, { data: { status: 'active' } })).status()).toBe(200);
    expect((await request.delete(`/api/business/team/members/${memberId}`)).status()).toBe(200);
    const afterRemoval = await memberContext.post('/api/auth/login', { data: { email, password: MEMBER_PASSWORD } });
    expect(afterRemoval.status()).toBe(403);
    await memberContext.dispose();
  });

  test('a empresa cria colaborador pela interface com módulos escolhidos', async ({ page, request }) => {
    const stamp = Date.now();
    const email = `colab.ui.${stamp}@guigui.com`;
    await signIn(page, BUSINESS_EMAIL);
    await openBusinessDashboard(page);
    await page.getByRole('button', { name: 'Equipa e permissões', exact: true }).first().click();

    await expect(page.getByTestId('team-access-hub')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Criar colaborador' }).click();
    await page.getByLabel('Nome completo').fill('Colaborador Interface');
    await page.getByLabel('E-mail de acesso').fill(email);
    await page.getByLabel('Cargo / função').fill('Marketing');
    await page.getByLabel('Palavra-passe inicial').fill(MEMBER_PASSWORD);
    await page.getByLabel('Função predefinida (modelo de permissões)').selectOption('marketing');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByText('Colaborador Interface').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(email).first()).toBeVisible();

    const members = await (await page.request.get('/api/business/team/members')).json();
    const member = members.members.find((entry: { email: string }) => entry.email === email);
    expect(member).toBeTruthy();
    expect(Object.keys(member.access)).toContain('marketing');
    expect(member.access.tickets).toBeUndefined();
    expect(member.status).toBe('active');

    // Pesquisa e filtro por estado funcionam sobre dados reais.
    await page.getByPlaceholder('Pesquisar nome, e-mail ou cargo').fill('Colaborador Interface');
    await expect(page.getByText('Colaborador Interface').first()).toBeVisible();
    await page.getByPlaceholder('Pesquisar nome, e-mail ou cargo').fill('');
    await page.getByLabel('Filtrar por estado').selectOption('suspended');
    await expect(page.getByText('Sem colaboradores para os filtros actuais')).toBeVisible();
    await page.getByLabel('Filtrar por estado').selectOption('all');

    await page.request.delete(`/api/business/team/members/${member.userId}`);
    await page.request.post('/api/auth/login', { data: { email: BUSINESS_EMAIL, password: DEMO_PASSWORD } });
    expect(request).toBeTruthy();
  });

  test('colaborador vê apenas os módulos autorizados e não acede aos restantes', async ({ browser, request }) => {
    const stamp = Date.now();
    const email = `colab.nav.${stamp}@guigui.com`;
    const ownerLogin = await request.post('/api/auth/login', { data: { email: BUSINESS_EMAIL, password: DEMO_PASSWORD } });
    expect(ownerLogin.ok()).toBeTruthy();
    const created = await request.post('/api/business/team/members', {
      data: {
        name: 'Colaborador Navegação',
        email,
        password: MEMBER_PASSWORD,
        jobTitle: 'Conteúdo',
        role: 'marketing',
        access: { overview: ['view'], stories: ['view', 'create'], content: ['view', 'create'], marketing: ['view', 'create'] },
      },
    });
    expect(created.status()).toBe(201);
    const memberId = (await created.json()).member.userId as string;

    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, email, MEMBER_PASSWORD);
    await openBusinessDashboard(page);

    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByRole('button', { name: 'Marketing', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Stories', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Bilhetes', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('button', { name: 'Clientes', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('button', { name: 'Equipa e permissões', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('button', { name: 'Relatórios', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('button', { name: 'Exportação', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('button', { name: 'Segurança', exact: true })).toHaveCount(0);

    // Módulo autorizado abre normalmente.
    await page.getByRole('button', { name: 'Marketing', exact: true }).first().click();
    await expect(page.getByRole('tab', { name: 'Campanhas' })).toBeVisible({ timeout: 20_000 });

    // Acesso directo à API de um módulo bloqueado é recusado no servidor.
    const forbidden = await page.request.get('/api/payments/transactions');
    expect(forbidden.status()).toBe(403);
    expect((await forbidden.json()).code).toBe('MODULE_FORBIDDEN');

    await context.close();
    await request.delete(`/api/business/team/members/${memberId}`);
    await request.post('/api/auth/login', { data: { email: BUSINESS_EMAIL, password: DEMO_PASSWORD } });
  });
});
