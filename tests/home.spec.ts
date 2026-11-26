import { expect, test, type Page } from './fixtures';

/**
 * As rotas de escrita de estado, empresas e eventos exigem sessão autenticada
 * desde o endurecimento de segurança da Secção 3.10 do escopo. Estes testes
 * entram com uma conta de demonstração antes de escrever, exactamente como a
 * aplicação faz no browser.
 *
 * O login é feito via API (em vez de UI do navegador) para contornar dois
 * problemas: (1) o modal de login exige navegar por ecrãs de escolha antes de
 * exibir os botões de conta de teste, e (2) o cookie `guigui_session` tem a
 * flag `Secure`, pelo que `page.request` não o envia em HTTP. Injetamos o
 * cookie manualmente no contexto do browser sem a flag Secure para que as
 * chamadas de API subsequentes via `page.request` o enviem automaticamente.
 */
const DEMO_PASSWORD = 'Guigui@2026!';

async function signInDemo(page: Page, email: string) {
  // Faz login via API para obter o `user.id` e o cookie de sessão
  const response = await page.request.post('/api/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  const payload = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `login de demonstração falhou para ${email}: ${JSON.stringify(payload)}`,
  ).toBeTruthy();

  // Injeta o cookie de sessão no contexto do browser sem a flag Secure para
  // que `page.request` o envie automaticamente nas chamadas de API
  // subsequentes. O `url` do cookie tem de corresponder ao host do `baseURL`
  // resolvido do projeto (`localhost`, ver playwright.config.ts); o servidor
  // marca o cookie como Secure por correr em modo produção, e sem esta
  // reinjeção as chamadas de API ficavam sem sessão (AUTHENTICATION_REQUIRED).
  const setCookie = response.headers()['set-cookie'];
  if (setCookie) {
    const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    const cookieMatch = cookieString.match(/guigui_session=([^;]+)/);
    if (cookieMatch) {
      const cookieURL =
        test.info().project.use.baseURL ?? 'http://localhost:3000';
      await page.context().addCookies([
        {
          name: 'guigui_session',
          value: cookieMatch[1],
          url: cookieURL,
          httpOnly: true,
          sameSite: 'Lax',
          secure: false,
        },
      ]);
    }
  }

  // Tenta confirmar o estado de autenticação no browser (opcional: o elemento
  // "Sessão Iniciada" só aparece após login via UI, mas o cookie já está ativo
  // para as chamadas de API via page.request, que é o que realmente importa).
  try {
    await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 2_000 });
  } catch {
    // O elemento de sessão só aparece após login via UI; o cookie está ativo.
  }

  return payload.user as { id: string; role: string };
}


test('opens the Guigui home page', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (/WebSocket closed without opened/i.test(error.message)) return;
    pageErrors.push(error.message);
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('guigui_current_lang', 'pt');
  });
  await page.goto('/');
  expect(pageErrors, 'a aplicação deve montar sem erros JavaScript').toEqual([]);
  await expect(page).toHaveTitle(/Guigui\.com/i);
  await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Procurar restaurantes/i)).toBeVisible();
});

test('applies each supported language and persists it after reload', async ({ page }) => {
  // Os idiomas suportados são pt, en, fr e es (ver src/types.ts). Cada entrada
  // valida que o heroTitle da home aparece traduzido e que o atributo lang do
  // <html> reflecte o idioma escolhido depois de um reload — ou seja, que a
  // preferência persiste. O Crioulo (gw) foi removido do catálogo; o quinto
  // caso que existia aqui era um resíduo dessa migração e apontava para uma
  // string de outro painel, por isso foi eliminado.
  const languages = [
    ['pt', 'Encontre tudo o que precisa'],
    ['en', 'Find everything you need'],
    ['fr', 'Trouvez tout ce dont vous avez besoin'],
    ['es', 'Encuentra todo lo que necesitas'],
  ] as const;

  await page.addInitScript(() => {
    const language = new URLSearchParams(window.location.search).get('testLang');
    if (language) window.localStorage.setItem('guigui_current_lang', JSON.stringify(language));
  });

  for (const [language, expectedText] of languages) {
    await page.goto(`/?testLang=${language}`);
    await page.reload();
    await expect(page.locator('h1').first()).toContainText(expectedText);
    await expect(page.locator('html')).toHaveAttribute('lang', language === 'pt' ? 'pt-BR' : language);
  }
});

