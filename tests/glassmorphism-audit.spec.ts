import { expect, test, type Page } from './fixtures';

/**
 * Auditoria de glassmorphism.
 *
 * Não valida apenas os ficheiros CSS: percorre a interface renderizada e falha
 * se qualquer elemento visível tiver backdrop-filter, blur ou nomenclatura
 * glass/frosted. Também confirma que as superfícies flutuantes principais têm
 * fundo opaco, para evitar que o efeito regresse através de classes utilitárias.
 */

const PASSWORD = 'Guigui@2026!';
const ACCOUNTS = {
  citizen: 'cidadao.teste@guigui.com',
  business: 'empresa.teste@guigui.com',
  admin: 'admin.teste@guigui.com',
} as const;

async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password: PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

async function glassIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    for (const element of Array.from(document.querySelectorAll('body *'))) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const className = typeof element.className === 'string' ? element.className : '';
      const identity = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`;
      const backdrop = style.getPropertyValue('backdrop-filter')
        || style.getPropertyValue('-webkit-backdrop-filter');

      if (backdrop && backdrop !== 'none') {
        issues.push(`${identity} usa backdrop-filter: ${backdrop}`);
      }
      if (style.filter && style.filter !== 'none' && /blur\(/i.test(style.filter)) {
        issues.push(`${identity} usa filter: ${style.filter}`);
      }
      if (/\b(glass|glassmorphism|frosted)\b/i.test(className)) {
        issues.push(`${identity} usa classe de vidro: ${className}`);
      }
    }
    return issues;
  });
}

async function expectOpaque(page: Page, selector: string) {
  const surface = page.locator(selector).first();
  await expect(surface).toBeVisible();
  const background = await surface.evaluate((element) => window.getComputedStyle(element).backgroundColor);
  expect(background, `${selector} deve ter fundo opaco, mas tem ${background}`).toMatch(/^rgb\(/);
  await expect(surface).toHaveCSS('backdrop-filter', 'none');
}

async function openDashboard(page: Page, role: keyof typeof ACCOUNTS) {
  await signIn(page, ACCOUNTS[role]);
  await page.goto('/');
  if (role === 'citizen') {
    await page.getByTitle('Sessão Iniciada').click();
    await page.getByText('A minha área pessoal', { exact: true }).first().click();
  }
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(300);
}

test.describe('Auditoria visual: remoção de glassmorphism', () => {
  test.setTimeout(180_000);

  test('site público não tem vidro nem superfícies translúcidas nos controlos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('.guigui-navbar')).toBeVisible({ timeout: 20_000 });

    expect(await glassIssues(page)).toEqual([]);
    await expectOpaque(page, '.guigui-navbar');

    const sponsoredLabel = page.locator('.guigui-sponsored-label').first();
    if (await sponsoredLabel.count()) {
      await expect(sponsoredLabel).toHaveCSS('backdrop-filter', 'none');
      const background = await sponsoredLabel.evaluate((element) => window.getComputedStyle(element).backgroundColor);
      expect(background).toMatch(/^rgb\(/);
    }
  });

  test('painel do cidadão não tem vidro', async ({ page }) => {
    await openDashboard(page, 'citizen');
    expect(await glassIssues(page)).toEqual([]);
  });

  test('painel da empresa não tem vidro', async ({ page }) => {
    await openDashboard(page, 'business');
    expect(await glassIssues(page)).toEqual([]);
  });

  test('painel do Super Admin não tem vidro', async ({ page }) => {
    await openDashboard(page, 'admin');
    expect(await glassIssues(page)).toEqual([]);
  });

  test('barra inferior mobile é sólida e não tem vidro', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const nav = page.getByTestId('citizen-bottom-nav');
    await expect(nav).toBeVisible({ timeout: 20_000 });

    expect(await glassIssues(page)).toEqual([]);
    await expectOpaque(page, '.guigui-bottom-nav__surface');
  });
});
