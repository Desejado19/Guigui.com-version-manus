import { randomUUID } from 'node:crypto';
import { databasePool } from './db';

export type CommercialActor = { id: string; name: string };
export type SubscriptionStatusValue = 'active' | 'pending' | 'expired' | 'suspended' | 'cancelled';

const ACTIVE_SUBSCRIPTION = "s.status IN ('active') AND (s.ends_at IS NULL OR s.ends_at >= CURRENT_DATE)";

export class CommercialError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CommercialError';
  }
}

function db() {
  if (!databasePool) {
    throw new CommercialError(503, 'DATABASE_REQUIRED', 'A base de dados PostgreSQL é necessária para gerir o catálogo comercial.');
  }
  return databasePool;
}

function asInt(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function money(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new CommercialError(400, 'INVALID_PRICE', `${field} deve ser um valor não negativo.`);
  }
  return Math.trunc(number);
}

function percentage(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new CommercialError(400, 'INVALID_PERCENTAGE', `${field} deve estar entre 0 e 100.`);
  }
  return Math.round(number * 100) / 100;
}

function text(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

async function actorName(actor: CommercialActor): Promise<string> {
  if (!actor.id) return actor.name || 'Administração Guigui';
  const result = await db().query('SELECT name FROM users WHERE id = $1 LIMIT 1', [actor.id]);
  return result.rows[0]?.name ? String(result.rows[0].name) : actor.name || 'Administração Guigui';
}

async function currentCatalogVersion(client: { query: Function }): Promise<number> {
  const result = await client.query('SELECT COALESCE(MAX(version), 1)::int AS version FROM commercial_catalog_versions');
  return asInt(result.rows[0]?.version) || 1;
}

async function createCatalogVersion(
  client: { query: Function },
  actor: string,
  reason: string,
): Promise<number> {
  const version = (await currentCatalogVersion(client)) + 1;
  const snapshot = {
    plans: asInt((await client.query('SELECT COUNT(*)::int AS n FROM plans')).rows[0]?.n),
    features: asInt((await client.query('SELECT COUNT(*)::int AS n FROM subscription_features')).rows[0]?.n),
    groups: asInt((await client.query('SELECT COUNT(*)::int AS n FROM commercial_price_groups')).rows[0]?.n),
    products: asInt((await client.query('SELECT COUNT(*)::int AS n FROM commercial_products')).rows[0]?.n),
    ticketFees: (await client.query('SELECT commission_percentage, fixed_fee_xof FROM ticket_fee_settings WHERE id=$1', ['default'])).rows[0] || null,
    rules: (await client.query('SELECT annual_discount_percent, monthly_post_rule FROM commercial_rules WHERE id=$1', ['default'])).rows[0] || null,
  };
  await client.query(
    'INSERT INTO commercial_catalog_versions (id, version, reason, changed_by, snapshot) VALUES ($1,$2,$3,$4,$5)',
    [`catalog-v${version}-${randomUUID().slice(0, 8)}`, version, reason.slice(0, 500), actor, JSON.stringify(snapshot)],
  );
  return version;
}

async function writeAudit(
  client: { query: Function },
  params: {
    entityType: string;
    entityId: string;
    action: string;
    field?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
    actor: string;
    actorId: string;
    catalogVersion: number;
  },
) {
  await client.query(
    `INSERT INTO commercial_audit_log
      (id, entity_type, entity_id, action, field_name, old_value, new_value, reason, actor_id, actor_name, catalog_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      `CA-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      params.entityType,
      params.entityId,
      params.action,
      params.field || null,
      params.oldValue === undefined ? null : JSON.stringify(params.oldValue),
      params.newValue === undefined ? null : JSON.stringify(params.newValue),
      text(params.reason, 2000),
      params.actorId || null,
      params.actor,
      params.catalogVersion,
    ],
  );
}

async function withTransaction<T>(operation: (client: any) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function mapPlan(row: any) {
  return {
    id: String(row.id),
    code: String(row.code || row.id),
    name: String(row.name),
    description: String(row.description || ''),
    priceXOF: asInt(row.price_xof),
    annualPriceXOF: row.annual_price_xof === null ? null : asInt(row.annual_price_xof),
    billingPeriod: String(row.billing_period || 'monthly'),
    isActive: Boolean(row.is_active),
    isPublic: Boolean(row.is_public),
    annualContract: Boolean(row.annual_contract),
    badge: row.badge ? String(row.badge) : null,
    benefits: Array.isArray(row.benefits) ? row.benefits : [],
    sortOrder: asInt(row.sort_order),
    version: asInt(row.version) || 1,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function mapFeature(row: any) {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description || ''),
    category: String(row.category || 'custom'),
    valueType: String(row.value_type || 'flag'),
    unit: row.unit ? String(row.unit) : null,
    isActive: Boolean(row.is_active),
  };
}

function mapPlanConfig(row: any) {
  return {
    featureId: String(row.feature_id),
    enabled: Boolean(row.enabled),
    limitKind: String(row.limit_kind || 'flag'),
    numericValue: row.numeric_value === null ? null : asInt(row.numeric_value),
    textValue: row.text_value === null ? null : String(row.text_value),
  };
}

function mapSubscription(row: any) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    companyName: String(row.company_name || '—'),
    companyStatus: String(row.company_status || '—'),
    planId: String(row.plan_id),
    planName: String(row.plan_name || '—'),
    planCode: String(row.plan_code || ''),
    status: String(row.status || 'pending'),
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    categoryGroupId: row.category_group_id ? String(row.category_group_id) : null,
    categoryGroupName: row.category_group_name ? String(row.category_group_name) : null,
    priceXOF: asInt(row.display_price_xof),
    priceSource: row.contracted_price_xof === null ? 'matrix_reference' : 'contracted',
    billingPeriod: String(row.billing_period || 'monthly'),
    provider: row.provider ? String(row.provider) : null,
    paymentType: row.payment_type ? String(row.payment_type) : null,
    paymentTransactionId: row.payment_transaction_id ? String(row.payment_transaction_id) : null,
    catalogVersion: asInt(row.catalog_version) || 1,
    planVersion: asInt(row.plan_version) || 1,
    notes: row.notes ? String(row.notes) : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const SUBSCRIPTION_SELECT = `
  SELECT s.*, c.name AS company_name, c.status AS company_status,
         p.name AS plan_name, p.code AS plan_code,
         pg.name AS category_group_name,
         COALESCE(s.contracted_price_xof, pm.monthly_xof, p.price_xof) AS display_price_xof
    FROM subscriptions s
    JOIN companies c ON c.id = s.company_id
    JOIN plans p ON p.id = s.plan_id
    LEFT JOIN commercial_price_groups pg ON pg.id = s.category_group_id
    LEFT JOIN commercial_price_matrix pm ON pm.group_id = s.category_group_id AND pm.plan_id = s.plan_id
`;

async function resolveCompanyGroup(client: { query: Function }, companyId: string): Promise<string | null> {
  const result = await client.query(
    `SELECT COALESCE(parent.id, cat.id, c.data->>'groupGroupId', c.data->>'groupId') AS group_id
       FROM companies c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN categories parent ON parent.id = cat.parent_id
      WHERE c.id = $1 LIMIT 1`,
    [companyId],
  );
  const raw = result.rows[0]?.group_id ? String(result.rows[0].group_id) : '';
  return raw ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/gi, '') : null;
}

async function planSnapshot(client: { query: Function }, planId: string) {
  const planResult = await client.query('SELECT * FROM plans WHERE id = $1', [planId]);
  const plan = planResult.rows[0];
  if (!plan) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
  const configs = await client.query(
    `SELECT pfc.*, f.code, f.name, f.value_type FROM plan_feature_configs pfc
       JOIN subscription_features f ON f.id = pfc.feature_id
      WHERE pfc.plan_id = $1 ORDER BY f.name`,
    [planId],
  );
  const features = configs.rows.map((row: any) => ({
    featureId: String(row.feature_id),
    code: String(row.code),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    limitKind: String(row.limit_kind || 'flag'),
    numericValue: row.numeric_value === null ? null : asInt(row.numeric_value),
    textValue: row.text_value === null ? null : String(row.text_value),
  }));
  return { plan, features };
}

