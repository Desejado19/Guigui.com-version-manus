#!/usr/bin/env node
/**
 * Auditoria de contraste (WCAG 1.4.3 / 1.4.11) nas páginas principais do Guigui.com.
 *
 * Percorre as páginas públicas e todos os módulos do Admin em tema claro e escuro,
 * medindo as cores realmente renderizadas (getComputedStyle) e falha quando:
 *   - texto tem contraste inferior a 4,5:1 com o fundo efetivo (meta normal);
 *   - a borda de um controlo (input/select/textarea/botão com borda) tem
 *     contraste inferior a 3:1 com a cor adjacente.
 *
 * Uso:
 *   node scripts/audit-contrast.mjs                 -> claro + escuro, público + admin
 *   node scripts/audit-contrast.mjs --themes=dark   -> só tema escuro
 *   node scripts/audit-contrast.mjs --views=admin   -> só o painel de administração
 *   node scripts/audit-contrast.mjs --views=login,citizen,business -> conta e perfis
 *   node scripts/audit-contrast.mjs --json=.contrast-report.json
 *   node scripts/audit-contrast.mjs --baseline=.contrast-baseline.json
 *   node scripts/audit-contrast.mjs --baseline=.contrast-baseline.json --update-baseline
 *
 * Baseline: com --baseline, as violações registadas no ficheiro são conhecidas
 * e ignoradas; o comando falha apenas se aparecer alguma violação nova. Usa
 * --update-baseline para gravar o estado atual (intencional, revisto no diff).
 *
 * Códigos de saída: 0 = sem violações (ou sem violações novas com baseline);
 * 1 = violações, violações novas ou página inacessível.
 * Requer o servidor a correr (por omissão em http://127.0.0.1:3000).
 */
import { chromium, request as playwrightRequest } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ARGS = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = ARGS.find((item) => item === `--${name}` || item.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const [, value] = hit.split('=');
  return value === undefined ? true : value;
};

