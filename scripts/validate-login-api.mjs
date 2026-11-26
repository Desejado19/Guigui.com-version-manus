const BASE_URL = 'http://127.0.0.1:3000';
const DEMO_PASSWORD = 'Guigui@2026!';

async function apiRequest(method, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text, setCookie, json: () => JSON.parse(text || '{}') };
}

async function main() {
  let sessionCookie = '';

  // 1. Login como cidadão via API
  const loginRes = await apiRequest('POST', '/api/auth/login', { email: 'cidadao.teste@guigui.com', password: DEMO_PASSWORD });
  console.log('✓ Login cidadão:', loginRes.ok ? 'sucesso' : `falha (${loginRes.status})`, loginRes.body);
  if (loginRes.setCookie) {
    sessionCookie = loginRes.setCookie.split(';')[0];
    console.log('✓ Cookie de sessão extraído');
  }

  if (!sessionCookie) {
    console.error('✗ Não foi possível extrair cookie de sessão');
    process.exit(1);
  }

  // 2. Testa escrita de estado via API
  const loginJsonRes = await apiRequest('POST', '/api/auth/login', { email: 'cidadao.teste@guigui.com', password: DEMO_PASSWORD });
  const loginJson = await loginJsonRes.json();
  const userId = loginJson.user?.id;
  console.log('  userId:', userId);

  if (userId) {
    const testKey = `user_language_${userId}`;
    const testPayload = { updatedAt: new Date().toISOString(), status: 'synced_by_playwright', count: 42 };

    const saveRes = await apiRequest('POST', `/api/app-state/${testKey}`, { value: testPayload }, sessionCookie);
    console.log('✓ Grava app-state:', saveRes.ok ? 'sucesso' : `falha (${saveRes.status})`, saveRes.body);

    const getRes = await apiRequest('GET', `/api/app-state/${testKey}`, null, sessionCookie);
    console.log('✓ Lê app-state:', getRes.ok ? 'sucesso' : `falha (${getRes.status})`);
    if (getRes.ok) {
      const body = await getRes.json();
      console.log('  Valor retornado:', JSON.stringify(body.value));
    }
  }

  // 3. Login como admin e testa escrita de negócios e eventos
  const adminLoginRes = await apiRequest('POST', '/api/auth/login', { email: 'admin.teste@guigui.com', password: DEMO_PASSWORD });
  console.log('✓ Login admin:', adminLoginRes.ok ? 'sucesso' : `falha (${adminLoginRes.status})`, adminLoginRes.body);
  const adminCookie = adminLoginRes.setCookie ? adminLoginRes.setCookie.split(';')[0] : '';

  if (adminCookie) {
    const uniqueId = `biz-test-${Date.now()}`;
    const testBiz = { id: uniqueId, name: 'Empresa Teste Playwright Sync', categoryId: 'cat-1', status: 'test' };

    const postBizRes = await apiRequest('POST', '/api/businesses', testBiz, adminCookie);
    console.log('✓ Cria negócio:', postBizRes.ok ? 'sucesso' : `falha (${postBizRes.status})`, postBizRes.body);

    const getBizRes = await apiRequest('GET', '/api/businesses', null, adminCookie);
    console.log('✓ Lista negócios:', getBizRes.ok ? 'sucesso' : `falha (${getBizRes.status})`);
    if (getBizRes.ok) {
      const bizData = await getBizRes.json();
      const found = bizData.businesses?.find((b) => b.id === uniqueId);
      console.log('  Negócio encontrado:', found ? 'sim' : 'não');
    }

    const uniqueEvtId = `evt-test-${Date.now()}`;
    const testEvt = { id: uniqueEvtId, businessId: uniqueId, title: 'Show Teste Playwright Sync', status: 'draft', date: '2026-10-15', time: '20:00' };

    const postEvtRes = await apiRequest('POST', '/api/events', testEvt, adminCookie);
    console.log('✓ Cria evento:', postEvtRes.ok ? 'sucesso' : `falha (${postEvtRes.status})`, postEvtRes.body);

    const getEvtRes = await apiRequest('GET', '/api/events', null, adminCookie);
    console.log('✓ Lista eventos:', getEvtRes.ok ? 'sucesso' : `falha (${getEvtRes.status})`);
    if (getEvtRes.ok) {
      const evtData = await getEvtRes.json();
      const foundEvt = evtData.events?.find((e) => e.id === uniqueEvtId);
      console.log('  Evento encontrado:', foundEvt ? 'sim' : 'não');
    }
  }

  console.log('\n✓ Todos os testes de validação concluídos!');
}

main().catch((err) => {
  console.error('✗ Erro:', err.message);
  process.exit(1);
});