async function syncCompanySubscriptions(client: { query: Function }, actorId = '') {
  const companies = await client.query(
    `SELECT c.id, c.name, c.status, c.category_id, c.created_at, c.data
       FROM companies c
      WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id = c.id)`,
  );
  if (companies.rows.length === 0) return 0;
  const catalog = await currentCatalogVersion(client);
  const plans = await client.query('SELECT * FROM plans WHERE is_active = TRUE');
  const byCode = new Map<string, any>();
  for (const planRow of plans.rows) byCode.set(String(planRow.code || ''), planRow);
  let inserted = 0;
  for (const company of companies.rows) {
    const data = company.data && typeof company.data === 'object' ? company.data : {};
    const tier = String(data.tier || 'basic');
    const plan = byCode.get(tier) || byCode.get('basic');
    if (!plan) continue;
    const snapshot = await planSnapshot(client, String(plan.id));
    const groupId = await resolveCompanyGroup(client, String(company.id));
    const renewDate = parseDate(data.subscriptionRenewDate);
    const explicitStatus = String(data.subscriptionStatus || '').toLowerCase();
    let status: SubscriptionStatusValue = 'active';
    if (company.status === 'pending') status = 'pending';
    else if (company.status === 'suspended' || explicitStatus === 'suspended') status = 'suspended';
    else if (explicitStatus === 'expired') status = 'expired';
    else if (renewDate && Date.parse(renewDate) < Date.now()) status = 'expired';
    const features = Object.fromEntries(snapshot.features.map((feature: any) => [feature.code, feature]));
    const limits = Object.fromEntries(snapshot.features.filter((feature: any) => ['number', 'unlimited', 'negotiated'].includes(feature.limitKind)).map((feature: any) => [feature.code, feature.numericValue]));
    await client.query(
      `INSERT INTO subscriptions
        (id, company_id, plan_id, status, starts_at, ends_at, created_at, category_group_id,
         contracted_price_xof, billing_period, catalog_version, plan_version, feature_snapshot,
         limits_snapshot, contract_snapshot, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        `SUB-${String(company.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`,
        company.id,
        plan.id,
        status,
        parseDate(data.subscriptionStartedAt) || (company.created_at ? new Date(company.created_at).toISOString() : null),
        renewDate,
        company.created_at || new Date().toISOString(),
        groupId,
        data.subscriptionPeriod === 'annual' ? 'annual' : 'monthly',
        catalog,
        asInt(plan.version) || 1,
        JSON.stringify(features),
        JSON.stringify(limits),
        JSON.stringify({
          source: 'company-subscription-migration',
          plan: mapPlan(plan),
          features,
          limits,
          catalogVersion: catalog,
          planVersion: asInt(plan.version) || 1,
        }),
      ],
    );
    inserted += 1;
  }
  return inserted;
}

function planConfigsQuery() {
  return `SELECT pfc.plan_id, pfc.feature_id, pfc.enabled, pfc.limit_kind, pfc.numeric_value, pfc.text_value,
                 f.code, f.name, f.description, f.category, f.value_type, f.unit, f.is_active
            FROM plan_feature_configs pfc
            JOIN subscription_features f ON f.id = pfc.feature_id
           ORDER BY f.category, f.name`;
}

export async function getCommercialOverview() {
  const dbc = db();
  await syncCompanySubscriptions(dbc);
  const [plans, features, groups, matrix, products, packages, ticket, rules, versions, subscriptions, revenue, audit, configs, planSubscribers, ticketHistory, ticketRevenue] = await Promise.all([
    dbc.query('SELECT * FROM plans ORDER BY sort_order, name'),
    dbc.query('SELECT * FROM subscription_features ORDER BY category, name'),
    dbc.query('SELECT * FROM commercial_price_groups ORDER BY sort_order, name'),
    dbc.query('SELECT * FROM commercial_price_matrix ORDER BY group_id, plan_id'),
    dbc.query('SELECT * FROM commercial_products ORDER BY is_active DESC, name'),
    dbc.query('SELECT * FROM commercial_packages ORDER BY name'),
    dbc.query('SELECT * FROM ticket_fee_settings WHERE id = $1', ['default']),
    dbc.query('SELECT * FROM commercial_rules WHERE id = $1', ['default']),
    dbc.query('SELECT id, version, reason, changed_by, created_at FROM commercial_catalog_versions ORDER BY version DESC LIMIT 50'),
    dbc.query(`SELECT status, COUNT(*)::int AS count, COALESCE(SUM(COALESCE(contracted_price_xof, 0)),0)::bigint AS value
                 FROM subscriptions GROUP BY status`),
    dbc.query(`SELECT COUNT(*)::int AS count,
                      COALESCE(SUM(gross_amount_xof),0)::bigint AS amount
                 FROM payment_transactions
                WHERE use_case IN ('subscription_initial','subscription_renewal','subscription_upgrade')
                  AND (status = 'authorized' OR (status = 'paid' AND provider_mode = 'live'))`),
    dbc.query(`SELECT * FROM commercial_audit_log ORDER BY created_at DESC LIMIT 12`),
    dbc.query(planConfigsQuery()),
    dbc.query(`SELECT plan_id, COUNT(*)::int AS n FROM subscriptions GROUP BY plan_id`),
    dbc.query(`SELECT id, version, old_values, new_values, changed_by, reason, created_at FROM ticket_fee_history ORDER BY version DESC LIMIT 100`),
    // A receita de taxas tem de refletir o que é efetivamente cobrado. A coluna
    // orders.fee_amount_xof nunca é preenchida no checkout (fica a zero), pelo que
    // somá-la devolvia sempre zero. Cada ordem é um bilhete, logo a taxa aplicada é
    // a mesma fórmula do checkout: percentagem sobre o valor bruto + taxa fixa por
    // unidade, conforme o modelo em vigor. Valores já registados na ordem prevalecem.
    dbc.query(`WITH policy AS (
                 SELECT commission_percentage, fixed_fee_xof, billing_model, is_active
                   FROM ticket_fee_settings WHERE id = 'default'
               )
               SELECT COUNT(*)::int AS ticket_count,
                      COALESCE(SUM(o.gross_amount_xof),0)::bigint AS gross_xof,
                      COALESCE(SUM(
                        CASE
                          WHEN o.fee_amount_xof > 0 THEN o.fee_amount_xof
                          WHEN p.is_active IS NOT TRUE THEN 0
                          WHEN p.billing_model = 'percentage_only'
                            THEN ROUND(o.gross_amount_xof * p.commission_percentage / 100.0)
                          WHEN p.billing_model = 'fixed_only' THEN p.fixed_fee_xof
                          ELSE ROUND(o.gross_amount_xof * p.commission_percentage / 100.0) + p.fixed_fee_xof
                        END
                      ),0)::bigint AS revenue_xof
                 FROM orders o
                 LEFT JOIN policy p ON TRUE
                WHERE o.status = 'paid'`),
  ]);
  const statusMap = Object.fromEntries(subscriptions.rows.map((row: any) => [String(row.status), asInt(row.count)]));
  const activePlans = plans.rows.filter((row: any) => row.is_active).length;
  const activeProducts = products.rows.filter((row: any) => row.is_active).length;
  return {
    summary: {
      revenueXOF: asInt(revenue.rows[0]?.amount),
      paymentCount: asInt(revenue.rows[0]?.count),
      activeSubscriptions: asInt(statusMap.active),
      pendingSubscriptions: asInt(statusMap.pending),
      expiredSubscriptions: asInt(statusMap.expired),
      suspendedSubscriptions: asInt(statusMap.suspended),
      cancelledSubscriptions: asInt(statusMap.cancelled),
      activePlans,
      activeProducts,
      catalogVersion: asInt(versions.rows[0]?.version) || 1,
    },
    plans: plans.rows.map(mapPlan),
    plans_with_config: plans.rows.map((plan: any) => ({
      ...mapPlan(plan),
      subscribers: asInt(planSubscribers.rows.find((row: any) => row.plan_id === plan.id)?.n),
      configs: configs.rows.filter((row: any) => row.plan_id === plan.id).map(mapPlanConfig),
    })),
    features: features.rows.map(mapFeature),
    groups: groups.rows.map((row: any) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
      isActive: Boolean(row.is_active),
      sortOrder: asInt(row.sort_order),
    })),
    matrix: matrix.rows.map((row: any) => ({
      groupId: String(row.group_id),
      planId: String(row.plan_id),
      monthlyXOF: asInt(row.monthly_xof),
      annualXOF: asInt(row.annual_xof),
      discountPercent: Number(row.discount_percent),
      isActive: Boolean(row.is_active),
      version: asInt(row.version) || 1,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    })),
    products: products.rows.map((row: any) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
      productType: String(row.product_type || 'other'),
      unit: String(row.unit || 'service'),
      billingModel: String(row.billing_model || 'one_time'),
      basePriceXOF: asInt(row.base_price_xof),
      currency: String(row.currency || 'XOF'),
      periodDays: row.period_days === null ? null : asInt(row.period_days),
      quantity: asInt(row.quantity) || 1,
      requiresQuote: Boolean(row.requires_quote),
      isActive: Boolean(row.is_active),
      isPublic: Boolean(row.is_public),
      version: asInt(row.version) || 1,
    })),
    packages: packages.rows.map((row: any) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
      priceXOF: asInt(row.price_xof),
      isActive: Boolean(row.is_active),
      version: asInt(row.version) || 1,
    })),
    ticketFees: ticket.rows[0] ? {
      commissionPercentage: Number(ticket.rows[0].commission_percentage),
      fixedFeeXOF: asInt(ticket.rows[0].fixed_fee_xof),
      currency: String(ticket.rows[0].currency || 'XOF'),
      feePayer: String(ticket.rows[0].fee_payer || 'organizer'),
      billingModel: String(ticket.rows[0].billing_model || 'percentage_plus_fixed'),
      conditions: String(ticket.rows[0].conditions || ''),
      isActive: Boolean(ticket.rows[0].is_active),
      version: asInt(ticket.rows[0].version) || 1,
      updatedAt: ticket.rows[0].updated_at ? new Date(ticket.rows[0].updated_at).toISOString() : null,
      generatedRevenueXOF: asInt(ticketRevenue.rows[0]?.revenue_xof),
      grossTicketVolumeXOF: asInt(ticketRevenue.rows[0]?.gross_xof),
      ticketCount: asInt(ticketRevenue.rows[0]?.ticket_count),
      history: ticketHistory.rows.map((row: any) => ({
        id: String(row.id),
        version: asInt(row.version),
        oldValues: row.old_values,
        newValues: row.new_values,
        changedBy: String(row.changed_by || ''),
        reason: String(row.reason || ''),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      })),
    } : null,
    rules: rules.rows[0] ? {
      annualDiscountPercent: Number(rules.rows[0].annual_discount_percent),
      gracePeriodDays: asInt(rules.rows[0].grace_period_days),
      renewalNoticeDays: asInt(rules.rows[0].renewal_notice_days),
      autoSuspendAfterExpiry: Boolean(rules.rows[0].auto_suspend_after_expiry),
      autoRenewalEnabled: Boolean(rules.rows[0].auto_renewal_enabled),
      allowPlanChange: Boolean(rules.rows[0].allow_plan_change),
      allowExtraPublications: Boolean(rules.rows[0].allow_extra_publications),
      monthlyPostRule: asInt(rules.rows[0].monthly_post_rule),
      terms: String(rules.rows[0].terms || ''),
      version: asInt(rules.rows[0].version) || 1,
      updatedAt: rules.rows[0].updated_at ? new Date(rules.rows[0].updated_at).toISOString() : null,
    } : null,
    versions: versions.rows.map((row: any) => ({
      id: String(row.id),
      version: asInt(row.version),
      reason: String(row.reason || ''),
      changedBy: String(row.changed_by || ''),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    recentAudit: audit.rows.map((row: any) => ({
      id: String(row.id),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      action: String(row.action),
      field: row.field_name ? String(row.field_name) : null,
      reason: String(row.reason || ''),
      actorName: String(row.actor_name || ''),
      catalogVersion: asInt(row.catalog_version),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function getCommercialPlanConfiguration(planId: string) {
  const result = await db().query(
    `SELECT p.*, pfc.feature_id, pfc.enabled, pfc.limit_kind, pfc.numeric_value, pfc.text_value
       FROM plans p LEFT JOIN plan_feature_configs pfc ON pfc.plan_id = p.id
      WHERE p.id = $1`,
    [planId],
  );
  if (result.rows.length === 0) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
  const plan = mapPlan(result.rows[0]);
  const configs = result.rows.filter((row: any) => row.feature_id).map(mapPlanConfig);
  const subscribers = await db().query('SELECT COUNT(*)::int AS n FROM subscriptions WHERE plan_id = $1', [planId]);
  const versions = await db().query(
    `SELECT id, version, changed_by, reason, catalog_version, created_at FROM plan_versions
      WHERE plan_id = $1 ORDER BY version DESC`,
    [planId],
  );
  return {
    plan,
    configs,
    subscribers: asInt(subscribers.rows[0]?.n),
    versions: versions.rows.map((row: any) => ({
      id: String(row.id),
      version: asInt(row.version),
      changedBy: String(row.changed_by),
      reason: String(row.reason || ''),
      catalogVersion: asInt(row.catalog_version),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
  };
}

function validatePlanInput(input: any) {
  const name = text(input.name, 120);
  if (!name) throw new CommercialError(400, 'PLAN_NAME_REQUIRED', 'O nome do plano é obrigatório.');
  const code = slug(text(input.code, 80) || name);
  if (!code) throw new CommercialError(400, 'PLAN_CODE_REQUIRED', 'O código do plano é obrigatório.');
  return {
    name,
    code,
    description: text(input.description, 2000),
    priceXOF: money(input.priceXOF ?? input.price_xof ?? 0, 'Preço de referência'),
    annualPriceXOF: input.annualPriceXOF === null || input.annualPriceXOF === undefined ? null : money(input.annualPriceXOF, 'Preço anual'),
    descriptionText: text(input.description, 2000),
    billingPeriod: ['monthly', 'annual'].includes(String(input.billingPeriod)) ? String(input.billingPeriod) : 'monthly',
    isActive: bool(input.isActive, true),
    isPublic: bool(input.isPublic, true),
    annualContract: bool(input.annualContract, false),
    badge: text(input.badge, 80) || null,
    benefits: Array.isArray(input.benefits) ? input.benefits.map((item: unknown) => text(item, 200)).filter(Boolean).slice(0, 30) : [],
    sortOrder: Math.max(0, asInt(input.sortOrder)),
  };
}

export async function createCommercialPlan(input: any, actor: CommercialActor, reason: string) {
  const value = validatePlanInput(input);
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const duplicate = await client.query('SELECT id FROM plans WHERE code = $1', [value.code]);
    if (duplicate.rows[0]) throw new CommercialError(409, 'PLAN_CODE_EXISTS', 'Já existe um plano com este código.');
    const id = `plan-${value.code}-${randomUUID().slice(0, 8)}`;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Criação de plano');
    const result = await client.query(
      `INSERT INTO plans (id, name, price_xof, billing_period, is_active, code, description, benefits,
        annual_price_xof, badge, sort_order, is_public, annual_contract, version, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,NOW()) RETURNING *`,
      [id, value.name, value.priceXOF, value.billingPeriod, value.isActive, value.code, value.description,
        JSON.stringify(value.benefits), value.annualPriceXOF, value.badge, value.sortOrder, value.isPublic, value.annualContract],
    );
    const features = await client.query('SELECT id, code, value_type FROM subscription_features WHERE is_active = TRUE');
    for (const feature of features.rows) {
      const code = String(feature.code);
      const kind = feature.value_type === 'quota' ? 'number' : feature.value_type === 'number' ? 'number' : feature.value_type === 'text' ? 'text' : 'flag';
      const numeric = code === 'posts' ? 3 : code === 'promotions' || code === 'search_priority' || code === 'categories' ? (code === 'categories' ? 1 : 0) : null;
      const textValue = code === 'profile_type' ? 'standard' : code === 'statistics' ? 'basic' : code === 'reports' ? 'none' : null;
      await client.query(
        `INSERT INTO plan_feature_configs (plan_id, feature_id, enabled, limit_kind, numeric_value, text_value)
         VALUES ($1,$2,TRUE,$3,$4,$5)`,
        [id, feature.id, kind, numeric, textValue],
      );
    }
    await client.query(
      `INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
       VALUES ($1,$2,1,$3,$4,$5,$6)`,
      [`${id}-v1`, id, JSON.stringify(result.rows[0]), actorLabel, reason || 'Versão inicial do plano.', catalogVersion],
    );
    await writeAudit(client, { entityType: 'plan', entityId: id, action: 'created', newValue: mapPlan(result.rows[0]), reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { plan: mapPlan(result.rows[0]), catalogVersion };
  });
}

export async function updateCommercialPlan(planId: string, input: any, actor: CommercialActor, reason: string) {
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM plans WHERE id = $1 FOR UPDATE', [planId])).rows[0];
    if (!before) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    const value = validatePlanInput({ ...mapPlan(before), ...input, benefits: input.benefits ?? before.benefits });
    if (value.code !== String(before.code)) {
      const duplicate = await client.query('SELECT id FROM plans WHERE code = $1 AND id <> $2', [value.code, planId]);
      if (duplicate.rows[0]) throw new CommercialError(409, 'PLAN_CODE_EXISTS', 'Já existe um plano com este código.');
    }
    const version = asInt(before.version) + 1;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Alteração de plano');
    const updated = (await client.query(
      `UPDATE plans SET name=$2, code=$3, description=$4, price_xof=$5, annual_price_xof=$6,
        billing_period=$7, is_active=$8, is_public=$9, annual_contract=$10, badge=$11,
        benefits=$12, sort_order=$13, version=$14, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [planId, value.name, value.code, value.description, value.priceXOF, value.annualPriceXOF,
        value.billingPeriod, value.isActive, value.isPublic, value.annualContract, value.badge,
        JSON.stringify(value.benefits), value.sortOrder, version],
    )).rows[0];
    await client.query(
      `INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [`${planId}-v${version}`, planId, version, JSON.stringify(updated), actorLabel, reason || 'Alteração de plano.', catalogVersion],
    );
    await writeAudit(client, {
      entityType: 'plan', entityId: planId, action: 'updated', oldValue: mapPlan(before), newValue: mapPlan(updated),
      reason, actor: actorLabel, actorId: actor.id, catalogVersion,
    });
    return { plan: mapPlan(updated), catalogVersion };
  });
}

export async function duplicateCommercialPlan(planId: string, input: any, actor: CommercialActor, reason: string) {
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const source = (await client.query('SELECT * FROM plans WHERE id = $1', [planId])).rows[0];
    if (!source) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    const baseCode = `${source.code || 'plano'}-copia`;
    let code = baseCode;
    let suffix = 2;
    while ((await client.query('SELECT 1 FROM plans WHERE code = $1', [code])).rows[0]) {
      code = `${baseCode}-${suffix++}`;
    }
    const id = `plan-${code}-${randomUUID().slice(0, 8)}`;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Duplicação de plano');
    const name = text(input.name, 120) || `${source.name} (cópia)`;
    const duplicate = (await client.query(
      `INSERT INTO plans (id, name, price_xof, billing_period, is_active, code, description, benefits,
        annual_price_xof, badge, sort_order, is_public, annual_contract, version, updated_at)
       SELECT $1,$2,price_xof,billing_period,FALSE,$3,description,benefits,annual_price_xof,badge,sort_order+1,is_public,annual_contract,1,NOW()
         FROM plans WHERE id=$4 RETURNING *`,
      [id, name, code, planId],
    )).rows[0];
    await client.query(
      `INSERT INTO plan_feature_configs (plan_id, feature_id, enabled, limit_kind, numeric_value, text_value)
       SELECT $1, feature_id, enabled, limit_kind, numeric_value, text_value FROM plan_feature_configs WHERE plan_id=$2`,
      [id, planId],
    );
    await client.query(
      `INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
       VALUES ($1,$2,1,$3,$4,$5,$6)`,
      [`${id}-v1`, id, JSON.stringify(duplicate), actorLabel, reason || 'Plano duplicado.', catalogVersion],
    );
    await writeAudit(client, { entityType: 'plan', entityId: id, action: 'duplicated', oldValue: { sourcePlanId: planId }, newValue: mapPlan(duplicate), reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { plan: mapPlan(duplicate), catalogVersion };
  });
}

export async function toggleCommercialPlan(planId: string, active: boolean, actor: CommercialActor, reason: string) {
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM plans WHERE id = $1 FOR UPDATE', [planId])).rows[0];
    if (!before) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    const version = asInt(before.version) + 1;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || (active ? 'Ativação de plano' : 'Desativação de plano'));
    const updated = (await client.query('UPDATE plans SET is_active=$2, version=$3, updated_at=NOW() WHERE id=$1 RETURNING *', [planId, active, version])).rows[0];
    await client.query(
      `INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [`${planId}-v${version}`, planId, version, JSON.stringify(updated), actorLabel, reason || 'Alteração de estado.', catalogVersion],
    );
    await writeAudit(client, { entityType: 'plan', entityId: planId, action: active ? 'activated' : 'deactivated', field: 'isActive', oldValue: Boolean(before.is_active), newValue: active, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { plan: mapPlan(updated), catalogVersion };
  });
}

export async function updatePlanConfiguration(planId: string, configs: any[], actor: CommercialActor, reason: string) {
  if (!Array.isArray(configs)) throw new CommercialError(400, 'INVALID_CONFIGURATION', 'A configuração do plano é inválida.');
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const plan = (await client.query('SELECT * FROM plans WHERE id = $1 FOR UPDATE', [planId])).rows[0];
    if (!plan) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    const features = await client.query('SELECT id, value_type FROM subscription_features');
    const featureIds = new Set(features.rows.map((row: any) => String(row.id)));
    const before = (await client.query('SELECT * FROM plan_feature_configs WHERE plan_id = $1', [planId])).rows;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Configuração de funcionalidades e limites');
    for (const config of configs) {
      if (!featureIds.has(String(config.featureId))) throw new CommercialError(400, 'FEATURE_NOT_FOUND', 'Funcionalidade inválida.');
      const kind = ['number', 'unlimited', 'negotiated', 'flag', 'text'].includes(String(config.limitKind)) ? String(config.limitKind) : 'flag';
      const numeric = kind === 'number' ? Math.max(0, asInt(config.numericValue)) : null;
      await client.query(
        `INSERT INTO plan_feature_configs (plan_id, feature_id, enabled, limit_kind, numeric_value, text_value, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled=EXCLUDED.enabled, limit_kind=EXCLUDED.limit_kind,
           numeric_value=EXCLUDED.numeric_value, text_value=EXCLUDED.text_value, updated_at=NOW()`,
        [planId, config.featureId, bool(config.enabled), kind, numeric, text(config.textValue, 120) || null],
      );
    }
    const version = asInt(plan.version) + 1;
    const updatedPlan = (await client.query('UPDATE plans SET version=$2, updated_at=NOW() WHERE id=$1 RETURNING *', [planId, version])).rows[0];
    const after = (await client.query('SELECT * FROM plan_feature_configs WHERE plan_id = $1', [planId])).rows;
    await client.query(
      `INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [`${planId}-v${version}`, planId, version, JSON.stringify({ plan: updatedPlan, configs: after }), actorLabel, reason || 'Alteração de funcionalidades e limites.', catalogVersion],
    );
    await writeAudit(client, { entityType: 'plan_config', entityId: planId, action: 'updated', oldValue: before, newValue: after, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { plan: mapPlan(updatedPlan), configs: after.map(mapPlanConfig), catalogVersion };
  });
}

export async function updatePriceMatrix(groupId: string, planId: string, input: any, actor: CommercialActor, reason: string) {
  const monthly = money(input.monthlyXOF, 'Preço mensal');
  let annual = input.annualXOF === undefined || input.annualXOF === null || input.annualXOF === ''
    ? 0
    : money(input.annualXOF, 'Preço anual');
  let discount = input.discountPercent === undefined || input.discountPercent === null || input.discountPercent === ''
    ? null
    : percentage(input.discountPercent, 'Desconto anual');
  if (monthly === 0) {
    annual = 0;
    discount = discount ?? 0;
  } else if (annual > 0 && discount === null) {
    discount = Math.round((1 - annual / (monthly * 12)) * 10000) / 100;
  } else {
    discount = discount ?? 0;
    annual = Math.round(monthly * 12 * (1 - discount / 100));
  }
  if (annual > monthly * 12) throw new CommercialError(400, 'INVALID_ANNUAL_PRICE', 'O preço anual não pode exceder 12 mensalidades.');
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const group = await client.query('SELECT 1 FROM commercial_price_groups WHERE id=$1', [groupId]);
    if (!group.rows[0]) throw new CommercialError(404, 'PRICE_GROUP_NOT_FOUND', 'Grupo de categorias não encontrado.');
    const plan = await client.query('SELECT 1 FROM plans WHERE id=$1', [planId]);
    if (!plan.rows[0]) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano não encontrado.');
    const before = (await client.query('SELECT * FROM commercial_price_matrix WHERE group_id=$1 AND plan_id=$2', [groupId, planId])).rows[0] || null;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Alteração da matriz de preços');
    const version = asInt(before?.version) + 1 || 1;
    const updated = (await client.query(
      `INSERT INTO commercial_price_matrix (group_id, plan_id, monthly_xof, annual_xof, discount_percent, is_active, version, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (group_id, plan_id) DO UPDATE SET monthly_xof=EXCLUDED.monthly_xof, annual_xof=EXCLUDED.annual_xof,
         discount_percent=EXCLUDED.discount_percent, is_active=EXCLUDED.is_active, version=EXCLUDED.version, updated_at=NOW()
       RETURNING *`,
      [groupId, planId, monthly, annual, discount, bool(input.isActive, true), version],
    )).rows[0];
    await writeAudit(client, {
      entityType: 'price_matrix', entityId: `${groupId}:${planId}`, action: 'updated', oldValue: before, newValue: updated,
      reason, actor: actorLabel, actorId: actor.id, catalogVersion,
    });
    return { matrix: { groupId, planId, monthlyXOF: monthly, annualXOF: annual, discountPercent: discount, isActive: Boolean(updated.is_active), version, catalogVersion } };
  });
}

export async function createPriceGroup(input: any, actor: CommercialActor, reason: string) {
  const name = text(input.name, 160);
  if (!name) throw new CommercialError(400, 'GROUP_NAME_REQUIRED', 'O nome do grupo é obrigatório.');
  const code = slug(text(input.code, 80) || name).replace(/-/g, '_');
  if (!code) throw new CommercialError(400, 'GROUP_CODE_REQUIRED', 'O código do grupo é obrigatório.');
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    if ((await client.query('SELECT 1 FROM commercial_price_groups WHERE code=$1', [code])).rows[0]) {
      throw new CommercialError(409, 'PRICE_GROUP_EXISTS', 'Já existe um grupo com este código.');
    }
    const id = `group-${code}-${randomUUID().slice(0, 6)}`;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Criação de grupo de categorias');
    const group = (await client.query(
      `INSERT INTO commercial_price_groups (id, code, name, description, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, code, name, text(input.description, 1000), true, Math.max(0, asInt(input.sortOrder))],
    )).rows[0];
    const plans = await client.query('SELECT id, price_xof FROM plans WHERE is_active=TRUE');
    for (const plan of plans.rows) {
      const monthly = asInt(plan.price_xof);
      await client.query(
        `INSERT INTO commercial_price_matrix (group_id, plan_id, monthly_xof, annual_xof, discount_percent, is_active)
         VALUES ($1,$2,$3,$4,15,TRUE)`,
        [id, plan.id, monthly, Math.round(monthly * 12 * 0.85)],
      );
    }
    await writeAudit(client, { entityType: 'price_group', entityId: id, action: 'created', newValue: group, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { group: { id, code, name, description: String(group.description || ''), isActive: true, sortOrder: asInt(group.sort_order) }, catalogVersion };
  });
}

export async function createFeature(input: any, actor: CommercialActor, reason: string) {
  const name = text(input.name, 120);
  if (!name) throw new CommercialError(400, 'FEATURE_NAME_REQUIRED', 'O nome da funcionalidade é obrigatório.');
  const code = slug(text(input.code, 80) || name).replace(/-/g, '_');
  const valueType = ['quota', 'flag', 'text', 'number'].includes(String(input.valueType)) ? String(input.valueType) : 'flag';
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    if ((await client.query('SELECT 1 FROM subscription_features WHERE code=$1', [code])).rows[0]) {
      throw new CommercialError(409, 'FEATURE_EXISTS', 'Já existe uma funcionalidade com este código.');
    }
    const id = `feature-${code}-${randomUUID().slice(0, 8)}`;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Criação de funcionalidade');
    const feature = (await client.query(
      `INSERT INTO subscription_features (id, code, name, description, category, value_type, unit, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *`,
      [id, code, name, text(input.description, 1000), text(input.category, 80) || 'custom', valueType, text(input.unit, 80) || null],
    )).rows[0];
    const plans = await client.query('SELECT id FROM plans');
    for (const plan of plans.rows) {
      await client.query(
        `INSERT INTO plan_feature_configs (plan_id, feature_id, enabled, limit_kind, numeric_value, text_value)
         VALUES ($1,$2,FALSE,$3,NULL,NULL)`,
        [plan.id, id, valueType === 'quota' ? 'number' : valueType === 'number' ? 'number' : valueType === 'text' ? 'text' : 'flag'],
      );
    }
    await writeAudit(client, { entityType: 'feature', entityId: id, action: 'created', newValue: mapFeature(feature), reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { feature: mapFeature(feature), catalogVersion };
  });
}

export async function updateFeature(featureId: string, input: any, actor: CommercialActor, reason: string) {
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM subscription_features WHERE id=$1 FOR UPDATE', [featureId])).rows[0];
    if (!before) throw new CommercialError(404, 'FEATURE_NOT_FOUND', 'Funcionalidade não encontrada.');
    const name = text(input.name, 120) || String(before.name);
    const isActive = bool(input.isActive, Boolean(before.is_active));
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Alteração de funcionalidade');
    const updated = (await client.query(
      'UPDATE subscription_features SET name=$2, description=$3, is_active=$4, updated_at=NOW() WHERE id=$1 RETURNING *',
      [featureId, name, text(input.description ?? before.description, 1000), isActive],
    )).rows[0];
    await writeAudit(client, { entityType: 'feature', entityId: featureId, action: 'updated', oldValue: mapFeature(before), newValue: mapFeature(updated), reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { feature: mapFeature(updated), catalogVersion };
  });
}

export async function createProduct(input: any, actor: CommercialActor, reason: string) {
  const name = text(input.name, 160);
  const rawCode = text(input.code, 80).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!name || !rawCode) throw new CommercialError(400, 'PRODUCT_REQUIRED', 'Nome e código do produto são obrigatórios.');
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    if ((await client.query('SELECT 1 FROM commercial_products WHERE code=$1', [rawCode])).rows[0]) {
      throw new CommercialError(409, 'PRODUCT_CODE_EXISTS', 'Já existe um produto com este código.');
    }
    const id = `product-${rawCode.toLowerCase()}-${randomUUID().slice(0, 6)}`;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Criação de produto comercial');
    const product = (await client.query(
      `INSERT INTO commercial_products (id, code, name, description, product_type, unit, billing_model,
        base_price_xof, currency, period_days, quantity, requires_quote, is_active, is_public)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, rawCode, name, text(input.description, 2000), text(input.productType, 80) || 'other',
        text(input.unit, 80) || 'service', text(input.billingModel, 80) || 'one_time',
        money(input.basePriceXOF, 'Preço base'), text(input.currency, 10) || 'XOF',
        input.periodDays === null || input.periodDays === undefined || input.periodDays === '' ? null : Math.max(0, asInt(input.periodDays)),
        Math.max(1, asInt(input.quantity) || 1), bool(input.requiresQuote), bool(input.isActive, true), bool(input.isPublic, false)],
    )).rows[0];
    await client.query(
      `INSERT INTO commercial_product_prices (product_id, quantity, duration_days, price_xof, label)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, Math.max(1, asInt(input.quantity) || 1), Math.max(0, asInt(input.periodDays) || 0), money(input.basePriceXOF, 'Preço base'), 'Preço unitário'],
    );
    await writeAudit(client, { entityType: 'product', entityId: id, action: 'created', newValue: product, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { productId: id, catalogVersion };
  });
}

export async function updateProduct(productId: string, input: any, actor: CommercialActor, reason: string) {
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM commercial_products WHERE id=$1 FOR UPDATE', [productId])).rows[0];
    if (!before) throw new CommercialError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
    let code = String(before.code);
    if (input.code) {
      code = text(input.code, 80).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if ((await client.query('SELECT 1 FROM commercial_products WHERE code=$1 AND id<>$2', [code, productId])).rows[0]) {
        throw new CommercialError(409, 'PRODUCT_CODE_EXISTS', 'Já existe um produto com este código.');
      }
    }
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Alteração de produto comercial');
    const updated = (await client.query(
      `UPDATE commercial_products SET code=$2, name=$3, description=$4, product_type=$5, unit=$6,
        billing_model=$7, base_price_xof=$8, currency=$9, period_days=$10, quantity=$11,
        requires_quote=$12, is_active=$13, is_public=$14, version=version+1, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [productId, code, text(input.name ?? before.name, 160), text(input.description ?? before.description, 2000),
        text(input.productType ?? before.product_type, 80), text(input.unit ?? before.unit, 80),
        text(input.billingModel ?? before.billing_model, 80), money(input.basePriceXOF ?? before.base_price_xof, 'Preço base'),
        text(input.currency ?? before.currency, 10), input.periodDays === null ? null : (input.periodDays === undefined ? before.period_days : Math.max(0, asInt(input.periodDays))),
        Math.max(1, asInt(input.quantity ?? before.quantity)), bool(input.requiresQuote, Boolean(before.requires_quote)),
        bool(input.isActive, Boolean(before.is_active)), bool(input.isPublic, Boolean(before.is_public))],
    )).rows[0];
    await writeAudit(client, { entityType: 'product', entityId: productId, action: 'updated', oldValue: before, newValue: updated, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { productId, catalogVersion };
  });
}

export async function createPackage(input: any, actor: CommercialActor, reason: string) {
  const name = text(input.name, 160);
  const code = text(input.code, 80).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!name || !code) throw new CommercialError(400, 'PACKAGE_REQUIRED', 'Nome e código do pacote são obrigatórios.');
  if (!Array.isArray(input.items) || input.items.length === 0) throw new CommercialError(400, 'PACKAGE_ITEMS_REQUIRED', 'O pacote precisa de pelo menos um produto.');
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    if ((await client.query('SELECT 1 FROM commercial_packages WHERE code=$1', [code])).rows[0]) {
      throw new CommercialError(409, 'PACKAGE_CODE_EXISTS', 'Já existe um pacote com este código.');
    }
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Criação de pacote comercial');
    const id = `package-${code.toLowerCase()}-${randomUUID().slice(0, 6)}`;
    const pkg = (await client.query(
      `INSERT INTO commercial_packages (id, code, name, description, price_xof, currency, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, code, name, text(input.description, 2000), money(input.priceXOF, 'Preço do pacote'), text(input.currency, 10) || 'XOF', bool(input.isActive, true)],
    )).rows[0];
    for (const item of input.items) {
      const product = await client.query('SELECT id FROM commercial_products WHERE id=$1 OR code=$2', [String(item.productId || ''), String(item.productId || '')]);
      if (!product.rows[0]) throw new CommercialError(404, 'PRODUCT_NOT_FOUND', 'Produto do pacote não encontrado.');
      await client.query(
        'INSERT INTO commercial_package_items (package_id, product_id, quantity) VALUES ($1,$2,$3)',
        [id, product.rows[0].id, Math.max(1, asInt(item.quantity))],
      );
    }
    await writeAudit(client, { entityType: 'package', entityId: id, action: 'created', newValue: pkg, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { packageId: id, catalogVersion };
  });
}

export async function updateTicketFees(input: any, actor: CommercialActor, reason: string) {
  const commission = percentage(input.commissionPercentage, 'Comissão');
  const fixed = money(input.fixedFeeXOF, 'Taxa fixa');
  const billingModel = ['percentage_plus_fixed', 'percentage_only', 'fixed_only'].includes(String(input.billingModel)) ? String(input.billingModel) : 'percentage_plus_fixed';
  const feePayer = ['buyer', 'organizer', 'split'].includes(String(input.feePayer)) ? String(input.feePayer) : 'organizer';
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM ticket_fee_settings WHERE id=$1 FOR UPDATE', ['default'])).rows[0];
    if (!before) throw new CommercialError(404, 'TICKET_FEES_NOT_CONFIGURED', 'As taxas de bilheteira não estão configuradas.');
    const version = asInt(before.version) + 1;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Alteração das taxas de bilheteira');
    const updated = (await client.query(
      `UPDATE ticket_fee_settings SET commission_percentage=$1, fixed_fee_xof=$2, currency=$3,
        fee_payer=$4, billing_model=$5, conditions=$6, is_active=$7, version=$8, updated_at=NOW()
       WHERE id='default' RETURNING *`,
      [commission, fixed, text(input.currency, 10) || 'XOF', feePayer, billingModel,
        text(input.conditions ?? before.conditions, 2000), bool(input.isActive, Boolean(before.is_active)), version],
    )).rows[0];
    await client.query(
      'INSERT INTO ticket_fee_history (id, version, old_values, new_values, changed_by, reason) VALUES ($1,$2,$3,$4,$5,$6)',
      [`ticket-fee-v${version}-${randomUUID().slice(0, 6)}`, version, JSON.stringify(before), JSON.stringify(updated), actorLabel, reason || 'Alteração das taxas de bilheteira.'],
    );
    await writeAudit(client, { entityType: 'ticket_fees', entityId: 'default', action: 'updated', oldValue: before, newValue: updated, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { ticketFees: { commissionPercentage: commission, fixedFeeXOF: fixed, version, catalogVersion } };
  });
}

export async function updateCommercialRules(input: any, actor: CommercialActor, reason: string) {
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM commercial_rules WHERE id=$1 FOR UPDATE', ['default'])).rows[0];
    if (!before) throw new CommercialError(404, 'RULES_NOT_CONFIGURED', 'As regras comerciais não estão configuradas.');
    const version = asInt(before.version) + 1;
    const catalogVersion = await createCatalogVersion(client, actorLabel, reason || 'Alteração das regras comerciais');
    const updated = (await client.query(
      `UPDATE commercial_rules SET annual_discount_percent=$1, grace_period_days=$2, renewal_notice_days=$3,
        auto_suspend_after_expiry=$4, auto_renewal_enabled=$5, allow_plan_change=$6,
        allow_extra_publications=$7, monthly_post_rule=$8, terms=$9, version=$10, updated_at=NOW()
       WHERE id='default' RETURNING *`,
      [percentage(input.annualDiscountPercent ?? before.annual_discount_percent, 'Desconto anual'),
        Math.max(0, asInt(input.gracePeriodDays ?? before.grace_period_days)),
        Math.max(0, asInt(input.renewalNoticeDays ?? before.renewal_notice_days)),
        bool(input.autoSuspendAfterExpiry, Boolean(before.auto_suspend_after_expiry)),
        bool(input.autoRenewalEnabled, Boolean(before.auto_renewal_enabled)),
        bool(input.allowPlanChange, Boolean(before.allow_plan_change)),
        bool(input.allowExtraPublications, Boolean(before.allow_extra_publications)),
        Math.max(0, asInt(input.monthlyPostRule ?? before.monthly_post_rule)),
        text(input.terms ?? before.terms, 5000), version],
    )).rows[0];
    await writeAudit(client, { entityType: 'commercial_rules', entityId: 'default', action: 'updated', oldValue: before, newValue: updated, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { rules: updated, catalogVersion };
  });
}

export async function listCommercialSubscriptions(filters: any = {}) {
  const dbc = db();
  await syncCompanySubscriptions(dbc);
  let status = text(filters.status, 40);
  if (!['all', 'active', 'pending', 'expired', 'suspended', 'cancelled'].includes(status)) status = 'all';
  const search = text(filters.q, 200);
  const planId = text(filters.planId, 80);
  const groupId = text(filters.groupId, 80);
  const provider = text(filters.provider, 40);
  const paymentType = text(filters.paymentType, 40);
  const from = parseDate(filters.from);
  const to = parseDate(filters.to);
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status !== 'all') {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(c.name ILIKE $${params.length} OR s.id ILIKE $${params.length} OR c.id ILIKE $${params.length})`);
  }
  if (planId) { params.push(planId); conditions.push(`s.plan_id = $${params.length}`); }
  if (groupId) { params.push(groupId); conditions.push(`s.category_group_id = $${params.length}`); }
  if (provider) { params.push(provider); conditions.push(`s.provider = $${params.length}`); }
  if (paymentType) { params.push(paymentType); conditions.push(`s.payment_type = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`s.starts_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`s.starts_at <= $${params.length}`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await dbc.query(`${SUBSCRIPTION_SELECT} ${where} ORDER BY s.updated_at DESC, c.name`, params);
  const counts = await dbc.query(
    `SELECT COUNT(*) FILTER (WHERE ${ACTIVE_SUBSCRIPTION})::int AS active,
            COUNT(*) FILTER (WHERE s.status='pending')::int AS pending,
            COUNT(*) FILTER (WHERE s.status='expired' OR (s.status='active' AND s.ends_at < CURRENT_DATE))::int AS expired,
            COUNT(*) FILTER (WHERE s.status='suspended')::int AS suspended,
            COUNT(*) FILTER (WHERE s.status='cancelled')::int AS cancelled,
            COUNT(*)::int AS total
       FROM subscriptions s`,
  );
  return {
    items: result.rows.map(mapSubscription),
    counts: {
      all: asInt(counts.rows[0]?.total),
      active: asInt(counts.rows[0]?.active),
      pending: asInt(counts.rows[0]?.pending),
      expired: asInt(counts.rows[0]?.expired),
      suspended: asInt(counts.rows[0]?.suspended),
      cancelled: asInt(counts.rows[0]?.cancelled),
    },
  };
}

export async function getCommercialSubscriptionDetail(id: string) {
  const result = await db().query(`${SUBSCRIPTION_SELECT} WHERE s.id = $1`, [id]);
  if (!result.rows[0]) throw new CommercialError(404, 'SUBSCRIPTION_NOT_FOUND', 'Assinatura não encontrada.');
  const row = result.rows[0];
  const [payments, history, planConfig, matrix] = await Promise.all([
    db().query(
      `SELECT id, use_case, status, gross_amount_xof, provider, provider_reference, created_at, confirmed_at
         FROM payment_transactions WHERE business_id=$1 AND use_case IN ('subscription_initial','subscription_renewal','subscription_upgrade')
        ORDER BY created_at DESC LIMIT 100`,
      [row.company_id],
    ),
    db().query(
      `SELECT * FROM commercial_audit_log WHERE (entity_type='subscription' AND entity_id=$1) OR (entity_type='plan' AND entity_id=$2)
        ORDER BY created_at DESC LIMIT 100`,
      [id, row.plan_id],
    ),
    planSnapshot(db(), String(row.plan_id)),
    db().query('SELECT * FROM commercial_price_matrix WHERE group_id=$1 AND plan_id=$2', [row.category_group_id, row.plan_id]),
  ]);
  return {
    subscription: mapSubscription(row),
    snapshot: {
      featureSnapshot: row.feature_snapshot,
      limitsSnapshot: row.limits_snapshot,
      contractSnapshot: row.contract_snapshot,
      catalogVersion: asInt(row.catalog_version),
      planVersion: asInt(row.plan_version),
    },
    currentPlan: { plan: mapPlan(planConfig.plan), features: planConfig.features },
    matrix: matrix.rows[0] ? {
      monthlyXOF: asInt(matrix.rows[0].monthly_xof),
      annualXOF: asInt(matrix.rows[0].annual_xof),
      discountPercent: Number(matrix.rows[0].discount_percent),
    } : null,
    payments: payments.rows.map((payment: any) => ({
      id: String(payment.id),
      useCase: String(payment.use_case || ''),
      status: String(payment.status || ''),
      amountXOF: asInt(payment.gross_amount_xof),
      provider: payment.provider ? String(payment.provider) : null,
      providerReference: payment.provider_reference ? String(payment.provider_reference) : null,
      createdAt: payment.created_at ? new Date(payment.created_at).toISOString() : null,
      confirmedAt: payment.confirmed_at ? new Date(payment.confirmed_at).toISOString() : null,
    })),
    history: history.rows.map((entry: any) => ({
      id: String(entry.id),
      entityType: String(entry.entity_type),
      action: String(entry.action),
      oldValue: entry.old_value,
      newValue: entry.new_value,
      reason: String(entry.reason || ''),
      actorName: String(entry.actor_name || ''),
      createdAt: entry.created_at ? new Date(entry.created_at).toISOString() : null,
    })),
  };
}

export async function changeSubscriptionStatus(id: string, input: any, actor: CommercialActor, reason: string) {
  const status = ['active', 'pending', 'expired', 'suspended', 'cancelled'].includes(String(input.status)) ? String(input.status) : '';
  if (!status) throw new CommercialError(400, 'INVALID_SUBSCRIPTION_STATUS', 'Estado de assinatura inválido.');
  if (status === 'cancelled' && !text(reason, 500)) throw new CommercialError(400, 'CANCELLATION_REASON_REQUIRED', 'Indique o motivo do cancelamento.');
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM subscriptions WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!before) throw new CommercialError(404, 'SUBSCRIPTION_NOT_FOUND', 'Assinatura não encontrada.');
    if (before.status === status) throw new CommercialError(409, 'SUBSCRIPTION_STATUS_UNCHANGED', 'A assinatura já tem este estado.');
    const catalogVersion = await currentCatalogVersion(client);
    const updated = (await client.query(
      `UPDATE subscriptions SET status=$2, cancelled_at=CASE WHEN $2='cancelled' THEN NOW() ELSE cancelled_at END,
        notes=$3, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, status, text(input.notes ?? before.notes, 2000) || null],
    )).rows[0];
    await writeAudit(client, { entityType: 'subscription', entityId: id, action: 'status_changed', field: 'status', oldValue: before.status, newValue: status, reason, actor: actorLabel, actorId: actor.id, catalogVersion });
    return { subscription: mapSubscription({ ...before, ...updated, company_name: before.company_name }), catalogVersion };
  });
}

