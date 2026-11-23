import { expect, request as apiRequest, test, type APIRequestContext, type Page } from './fixtures';

/**
 * JORNADA COMPLETA DO UTILIZADOR — óptica de quem usa a plataforma.
 *
 * Percurso real de um utilizador do Guigui.com: chega à home, pesquisa,
 * abre a ficha de uma empresa, contacta por WhatsApp; o cidadão inicia
 * sessão pela interface e usa a área pessoal; o comerciante gere o painel
 * da empresa; a administração abre o painel de governação.
 *
 * Autenticação: login via API + injeção de cookie de sessão (sem flag
 * Secure, porque os testes correm em HTTP) + sessão no localStorage — o
 * mesmo padrão robusto de dark-theme.spec.ts / visual-dashboards.spec.ts.
 * O login UI completo (modal "Entrar") é validado à parte no teste do
 * cidadão, porque é o fluxo que um visitante realmente percorre.
 */

const DEMO_PASSWORD = 'Guigui@2026!';
const ACCOUNTS = {
  citizen: 'cidadao.teste@guigui.com',
  business: 'empresa.teste@guigui.com',
  admin: 'admin.teste@guigui.com',
} as const;

type Role = keyof typeof ACCOUNTS;
const ENTRY_LABELS: Record<Role, string> = {
  citizen: 'A minha área pessoal',
  business: 'Área da Minha Empresa',
  admin: 'Administração Guigui.com',
};

async function signIn(page: Page, role: Role, { retries = 3, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const login = await page.request.post('/api/auth/login', {
      data: { email: ACCOUNTS[role], password: DEMO_PASSWORD },
    });
    const payload = await login.json().catch(() => ({}));
    if (login.ok()) {
      const user = payload.user as { id: string };
      const setCookie = login.headers()['set-cookie'];
      if (setCookie) {
        const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
        const cookieMatch = cookieString.match(/guigui_session=([^;]+)/);
        if (cookieMatch) {
          const cookieURL = test.info().project.use.baseURL ?? 'http://localhost:3000';
          await page.context().addCookies([{
            name: 'guigui_session',
            value: cookieMatch[1],
            url: cookieURL,
            httpOnly: true,
            sameSite: 'Lax',
            secure: false,
          }]);
        }
      }
      await page.addInitScript((account) => {
        window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
        window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      }, user);
      return;
    }
    const code = (payload as { code?: string }).code;
    if (code !== 'RATE_LIMITED' || attempt === retries) {
      expect(login.ok(), `login falhou para ${role}: ${JSON.stringify(payload)}`).toBeTruthy();
    }
    await page.waitForTimeout(baseDelayMs * (attempt + 1));
  }
}

async function openRoleDashboard(page: Page, role: Role) {
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 20_000 });
  await page.getByTitle('Sessão Iniciada').click();
  const entry = page.locator('button').filter({ hasText: ENTRY_LABELS[role] }).first();
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await entry.click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 20_000 });
}


