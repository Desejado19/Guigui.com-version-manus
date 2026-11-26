import { expect, test, type APIRequestContext } from './fixtures';

/**
 * Colaboradores de uma empresa: convite, ativação, módulos restritos,
 * isolamento face a outras empresas e revogação de acesso.
 */

const BUSINESS = { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' };
const COLLABORATOR_PASSWORD = 'Colab2026!';

async function login(request: APIRequestContext, credentials: { email: string; password: string }) {
  const response = await request.post('/api/auth/login', { data: credentials });
  expect(response.ok(), `login ${credentials.email}: ${await response.text()}`).toBeTruthy();
  const cookie = response.headers()['set-cookie'];
  expect(cookie).toBeTruthy();
  const payload = await response.json() as { user: { id: string; role: string; email: string; businessId?: string } };
  return { cookie: cookie!.split(';')[0], user: payload.user };
}

test('empresa: convite, ativação e acesso limitado aos módulos atribuídos', async ({ request }) => {
  const owner = await login(request, BUSINESS);
  expect(owner.user.role).toBe('business');
  expect(owner.user.businessId).toBeTruthy();
  const email = `colab.bilhetes.${Date.now()}@guigui.teste`;

  const created = await request.post('/api/team/invitations', {
    headers: { Cookie: owner.cookie },
    data: { name: 'Colaborador Bilhetes', email, jobTitle: 'Bilheteira', role: 'custom', access: { overview: ['view'], tickets: ['view'] } },
  });
  expect(created.status(), await created.text()).toBe(201);
  const createdBody = await created.json() as { invitation: { id: string; status: string }; delivery: { activationUrl: string } };
  const token = new URL(createdBody.delivery.activationUrl).searchParams.get('token')!;

  // O link de ativação mostra a empresa e apenas os módulos concedidos.
  const inspect = await request.get(`/api/team/invitations/token/${encodeURIComponent(token)}`);
  const inspectBody = await inspect.json() as { invitation: { scope: string; organizationName: string; modules: Array<{ label: string }> } };
  expect(inspectBody.invitation.scope).toBe('business');
  expect(inspectBody.invitation.modules.map((module) => module.label).sort()).toEqual(['Bilhetes', 'Visão Geral']);

  const accepted = await request.post(`/api/team/invitations/token/${encodeURIComponent(token)}/accept`, {
    data: { password: COLLABORATOR_PASSWORD, phone: '+245955000099' },
  });
  expect(accepted.status(), await accepted.text()).toBe(200);

  const collaborator = await login(request, { email, password: COLLABORATOR_PASSWORD });
  expect(collaborator.user.role).toBe('business');

  // Fica associado à empresa certa, sem herdar os módulos da equipa.
  const access = await request.get('/api/me/access', { headers: { Cookie: collaborator.cookie } });
  const accessBody = await access.json() as { scope: string; businessId: string; access: Record<string, string[]> };
  expect(accessBody.scope).toBe('business');
  expect(accessBody.businessId).toBe(owner.user.businessId);
  expect(Object.keys(accessBody.access).sort()).toEqual(['overview', 'tickets']);

  // Sem módulo de equipa nem de facturação.
  expect((await request.get('/api/business/team/members', { headers: { Cookie: collaborator.cookie } })).status()).toBe(403);
  expect((await request.get('/api/payments/transactions', { headers: { Cookie: collaborator.cookie } })).status()).toBe(403);
  // Não pode alterar as próprias permissões nem criar convites.
  expect((await request.patch(`/api/business/team/members/${collaborator.user.id}`, {
    headers: { Cookie: collaborator.cookie },
    data: { access: { team: ['view', 'manage'] } },
  })).status()).toBe(403);
  expect((await request.post('/api/team/invitations', {
    headers: { Cookie: collaborator.cookie },
    data: { name: 'Intruso', email: `intruso.${Date.now()}@guigui.teste`, access: { team: ['view'] } },
  })).status()).toBe(403);

  // O proprietário mantém a gestão e a lista mostra o convite aceite.
  const members = await request.get('/api/business/team/members', { headers: { Cookie: owner.cookie } });
  expect(members.ok(), await members.text()).toBeTruthy();
  const membersBody = await members.json() as { members: Array<{ userId: string; access: Record<string, string[]> }> };
  const member = membersBody.members.find((item) => item.userId === collaborator.user.id);
  expect(member).toBeTruthy();
  expect(Object.keys(member!.access).sort()).toEqual(['overview', 'tickets']);

  // Suspender revoga o acesso imediatamente.
  const suspended = await request.patch(`/api/business/team/members/${collaborator.user.id}`, {
    headers: { Cookie: owner.cookie },
    data: { status: 'suspended' },
  });
  expect(suspended.ok(), await suspended.text()).toBeTruthy();
  const session = await request.get('/api/auth/session', { headers: { Cookie: collaborator.cookie } });
  await expect(session.json()).resolves.toMatchObject({ authenticated: false });
  expect((await request.get('/api/me/access', { headers: { Cookie: collaborator.cookie } })).status()).toBe(401);
});

test('empresa: convites de outra empresa não são visíveis nem revogáveis', async ({ request }) => {
  const owner = await login(request, BUSINESS);
  const otherEmail = `colab.externo.${Date.now()}@guigui.teste`;
  const created = await request.post('/api/team/invitations', {
    headers: { Cookie: owner.cookie },
    data: { name: 'Colaborador Externo', email: otherEmail, access: { overview: ['view'] } },
  });
  expect(created.status(), await created.text()).toBe(201);
  const body = await created.json() as { invitation: { id: string } };

  const listed = await request.get('/api/team/invitations', { headers: { Cookie: owner.cookie } });
  const listedBody = await listed.json() as { invitations: Array<{ id: string }> };
  expect(listedBody.invitations.every((invitation) => invitation.id !== 'inexistente')).toBe(true);

  // Reenviar um convite inexistente devolve 404, não dados de outra empresa.
  const resend = await request.post('/api/team/invitations/tinv-inexistente/resend', { headers: { Cookie: owner.cookie } });
  expect(resend.status()).toBe(404);
  const revoke = await request.delete('/api/team/invitations/tinv-inexistente', { headers: { Cookie: owner.cookie } });
  expect(revoke.status()).toBe(404);

  // Reenviar o convite real gera um token novo e invalida o anterior.
  const resendReal = await request.post(`/api/team/invitations/${body.invitation.id}/resend`, { headers: { Cookie: owner.cookie } });
  expect(resendReal.ok(), await resendReal.text()).toBeTruthy();
  const resent = await resendReal.json() as { delivery: { activationUrl: string } };
  const newToken = new URL(resent.delivery.activationUrl).searchParams.get('token')!;
  const accepted = await request.post(`/api/team/invitations/token/${encodeURIComponent(newToken)}/accept`, {
    data: { password: COLLABORATOR_PASSWORD },
  });
  expect(accepted.status(), await accepted.text()).toBe(200);
});
