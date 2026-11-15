import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';

const BASE_URL = `http://127.0.0.1:${process.env.PW_PORT?.trim() || '3000'}`;
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
    expect(healthBody).toEqual({
      status: expect.any(String),
      app: 'Guigui.com Bissau',
      timestamp: expect.any(String),
    });
    expect(healthBody).not.toHaveProperty('database');
    expect(healthBody).not.toHaveProperty('observability');
    expect(healthBody).not.toHaveProperty('geminiActive');
  });

  test('cidadão não acede a rotas administrativas nem apela conteúdo alheio', async ({ request }) => {
    await login(request, CITIZEN_EMAIL);

    for (const route of ['/api/admin/stats', '/api/admin/users', '/api/moderation/logs']) {
      const response = await request.get(route);
      expect(response.status(), route).toBe(403);
    }

    // A decisão de aprovação é exclusiva da administração.
    const approve = await request.post('/api/moderation/review', {
      data: { id: 'qualquer-id', action: 'approve' },
    });
    expect(approve.status()).toBe(403);

    // O recurso só pertence ao titular do conteúdo; o cidadão não pode apelar
    // um item cujo autor seja outra conta.
    const adminContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
    try {
      await login(adminContext, ADMIN_EMAIL);
      const logsResponse = await adminContext.get('/api/moderation/logs');
      expect(logsResponse.ok()).toBeTruthy();
      const logs = await logsResponse.json() as Array<{ id: string; authorId?: string }>;
      const foreign = logs.find((entry) => entry.authorId && entry.authorId !== 'demo-citizen');
      if (foreign) {
        const appeal = await request.post('/api/moderation/review', {
          data: { id: foreign.id, action: 'appeal', notes: 'tentativa não autorizada' },
        });
        expect(appeal.status()).toBe(403);
      }
    } finally {
      await adminContext.dispose();
    }
  });

  test('empresa lê os próprios recursos mas não os de outra empresa', async ({ request }) => {
    await login(request, BUSINESS_EMAIL);

    const ownWallet = await request.get('/api/monetization/wallet/biz-1');
    expect(ownWallet.status()).toBe(200);
    const ownWalletBody = await ownWallet.json() as Record<string, unknown>;
    expect(ownWalletBody).toHaveProperty('postsExtraPurchased');

    const foreignWallet = await request.get('/api/monetization/wallet/biz-2');
    expect(foreignWallet.status()).toBe(403);

    const ownSchedule = await request.get('/api/marketing/scheduled-items?businessId=biz-1');
    expect(ownSchedule.status()).toBe(200);

    const foreignSchedule = await request.get('/api/marketing/scheduled-items?businessId=biz-2');
    expect(foreignSchedule.status()).toBe(403);

    // Criar um agendamento em nome de outra empresa é recusado antes de persistir.
    const foreignCreate = await request.post('/api/marketing/scheduled-items', {
      data: {
        businessId: 'biz-2',
        itemId: 'item-regressao',
        itemType: 'promotion',
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(foreignCreate.status()).toBe(403);
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
