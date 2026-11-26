import { expect, test, type APIRequestContext } from './fixtures';

/**
 * Colaboradores da Administração: convite, ativação, módulos restritos,
 * alteração de permissões e suspensão com revogação imediata.
 *
 * O e-mail é enviado pelo SMTP configurado; sem SMTP o servidor devolve
 * `delivery.mode = 'simulated'` e o link de ativação para uso manual — o teste
 * aceita os dois casos mas exige sempre um link com token real.
 */

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };
const COLLABORATOR_PASSWORD = 'Colab2026!';

async function login(request: APIRequestContext, credentials: { email: string; password: string }) {
  const response = await request.post('/api/auth/login', { data: credentials });
  expect(response.ok(), `login ${credentials.email}: ${await response.text()}`).toBeTruthy();
  const cookie = response.headers()['set-cookie'];
  expect(cookie).toBeTruthy();
  const payload = await response.json() as { user: { id: string; role: string; email: string } };
  return { cookie: cookie!.split(';')[0], user: payload.user };
}

test('admin: convite por e-mail, ativação e acesso restrito por módulos', async ({ page, request, browser }) => {
  const admin = await login(request, ADMIN);
  const email = `colab.moderacao.${Date.now()}@guigui.teste`;
  const access = { moderation: ['view', 'approve', 'reject'], businesses: ['view'] };

  // 1. O responsável cria o colaborador apenas com nome, e-mail, cargo e módulos.
  const created = await request.post('/api/team/invitations', {
    headers: { Cookie: admin.cookie },
    data: { name: 'João Moderação', email, jobTitle: 'Colaborador de Moderação', role: 'moderator', access },
  });
  expect(created.status(), await created.text()).toBe(201);
  const createdBody = await created.json() as {
    invitation: { id: string; status: string; access: Record<string, string[]> };
    delivery: { mode: 'sent' | 'simulated'; activationUrl: string };
  };
  expect(createdBody.invitation.status).toBe('pending');
  expect(createdBody.invitation.access.moderation).toEqual(['view', 'approve', 'reject']);
  expect(createdBody.delivery.activationUrl).toContain('/ativar-convite?token=');
  const token = new URL(createdBody.delivery.activationUrl).searchParams.get('token');
  expect(token).toBeTruthy();

  // 2. A página de ativação mostra a organização, o cargo e só os módulos atribuídos.
  const context = await browser.newContext();
  const activation = await context.newPage();
  await activation.goto(`/ativar-convite?token=${encodeURIComponent(token!)}`);
  const moduleChips = activation.getByTestId('team-invite-modules');
  await expect(moduleChips).toBeVisible({ timeout: 15_000 });
  await expect(moduleChips).toContainText('Moderação');
  await expect(moduleChips).toContainText('Empresas e Negócios');
  await expect(moduleChips).not.toContainText('Financeiro');
  await activation.getByTestId('team-invite-password').fill(COLLABORATOR_PASSWORD);
  await activation.getByTestId('team-invite-password-confirm').fill(COLLABORATOR_PASSWORD);
  await activation.getByTestId('team-invite-submit').click();
  await expect(activation.getByTestId('team-invite-success')).toBeVisible({ timeout: 15_000 });
  await context.close();

  // 3. O convite passa a "aceite" e não pode ser reutilizado.
  const list = await request.get('/api/team/invitations', { headers: { Cookie: admin.cookie } });
  const listBody = await list.json() as { invitations: Array<{ id: string; status: string }> };
  expect(listBody.invitations.find((item) => item.id === createdBody.invitation.id)?.status).toBe('accepted');
  const reuse = await request.post(`/api/team/invitations/token/${encodeURIComponent(token!)}/accept`, {
    data: { password: 'OutraSenha2026!' },
  });
  expect(reuse.status()).toBe(410);

  // 4. Entra com a própria conta, com o papel administrativo mas sem Financeiro.
  const collaborator = await login(request, { email, password: COLLABORATOR_PASSWORD });
  expect(collaborator.user.role).toBe('admin');
  const me = await request.get('/api/me/access', { headers: { Cookie: collaborator.cookie } });
  const meBody = await me.json() as { scope: string; access: Record<string, string[]> };
  expect(meBody.scope).toBe('admin');
  expect(Object.keys(meBody.access).sort()).toEqual(['businesses', 'moderation']);

  expect((await request.get('/api/admin/finance/summary', { headers: { Cookie: collaborator.cookie } })).status()).toBe(403);
  expect((await request.get('/api/admin/businesses/pending', { headers: { Cookie: collaborator.cookie } })).status()).toBe(200);
  // Não pode gerir a equipa nem atribuir-se permissões.
  const selfEscalation = await request.patch(`/api/admin/team/members/${collaborator.user.id}`, {
    headers: { Cookie: collaborator.cookie },
    data: { access: { financials: ['view'] } },
  });
  expect(selfEscalation.status()).toBe(403);

  // 5. O responsável altera os módulos; o servidor aplica de imediato.
  const updated = await request.patch(`/api/admin/team/members/${collaborator.user.id}`, {
    headers: { Cookie: admin.cookie },
    data: { access: { support: ['view'] } },
  });
  expect(updated.ok(), await updated.text()).toBeTruthy();
  expect((await request.get('/api/admin/businesses/pending', { headers: { Cookie: collaborator.cookie } })).status()).toBe(403);

  // 6. Suspender revoga as sessões abertas.
  const suspended = await request.patch(`/api/admin/team/members/${collaborator.user.id}`, {
    headers: { Cookie: admin.cookie },
    data: { status: 'suspended' },
  });
  expect(suspended.ok(), await suspended.text()).toBeTruthy();
  const session = await request.get('/api/auth/session', { headers: { Cookie: collaborator.cookie } });
  await expect(session.json()).resolves.toMatchObject({ authenticated: false });
  expect((await request.get('/api/me/access', { headers: { Cookie: collaborator.cookie } })).status()).toBe(401);

  await page.goto('/');
});

