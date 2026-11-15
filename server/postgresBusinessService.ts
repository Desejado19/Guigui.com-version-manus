import { databasePool } from './db';
import { listJsonBusinesses, saveJsonBusinesses } from './jsonBusinessStore';

export type BusinessRecord = {
  id: string;
  name: string;
  categoryId?: string;
  status?: string;
  ownerUserId?: string;
  createdAt?: string;
  homepageFeaturedOrder?: number | null;
  data?: Record<string, any>;
};

export class InvalidFeaturedBusinessOrderError extends Error {
  constructor(readonly code: 'INVALID_FEATURED_BUSINESS_ORDER' | 'INELIGIBLE_FEATURED_BUSINESS') {
    super(code === 'INVALID_FEATURED_BUSINESS_ORDER'
      ? 'A lista de empresas em destaque contém identificadores repetidos.'
      : 'A lista contém empresas inexistentes ou que não estão ativas.');
    this.name = 'InvalidFeaturedBusinessOrderError';
  }
}

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
  const status = companyStatus[business.status || 'active'] || 'active';
  const data = business.data || business;
  if (!databasePool) {
    const businesses = listJsonBusinesses<BusinessRecord>();
    const existingIndex = businesses.findIndex((record) => record.id === business.id);
    const existing = existingIndex >= 0 ? businesses[existingIndex] : undefined;
    const persistedBusiness: BusinessRecord = {
      ...existing,
      ...business,
      status,
      ownerUserId: business.ownerUserId || existing?.ownerUserId,
      createdAt: business.createdAt || existing?.createdAt || new Date().toISOString(),
      data: { ...(existing?.data || {}), ...data },
    };

    if (existingIndex >= 0) {
      businesses[existingIndex] = persistedBusiness;
    } else {
      businesses.push(persistedBusiness);
    }
    saveJsonBusinesses(businesses);
    return;
  }

  await databasePool.query(
    `INSERT INTO companies (id, owner_user_id, name, status, category_id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       owner_user_id = COALESCE(EXCLUDED.owner_user_id, companies.owner_user_id),
       name = EXCLUDED.name,
       status = EXCLUDED.status,
       category_id = EXCLUDED.category_id,
       data = COALESCE(companies.data, '{}'::jsonb) || EXCLUDED.data,
       updated_at = NOW()`,
    [business.id, business.ownerUserId || null, business.name, status, business.categoryId || null, JSON.stringify(data), business.createdAt || new Date().toISOString()],
  );
}

export async function updatePostgresBusinessProfile(
  businessId: string,
  profile: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (!databasePool) {
    const businesses = listJsonBusinesses<BusinessRecord>();
    const index = businesses.findIndex((business) => business.id === businessId);
    if (index === -1) return null;

    const existing = businesses[index];
    const data = { ...(existing.data || {}), ...profile };
    const updated: BusinessRecord = {
      ...existing,
      name: typeof profile.name === 'string' ? profile.name : existing.name,
      categoryId: typeof profile.categoryId === 'string' ? profile.categoryId : existing.categoryId,
      data,
    };
    businesses[index] = updated;
    saveJsonBusinesses(businesses);

    return {
      ...data,
      id: updated.id,
      ownerUserId: updated.ownerUserId,
      name: updated.name,
      status: updated.status,
      categoryId: updated.categoryId,
      createdAt: updated.createdAt,
    };
  }

  const result = await databasePool.query(
    `UPDATE companies
        SET name=COALESCE($2, name),
            category_id=COALESCE($3, category_id),
            data=COALESCE(data, '{}'::jsonb) || $4::jsonb,
            updated_at=NOW()
      WHERE id=$1
      RETURNING id, owner_user_id, name, status, category_id, created_at, data`,
    [
      businessId,
      typeof profile.name === 'string' ? profile.name : null,
      typeof profile.categoryId === 'string' ? profile.categoryId : null,
      JSON.stringify(profile),
    ],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    ...(row.data && Object.keys(row.data).length > 0 ? row.data : {}),
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    status: row.status,
    categoryId: row.category_id,
    createdAt: row.created_at,
  };
}

