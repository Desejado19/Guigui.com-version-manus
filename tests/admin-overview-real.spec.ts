import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui2026!';

async function signInAdmin(page: Page, { retries = 3, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await page.request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok()) {
      const user = payload.user;
      // Injecção da sessão no localStorage antes do primeiro render, como os restantes testes fazem.
      await page.addInitScript((account) => {
        window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
        window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      }, user);
      // Injecao do cookie de sessao para chamadas API subsequentes (ex.: /api/admin/stats).
      const setCookie = response.headers()['set-cookie'];
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
      return user as { id: string; role: string };
    }
    const code = (payload as { code?: string }).code;
    if (code !== 'RATE_LIMITED' || attempt === retries) {
      expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
    }
    await page.waitForTimeout(baseDelayMs * (attempt + 1));
  }
  // fallback (unreachable unless all retries exhausted on non-rate-limit error)
  const fallback = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const fallbackPayload = await fallback.json().catch(() => ({}));
  const user = fallbackPayload.user;
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, user);
  return user as { id: string; role: string };
}

test.describe('Painel Admin — dados reais do banco', () => {
  test('overview mostra numeros reais e aba Utilizadores lista contas', async ({ page }) => {
    await signInAdmin(page);
    await page.goto('/');

    // A visao geral do admin deve aparecer
    await expect(page.getByText('Visão Geral', { exact: false }).first()).toBeVisible({ timeout: 20000 });

    // Os KPIs reais devem aparecer — e NAO os numeros fabricados antigos.
    // Os totais sao lidos da API em tempo de execucao para que o teste nao
    // fique obsoleto quando a base de dados cresce (ex.: 112/78 -> 112/82).
    const stats = await page.request.get('/api/admin/stats');
    expect(stats.ok(), 'GET /api/admin/stats deve autenticar com a sessao injectada').toBeTruthy();
    const kpis = await stats.json() as { users: { total: number }; companies: { total: number } };
    const body = page.locator('body');
    await expect(body).toContainText(String(kpis.users.total), { timeout: 20000 });
    await expect(body).toContainText(String(kpis.companies.total), { timeout: 20000 });

    // Garantir que o numero fabricado antigo desapareceu
    await expect(body).not.toContainText('25.430');
    await expect(body).not.toContainText('3.820');

    // Navegar para a aba Utilizadores
    await page.getByRole('button', { name: /Utilizadores/i }).first().click();
    await expect(page.getByText('Utilizadores da plataforma')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 });
  });
});

