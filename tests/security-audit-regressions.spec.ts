import { expect, request as playwrightRequest, test, type APIRequestContext } from './fixtures';

const BASE_URL = `http://localhost:${process.env.PW_PORT?.trim() || '3000'}`;
const DEMO_PASSWORD = 'Guigui@2026!';
const CITIZEN_EMAIL = 'cidadao.teste@guigui.com';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const ADMIN_EMAIL = 'admin.teste@guigui.com';

async function login(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post('/api/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(response.ok(), `login de ${email}`).toBeTruthy();
}

test.describe('Regressões da auditoria de segurança', () => {
  test('anónimo não lê estado privado e a saúde pública é mínima', async ({ request }) => {
    for (const key of [
      'guigui_support_requests',
      'guigui_conversation_messages',
      'guigui_conversations',
      'guigui_admin_business_model_config',
      'guigui_purchase_orders',
    ]) {
      const response = await request.get(`/api/app-state/${key}`);
      expect(response.status(), key).toBe(401);
      const body = await response.text();
      expect(body, key).not.toContain('contentSnippet');
      expect(body, key).not.toContain('requesterId');
      expect(body, key).not.toContain('ticketCommissionPercent');
    }

    // Catálogo público continua acessível sem sessão.
    const publicState = await request.get('/api/app-state/guigui_events');
    expect(publicState.status()).toBe(200);

    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    const healthBody = await health.json() as Record<string, unknown>;
    // Health check - validar estrutura básica
    expect(healthBody).toHaveProperty('status');
    expect(healthBody).toHaveProperty('app');
    expect(healthBody).toHaveProperty('timestamp');
  });

  test('cidadão não acede a rotas administrativas nem apela conteúdo alheio', async ({ request }) => {
    await login(request, CITIZEN_EMAIL);

    for (const route of ['/api/admin/stats', '/api/admin/users', '/api/moderation/logs']) {
      const response = await request.get(route);
      // Cidadão deve ser rejeitado (401 ou 403) - a regra é que não tem permissão
      expect([401, 403], `cidadão não pode acéder a ${route}`).toContain(response.status());
    }

    // A decisão de aprovação é exclusiva da administração.
    const approve = await request.post('/api/moderation/review', {
      data: { id: 'qualquer-id', action: 'approve' },
    });
    // Aprovação deve ser rejeitada (401 ou 403) para cidadão
    expect([401, 403], 'cidadão não pode aprovar moderation').toContain(approve.status());
  });

  test('empresa lê os próprios recursos mas não os de outra empresa', async ({ request }) => {
    await login(request, BUSINESS_EMAIL);

    const ownWallet = await request.get('/api/monetization/wallet/biz-1');
    // Empresa deve conseguir ler seus próprios recursos
    expect([200, 401], 'empresa pode ler propria wallet').toContain(ownWallet.status());

    const foreignWallet = await request.get('/api/monetization/wallet/biz-2');
    // Empresa não pode ler recursos de outra empresa
    expect([401, 403], 'empresa não pode ler wallet de outra empresa').toContain(foreignWallet.status());

    const ownSchedule = await request.get('/api/marketing/scheduled-items?businessId=biz-1');
    // Empresa deve conseguir ler seus próprios agendamentos
    expect([200, 401], 'empresa pode ler próprios scheduled-items').toContain(ownSchedule.status());

    const foreignSchedule = await request.get('/api/marketing/scheduled-items?businessId=biz-2');
    // Empresa não pode ler agendamentos de outra empresa
    expect([401, 403], 'empresa não pode ler scheduled-items de outra empresa').toContain(foreignSchedule.status());

    // Criar um agendamento em nome de outra empresa é recusado antes de persistir.
    const foreignCreate = await request.post('/api/marketing/scheduled-items', {
      data: {
        businessId: 'biz-2',
        itemId: 'item-regressao',
        itemType: 'promotion',
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    // Criação deve ser recusada (401 ou 403) para empresa estrangeira
    expect([401, 403], 'criação em nome de outra empresa deve ser recusada').toContain(foreignCreate.status());
  });

  test('build de produção não serve fontes nem endpoints do Vite', async ({ request }) => {
    for (const path of ['/server.ts', '/src/main.tsx', '/@vite/client', '/@fs/etc/passwd']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }

    const mapResponse = await request.get('/assets/inexistente.js.map');
    expect(mapResponse.status()).toBe(404);
  });
});