test.describe('jornada do visitante: descobrir e contactar empresas', () => {
  test.setTimeout(180_000);

  test('pesquisa da home abre a ficha da empresa certa', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('guigui_current_lang', 'pt');
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible({ timeout: 20_000 });
    // A pesquisa resolve contra as empresas já carregadas. Passar pelo
    // directório garante que esse estado existe antes de submeter a pesquisa.
    await page.getByRole('button', { name: /Diretório de Empresas/i }).first().click();
    await expect(page.getByText('Cantina Sabores de Bandim').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Feed Bissau/i }).first().click();
    await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible({ timeout: 20_000 });

    // Pesquisar "Coqueiros" deve encontrar "Restaurante Coqueiros" e abrir a
    // ficha (BusinessDetailModal) — o comportamento real da pesquisa unificada.
    const search = page.getByPlaceholder(/Procurar restaurantes/i).first();
    await search.fill('Coqueiros');
    await search.press('Enter');

    const modal = page.locator('div.fixed.inset-0.z-50').first();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal).toContainText(/Restaurante Coqueiros/i);
    // A ficha expõe canais de contacto directo: telefone e mensagem interna.
    await expect(modal.locator('a[href^="tel:"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByRole('button', { name: /Mensagem dentro do sistema/i })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'test-results/journey-ficha-pesquisa.png', fullPage: false });
  });

  test('directório filtra por categoria Restauração e Bebidas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await openCleanDirectory(page);

    // As categorias vivem dentro do menu "Todas as Categorias".
    const categoryMenu = page.getByRole('button', { name: /Filtrar por categoria/i });
    await expect(categoryMenu).toBeVisible({ timeout: 10_000 });
    await categoryMenu.click();
    const restaurantFilter = page.getByRole('option', { name: 'Restauração e Bebidas' });
    await expect(restaurantFilter).toBeVisible({ timeout: 10_000 });
    await restaurantFilter.click();
    await page.waitForTimeout(1500);

    // Uma empresa seed de restaurantes aparece sob o filtro da categoria.
    await expect(page.getByText('Cantina Sabores de Bandim').first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'test-results/journey-categoria-restaurantes.png', fullPage: false });

    // "Todas as Categorias" dentro do menu limpa o filtro e devolve o directório completo.
    const allCategories = page.getByRole('button', { name: /Filtrar por categoria/i });
    await expect(allCategories).toBeVisible({ timeout: 10_000 });
    await allCategories.click();
    await page.getByRole('option', { name: 'Todas as Categorias' }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText('Restaurante Coqueiros').first()).toBeVisible({ timeout: 15_000 });
  });

  test('ficha de empresa mostra contacto WhatsApp e fecha com Escape', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await openCleanDirectory(page);

    // A ficha só mostra o botão de WhatsApp quando a empresa tem número
    // configurado; a Cantina seed tem (Restaurante Coqueiros não tem).
    await page.getByText('Cantina Sabores de Bandim').first().click();
    const modal = page.locator('div.fixed.inset-0.z-50').first();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal).toContainText(/Cantina Sabores de Bandim/i);
    await expect(modal.locator('a[href*="wa.me"]').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'test-results/journey-ficha-directorio.png', fullPage: false });

    // Escape fecha a ficha (overlay transitório do App.tsx).
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden({ timeout: 10_000 });
  });
});

test.describe('jornada do cidadão', () => {
  test.setTimeout(180_000);

  test('login pela interface abre a área pessoal e não expõe segredos', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('guigui_current_lang', 'pt');
    });
    await page.goto('/');

    // Fluxo real: botão "Entrar" → modal de login → credenciais → sessão.
    const loginButton = page.locator('button:has-text("Entrar"), a:has-text("Entrar")').first();
    await expect(loginButton).toBeVisible({ timeout: 15_000 });
    await loginButton.click();

    // O modal abre diretamente no formulário de credenciais.
    const email = page.locator('input[type="email"]').first();
    await expect(email).toBeVisible({ timeout: 10_000 });
    await email.fill(ACCOUNTS.citizen);
    await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
    await page.locator('button[type="submit"]').first().click();

    // Sessão iniciada → entra na área pessoal pelo menu de sessão.
    await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
    await openRoleDashboard(page, 'citizen');
    const dashboard = page.locator('.guigui-profile-dashboard');
    await expect(dashboard).toContainText(/Malam Bacar|Área pessoal/i);

    // Segurança: a sessão guardada no browser nunca contém credenciais.
    const storedSession = await page.evaluate(() => window.localStorage.getItem('guigui_current_user') || '');
    expect(storedSession).not.toMatch(/password/i);
    await page.screenshot({ path: 'test-results/journey-cidadao-area-pessoal.png', fullPage: false });
  });

  test('sessão do cidadão persiste depois de recarregar a página', async ({ page }) => {
    await signIn(page, 'citizen');
    await page.goto('/');
    await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 20_000 });
    await openRoleDashboard(page, 'citizen');
    await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 20_000 });
  });

  test('mensagem enviada a uma empresa chega à caixa de entrada dela', async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string;
    const citizenContext: APIRequestContext = await apiRequest.newContext({ baseURL });
    const businessContext: APIRequestContext = await apiRequest.newContext({ baseURL });
    try {
      const citizenLogin = await citizenContext.post('/api/auth/login', {
        data: { email: ACCOUNTS.citizen, password: DEMO_PASSWORD },
      });
      expect(citizenLogin.ok(), await citizenLogin.text()).toBeTruthy();

      const subject = `Jornada utilizador ${Date.now()}`;
      const created = await citizenContext.post('/api/conversations', {
        data: { businessId: 'biz-1', subject, text: 'Olá! Tenho interesse em saber mais sobre os vossos serviços.' },
      });
      expect(created.ok(), `criar conversa falhou: ${await created.text()}`).toBeTruthy();

      const businessLogin = await businessContext.post('/api/auth/login', {
        data: { email: ACCOUNTS.business, password: DEMO_PASSWORD },
      });
      expect(businessLogin.ok(), await businessLogin.text()).toBeTruthy();

      // A API devolve as colunas em snake_case: { conversations: rows, messages: rows }.
      const inbox = await businessContext.get('/api/conversations');
      expect(inbox.ok()).toBeTruthy();
      const body = await inbox.json();
      const conversation = (body.conversations as Array<{ id: string; subject: string; business_id: string }>)
        .find((item) => item.subject === subject);
      expect(conversation, `conversa "${subject}" não apareceu na caixa de entrada da empresa`).toBeTruthy();
      expect(conversation?.business_id).toBe('biz-1');
      const messages = (body.messages as Array<{ conversation_id: string; text: string }>)
        .filter((message) => message.conversation_id === conversation?.id);
      expect(messages.length, 'a conversa criada não tem mensagens registadas').toBeGreaterThan(0);
    } finally {
      await citizenContext.dispose();
      await businessContext.dispose();
    }
  });
});