export async function renewSubscription(id: string, input: any, actor: CommercialActor, reason: string) {
  const actorLabel = await actorName(actor);
  return withTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM subscriptions WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!before) throw new CommercialError(404, 'SUBSCRIPTION_NOT_FOUND', 'Assinatura não encontrada.');
    if (before.status === 'cancelled') throw new CommercialError(409, 'SUBSCRIPTION_CANCELLED', 'Uma assinatura cancelada não pode ser renovada.');
    const endsAt = parseDate(input.endsAt);
    if (!endsAt) throw new CommercialError(400, 'INVALID_RENEWAL_DATE', 'Indique uma data de fim válida.');
    if (Date.parse(endsAt) <= Date.now()) throw new CommercialError(400, 'RENEWAL_DATE_IN_PAST', 'A nova data de fim deve estar no futuro.');
    const snapshot = await planSnapshot(client, String(before.plan_id));
    const groupId = before.category_group_id || await resolveCompanyGroup(client, String(before.company_id));
    const matrix = await client.query('SELECT * FROM commercial_price_matrix WHERE group_id=$1 AND plan_id=$2', [groupId, before.plan_id]);
    const monthly = matrix.rows[0] ? asInt(matrix.rows[0].monthly_xof) : asInt(snapshot.plan.price_xof);
    const billingPeriod = input.billingPeriod === 'annual' ? 'annual' : 'monthly';
    const contractedPrice = input.contractedPriceXOF === undefined ? (billingPeriod === 'annual' && matrix.rows[0] ? asInt(matrix.rows[0].annual_xof) : monthly) : money(input.contractedPriceXOF, 'Preço contratado');
    const catalogVersion = await currentCatalogVersion(client);
    const features = Object.fromEntries(snapshot.features.map((feature: any) => [feature.code, feature]));
    const limits = Object.fromEntries(snapshot.features.filter((feature: any) => ['number', 'unlimited', 'negotiated'].includes(feature.limitKind)).map((feature: any) => [feature.code, feature.numericValue]));
    const updated = (await client.query(
      `UPDATE subscriptions SET ends_at=$2, status='active', contracted_price_xof=$3, billing_period=$4,
        catalog_version=$5, plan_version=$6, feature_snapshot=$7, limits_snapshot=$8, contract_snapshot=$9,
        payment_transaction_id=$10, provider=$11, payment_type=$12, notes=$13, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, endsAt, contractedPrice, billingPeriod, catalogVersion, asInt(snapshot.plan.version),
        JSON.stringify(features), JSON.stringify(limits),
        JSON.stringify({ plan: mapPlan(snapshot.plan), features, limits, catalogVersion, planVersion: asInt(snapshot.plan.version), renewedAt: new Date().toISOString() }),
        text(input.paymentTransactionId, 160) || before.payment_transaction_id,
        text(input.provider, 80) || before.provider,
        text(input.paymentType, 80) || before.payment_type,
        text(input.notes ?? before.notes, 2000) || null],
    )).rows[0];
    await writeAudit(client, { entityType: 'subscription', entityId: id, action: 'renewed', oldValue: { endsAt: before.ends_at, price: before.contracted_price_xof, catalogVersion: before.catalog_version }, newValue: { endsAt, contractedPrice, catalogVersion, planVersion: snapshot.plan.version }, reason: reason || 'Renovação administrativa.', actor: actorLabel, actorId: actor.id, catalogVersion });
    return { subscription: mapSubscription({ ...before, ...updated }), catalogVersion };
  });
}

export async function quoteCommercialSubscription(companyId: string, planId: string, billingPeriod = 'monthly') {
  const actor = await db().query(
    `SELECT c.id, c.name, c.category_id, COALESCE(parent.id, cat.id, c.data->>'groupGroupId', c.data->>'groupId') AS group_id,
            c.data->>'tier' AS tier
       FROM companies c LEFT JOIN categories cat ON cat.id=c.category_id LEFT JOIN categories parent ON parent.id=cat.parent_id
      WHERE c.id=$1 LIMIT 1`,
    [companyId],
  );
  if (!actor.rows[0]) throw new CommercialError(404, 'COMPANY_NOT_FOUND', 'Empresa não encontrada.');
  const plan = await db().query('SELECT * FROM plans WHERE id=$1 AND is_active=TRUE', [planId]);
  if (!plan.rows[0]) throw new CommercialError(404, 'PLAN_NOT_FOUND', 'Plano ativo não encontrado.');
  const rawGroup = actor.rows[0].group_id ? String(actor.rows[0].group_id) : '';
  const groupId = rawGroup.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/gi, '') || null;
  const matrix = groupId ? await db().query('SELECT * FROM commercial_price_matrix WHERE group_id=$1 AND plan_id=$2 AND is_active=TRUE', [groupId, planId]) : { rows: [] };
  const monthly = matrix.rows[0] ? asInt(matrix.rows[0].monthly_xof) : asInt(plan.rows[0].price_xof);
  return {
    companyId,
    companyName: String(actor.rows[0].name),
    groupId,
    planId,
    billingPeriod: billingPeriod === 'annual' ? 'annual' : 'monthly',
    priceXOF: billingPeriod === 'annual' && matrix.rows[0] ? asInt(matrix.rows[0].annual_xof) : monthly,
    monthlyXOF: monthly,
    annualXOF: matrix.rows[0] ? asInt(matrix.rows[0].annual_xof) : Math.round(monthly * 12 * 0.85),
    source: matrix.rows[0] ? 'matrix' : 'plan_reference',
  };
}

export async function listCommercialAudit(filters: any = {}) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const entityType = text(filters.entityType, 60);
  const search = text(filters.q, 200);
  const from = parseDate(filters.from);
  const to = parseDate(filters.to);
  if (entityType) { params.push(entityType); conditions.push(`entity_type=$${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(entity_id ILIKE $${params.length} OR action ILIKE $${params.length} OR actor_name ILIKE $${params.length} OR reason ILIKE $${params.length})`); }
  if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`created_at <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(asInt(filters.limit) || 500, 1), 2000);
  const [audit, versions, planVersions] = await Promise.all([
    db().query(`SELECT * FROM commercial_audit_log ${where} ORDER BY created_at DESC LIMIT ${limit}`, params),
    db().query('SELECT * FROM commercial_catalog_versions ORDER BY version DESC LIMIT 100'),
    db().query(
      `SELECT pv.*, p.name AS plan_name FROM plan_versions pv JOIN plans p ON p.id=pv.plan_id ORDER BY pv.created_at DESC LIMIT 200`,
    ),
  ]);
  return {
    items: audit.rows.map((row: any) => ({
      id: String(row.id),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      action: String(row.action),
      field: row.field_name ? String(row.field_name) : null,
      oldValue: row.old_value,
      newValue: row.new_value,
      reason: String(row.reason || ''),
      actorId: row.actor_id ? String(row.actor_id) : null,
      actorName: String(row.actor_name || ''),
      catalogVersion: asInt(row.catalog_version),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    versions: versions.rows.map((row: any) => ({
      id: String(row.id),
      version: asInt(row.version),
      reason: String(row.reason || ''),
      changedBy: String(row.changed_by || ''),
      snapshot: row.snapshot,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    planVersions: planVersions.rows.map((row: any) => ({
      id: String(row.id),
      planId: String(row.plan_id),
      planName: String(row.plan_name || row.plan_id),
      version: asInt(row.version),
      changedBy: String(row.changed_by || ''),
      reason: String(row.reason || ''),
      catalogVersion: asInt(row.catalog_version),
      snapshot: row.snapshot,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
  };
}

export async function getPublicCommercialCatalog(companyId = '') {
  const dbc = db();
  const [plans, features, configs, groups, matrix, products, tiers, packages, packageItems, ticket, rules] = await Promise.all([
    dbc.query('SELECT * FROM plans ORDER BY sort_order, name'),
    dbc.query('SELECT * FROM subscription_features ORDER BY category, name'),
    dbc.query('SELECT * FROM plan_feature_configs'),
    dbc.query('SELECT * FROM commercial_price_groups ORDER BY sort_order'),
    dbc.query('SELECT * FROM commercial_price_matrix'),
    dbc.query('SELECT * FROM commercial_products ORDER BY name'),
    dbc.query('SELECT * FROM commercial_product_prices ORDER BY quantity, duration_days'),
    dbc.query('SELECT * FROM commercial_packages WHERE is_active = TRUE ORDER BY name'),
    dbc.query('SELECT * FROM commercial_package_items'),
    dbc.query('SELECT * FROM ticket_fee_settings WHERE id = $1', ['default']),
    dbc.query('SELECT * FROM commercial_rules WHERE id = $1', ['default']),
  ]);
  const groupId = companyId ? await resolveCompanyGroup(dbc, companyId) : null;
  const featuresByPlan = new Map<string, any[]>();
  for (const config of configs.rows) {
    const feature = features.rows.find((row: any) => row.id === config.feature_id);
    if (!feature) continue;
    const current = featuresByPlan.get(String(config.plan_id)) || [];
    current.push({ ...config, code: feature.code, name: feature.name, valueType: feature.value_type });
    featuresByPlan.set(String(config.plan_id), current);
  }
  const legacyPlans = plans.rows.map((plan: any) => {
    const planConfigs = featuresByPlan.get(String(plan.id)) || [];
    const byCode = Object.fromEntries(planConfigs.map((config: any) => [String(config.code), config]));
    const limit = (code: string) => {
      const config = byCode[code];
      if (!config || !config.enabled) return 0;
      if (config.limit_kind === 'unlimited') return 'unlimited' as const;
      if (config.limit_kind === 'negotiated') return 'negotiated' as const;
      return config.numeric_value === null ? 0 : asInt(config.numeric_value);
    };
    const cell = matrix.rows.find((row: any) => row.plan_id === plan.id && row.group_id === groupId && row.is_active);
    const enabled = (code: string) => Boolean(byCode[code]?.enabled);
    const textValue = (code: string) => String(byCode[code]?.text_value || '');
    return {
      id: String(plan.id),
      slug: String(plan.code || plan.id),
      name: String(plan.name),
      description: String(plan.description || ''),
      price: cell ? asInt(cell.monthly_xof) : asInt(plan.price_xof),
      currency: 'XOF',
      billingPeriod: plan.billing_period === 'annual' ? 'annual' : 'monthly',
      postsPerMonth: limit('posts'),
      promotionsPerMonth: limit('promotions'),
      maxCategories: limit('categories'),
      priorityLevel: limit('search_priority') === 'unlimited' || limit('search_priority') === 'negotiated' ? 0 : Number(limit('search_priority') || 0),
      homepageRotation: enabled('homepage_rotation'),
      verifiedBadge: enabled('verified_badge'),
      expandedProfile: textValue('profile_type') === 'expanded',
      advancedStatistics: textValue('statistics') === 'advanced',
      accountManager: enabled('additional_features'),
      monthlyReports: ['monthly', 'advanced'].includes(textValue('reports')),
      exclusiveBanner: enabled('additional_features'),
      customBranding: enabled('additional_features'),
      annualContract: Boolean(plan.annual_contract),
      customConditions: textValue('profile_type') || undefined,
      featureSlugs: planConfigs.filter((config: any) => config.enabled).map((config: any) => String(config.code)),
      limits: Object.fromEntries(planConfigs.filter((config: any) => ['number', 'unlimited', 'negotiated'].includes(config.limit_kind)).map((config: any) => [String(config.code), config.limit_kind === 'number' ? asInt(config.numeric_value) : config.limit_kind])),
      badges: plan.badge ? [String(plan.badge)] : [],
      isActive: Boolean(plan.is_active),
      isPublic: Boolean(plan.is_public),
      version: asInt(plan.version) || 1,
      changePolicy: 'new_subscriptions' as const,
      updatedAt: plan.updated_at ? new Date(plan.updated_at).toISOString() : new Date().toISOString(),
      ...(['basic', 'professional', 'premium', 'enterprise'].includes(String(plan.code)) ? { legacyTier: String(plan.code) } : {}),
    };
  });
  return {
    plans: legacyPlans,
    features: features.rows.map((feature: any) => ({
      id: String(feature.id), name: String(feature.name), slug: String(feature.code), description: String(feature.description || ''),
      type: 'custom', isActive: Boolean(feature.is_active), createdAt: feature.created_at, updatedAt: feature.updated_at,
    })),
    groups: groups.rows.map((group: any) => ({ id: String(group.id), name: String(group.name), description: String(group.description || ''), isActive: Boolean(group.is_active) })),
    matrix: matrix.rows.map((row: any) => ({ groupId: String(row.group_id), planId: String(row.plan_id), monthlyXOF: asInt(row.monthly_xof), annualXOF: asInt(row.annual_xof), discountPercent: Number(row.discount_percent), isActive: Boolean(row.is_active) })),
    companyGroupId: groupId,
    products: products.rows.map((product: any) => ({
      id: String(product.id), code: String(product.code), name: String(product.name), description: String(product.description || ''),
      type: String(product.product_type || 'other'), unit: String(product.unit || 'service'), basePrice: asInt(product.base_price_xof),
      currency: String(product.currency || 'XOF'), billingModel: String(product.billing_model || 'one_time'),
      periodDays: product.period_days === null ? undefined : asInt(product.period_days), quantity: asInt(product.quantity) || 1,
      priceRules: tiers.rows.filter((tier: any) => tier.product_id === product.id && tier.is_active).map((tier: any) => ({
        id: `${product.code}-${tier.quantity}-${tier.duration_days}`, label: String(tier.label), quantity: asInt(tier.quantity),
        price: asInt(tier.price_xof), currency: String(product.currency || 'XOF'), durationDays: asInt(tier.duration_days) || undefined, isActive: true,
      })),
      requiresQuote: Boolean(product.requires_quote), isActive: Boolean(product.is_active), isPublic: Boolean(product.is_public),
      version: asInt(product.version) || 1, createdAt: product.created_at, updatedAt: product.updated_at,
      configuration: {},
    })),
    packages: packages.rows.map((pkg: any) => ({
      id: String(pkg.id), code: String(pkg.code), name: String(pkg.name), description: String(pkg.description || ''),
      priceXOF: asInt(pkg.price_xof), currency: String(pkg.currency || 'XOF'),
      items: packageItems.rows.filter((item: any) => item.package_id === pkg.id).map((item: any) => ({ productId: String(item.product_id), quantity: asInt(item.quantity) })),
    })),
    ticketFeePolicy: ticket.rows[0] ? {
      commissionPercentage: Number(ticket.rows[0].commission_percentage), fixedFee: asInt(ticket.rows[0].fixed_fee_xof),
      currency: String(ticket.rows[0].currency || 'XOF'), feePayer: String(ticket.rows[0].fee_payer || 'organizer'),
      billingModel: String(ticket.rows[0].billing_model || 'percentage_plus_fixed'),
      updatedAt: ticket.rows[0].updated_at ? new Date(ticket.rows[0].updated_at).toISOString() : new Date().toISOString(),
    } : null,
    annualDiscountPercent: rules.rows[0] ? Number(rules.rows[0].annual_discount_percent) : 15,
    monthlyPostRule: rules.rows[0] ? asInt(rules.rows[0].monthly_post_rule) : 3,
    updatedAt: new Date().toISOString(),
  };
}

export async function getLegacyTicketFeePolicy() {
  const result = await db().query('SELECT * FROM ticket_fee_settings WHERE id=$1 AND is_active=TRUE', ['default']);
  const policy = result.rows[0];
  if (!policy) return null;
  return {
    commissionPercentage: Number(policy.commission_percentage),
    fixedFee: asInt(policy.fixed_fee_xof),
    currency: String(policy.currency || 'XOF'),
    feePayer: String(policy.fee_payer || 'organizer'),
    billingModel: String(policy.billing_model || 'percentage_plus_fixed'),
    updatedAt: policy.updated_at ? new Date(policy.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function resolveDatabaseCommercialPrice(code: string, quantity: number, durationDays?: number): Promise<{ productId: string; price: number; code: string; quantity: number; name: string; currency: string } | null> {
  const dbc = db();
  const packageResult = await dbc.query('SELECT * FROM commercial_packages WHERE code = $1 AND is_active = TRUE', [code]);
  if (packageResult.rows[0]) {
    return { productId: String(packageResult.rows[0].id), price: asInt(packageResult.rows[0].price_xof), code, quantity: 1, name: String(packageResult.rows[0].name), currency: String(packageResult.rows[0].currency || 'XOF') };
  }
  const result = await dbc.query('SELECT * FROM commercial_products WHERE code = $1 AND is_active = TRUE', [code]);
  const product = result.rows[0];
  if (!product) return null;
  if (product.requires_quote) throw new CommercialError(409, 'PRODUCT_REQUIRES_QUOTE', 'Este produto requer orçamento da Administração.');
  const tiers = await dbc.query('SELECT * FROM commercial_product_prices WHERE product_id=$1 AND is_active=TRUE ORDER BY quantity DESC, duration_days DESC', [product.id]);
  const exact = tiers.rows.find((tier: any) => asInt(tier.quantity) === quantity && (!durationDays || asInt(tier.duration_days) === durationDays));
  const sameQuantity = exact || tiers.rows.find((tier: any) => asInt(tier.quantity) === quantity);
  const lower = tiers.rows.filter((tier: any) => asInt(tier.quantity) <= quantity).sort((a: any, b: any) => asInt(b.quantity) - asInt(a.quantity))[0];
  const price = sameQuantity ? asInt(sameQuantity.price_xof) : lower ? asInt(lower.price_xof) : asInt(product.base_price_xof) * quantity;
  return { productId: String(product.id), price, code, quantity, name: String(product.name), currency: String(product.currency || 'XOF') };
}

export async function getProductSales() {
  const result = await db().query(
    `SELECT product_code, COUNT(*)::int AS count, COALESCE(SUM(gross_amount_xof),0)::bigint AS gross_xof,
            COALESCE(SUM(platform_fee_xof),0)::bigint AS fee_xof
       FROM monetization_ledger GROUP BY product_code ORDER BY gross_xof DESC`,
  );
  return result.rows.map((row: any) => ({
    productCode: String(row.product_code || ''),
    count: asInt(row.count),
    grossXOF: asInt(row.gross_xof),
    feeXOF: asInt(row.fee_xof),
  }));
}