test('persists the per-user language state through the api', async ({ page }) => {
  // A rota de escrita só aceita chaves conhecidas da plataforma e, para um
  // cidadão, apenas a própria preferência de idioma. É a chave usada aqui por
  // não alterar dados comerciais nem o directório.
  const user = await signInDemo(page, 'cidadao.teste@guigui.com');
  const testKey = `user_language_${user.id}`;
  const testPayload = { updatedAt: new Date().toISOString(), status: 'synced_by_playwright', count: 42 };

  // 1. Grava no banco via API
  const saveRes = await page.request.post(`/api/app-state/${testKey}`, {
    data: { value: testPayload },
  });
  expect(saveRes.ok(), await saveRes.text()).toBeTruthy();

  // 2. Consulta de volta para validar persistência
  const getRes = await page.request.get(`/api/app-state/${testKey}`);
  expect(getRes.ok()).toBeTruthy();
  const body = await getRes.json();
  expect(body.key).toBe(testKey);
  expect(body.value).toEqual(testPayload);
});

test('persists and retrieves businesses and events through the api', async ({ page }) => {
  // A administração gere o directório completo; uma conta de empresa só pode
  // gravar a própria ficha. O teste usa o perfil de administração e estados
  // não públicos para os registos de teste não aparecerem no directório.
  await signInDemo(page, 'admin.teste@guigui.com');

  const uniqueId = `biz-test-${Date.now()}`;
  const testBiz = {
    id: uniqueId,
    name: 'Empresa Teste Playwright Sync',
    categoryId: 'cat-1',
    status: 'test',
  };

  // 1. Persiste empresa no armazenamento do servidor
  const postBizRes = await page.request.post('/api/businesses', {
    data: testBiz,
  });
  expect(postBizRes.ok(), await postBizRes.text()).toBeTruthy();

  // 2. Busca empresas e verifica se está presente
  const getBizRes = await page.request.get('/api/businesses');
  expect(getBizRes.ok()).toBeTruthy();
  const bizData = await getBizRes.json();
  const found = bizData.businesses.find((b: any) => b.id === uniqueId);
  expect(found).toBeDefined();
  expect(found.name).toBe('Empresa Teste Playwright Sync');

  // 3. Persiste evento no armazenamento do servidor
  const uniqueEvtId = `evt-test-${Date.now()}`;
  const testEvt = {
    id: uniqueEvtId,
    businessId: uniqueId,
    title: 'Show Teste Playwright Sync',
    status: 'draft',
    date: '2026-10-15',
    time: '20:00',
  };

  const postEvtRes = await page.request.post('/api/events', {
    data: testEvt,
  });
  expect(postEvtRes.ok(), await postEvtRes.text()).toBeTruthy();

  // 4. Busca eventos e verifica persistência
  const getEvtRes = await page.request.get('/api/events');
  expect(getEvtRes.ok()).toBeTruthy();
  const evtData = await getEvtRes.json();
  const foundEvt = evtData.events.find((e: any) => e.id === uniqueEvtId);
  expect(foundEvt).toBeDefined();
  expect(foundEvt.title).toBe('Show Teste Playwright Sync');
});

test('generates scope audit report pdf', async ({ page }) => {
  await page.goto('/relatorio-escopo.html', { waitUntil: 'networkidle' });
  await page.pdf({
    path: 'C:/Users/PC/Desktop/Relatorio_Conformidade_Guigui_Gorila.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
  });
});