const BASE_URL = String(arg('base-url', process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000')).replace(/\/+$/, '');
const THEMES = String(arg('themes', 'light,dark')).split(',').map((value) => value.trim()).filter(Boolean);
const VIEWS = String(arg('views', 'public,admin')).split(',').map((value) => value.trim()).filter(Boolean);
const TEXT_MIN = Number(arg('text-min', 4.5));
// Por omissão igual ao texto (exigência do projeto). A WCAG permitiria 3:1 para
// texto grande; passar --large-text-min=3 para adotar esse limite.
const LARGE_TEXT_MIN = Number(arg('large-text-min', TEXT_MIN));
const CONTROL_MIN = Number(arg('control-min', 3));
const MAX_FINDINGS = Number(arg('max-findings', 8));
const JSON_OUT = arg('json', '');
const VERBOSE = Boolean(arg('verbose', false));
const HEADED = Boolean(arg('headed', false));
const BASELINE_ARG = arg('baseline', '');
const BASELINE_PATH = resolve(
  process.cwd(),
  typeof BASELINE_ARG === 'string' && BASELINE_ARG.trim() ? BASELINE_ARG.trim() : '.contrast-baseline.json',
);
const UPDATE_BASELINE = ARGS.includes('--update-baseline') || arg('update-baseline', '') === 'true';
const BASELINE_ACTIVE = Boolean(BASELINE_ARG) || UPDATE_BASELINE;

const ACCOUNT = {
  email: String(arg('email', process.env.AUDIT_EMAIL || 'admin.teste@guigui.com')),
  password: String(arg('password', process.env.AUDIT_PASSWORD || 'Guigui@2026!')),
};

/** Contas demo usadas para as vistas de Cidadão e Empresa. */
const ROLE_ACCOUNTS = {
  citizen: { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' },
  business: { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' },
};

/** Páginas públicas: aria-label do botão de navegação principal (Navbar). */
const PUBLIC_VIEWS = [
  { name: 'Feed', selector: 'button[aria-label="Feed Bissau"]' },
  { name: 'Diretório', selector: 'button[aria-label="Diretório de Empresas"]' },
  { name: 'Ofertas', selector: 'button[aria-label="Ofertas & Descontos"]' },
  { name: 'Eventos', selector: 'button[aria-label="Agenda Cultural & Bilhetes"]' },
];

/** Módulos do Admin: prefixo do texto do botão na barra lateral do painel. */
const ADMIN_MODULES = [
  'Visão Geral',
  'Empresas & Negócios',
  'Eventos & Bilhetes',
  'Utilizadores',
  'Financeiro',
  'Planos & Assinaturas',
  'Moderação',
  'Relatórios',
  'Suporte',
  'Email externo',
  'Notificações em massa',
  'Permissões',
  'Equipa',
  'Categorias e Etiquetas',
  'Sistema',
  'Configurações Globais',
  'Sobre Nós',
  'Auditoria',
];

/**
 * Executado no browser. Devolve as violações da vista atual.
 * Tudo o que depende de canvas/getComputedStyle fica aqui dentro.
 */
function collectViolationsInPage({ textMin, largeTextMin, controlMin }) {
  const COLOR_CACHE = new Map();
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  /** Converte qualquer cor CSS (rgb, oklab, color(...)) em RGBA via canvas. */
  const parseColor = (input) => {
    if (!input || input === 'transparent' || input === 'none') return { r: 0, g: 0, b: 0, a: 0 };
    if (COLOR_CACHE.has(input)) return COLOR_CACHE.get(input);
    let result = null;
    if (/^rgba?\(/.test(input)) {
      const [r, g, b, a = 1] = input.replace(/rgba?\(|\)/g, '').split(/[,/\s]+/).filter(Boolean).map(Number);
      result = { r, g, b, a: Number.isFinite(a) ? a : 1 };
    } else {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      try {
        ctx.fillStyle = input;
      } catch {
        return null;
      }
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      result = { r, g, b, a: a / 255 };
    }
    if (result) COLOR_CACHE.set(input, result);
    return result;
  };

  const composite = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const v = Math.max(0, Math.min(255, value)) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const format = (color) => `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
  const round = (value) => Math.round(value * 100) / 100;

  /**
   * Fundo efetivo de um elemento: compõe todas as camadas de background até à raiz.
   * Devolve null quando há imagens/gradientes numa camada (contraste indeterminável).
   */
  const effectiveBackground = (element) => {
    const layers = [];
    let node = element;
    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== 'none') return null;
      const color = parseColor(style.backgroundColor);
      if (color && color.a > 0) layers.push(color);
      if (color && color.a >= 0.999) break;
      node = node.parentElement;
    }
    const rootStyle = getComputedStyle(document.documentElement);
    let base = parseColor(rootStyle.backgroundColor);
    if (!base || base.a < 0.999) base = { r: 255, g: 255, b: 255, a: 1 };
    let result = base;
    for (let index = layers.length - 1; index >= 0; index -= 1) result = composite(layers[index], result);
    const bodyBase = parseColor(getComputedStyle(document.body).backgroundColor);
    if (bodyBase && bodyBase.a >= 0.999) {
      result = bodyBase;
      for (let index = layers.length - 1; index >= 0; index -= 1) result = composite(layers[index], result);
    }
    return result;
  };

  const isHidden = (element) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
    if (Number(style.opacity) < 0.1) return true;
    return false;
  };

  const isVisibleBox = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
  };

  const ignored = (element) =>
    Boolean(
      element.closest(
        'script, style, noscript, svg, canvas, [data-contrast-ignore], [aria-hidden="true"], input[type="hidden"]',
      ),
    );

  const describe = (element) => {
    const tag = element.tagName.toLowerCase();
    const cls = String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const id = element.id ? `#${element.id}` : '';
    return `${tag}${id}${cls ? `.${cls}` : ''}`;
  };

  const textFindings = [];
  const textSkipped = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  while (currentNode) {
    const raw = currentNode.nodeValue || '';
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text.length >= 2) {
      const element = currentNode.parentElement;
      if (element && !seen.has(element) && !ignored(element)) {
        const style = getComputedStyle(element);
        const usable =
          !isHidden(element) &&
          isVisibleBox(element) &&
          !element.closest(':disabled, [aria-disabled="true"]') &&
          !/^(none|hidden)$/.test(style.display) &&
          style.textShadow === 'none';
        if (usable) {
          const background = effectiveBackground(element);
          if (!background) {
            textSkipped.push(describe(element));
          } else {
            const color = parseColor(style.color);
            if (color) {
              const foreground = color.a < 0.999 ? composite(color, background) : color;
              const size = parseFloat(style.fontSize) || 16;
              const weight = Number(style.fontWeight) || 400;
              const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
              const minimum = isLarge ? largeTextMin : textMin;
              const value = ratio(foreground, background);
              if (value < minimum) {
                textFindings.push({
                  kind: 'text',
                  text: text.slice(0, 60),
                  selector: describe(element),
                  ratio: round(value),
                  minimum,
                  foreground: format(foreground),
                  background: format(background),
                  fontSize: size,
                });
              }
              seen.add(element);
            }
          }
        }
      }
    }
    currentNode = walker.nextNode();
  }

  const controlFindings = [];
  const controlSkipped = [];
  const controlSelector =
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [role="combobox"], [role="textbox"], [role="switch"]';
  for (const element of document.querySelectorAll(controlSelector)) {
    if (ignored(element) || isHidden(element) || !isVisibleBox(element)) continue;
    const style = getComputedStyle(element);
    const own = parseColor(style.backgroundColor);
    const parentBackground = effectiveBackground(element.parentElement || element);
    if (!parentBackground) {
      controlSkipped.push(describe(element));
      continue;
    }
    const innerBackground = own && own.a > 0 ? composite(own, parentBackground) : parentBackground;
    const sides = [
      ['top', style.borderTopWidth, style.borderTopStyle, style.borderTopColor],
      ['right', style.borderRightWidth, style.borderRightStyle, style.borderRightColor],
      ['bottom', style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor],
      ['left', style.borderLeftWidth, style.borderLeftStyle, style.borderLeftColor],
    ];
    for (const [side, width, borderStyle, colorValue] of sides) {
      const thickness = parseFloat(width) || 0;
      if (thickness <= 0 || borderStyle === 'none' || borderStyle === 'hidden') continue;
      const border = parseColor(colorValue);
      if (!border || border.a === 0) continue;
      const outside = border.a < 0.999 ? composite(border, parentBackground) : border;
      const inside = border.a < 0.999 ? composite(border, innerBackground) : border;
      const value = Math.max(ratio(outside, parentBackground), ratio(inside, innerBackground));
      if (value < controlMin) {
        controlFindings.push({
          kind: 'control',
          side,
          text: element.getAttribute('placeholder') || element.getAttribute('aria-label') || describe(element),
          selector: describe(element),
          ratio: round(value),
          minimum: controlMin,
          foreground: format(outside),
          background: format(parentBackground),
        });
      }
    }
  }

  return {
    textFindings,
    controlFindings,
    skipped: { text: textSkipped, controls: controlSkipped },
  };
}

/** Deteta se a página é acessível antes de lançar o browser. */
async function assertServerReachable() {
  try {
    const response = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`\n✗ Servidor inacessível em ${BASE_URL} (${error.message}).`);
    console.error('  Arranca-o primeiro: npm start (ou npm run dev) e repete a auditoria.\n');
    process.exit(1);
  }
}

/** Login real (cookie de sessão) + utilizador em localStorage para o React arrancar com sessão. */
async function createAuthenticatedContext(browser, theme, credentials = ACCOUNT) {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const login = await api.post('/api/auth/login', { data: credentials });
  if (!login.ok()) {
    const body = await login.text().catch(() => '');
    await api.dispose();
    throw new Error(`login falhou para ${credentials.email}: HTTP ${login.status} ${body.slice(0, 200)}`);
  }
  const payload = await login.json();
  const user = payload.user || {};
  if (!user.id) throw new Error('login sem utilizador na resposta de /api/auth/login');
  const storageState = await api.storageState();
  await api.dispose();

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
    locale: 'pt-PT',
  });
  await context.addInitScript(
    ({ currentUser, mode }) => {
      window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      window.localStorage.setItem(
        'guigui_current_user',
        JSON.stringify({ ...currentUser, preferredLanguage: 'pt' }),
      );
      window.localStorage.setItem('guigui_theme_mode', mode);
      // O guia de boas-vindas cobre o painel e intercepta cliques: marca-o como
      // saltado para todas as audiências antes da aplicação arrancar.
      for (const audience of ['admin', 'citizen', 'business', 'team']) {
        window.localStorage.setItem(
          `guigui_onboarding_v1:${currentUser.id}:${audience}`,
          JSON.stringify({ status: 'skipped', step: 0, updatedAt: new Date().toISOString() }),
        );
      }
    },
    { currentUser: user, mode: theme },
  );
  return { context, user };
}

