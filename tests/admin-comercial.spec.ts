import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const PREFIX = `PW-COM-${randomUUID().slice(0, 6)}`;
const PLAN_CODE = `${PREFIX.toLowerCase()}-plano`;
const PRODUCT_CODE = `${PREFIX.replace(/-/g, '_')}_PRODUTO`.toUpperCase();
const PACKAGE_CODE = `${PREFIX.replace(/-/g, '_')}_PACOTE`.toUpperCase();
const FEATURE_CODE = `${PREFIX.toLowerCase().replace(/-/g, '_')}_feature`;
const SUBSCRIPTION_ID = `SUB-${PREFIX}`;

let db: Pool;
let originalMatrix: Record<string, unknown> | null = null;
let originalTicket: Record<string, unknown> | null = null;
let originalRules: Record<string, unknown> | null = null;
let initialCatalogVersion = 1;
let planId = '';
let productId = '';
const PURCHASE_BUSINESS_ID = 'seed-co-02';
const purchaseTransactionIds: string[] = [];
let originalWallet: Record<string, unknown> | null = null;
let originalWalletJson: Record<string, unknown> | null = null;
const dataDirectory = path.resolve(process.cwd(), 'data');

function readLocalJson(filename: string, fallback: any) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDirectory, filename), 'utf8'));
  } catch {
    return fallback;
  }
}

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL });
  originalMatrix = (await db.query("SELECT * FROM commercial_price_matrix WHERE group_id='restauracao' AND plan_id='plan-basic'")).rows[0] || null;
  originalTicket = (await db.query("SELECT * FROM ticket_fee_settings WHERE id='default'")).rows[0] || null;
  originalRules = (await db.query("SELECT * FROM commercial_rules WHERE id='default'")).rows[0] || null;
  initialCatalogVersion = Number((await db.query('SELECT COALESCE(MAX(version),1)::int AS version FROM commercial_catalog_versions')).rows[0].version);
  originalWallet = (await db.query('SELECT * FROM monetization_wallets WHERE business_id=$1', [PURCHASE_BUSINESS_ID])).rows[0] || null;
  const walletsJson = readLocalJson('monetization-wallets.json', {});
  originalWalletJson = walletsJson?.[PURCHASE_BUSINESS_ID] ? structuredClone(walletsJson[PURCHASE_BUSINESS_ID]) : null;
  await db.query(
    `INSERT INTO subscriptions
       (id, company_id, plan_id, status, starts_at, ends_at, created_at, category_group_id, contracted_price_xof,
        billing_period, catalog_version, plan_version, feature_snapshot, limits_snapshot, contract_snapshot, updated_at)
     VALUES ($1,'seed-co-02','plan-basic','active',NOW()-INTERVAL '30 days',NOW()+INTERVAL '300 days',NOW(),'restauracao',12345,
             'monthly',1,1,'{"posts":{"enabled":true,"limitKind":"number","numericValue":3}}'::jsonb,
             '{"posts":3}'::jsonb,'{"fixture":true,"price":12345}'::jsonb,NOW())`,
    [SUBSCRIPTION_ID],
  );
});

