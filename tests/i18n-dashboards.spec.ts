import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Validação i18n do painel da empresa com Playwright.
 *
 * As verificações derivam de `i18n-specs/business-dashboard.json` (o mesmo
 * ficheiro que o extrator aplicou):
 *
 * 1. Marcadores do menu — as etiquetas da barra lateral têm de aparecer no
 *    idioma activo, o que prova que o painel carregou mesmo traduzido.
 * 2. Fuga de português — com o idioma activo diferente de português, nenhuma
 *    string migrada pode aparecer na forma portuguesa. Só falha quando o texto
 *    errado está realmente visível, por isso não depende de tudo renderizar.
 * 3. Cobertura — relatório informativo de quantas strings do idioma activo
 *    apareceram, para medir secções por migrar sem tornar o teste frágil.
 *
 * Corre num único teste que percorre os idiomas, e não em cinco testes, porque
 * a preferência de idioma vive no servidor associada ao utilizador de
 * demonstração partilhado: percorrer os idiomas de cada vez mantém o estado
 * coerente e, ao acumular os problemas, mostra todos os idiomas de uma vez em
 * vez de parar no primeiro.
 *
 * Nota de manutenção: o botão de sessão e a entrada "Área da Minha Empresa"
 * continuam escritos em português no Navbar (dívida i18n por migrar), por isso
 * servem de selector estável. Quando o Navbar for migrado, actualizar aqui.
 */

const DEMO_PASSWORD = 'Guigui@2026!';
const DEMO_BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const SPEC_PATH = path.resolve('i18n-specs/business-dashboard.json');

type Site = { line: number; index: number; key: string; pt: string; en: string; fr: string; es: string };

const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8')) as { sites: Site[] };

const LANGUAGES = ['pt', 'en', 'fr', 'es'] as const;
type Language = (typeof LANGUAGES)[number];

/** Etiquetas do menu lateral criadas na migração; têm de mudar com o idioma. */
const NAV_LABELS: Record<Language, string[]> = {
  pt: ['Avaliações', 'Levantamentos', 'Clientes', 'Segurança'],
  en: ['Reviews', 'Collections', 'Customers', 'Security'],
  fr: ['Avis', 'Retraits', 'Clients', 'Sécurité'],
  es: ['Evaluaciones', 'Recogidas', 'Clientes', 'Seguridad'],
};

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Só strings migradas e compridas: fragmentos curtos confundem-se com etiquetas. */
const leakCandidates = (language: Language) => [
  ...new Set(
    spec.sites
      .filter((site) => site[language] && normalize(site[language]) !== normalize(site.pt))
      .map((site) => normalize(site.pt))
      .filter((value) => value.length >= 8),
  ),
];

/** Trecho visível em volta da fuga: sem isto, saber onde traduzir é adivinhação. */
const snippet = (text: string, at: number, value: string) =>
  text.slice(Math.max(0, at - 45), at + value.length + 25).replace(/\s+/g, ' ').trim();

async function saveLanguagePreference(request: APIRequestContext, userId: string, language: Language) {
  const response = await request.post(`/api/app-state/user_language_${userId}`, {
    data: { value: { language, updatedAt: new Date().toISOString() } },
  });
  expect(response.ok(), `não foi possível guardar a preferência de idioma (${language})`).toBeTruthy();
}

/**
 * O App sincroniza o idioma do utilizador autenticado com a chave de app-state
 * `user_language_<id>` (App.tsx), que tem prioridade sobre o localStorage. Sem
 * escrever aqui, o browser do Playwright deixaria o painel no idioma anterior.
 */
