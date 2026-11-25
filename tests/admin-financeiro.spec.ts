import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const BASE = process.env.PW_PORT ? `http://localhost:${process.env.PW_PORT}` : 'http://localhost:3000';

let db: Pool;
const fixtureIds: string[] = [];
let originalOperators: Array<Record<string, unknown>> = [];

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await db.query("SELECT * FROM payment_operator_configs WHERE provider IN ('orange_money','telecel') ORDER BY provider");
  originalOperators = result.rows;
});

test.afterEach(async () => {
  for (const id of fixtureIds.splice(0)) {
    await db.query('DELETE FROM refunds WHERE transaction_id = $1', [id]);
    await db.query('DELETE FROM payment_reconciliations WHERE transaction_id = $1', [id]);
    await db.query('DELETE FROM payment_manual_actions WHERE transaction_id = $1', [id]);
    await db.query('DELETE FROM payment_events WHERE transaction_id = $1', [id]);
    await db.query('DELETE FROM payment_transactions WHERE id = $1', [id]);
  }
});

test.afterAll(async () => {
  for (const operator of originalOperators) {
    await db.query(
      `UPDATE payment_operator_configs
          SET dedicated_phone=$2, integration_status=$3, api_base_url=$4, webhook_path=$5,
              api_version=$6, supports_auto_push_otp=$7, notes=$8, updated_at=NOW()
        WHERE provider=$1`,
      [
        operator.provider,
        operator.dedicated_phone,
        operator.integration_status,
        operator.api_base_url,
        operator.webhook_path,
        operator.api_version,
        operator.supports_auto_push_otp,
        operator.notes,
      ],
    );
  }
  await db.end();
});

