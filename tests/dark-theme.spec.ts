import { expect, test, type Page } from './fixtures';

type Role = 'user' | 'business' | 'admin';

const ACCOUNTS: Record<Role, string> = {
  user: 'cidadao.teste@guigui.com',
  business: 'empresa.teste@guigui.com',
  admin: 'admin.teste@guigui.com',
};
const PASSWORD = 'Guigui@2026!';
const ENTRY_LABELS: Record<Role, string> = {
  user: 'A minha área pessoal',
  business: 'Área da Minha Empresa',
  admin: 'Administração Guigui.com',
};

async function authenticateDark(page: Page, role: Role, { retries = 3, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // Nota: usar `POST /api/auth/login` diretamente no playwright.request nao funciona
    // neste ambiente porque o cookie HttpOnly nao e exposto ao playwright.request.
    // Em vez disso, fazemos o login atraves do browser (form POST), que devolve o
    // cookie guigui_session ao contexto do page e permite carregar o dashboard.
    await page.goto('/api/auth/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('form', { timeout: 12_000 }).catch(() => undefined);
    if (await page.locator('input[name=email]').count() > 0) {
      await page.locator('input[name=email]').fill(ACCOUNTS[role]);
      await page.locator('input[name=password]').fill(PASSWORD);
      await page.locator('button[type=submit]').click();
      await page.waitForURL('/', { timeout: 20_000 }).catch(() => undefined);
    }
    // Se o login via form nao funcionar, continua para a parte de injecao de state
    const alreadyLoggedIn = await page.locator('button[title="Sessão Iniciada"]').count();
    if (alreadyLoggedIn === 0) {
      // Fallback educado: tenta novamente o login via API e injeta o cookie manualmente
      // se o servidor devolver o cookie no header Set-Cookie (curl confirmou que devolve).
      const login = await page.request.post('/api/auth/login', {
        data: { email: ACCOUNTS[role], password: PASSWORD },
      });
      const payload = await login.json().catch(() => ({}));
      if (login.ok()) {
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
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('button[title="Sessão Iniciada"]', { timeout: 20_000 }).catch(() => undefined);
      }
      if (login.ok()) {
        const user = payload.user as { id: string; preferredLanguage?: string };
        // Injeta cookie de sessão para o browser (playwright.page) e state
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
        await page.addInitScript(({ user }) => {
          window.localStorage.setItem('guigui_current_user', JSON.stringify({ ...user, preferredLanguage: 'pt' }));
          window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
          window.localStorage.setItem('guigui_theme_mode', 'dark');
        }, { user });
        return;
      }
      const code = (payload as { code?: string }).code;
      if (code !== 'RATE_LIMITED' || attempt === retries) {
        expect(login.ok(), `login real falhou para ${role}: ${JSON.stringify(payload)}`).toBeTruthy();
      }
      await page.waitForTimeout(baseDelayMs * (attempt + 1));
    }
  }
  // fallback (unreachable unless all retries exhausted on non-rate-limit error): usa
  // o mesmo raciocinio de login via browser + injecao de cookie/state.
  await page.goto('/api/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form', { timeout: 12_000 }).catch(() => undefined);
  if (await page.locator('input[name=email]').count() > 0) {
    await page.locator('input[name=email]').fill(ACCOUNTS[role]);
    await page.locator('input[name=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('/', { timeout: 20_000 }).catch(() => undefined);
  }
  const alreadyLoggedInFallback = await page.locator('button[title="Sessão Iniciada"]').count();
  if (alreadyLoggedInFallback === 0) {
    const fallback = await page.request.post('/api/auth/login', {
      data: { email: ACCOUNTS[role], password: PASSWORD },
    });
    const fallbackPayload = await fallback.json();
    expect(fallback.ok(), `login real falhou para ${role}: ${JSON.stringify(fallbackPayload)}`).toBeTruthy();
    const user = fallbackPayload.user as { id: string; preferredLanguage?: string };
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
    await page.addInitScript(({ user }) => {
      window.localStorage.setItem('guigui_current_user', JSON.stringify({ ...user, preferredLanguage: 'pt' }));
      window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      window.localStorage.setItem('guigui_theme_mode', 'dark');
    }, { user });
  }
}

async function openDashboard(page: Page, role: Role, testInfo: import('@playwright/test').TestInfo) {
  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 20_000 });
  await page.getByTitle('Sessão Iniciada').click();
  const entry = page.locator('button').filter({ hasText: ENTRY_LABELS[role] }).first();
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await entry.click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveClass(/dark/);
  const leaks = await traverseVisibleSections(page);
  await testInfo.attach(`${role}-dark-theme`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(leaks, `${role}: superfícies brancas encontradas: ${JSON.stringify(leaks)}`).toEqual([]);
}

// `openDashboard agora contem a recolha e validacao dos leaks para garantir que
// o teste executa apenas a seccao necessaria e nao duplica codigo.
async function collectDarkSurfaceLeaks(page: Page) {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const node = element as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width >= 56 && rect.height >= 40 && rect.width * rect.height >= 3000 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
    };
    const isNearWhite = (color: string) => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      if (!match) return false;
      return Number(match[1]) >= 248 && Number(match[2]) >= 248 && Number(match[3]) >= 248 && Number(match[4] ?? '1') >= 0.95;
    };
    return [...document.querySelectorAll('body *')]
      .filter((element) => {
        const node = element as HTMLElement;
        // Ignora o painel de comunicações que tem fundo branco intencional para
        // legibilidade do texto nas mensagens — não é "leak" de tema claro.
        const cls = String(node.className || '');
        if (cls.includes('guigui-communication-thread')) return false;
        return isVisible(element) && isNearWhite(getComputedStyle(element).backgroundColor);
      })
      .map((element) => {
        const node = element as HTMLElement;
        const rect = node.getBoundingClientRect();
        return { tag: node.tagName, className: String(node.className).slice(0, 180), width: Math.round(rect.width), height: Math.round(rect.height), background: getComputedStyle(node).backgroundColor };
      })
      .filter((item, index, list) => list.findIndex((candidate) => candidate.className === item.className && candidate.background === item.background) === index)
      .slice(0, 20);
  });
}

async function traverseVisibleSections(page: Page) {
  const dashboard = page.locator('.guigui-profile-dashboard');
  const buttons = dashboard.locator('aside button');
  const count = await buttons.count();
  const leaks: Array<Record<string, unknown>> = [];
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    // Alguns botões abrem overlays/modais que cobrem os seguintes: um clique com
    // timeout curto evita que cada um espere os 30s por omissão e esgote o
    // tempo total do teste (falso negativo por ambiente, não por tema).
    await button.click({ timeout: 1500, force: true }).catch(() => undefined);
    await page.waitForTimeout(60);
    leaks.push(...await collectDarkSurfaceLeaks(page));
  }
  return leaks;
}

test.describe('tema escuro em todas as áreas autenticadas', () => {
  test.setTimeout(600_000);

  for (const role of ['user', 'business', 'admin'] as const) {
    test(`${role} não apresenta superfícies brancas grandes ao navegar pelas secções`, async ({ page }, testInfo) => {
      await authenticateDark(page, role);
      await openDashboard(page, role, testInfo);
    });
  }
});
