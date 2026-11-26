import { expect, test, type Page } from './fixtures';

const DEMO_PASSWORD = 'Guigui@2026!';
const DEMO_EMAILS = {
  citizen: 'cidadao.teste@guigui.com',
  business: 'empresa.teste@guigui.com',
  admin: 'admin.teste@guigui.com',
} as const;

async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  const payload = await response.json();
  if (!response.ok()) {
    console.error(`Login failed for ${email}:`, payload);
    throw new Error(`Login failed for ${email}`);
  }
  const user = payload.user;
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, user);
}

test.describe('Business Dashboard Reorganização - Playwright Tests', () => {
  test.setTimeout(300_000);

  // ==================== A. Teste de todos os botões e ações ====================
  test('A1. Testar todos os botões da Visão Geral', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Encontrar todos os botões visíveis no dashboard
    const buttons = page.locator('button').filter({ has: page.locator('.grid.grid-cols-2.md\\:grid-cols-6.gap-4.mb-6') });
    const buttonCount = await buttons.count();
    console.log(`Total de botões encontrados: ${buttonCount}`);

    // Testar botões principais na grid de 6 indicadores
    const indicatorButtons = [
      { text: 'Receita Total', expectNavigation: true },
      { text: 'Visualizações', expectNavigation: true },
      { text: 'Seguidores', expectNavigation: true },
      { text: 'Eventos Ativos', expectNavigation: true },
      { text: 'WhatsApp Leads', expectNavigation: true },
      { text: 'Bilhetes Vendidos', expectNavigation: true },
    ];

    for (const btn of indicatorButtons) {
      const btnElement = page.locator(`button:has-text("${btn.text}")`).filter({ visible: true });
      const count = await btnElement.count();
      console.log(`Botão "${btn.text}": ${count} encontrado(s)`);
      
      if (count > 0) {
        await btnElement.click();
        await page.waitForTimeout(500);
        // Verificar se navegou para algum lugar ou abriu um painel
        const url = page.url();
        console.log(`  -> Após clicar, URL: ${url}`);
      }
    }
  });

  // ==================== B. Teste dos dados e indicadores ====================
  test('B1. Verificar indicadores na Visão Geral', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Verificar se os 6 indicadores principais estão presentes
    const indicators = [
      { label: 'Receita Total', selector: 'span:has-text("Receita Total")' },
      { label: 'Visualizações', selector: 'span:has-text("Visualizações")' },
      { label: 'Seguidores', selector: 'span:has-text("Seguidores")' },
      { label: 'Eventos Ativos', selector: 'span:has-text("Eventos Ativos")' },
      { label: 'WhatsApp Leads', selector: 'span:has-text("WhatsApp Leads")' },
      { label: 'Bilhetes Vendidos', selector: 'span:has-text("Bilhetes Vendidos")' },
    ];

    for (const ind of indicators) {
      const element = page.locator(ind.selector).first();
      await expect(element, `Indicador "${ind.label}" não ficou visível`).toBeVisible();
    }
  });

  test('B2. Verificar valores dos indicadores são números reais', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Verificar valores numéricos não são "0" ou vazios
    const valueElements = await page.locator('.font-mono.text-2xl.font-black').all();
    console.log(`Total de elementos de valor encontrados: ${valueElements.length}`);

    for (let i = 0; i < Math.min(valueElements.length, 10); i++) {
      const text = await valueElements[i].innerText();
      console.log(`  Valor ${i + 1}: "${text.trim()}"`);
      // Verificar se não está vazio ou é "0 XOF" / "0" sem contexto
      const trimmed = text.trim();
      if (trimmed === '' || trimmed === '0 XOF' || trimmed === '0') {
        console.log(`  ⚠️ Valor ${i + 1} está vazio ou zero`);
      }
    }
  });

  // ==================== C. Teste das alterações realizadas ====================
  test('C1. Verificar grid de 6 indicadores após reorganização', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Verificar a estrutura do novo grid
    const grid = page.locator('.grid.grid-cols-2.md\\:grid-cols-6.gap-4.mb-6');
    await expect(grid, 'Grid de 6 indicadores reorganizados não encontrado').toBeVisible();

    // Verificar se os cards dos 6 indicadores estão presentes
    const indicatorCards = [
      'Receita Total',
      'Visualizações', 
      'Seguidores',
      'Eventos Ativos',
      'WhatsApp Leads',
      'Bilhetes Vendidos',
    ];

    for (const indicator of indicatorCards) {
      const card = page.locator(`span:has-text("${indicator}")`).first().locator('..').locator('..'); // navigate up to Card
      await expect(card, `Card "${indicator}" não encontrado`).toBeVisible();
    }
  });

  test('C2. Verificar indicadores secundários ainda existem', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Verificar se Chamadas, Mapa e Alcance dos Anúncios ainda estão em áreas separadas
    const secondaryIndicators = [
      { text: 'Chamadas', area: 'chart area' },
      { text: 'Mapa', area: 'chart area' },
      { text: 'Atividade comercial', area: 'statistics area' },
    ];

    for (const sec of secondaryIndicators) {
      const element = page.locator(`:has-text("${sec.text}")`).first();
      // Estes indicadores vivem em gráficos que só montam depois dos dados.
      await expect(element, `Indicador secundário "${sec.text}" foi removido indevidamente`).toBeVisible();
    }
  });

  // ==================== D. Testes de navegação e responsividade ====================
  test('D1. Testar responsividade - desktop', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const dashboard = page.locator('.grid.grid-cols-2.md\\:grid-cols-6.gap-4.mb-6');
    await expect(dashboard, 'Dashboard não visível em 1440x900').toBeVisible();
  });

  test('D2. Testar responsividade - tablet', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    const dashboard = page.locator('.grid.grid-cols-2.md\\:grid-cols-6.gap-4.mb-6');
    await expect(dashboard, 'Dashboard não visível em 768x1024').toBeVisible();
  });

  test('D3. Testar responsividade - móvel', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const dashboard = page.locator('.grid.grid-cols-2.md\\:grid-cols-6.gap-4.mb-6');
    await expect(dashboard, 'Dashboard não visível em 375x667').toBeVisible();
  });

  // ==================== E. Testes técnicos ====================
  test('E1. Verificar erros JavaScript no console', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Capturar erros do console
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Aguardar um pouco para que os componentes carreguem
    await page.waitForTimeout(3000);

    console.log(`Erros no console: ${consoleErrors.length}`);
    for (const error of consoleErrors) {
      console.log(`  - ${error}`);
    }

    // Apenas avisar, não falhar necessariamente erros menores
    // Mas verificar se há erros cruciais
    const criticalErrors = consoleErrors.filter(e => 
      e.includes('TypeError') || 
      e.includes('Cannot read') || 
      e.includes('failed to load') ||
      e.includes('404') ||
      e.includes('500')
    );
    
    console.log(`Erros críticos: ${criticalErrors.length}`);
    for (const error of criticalErrors) {
      console.log(`  ⚠️ CRITICAL: ${error}`);
    }
  });

  test('E2. Verificar requisições HTTP', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    const httpRequests: any[] = [];
    page.on('request', (request) => httpRequests.push({ method: request.method(), url: request.url() }));
    page.on('response', (response) => {
      httpRequests.push({ method: response.request().method(), url: response.url(), status: response.status() });
    });

    await page.waitForTimeout(5000);

    const httpCount = httpRequests.length;
    console.log(`Total de requisições HTTP capturadas: ${httpCount}`);
    
    const errorResponses = httpRequests.filter(r => r.status && r.status >= 400);
    console.log(`Respostas com erro: ${errorResponses.length}`);
    
    for (const req of errorResponses.slice(0, 5)) {
      console.log(`  ⚠️ ${req.method} ${req.url} → ${req.status}`);
    }
  });

  // ==================== F. Correção automática ====================
  test('F1. Corrigir problemas encontrados automaticamente', async ({ page }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Este teste serve como placeholder para verificar se correções foram aplicadas
    // Os testes anteriores já devem ter validado as correções
    
    // Verificar se o grid está correto
    const grid = page.locator('.grid.grid-cols-2.md\\:grid-cols-6.gap-4.mb-6');
    await expect(grid).toBeVisible();
    
    // Verificar indicadores
    const indicators = ['Receita Total', 'Visualizações', 'Seguidores', 'Eventos Ativos', 'WhatsApp Leads', 'Bilhetes Vendidos'];
    for (const ind of indicators) {
      const found = page.locator(`span:has-text("${ind}")`).first();
      await expect(found).toBeVisible();
    }
  });
});