async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  // O idioma guardado no servidor sobrepõe-se ao localStorage ao abrir a app.
  // A suite usa rótulos em português, por isso remove essa preferência antiga.
  // O idioma guardado no servidor sobrepõe-se ao localStorage ao abrir a app.
  // Esta suite usa rótulos em português; intercepta apenas a leitura/escrita
  // dessa chave neste browser, sem alterar a preferência partilhada da conta.
  const languageKey = `user_language_${payload.user.id}`;
  await page.route(`**/api/app-state/${languageKey}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ value: { language: 'pt' } }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.continue();
  });
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

async function enterAdmin(page: Page) {
  await page.goto('/');
  if (!(await page.getByText('PAINEL ADMINISTRATIVO').count())) {
    await page.locator('button[title="Sessão Iniciada"]').first().click();
    await page.getByRole('button', { name: 'Administração Guigui.com' }).click();
  }
  await expect(page.getByText('PAINEL ADMINISTRATIVO').first()).toBeVisible({ timeout: 20000 });
}

async function openFinance(page: Page) {
  await enterAdmin(page);
  await page.locator('aside').getByRole('button', { name: /^Financeiro/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Financeiro', exact: true }).first()).toBeVisible();
}

async function openSection(page: Page, button: RegExp) {
  await page.getByRole('button', { name: button }).click();
}

function transactionCountLabel(count: number, page = 1) {
  const totalPages = Math.max(1, Math.ceil(count / 20));
  return `${count} registo(s) · página ${page} de ${totalPages}`;
}

async function createTransaction(overrides: {
  status?: string;
  providerMode?: string | null;
  amountXOF?: number;
  useCase?: string;
  suffix?: string;
}) {
  const id = `TXN-PW-FIN-${overrides.suffix || randomUUID().slice(0, 8)}`;
  fixtureIds.push(id);
  await db.query(
    `INSERT INTO payment_transactions
       (id, provider, provider_reference, status, gross_amount_xof, net_amount_xof, payer_name, payer_phone,
        use_case, provider_mode, confirmed_at, created_at, updated_at)
     VALUES ($1,'orange_money',$2,$3,$4,$4,'Cliente Playwright Financeiro','+245 955 00 11 22',$5,$6,NOW(),NOW(),NOW())`,
    [
      id,
      `PWREF-${id}`,
      overrides.status || 'paid',
      overrides.amountXOF ?? 25000,
      overrides.useCase || 'extra_posts',
      overrides.providerMode === undefined ? 'live' : overrides.providerMode,
    ],
  );
  return id;
}

test('navegação, indicadores, transações, filtros, paginação, detalhe e exportação', async ({ page }) => {
  await signIn(page);
  await openFinance(page);

  for (const label of [
    'Volume financeiro registado',
    'Pagamentos confirmados',
    'Pagamentos pendentes',
    'Total reconciliado',
    'Reembolsos efetuados',
    'Número de transações',
  ]) {
    await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
  }
  for (const button of ['Transações', 'Reconciliação', 'Operadoras', 'Pagamentos pendentes', 'Reembolsos e estornos', 'Extratos e exportações']) {
    await expect(page.getByRole('button', { name: button })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Financeiro', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Indicadores e operações financeiras da plataforma.')).toBeVisible();

  await openSection(page, /Transações/);
  await expect(page.getByRole('heading', { name: 'Transações', exact: true })).toBeVisible();
  await expect(page.getByText('TXN-2026-9011')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Pesquisar transações' }).fill('TXN-2026-9011');
  await expect(page.getByText('1 registo(s) · página 1 de 1')).toBeVisible();
  await expect(page.getByRole('cell', { name: /Mamadu Djaló/ })).toBeVisible();

  await page.getByRole('button', { name: 'LIMPAR FILTROS' }).click();
  await page.getByLabel(/Valor mínimo/i).fill('40000');
  await expect(page.getByText('1 registo(s) · página 1 de 1')).toBeVisible();
  await page.getByRole('button', { name: 'LIMPAR FILTROS' }).click();
  await page.getByLabel(/^DE$/i).fill('2026-08-01');
  await page.getByLabel(/^ATÉ$/i).fill('2026-08-31');
  await expect(page.getByText('4 registo(s) · página 1 de 1')).toBeVisible();
  await page.getByRole('button', { name: 'LIMPAR FILTROS' }).click();
  await page.getByRole('combobox', { name: /^estado$/i }).selectOption('pending');
  // A base de desenvolvimento acumula transacções de execuções anteriores.
  // O filtro da UI compara o estado exato ("pending"), não o grupo
  // pending+created usado noutros indicadores.
  const pendingCount = (await db.query(
    `SELECT count(*)::int AS n FROM payment_transactions
      WHERE status = 'pending'
        AND (use_case IS NULL OR use_case NOT IN ('event_tickets','event_refund'))`,
  )).rows[0].n;
  await expect(page.getByText(transactionCountLabel(pendingCount), { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Empresas organizadoras/ }).click();
  await expect(page.getByText(/Bilhetes e vendas das empresas/)).toBeVisible();
  await page.getByRole('button', { name: 'LIMPAR FILTROS' }).click();
  const businessCount = (await db.query(
    `SELECT count(*)::int AS n FROM payment_transactions
      WHERE use_case IN ('event_tickets','event_refund')`,
  )).rows[0].n;
  const businessPages = Math.max(1, Math.ceil(businessCount / 20));
  await expect(page.getByText(transactionCountLabel(businessCount), { exact: true })).toBeVisible();
  if (businessPages > 1) {
    await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(page.getByText(transactionCountLabel(businessCount, 2), { exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: /Plataforma Guigui.com/ }).click();
  await expect(page.getByText('TXN-2026-9011')).toBeVisible();
  await page.getByRole('row', { name: /TXN-2026-9011/ }).getByRole('button', { name: 'Detalhes' }).click();
  const detailDialog = page.getByRole('dialog', { name: /Transação TXN-2026-9011/ });
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByText('Mamadu Djaló').first()).toBeVisible();
  await expect(detailDialog.getByText('35 000 XOF').first()).toBeVisible();
  await detailDialog.getByRole('button', { name: 'Fechar' }).click();

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).first().click();
  expect((await csvDownload).suggestedFilename()).toContain('transacoes-platform');

  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel', exact: true }).first().click();
  const excelFile = await excelDownload;
  expect(excelFile.suggestedFilename()).toContain('transacoes-platform');
  expect(excelFile.suggestedFilename()).toMatch(/\.xlsx$/);

  const pdfPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'PDF', exact: true }).first().click();
  const pdfPage = await pdfPopup;
  await expect(pdfPage).toHaveTitle(/Transações/);
  await pdfPage.close();
});

test('reconciliação persiste, impede duplicação e regista responsável', async ({ page }) => {
  const transactionId = await createTransaction({ status: 'paid', providerMode: 'live' });
  await signIn(page);
  await openFinance(page);
  await openSection(page, /Reconciliação/);

  const search = page.getByRole('searchbox');
  await search.fill(transactionId);
  const row = page.locator('table').first().getByRole('row', { name: new RegExp(transactionId) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Registar' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Referência do extrato/i).fill(`EXTRATO-${transactionId}`);
  await dialog.getByLabel(/Valor no extrato/i).fill('25000');
  await dialog.getByLabel(/Estado/i).selectOption('in_review');
  await dialog.getByLabel(/Notas/i).fill('Conferência Playwright em verificação.');
  await dialog.getByRole('button', { name: 'Guardar reconciliação' }).click();

  await expect(page.getByRole('status')).toContainText('Reconciliação registada');
  const paymentRow = page.locator('table').first().getByRole('row', { name: new RegExp(transactionId) });
  await expect(paymentRow).toContainText('Em verificação');
  await paymentRow.getByRole('button', { name: 'Atualizar' }).click();
  const updateDialog = page.getByRole('dialog');
  await updateDialog.getByLabel(/Valor no extrato/i).fill('25000');
  await updateDialog.getByLabel(/Estado/i).selectOption('reconciled');
  await updateDialog.getByLabel(/Notas/i).fill('Conferência Playwright concluída com valor coincidente.');
  await updateDialog.getByRole('button', { name: 'Guardar reconciliação' }).click();
  await expect(page.getByRole('status')).toContainText('Reconciliação atualizada');
  await expect(page.locator('table').first().getByRole('row', { name: new RegExp(transactionId) })).toContainText('Reconciliado');
  await expect(page.locator('table').first().getByRole('row', { name: new RegExp(transactionId) })).toContainText('Administração Guigui');

  const duplicate = await page.request.post('/api/admin/finance/reconciliations', {
    data: {
      transactionId,
      statementReference: 'DUPLICADO',
      statementAmountXOF: 25000,
      status: 'reconciled',
    },
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).code).toBe('RECONCILIATION_ALREADY_EXISTS');

  await page.reload();
  await openFinance(page);
  await openSection(page, /Reconciliação/);
  await page.getByRole('searchbox').fill(transactionId);
  await expect(page.locator('table').first().getByRole('row', { name: new RegExp(transactionId) })).toContainText('Reconciliado');
  await expect(page.getByText(/payment reconciliation created/i).first()).toBeVisible();
  await expect(page.getByText(/payment reconciliation updated/i).first()).toBeVisible();

  const audit = await page.request.get('/api/admin/audit-logs?limit=1000');
  const auditPayload = await audit.json();
  expect(auditPayload.logs.some((log: { action: string; targetId?: string }) => log.action === 'payment_reconciliation_created' && log.targetId)).toBeTruthy();
});

test('pagamentos pendentes confirmam, solicitam comprovativo e rejeitam com auditoria', async ({ page }) => {
  const confirmId = await createTransaction({ status: 'pending', providerMode: null, amountXOF: 12000, suffix: 'CONFIRM' });
  const rejectId = await createTransaction({ status: 'pending', providerMode: null, amountXOF: 17000, suffix: 'REJECT' });
  await signIn(page);
  await openFinance(page);
  await openSection(page, /Pagamentos pendentes/);

  const search = page.getByRole('searchbox');
  await search.fill(confirmId);
  let row = page.getByRole('row', { name: new RegExp(confirmId) });
  await row.getByRole('button', { name: 'Confirmar' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Referência do comprovativo validado/i).fill(`PROVA-${confirmId}`);
  await dialog.getByLabel(/Nota de validação/i).fill('Comprovativo conferido no extrato.');
  await dialog.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('Pagamento confirmado');

  const confirmedDetail = await page.request.get(`/api/admin/finance/transactions/${confirmId}`);
  const confirmedPayload = await confirmedDetail.json();
  expect(confirmedPayload.transaction.status).toBe('authorized');
  expect(confirmedPayload.actions.some((action: { action: string; proof_reference?: string }) => action.action === 'confirm' && action.proof_reference)).toBeTruthy();

  await search.fill(rejectId);
  row = page.getByRole('row', { name: new RegExp(rejectId) });
  await row.getByRole('button', { name: 'Pedir comprovativo' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Motivo/i).fill('O comprovativo não identifica a referência da operadora.');
  await dialog.getByRole('button', { name: 'Registar pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Pedido de comprovativo registado');

  await search.fill(rejectId);
  row = page.getByRole('row', { name: new RegExp(rejectId) });
  await row.getByRole('button', { name: 'Rejeitar' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Motivo/i).fill('Comprovativo inválido após nova análise.');
  await dialog.getByRole('button', { name: 'Rejeitar pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('Pagamento rejeitado');

  const rejectedDetail = await page.request.get(`/api/admin/finance/transactions/${rejectId}`);
  const rejectedPayload = await rejectedDetail.json();
  expect(rejectedPayload.transaction.status).toBe('failed');
  expect(rejectedPayload.actions.map((action: { action: string }) => action.action)).toEqual(expect.arrayContaining(['request_proof', 'reject']));

  const audit = await page.request.get('/api/admin/audit-logs?limit=1000');
  const logs = (await audit.json()).logs as Array<{ action: string; targetId?: string }>;
  expect(logs.some((log) => log.action === 'payment_confirm')).toBeTruthy();
  expect(logs.some((log) => log.action === 'payment_reject')).toBeTruthy();
});

test('alertas operacionais isolam divergências e pagamentos acima de 48 horas', async ({ page }) => {
  const overdueId = await createTransaction({ status: 'pending', providerMode: null, amountXOF: 9500, suffix: 'OVERDUE' });
  await db.query("UPDATE payment_transactions SET created_at = NOW() - INTERVAL '49 hours', updated_at = NOW() - INTERVAL '49 hours' WHERE id = $1", [overdueId]);
  const divergenceId = await createTransaction({ status: 'authorized', amountXOF: 30000, suffix: 'DIVERGENCE' });
  const reconciliationId = `REC-PW-ALERT-${randomUUID().slice(0, 8)}`;
  await db.query(
    `INSERT INTO payment_reconciliations
       (id, transaction_id, statement_reference, expected_amount_xof, statement_amount_xof, status, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'divergence',$6,NOW(),NOW())`,
    [reconciliationId, divergenceId, `EXTRATO-${divergenceId}`, 30000, 25000, 'Divergência criada pelo teste de alertas.'],
  );

  await signIn(page);
  const response = await page.request.get('/api/admin/finance/alerts');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.thresholds.pendingPaymentHours).toBe(48);

  const divergenceAlert = payload.alerts.find((alert: { id: string }) => alert.id === 'reconciliation_divergence');
  expect(divergenceAlert.count).toBeGreaterThanOrEqual(1);
  const divergenceItem = divergenceAlert.items.find((item: { transactionId: string }) => item.transactionId === divergenceId);
  expect(divergenceItem).toBeTruthy();
  expect(divergenceItem.divergenceXOF).toBe(5000);
  expect(divergenceItem.statementReference).toContain('EXTRATO-');

  const pendingAlert = payload.alerts.find((alert: { id: string }) => alert.id === 'pending_payment_overdue');
  expect(pendingAlert.count).toBeGreaterThanOrEqual(1);
  const overdueItem = pendingAlert.items.find((item: { transactionId: string }) => item.transactionId === overdueId);
  expect(overdueItem).toBeTruthy();
  expect(overdueItem.ageHours).toBeGreaterThanOrEqual(48);

  await openFinance(page);
  await expect(page.getByRole('heading', { name: 'Alertas operacionais' })).toBeVisible();
  await expect(page.getByText('Divergências de reconciliação').first()).toBeVisible();
  await expect(page.getByText('Pagamentos pendentes há mais de 48 horas').first()).toBeVisible();

  await page.getByRole('button', { name: 'Regularizar pagamentos em atraso' }).click();
  await expect(page.getByRole('heading', { name: 'Pagamentos pendentes', exact: true })).toBeVisible();
  await expect(page.getByText('Há mais de 48 h', { exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill(overdueId);
  await expect(page.getByRole('row', { name: new RegExp(overdueId) })).toContainText('+48 h');
  await expect(page.getByText(/ultrapassaram 48 horas/).first()).toBeVisible();
});

test('reembolso percorre pedido, autorização e efetivação com responsáveis', async ({ page }) => {
  const transactionId = await createTransaction({ status: 'paid', providerMode: 'live', amountXOF: 30000, suffix: 'REFUND' });
  await signIn(page);
  await openFinance(page);
  await openSection(page, /Reembolsos e estornos/);

  await page.getByRole('button', { name: 'Novo reembolso' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Transação original/i).selectOption(transactionId);
  await dialog.getByLabel(/^Valor \(XOF\)$/i).fill('5000');
  await dialog.getByLabel(/Tipo/i).selectOption('refund');
  await dialog.getByLabel(/Motivo/i).fill('Pedido de reembolso parcial confirmado pelo cliente.');
  await dialog.getByRole('button', { name: 'Registar pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Pedido de reembolso registado');

  await page.getByRole('searchbox').fill(transactionId);
  let row = page.getByRole('row', { name: new RegExp(transactionId) });
  await expect(row).toContainText('Solicitado');
  await row.getByRole('button', { name: 'Autorizar' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Autorizar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reembolso autorizado');

  await page.getByRole('searchbox').fill(transactionId);
  row = page.getByRole('row', { name: new RegExp(transactionId) });
  await expect(row).toContainText('Autorizado');
  await row.getByRole('button', { name: 'Efetuar' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Referência da operadora/i).fill('OM-DEVOLUCAO-99881');
  await dialog.getByRole('button', { name: 'Registar efetivação' }).click();
  await expect(page.getByRole('status')).toContainText('Reembolso efetuado');

  await page.getByRole('searchbox').fill(transactionId);
  row = page.getByRole('row', { name: new RegExp(transactionId) });
  await expect(row).toContainText('Efetuado');
  await expect(row).toContainText('Administração Guigui');

  const result = await db.query('SELECT status, processed_by, authorized_by, provider_reference FROM refunds WHERE transaction_id = $1', [transactionId]);
  expect(result.rows[0].status).toBe('processed');
  expect(result.rows[0].processed_by).toBeTruthy();
  expect(result.rows[0].authorized_by).toBeTruthy();
  expect(result.rows[0].provider_reference).toBe('OM-DEVOLUCAO-99881');

  const audit = await page.request.get('/api/admin/audit-logs?limit=1000');
  const logs = (await audit.json()).logs as Array<{ action: string }>;
  expect(logs.some((log) => log.action === 'refund_requested')).toBeTruthy();
  expect(logs.some((log) => log.action === 'refund_authorized')).toBeTruthy();
  expect(logs.some((log) => log.action === 'refund_processed')).toBeTruthy();
});

test('operadoras configuram e registam histórico; extratos exportam', async ({ page }) => {
  await signIn(page);
  await openFinance(page);
  await openSection(page, /Operadoras/);
  await expect(page.getByRole('heading', { name: 'Orange Money' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Telecel' })).toBeVisible();
  await expect(page.getByText(/Integração em negociação/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Configurar Orange Money' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Estado da integração/i).selectOption('sandbox');
  await dialog.getByLabel(/URL base da API/i).fill('https://sandbox.orange.example');
  await dialog.getByLabel(/Caminho do webhook/i).fill('/api/payments/webhook/orange_money');
  await dialog.getByLabel(/Notas operacionais/i).fill('Sandbox de homologação Playwright.');
  await dialog.getByRole('button', { name: 'Guardar configuração' }).click();
  await expect(page.getByRole('status')).toContainText('Configuração da operadora atualizada');
  await expect(page.getByText('Sandbox').first()).toBeVisible();
  await expect(page.getByText(/sandbox\.orange\.example/)).toBeVisible();
  await expect(page.getByText(/payment operator config updated/i).first()).toBeVisible();

  const config = await db.query("SELECT integration_status, api_base_url FROM payment_operator_configs WHERE provider='orange_money'");
  expect(config.rows[0].integration_status).toBe('sandbox');
  expect(config.rows[0].api_base_url).toContain('sandbox.orange.example');

  await page.getByRole('button', { name: 'Voltar ao módulo' }).click();
  await openSection(page, /Extratos e exportações/);
  await page.getByRole('combobox', { name: /^operadora$/i }).selectOption('telecel');
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.getByRole('heading', { name: 'Extratos e Exportações' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Telecel', exact: true }).first()).toBeVisible();

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).first().click();
  expect((await csvDownload).suggestedFilename()).toContain('extrato-financeiro-plataforma');

  const pdfPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'PDF', exact: true }).first().click();
  const pdfPage = await pdfPopup;
  await expect(pdfPage).toHaveTitle(/Extrato Financeiro/);
  await pdfPage.close();
});

test('integridade dos totais e permissões de empresa', async ({ page, request }) => {
  await signIn(page);
  const summaryResponse = await page.request.get('/api/admin/finance/summary');
  expect(summaryResponse.ok()).toBeTruthy();
  const summary = await summaryResponse.json();

  const platformDb = await db.query(`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(gross_amount_xof),0)::int AS volume,
           COUNT(*) FILTER (WHERE status='authorized' OR (status='paid' AND provider_mode='live'))::int AS confirmed
      FROM payment_transactions
     WHERE use_case IS NULL OR use_case NOT IN ('event_tickets','event_refund')
  `);
  const companyDb = await db.query(`
    SELECT COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE status='paid')::int AS paid_count,
           COALESCE(SUM(gross_amount_xof) FILTER (WHERE status='paid'),0)::int AS revenue
      FROM payment_transactions
     WHERE use_case IN ('event_tickets','event_refund')
  `);
  const ordersDb = await db.query("SELECT COALESCE(SUM(gross_amount_xof) FILTER (WHERE status='paid'),0)::int AS paid FROM orders");
  expect(summary.platform.transactionCount).toBe(platformDb.rows[0].count);
  expect(summary.platform.volumeXOF).toBe(platformDb.rows[0].volume);
  expect(summary.platform.confirmedCount).toBe(platformDb.rows[0].confirmed);
  // Contrato legado de `summary.company`: pagamentos de bilhetes registados.
  expect(summary.company.transactionCount).toBe(companyDb.rows[0].count);
  expect(summary.company.paidCount).toBe(companyDb.rows[0].paid_count);
  expect(summary.company.revenueXOF).toBe(companyDb.rows[0].revenue);
  // A contabilidade actual usa os pedidos pagos, exposta em ticketFinance.
  expect(summary.ticketFinance.totals.grossXOF).toBe(ordersDb.rows[0].paid);
  expect(summary.scopeAudit.ordersPaidXOF).toBe(ordersDb.rows[0].paid);
  expect(summary.scopeAudit.unlinkedOrderAmountXOF).toBe(Math.max(ordersDb.rows[0].paid - companyDb.rows[0].revenue, 0));

  const businessLogin = await request.post(`${BASE}/api/auth/login`, {
    data: { email: BUSINESS_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(businessLogin.ok()).toBeTruthy();

  for (const path of [
    '/api/admin/finance/summary',
    '/api/admin/finance/transactions?scope=platform',
    '/api/admin/finance/reconciliations',
    '/api/admin/finance/alerts',
    '/api/admin/finance/operators',
    '/api/admin/finance/pending',
    '/api/admin/finance/refunds',
    '/api/admin/finance/statements',
  ]) {
    const response = await request.get(`${BASE}${path}`);
    expect(response.status(), path).toBe(403);
  }
  const mutation = await request.post(`${BASE}/api/admin/finance/reconciliations`, { data: { transactionId: 'x' } });
  expect(mutation.status()).toBe(403);
  const operatorMutation = await request.patch(`${BASE}/api/admin/finance/operators/orange_money`, { data: { integrationStatus: 'production' } });
  expect(operatorMutation.status()).toBe(403);
});