async function signIn(page: Page, language: Language, { retries = 3, baseDelayMs = 4000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await page.request.post('/api/auth/login', {
      data: { email: DEMO_BUSINESS_EMAIL, password: DEMO_PASSWORD },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok()) {
      // Injeta o cookie de sessão para chamadas API subsequentes via page.request
      const setCookie = response.headers()['set-cookie'];
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
      await saveLanguagePreference(page.request, payload.user.id, language);
      const user = { ...payload.user, preferredLanguage: language };
      await page.addInitScript(
        ({ user, lang }) => {
          window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
          window.localStorage.setItem('guigui_current_lang', JSON.stringify(lang));
        },
        { user, lang: language },
      );
      return;
    }
    const code = (payload as { code?: string }).code;
    if (code !== 'RATE_LIMITED' || attempt === retries) {
      expect(response.ok(), `login de demonstração falhou: ${JSON.stringify(payload)}`).toBeTruthy();
    }
    await page.waitForTimeout(baseDelayMs * (attempt + 1));
  }
}

/**
 * A conta de empresa abre o painel automaticamente depois de carregar; o menu
 * de sessão só é preciso quando isso não acontece. Esperar pelo cabeçalho antes
 * de clicar evita o clique durante a montagem.
 */
async function openBusinessDashboard(page: Page) {
  const dashboard = page.locator('.guigui-profile-dashboard');
  await expect(page.locator('header.guigui-navbar')).toBeVisible({ timeout: 20_000 });
  if (await dashboard.isVisible().catch(() => false)) {
    await expect(dashboard).toBeVisible();
    return;
  }
  const session = page.getByTitle('Sessão Iniciada');
  await expect(session).toBeVisible({ timeout: 20_000 });
  await session.click();
  const entry = page.locator('button', { hasText: 'Área da Minha Empresa' }).filter({ visible: true }).first();
  await entry.click({ timeout: 10_000 });
  await expect(dashboard).toBeVisible();
}

/**
 * Percorre as secções da barra lateral e recolhe o texto visível de cada uma.
 * A recolha é feita por secção (e não só no fim) porque cada clique troca o
 * conteúdo do painel.
 */
async function collectDashboardText(page: Page) {
  const container = page.locator('.guigui-profile-dashboard');
  const chunks: string[] = [await container.innerText()];
  // Filtra os botões de colapso do menu (Recolher menu / Fechar menu lateral),
  // pois clicá-los esconde a sidebar e as etiquetas deixam de ser visíveis.
  const entries = container.locator('aside button').filter({
    has: page.locator('span, div, svg'),
    hasNotText: /menu/i,
  });
  const total = await entries.count();
  for (let index = 0; index < total; index += 1) {
    const entry = entries.nth(index);
    if (!(await entry.isVisible())) continue;
    await entry.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(180);
    chunks.push(await container.innerText());
  }
  return chunks.join('\n');
}

test('painel da empresa traduzido nos 4 idiomas', async ({ browser }, testInfo) => {
  test.setTimeout(480_000);
  const baseURL = testInfo.project.use.baseURL as string;
  const problems: string[] = [];

  for (const language of LANGUAGES) {
    // Contexto novo por idioma: o localStorage do idioma anterior não pode
    // sobreviver e anular a preferência que acabámos de guardar no servidor.
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      await signIn(page, language);
      await page.goto(new URL('/', baseURL).href);
      await openBusinessDashboard(page);
      const text = await collectDashboardText(page);

      await testInfo.attach(`painel-da-empresa-${language}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      // 1. O painel só conta se estiver mesmo no idioma pedido.
      for (const label of NAV_LABELS[language]) {
        if (!text.includes(label)) problems.push(`[${language}] etiqueta do menu ausente: ${label}`);
      }

      // 2. Fuga de português, com o texto à volta para apontar onde traduzir.
      if (language !== 'pt') {
        for (const value of leakCandidates(language)) {
          const at = text.indexOf(value);
          if (at >= 0) problems.push(`[${language}] fuga "${value}" perto de: …${snippet(text, at, value)}…`);
        }
      }

      // 3. Cobertura (relatório): o que ficou visível no idioma activo.
      const expected = [
        ...new Set(spec.sites.map((site) => normalize(site[language] || site.pt)).filter((value) => value.length > 3)),
      ];
      const visible = expected.filter((value) => text.includes(value));
      console.log(`[i18n] ${language}: ${visible.length}/${expected.length} strings visíveis no painel`);
    } finally {
      await context.close();
    }
  }

  expect(problems, `idiomas com problemas:\n${problems.join('\n')}`).toEqual([]);
});

// Devolve a conta de demonstração ao idioma por omissão para não deixar o
// estado partilhado alterado depois da passagem.
test.afterAll(async ({ request }) => {
  const login = await request.post('/api/auth/login', {
    data: { email: DEMO_BUSINESS_EMAIL, password: DEMO_PASSWORD },
  });
  if (!login.ok()) return;
  const { user } = (await login.json()) as { user: { id: string } };
  await saveLanguagePreference(request, user.id, 'pt');
});
