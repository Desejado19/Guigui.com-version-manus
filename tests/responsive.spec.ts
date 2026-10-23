import { expect, test, type Locator, type Page } from '@playwright/test';

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

async function signIn(page: Page, email: string, { retries = 3, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await page.request.post('/api/auth/login', {
      data: { email, password: DEMO_PASSWORD },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok()) {
      const user = payload.user;
      await page.addInitScript((account) => {
        window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
        window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      }, user);
      return user;
    }
    const code = (payload as { code?: string }).code;
    if (code !== 'RATE_LIMITED' || attempt === retries) {
      expect(response.ok(), `login de demonstração falhou para ${email}: ${JSON.stringify(payload)}`).toBeTruthy();
    }
    await page.waitForTimeout(baseDelayMs * (attempt + 1));
  }
  // unreachable
  const fallback = await page.request.post('/api/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  const fallbackPayload = await fallback.json();
  expect(fallback.ok(), `login de demonstração falhou para ${email}: ${JSON.stringify(fallbackPayload)}`).toBeTruthy();
  return (fallbackPayload as { user: unknown }).user;
}

/**
 * No telemóvel o menu lateral é um drawer: os seus botões continuam no DOM (e
 * "visíveis" para o Playwright) mas fora do ecrã. Escolher o primeiro candidato
 * dentro do viewport evita clicar no que o menu escondido duplica — por
 * exemplo, o item "Utilizadores" do menu de administração também contém a
 * palavra "Plataforma" na descrição e, ao ser escolhido, deixava o clique em
 * espera durante minutos.
 */
async function clickVisibleText(page: Page, pattern: string) {
  const candidates = page.locator('button', { hasText: pattern }).filter({ visible: true });
  const total = await candidates.count();
  const viewport = page.viewportSize();
  let target: Locator | null = null;
  for (let index = 0; index < total; index += 1) {
    const candidate = candidates.nth(index);
    const box = await candidate.boundingBox();
    if (!box || !viewport) continue;
    if (box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1) {
      target = candidate;
      break;
    }
  }
  // Nenhum candidato dentro do viewport: em vez de clicar às cegas no primeiro
  // (que pode estar num drawer fechado e pendurar o teste durante minutos),
  // abre o menu lateral — é aí que vivem as entradas como "Plataforma",
  // "Área da Minha Empresa" e "Conta" no telemóvel/tablet.
  if (!target) {
    const menuButton = page
      .locator('button[aria-label="Abrir Menu Principal"]')
      .filter({ visible: true })
      .first();
    if (await menuButton.count()) {
      await menuButton.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      const reopened = page.locator('button', { hasText: pattern }).filter({ visible: true });
      const reopenedTotal = await reopened.count();
      for (let index = 0; index < reopenedTotal; index += 1) {
        const candidate = reopened.nth(index);
        const box = await candidate.boundingBox();
        if (!box || !viewport) continue;
        if (box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1) {
          target = candidate;
          break;
        }
      }
      if (!target) {
        // O item não existe no drawer: fecha-o para o clique de fallback não
        // bater no backdrop e esperar sem fim.
        await page
          .locator('div.fixed.inset-0.z-\\[120\\] button[title*="Menu"]')
          .filter({ visible: true })
          .first()
          .click({ timeout: 3_000 })
          .catch(() => undefined);
        await page.waitForTimeout(300);
      }
    }
  }
  await (target ?? candidates.first()).click({ timeout: 10_000 });
  await page.waitForTimeout(120);
}

async function auditLayout(page: Page, context: string): Promise<Finding[]> {
  const raw = await page.evaluate((max) => {
    const findings: { kind: string; detail: string }[] = [];
    const win = window.innerWidth;
    const root = document.documentElement;

    const describe = (el: Element) => {
      const klass = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '';
      const short = klass.split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${short ? `.${short}` : ''}`;
    };
    // Varrimento único do DOM: guarda os elementos com texto visível e conta os
    // descendentes por categoria. Sem isto, cada elemento fazia o próprio
    // textContent/querySelectorAll e a auditoria demorava minutos em painéis
    // grandes (os testes de 320x640 chegavam a rebentar os 600s).
    const allElements = Array.from(document.querySelectorAll('body *'));
    const textOwners = new Set<Element>();
    const descendantTotals = new Map<Element, number>();
    const descendantMedia = new Map<Element, number>();
    const descendantForm = new Map<Element, number>();
    const descendantContent = new Map<Element, number>();
    const VISUAL_MEDIA = /^(img|video|canvas)$/i;
    const CONTENT_TAGS = /^(input|select|textarea|button|img|svg|canvas|video)$/i;
    const FORM_TAGS = /^(input|select|textarea|button)$/i;
    const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      let parent = node.parentElement;
      while (parent && parent !== root) {
        textOwners.add(parent);
        parent = parent.parentElement;
      }
    }
    for (const el of allElements) {
      const isMedia = VISUAL_MEDIA.test(el.tagName);
      const isForm = FORM_TAGS.test(el.tagName);
      const isContent = isMedia || CONTENT_TAGS.test(el.tagName);
      let parent = el.parentElement;
      while (parent && parent !== root) {
        descendantTotals.set(parent, (descendantTotals.get(parent) ?? 0) + 1);
        if (isMedia) descendantMedia.set(parent, (descendantMedia.get(parent) ?? 0) + 1);
        if (isForm) descendantForm.set(parent, (descendantForm.get(parent) ?? 0) + 1);
        if (isContent) descendantContent.set(parent, (descendantContent.get(parent) ?? 0) + 1);
        parent = parent.parentElement;
      }
    }
    const countOf = (map: Map<Element, number>, el: Element) => map.get(el) ?? 0;
    const hasContent = (el: Element) => textOwners.has(el) || countOf(descendantContent, el) > 0;
    const isVisible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = styleOf(el);
      if (rect.width < 1 || rect.height < 1) return false;
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      if (Number(style.opacity) < 0.05) return false;
      // Texto só para leitores de ecrã (sr-only) não precisa de ser visível.
      if (el.closest('.sr-only')) return false;
      // Elementos fora do ecrã (drawer fechado no telemóvel, carrossel já
      // rolado) não são conteúdo visível para o utilizador.
      if (rect.right <= 0 || rect.left >= win) return false;
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };
    // Contentor de tamanho fixo só com img/video/canvas (avatar com
    // object-cover, ou imagem externa ainda sem dimensões) não é bug.
    const isMediaCrop = (el: Element) => {
      if (countOf(descendantForm, el) > 0) return false;
      if (textOwners.has(el)) return false;
      const media = countOf(descendantMedia, el);
      if (media === 0) return false;
      // Além de img/video/canvas não pode haver mais nenhum elemento.
      return countOf(descendantTotals, el) - media === 0;
    };
    // Os estilos calculados são reutilizados entre o varrimento dos
    // descendentes e a subida pelos antepassados: sem cache, cada elemento
    // forçava dezenas de getComputedStyle e a auditoria demorava minutos.
    const styleCache = new Map<Element, CSSStyleDeclaration>();
    const styleOf = (el: Element) => {
      let style = styleCache.get(el);
      if (!style) {
        style = getComputedStyle(el);
        styleCache.set(el, style);
      }
      return style;
    };
    // Um antepassado com rolagem no mesmo eixo torna o conteúdo alcançável
    // (faixa horizontal de cards, corpo de modal, painel com scroll próprio).
    // A procura sobe até ao antepassado que corta, inclusive.
    const scrollAncestorOnAxis = (el: Element, clipNode: Element, axis: 'x' | 'y') => {
      let node = el.parentElement;
      while (node && node !== root) {
        const style = styleOf(node);
        if (/(auto|scroll)/.test(axis === 'x' ? style.overflowX : style.overflowY)) return node;
        if (node === clipNode) return null;
        node = node.parentElement;
      }
      return null;
    };
    // Cortes de media intencionais (capa de card/hero com object-cover e
    // overlays absolutos) e truncagens de texto (line-clamp) não são bugs.
    const isCoverCrop = (el: Element) => {
      const kids = Array.from(el.children);
      if (!kids.length) return false;
      if (countOf(descendantMedia, el) === 0) return false;
      const allMediaOrAbsolute = kids.every((k) => {
        const st = styleOf(k);
        return st.position === 'absolute' || VISUAL_MEDIA.test(k.tagName);
      });
      return allMediaOrAbsolute;
    };
    const isLineClamp = (el: Element) => /line-clamp/.test(String(el.className))
      // `truncate` (text-overflow: ellipsis) é a mesma truncagem intencional
      // usada em etiquetas de stories e cabeçalhos de uma linha.
      || (styleOf(el).textOverflow === 'ellipsis' && styleOf(el).whiteSpace === 'nowrap');
    // Halos e brilhos decorativos são colocados de propósito fora das margens
    // do cartão (`-right-16`, `-bottom-24`) e recortados pelo `overflow-hidden`.
    // Isso não é conteúdo perdido, mas para o varrimento não servir de
    // desculpa a cortes reais só é aceite quando *tudo* o que estoura nesse
    // eixo é absoluto e decorativo: sem texto, sem controlos e sem conteúdo.
    const isDecorativeOverflow = (el: Element, axis: 'x' | 'y') => {
      const box = el.getBoundingClientRect();
      const limit = axis === 'x' ? box.right : box.bottom;
      let decorations = 0;
      for (const node of allElements) {
        if (node === el || !el.contains(node)) continue;
        const style = styleOf(node);
        if (style.position !== 'absolute' && style.position !== 'fixed') continue;
        const rect = node.getBoundingClientRect();
        const extent = axis === 'x' ? rect.right : rect.bottom;
        if (extent <= limit + 4) continue;
        const decorative = style.pointerEvents === 'none'
          || node.getAttribute('aria-hidden') === 'true'
          || (!textOwners.has(node) && countOf(descendantContent, node) === 0);
        if (!decorative) return false;
        decorations += 1;
      }
      return decorations > 0;
    };
    const clippingAncestor = (el: Element) => {
      let node = el.parentElement;
      while (node && node !== root) {
        const style = styleOf(node);
        const clippedX = /(hidden|clip)/.test(style.overflowX);
        const clippedY = /(hidden|clip)/.test(style.overflowY);
        if (clippedX || clippedY) return { node, clippedX, clippedY };
        node = node.parentElement;
      }
      return null;
    };
    // Um subárvore dentro de um ancestral `position: fixed` não é cortada
    // pelo overflow dos contentores por cima: o seu containing block é o
    // próprio viewport (a menos que algum antepassado crie um novo containing
    // block com transform, filter, will-change ou contain). O menu lateral
    // fixo das áreas privadas começa em x=0 enquanto `.guigui-main` tem
    // padding lateral — os seus filhos "estouram" alguns píxeis para a
    // esquerda do contentor sem estarem cortados de facto.
    const escapesThroughFixedAncestor = (el: Element, clipNode: Element) => {
      let node = el.parentElement;
      while (node && node !== clipNode && node !== root) {
        if (styleOf(node).position === 'fixed') {
          let inner = clipNode;
          while (inner && inner !== node) {
            const s = styleOf(inner);
            if (
              s.transform !== 'none'
              || s.filter !== 'none'
              || (s.backdropFilter && s.backdropFilter !== 'none')
              || s.perspective !== 'none'
              || s.willChange !== 'auto'
              || /layout|paint|strict|content/.test(s.contain || '')
            ) {
              return false;
            }
            inner = inner.parentElement;
          }
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    if (root.scrollWidth > win + 2) {
      findings.push({
        kind: 'page-x',
        detail: `documento com ${root.scrollWidth}px de largura numa janela de ${win}px`,
      });
    }

    for (const el of allElements) {
      if (findings.length >= max) break;
      if (!isVisible(el) || !hasContent(el)) continue;
      const style = styleOf(el);
      if (style.position === 'fixed') continue;
      // Ícones são desenhos vetoriais: as formas podem sair alguns píxeis das
      // margens do viewBox sem que isso seja conteúdo cortado.
      if (el.closest('svg')) continue;

      // Truncagem intencional (object-cover, line-clamp) não é bug.
      const intentionalCrop = isMediaCrop(el) || isCoverCrop(el) || isLineClamp(el);

      const cropsX = /(hidden|clip)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 4;
      const cropsY = /(hidden|clip)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4;
      if (cropsX && !intentionalCrop && !isDecorativeOverflow(el, 'x')) {
        findings.push({ kind: 'self-clip-x', detail: `${describe(el)} corta ${el.scrollWidth - el.clientWidth}px de largura` });
      }
      if (cropsY && !intentionalCrop && !isDecorativeOverflow(el, 'y')) {
        findings.push({ kind: 'self-clip-y', detail: `${describe(el)} corta ${el.scrollHeight - el.clientHeight}px de altura` });
      }

      const clip = clippingAncestor(el);
      if (!clip) continue;
      // Sub-árvores dentro de um aside fixo escapam ao overflow do contentor
      // do dashboard (ver escapesThroughFixedAncestor): nada é cortado.
      if (escapesThroughFixedAncestor(el, clip.node)) continue;
      const rect = el.getBoundingClientRect();
      const box = clip.node.getBoundingClientRect();
      const overflowRight = Math.round(rect.right - box.right);
      const overflowLeft = Math.round(box.left - rect.left);
      const overflowBottom = Math.round(rect.bottom - box.bottom);
      const scrollableX = clip.clippedX ? scrollAncestorOnAxis(el, clip.node, 'x') : null;
      const scrollableY = clip.clippedY ? scrollAncestorOnAxis(el, clip.node, 'y') : null;
      if (clip.clippedX && overflowRight > 4 && !scrollableX) {
        findings.push({ kind: 'clip-x', detail: `${describe(el)} excede ${describe(clip.node)} em ${overflowRight}px à direita` });
      }
      if (clip.clippedX && overflowLeft > 4 && !scrollableX) {
        findings.push({ kind: 'clip-x-left', detail: `${describe(el)} excede ${describe(clip.node)} em ${overflowLeft}px à esquerda` });
      }
      if (clip.clippedY && overflowBottom > 4 && !scrollableY) {
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
  const byTitle = page.locator(`button[title^="${label}"]`).filter({ visible: true }).first();
  if (await byTitle.count()) {
    await byTitle.click();
  } else {
    await clickVisibleText(page, label);
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

      for (const label of ['Diretório de Empresas', 'Ofertas & Descontos', 'Eventos']) {
        await openPrimaryTab(page, label);
        findings.push(...await auditLayout(page, label));
      }

      await openPrimaryTab(page, 'Feed Bissau');

      const feedLoginButton = page
        .locator('button:has-text("Entrar")')
        .filter({ visible: true })
        .first();

      await page.waitForSelector('button:has-text("Entrar")', { state: 'visible', timeout: 10_000 }).catch(() => undefined);
      const feedLoginVisible = await feedLoginButton.isVisible().catch(() => false);
      if (feedLoginVisible) {
        await feedLoginButton.click({ timeout: 10_000 });
        await page.waitForTimeout(300);
        findings.push(...await auditLayout(page, 'modal de login'));
      }

      expect(findings, `\n${format(findings)}\n`).toEqual([]);
    });
  }
});

/**
 * No telemóvel o menu lateral é um drawer: começa fora do ecrã e fecha-se
 * outra vez sempre que se escolhe uma secção. Em ecrãs grandes está sempre
 * visível e o botão que o abre nem sequer existe.
 */
async function openSidebarIfOffScreen(page: Page, entry: Locator) {
  const viewport = page.viewportSize();
  const box = await entry.boundingBox();
  if (!box || !viewport) return;
  if (box.x >= 0 && box.x + box.width <= viewport.width + 1) return;
  const toggle = page
    .locator('button[aria-label="Abrir menu lateral"]')
    .filter({ visible: true })
    .first();
  if (!(await toggle.count())) return;
  await toggle.click({ timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(350);
}

async function auditDashboardSections(page: Page, context: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const entries = page.locator('.guigui-profile-dashboard aside button');
  const total = await entries.count();
  for (let index = 0; index < total; index += 1) {
    const entry = entries.nth(index);
    if (!(await entry.isVisible())) continue;
    await openSidebarIfOffScreen(page, entry);
    const name = (await entry.getAttribute('aria-label')) || (await entry.innerText()).split('\n')[0] || `secção ${index}`;
    await entry.click();
    await page.waitForTimeout(220);
    // Com o menu aberto a auditoria vê as mesmas etiquetas que em ecrã grande.
    await openSidebarIfOffScreen(page, entry);
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
      // O item de sessão administração chama-se "Administração Guigui.com";
      // "Plataforma" já só existe como descrição de cartões dentro do painel.
      await clickVisibleText(page, 'Administração Guigui.com');
      await expect(page.locator('.guigui-profile-dashboard')).toBeVisible();

      const findings = await auditDashboardSections(page, 'administração');
      expect(findings, `\n${format(findings)}\n`).toEqual([]);
    });
  }
});