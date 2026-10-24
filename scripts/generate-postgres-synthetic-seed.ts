import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SYNTHETIC_SEED_MANIFEST = Object.freeze({
  users: 50,
  companies: 30,
  company_members: 30,
  events: 30,
  ticket_types: 60,
  ticket_reservations: 100,
  orders: 80,
  tickets: 80,
  payment_transactions: 80,
  commissions: 30,
  refunds: 10,
  plans: 4,
  subscriptions: 30,
  reviews: 70,
  moderation_items: 30,
  notifications: 66,
  conversations: 30,
  conversation_messages: 80,
  support_tickets: 20,
  support_replies: 30,
  monetization_ledger: 30,
  monetization_wallets: 30,
} as const);

export type SyntheticSeedManifest = typeof SYNTHETIC_SEED_MANIFEST;

const TABLE_ORDER = Object.keys(SYNTHETIC_SEED_MANIFEST) as Array<keyof SyntheticSeedManifest>;
const DEFAULT_TARGET_DATABASE_NAME = 'guigui_pg18_synthetic_target';

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function padNumber(value: number, width = 3): string {
  return String(value).padStart(width, '0');
}

export function assertSyntheticSeedValid(manifest: Partial<SyntheticSeedManifest> = SYNTHETIC_SEED_MANIFEST): void {
  const normalized = { ...SYNTHETIC_SEED_MANIFEST, ...manifest } as SyntheticSeedManifest;

  for (const [tableName, count] of Object.entries(normalized)) {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Synthetic seed table ${tableName} must have a non-negative integer count.`);
    }
  }

  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  if (total !== 1000) {
    throw new Error(`Synthetic seed total rows must be exactly 1000, got ${total}.`);
  }

  if (TABLE_ORDER.length !== Object.keys(normalized).length) {
    throw new Error('Synthetic seed manifest is missing one or more target tables.');
  }
}

function rowsForUsers(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `synthetic_user_${padNumber(index + 1)}`;
    const number = index + 1;
    return `(${[
      sqlString(id),
      sqlString(`Synthetic User ${number}`),
      sqlString(`synthetic.user${padNumber(number, 3)}@example.test`),
      sqlString(`+245600${padNumber(number, 6)}`),
      sqlString(['Bissau Velho', 'Bandim', 'Santa Luzia', 'Caracol', 'Praca dos Herois'][number % 5]),
      sqlString(`https://example.invalid/avatar/${id}.png`),
      sqlString('user'),
      sqlString('active'),
      sqlString('synthetic_password_hash_' + id),
      sqlString('2026-01-01T00:00:00+00:00'),
      sqlString('2026-01-01T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForCompanies(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `synthetic_company_${padNumber(index + 1)}`;
    const number = index + 1;
    return `(${[
      sqlString(id),
      sqlString(`synthetic_user_${padNumber((index % 50) + 1)}`),
      sqlString(`Synthetic Company ${number}`),
      sqlString(['pending', 'active', 'active', 'suspended'][index % 4]),
      sqlString(`cat-${((index % 16) + 1)}`),
      sqlString('2026-01-02T00:00:00+00:00'),
      sqlString('2026-01-02T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForCompanyMembers(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const companyId = `synthetic_company_${padNumber(index + 1)}`;
    const userId = `synthetic_user_${padNumber(((index % 50) + 1))}`;
    const role = ['manager', 'editor', 'finance', 'support'][index % 4];
    return `(${[
      sqlString(companyId),
      sqlString(userId),
      sqlString(role),
      sqlString('{"role":"synthetic"}'),
      sqlString('2026-01-02T00:00:00+00:00'),
      sqlString('2026-01-03T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForEvents(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_event_${padNumber(number)}`),
      sqlString(`synthetic_company_${padNumber((index % 30) + 1)}`),
      sqlString(`Synthetic Event ${number}`),
      sqlString(['draft', 'published', 'published', 'cancelled'][index % 4]),
      sqlString(`2026-02-${String((index % 27) + 1).padStart(2, '0')}T18:00:00+00:00`),
      sqlString(`2026-02-${String((index % 27) + 2).padStart(2, '0')}T22:00:00+00:00`),
      sqlString('2026-01-01T00:00:00+00:00'),
      sqlString('2026-01-01T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForTicketTypes(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const eventIndex = Math.floor(index / 2) + 1;
    const typeName = ['Early Bird', 'Standard', 'VIP', 'Backstage'][index % 4];
    const price = 2500 + (index % 8) * 1500;
    return `(${[
      sqlString(`synthetic_ticket_type_${padNumber(index + 1)}`),
      sqlString(`synthetic_event_${padNumber(eventIndex)}`),
      sqlString(typeName),
      String(price),
      String(40 + (index % 9) * 5),
    ].join(', ')})`;
  });
}

function rowsForTicketReservations(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const eventIndex = (index % 30) + 1;
    const ticketTypeIndex = (index % 60) + 1;
    const reservationId = `synthetic_reservation_${padNumber(index + 1)}`;
    return `(${[
      sqlString(reservationId),
      sqlString(`synthetic_event_${padNumber(eventIndex)}`),
      sqlString(`synthetic_ticket_type_${padNumber(ticketTypeIndex)}`),
      String(2 + (index % 4)),
      sqlString(`2026-02-${String((index % 27) + 1).padStart(2, '0')}T18:00:00+00:00`),
      sqlString(['pending', 'confirmed', 'confirmed', 'released', 'expired'][index % 5]),
      sqlString('2026-01-05T00:00:00+00:00'),
      sqlString('2026-01-05T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForOrders(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const buyerId = `synthetic_user_${padNumber((index % 50) + 1)}`;
    const eventId = `synthetic_event_${padNumber((index % 30) + 1)}`;
    const gross = 2500 + (index % 7) * 1750;
    const fee = Math.round(gross * 0.08);
    const net = gross - fee;
    return `(${[
      sqlString(`synthetic_order_${padNumber(number)}`),
      sqlString(buyerId),
      sqlString(eventId),
      sqlString(['created', 'paid', 'paid', 'cancelled', 'refunded'][index % 5]),
      String(gross),
      String(fee),
      String(net),
      sqlString(`synthetic_order_key_${number}`),
      sqlString('2026-01-06T00:00:00+00:00'),
      sqlString('2026-01-06T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForTickets(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_ticket_${padNumber(number)}`),
      sqlString(`synthetic_order_${padNumber((index % 80) + 1)}`),
      sqlString(`synthetic_event_${padNumber((index % 30) + 1)}`),
      sqlString(`synthetic_ticket_type_${padNumber((index % 60) + 1)}`),
      sqlString(`synthetic_qr_${padNumber(number)}`),
      sqlString(`SYNT-${padNumber(number, 5)}`),
      sqlString(`synthetic_pin_hash_${padNumber(number)}`),
      sqlString(`synthetic_signature_${padNumber(number)}`),
      sqlString(['valid', 'used', 'valid', 'cancelled', 'expired'][index % 5]),
      sqlString(`2026-06-${String((index % 28) + 1).padStart(2, '0')}T18:00:00+00:00`),
      sqlString('2026-01-07T00:00:00+00:00'),
      sqlString('Synthetic Buyer'),
      sqlString('+245601000000'),
      sqlString('Synthetic Holder'),
      sqlString('+245601000001'),
      sqlString('synthetic_proxy'),
    ].join(', ')})`;
  });
}

function rowsForPaymentTransactions(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const gross = 2100 + (index % 6) * 2400;
    const fee = Math.round(gross * 0.1);
    const commission = Math.round(gross * 0.05);
    const net = gross - fee - commission;
    return `(${[
      sqlString(`synthetic_payment_${padNumber(number)}`),
      sqlString(`synthetic_order_${padNumber((index % 80) + 1)}`),
      sqlString('synthetic_gateway'),
      sqlString(`synthetic_reference_${padNumber(number)}`),
      sqlString(['paid', 'pending', 'authorized', 'refunded', 'failed'][index % 5]),
      String(gross),
      String(fee),
      String(commission),
      String(net),
      sqlString(`synthetic_payment_key_${padNumber(number)}`),
      sqlString('2026-01-08T00:00:00+00:00'),
      sqlString('2026-01-08T00:00:00+00:00'),
      sqlString('Synthetic Buyer'),
      sqlString('+24560100010' + String(number % 10)),
      sqlString('checkout'),
      sqlString('test'),
      sqlString('2026-01-08T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForCommissions(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_commission_${padNumber(number)}`),
      sqlString(`synthetic_payment_${padNumber((index % 80) + 1)}`),
      String(1200 + (index % 7) * 350),
      sqlString('2026-01-09T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForRefunds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_refund_${padNumber(number)}`),
      sqlString(`synthetic_payment_${padNumber((index % 80) + 1)}`),
      String(500 + index * 25),
      sqlString(['duplicate_payment', 'customer_request', 'fraud_check'][index % 3]),
      sqlString(['requested', 'processed', 'failed'][index % 3]),
      sqlString('2026-01-10T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForPlans(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const planNames = ['Starter', 'Growth', 'Scale', 'Enterprise'];
    return `(${[
      sqlString(`synthetic_plan_${padNumber(index + 1)}`),
      sqlString(planNames[index]),
      String(1500 + index * 2000),
      sqlString(['monthly', 'annual'][index % 2]),
      index === 0 ? 'TRUE' : 'TRUE',
    ].join(', ')})`;
  });
}

function rowsForSubscriptions(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const companyId = `synthetic_company_${padNumber((index % 30) + 1)}`;
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_subscription_${padNumber(number)}`),
      sqlString(companyId),
      sqlString(`synthetic_plan_${padNumber((index % 4) + 1)}`),
      sqlString(['trialing', 'active', 'past_due', 'cancelled'][index % 4]),
      sqlString(`2026-01-${String((index % 27) + 1).padStart(2, '0')}T09:00:00+00:00`),
      sqlString(`2026-02-${String((index % 27) + 1).padStart(2, '0')}T09:00:00+00:00`),
      sqlString('2026-01-01T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForReviews(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const businessId = `synthetic_company_${padNumber((index % 30) + 1)}`;
    const score = ['nao_gostei', 'gostei', 'gostei_muito', 'muito_bom'][index % 4];
    return `(${[
      sqlString(`synthetic_review_${padNumber(number)}`),
      sqlString(businessId),
      sqlString(`synthetic_user_${padNumber((index % 50) + 1)}`),
      sqlString(`Synthetic Reviewer ${number}`),
      sqlString(`synthetic_phone_hash_${padNumber(number)}`),
      sqlString(`+245***${padNumber(number % 1000, 3)}`),
      sqlString(score),
      String((index % 4) + 1),
      sqlString(`Comentario sintético ${number} para revisao.`),
      sqlString(['approved', 'pending', 'flagged'][index % 3]),
      sqlString(''),
      sqlString(''),
      index % 2 === 0 ? 'TRUE' : 'FALSE',
      sqlString('2026-01-11T00:00:00+00:00'),
      sqlString('2026-01-11T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForModerationItems(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_moderation_${padNumber(number)}`),
      sqlString(`synthetic_company_${padNumber((index % 30) + 1)}`),
      sqlString(['review', 'conversation', 'support'][index % 3]),
      sqlString(`synthetic_target_${padNumber(number)}`),
      sqlString(['pending', 'approved', 'rejected'][index % 3]),
      sqlString('Synthetic moderation review'),
      sqlString(`synthetic_user_${padNumber((index % 50) + 1)}`),
      sqlString('2026-01-12T00:00:00+00:00'),
      sqlString('2026-01-13T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForNotifications(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const userId = `synthetic_user_${padNumber((index % 50) + 1)}`;
    return `(${[
      sqlString(`synthetic_notification_${padNumber(number)}`),
      sqlString(userId),
      sqlString(['system', 'payment', 'support', 'marketing'][index % 4]),
      sqlString(`Synthetic notification ${number}`),
      sqlString(`This is a synthetic notification for test dataset ${number}.`),
      index % 3 === 0 ? sqlString('2026-01-14T00:00:00+00:00') : 'NULL',
      sqlString('{"source":"synthetic"}'),
      sqlString('2026-01-14T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForConversations(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const userId = `synthetic_user_${padNumber((index % 50) + 1)}`;
    const businessId = `synthetic_company_${padNumber((index % 30) + 1)}`;
    return `(${[
      sqlString(`synthetic_conversation_${padNumber(number)}`),
      sqlString(userId),
      sqlString(businessId),
      sqlString(`Synthetic conversation ${number}`),
      sqlString(`Synthetic last message for conversation ${number}`),
      index % 2 === 0 ? 'TRUE' : 'FALSE',
      index % 2 === 0 ? 'FALSE' : 'TRUE',
      sqlString('2026-01-15T00:00:00+00:00'),
      sqlString('2026-01-15T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForConversationMessages(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const conversationId = `synthetic_conversation_${padNumber((index % 30) + 1)}`;
    const senderId = `synthetic_user_${padNumber((index % 50) + 1)}`;
    return `(${[
      sqlString(`synthetic_message_${padNumber(number)}`),
      sqlString(conversationId),
      sqlString(senderId),
      sqlString(['user', 'business'][index % 2]),
      sqlString(`Synthetic message body ${number}`),
      index % 3 === 0 ? 'TRUE' : 'FALSE',
      index % 2 === 0 ? 'TRUE' : 'FALSE',
      sqlString('2026-01-16T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForSupportTickets(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_support_ticket_${padNumber(number)}`),
      sqlString(`synthetic_user_${padNumber((index % 50) + 1)}`),
      sqlString(`synthetic_user_${padNumber(((index + 10) % 50) + 1)}`),
      sqlString(['billing', 'technical', 'account', 'platform'][index % 4]),
      sqlString(`Synthetic support subject ${number}`),
      sqlString(`Synthetic support description ${number}`),
      sqlString(['open', 'in_progress', 'resolved'][index % 3]),
      sqlString('2026-01-17T00:00:00+00:00'),
      sqlString('2026-01-17T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForSupportReplies(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_support_reply_${padNumber(number)}`),
      sqlString(`synthetic_support_ticket_${padNumber((index % 20) + 1)}`),
      sqlString(`synthetic_user_${padNumber((index % 50) + 1)}`),
      sqlString(['user', 'business', 'admin'][index % 3]),
      sqlString(`Synthetic support reply ${number}`),
      sqlString('2026-01-18T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForMonetizationLedger(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return `(${[
      sqlString(`synthetic_ledger_${padNumber(number)}`),
      sqlString(`synthetic_payment_${padNumber((index % 80) + 1)}`),
      sqlString(`synthetic_company_${padNumber((index % 30) + 1)}`),
      sqlString(`synthetic_user_${padNumber((index % 50) + 1)}`),
      sqlString(`synthetic_product_${padNumber(number)}`),
      sqlString(`SYNTHETIC-${padNumber(number, 4)}`),
      sqlString(`Synthetic ledger entry ${number}`),
      String(1 + (index % 4)),
      String(1000 + (index % 10) * 500),
      String(80 + (index % 5) * 25),
      String(900 + (index % 10) * 500),
      sqlString('XOF'),
      sqlString(['pending', 'paid', 'refunded'][index % 3]),
      sqlString('{"source":"synthetic"}'),
      sqlString('2026-01-19T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

function rowsForMonetizationWallets(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const companyId = `synthetic_company_${padNumber(index + 1)}`;
    return `(${[
      sqlString(companyId),
      String(index % 4),
      String(index % 3),
      String(index % 2),
      String((index + 1) % 2),
      sqlString('2026-01-20T00:00:00+00:00'),
    ].join(', ')})`;
  });
}

export function createSyntheticSeedSql(manifest: Partial<SyntheticSeedManifest> = SYNTHETIC_SEED_MANIFEST): string {
  assertSyntheticSeedValid(manifest);
  const normalized = { ...SYNTHETIC_SEED_MANIFEST, ...manifest } as SyntheticSeedManifest;

  const inserts = [
    ['users', 'id, name, email, phone, neighborhood, avatar_url, role, account_status, password_hash, created_at, updated_at', rowsForUsers(normalized.users), '(id)'],
    ['companies', 'id, owner_user_id, name, status, category_id, created_at, updated_at', rowsForCompanies(normalized.companies), '(id)'],
    ['company_members', 'company_id, user_id, member_role, permissions, invited_at, accepted_at', rowsForCompanyMembers(normalized.company_members), '(company_id, user_id)'],
    ['events', 'id, company_id, title, status, starts_at, ends_at, created_at, updated_at', rowsForEvents(normalized.events), '(id)'],
    ['ticket_types', 'id, event_id, name, price_xof, quantity', rowsForTicketTypes(normalized.ticket_types), '(id)'],
    ['ticket_reservations', 'id, event_id, ticket_type_id, quantity, expires_at, status, created_at, updated_at', rowsForTicketReservations(normalized.ticket_reservations), '(id)'],
    ['orders', 'id, buyer_user_id, event_id, status, gross_amount_xof, fee_amount_xof, net_amount_xof, idempotency_key, created_at, updated_at', rowsForOrders(normalized.orders), '(id)'],
    ['tickets', 'id, order_id, event_id, ticket_type_id, qr_token, ticket_code, pin_hash, signature, status, expires_at, created_at, buyer_name, buyer_phone, holder_name, holder_phone, payment_method', rowsForTickets(normalized.tickets), '(id)'],
    ['payment_transactions', 'id, order_id, provider, provider_reference, status, gross_amount_xof, fee_amount_xof, commission_amount_xof, net_amount_xof, idempotency_key, created_at, updated_at, payer_name, payer_phone, use_case, provider_mode, confirmed_at', rowsForPaymentTransactions(normalized.payment_transactions), '(id)'],
    ['commissions', 'id, transaction_id, amount_xof, created_at', rowsForCommissions(normalized.commissions), '(id)'],
    ['refunds', 'id, transaction_id, amount_xof, reason, status, created_at', rowsForRefunds(normalized.refunds), '(id)'],
    ['plans', 'id, name, price_xof, billing_period, is_active', rowsForPlans(normalized.plans), '(id)'],
    ['subscriptions', 'id, company_id, plan_id, status, starts_at, ends_at, created_at', rowsForSubscriptions(normalized.subscriptions), '(id)'],
    ['reviews', 'id, business_id, author_user_id, author_name, author_phone_hash, author_phone_masked, qualitative_score, score_weight, comment, status, moderation_reason, owner_reply, verified_sms, created_at, updated_at', rowsForReviews(normalized.reviews), '(id)'],
    ['moderation_items', 'id, company_id, content_type, content_id, status, decision_reason, reviewed_by, created_at, reviewed_at', rowsForModerationItems(normalized.moderation_items), '(id)'],
    ['notifications', 'id, user_id, category, title, message, read_at, metadata, created_at', rowsForNotifications(normalized.notifications), '(id)'],
    ['conversations', 'id, user_id, business_id, subject, last_message, unread_for_user, unread_for_business, created_at, updated_at', rowsForConversations(normalized.conversations), '(user_id, business_id)'],
    ['conversation_messages', 'id, conversation_id, sender_id, sender_role, text, read_by_user, read_by_business, created_at', rowsForConversationMessages(normalized.conversation_messages), '(id)'],
    ['support_tickets', 'id, requester_user_id, assigned_user_id, category, subject, description, status, created_at, updated_at', rowsForSupportTickets(normalized.support_tickets), '(id)'],
    ['support_replies', 'id, support_ticket_id, sender_user_id, sender_role, text, created_at', rowsForSupportReplies(normalized.support_replies), '(id)'],
    ['monetization_ledger', 'id, transaction_id, business_id, user_id, product_id, product_code, description, quantity, gross_amount_xof, platform_fee_xof, net_amount_xof, currency, status, metadata, created_at', rowsForMonetizationLedger(normalized.monetization_ledger), '(id)'],
    ['monetization_wallets', 'business_id, posts_extra_purchased, promotions_extra_purchased, posts_extra_used, promotions_extra_used, updated_at', rowsForMonetizationWallets(normalized.monetization_wallets), '(business_id)'],
  ] as const;

  const finalCountQuery = `SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users UNION ALL
SELECT 'companies', COUNT(*) FROM companies UNION ALL
SELECT 'company_members', COUNT(*) FROM company_members UNION ALL
SELECT 'events', COUNT(*) FROM events UNION ALL
SELECT 'ticket_types', COUNT(*) FROM ticket_types UNION ALL
SELECT 'ticket_reservations', COUNT(*) FROM ticket_reservations UNION ALL
SELECT 'orders', COUNT(*) FROM orders UNION ALL
SELECT 'tickets', COUNT(*) FROM tickets UNION ALL
SELECT 'payment_transactions', COUNT(*) FROM payment_transactions UNION ALL
SELECT 'commissions', COUNT(*) FROM commissions UNION ALL
SELECT 'refunds', COUNT(*) FROM refunds UNION ALL
SELECT 'plans', COUNT(*) FROM plans UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions UNION ALL
SELECT 'reviews', COUNT(*) FROM reviews UNION ALL
SELECT 'moderation_items', COUNT(*) FROM moderation_items UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations UNION ALL
SELECT 'conversation_messages', COUNT(*) FROM conversation_messages UNION ALL
SELECT 'support_tickets', COUNT(*) FROM support_tickets UNION ALL
SELECT 'support_replies', COUNT(*) FROM support_replies UNION ALL
SELECT 'monetization_ledger', COUNT(*) FROM monetization_ledger UNION ALL
SELECT 'monetization_wallets', COUNT(*) FROM monetization_wallets;`;

  const sqlSections = [
    `-- Synthetic dataset generated for disposable PG18 import.`,
    `-- Target database: ${DEFAULT_TARGET_DATABASE_NAME}`,
    `BEGIN;`,
    `DO $$ BEGIN`,
    `  IF current_setting('server_version_num', true)::int < 180000 THEN`,
    `    RAISE EXCEPTION 'Synthetic seed requires PostgreSQL 18.';`,
    `  END IF;`,
    `END $$;`,
    `DO $$ BEGIN`,
    `  IF current_database() <> ${sqlString(DEFAULT_TARGET_DATABASE_NAME)} THEN`,
    `    RAISE EXCEPTION 'Synthetic seed can only run on the disposable local PostgreSQL 18 target.';`,
    `  END IF;`,
    `END $$;`,
    `DO $$ BEGIN`,
    `  IF EXISTS (SELECT 1 FROM users LIMIT 1) OR EXISTS (SELECT 1 FROM companies LIMIT 1) OR EXISTS (SELECT 1 FROM events LIMIT 1) THEN`,
    `    RAISE EXCEPTION 'Synthetic seed target must be empty before import.';`,
    `  END IF;`,
    `END $$;`,
    ...inserts.map(([tableName, columns, values, conflictColumn]) => `INSERT INTO ${tableName} (${columns}) VALUES ${values.join(',\n')} ON CONFLICT ${conflictColumn} DO NOTHING;`),
    finalCountQuery,
    `COMMIT;`,
  ];

  return `${sqlSections.join('\n\n')}\n`;
}

export async function writeSyntheticSeedFile(outputPath: string, manifest: Partial<SyntheticSeedManifest> = SYNTHETIC_SEED_MANIFEST): Promise<string> {
  const sql = createSyntheticSeedSql(manifest);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, 'utf8');
  return sql;
}

async function main(): Promise<void> {
  const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const outputPath = resolve(rootDir, 'db', 'seeds', 'guigui-synthetic-1000.sql');
  await writeSyntheticSeedFile(outputPath);
  console.log(`Generated synthetic PostgreSQL seed at ${outputPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
