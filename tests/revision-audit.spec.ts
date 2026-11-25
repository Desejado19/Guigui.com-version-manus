import { expect, test, type Page } from './fixtures';

/**
 * Revisão funcional dos pontos alterados: faturação mensal, paginação do
 * histórico de segurança, exportações por secções nos centros de controlo e
 * integração do módulo Exportação dentro de Relatórios.
 */

const PASSWORD = 'Guigui@2026!';
const BUSINESS = { email: 'empresa.teste@guigui.com', password: PASSWORD };
const ADMIN = { email: 'admin.teste@guigui.com', password: PASSWORD };
const OWN_EVENT = 'evt-1';

async function signIn(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload as { user: Record<string, unknown> };
}

async function signInUi(page: Page, account: { email: string; password: string }) {
  const payload = await signIn(page, account);
  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

async function openBusinessDashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Sessão Iniciada').click();
  await page.getByRole('button', { name: /Área da Minha Empresa/ }).first().click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
}

test.describe('Faturação mensal do Super Admin', () => {
  test('API devolve valores por mês coerentes com o total do mês', async ({ page }) => {
    await signIn(page, ADMIN);
    const response = await page.request.get('/api/admin/stats');
    expect(response.ok(), await response.text()).toBeTruthy();
    const stats = await response.json() as {
      revenue: {
        thisMonthXOF: number;
        commissionThisMonthXOF: number;
        pendingXOF: number;
        byMonthStatus: Array<{ month: string; confirmed: number | string; pending: number | string; commission: number | string }>;
      };
    };
    expect(Array.isArray(stats.revenue.byMonthStatus)).toBe(true);
    expect(stats.revenue.byMonthStatus.length).toBeGreaterThan(0);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const current = stats.revenue.byMonthStatus.find((row) => row.month === currentMonth);
    const totalConfirmed = stats.revenue.byMonthStatus.reduce((sum, row) => sum + Number(row.confirmed || 0), 0);
    const totalCommission = stats.revenue.byMonthStatus.reduce((sum, row) => sum + Number(row.commission || 0), 0);
    expect(totalConfirmed).toBeGreaterThan(0);
    expect(stats.revenue.thisMonthXOF).toBe(Number(current?.confirmed || 0));
    expect(stats.revenue.commissionThisMonthXOF).toBe(Number(current?.commission || 0));
    expect(totalCommission).toBeLessThanOrEqual(totalConfirmed);
  });

  test('Visão Geral mostra o cartão de faturação com um valor, não uma secção quebrada', async ({ page }) => {
    await signInUi(page, ADMIN);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Visão geral/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Faturação do mês').first()).toBeVisible({ timeout: 20_000 });

    const card = page.getByText('Faturação do mês').first().locator('xpath=ancestor::*[self::button or self::article or self::div][1]');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText('—');
  });
});

