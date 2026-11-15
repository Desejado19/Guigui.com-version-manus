import { expect, test, type Page } from '@playwright/test';

/**
 * Auditoria de responsividade.
 *
 * Percorre as telas públicas e as três áreas privadas (cidadão, empresa e
 * administração) em vários tamanhos de ecrã e falha sempre que encontra
 * conteúdo inalcançável:
 *
 * - `page-x`: a página fica mais larga do que a janela (obriga a rolar de lado).
 * - `clip-x` / `clip-x-left`: um elemento é cortado por um antepassado com
 *   `overflow-x: hidden|clip`, ou seja, o utilizador nunca consegue vê-lo.
 * - `clip-y`: o mesmo, mas em altura (modais e painéis com altura fixa).
 * - `self-clip-x` / `self-clip-y`: o próprio elemento corta o seu conteúdo.
 */

type Finding = { kind: string; detail: string };

const MAX_FINDINGS = 25;

const PUBLIC_VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

const DASHBOARD_VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

const DEMO_PASSWORD = 'Guigui@2026!';

const DEMO_EMAILS = {
  citizen: 'cidadao.teste@guigui.com',
  business: 'empresa.teste@guigui.com',
  admin: 'admin.teste@guigui.com',
} as const;

function format(findings: Finding[]) {
  return findings.map((finding) => `[${finding.kind}] ${finding.detail}`).join('\n');
}

async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  const payload = await response.json();
  expect(response.ok(), `login de demonstração falhou para ${email}: ${JSON.stringify(payload)}`).toBeTruthy();
  const user = payload.user;
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, user);
}

async function clickVisibleText(page: Page, pattern: string) {
  const target = page.locator('button', { hasText: pattern }).filter({ visible: true }).first();
  await target.click();
  await page.waitForTimeout(120);
}

