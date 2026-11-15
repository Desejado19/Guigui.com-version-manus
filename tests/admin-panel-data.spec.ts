import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui2026!';

// Login via API + injecao da sessao no localStorage (o App.tsx le
// guigui_current_user); substitui o fluxo multi-passo do modal, fragil.
async function loginAdmin(page: Page, { retries = 3, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const login = await page.request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const payload = await login.json().catch(() => ({}));
    if (login.ok()) {
      // Injeta cookie de sessão para chamadas API subsequentes
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
      }, payload.user);
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2500);
      return;
    }
    const code = (payload as { code?: string }).code;
    if (code !== 'RATE_LIMITED' || attempt === retries) {
      expect(login.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
    }
    await page.waitForTimeout(baseDelayMs * (attempt + 1));
  }
  // fallback (unreachable unless all retries exhausted on non-rate-limit error)
  const fallback = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const fallbackPayload = await fallback.json().catch(() => ({}));
  const setCookie = fallback.headers()['set-cookie'];
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
  }, fallbackPayload.user);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
}

test.describe('Admin painel com dados reais', () => {
  test('overview mostra numeros reais do banco', async ({ page }) => {
    await loginAdmin(page);

    const stats = await page.request.get('/api/admin/stats');
    expect(stats.ok()).toBeTruthy();
    const body = await stats.json();

    const ui = await page.locator('body').innerText();
    // Os KPIs reais agregados do PostgreSQL aparecem na UI.
    expect(ui).toContain(String(body.users.total));
    expect(ui).toContain(String(body.companies.total));
    expect(ui).not.toContain('25.430');
    expect(ui).not.toContain('25,430');
    await page.screenshot({ path: 'test-results/admin-overview-real.png', fullPage: true });
  });

  test('aba Utilizadores lista contas do banco', async ({ page }) => {
    await loginAdmin(page);
    const usersTab = page.getByRole('button', { name: /utilizadores/i }).first();
    await expect(usersTab).toBeVisible({ timeout: 15000 });
    await usersTab.click();
    await expect(page.getByRole('heading', { name: 'Utilizadores', exact: true }).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /^Todas as contas/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Visão geral de utilizadores' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/todas as contas da plataforma num único local/i)).toBeVisible();
    await page.getByPlaceholder(/pesquisar por nome/i).fill('seed01');
    await page.waitForTimeout(900);
    await expect(page.getByText('empresa.seed01@guigui.test').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/admin-users-real.png', fullPage: true });
  });
});