test.describe('jornada do comerciante e da administração', () => {
  test.setTimeout(240_000);

  test('empresário: painel abre com o nome da própria empresa', async ({ page }) => {
    await signIn(page, 'business');
    await page.goto('/');
    await openRoleDashboard(page, 'business');

    const dashboard = page.locator('.guigui-profile-dashboard');
    await expect(dashboard).toContainText(/GUIGUI\.COM \/ COMERCIANTE/i);
    await expect(dashboard).toContainText(/Restaurante Coqueiros - Bissau Velho/i);
    await page.screenshot({ path: 'test-results/journey-empresa-painel.png', fullPage: false });
  });

  test('empresário: percorre as secções do painel sem erros', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      const message = String(error);
      // O cliente HMR do Vite tenta abrir um WebSocket mesmo com ws desligado em
      // middleware mode — ruído exclusivo do dev server, não da aplicação.
      if (/WebSocket closed without opened/i.test(message)) return;
      pageErrors.push(message);
    });

    await signIn(page, 'business');
    await page.goto('/');
    await openRoleDashboard(page, 'business');

    // Percorre todas as secções laterais — cada uma deve renderizar conteúdo.
    const dashboard = page.locator('.guigui-profile-dashboard');
    const buttons = dashboard.locator('aside button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (!(await button.isVisible().catch(() => false))) continue;
      await button.click().catch(() => undefined);
      await page.waitForTimeout(250);
      const text = (await dashboard.innerText().catch(() => '')).trim();
      expect(text.length, `secção ${index} do painel do comerciante renderizou vazio`).toBeGreaterThan(20);
    }
    expect(pageErrors, `erros JS no painel do comerciante: ${pageErrors.join(' | ')}`).toEqual([]);
    await page.screenshot({ path: 'test-results/journey-empresa-secacoes.png', fullPage: false });
  });

  test('admin: painel de governação abre na Visão Geral', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/');
    await openRoleDashboard(page, 'admin');

    const dashboard = page.locator('.guigui-profile-dashboard');
    await expect(dashboard).toContainText(/Visão Geral/i, { timeout: 20_000 });
    await page.screenshot({ path: 'test-results/journey-admin-visao-geral.png', fullPage: false });
  });
});

/** Abre o directório pela home e limpa filtros residuais. */
async function openCleanDirectory(page: Page) {
  const dirButton = page.locator('button:has-text("Business Directory")').first();
  await expect(dirButton).toBeVisible({ timeout: 15_000 });
  await dirButton.click();
  await page.waitForTimeout(1500);
  const clearButton = page.locator('button:has-text("Limpar Todos os Filtros")').first();
  if (await clearButton.count()) await clearButton.click();
  await page.waitForTimeout(1500);
}