test.describe('Segurança e Privacidade — paginação real', () => {
  test('20 registos por omissão, página 2 e pesquisa no backend', async ({ page }) => {
    await signIn(page, BUSINESS);

    const first = await page.request.get('/api/security/events');
    expect(first.ok(), await first.text()).toBeTruthy();
    const page1 = await first.json() as {
      events: unknown[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    expect(page1.pageSize).toBe(20);
    expect(page1.page).toBe(1);
    expect(page1.events.length).toBeLessThanOrEqual(20);
    expect(page1.totalPages).toBe(Math.max(Math.ceil(page1.total / 20), 1));

    const second = await page.request.get('/api/security/events?page=2&pageSize=20');
    expect(second.ok(), await second.text()).toBeTruthy();
    const page2 = await second.json() as { events: Array<{ id: string }>; page: number; pageSize: number };
    expect(page2.page).toBe(2);
    expect(page2.pageSize).toBe(20);
    if (page1.total > 20) {
      const firstIds = new Set((page1.events as Array<{ id: string }>).map((event) => event.id));
      expect(page2.events.some((event) => firstIds.has(event.id))).toBe(false);
    }

    const searched = await page.request.get('/api/security/events?page=1&pageSize=20&search=login');
    expect(searched.ok(), await searched.text()).toBeTruthy();
    const searchPayload = await searched.json() as { events: Array<{ action: string; resource: string; resourceId: string; reason: string | null }>; total: number };
    expect(searchPayload.events.every((event) =>
      [event.action, event.resource, event.resourceId, event.reason ?? ''].some((value) => value.toLowerCase().includes('login')),
    )).toBe(true);
  });

  test('UI usa a paginação do servidor e repete a pesquisa', async ({ page }) => {
    await signInUi(page, BUSINESS);
    await openBusinessDashboard(page);
    await page.getByRole('button', { name: /^(Segurança|Seguridad)$/ }).first().click();
    await expect(page.getByRole('heading', { name: /Alterar palavra-passe|Cambiar contraseña/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /Histórico de segurança/i }).click();
    const history = page.locator('table').last();
    await expect(history.locator('tbody tr')).not.toHaveCount(0);
    const pagination = page.getByRole('navigation', { name: /paginação|paginación/i }).last();
    await expect(pagination).toBeVisible();
    await expect(pagination).toContainText('20');
  });
});

test.describe('Centro de controlo — exportação apenas das secções escolhidas', () => {
  for (const account of [
    { name: 'Empresa', credentials: BUSINESS },
    { name: 'Super Admin', credentials: ADMIN },
  ]) {
    test(`${account.name}: CSV contém só a secção selecionada`, async ({ page }) => {
      await signIn(page, account.credentials);
      const base = `/api/events/${OWN_EVENT}/control-center/export`;

      const onlyBuyers = await page.request.get(`${base}?format=csv&sections=buyers`);
      expect(onlyBuyers.ok(), await onlyBuyers.text()).toBeTruthy();
      const buyersCsv = (await onlyBuyers.body()).toString('utf8');
      expect(buyersCsv).toContain('Compradores');
      expect(buyersCsv).not.toContain('Resumo');
      expect(buyersCsv).not.toContain('Bilhetes (por tipo)');
      expect(buyersCsv).not.toContain('Filtros aplicados');

      const onlySummary = await page.request.get(`${base}?format=csv&sections=summary`);
      expect(onlySummary.ok(), await onlySummary.text()).toBeTruthy();
      const summaryCsv = (await onlySummary.body()).toString('utf8');
      expect(summaryCsv).toContain('Resumo');
      expect(summaryCsv).not.toContain('Compradores');
      expect(summaryCsv).not.toContain('Bilhetes (por tipo)');

      const none = await page.request.get(`${base}?format=csv&sections=`);
      expect(none.status()).toBe(400);
      expect((await none.json()).code).toBe('EXPORT_SECTIONS_REQUIRED');
    });
  }
});

test.describe('Exportação integrada em Relatórios', () => {
  test('a navegação já não tem Exportação e o histórico abre dentro de Relatórios', async ({ page }) => {
    await signInUi(page, BUSINESS);
    await openBusinessDashboard(page);

    await expect(page.locator('aside').getByRole('button', { name: 'Exportação', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: /^(Relatórios|Informes)$/ }).first().click();
    await expect(page.getByRole('button', { name: 'Exportação de dados' })).toBeVisible();
    await page.getByRole('button', { name: 'Exportação de dados' }).click();

    await expect(page.getByTestId('prepare-export')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Histórico de exportações' })).toBeVisible();
  });
});

test.describe('Tema claro — contraste de Suporte', () => {
  test('textos secundários do Suporte têm contraste suficiente sobre a superfície clara', async ({ page }) => {
    await signInUi(page, BUSINESS);
    await openBusinessDashboard(page);
    await page.getByRole('button', { name: /^(Suporte|Soporte)$/ }).first().click();

    const sample = page.locator('.guigui-message-bubble').first();
    await expect(sample).toBeVisible({ timeout: 20_000 });
    const result = await sample.evaluate((card) => {
      const parse = (value: string) => {
        const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
      };
      const luminance = ([r, g, b]: number[]) => {
        const channel = (value: number) => {
          const normalized = value / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const textNode = card.querySelector('span') || card;
      const color = parse(window.getComputedStyle(textNode).color);
      const background = parse(window.getComputedStyle(card).backgroundColor) || [255, 255, 255];
      if (!color) return { ratio: 0, color: null };
      const light = Math.max(luminance(color), luminance(background));
      const dark = Math.min(luminance(color), luminance(background));
      return { ratio: (light + 0.05) / (dark + 0.05), color };
    });

    expect(result.color, 'a cor do texto deve ser mensurável').not.toBeNull();
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('Tema escuro — centros de controlo sem efeitos de vidro', () => {
  test('o diálogo do evento não usa backdrop-filter nem superfícies glass', async ({ page }) => {
    await signInUi(page, BUSINESS);
    await openBusinessDashboard(page);
    await page.evaluate(() => {
      window.localStorage.setItem('guigui_theme', JSON.stringify('dark'));
      document.documentElement.classList.add('dark');
    });

    await page.locator('aside').getByRole('button', { name: /^Eventos$/ }).first().click();
    await expect(page.getByText(/Eventos de /i).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Centro de controlo|Centro de control/i }).first().click();
    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    const glass = await dialog.evaluate((root) =>
      Array.from(root.querySelectorAll('*')).filter((node) => {
        const style = window.getComputedStyle(node) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        return (style.backdropFilter && style.backdropFilter !== 'none')
          || (style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none')
          || /glass/i.test(node.className?.toString() ?? '');
      }).length,
    );
    expect(glass).toBe(0);
  });
});
