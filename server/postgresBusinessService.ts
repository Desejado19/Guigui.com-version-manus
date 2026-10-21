import { databasePool } from './db';

export type BusinessRecord = {
  id: string;
  name: string;
  categoryId?: string;
  status?: string;
  ownerUserId?: string;
  createdAt?: string;
  data?: Record<string, any>;
};

export type EventRecord = {
  id: string;
  businessId?: string;
  title: string;
  status?: string;
  date?: string;
  time?: string;
  createdAt?: string;
  ticketTypes?: Array<{
    id: string;
    name: string;
    priceXOF: number;
    availableQuantity: number;
    soldQuantity: number;
  }>;
  data?: Record<string, any>;
};

const companyStatus: Record<string, string> = { active: 'active', pending: 'pending', suspended: 'suspended', rejected: 'rejected' };
const eventStatus: Record<string, string> = { active: 'published', published: 'published', pending: 'pending', cancelled: 'cancelled', rejected: 'rejected', draft: 'draft' };

function requireDatabase() {
  if (!databasePool) throw new Error('PostgreSQL não está configurado.');
  return databasePool;
}

export async function persistPostgresBusiness(business: BusinessRecord): Promise<void> {
  if (!databasePool) return;
  const status = companyStatus[business.status || 'active'] || 'active';
  const data = business.data || business;
  await databasePool.query(
    `INSERT INTO companies (id, owner_user_id, name, status, category_id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       owner_user_id = COALESCE(EXCLUDED.owner_user_id, companies.owner_user_id),
       name = EXCLUDED.name,
       status = EXCLUDED.status,
       category_id = EXCLUDED.category_id,
       data = EXCLUDED.data,
       updated_at = NOW()`,
    [business.id, business.ownerUserId || null, business.name, status, business.categoryId || null, JSON.stringify(data), business.createdAt || new Date().toISOString()],
  );
}

export async function assignPostgresBusinessOwner(businessId: string, ownerUserId: string): Promise<boolean> {
  const pool = requireDatabase();
  const result = await pool.query('UPDATE companies SET owner_user_id=$2, updated_at=NOW() WHERE id=$1 RETURNING id', [businessId, ownerUserId]);
  return result.rowCount === 1;
}

export async function listPendingPostgresBusinesses(): Promise<any[]> {
  const pool = requireDatabase();
  const result = await pool.query(`SELECT id, owner_user_id, name, status, category_id, created_at, data FROM companies WHERE status='pending' ORDER BY created_at ASC`);
  return result.rows.map(row => ({ ...(row.data && Object.keys(row.data).length > 0 ? row.data : {}), id: row.id, ownerUserId: row.owner_user_id, name: row.name, status: row.status, categoryId: row.category_id, createdAt: row.created_at }));
}

export async function decidePostgresBusiness(businessId: string, decision: 'approve' | 'reject', reviewedBy: string, reason?: string): Promise<any | null> {
  const pool = requireDatabase();
  const nextStatus = decision === 'approve' ? 'active' : 'rejected';
  const result = await pool.query(
    `UPDATE companies
        SET status=$2,
            reviewed_by=$3,
            reviewed_at=NOW(),
            review_decision=$4,
            review_reason=COALESCE($5::text, ''),
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
              'reviewedBy', $3::text,
              'reviewedAt', NOW(),
              'reviewDecision', $4::text,
              'reviewReason', COALESCE($5::text, '')
            ),
            updated_at=NOW()
      WHERE id=$1 AND status='pending'
      RETURNING id, owner_user_id, name, status, category_id, created_at, data`,
    [businessId, nextStatus, reviewedBy, decision, reason || null],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...(row.data && Object.keys(row.data).length > 0 ? row.data : {}), id: row.id, ownerUserId: row.owner_user_id, name: row.name, status: row.status, categoryId: row.category_id, createdAt: row.created_at };
}