test('admin: convite criado pelo painel de equipa da administração', async ({ page }) => {
  test.setTimeout(180_000);
  const login = await page.request.post('/api/auth/login', { data: ADMIN });
  expect(login.ok(), await login.text()).toBeTruthy();
  const payload = await login.json() as { user: unknown };
  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  await page.goto('/');

  const teamNav = page.getByRole('button', { name: 'Equipa', exact: true }).first();
  await expect(teamNav).toBeVisible({ timeout: 30_000 });
  await teamNav.click();
  const staffSection = page.getByRole('button', { name: /Administradores e funcionários/ }).first();
  await expect(staffSection).toBeVisible({ timeout: 20_000 });
  await staffSection.click();
  await expect(page.getByTestId('admin-team-hub')).toBeVisible({ timeout: 20_000 });

  const email = `colab.painel.${Date.now()}@guigui.teste`;
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome completo').fill('Colaborador Painel');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Cargo', { exact: true }).fill('Moderação');
  await page.getByLabel('Função predefinida').selectOption('moderator');
  await page.getByRole('button', { name: 'Enviar convite' }).click();

  const link = page.getByTestId('admin-invite-link').locator('input');
  await expect(link).toBeVisible({ timeout: 20_000 });
  const token = new URL(await link.inputValue()).searchParams.get('token');
  expect(token).toBeTruthy();
  await expect(page.getByTestId('admin-team-invitations')).toContainText('Colaborador Painel');
  await expect(page.getByTestId('admin-team-invitations')).toContainText('Pendente');

  const accepted = await page.request.post(`/api/team/invitations/token/${encodeURIComponent(token!)}/accept`, {
    data: { password: COLLABORATOR_PASSWORD },
  });
  expect(accepted.ok(), await accepted.text()).toBeTruthy();

  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.getByText('Colaborador Painel').first()).toBeVisible({ timeout: 20_000 });
  const members = await (await page.request.get('/api/admin/team/members')).json() as { members: Array<{ email: string; access: Record<string, string[]> }> };
  const member = members.members.find((item) => item.email === email);
  expect(member).toBeTruthy();
  expect(Object.keys(member!.access)).toContain('moderation');
});

test('admin: convite inválido e convite revogado não ativam conta', async ({ request }) => {
  const admin = await login(request, ADMIN);
  const email = `colab.revogado.${Date.now()}@guigui.teste`;
  const created = await request.post('/api/team/invitations', {
    headers: { Cookie: admin.cookie },
    data: { name: 'Colaborador Revogado', email, role: 'support', access: { support: ['view'] } },
  });
  expect(created.status(), await created.text()).toBe(201);
  const body = await created.json() as { invitation: { id: string }; delivery: { activationUrl: string } };
  const token = new URL(body.delivery.activationUrl).searchParams.get('token')!;

  const revoked = await request.delete(`/api/team/invitations/${body.invitation.id}`, { headers: { Cookie: admin.cookie } });
  expect(revoked.ok(), await revoked.text()).toBeTruthy();

  const inspect = await request.get(`/api/team/invitations/token/${encodeURIComponent(token)}`);
  const inspectBody = await inspect.json() as { invitation: { status: string; name: string } };
  expect(inspectBody.invitation.status).toBe('revoked');
  expect(inspectBody.invitation.name).toBe('');

  const accept = await request.post(`/api/team/invitations/token/${encodeURIComponent(token)}/accept`, {
    data: { password: COLLABORATOR_PASSWORD },
  });
  expect(accept.status()).toBe(410);

  const garbage = await request.get('/api/team/invitations/token/token-inventado-que-nao-existe-000000');
  expect(garbage.status()).toBe(404);
});