/** Força o tema (o utilizador pode tê-lo mudado antes) e garante que as classes de tema aplicaram. */
async function applyTheme(page, theme) {
  await page.evaluate((mode) => {
    window.localStorage.setItem('guigui_theme_mode', mode);
    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
  }, theme);
  await page.waitForTimeout(250);
}

async function auditCurrentView(page, viewName) {
  const result = await page.evaluate(collectViolationsInPage, {
    textMin: TEXT_MIN,
    largeTextMin: LARGE_TEXT_MIN,
    controlMin: CONTROL_MIN,
  });
  return {
    view: viewName,
    violations: [...result.textFindings, ...result.controlFindings],
    skipped: result.skipped,
  };
}

async function runPublicViews(page) {
  const results = [];
  for (const view of PUBLIC_VIEWS) {
    const target = page.locator(view.selector).first();
    try {
      await target.waitFor({ state: 'visible', timeout: 15_000 });
      await target.click({ timeout: 8000 });
    } catch {
      results.push({ view: `público/${view.name}`, error: `botão de navegação "${view.selector}" não encontrado` });
      continue;
    }
    await page.waitForTimeout(900);
    results.push({ ...(await auditCurrentView(page, `público/${view.name}`)) });
  }
  return results;
}

async function runLoginView(page) {
  const entry = page.getByRole('button', { name: /^Entrar$/ }).first();
  try {
    await entry.waitFor({ state: 'visible', timeout: 15_000 });
    await entry.click({ timeout: 8000 });
    await page.getByText('Acesse a sua conta').first().waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return { view: 'login/modal', error: 'botão "Entrar" ou modal de login não encontrado' };
  }
  await page.waitForTimeout(600);
  return auditCurrentView(page, 'login/modal');
}