async function auditLayout(page: Page, context: string): Promise<Finding[]> {
  const raw = await page.evaluate((max) => {
    const findings: { kind: string; detail: string }[] = [];
    const win = window.innerWidth;
    const root = document.documentElement;

    const textOf = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const hasContent = (el: Element) => textOf(el).length > 0
      || !!el.querySelector('input,select,textarea,button,img,svg,canvas,video');
    const describe = (el: Element) => {
      const klass = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '';
      const short = klass.split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${short ? `.${short}` : ''}`;
    };
    const isVisible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (rect.width < 1 || rect.height < 1) return false;
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      if (Number(style.opacity) < 0.05) return false;
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const isMediaCrop = (el: Element) => {
      if (el.querySelector('input,select,textarea,button')) return false;
      const media = el.querySelectorAll('img,video,canvas');
      if (media.length === 0) return false;
      const hasOtherElements = Array.from(el.querySelectorAll('*')).some((child) => {
        const tag = child.tagName.toLowerCase();
        return tag !== 'img' && tag !== 'video' && tag !== 'canvas';
      });
      return !hasOtherElements;
    };
    const isIntentionalTextCrop = (el: Element) => {
      if ((el as HTMLElement).classList?.contains('truncate')) return true;
      return getComputedStyle(el).webkitLineClamp !== 'none';
    };
    const isMediaBox = (el: Element) => {
      const style = getComputedStyle(el);
      return /(hidden|clip)/.test(style.overflowX + style.overflowY) && !!el.querySelector('img,video,canvas');
    };
    const hasScrollableYAncestor = (el: Element) => {
      let node = el.parentElement;
      while (node && node !== root) {
        const overflowY = getComputedStyle(node).overflowY;
        if (/(auto|scroll)/.test(overflowY)) return true;
        if (/(hidden|clip)/.test(overflowY)) return false;
        node = node.parentElement;
      }
      return false;
    };
    const hasScrollableXAncestor = (el: Element) => {
      let node = el.parentElement;
      while (node && node !== root) {
        const overflowX = getComputedStyle(node).overflowX;
        if (/(auto|scroll)/.test(overflowX)) return true;
        if (/(hidden|clip)/.test(overflowX)) return false;
        node = node.parentElement;
      }
      return false;
    };
    const clippingAncestor = (el: Element) => {
      let node = el.parentElement;
      while (node && node !== root) {
        const style = getComputedStyle(node);
        const clippedX = /(hidden|clip)/.test(style.overflowX);
        const clippedY = /(hidden|clip)/.test(style.overflowY);
        if (clippedX || clippedY) return { node, clippedX, clippedY };
        node = node.parentElement;
      }
      return null;
    };

    if (root.scrollWidth > win + 2) {
      findings.push({
        kind: 'page-x',
        detail: `documento com ${root.scrollWidth}px de largura numa janela de ${win}px`,
      });
    }

    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (findings.length >= max) break;
      if (!isVisible(el) || !hasContent(el)) continue;
      // Texto só para leitores de ecrã é recortado de propósito.
      if (el.closest('.sr-only')) continue;
      const style = getComputedStyle(el);
      if (style.position === 'fixed') continue;

      const intentionalCrop = isMediaCrop(el) || isIntentionalTextCrop(el) || isMediaBox(el);
      if (/(hidden|clip)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 4 && !intentionalCrop) {
        findings.push({ kind: 'self-clip-x', detail: `${describe(el)} corta ${el.scrollWidth - el.clientWidth}px de largura` });
      }
      if (/(hidden|clip)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4 && !intentionalCrop) {
        findings.push({ kind: 'self-clip-y', detail: `${describe(el)} corta ${el.scrollHeight - el.clientHeight}px de altura` });
      }

      const clip = clippingAncestor(el);
      if (!clip) continue;
      const rect = el.getBoundingClientRect();
      const box = clip.node.getBoundingClientRect();
      const overflowRight = Math.round(rect.right - box.right);
      const overflowLeft = Math.round(box.left - rect.left);
      const overflowBottom = Math.round(rect.bottom - box.bottom);
      // Conteúdo dentro de um carrossel horizontal é alcançável por scroll.
      if (clip.clippedX && overflowRight > 4 && !hasScrollableXAncestor(el)) {
        findings.push({ kind: 'clip-x', detail: `${describe(el)} excede ${describe(clip.node)} em ${overflowRight}px à direita` });
      }
      if (clip.clippedX && overflowLeft > 4) {
        findings.push({ kind: 'clip-x-left', detail: `${describe(el)} excede ${describe(clip.node)} em ${overflowLeft}px à esquerda` });
      }
      if (clip.clippedY && overflowBottom > 4 && !hasScrollableYAncestor(el)) {
        findings.push({ kind: 'clip-y', detail: `${describe(el)} excede ${describe(clip.node)} em ${overflowBottom}px em altura` });
      }
    }

    const seen = new Set<string>();
    return findings.filter((finding) => {
      const key = `${finding.kind}|${finding.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, MAX_FINDINGS);

  return raw.map((finding) => ({ kind: finding.kind, detail: `${context} → ${finding.detail}` }));
}
async function openPrimaryTab(page: Page, label: string) {
  // No desktop os separadores mostram só o ícone; o nome acessível é a única pista.
  const byName = page.getByRole('button', { name: label, exact: false }).filter({ visible: true }).first();
  if (await byName.count()) {
    await byName.click();
  } else {
    const byTitle = page.locator(`button[title^="${label}"]`).filter({ visible: true }).first();
    if (await byTitle.count()) {
      await byTitle.click();
    } else {
      await clickVisibleText(page, label);
    }
  }
  await page.waitForTimeout(250);
}

test.describe('Responsividade das telas públicas', () => {
  test.setTimeout(240_000);

  for (const viewport of PUBLIC_VIEWPORTS) {
    test(`sem conteúdo cortado em ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      });
      await page.goto('/');

      const findings: Finding[] = [];
      findings.push(...await auditLayout(page, 'feed'));
      await expect(page.locator('h1').first()).toBeVisible();

      for (const label of ['Diretório', 'Ofertas', 'Agenda']) {
        await openPrimaryTab(page, label);
        findings.push(...await auditLayout(page, label));
      }

      await openPrimaryTab(page, 'Feed');
      const loginButton = page.getByRole('button', { name: /^Entrar$/ }).filter({ visible: true }).first();
      if (await loginButton.count()) {
        await loginButton.click();
      } else {
        await page.getByRole('button', { name: 'Abrir Menu Principal' }).click();
        await page.waitForTimeout(250);
        await page.getByRole('button', { name: /Iniciar Sessão/ }).filter({ visible: true }).first().click();
      }
      await page.waitForTimeout(300);
      findings.push(...await auditLayout(page, 'modal de login'));

      expect(findings, `\n${format(findings)}\n`).toEqual([]);
    });
  }
});

async function auditDashboardSections(page: Page, context: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const entries = page.locator('.guigui-profile-dashboard aside button');
  const total = await entries.count();
  for (let index = 0; index < total; index += 1) {
    const entry = entries.nth(index);
    if (!(await entry.isVisible())) continue;
    const name = (await entry.getAttribute('aria-label')) || (await entry.innerText()).split('\n')[0] || `secção ${index}`;
    await entry.click();
    await page.waitForTimeout(220);
    findings.push(...await auditLayout(page, `${context}: ${name.trim()}`));
  }
  return findings;
}

test.describe('Responsividade das áreas privadas', () => {
  test.setTimeout(600_000);

  for (const viewport of DASHBOARD_VIEWPORTS) {
    test(`área do cidadão em ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signIn(page, DEMO_EMAILS.citizen);
      await page.goto('/');
      await openPrimaryTab(page, 'Conta');
      await expect(page.locator('.guigui-profile-dashboard')).toBeVisible();

      const findings = await auditDashboardSections(page, 'área pessoal');
      expect(findings, `\n${format(findings)}\n`).toEqual([]);
    });

    test(`área da empresa em ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signIn(page, DEMO_EMAILS.business);
      await page.goto('/');
      await page.getByTitle('Sessão Iniciada').click();
      await clickVisibleText(page, 'Área da Minha Empresa');
      await expect(page.locator('.guigui-profile-dashboard')).toBeVisible();

      const findings = await auditDashboardSections(page, 'área da empresa');
      expect(findings, `\n${format(findings)}\n`).toEqual([]);
    });

    test(`painel de administração em ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signIn(page, DEMO_EMAILS.admin);
      await page.goto('/');
      await page.getByTitle('Sessão Iniciada').click();
      await clickVisibleText(page, 'Plataforma');
      await expect(page.locator('.guigui-profile-dashboard')).toBeVisible();

      const findings = await auditDashboardSections(page, 'administração');
      expect(findings, `\n${format(findings)}\n`).toEqual([]);
    });
  }
});