/** Ficha atual para o comparador de alterações (round-trip idempotente). */
export async function getPostgresBusiness(businessId: string): Promise<Record<string, unknown> | null> {
  if (!databasePool) {
    const business = listJsonBusinesses<BusinessRecord>().find((record) => record.id === businessId);
    if (!business) return null;

    return {
      ...(business.data && Object.keys(business.data).length > 0 ? business.data : {}),
      id: business.id,
      ownerUserId: business.ownerUserId,
      name: business.name,
      status: business.status,
      categoryId: business.categoryId,
      createdAt: business.createdAt,
    };
  }

  const result = await databasePool.query(
    `SELECT id, owner_user_id, name, status, category_id, created_at, data
       FROM companies
      WHERE id=$1`,
    [businessId],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    ...(row.data && Object.keys(row.data).length > 0 ? row.data : {}),
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    status: row.status,
    categoryId: row.category_id,
    createdAt: row.created_at,
  };
}

export async function setPostgresBusinessFeaturedOrder(businessIds: string[]): Promise<Record<string, unknown>[]> {
  if (new Set(businessIds).size !== businessIds.length) {
    throw new InvalidFeaturedBusinessOrderError('INVALID_FEATURED_BUSINESS_ORDER');
  }

  if (!databasePool) {
    const businesses = listJsonBusinesses<BusinessRecord>();
    const selectedBusinesses = businesses.filter((business) => businessIds.includes(business.id));
    if (selectedBusinesses.length !== businessIds.length || selectedBusinesses.some((business) => business.status !== 'active')) {
      throw new InvalidFeaturedBusinessOrderError('INELIGIBLE_FEATURED_BUSINESS');
    }

    const orderById = new Map(businessIds.map((businessId, index) => [businessId, index]));
    // Empresas suspensas mantêm a configuração de destaque guardada mas deixam
    // de ser publicadas, porque a página inicial só lista empresas ativas.
    const updatedBusinesses = businesses.map((business) => {
      // Empresas fora do destaque mantêm a posição que já tinham (se alguma),
      // mas nunca herdam a posição de outra; sem posição guardada fica `null`.
      const homepageFeaturedOrder = business.status === 'active'
        ? (orderById.get(business.id) ?? null)
        : (business.homepageFeaturedOrder ?? null);
      return {
        ...business,
        homepageFeaturedOrder,
        data: { ...(business.data || {}), homepageFeaturedOrder },
      };
    });
    saveJsonBusinesses(updatedBusinesses);

    const businessesById = new Map(updatedBusinesses.map((business) => [business.id, business]));
    return businessIds.map((businessId) => {
      const business = businessesById.get(businessId)!;
      return { ...(business.data || {}), ...business };
    });
  }

  const client = await requireDatabase().connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const selected = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM companies WHERE id = ANY($1::text[]) FOR UPDATE',
      [businessIds],
    );
    if (selected.rows.length !== businessIds.length || selected.rows.some((business) => business.status !== 'active')) {
      throw new InvalidFeaturedBusinessOrderError('INELIGIBLE_FEATURED_BUSINESS');
    }

    await client.query(
      `UPDATE companies
          SET data = COALESCE(data, '{}'::jsonb) || '{"homepageFeaturedOrder": null}'::jsonb,
              updated_at = NOW()
        WHERE status = 'active'
          AND data ? 'homepageFeaturedOrder'
          AND data->'homepageFeaturedOrder' <> 'null'::jsonb`,
    );
    await client.query(
      `UPDATE companies AS company
          SET data = COALESCE(company.data, '{}'::jsonb) ||
                jsonb_build_object('homepageFeaturedOrder', selected.position - 1),
              updated_at = NOW()
         FROM unnest($1::text[]) WITH ORDINALITY AS selected(id, position)
        WHERE company.id = selected.id`,
      [businessIds],
    );
    const ordered = await client.query<{
      id: string;
      owner_user_id: string | null;
      name: string;
      status: string;
      category_id: string | null;
      created_at: string;
      data: Record<string, unknown> | null;
    }>(
      `SELECT id, owner_user_id, name, status, category_id, created_at, data
         FROM companies
        WHERE id = ANY($1::text[])
        ORDER BY (data->>'homepageFeaturedOrder')::integer ASC`,
      [businessIds],
    );
    await client.query('COMMIT');
    transactionStarted = false;

    return ordered.rows.map((business) => ({
      ...(business.data || {}),
      id: business.id,
      ownerUserId: business.owner_user_id,
      name: business.name,
      status: business.status,
      categoryId: business.category_id,
      createdAt: business.created_at,
    }));
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[Guigui.com] featured business order rollback failed:', rollbackError);
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePostgresBusiness(businessId: string): Promise<boolean> {
  if (!databasePool) {
    const businesses = listJsonBusinesses<BusinessRecord>();
    const index = businesses.findIndex((business) => business.id === businessId);
    if (index === -1) return false;

    businesses.splice(index, 1);
    saveJsonBusinesses(businesses);
    return true;
  }

  const result = await databasePool.query('DELETE FROM companies WHERE id=$1 RETURNING id', [businessId]);
  return result.rowCount === 1;
}