async function runAccountView(page, role) {
  const names = {
    citizen: { entry: 'A minha área pessoal', label: 'Cidadão' },
    business: { entry: 'Área da Minha Empresa', label: 'Empresa' },
  };
  const { entry, label } = names[role];
  const sessionButton = page.locator('button[title="Sessão Iniciada"]').first();
  if ((await sessionButton.count()) === 0) return { view: `conta/${label}`, error: 'botão de sessão "Sessão Iniciada" ausente' };
  await sessionButton.click();
  const target = page.getByRole('button', { name: entry }).first();
  try {
    await target.waitFor({ state: 'visible', timeout: 8000 });
    await target.click();
  } catch {
    return { view: `conta/${label}`, error: `entrada "${entry}" ausente` };
  }
  await page.waitForTimeout(1500);
  return auditCurrentView(page, `conta/${label}`);
}

async function dismissOverlays(page) {
  if ((await page.locator('[role="dialog"][aria-modal="true"]').count()) === 0) return;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if ((await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0) {
    const close = page.locator('[role="dialog"] button').filter({ hasText: /^(Saltar|Fechar|Terminar|Agora não)/ }).first();
    if ((await close.count()) > 0) await close.click().catch(() => undefined);
  }
  await page.waitForTimeout(200);
}

async function openAdminPanel(page) {
  await dismissOverlays(page);
  const sessionButton = page.locator('button[title="Sessão Iniciada"]').first();
  if ((await sessionButton.count()) === 0) return 'botão de sessão "Sessão Iniciada" ausente';
  await sessionButton.click();
  const entry = page.getByRole('button', { name: 'Administração Guigui.com' }).first();
  try {
    await entry.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    return 'entrada "Administração Guigui.com" ausente (a conta não tem papel de administração?)';
  }
  await entry.click();
  await page.locator('aside').first().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(800);
  return null;
}

async function runAdminViews(page) {
  const results = [];
  const openError = await openAdminPanel(page);
  if (openError) return [{ view: 'admin', error: openError }];

  for (const moduleName of ADMIN_MODULES) {
    const button = page.locator('aside button').filter({ hasText: moduleName }).first();
    if ((await button.count()) === 0) {
      results.push({ view: `admin/${moduleName}`, error: 'módulo não encontrado na barra lateral' });
      continue;
    }
    await button.click();
    await page.waitForTimeout(700);
    await dismissOverlays(page);
    results.push({ ...(await auditCurrentView(page, `admin/${moduleName}`)) });
  }
  return results;
}

function printView(result, theme) {
  const prefix = `[${theme}] ${result.view}`;
  if (result.error) {
    console.log(`  ✗ ${prefix} — ${result.error}`);
    return;
  }
  const count = result.violations.length;
  if (count === 0) {
    if (VERBOSE) console.log(`  ✓ ${prefix}`);
    return;
  }
  console.log(`  ✗ ${prefix} — ${count} violação(ões)`);
  for (const violation of result.violations.slice(0, MAX_FINDINGS)) {
    if (violation.kind === 'text') {
      console.log(
        `      texto ${violation.ratio}:1 < ${violation.minimum}:1 — "${violation.text}" ` +
          `(${violation.foreground} sobre ${violation.background}, ${violation.fontSize}px) ${violation.selector}`,
      );
    } else {
      console.log(
        `      borda ${violation.side} ${violation.ratio}:1 < ${violation.minimum}:1 — ` +
          `${violation.foreground} sobre ${violation.background} ${violation.selector}`,
      );
    }
  }
  if (count > MAX_FINDINGS) console.log(`      … e mais ${count - MAX_FINDINGS}`);
  if (VERBOSE && result.known) {
    console.log(`      (${result.known} violação(ões) conhecida(s) ignorada(s) pela baseline)`);
  }
}

/**
 * Chave estável de uma violação na baseline. Não inclui ratio/cores de propósito:
 * um ajuste de tom não deve transformar dívida conhecida em violação nova. Inclui
 * `minimum` para que mudar --text-min/--control-min invalide a baseline.
 */
function violationKey(theme, view, violation) {
  return JSON.stringify([
    theme,
    view,
    violation.kind,
    violation.kind === 'control' ? violation.side : '',
    violation.selector,
    violation.text,
    violation.minimum,
  ]);
}

/** Lê o ficheiro de baseline e devolve o mapa chave -> ocorrências esperadas. */
function loadBaseline(filePath) {
  if (!existsSync(filePath)) {
    console.error(`\n✗ Baseline não encontrada em ${filePath}.`);
    console.error(
      '  Cria-a com o estado atual revisto: node scripts/audit-contrast.mjs --baseline=<ficheiro> --update-baseline\n',
    );
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`\n✗ Baseline ilegível em ${filePath}: ${error.message}\n`);
    process.exit(1);
  }
  const entries = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.entries) ? parsed.entries : null;
  if (!entries) {
    console.error(`\n✗ Baseline inválida em ${filePath}: falta o array "entries".\n`);
    process.exit(1);
  }
  const counts = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.key !== 'string') {
      console.error(`\n✗ Baseline inválida em ${filePath}: entrada sem "key" (volta a gerá-la com --update-baseline).\n`);
      process.exit(1);
    }
    const count = Math.max(1, Number(entry.count) || 1);
    counts.set(entry.key, (counts.get(entry.key) || 0) + count);
  }
  return counts;
}

