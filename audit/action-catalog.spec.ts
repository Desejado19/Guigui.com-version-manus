import { expect, test, type Page } from '../tests/fixtures';
import fs from 'node:fs';
import path from 'node:path';

const DEMO = {
  citizen: { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' },
  business: { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' },
  admin: { email: 'admin.teste@guigui.com', password: 'Guigui2026!' },
} as const;

const ENTRY_LABEL = {
  citizen: 'A minha área pessoal',
  business: 'Área da Minha Empresa',
  admin: 'Administração Guigui.com',
} as const;

type Role = keyof typeof ENTRY_LABEL;

const OUTPUT_DIR = path.resolve('audit-evidence/action-catalog');

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function loginApi(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account });
  const payload = await response.json().catch(() => ({} as any));
  expect(response.ok(), `login falhou para ${account.email}: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload.user as { id: string; role: string; name: string; email: string };
}

async function signIn(page: Page, role: Role) {
  const user = await loginApi(page, DEMO[role]);
  const setCookie = (await page.request.storageState()).cookies.find((cookie) => cookie.name === 'guigui_session');
  if (setCookie) {
    const base = test.info().project.use.baseURL ?? 'http://localhost:3100';
    await page.context().addCookies([
      { name: 'guigui_session', value: setCookie.value, url: base, httpOnly: true, sameSite: 'Lax', secure: false },
    ]);
  }
  await page.addInitScript((current: { user: object; role: string }) => {
    let stored: any = null;
    try { stored = JSON.parse(window.localStorage.getItem('guigui_current_user') || 'null'); } catch { stored = null; }
    if (!stored || stored.role !== current.role) {
      window.localStorage.setItem('guigui_current_user', JSON.stringify(current.user));
    }
    if (!window.localStorage.getItem('guigui_current_lang')) {
      window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
    }
    const userId = (current.user as { id?: string })?.id;
    if (userId && !window.localStorage.getItem(`guigui_onboarding_v1:${userId}`)) {
      window.localStorage.setItem(`guigui_onboarding_v1:${userId}`, JSON.stringify({ status: 'skipped', step: 0, updatedAt: new Date().toISOString() }));
    }
  }, { user, role: user.role });
  return user;
}

async function openDashboard(page: Page, role: Role) {
  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Sessão Iniciada').click();
  const entry = page.locator('button').filter({ hasText: ENTRY_LABEL[role] }).first();
  await expect(entry).toBeVisible({ timeout: 15_000 });
  await entry.click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('aside').first()).toBeVisible({ timeout: 15_000 });
}

async function collectControls(page: Page) {
  return page.evaluate(() => {
    const norm = (value: string | null) => (value || '').replace(/\s+/g, ' ').trim();
    const buttons = [...document.querySelectorAll('button')].map((element) => ({
      kind: 'button',
      text: norm(element.textContent),
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      disabled: (element as HTMLButtonElement).disabled,
      type: (element as HTMLButtonElement).type,
    })).filter((item) => item.text || item.ariaLabel || item.title);

    const links = [...document.querySelectorAll('a')].map((element) => ({
      kind: 'link',
      text: norm(element.textContent),
      href: element.getAttribute('href'),
      ariaLabel: element.getAttribute('aria-label'),
    })).filter((item) => item.text || item.ariaLabel || item.href);

    const inputs = [...document.querySelectorAll('input, textarea, select')].map((element) => ({
      kind: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      placeholder: element.getAttribute('placeholder'),
      ariaLabel: element.getAttribute('aria-label'),
      name: element.getAttribute('name'),
      disabled: (element as HTMLInputElement).disabled,
    }));

    const tabs = [...document.querySelectorAll('[role="tab"]')].map((element) => ({
      kind: 'tab',
      text: norm(element.textContent),
      ariaSelected: element.getAttribute('aria-selected'),
      disabled: (element as HTMLButtonElement).disabled,
    })).filter((item) => item.text);

    const headings = [...document.querySelectorAll('h1, h2, h3, h4')].map((element) => ({
      kind: 'heading',
      level: element.tagName.toLowerCase(),
      text: norm(element.textContent),
    })).filter((item) => item.text);

    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((element) => ({
      kind: 'dialog',
      ariaLabel: element.getAttribute('aria-label'),
      text: norm(element.textContent).slice(0, 160),
    }));

    return { buttons, links, inputs, tabs, headings, dialogs };
  });
}

async function sweepAndCatalog(page: Page, role: Role) {
  const aside = page.locator('aside').first();
  const buttons = aside.locator('button');
  const total = await buttons.count();
  const sections: Array<{ label: string; controls: Awaited<ReturnType<typeof collectControls>> }> = [];

  for (let index = 0; index < total; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    const raw = (await button.innerText().catch(() => '')).trim();
    const label = raw.split('\n').map((part) => part.trim()).filter(Boolean)[0] ?? '';
    if (!label) continue;
    if (/terminar sess|sair|logout|recolher|expandir|fechar|colapsar/i.test(label)) continue;

    await button.click();
    await page.waitForTimeout(800);
    const controls = await collectControls(page);
    sections.push({ label, controls });
  }

  const payload = {
    role,
    capturedAt: new Date().toISOString(),
    sectionCount: sections.length,
    sections,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, `${role}.json`), JSON.stringify(payload, null, 2), 'utf8');
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${role}-last-section.png`), fullPage: true });
}

test.describe('Fase 2 — Catálogo de ações (somente leitura)', () => {
  test.setTimeout(600_000);

  test('visitante: home pública', async ({ page }) => {
    ensureOutputDir();
    await page.addInitScript(() => window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt')));
    await page.goto('/');
    await page.waitForTimeout(2000);
    const controls = await collectControls(page);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'visitor-home.json'), JSON.stringify({ role: 'visitor', capturedAt: new Date().toISOString(), controls }, null, 2), 'utf8');
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'visitor-home.png'), fullPage: true });
  });

  for (const role of ['citizen', 'business', 'admin'] as const) {
    test(`painel ${role}: catálogo de ações`, async ({ page }) => {
      ensureOutputDir();
      await signIn(page, role);
      await openDashboard(page, role);
      await sweepAndCatalog(page, role);
    });
  }
});