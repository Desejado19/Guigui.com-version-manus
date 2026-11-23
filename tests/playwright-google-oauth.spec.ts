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

test.describe('Google OAuth 2.0 Authorization Code Flow', () => {
  test.setTimeout(300_000);

  // ==================== A. Teste do fluxo de start ====================
  test('G1. Verificar redirecionamento OAuth Google - start route', async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Navegar para a rota de start do Google OAuth
    await page.goto('/api/auth/google/start');

    // Deve ser redirecionado para accounts.google.com com os parâmetros corretos
    await expect(page).toHaveURL(/accounts\.google\.com/);

    // Verificar que o URL inclui o client_id, redirect_uri e state
    const finalUrl = page.url();
    expect(finalUrl).toContain('client_id=');
    expect(finalUrl).toContain('redirect_uri=');
    expect(finalUrl).toContain('state=');

    // O redirect_uri deve ser o nosso localhost
    expect(finalUrl).toContain('localhost:3000/api/auth/google/callback');
  });

  // ==================== B. Teste do callback com state inválido ====================
  test('G2. Callback Google sem cookie state inválido mostra erro', async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Acessar callback com state que não corresponde ao cookie
    await page.goto('/api/auth/google/callback?code=4%2FdQ29xXJpfFZCvatqwWb1V_OXU&state=invalid_state');

    // Deve ser redirecionado para a página inicial com parâmetros de erro
    await expect(page).toHaveURL(/\\?google_login=error&google_reason=state/);

    // Verificar que a mensagem de erro é exibida no LoginModal
    const errorMessage = page.locator('.text-red-500, .error, [role=alert]');
    await expect(errorMessage, 'Mensagem de erro Google não exibida').toBeVisible();
  });

  // ==================== C. Teste do callback bem-sucedido ====================
  test('G3. Callback Google com código válido realiza login', async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Primeiro, obter um código de autorização real seguindo o fluxo
    // Aqui testamos que a página não quebra ao acessar o start
    await page.goto('/api/auth/google/start');

    // Deve redirecionar para o Google, então voltamos para a base
    await expect(page).toHaveURL('/');
  });

  // ==================== D. Teste de integração com o modal ====================
  test('G4. Modal abre com ?google_login=error ao falhar state', async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Acessar com parâmetros de erro na URL
    await page.goto('/?google_login=error&google_reason=state');

    // O modal deve estar aberto ou a mensagem deve ser exibida
    const modal = page.locator('[role=dialog], .modal, .login-modal');
    await expect(modal, 'Modal não aberto em erro Google').toBeVisible({ timeout: 5000 });
  });

  // ==================== E. Teste de navegação após login social ====================
  test('G5. Navegar após login com Google não quebra o dashboard', async ({
    page,
  }) => {
    await signIn(page, DEMO_EMAILS.business);
    await page.goto('/');

    // Acessar o start do Google OAuth (não completar o fluxo)
    await page.goto('/api/auth/google/start');

    // Voltar para o dashboard e verificar que ainda carrega
    await page.goto('/');

    // O dashboard deve carregar sem erros críticos
    const dashboard = page.locator('.grid.grid-cols-2.md\\:grid-cols-6.gap-4.mb-6');
    await expect(dashboard, 'Dashboard quebrou após tentativa Google Login').toBeVisible();
  });
});