/**
 * Divide as violações de uma vista entre conhecidas (dentro da baseline) e novas.
 * Uma chave repetida só conta como nova depois de esgotar as ocorrências registadas.
 */
function filterKnownViolations(result, theme, state) {
  if (result.error) return { ...result, known: 0 };
  const occurrences = new Map();
  const fresh = [];
  let known = 0;
  for (const violation of result.violations) {
    const key = violationKey(theme, result.view, violation);
    const occurrence = (occurrences.get(key) || 0) + 1;
    occurrences.set(key, occurrence);
    state.seen.set(key, Math.max(state.seen.get(key) || 0, occurrence));
    if (occurrence > (state.counts.get(key) || 0)) fresh.push(violation);
    else known += 1;
  }
  return { ...result, violations: fresh, known };
}

/** Agrupa as violações do relatório em entradas de baseline determinísticas. */
function collectBaselineEntries(report) {
  const groups = new Map();
  for (const { theme, views } of report) {
    for (const view of views) {
      if (view.error) continue;
      for (const violation of view.violations) {
        const key = violationKey(theme, view.view, violation);
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
          continue;
        }
        groups.set(key, {
          key,
          theme,
          view: view.view,
          kind: violation.kind,
          side: violation.kind === 'control' ? violation.side : undefined,
          selector: violation.selector,
          text: violation.text,
          minimum: violation.minimum,
          ratio: violation.ratio,
          foreground: violation.foreground,
          background: violation.background,
          fontSize: violation.fontSize,
          count: 1,
        });
      }
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.theme.localeCompare(b.theme) ||
      a.view.localeCompare(b.view) ||
      a.selector.localeCompare(b.selector) ||
      String(a.side || '').localeCompare(String(b.side || '')) ||
      a.text.localeCompare(b.text) ||
      a.kind.localeCompare(b.kind) ||
      a.minimum - b.minimum,
  );
}