export async function persistPostgresEvent(event: EventRecord): Promise<void> {
  if (!databasePool) return;
  const startsAt = event.date ? `${event.date}T${(event.time || '00:00').split(' - ')[0]}:00Z` : null;
  const status = eventStatus[event.status || 'draft'] || 'draft';
  const data = event.data || event;
  const submittedTicketTypes = event.ticketTypes ?? data.ticketTypes;
  const hasTicketTypes = Array.isArray(submittedTicketTypes);
  const ticketTypes = hasTicketTypes ? submittedTicketTypes : [];
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
    `INSERT INTO events (id, company_id, title, status, starts_at, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       company_id = EXCLUDED.company_id,
       title = EXCLUDED.title,
       status = EXCLUDED.status,
       starts_at = EXCLUDED.starts_at,
       data = COALESCE(events.data, '{}'::jsonb) || EXCLUDED.data,
       updated_at = NOW()`,
    [event.id, event.businessId || null, event.title, status, startsAt, JSON.stringify(data)],
    );

    for (const ticketType of ticketTypes) {
      if (!ticketType.id || !ticketType.name || !Number.isSafeInteger(ticketType.priceXOF) || ticketType.priceXOF <= 0
        || !Number.isSafeInteger(ticketType.availableQuantity) || ticketType.availableQuantity < 0
        || !Number.isSafeInteger(ticketType.soldQuantity) || ticketType.soldQuantity < 0) {
        throw new Error(`Tipo de bilhete inválido no evento ${event.id}.`);
      }
      const existingType = await client.query<{ id: string }>(
        'SELECT id FROM ticket_types WHERE event_id=$1 AND name=$2 FOR UPDATE',
        [event.id, ticketType.name],
      );
      if (existingType.rows[0] && existingType.rows[0].id !== ticketType.id) {
        throw new Error(`O identificador do tipo de bilhete ${ticketType.name} não pode ser alterado.`);
      }
      await client.query(
        `INSERT INTO ticket_types (id, event_id, name, price_xof, quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id, name) DO UPDATE SET
           price_xof = EXCLUDED.price_xof,
           quantity = EXCLUDED.quantity`,
        [ticketType.id, event.id, ticketType.name, ticketType.priceXOF, ticketType.availableQuantity + ticketType.soldQuantity],
      );
    }

    if (hasTicketTypes) {
      const ticketTypeIds = ticketTypes.map((ticketType) => ticketType.id);
      await client.query(
        `UPDATE ticket_types tt
            SET quantity = (
              SELECT COUNT(*)::integer FROM tickets t
               WHERE t.ticket_type_id = tt.id AND t.status IN ('valid', 'used', 'pending')
            )
          WHERE tt.event_id = $1 AND NOT (tt.id = ANY($2::text[]))`,
        [event.id, ticketTypeIds],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAppState<T>(key: string): Promise<T | null> {
  if (!databasePool) return null;
  const result = await databasePool.query<{ value: T }>(`SELECT value FROM app_state WHERE key = $1`, [key]);
  return result.rows[0]?.value || null;
}

export async function setAppState<T>(key: string, value: T): Promise<void> {
  if (!databasePool) return;
  await databasePool.query(`INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [key, JSON.stringify(value)]);
}

export async function listPostgresBusinesses(): Promise<any[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(`SELECT id, owner_user_id, name, status, category_id, data FROM companies ORDER BY created_at ASC`);
  return result.rows.map(row => ({ ...(row.data && Object.keys(row.data).length > 0 ? row.data : {}), id: row.id, ownerUserId: row.owner_user_id, name: row.name, status: row.status, categoryId: row.category_id }));
}

export async function listPostgresEvents(): Promise<any[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(`SELECT id, company_id, title, status, starts_at, data FROM events ORDER BY created_at ASC`);
  return result.rows.map(row => {
    if (row.data && Object.keys(row.data).length > 0) return { ...row.data, id: row.id, businessId: row.company_id, title: row.title, status: row.status };
    return { id: row.id, businessId: row.company_id, title: row.title, status: row.status };
  });
}
