import { expect, test, type Page } from '@playwright/test';

type Language = 'pt' | 'en' | 'fr' | 'es';
type Role = 'user' | 'business' | 'admin';

const LANGUAGES: Language[] = ['pt', 'en', 'fr', 'es'];
const ACCOUNTS: Record<Role, string> = {
  user: 'cidadao.teste@guigui.com',
  business: 'empresa.teste@guigui.com',
  admin: 'admin.teste@guigui.com',
};
const PASSWORD = 'Guigui@2026!';
const HEADINGS: Record<Role, string[]> = {
  // O banner RoleWorkspaceHeader (titulo "A minha experiencia Guigui" / "Centro
  // de governacao") foi removido dos tres paineis. Os titulos validados passam
  // a ser conteudo presente no topo de cada painel: o cabecalho "Area pessoal"
  // (cidadao, renderizado em uppercase pelo CSS) e o h1 da seccao activa (admin,
  // via currentSectionTitle).
  user: ['Área pessoal', 'ÁREA PESSOAL', 'Personal area', 'PERSONAL AREA', 'Espace personnel', 'ESPACE PERSONNEL', 'Área personal', 'ÁREA PERSONAL'],
  business: ['GUIGUI.COM / COMERCIANTE', 'GUIGUI.COM / MERCHANT', 'GUIGUI.COM / COMMERÇANT', 'GUIGUI.COM / COMERCIANTE'],
  admin: ['Visão Geral', 'Overview', 'Vue d’ensemble', 'Vista General'],
};

async function authenticate(page: Page, role: Role, language: Language, { retries = 3, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const login = await page.request.post('/api/auth/login', { data: { email: ACCOUNTS[role], password: PASSWORD } });
    const payload = await login.json().catch(() => ({}));
    if (login.ok()) {
      const user = payload.user as { id: string; preferredLanguage?: Language };

      // Injeta o cookie de sessão no contexto do browser sem a flag Secure para que
      // page.request o envie automaticamente nas chamadas de API subsequentes.
      const setCookie = login.headers()['set-cookie'];
      if (setCookie) {
        const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
        const cookieMatch = cookieString.match(/guigui_session=([^;]+)/);
        if (cookieMatch) {
          const cookieURL = test.info().project.use.baseURL as string ?? 'http://localhost:3000';
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

      const preference = await page.request.post(`/api/app-state/user_language_${user.id}`, {
        data: { value: { language, updatedAt: new Date().toISOString() } },
      });
      expect(preference.ok(), `preferência real falhou para ${role}/${language}`).toBeTruthy();
      await page.addInitScript(({ user, language }) => {
        window.localStorage.setItem('guigui_current_user', JSON.stringify({ ...user, preferredLanguage: language }));
        window.localStorage.setItem('guigui_current_lang', JSON.stringify(language));
      }, { user, language });
      return;
    }
    const code = (payload as { code?: string }).code;
    if (code !== 'RATE_LIMITED' || attempt === retries) {
      expect(login.ok(), `login real falhou para ${role}: ${JSON.stringify(payload)}`).toBeTruthy();
    }
    await page.waitForTimeout(baseDelayMs * (attempt + 1));
  }
  // fallback (unreachable unless all retries exhausted on non-rate-limit error)
  const fallback = await page.request.post('/api/auth/login', { data: { email: ACCOUNTS[role], password: PASSWORD } });
  const fallbackPayload = await fallback.json().catch(() => ({}));
  const user = fallbackPayload.user as { id: string; preferredLanguage?: Language };
  const setCookie = fallback.headers()['set-cookie'];
  if (setCookie) {
    const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    const cookieMatch = cookieString.match(/guigui_session=([^;]+)/);
    if (cookieMatch) {
      const cookieURL = test.info().project.use.baseURL as string ?? 'http://localhost:3000';
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
  const preference = await page.request.post(`/api/app-state/user_language_${user.id}`, {
    data: { value: { language, updatedAt: new Date().toISOString() } },
  });
  expect(preference.ok(), `preferência real falhou para ${role}/${language}`).toBeTruthy();
  await page.addInitScript(({ user, language }) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify({ ...user, preferredLanguage: language }));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify(language));
  }, { user, language });
}

async function clickSessionEntry(page: Page, label: string) {
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 20_000 });
  await page.getByTitle('Sessão Iniciada').click();
  const entry = page.locator('button').filter({ hasText: label }).filter({ visible: true }).first();
  await expect(entry).toBeVisible({ timeout: 10_000 });
  await entry.click();
}

async function openRoleDashboard(page: Page, role: Role) {
  if (role === 'business') await clickSessionEntry(page, 'Área da Minha Empresa');
  if (role === 'admin') await clickSessionEntry(page, 'Administração Guigui.com');
  if (role === 'user') await clickSessionEntry(page, 'A minha área pessoal');
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 20_000 });
}

async function collectVisibleSections(page: Page) {
  const dashboard = page.locator('.guigui-profile-dashboard');
  const chunks = [await dashboard.innerText()];
  const buttons = dashboard.locator('aside button');
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click().catch(() => undefined);
    await page.waitForTimeout(150);
    chunks.push(await dashboard.innerText());
  }
  return chunks.join('\n');
}

test.describe('visual real dos dashboards por idioma', () => {
  test.setTimeout(600_000);

  for (const role of ['user', 'business', 'admin'] as const) {
    test(`${role}: User, Empresa e Admin em pt/en/fr/es`, async ({ browser }, testInfo) => {
      const missing: string[] = [];
      for (const language of LANGUAGES) {
        const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        try {
          await authenticate(page, role, language);
          await page.goto('/');
          await openRoleDashboard(page, role);
          const text = await collectVisibleSections(page);
          const headingFound = HEADINGS[role].some((heading) => text.includes(heading));
          if (!headingFound) missing.push(`[${role}/${language}] heading do painel não encontrado`);
          if (/Kriyol|Kriolu|Crioulo Guineense/i.test(text)) missing.push(`[${role}/${language}] referência ao idioma removido GW visível`);
          await testInfo.attach(`${role}-${language}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
        } finally {
          await context.close();
        }
      }
      expect(missing, missing.join('\n')).toEqual([]);
    });
  }
});