export async function assignPostgresBusinessOwner(businessId: string, ownerUserId: string): Promise<boolean> {
  if (!databasePool) {
    const businesses = listJsonBusinesses<BusinessRecord>();
    const index = businesses.findIndex((business) => business.id === businessId);
    if (index === -1) return false;

    businesses[index] = { ...businesses[index], ownerUserId };
    saveJsonBusinesses(businesses);
    return true;
  }

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

/** Valor + versão da linha, para o cliente distinguir respostas antigas. */
export async function getAppStateRecord<T>(key: string): Promise<{ value: T | null; updatedAt: string | null }> {
  if (!databasePool) return { value: null, updatedAt: null };
  const result = await databasePool.query<{ value: T; updated_at: Date | string }>(
    `SELECT value, updated_at FROM app_state WHERE key = $1`,
    [key],
  );
  const row = result.rows[0];
  return {
    value: row?.value || null,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function setAppState<T>(key: string, value: T): Promise<string | null> {
  if (!databasePool) return null;
  const result = await databasePool.query<{ updated_at: Date | string }>(
    `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING updated_at`,
    [key, JSON.stringify(value)],
  );
  const updatedAt = result.rows[0]?.updated_at;
  return updatedAt ? new Date(updatedAt).toISOString() : null;
}

/**
 * Altera apenas o estado operacional da empresa (ativo/suspenso).
 * A aprovação/rejeição continua a passar pela decisão administrativa auditada.
 */
export async function updatePostgresBusinessStatus(
  businessId: string,
  status: 'active' | 'suspended',
): Promise<Record<string, unknown> | null> {
  const normalizedStatus = companyStatus[status];
  if (!normalizedStatus) throw new Error('Estado empresarial inválido.');

  if (!databasePool) {
    const businesses = listJsonBusinesses<BusinessRecord>();
    const index = businesses.findIndex((business) => business.id === businessId);
    if (index === -1) return null;
    const existing = businesses[index];
    const updated: BusinessRecord = {
      ...existing,
      status: normalizedStatus,
      data: { ...(existing.data || {}), status: normalizedStatus },
    };
    businesses[index] = updated;
    saveJsonBusinesses(businesses);
    return {
      ...(updated.data || {}),
      id: updated.id,
      ownerUserId: updated.ownerUserId,
      name: updated.name,
      status: updated.status,
      categoryId: updated.categoryId,
      createdAt: updated.createdAt,
    };
  }

  const result = await databasePool.query(
    `UPDATE companies
        SET status=$2,
            data=COALESCE(data, '{}'::jsonb) || jsonb_build_object('status', $2::text),
            updated_at=NOW()
      WHERE id=$1
      RETURNING id, owner_user_id, name, status, category_id, created_at, data`,
    [businessId, normalizedStatus],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    ...(row.data && Object.keys(row.data).length > 0 ? row.data : {}),
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    status: row.status,
    categoryId: row.category_id,
    createdAt: row.created_at,
  };
}

export async function listPostgresBusinesses(): Promise<any[]> {
  if (!databasePool) {
    return listJsonBusinesses<BusinessRecord>().map((business) => ({
      ...(business.data && Object.keys(business.data).length > 0 ? business.data : {}),
      id: business.id,
      ownerUserId: business.ownerUserId,
      name: business.name,
      status: business.status,
      categoryId: business.categoryId,
      createdAt: business.createdAt,
    }));
  }

  const result = await databasePool.query(`SELECT id, owner_user_id, name, status, category_id, created_at, data FROM companies ORDER BY created_at ASC`);
  return result.rows.map(row => ({ ...(row.data && Object.keys(row.data).length > 0 ? row.data : {}), id: row.id, ownerUserId: row.owner_user_id, name: row.name, status: row.status, categoryId: row.category_id, createdAt: row.created_at }));
}

export async function listPostgresEvents(): Promise<any[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(`SELECT id, company_id, title, status, starts_at, data FROM events ORDER BY created_at ASC`);
  return result.rows.map(row => {
    if (row.data && Object.keys(row.data).length > 0) return { ...row.data, id: row.id, businessId: row.company_id, title: row.title, status: row.status };
    return { id: row.id, businessId: row.company_id, title: row.title, status: row.status };
  });
}