/** Grava o estado atual no ficheiro de baseline. */
function writeBaseline(filePath, report) {
  const entries = collectBaselineEntries(report);
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    thresholds: { text: TEXT_MIN, largeText: LARGE_TEXT_MIN, control: CONTROL_MIN },
    entries,
  };
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return entries;
}

async function main() {
  if (!THEMES.length || !VIEWS.length) {
    console.error('Nada a auditar: usa --themes=light,dark e --views=public,admin.');
    process.exit(1);
  }

  // Carregar a baseline antes de abrir o browser: um ficheiro em falta ou inválido
  // deve falhar de imediato, não depois de percorrer todas as vistas.
  const baselineState =
    BASELINE_ACTIVE && !UPDATE_BASELINE ? { counts: loadBaseline(BASELINE_PATH), seen: new Map() } : null;

  await assertServerReachable();

  console.log(`\nAuditoria de contraste — ${BASE_URL}`);
  console.log(
    `Texto ≥ ${TEXT_MIN}:1 (grande ≥ ${LARGE_TEXT_MIN}:1) · bordas de controlo ≥ ${CONTROL_MIN}:1 · temas: ${THEMES.join(', ')} · vistas: ${VIEWS.join(', ')}\n`,
  );
  if (baselineState) {
    console.log(`Baseline: ${BASELINE_PATH} (${baselineState.counts.size} entrada(s) — só falham violações novas)\n`);
  } else if (UPDATE_BASELINE) {
    console.log(`Baseline: ${BASELINE_PATH} será reescrita com o estado atual\n`);
  }

  const browser = await chromium.launch({ headless: !HEADED });
  const report = [];
  let violations = 0;
  let errors = 0;
  let newViolations = 0;
  let knownViolations = 0;

  try {
    for (const theme of THEMES) {
      console.log(`[${theme}]`);
      const themeResults = [];

      const preparePage = async (context) => {
        const page = await context.newPage();
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await page.locator('button[aria-label="Feed Bissau"]').first().waitFor({ state: 'visible', timeout: 25_000 });
        await applyTheme(page, theme);
        return page;
      };

      const runInContext = async (context, runner) => {
        try {
          const page = await preparePage(context);
          themeResults.push(await runner(page));
        } catch (error) {
          themeResults.push({ view: 'aplicação', error: error.message });
        } finally {
          await context.close();
        }
      };

      if (VIEWS.includes('public') || VIEWS.includes('admin')) {
        try {
          const { context } = await createAuthenticatedContext(browser, theme);
          await runInContext(context, async (page) => {
            const results = [];
            if (VIEWS.includes('public')) results.push(...(await runPublicViews(page)));
            if (VIEWS.includes('admin')) results.push(...(await runAdminViews(page)));
            return results;
          });
        } catch (error) {
          console.error(`\n[${theme}] ✗ ${error.message}\n`);
          errors += 1;
        }
      }

      if (VIEWS.includes('login')) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-PT' });
        await runInContext(context, (page) => runLoginView(page));
      }

      for (const role of ['citizen', 'business']) {
        if (!VIEWS.includes(role)) continue;
        try {
          const { context } = await createAuthenticatedContext(browser, theme, ROLE_ACCOUNTS[role]);
          await runInContext(context, (page) => runAccountView(page, role));
        } catch (error) {
          themeResults.push({ view: `conta/${role}`, error: error.message });
        }
      }

      const views = themeResults.flat();
      for (const result of views) {
        const shown = baselineState ? filterKnownViolations(result, theme, baselineState) : result;
        printView(shown, theme);
        if (!shown.error) {
          if (baselineState) {
            newViolations += shown.violations.length;
            knownViolations += shown.known;
          }
        }
      }
      report.push({ theme, views });

      for (const result of views) {
        if (result.error) errors += 1;
        else violations += result.violations.length;
      }
    }
  } finally {
    await browser.close();
  }

  if (JSON_OUT) {
    const path = typeof JSON_OUT === 'string' ? JSON_OUT : '.contrast-report.json';
    writeFileSync(path, JSON.stringify({ baseUrl: BASE_URL, thresholds: { text: TEXT_MIN, largeText: LARGE_TEXT_MIN, control: CONTROL_MIN }, themes: report }, null, 2));
    console.log(`\nRelatório JSON: ${path}`);
  }

  const audited = report.reduce((total, theme) => total + theme.views.filter((view) => !view.error).length, 0);

  if (UPDATE_BASELINE) {
    const entries = writeBaseline(BASELINE_PATH, report);
    const recorded = entries.reduce((total, entry) => total + entry.count, 0);
    console.log(
      `\nBaseline gravada em ${BASELINE_PATH} — ${entries.length} entrada(s), ${recorded} violação(ões) conhecida(s).`,
    );
    if (errors > 0) {
      console.log(`✗ ${errors} vista(s) inacessível(is) continuam a falhar mesmo com baseline.\n`);
      process.exit(1);
    }
    console.log('  Revê o diff: a baseline só deve conter dívida já conhecida.\n');
    process.exit(0);
  }

  if (baselineState) {
    const fixed = [...baselineState.counts]
      .filter(([key]) => !baselineState.seen.has(key))
      .reduce((total, [, count]) => total + count, 0);
    const summary = [];
    if (knownViolations > 0) summary.push(`${knownViolations} conhecida(s) ignorada(s)`);
    if (fixed > 0) summary.push(`${fixed} já não detetada(s)`);
    const detail = summary.length ? ` (${summary.join(', ')})` : '';

    if (newViolations === 0 && errors === 0) {
      console.log(`\n✓ Sem violações novas de contraste em ${audited} vista(s)${detail}.\n`);
      process.exit(0);
    }
    console.log(
      `\n✗ ${newViolations} violação(ões) nova(s) de contraste e ${errors} vista(s) inacessível(is)` +
        `${detail} — corrige-as ou atualiza a baseline de propósito.\n`,
    );
    process.exit(1);
  }

  if (violations === 0 && errors === 0) {
    console.log(`\n✓ Sem violações de contraste em ${audited} vista(s).\n`);
    process.exit(0);
  }
  console.log(
    `\n✗ ${violations} violação(ões) de contraste e ${errors} vista(s) inacessível(is) — corrige a paleta antes de publicar.\n`,
  );
  process.exit(1);
}

main().catch((error) => {
  console.error('Falha inesperada na auditoria de contraste:', error);
  process.exit(1);
});
