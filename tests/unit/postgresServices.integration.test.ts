import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Integration tests require a real PostgreSQL test database. Set
// TEST_DATABASE_URL (e.g. postgres://user:pass@localhost:5432/guigui_test) to run
// them; otherwise the whole suite is skipped so the unit run stays green.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

// Point the shared pool (server/db.ts reads DATABASE_URL at import time) at the
// test database BEFORE any service module is imported.
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

const describeIfDb = testDatabaseUrl ? describe : describe.skip;

type DbModule = typeof import('../../server/db');
type PaymentModule = typeof import('../../server/postgresPaymentService');
type AuthModule = typeof import('../../server/postgresAuthService');
type ModerationModule = typeof import('../../server/postgresModerationService');
type CommunicationModule = typeof import('../../server/postgresCommunicationService');
type BusinessModule = typeof import('../../server/postgresBusinessService');
let db: DbModule;
let payment: PaymentModule;
let auth: AuthModule;
let moderation: ModerationModule;
let communication: CommunicationModule;
let businessService: BusinessModule;
let pool: NonNullable<DbModule['databasePool']>;

const schemaSql = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT NOT NULL,
     phone TEXT NOT NULL,
     neighborhood TEXT NOT NULL,
     avatar_url TEXT,
     role TEXT NOT NULL CHECK (role IN ('user','business','admin')),
     account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','deactivated')),
     password_hash TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
     `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, business_id TEXT NOT NULL, subject TEXT NOT NULL,
        last_message TEXT NOT NULL DEFAULT '', unread_for_user BOOLEAN NOT NULL DEFAULT FALSE,
        unread_for_business BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, business_id)
     )`,
     `CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL, sender_role TEXT NOT NULL, text TEXT NOT NULL,
           read_by_user BOOLEAN NOT NULL DEFAULT FALSE, read_by_business BOOLEAN NOT NULL DEFAULT FALSE,
           client_message_id TEXT
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS conversation_client_message_idx ON conversation_messages (conversation_id, client_message_id)`,
     `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email))`,
  `CREATE TABLE IF NOT EXISTS companies (
     id TEXT PRIMARY KEY, owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
     name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category_id TEXT,
     data JSONB NOT NULL DEFAULT '{}'::jsonb, reviewed_by TEXT, reviewed_at TIMESTAMPTZ,
     review_decision TEXT, review_reason TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS company_members (
     company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     member_role TEXT NOT NULL, permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
     invited_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ,
     PRIMARY KEY (company_id, user_id)
   )`,
  `CREATE TABLE IF NOT EXISTS payment_transactions (
     id TEXT PRIMARY KEY, order_id TEXT, provider TEXT NOT NULL, provider_reference TEXT,
     status TEXT NOT NULL, gross_amount_xof INTEGER NOT NULL, fee_amount_xof INTEGER NOT NULL DEFAULT 0,
     commission_amount_xof INTEGER NOT NULL DEFAULT 0, net_amount_xof INTEGER NOT NULL DEFAULT 0,
     idempotency_key TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), payer_name TEXT, payer_phone TEXT,
     use_case TEXT, provider_mode TEXT, confirmed_at TIMESTAMPTZ
   )`,
  `CREATE TABLE IF NOT EXISTS payment_events (
     id TEXT PRIMARY KEY, transaction_id TEXT REFERENCES payment_transactions(id) ON DELETE SET NULL,
     provider TEXT NOT NULL, event_reference TEXT NOT NULL, signature_valid BOOLEAN NOT NULL,
     payload JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE (provider, event_reference)
   )`,
  `CREATE TABLE IF NOT EXISTS moderation_items (
     id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
     content_type TEXT NOT NULL, content_id TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'appealed')),
     decision_reason TEXT, reviewed_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     reviewed_at TIMESTAMPTZ, item_data JSONB
   )`,
  // Keep older test databases aligned with the production migration.
  `ALTER TABLE moderation_items ADD COLUMN IF NOT EXISTS item_data JSONB`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'moderation_items_status_check'
         AND conrelid = 'moderation_items'::regclass
     ) THEN
       ALTER TABLE moderation_items
         ADD CONSTRAINT moderation_items_status_check
         CHECK (status IN ('pending', 'approved', 'rejected', 'appealed'));
     END IF;
   END $$`,
].join(';\n');

describeIfDb('Postgres services integration (real test database)', () => {
  beforeAll(async () => {
    vi.resetModules();
    // Import db first so the pool binds to TEST_DATABASE_URL, then the services.
    db = await import('../../server/db');
    pool = db.databasePool!;
    expect(pool, 'TEST_DATABASE_URL must produce a pool').toBeTruthy();
    await pool.query(schemaSql);
    payment = await import('../../server/postgresPaymentService');
    auth = await import('../../server/postgresAuthService');
    moderation = await import('../../server/postgresModerationService');
    communication = await import('../../server/postgresCommunicationService');
    businessService = await import('../../server/postgresBusinessService');
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  beforeEach(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM moderation_items');
    await pool.query('DELETE FROM conversation_messages');
    await pool.query('DELETE FROM conversations');
    await pool.query('DELETE FROM payment_events');
    await pool.query('DELETE FROM payment_transactions');
    await pool.query('DELETE FROM company_members');
    await pool.query('DELETE FROM companies');
    await pool.query('DELETE FROM users');
  });

  // ---------------------------------------------------------------------------
  // postgresAuthService
  // ---------------------------------------------------------------------------
  describe('postgresAuthService', () => {
    const newUser = {
      name: 'Fatou',
      email: 'Fatou@Guigui.com',
      phone: '+2459550000',
      neighborhood: 'Bissau',
      role: 'user' as const,
      password: 'secret123',
    };

    it('creates a user and reads it back case-insensitively', async () => {
      const created = await auth.createPostgresUser(newUser);
      expect(created?.email).toBe('fatou@guigui.com');

      const found = await auth.findPostgresUserByEmail('fatou@guigui.com');
      expect(found?.id).toBe(created?.id);
      expect(found?.accountStatus).toBe('active');

      const byId = await auth.findPostgresUserById(created!.id);
      expect(byId?.email).toBe('fatou@guigui.com');
    });

    it('returns null for unknown users', async () => {
      expect(await auth.findPostgresUserByEmail('missing@guigui.com')).toBeNull();
      expect(await auth.findPostgresUserById('usr-missing')).toBeNull();
    });

    it('links a business user to a company on creation', async () => {
      await pool.query(`INSERT INTO companies (id, name) VALUES ('co-1', 'Biz')`);
      const created = await auth.createPostgresUser({ ...newUser, email: 'biz@guigui.com', role: 'business', businessId: 'co-1' });
      expect(created?.businessId).toBe('co-1');

      const member = await pool.query('SELECT member_role FROM company_members WHERE user_id=$1', [created!.id]);
      expect(member.rowCount).toBe(1);
      expect(member.rows[0].member_role).toBe('manager');
    });

    it('does not create a duplicate account when the email conflicts', async () => {
      const first = await auth.createPostgresUser(newUser);
      const second = await auth.createPostgresUser({ ...newUser, name: 'Ignored' });
      expect(second).toBeNull();
      expect((await auth.findPostgresUserById(first!.id))?.name).toBe(newUser.name);
      const count = await pool.query('SELECT COUNT(*)::int AS n FROM users');
      expect(count.rows[0].n).toBe(1);
    });

    it('changes the password only when the current one matches', async () => {
      await auth.createPostgresUser(newUser);
      expect(await auth.changePostgresUserPassword('fatou@guigui.com', 'wrong', 'new-pass')).toBe(false);
      expect(await auth.changePostgresUserPassword('fatou@guigui.com', 'secret123', 'new-pass')).toBe(true);

      const stored = await auth.findPostgresUserByEmail('fatou@guigui.com');
      const { verifyPassword } = await import('../../server/authService');
      expect(verifyPassword('new-pass', stored!.passwordHash)).toBe(true);
    });

    it('returns false changing the password of an unknown user', async () => {
      expect(await auth.changePostgresUserPassword('ghost@guigui.com', 'x', 'y')).toBe(false);
    });

    it('deactivates and deletes a user', async () => {
      await auth.createPostgresUser(newUser);
      expect(await auth.deactivatePostgresUser('FATOU@guigui.com')).toBe(true);
      expect((await auth.findPostgresUserByEmail('fatou@guigui.com'))?.accountStatus).toBe('deactivated');

      expect(await auth.deletePostgresUser('fatou@guigui.com')).toBe(true);
      expect(await auth.findPostgresUserByEmail('fatou@guigui.com')).toBeNull();

      // Second delete affects no rows.
      expect(await auth.deletePostgresUser('fatou@guigui.com')).toBe(false);
      expect(await auth.deactivatePostgresUser('nobody@guigui.com')).toBe(false);
    });

    it('surfaces a database error instead of silently succeeding', async () => {
      // A role outside the CHECK constraint must raise, proving errors propagate.
      await expect(
        auth.createPostgresUser({ ...newUser, email: 'bad@guigui.com', role: 'nonsense' as never }),
      ).rejects.toThrow();
    });
  });

  describe('company approval workflow', () => {
    it('persists an approval and prevents a second decision', async () => {
      await pool.query(`INSERT INTO companies (id, name, status) VALUES ('approval-1', 'Empresa Pendente', 'pending')`);
      const result = await businessService.decidePostgresBusiness('approval-1', 'approve', 'admin-real', 'Documentação validada');
      expect(result).toMatchObject({ id: 'approval-1', status: 'active' });
      const row = await pool.query('SELECT status, reviewed_by, review_decision, review_reason FROM companies WHERE id=$1', ['approval-1']);
      expect(row.rows[0]).toEqual({ status: 'active', reviewed_by: 'admin-real', review_decision: 'approve', review_reason: 'Documentação validada' });
      expect(await businessService.decidePostgresBusiness('approval-1', 'reject', 'admin-real', 'Não deve alterar')).toBeNull();
    });

    it('persists a rejection with its reason and exposes only pending companies in the queue', async () => {
      await pool.query(`INSERT INTO companies (id, name, status) VALUES ('approval-2', 'Empresa Rejeitada', 'pending'), ('approval-3', 'Empresa Activa', 'active')`);
      const pending = await businessService.listPendingPostgresBusinesses();
      expect(pending.map((item) => item.id)).toEqual(['approval-2']);
      await expect(businessService.decidePostgresBusiness('approval-2', 'reject', 'admin-real', 'Dados incompletos')).resolves.toMatchObject({ status: 'rejected' });
      const row = await pool.query('SELECT status, review_decision, review_reason FROM companies WHERE id=$1', ['approval-2']);
      expect(row.rows[0]).toEqual({ status: 'rejected', review_decision: 'reject', review_reason: 'Dados incompletos' });
    });
  });

  // ---------------------------------------------------------------------------
  // postgresCommunicationService
  // ---------------------------------------------------------------------------
  describe('postgresCommunicationService', () => {
    it('marks an existing conversation unread for the business on a new message', async () => {
      await pool.query(`INSERT INTO conversations (id, user_id, business_id, subject, last_message, unread_for_business) VALUES ('conversation-1', 'user-1', 'business-1', 'Initial', 'Initial message', FALSE)`);

      const conversationId = await communication.createPostgresConversation({
        id: 'conversation-2', userId: 'user-1', businessId: 'business-1', subject: 'Updated', text: 'New message', senderId: 'user-1', senderRole: 'user',
      });

      expect(conversationId).toBe('conversation-1');
      const row = await pool.query('SELECT unread_for_business, last_message FROM conversations WHERE id=$1', [conversationId]);
      expect(row.rows[0]).toEqual({ unread_for_business: true, last_message: 'New message' });
    });
  });

  // ---------------------------------------------------------------------------
  // postgresPaymentService
  // ---------------------------------------------------------------------------
  describe('postgresPaymentService', () => {
    const tx = { id: 'tx-1', provider: 'orange_money', providerRef: 'OM-REF-1', status: 'confirmed_api', amountXOF: 5000, payerName: 'Awa', payerPhone: '+2459550001', useCase: 'ticket', providerMode: 'sandbox' };

    it('inserts a transaction mapping the status', async () => {
      await payment.persistPostgresPayment(tx);
      const row = await pool.query('SELECT status, gross_amount_xof, payer_name FROM payment_transactions WHERE id=$1', ['tx-1']);
      expect(row.rows[0].status).toBe('paid');
      expect(row.rows[0].gross_amount_xof).toBe(5000);
      expect(row.rows[0].payer_name).toBe('Awa');
    });

    it('upserts on conflict (same id) and advances the status', async () => {
      await payment.persistPostgresPayment(tx);
      await payment.persistPostgresPayment({ ...tx, status: 'confirmed_manual', payerName: 'Updated' });
      const row = await pool.query('SELECT status, payer_name FROM payment_transactions WHERE id=$1', ['tx-1']);
      expect(row.rows[0].status).toBe('authorized');
      expect(row.rows[0].payer_name).toBe('Updated');
      const count = await pool.query('SELECT COUNT(*)::int AS n FROM payment_transactions');
      expect(count.rows[0].n).toBe(1);
    });

    it('maps manual and reconciled statuses', async () => {
      await payment.persistPostgresPayment({ ...tx, id: 'tx-manual', status: 'pending_manual_confirmation', providerRef: 'OM-2' });
      await payment.persistPostgresPayment({ ...tx, id: 'tx-recon', status: 'reconciled', providerRef: 'OM-3' });
      const rows = await pool.query('SELECT id, status FROM payment_transactions ORDER BY id');
      expect(rows.rows).toEqual([{ id: 'tx-manual', status: 'pending' }, { id: 'tx-recon', status: 'paid' }]);
    });

    it('records a payment event and is idempotent per (provider, event_reference)', async () => {
      await payment.persistPostgresPayment(tx);
      await payment.recordPostgresPaymentEvent('orange_money', 'tx-1', { ok: true }, true, 'evt-1');
      await payment.recordPostgresPaymentEvent('orange_money', 'tx-1', { ok: true }, true, 'evt-1');
      const count = await pool.query('SELECT COUNT(*)::int AS n FROM payment_events');
      expect(count.rows[0].n).toBe(1);
      const row = await pool.query('SELECT signature_valid, payload FROM payment_events LIMIT 1');
      expect(row.rows[0].signature_valid).toBe(true);
      expect(row.rows[0].payload).toEqual({ ok: true });
    });

    it('propagates a database error (invalid amount / FK)', async () => {
      // transaction_id references a non-existent transaction -> FK violation.
      await expect(
        payment.recordPostgresPaymentEvent('telecel', 'missing-tx', { x: 1 }, false, 'evt-x'),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // postgresModerationService
  // ---------------------------------------------------------------------------
  describe('postgresModerationService', () => {
    const item = { id: 'mod-1', type: 'post', status: 'pending_human', contentSnippet: 'snippet', createdAt: new Date().toISOString() };

    it('inserts a moderation item mapping its status', async () => {
      await moderation.persistPostgresModeration(item);
      const row = await pool.query('SELECT content_type, status FROM moderation_items WHERE id=$1', ['mod-1']);
      expect(row.rows[0].content_type).toBe('post');
      expect(row.rows[0].status).toBe('pending');
    });

    it('upserts on conflict with a decision reason and review timestamp', async () => {
      await moderation.persistPostgresModeration(item);
      const reviewedAt = new Date().toISOString();
      await moderation.persistPostgresModeration({ ...item, status: 'rejected', reviewedAt, result: { reason: 'spam' } });
      const row = await pool.query('SELECT status, decision_reason, reviewed_at FROM moderation_items WHERE id=$1', ['mod-1']);
      expect(row.rows[0].status).toBe('rejected');
      expect(row.rows[0].decision_reason).toBe('spam');
      expect(row.rows[0].reviewed_at).toBeTruthy();
    });

    it('maps approved and appealed statuses', async () => {
      await moderation.persistPostgresModeration({ ...item, id: 'mod-ok', status: 'approved' });
      await moderation.persistPostgresModeration({ ...item, id: 'mod-appealed', status: 'appealed' });
      const rows = await pool.query('SELECT id, status FROM moderation_items ORDER BY id');
      expect(rows.rows).toEqual([{ id: 'mod-appealed', status: 'appealed' }, { id: 'mod-ok', status: 'approved' }]);
    });

    it('persistPostgresModerationReview delegates to persistPostgresModeration', async () => {
      await moderation.persistPostgresModerationReview({ ...item, status: 'approved' });
      const row = await pool.query('SELECT status FROM moderation_items WHERE id=$1', ['mod-1']);
      expect(row.rows[0].status).toBe('approved');
    });

    it('propagates a database error on an invalid status', async () => {
      await expect(
        pool.query('INSERT INTO moderation_items (id, content_type, content_id, status) VALUES ($1,$2,$3,$4)', ['bad', 'post', 'bad', 'not-a-status']),
      ).rejects.toThrow();
    });
  });
});

describe('Postgres services integration prerequisites', () => {
  it(testDatabaseUrl ? 'TEST_DATABASE_URL is configured' : 'skips when TEST_DATABASE_URL is not set', () => {
    expect(true).toBe(true);
  });
});

// Scheduling behavior is isolated from PostgreSQL so it can run in the normal unit suite.
describe('scheduling service processing states', () => {
  const baseItem = (overrides: Record<string, unknown> = {}) => ({
    id: 'schedule-1', businessId: 'business-1', ownerUserId: 'user-1', itemType: 'post', itemId: 'post-1',
    scheduledAt: '2026-01-01T10:00:00.000Z', timezone: 'Africa/Bissau', status: 'scheduled', attempts: 0,
    moderationStatus: 'approved', paymentStatus: 'not_required', createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z', ...overrides,
  });

  async function loadService(initial: Array<Record<string, unknown>>) {
    vi.resetModules();
    let storedItems = [...initial];
    const notifications: Array<Record<string, unknown>> = [];
    const saveJson = vi.fn((_: string, items: Array<Record<string, unknown>>) => { storedItems = items; });
    vi.doMock('../../server/runtimeStore', () => ({ loadJson: vi.fn(() => storedItems), saveJson }));
    vi.doMock('../../server/db', () => ({ databasePool: null }));
    vi.doMock('../../server/postgresCommunicationService', () => ({ persistPostgresNotification: vi.fn(async (notification) => { notifications.push(notification); }) }));
    const service = await import('../../server/schedulingService');
    return { service, getItems: () => storedItems, saveJson, notifications };
  }

  it('publishes due items, increments attempts, and notifies the owner', async () => {
    const { service, getItems, notifications } = await loadService([baseItem()]);
    expect(await service.processDueScheduledItems(new Date('2026-01-01T11:00:00.000Z'))).toBe(1);
    expect(getItems()[0]).toMatchObject({ status: 'published', attempts: 1, errorMessage: undefined });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ category: 'marketing', userId: 'user-1' });
  });

  it('expires published campaigns at their end time', async () => {
    const { service, getItems } = await loadService([baseItem({ itemType: 'campaign', status: 'published', endsAt: '2026-01-01T10:30:00.000Z' })]);
    expect(await service.processDueScheduledItems(new Date('2026-01-01T11:00:00.000Z'))).toBe(0);
    expect(getItems()[0].status).toBe('expired');
  });

  it.each([
    ['moderation', { moderationStatus: 'pending' }, 'MODERATION_REQUIRED'],
    ['payment', { paymentStatus: 'pending' }, 'PAYMENT_REQUIRED'],
  ])('blocks publication for %s and records the failed attempt', async (_label, overrides, errorMessage) => {
    const { service, getItems, notifications } = await loadService([baseItem(overrides)]);
    expect(await service.processDueScheduledItems(new Date('2026-01-01T11:00:00.000Z'))).toBe(0);
    expect(getItems()[0]).toMatchObject({ status: 'failed', attempts: 1, errorMessage });
    expect(notifications[0]).toMatchObject({ title: 'Falha no conteúdo agendado' });
  });

  it('continues when notification persistence fails', async () => {
    vi.resetModules();
    let storedItems: Array<Record<string, unknown>> = [baseItem()];
    const saveJson = vi.fn((_: string, items: Array<Record<string, unknown>>) => { storedItems = items; });
    vi.doMock('../../server/runtimeStore', () => ({ loadJson: vi.fn(() => storedItems), saveJson }));
    vi.doMock('../../server/db', () => ({ databasePool: null }));
    vi.doMock('../../server/postgresCommunicationService', () => ({ persistPostgresNotification: vi.fn(async () => { throw new Error('NOTIFICATION_DOWN'); }) }));
    const service = await import('../../server/schedulingService');
    await expect(service.processDueScheduledItems(new Date('2026-01-01T11:00:00.000Z'))).resolves.toBe(1);
    expect(storedItems[0]).toMatchObject({ status: 'published', attempts: 1 });
  });

  it('propagates scheduled-item persistence failures before publishing', async () => {
    const { service } = await loadService([baseItem()]);
    const runtimeStore = await import('../../server/runtimeStore');
    vi.mocked(runtimeStore.saveJson).mockImplementationOnce(() => { throw new Error('STORE_DOWN'); });
    await expect(service.processDueScheduledItems(new Date('2026-01-01T11:00:00.000Z'))).rejects.toThrow('STORE_DOWN');
  });
});
