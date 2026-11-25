import { expect, test, type Page } from './fixtures';

/**
 * Centro de controlo individual de eventos.
 * Verifica o contrato real das APIs (empresa e Super Admin), a consistência dos
 * números com a bilheteira existente, as exportações PDF/XLSX/CSV e a navegação
 * dos oito submódulos no painel.
 */

const BUSINESS = { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' };
const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };
const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };

const OWN_EVENT = 'evt-1';
const OTHER_EVENT = 'evt-5';

async function signIn(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload;
}

async function signInUi(page: Page, account: { email: string; password: string }) {
  const payload = await signIn(page, account);
  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

test.describe('Centro de controlo do evento — API', () => {
  test('empresa abre o seu evento com dados reais', async ({ page }) => {
    await signIn(page, BUSINESS);
    const response = await page.request.get(`/api/events/${OWN_EVENT}/control-center`);
    expect(response.ok(), await response.text()).toBeTruthy();
    const { data } = await response.json();

    expect(data.event.id).toBe(OWN_EVENT);
    expect(data.event.title).toContain('Festival');
    expect(data.ticketTypes.length).toBeGreaterThan(0);
    expect(data.tickets.length).toBeGreaterThan(0);
    expect(data.buyers.length).toBeGreaterThan(0);
    expect(data.indicators.capacity).toBeGreaterThan(0);
    expect(data.indicators.sold).toBeGreaterThan(0);
    expect(data.finance.paidOrders).toBeGreaterThan(0);
    expect(data.indicators.sold + data.indicators.available).toBeLessThanOrEqual(data.indicators.capacity);
  });

  test('os valores coincidem com a bilheteira existente', async ({ page }) => {
    await signIn(page, BUSINESS);
    const [control, sold] = await Promise.all([
      page.request.get(`/api/events/${OWN_EVENT}/control-center`),
      page.request.get(`/api/tickets/sold?eventId=${OWN_EVENT}`),
    ]);
    expect(control.ok(), await control.text()).toBeTruthy();
    expect(sold.ok(), await sold.text()).toBeTruthy();
    const { data } = await control.json();
    const sales = await sold.json();

    // A receita do centro de controlo vem dos pedidos pagos e tem de coincidir
    // com a receita da lista de bilhetes vendidos (mesmos bilhetes válidos/usados).
    expect(data.finance.grossXOF).toBe(sales.totals.revenueXOF);
    expect(data.indicators.sold).toBe(sales.totals.valid + sales.totals.used);
    expect(data.indicators.used).toBe(sales.totals.used);
    expect(data.indicators.unused).toBe(sales.totals.valid);
    expect(data.indicators.cancelled).toBe(sales.totals.cancelled);
  });

  test('empresa não acede ao evento de outra empresa', async ({ page }) => {
    await signIn(page, BUSINESS);
    const read = await page.request.get(`/api/events/${OTHER_EVENT}/control-center`);
    expect(read.status()).toBe(403);
    const exported = await page.request.get(`/api/events/${OTHER_EVENT}/control-center/export?format=csv`);
    expect(exported.status()).toBe(403);
  });

  test('cidadão não acede ao centro de controlo', async ({ page }) => {
    await signIn(page, CITIZEN);
    const read = await page.request.get(`/api/events/${OWN_EVENT}/control-center`);
    expect(read.status()).toBe(403);
  });

  test('Super Admin acede a eventos de qualquer empresa', async ({ page }) => {
    await signIn(page, ADMIN);
    const response = await page.request.get(`/api/events/${OTHER_EVENT}/control-center`);
    expect(response.ok(), await response.text()).toBeTruthy();
    const { data } = await response.json();
    expect(data.event.id).toBe(OTHER_EVENT);
  });

  test('exportações PDF, Excel e CSV são ficheiros válidos', async ({ page }) => {
    await signIn(page, BUSINESS);
    const base = `/api/events/${OWN_EVENT}/control-center/export`;
    const csv = await page.request.get(`${base}?format=csv&sections=summary,finance,buyers`);
    expect(csv.ok(), await csv.text()).toBeTruthy();
    expect(csv.headers()['content-type']).toContain('text/csv');
    const csvText = (await csv.body()).toString('utf8');
    expect(csvText).toContain('Resumo');
    expect(csvText).toContain('Compradores');

    const xlsx = await page.request.get(`${base}?format=xlsx&sections=summary,buyers,finance`);
    expect(xlsx.ok(), await xlsx.text()).toBeTruthy();
    expect(xlsx.headers()['content-type']).toContain('spreadsheetml');
    const xlsxBody = await xlsx.body();
    expect(xlsxBody.subarray(0, 2).toString('utf8')).toBe('PK');

    const pdf = await page.request.get(`${base}?format=pdf&sections=summary,finance`);
    expect(pdf.ok(), await pdf.text()).toBeTruthy();
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });

  test('exportação respeita os filtros aplicados no painel', async ({ page }) => {
    await signIn(page, BUSINESS);
    const snapshot = await page.request.get(`/api/events/${OWN_EVENT}/control-center`);
    expect(snapshot.ok(), await snapshot.text()).toBeTruthy();
    const { data } = await snapshot.json();
    expect(data.buyers.length).toBeGreaterThan(1);

    const first = data.buyers[0];
    const other = data.buyers.find((buyer: { name: string }) => buyer.name !== first.name);
    expect(other).toBeTruthy();

    const filtered = await page.request.get(
      `/api/events/${OWN_EVENT}/control-center/export?format=csv&sections=buyers&buyerQuery=${encodeURIComponent(first.orderId)}`,
    );
    expect(filtered.ok(), await filtered.text()).toBeTruthy();
    const csv = (await filtered.body()).toString('utf8');
    expect(csv).toContain(first.orderId);
    if (other) expect(csv).not.toContain(other.orderId);

    // Nenhuma validação rejeitada pode aparecer quando o filtro é "accepted".
    const accepted = await page.request.get(
      `/api/events/${OWN_EVENT}/control-center/export?format=csv&sections=validations&validationResult=accepted`,
    );
    expect(accepted.ok(), await accepted.text()).toBeTruthy();
    const acceptedCsv = (await accepted.body()).toString('utf8');
    expect(acceptedCsv).not.toContain('rejected');
    expect(acceptedCsv).not.toContain('"rejeitada"');
  });

  test('exportação de bilhetes aplica estado e pesquisa e documenta os filtros', async ({ page }) => {
    await signIn(page, BUSINESS);
    const snapshot = await page.request.get(`/api/events/${OWN_EVENT}/control-center`);
    expect(snapshot.ok(), await snapshot.text()).toBeTruthy();
    const { data } = await snapshot.json();
    const used = data.tickets.find((ticket: { status: string }) => ticket.status === 'used');
    const valid = data.tickets.find((ticket: { status: string }) => ticket.status === 'valid');
    expect(used).toBeTruthy();
    expect(valid).toBeTruthy();

    const filtered = await page.request.get(
      `/api/events/${OWN_EVENT}/control-center/export?format=csv&sections=tickets&ticketStatus=used&ticketQuery=${encodeURIComponent(used.ticketCode)}`,
    );
    expect(filtered.ok(), await filtered.text()).toBeTruthy();
    const csv = (await filtered.body()).toString('utf8');
    expect(csv).toContain(used.ticketCode);
    if (valid) expect(csv).not.toContain(valid.ticketCode);
    // O detalhe filtrado substitui a lista completa, mas mantém o resumo por tipo.
    expect(csv).toContain('Bilhetes (detalhe filtrado)');
    expect(csv).toContain('Bilhetes (por tipo)');
    // O relatório declara o âmbito usado.
    expect(csv).toContain('Filtros aplicados');
    expect(csv).toContain('Pesquisa de bilhetes');
    expect(csv).toContain('Estado do bilhete');
    expect(csv).toContain('Utilizado');
  });

  test('cada pesquisa filtra apenas a sua lista na exportação', async ({ page }) => {
    await signIn(page, BUSINESS);
    const snapshot = await page.request.get(`/api/events/${OWN_EVENT}/control-center`);
    expect(snapshot.ok(), await snapshot.text()).toBeTruthy();
    const { data } = await snapshot.json();
    const ticket = data.tickets[0];
    const buyer = data.buyers[0];
    const otherBuyer = data.buyers.find(
      (candidate: { orderId: string }) => candidate.orderId !== buyer.orderId,
    );
    expect(ticket).toBeTruthy();
    expect(otherBuyer).toBeTruthy();

    // A pesquisa de bilhetes não pode filtrar nem esvaziar a lista de compradores.
    const ticketSearch = await page.request.get(
      `/api/events/${OWN_EVENT}/control-center/export?format=csv&sections=tickets,buyers&ticketQuery=${encodeURIComponent(ticket.ticketCode)}`,
    );
    expect(ticketSearch.ok(), await ticketSearch.text()).toBeTruthy();
    const ticketCsv = (await ticketSearch.body()).toString('utf8');
    expect(ticketCsv).toContain(ticket.ticketCode);
    expect(ticketCsv).toContain(otherBuyer.orderId);
    expect(ticketCsv).toContain('Pesquisa de bilhetes');
    expect(ticketCsv).toContain('Pesquisa de compradores');

    // A pesquisa de compradores restringe os compradores, mas não os bilhetes.
    const buyerSearch = await page.request.get(
      `/api/events/${OWN_EVENT}/control-center/export?format=csv&sections=tickets,buyers&buyerQuery=${encodeURIComponent(buyer.orderId)}`,
    );
    expect(buyerSearch.ok(), await buyerSearch.text()).toBeTruthy();
    const buyerCsv = (await buyerSearch.body()).toString('utf8');
    expect(buyerCsv).toContain(buyer.orderId);
    expect(buyerCsv).not.toContain(otherBuyer.orderId);
    expect(buyerCsv).toContain(ticket.ticketCode);
  });

  test('formato de exportação inválido é rejeitado', async ({ page }) => {
    await signIn(page, BUSINESS);
    const response = await page.request.get(`/api/events/${OWN_EVENT}/control-center/export?format=doc`);
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe('INVALID_EXPORT_FORMAT');
  });
});

test.describe('Centro de controlo do evento — painel', () => {
  test('empresa abre o evento e percorre os submódulos', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signInUi(page, BUSINESS);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Visão Geral/i }).first()).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
      document.querySelectorAll('[role="dialog"][aria-labelledby="welcome-tour-title"]').forEach((node) => node.remove());
    });

    await page.locator('aside').getByRole('button', { name: /^Eventos/ }).first().click();
    await expect(page.getByText(/Eventos de /i).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Centro de controlo/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /Centro de controlo de/i });
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText(/Festival|Noite|Evento/i);

    const nav = dialog.getByRole('navigation', { name: 'Submódulos do evento' });
    await expect(nav.getByRole('button')).toHaveCount(8);
    await expect(dialog.getByText('Arrecadação bruta')).toBeVisible();

    await nav.getByRole('button', { name: 'Bilhetes e Vendas' }).click();
    await expect(dialog.getByLabel('Pesquisar bilhetes do evento')).toBeVisible();

    await nav.getByRole('button', { name: 'Compradores' }).click();
    await expect(dialog.getByLabel('Pesquisar compradores do evento')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Exportar CSV/i })).toBeVisible();

    await nav.getByRole('button', { name: 'Validação' }).click();
    await expect(dialog.getByText('Bilhetes utilizados')).toBeVisible();

    await nav.getByRole('button', { name: 'Financeiro' }).click();
    await expect(dialog.getByText('Comissão Guigui.com')).toBeVisible();

    await nav.getByRole('button', { name: 'Relatórios' }).click();
    await expect(dialog.getByRole('button', { name: /Descarregar PDF/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Descarregar Excel/i })).toBeVisible();

    await nav.getByRole('button', { name: 'Histórico' }).click();
    await expect(nav.getByRole('button', { name: 'Histórico' })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('button', { name: 'Configurações' }).click();
    await expect(dialog.getByText('Configuração do evento')).toBeVisible();

    expect(errors.filter((message) => !/WebSocket|vite/i.test(message))).toEqual([]);
  });

  test('Super Admin abre o centro de controlo a partir da gestão de eventos', async ({ page }) => {
    await signInUi(page, ADMIN);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Visão Geral/i }).first()).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
      document.querySelectorAll('[role="dialog"][aria-labelledby="welcome-tour-title"]').forEach((node) => node.remove());
    });

    await page.getByRole('button', { name: /Eventos e Bilhetes/ }).first().click();
    // O módulo abre primeiro o hub com os dois submódulos (Eventos / Bilhetes).
    await page.getByRole('button').filter({ hasText: /Eventos/ }).filter({ hasNotText: /Bilhetes/ }).last().click();
    await expect(page.getByText(/Gestão de eventos/i).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Centro de controlo/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /Centro de controlo de/i });
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByText('Super Admin')).toBeVisible();
    await expect(dialog.getByText('Arrecadação bruta')).toBeVisible();
  });
});