test.afterAll(async () => {
  if (!db) return;
  const plans = await db.query("SELECT id FROM plans WHERE code LIKE $1", [`${PREFIX.toLowerCase()}%`]);
  const planIds = plans.rows.map((row) => row.id);
  if (planIds.length) {
    await db.query('DELETE FROM plan_feature_configs WHERE plan_id = ANY($1)', [planIds]);
    await db.query('DELETE FROM plan_versions WHERE plan_id = ANY($1)', [planIds]);
    await db.query('DELETE FROM commercial_price_matrix WHERE plan_id = ANY($1)', [planIds]);
    await db.query('DELETE FROM plans WHERE id = ANY($1)', [planIds]);
  }
  const features = await db.query('SELECT id FROM subscription_features WHERE code = $1', [FEATURE_CODE]);
  const featureIds = features.rows.map((row) => row.id);
  if (featureIds.length) {
    await db.query('DELETE FROM plan_feature_configs WHERE feature_id = ANY($1)', [featureIds]);
    await db.query('DELETE FROM subscription_features WHERE id = ANY($1)', [featureIds]);
  }
  const packages = await db.query('SELECT id FROM commercial_packages WHERE code LIKE $1', [`${PREFIX.replace(/-/g, '_').toUpperCase()}%`]);
  const packageIds = packages.rows.map((row) => row.id);
  if (packageIds.length) {
    await db.query('DELETE FROM commercial_package_items WHERE package_id = ANY($1)', [packageIds]);
    await db.query('DELETE FROM commercial_packages WHERE id = ANY($1)', [packageIds]);
  }
  const products = await db.query('SELECT id FROM commercial_products WHERE code LIKE $1', [`${PREFIX.replace(/-/g, '_').toUpperCase()}%`]);
  const productIds = products.rows.map((row) => row.id);
  if (productIds.length) {
    await db.query('DELETE FROM commercial_product_prices WHERE product_id = ANY($1)', [productIds]);
    await db.query('DELETE FROM commercial_products WHERE id = ANY($1)', [productIds]);
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (purchaseTransactionIds.length) {
    await db.query('DELETE FROM monetization_ledger WHERE transaction_id = ANY($1)', [purchaseTransactionIds]);
    await db.query('DELETE FROM payment_transactions WHERE id = ANY($1)', [purchaseTransactionIds]);
  }
  if (originalWallet) {
    await db.query(
      `UPDATE monetization_wallets SET posts_extra_purchased=$2, promotions_extra_purchased=$3, posts_extra_used=$4, promotions_extra_used=$5, updated_at=$6 WHERE business_id=$1`,
      [PURCHASE_BUSINESS_ID, originalWallet.posts_extra_purchased, originalWallet.promotions_extra_purchased, originalWallet.posts_extra_used, originalWallet.promotions_extra_used, originalWallet.updated_at],
    );
  } else {
    await db.query('DELETE FROM monetization_wallets WHERE business_id=$1', [PURCHASE_BUSINESS_ID]);
  }
  const payments = readLocalJson('payments.json', []);
  if (Array.isArray(payments)) fs.writeFileSync(path.join(dataDirectory, 'payments.json'), JSON.stringify(payments.filter((item: any) => !purchaseTransactionIds.includes(item.id)), null, 2));
  const ledger = readLocalJson('monetization-ledger.json', []);
  if (Array.isArray(ledger)) fs.writeFileSync(path.join(dataDirectory, 'monetization-ledger.json'), JSON.stringify(ledger.filter((item: any) => !purchaseTransactionIds.includes(item.transactionId)), null, 2));
  const wallets = readLocalJson('monetization-wallets.json', {});
  if (wallets && typeof wallets === 'object') {
    if (originalWalletJson) wallets[PURCHASE_BUSINESS_ID] = originalWalletJson;
    else delete wallets[PURCHASE_BUSINESS_ID];
    fs.writeFileSync(path.join(dataDirectory, 'monetization-wallets.json'), JSON.stringify(wallets, null, 2));
  }
  await db.query('DELETE FROM subscriptions WHERE id = $1', [SUBSCRIPTION_ID]);
  await db.query("DELETE FROM commercial_price_matrix WHERE group_id IN (SELECT id FROM commercial_price_groups WHERE code LIKE $1)", [`pw_com_%`]);
  await db.query("DELETE FROM commercial_price_groups WHERE code LIKE $1", [`pw_com_%`]);
  await db.query('DELETE FROM commercial_audit_log WHERE created_at >= NOW() - INTERVAL \'2 hours\'');
  await db.query('DELETE FROM ticket_fee_history WHERE version > 1');
  await db.query('DELETE FROM commercial_catalog_versions WHERE version > $1', [initialCatalogVersion]);
  if (originalMatrix) {
    await db.query(
      `UPDATE commercial_price_matrix SET monthly_xof=$3, annual_xof=$4, discount_percent=$5, is_active=$6, version=$7, updated_at=NOW()
        WHERE group_id=$1 AND plan_id=$2`,
      [originalMatrix.group_id, originalMatrix.plan_id, originalMatrix.monthly_xof, originalMatrix.annual_xof, originalMatrix.discount_percent, originalMatrix.is_active, originalMatrix.version],
    );
  }
  if (originalTicket) {
    await db.query(
      `UPDATE ticket_fee_settings SET commission_percentage=$2::numeric, fixed_fee_xof=$3, currency=$4, fee_payer=$5,
        billing_model=$6, conditions=$7, is_active=$8, version=$9, updated_at=NOW() WHERE id=$1`,
      [originalTicket.id, originalTicket.commission_percentage, originalTicket.fixed_fee_xof, originalTicket.currency, originalTicket.fee_payer, originalTicket.billing_model, originalTicket.conditions, originalTicket.is_active, originalTicket.version],
    );
  }
  if (originalRules) {
    await db.query(
      `UPDATE commercial_rules SET annual_discount_percent=$2::numeric, grace_period_days=$3, renewal_notice_days=$4,
        auto_suspend_after_expiry=$5, auto_renewal_enabled=$6, allow_plan_change=$7, allow_extra_publications=$8,
        monthly_post_rule=$9, terms=$10, version=$11, updated_at=NOW() WHERE id=$1`,
      [originalRules.id, originalRules.annual_discount_percent, originalRules.grace_period_days, originalRules.renewal_notice_days, originalRules.auto_suspend_after_expiry, originalRules.auto_renewal_enabled, originalRules.allow_plan_change, originalRules.allow_extra_publications, originalRules.monthly_post_rule, originalRules.terms, originalRules.version],
    );
  }
  await db.end();
});

async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login falhou: ${JSON.stringify(payload)}`).toBeTruthy();
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
  await expect(page.getByText('PAINEL ADMINISTRATIVO').first()).toBeVisible({ timeout: 20_000 });
}

async function enterCommercial(page: Page) {
  await enterAdmin(page);
  await page.locator('aside').getByRole('button', { name: /^Planos & Assinaturas/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Planos & Assinaturas', exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function back(page: Page) {
  await page.getByRole('button', { name: /Voltar ao módulo/ }).click();
  await expect(page.getByRole('heading', { name: 'Planos & Assinaturas', exact: true }).first()).toBeVisible();
}

test('navegação principal e oito áreas independentes', async ({ page }) => {
  await signIn(page);
  await enterCommercial(page);
  for (const label of ['Receita registada', 'Assinaturas ativas', 'Assinaturas pendentes', 'Assinaturas expiradas', 'Planos ativos', 'Produtos ativos']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  const sections = [
    /Planos/,
    /Assinaturas/,
    /Funcionalidades e limites/,
    /Matriz de preços/,
    /Produtos, extras e pacotes/,
    /Taxas de bilheteira/,
    /Regras comerciais/,
    /Histórico e auditoria/,
  ];
  const moduleNav = page.getByRole('navigation', { name: 'Submódulos comerciais' });
  for (const button of sections) await expect(moduleNav.getByRole('button', { name: button })).toBeVisible();
  await expect(page.getByText('Catálogo comercial e contratos das empresas.')).toBeVisible();
});

test('planos: criação, edição, duplicação, estado, quotas, versões e preservação', async ({ page }) => {
  await signIn(page);
  await enterCommercial(page);
  await page.getByRole('navigation', { name: 'Submódulos comerciais' }).getByRole('button', { name: /Planos/ }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo de Planos' })).toBeVisible();

  await page.getByRole('button', { name: /Novo plano/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill(`${PREFIX} Plano`);
  await dialog.getByLabel(/Código único/).fill(PLAN_CODE);
  await dialog.getByLabel(/Preço mensal de referência/).fill('15000');
  await dialog.getByLabel(/Preço anual de referência/).fill('153000');
  await dialog.getByLabel('Descrição').fill('Plano criado pela suite Playwright.');
  await dialog.getByLabel(/Benefícios/).fill('Benefício um\nBenefício dois');
  await dialog.getByLabel(/Motivo da alteração/).fill('Teste de criação de plano');
  await dialog.getByRole('button', { name: 'Guardar versão' }).click();
  await expect(page.getByRole('status')).toContainText('Plano criado');

  const created = (await db.query('SELECT * FROM plans WHERE code=$1', [PLAN_CODE])).rows[0];
  expect(created).toBeTruthy();
  planId = created.id;
  expect(Number(created.price_xof)).toBe(15000);
  expect(Number(created.version)).toBe(1);

  const row = page.locator('table').first().getByRole('row', { name: new RegExp(`${PREFIX} Plano`) });
  await expect(row).toContainText('15 000 XOF');
  await row.getByRole('button', { name: /Editar/ }).click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel(/Preço mensal de referência/).fill('16000');
  await editDialog.getByLabel(/Motivo da alteração/).fill('Revisão de preço no teste');
  await editDialog.getByRole('button', { name: 'Guardar versão' }).click();
  await expect(page.getByRole('status')).toContainText('Plano atualizado');
  expect(Number((await db.query('SELECT price_xof, version FROM plans WHERE id=$1', [planId])).rows[0].version)).toBe(2);

  await page.locator('table').first().getByRole('row', { name: new RegExp(`${PREFIX} Plano`) }).getByRole('button', { name: /Duplicar/ }).click();
  await expect(page.getByRole('status')).toContainText('duplicado');
  const copy = (await db.query("SELECT * FROM plans WHERE code LIKE $1 AND code <> $2 LIMIT 1", [`${PLAN_CODE}-copia%`, PLAN_CODE])).rows[0];
  expect(copy).toBeTruthy();
  expect(copy.is_active).toBe(false);

  const copyRow = page.locator('table').first().getByRole('row', { name: new RegExp(`${PREFIX} Plano \\(cópia\\)`) });
  await copyRow.getByRole('button', { name: /Configurar/ }).click();
  const configDialog = page.getByRole('dialog');
  const postsRow = configDialog.getByRole('row', { name: /Publicações mensais/ });
  await postsRow.locator('input[type="number"]').fill('3');
  const promotionsRow = configDialog.getByRole('row', { name: /Promoções/ });
  await promotionsRow.locator('input[type="number"]').fill('2');
  await configDialog.getByLabel('Motivo').fill('Quotas do plano de teste');
  await configDialog.getByRole('button', { name: 'Guardar configuração' }).click();
  await expect(page.getByRole('status')).toContainText('Funcionalidades e limites guardados');
  const postsFeature = (await db.query("SELECT id FROM subscription_features WHERE code='posts'")).rows[0].id;
  const promotionsFeature = (await db.query("SELECT id FROM subscription_features WHERE code='promotions'")).rows[0].id;
  const copyConfigs = (await db.query('SELECT feature_id, numeric_value FROM plan_feature_configs WHERE plan_id=$1', [copy.id])).rows;
  expect(Number(copyConfigs.find((item) => item.feature_id === postsFeature)?.numeric_value)).toBe(3);
  expect(Number(copyConfigs.find((item) => item.feature_id === promotionsFeature)?.numeric_value)).toBe(2);

  await copyRow.getByRole('button', { name: /Ativar/ }).click();
  await expect(page.getByRole('status')).toContainText('reativado');
  expect((await db.query('SELECT is_active FROM plans WHERE id=$1', [copy.id])).rows[0].is_active).toBe(true);
  await page.locator('table').first().getByRole('row', { name: new RegExp(`${PREFIX} Plano \\(cópia\\)`) }).getByRole('button', { name: /Desativar/ }).click();
  await expect(page.getByRole('status')).toContainText('desativado');
  expect((await db.query('SELECT is_active FROM plans WHERE id=$1', [copy.id])).rows[0].is_active).toBe(false);

  const versions = (await db.query('SELECT COUNT(*)::int AS n FROM plan_versions WHERE plan_id=$1', [planId])).rows[0];
  expect(versions.n).toBeGreaterThanOrEqual(2);
  const preserved = (await db.query('SELECT contracted_price_xof, contract_snapshot FROM subscriptions WHERE id=$1', [SUBSCRIPTION_ID])).rows[0];
  expect(Number(preserved.contracted_price_xof)).toBe(12345);
  expect(preserved.contract_snapshot.price).toBe(12345);

  await page.reload();
  await enterCommercial(page);
  await page.getByRole('navigation', { name: 'Submódulos comerciais' }).getByRole('button', { name: /Planos/ }).click();
  await expect(page.locator('table').first().getByRole('row', { name: new RegExp(`${PREFIX} Plano`) }).filter({ hasNotText: '(cópia)' }).first()).toContainText('16 000 XOF');
});

test('funcionalidades: catálogo e consistência de três publicações', async ({ page }) => {
  await signIn(page);
  await enterCommercial(page);
  await page.getByRole('button', { name: /Configurar funcionalidades/ }).click();
  await expect(page.getByRole('heading', { name: 'Funcionalidades e Limites' })).toBeVisible();
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible();
  const posts = (await db.query("SELECT id FROM subscription_features WHERE code='posts'")).rows[0].id;
  const quotas = (await db.query('SELECT plan_id, numeric_value, limit_kind FROM plan_feature_configs WHERE feature_id=$1 ORDER BY plan_id', [posts])).rows;
  expect(quotas.length).toBeGreaterThanOrEqual(4);
  expect(quotas.filter((row) => row.plan_id !== 'plan-enterprise').every((row) => row.limit_kind === 'number' && Number(row.numeric_value) === 3)).toBe(true);
  expect(quotas.find((row) => row.plan_id === 'plan-enterprise')?.limit_kind).toBe('unlimited');

  await page.getByRole('button', { name: /Nova funcionalidade/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill(`${PREFIX} Funcionalidade`);
  await dialog.getByLabel(/Código único/).fill(FEATURE_CODE);
  await dialog.getByLabel('Categoria').fill('custom');
  await dialog.getByLabel('Tipo de valor').selectOption('flag');
  await dialog.getByLabel('Descrição').fill('Funcionalidade de teste com associação a planos.');
  await dialog.getByLabel('Motivo').fill('Teste de catálogo de funcionalidades');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Funcionalidade criada');
  const feature = (await db.query('SELECT id FROM subscription_features WHERE code=$1', [FEATURE_CODE])).rows[0];
  expect(feature).toBeTruthy();
  const associated = (await db.query('SELECT COUNT(*)::int AS n FROM plan_feature_configs WHERE feature_id=$1', [feature.id])).rows[0].n;
  expect(associated).toBeGreaterThanOrEqual(4);
});

test('matriz de preços calcula anual, preserva contrato e cria grupo', async ({ page }) => {
  await signIn(page);
  await enterCommercial(page);
  await expect(page.getByRole('heading', { name: 'Planos & Assinaturas' }).first()).toBeVisible();
  await page.getByRole('button', { name: /Matriz de preços/ }).click();
  await expect(page.getByRole('heading', { name: 'Matriz de Preços' })).toBeVisible();
  await page.getByRole('button', { name: /Editar preço Restauração.*Básico/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Preço mensal/).fill('11000');
  await dialog.getByLabel(/Desconto anual/).fill('15');
  await dialog.getByLabel('Motivo').fill('Teste de matriz de preços');
  await dialog.getByRole('button', { name: 'Guardar preço' }).click();
  await expect(page.getByRole('status')).toContainText('Preço atualizado');
  const cell = (await db.query("SELECT * FROM commercial_price_matrix WHERE group_id='restauracao' AND plan_id='plan-basic'")).rows[0];
  expect(Number(cell.monthly_xof)).toBe(11000);
  expect(Number(cell.annual_xof)).toBe(112200);
  const preserved = (await db.query('SELECT contracted_price_xof, contract_snapshot FROM subscriptions WHERE id=$1', [SUBSCRIPTION_ID])).rows[0];
  expect(Number(preserved.contracted_price_xof)).toBe(12345);
  expect(preserved.contract_snapshot.price).toBe(12345);

  await page.getByRole('button', { name: /Novo grupo/ }).click();
  const groupDialog = page.getByRole('dialog');
  await groupDialog.getByLabel('Nome').fill(`${PREFIX} Grupo`);
  await groupDialog.getByLabel('Descrição').fill('Grupo de teste');
  await groupDialog.getByLabel('Motivo').fill('Teste de grupo de preços');
  await groupDialog.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page.getByRole('status')).toContainText('Grupo de categorias criado');
  const group = (await db.query("SELECT id FROM commercial_price_groups WHERE name=$1", [`${PREFIX} Grupo`])).rows[0];
  expect(group).toBeTruthy();
  expect(Number((await db.query('SELECT COUNT(*)::int AS n FROM commercial_price_matrix WHERE group_id=$1', [group.id])).rows[0].n)).toBeGreaterThanOrEqual(4);
});

test('produtos, extras e pacotes persistem e vendas são consultáveis', async ({ page }) => {
  await signIn(page);
  await enterCommercial(page);
  await page.getByRole('button', { name: /Gerir produtos e pacotes/ }).click();
  await expect(page.getByRole('heading', { name: 'Produtos, Extras e Pacotes' })).toBeVisible();
  await page.getByRole('button', { name: /Novo produto/ }).click();
  const productDialog = page.getByRole('dialog');
  await productDialog.getByLabel('Nome').fill(`${PREFIX} Produto`);
  await productDialog.getByLabel(/Código único/).fill(PRODUCT_CODE);
  await productDialog.getByLabel('Tipo').selectOption('extra_posts');
  await productDialog.getByLabel(/Preço base/).fill('7500');
  await productDialog.getByLabel('Descrição').fill('Produto extra de teste.');
  await productDialog.getByLabel('Motivo').fill('Teste de produto');
  await productDialog.getByRole('button', { name: 'Guardar produto' }).click();
  await expect(page.getByRole('status')).toContainText('Produto criado');
  const product = (await db.query('SELECT * FROM commercial_products WHERE code=$1', [PRODUCT_CODE])).rows[0];
  expect(product).toBeTruthy();
  productId = product.id;
  expect(Number(product.base_price_xof)).toBe(7500);
  expect((await db.query('SELECT price_xof FROM commercial_product_prices WHERE product_id=$1 AND quantity=1', [productId])).rows[0].price_xof).toBe(7500);

  await page.getByRole('button', { name: /Novo pacote/ }).click();
  const packageDialog = page.getByRole('dialog');
  await packageDialog.getByLabel('Nome').fill(`${PREFIX} Pacote`);
  await packageDialog.getByLabel('Código').fill(PACKAGE_CODE);
  await packageDialog.getByLabel(/Preço do pacote/).fill('12000');
  await packageDialog.getByLabel('Descrição').fill('Pacote de teste.');
  await packageDialog.getByLabel('Motivo').fill('Teste de pacote');
  await packageDialog.getByLabel(/Produto 1/).selectOption(productId);
  await packageDialog.getByRole('button', { name: 'Criar pacote' }).click();
  await expect(page.getByRole('status')).toContainText('Pacote comercial criado');
  const pkg = (await db.query('SELECT * FROM commercial_packages WHERE code=$1', [PACKAGE_CODE])).rows[0];
  expect(pkg).toBeTruthy();
  expect(Number(pkg.price_xof)).toBe(12000);
  expect((await db.query('SELECT COUNT(*)::int AS n FROM commercial_package_items WHERE package_id=$1', [pkg.id])).rows[0].n).toBe(1);

  await page.getByRole('button', { name: /^Pacotes/ }).click();
  await expect(page.getByText(`${PREFIX} Pacote`).first()).toBeVisible();
  await page.getByRole('button', { name: /^Vendas/ }).click();
  await expect(page.getByText('Vendas lidas do ledger real')).toBeVisible();

  const wrongPrice = await page.request.post('/api/payments/create', {
    data: { useCase: 'extra_posts', productCode: PRODUCT_CODE, quantity: 1, amountXOF: 5000, businessId: PURCHASE_BUSINESS_ID, businessName: 'Cafe Kriol', payerName: 'Comprador Playwright', payerPhone: '+245 955 11 31', provider: 'orange_money' },
  });
  expect(wrongPrice.status()).toBe(409);
  expect(await wrongPrice.json()).toMatchObject({ code: 'PRODUCT_PRICE_MISMATCH', expectedAmountXOF: 7500 });

  const productPurchase = await page.request.post('/api/payments/create', {
    data: { useCase: 'extra_posts', productCode: PRODUCT_CODE, quantity: 1, amountXOF: 7500, businessId: PURCHASE_BUSINESS_ID, businessName: 'Cafe Kriol', payerName: 'Comprador Playwright', payerPhone: '+245 955 11 32', provider: 'orange_money' },
  });
  expect(productPurchase.ok()).toBeTruthy();
  const productTransaction = (await productPurchase.json()).transaction;
  expect(productTransaction).toMatchObject({ productCode: PRODUCT_CODE, productId, amountXOF: 7500, status: 'confirmed_api' });
  purchaseTransactionIds.push(productTransaction.id);

  const wrongPackagePrice = await page.request.post('/api/payments/create', {
    data: { useCase: 'extra_credit_purchase', productCode: PACKAGE_CODE, quantity: 1, amountXOF: 7500, businessId: PURCHASE_BUSINESS_ID, businessName: 'Cafe Kriol', payerName: 'Comprador Playwright', payerPhone: '+245 955 11 33', provider: 'orange_money' },
  });
  expect(wrongPackagePrice.status()).toBe(409);
  expect(await wrongPackagePrice.json()).toMatchObject({ code: 'PRODUCT_PRICE_MISMATCH', expectedAmountXOF: 12000 });

  const packagePurchase = await page.request.post('/api/payments/create', {
    data: { useCase: 'extra_credit_purchase', productCode: PACKAGE_CODE, quantity: 1, amountXOF: 12000, businessId: PURCHASE_BUSINESS_ID, businessName: 'Cafe Kriol', payerName: 'Comprador Playwright', payerPhone: '+245 955 11 34', provider: 'orange_money' },
  });
  expect(packagePurchase.ok()).toBeTruthy();
  const packageTransaction = (await packagePurchase.json()).transaction;
  expect(packageTransaction).toMatchObject({ productCode: PACKAGE_CODE, amountXOF: 12000, status: 'confirmed_api' });
  purchaseTransactionIds.push(packageTransaction.id);

  await new Promise((resolve) => setTimeout(resolve, 800));
  const ledger = await db.query('SELECT product_code, quantity, gross_amount_xof, status FROM monetization_ledger WHERE transaction_id = ANY($1) ORDER BY product_code', [purchaseTransactionIds]);
  expect(ledger.rows).toHaveLength(2);
  expect(ledger.rows).toEqual(expect.arrayContaining([
    expect.objectContaining({ product_code: PRODUCT_CODE, quantity: 1, gross_amount_xof: 7500, status: 'paid' }),
    expect.objectContaining({ product_code: PACKAGE_CODE, quantity: 1, gross_amount_xof: 12000, status: 'paid' }),
  ]));
});

test('taxas de bilheteira e regras comerciais guardam versões e são restauráveis', async ({ page, request }) => {
  await signIn(page);
  await enterCommercial(page);
  await page.getByRole('button', { name: /Configurar taxas/ }).click();
  await expect(page.getByRole('heading', { name: 'Taxas de Bilheteira' })).toBeVisible();
  await page.getByLabel(/Comissão percentual/).fill('11.5');
  await page.getByLabel(/Taxa fixa por emissão/).fill('250');
  await page.getByLabel(/Quem paga/).selectOption('buyer');
  await page.getByLabel(/Condições de aplicação/).fill('Condição de teste Playwright.');
  await page.getByLabel(/Motivo da alteração/).fill('Teste de taxa de bilheteira');
  await page.getByRole('button', { name: 'Guardar taxas' }).click();
  await expect(page.getByRole('status')).toContainText('Taxas de bilheteira atualizadas');
  const ticket = (await db.query("SELECT * FROM ticket_fee_settings WHERE id='default'")).rows[0];
  expect(Number(ticket.commission_percentage)).toBe(11.5);
  expect(Number(ticket.fixed_fee_xof)).toBe(250);
  expect(Number(ticket.version)).toBeGreaterThanOrEqual(2);
  expect((await db.query('SELECT COUNT(*)::int AS n FROM ticket_fee_history WHERE version > 1')).rows[0].n).toBeGreaterThanOrEqual(1);
  const publicCatalog = await page.request.get('/api/commercial/public-catalog');
  expect(publicCatalog.ok()).toBeTruthy();
  expect((await publicCatalog.json()).ticketFeePolicy).toMatchObject({ commissionPercentage: 11.5, fixedFee: 250 });

  const offer = (await db.query(
    `SELECT e.id AS event_id, e.title AS event_title, ticket->>'id' AS ticket_type_id, ticket->>'name' AS ticket_name,
            (ticket->>'priceXOF')::int AS price_xof
       FROM events e CROSS JOIN LATERAL jsonb_array_elements(e.data->'ticketTypes') AS ticket
      WHERE e.status = 'published'
        AND COALESCE((e.data->>'salesOpen')::boolean, TRUE)
        AND COALESCE((ticket->>'salesOpen')::boolean, TRUE)
        AND (ticket->>'availableQuantity')::int > COALESCE((ticket->>'soldQuantity')::int, 0)
      LIMIT 1`,
  )).rows[0];
  expect(offer, 'deve existir um evento publicado com bilhetes disponíveis').toBeTruthy();
  const citizenLogin = await request.post('/api/auth/login', { data: { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' } });
  expect(citizenLogin.ok()).toBeTruthy();
  const expectedBuyerTotal = Number(offer.price_xof) + Math.round(Number(offer.price_xof) * 11.5 / 100) + 250;
  const quoteCheck = await request.post('/api/tickets/purchase', {
    data: {
      eventId: offer.event_id, eventTitle: offer.event_title, ticketTypeId: offer.ticket_type_id, ticketTypeName: offer.ticket_name,
      quantity: 1, priceXOF: Number(offer.price_xof), pricePerTicketXOF: Number(offer.price_xof), chargedAmountXOF: expectedBuyerTotal + 1,
      paymentMethod: 'orange_money', policyAccepted: true, policyVersion: '1.0', policyAcceptedAt: '2026-11-11T00:00:00.000Z',
    },
  });
  expect(quoteCheck.status()).toBe(409);
  expect(await quoteCheck.json()).toMatchObject({ code: 'TICKET_TOTAL_MISMATCH', expectedAmountXOF: expectedBuyerTotal });

  await back(page);
  await page.getByRole('button', { name: /Regras comerciais/ }).click();
  await expect(page.getByRole('heading', { name: 'Regras Comerciais' })).toBeVisible();
  await page.getByLabel(/Desconto anual antecipado/).fill('16');
  await page.getByLabel(/Período de tolerância/).fill('4');
  await page.getByLabel(/Motivo da alteração/).fill('Teste de regras comerciais');
  await page.getByRole('button', { name: 'Guardar regras' }).click();
  await expect(page.getByRole('status')).toContainText('Regras comerciais guardadas');
  const rules = (await db.query("SELECT * FROM commercial_rules WHERE id='default'")).rows[0];
  expect(Number(rules.annual_discount_percent)).toBe(16);
  expect(Number(rules.grace_period_days)).toBe(4);
  await page.reload();
  await enterCommercial(page);
  await page.getByRole('button', { name: /Regras comerciais/ }).click();
  await expect(page.getByLabel(/Desconto anual antecipado/)).toHaveValue('16');
});

test('assinaturas: filtros, detalhe, renovação e preservação de fotografia', async ({ page }) => {
  await signIn(page);
  await enterCommercial(page);
  await page.getByRole('navigation', { name: 'Submódulos comerciais' }).getByRole('button', { name: /Assinaturas/ }).click();
  await expect(page.getByRole('heading', { name: 'Assinaturas', exact: true })).toBeVisible();
  await page.getByLabel(/Registos por página/).selectOption('30');
  await page.locator('table').first().waitFor();
  await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(30);
  await page.getByRole('button', { name: '2', exact: true }).click();
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.locator('label').filter({ hasText: /^Plano/ }).locator('select').selectOption({ label: 'Básico' });
  await expect(page.getByText(/assinatura\(s\) com os filtros atuais/)).toBeVisible();
  await page.getByRole('button', { name: 'Limpar' }).click();
  await page.getByRole('searchbox').fill(SUBSCRIPTION_ID);
  const row = page.locator('table').first().getByRole('row', { name: new RegExp(SUBSCRIPTION_ID) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('12 345 XOF');
  await row.getByRole('button', { name: /Detalhes/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Fotografia contratada');
  await expect(dialog).toContainText('12 345 XOF');
  await dialog.getByRole('button', { name: /Registar renovação/ }).click();
  const renewDialog = page.getByRole('dialog');
  const future = new Date();
  future.setDate(future.getDate() + 365);
  await renewDialog.getByLabel(/Nova data de fim/).fill(future.toISOString().slice(0, 10));
  await renewDialog.getByLabel(/Preço contratado/).fill('13000');
  await renewDialog.getByLabel(/Transação de pagamento/).fill(`PAY-${PREFIX}`);
  await renewDialog.getByLabel('Motivo').fill('Teste de renovação');
  await renewDialog.getByRole('button', { name: 'Confirmar renovação' }).click();
  await expect(page.getByRole('status')).toContainText('Renovação registada');
  const renewed = (await db.query('SELECT status, contracted_price_xof, catalog_version, payment_transaction_id FROM subscriptions WHERE id=$1', [SUBSCRIPTION_ID])).rows[0];
  expect(renewed.status).toBe('active');
  expect(Number(renewed.contracted_price_xof)).toBe(13000);
  expect(Number(renewed.catalog_version)).toBeGreaterThanOrEqual(1);
  expect(renewed.payment_transaction_id).toBe(`PAY-${PREFIX}`);

  await dialog.getByRole('button', { name: /Suspender/ }).click();
  const statusDialog = page.getByRole('dialog');
  await statusDialog.getByLabel('Motivo').fill('Suspensão de teste');
  await statusDialog.getByRole('button', { name: 'Guardar estado' }).click();
  await expect(page.getByRole('status')).toContainText('Estado contratual atualizado');
  expect((await db.query('SELECT status FROM subscriptions WHERE id=$1', [SUBSCRIPTION_ID])).rows[0].status).toBe('suspended');
});

test('auditoria mostra alterações, versões e responsáveis', async ({ page }) => {
  await signIn(page);
  const created = await page.request.post('/api/admin/commercial/plans', { data: { name: `${PREFIX} Auditoria`, code: `${PLAN_CODE}-audit`, priceXOF: 9000, reason: 'Fixture de auditoria Playwright' } });
  expect(created.ok()).toBeTruthy();
  await enterCommercial(page);
  await page.getByRole('button', { name: /Consultar auditoria/ }).click();
  await expect(page.getByRole('heading', { name: 'Histórico e Auditoria' })).toBeVisible();
  await page.getByRole('searchbox').fill(PREFIX);
  await expect(page.locator('table').first()).toContainText(/Plano|Produto|Assinatura|Funcionalidade/);
  await expect(page.getByText('Administração Guigui').first()).toBeVisible();
  await page.getByRole('button', { name: /Versões do catálogo/ }).click();
  await expect(page.getByText(/Catálogo v/).first()).toBeVisible();
  await page.getByRole('button', { name: /Versões de planos/ }).click();
  await expect(page.getByText('Básico').first()).toBeVisible();
});

test('permissões: empresa não acede ao módulo comercial', async ({ page }) => {
  await signIn(page, BUSINESS_EMAIL);
  const overview = await page.request.get(`${process.env.PW_PORT ? `http://127.0.0.1:${process.env.PW_PORT}` : 'http://127.0.0.1:3000'}/api/admin/commercial/overview`);
  expect(overview.status()).toBe(403);
  const mutation = await page.request.post(`${process.env.PW_PORT ? `http://127.0.0.1:${process.env.PW_PORT}` : 'http://127.0.0.1:3000'}/api/admin/commercial/plans`, { data: { name: 'Negado', code: 'negado' } });
  expect(mutation.status()).toBe(403);
});
