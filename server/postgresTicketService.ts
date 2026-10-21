import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { databasePool } from './db';
import type { TicketForValidation } from './validationService';
import type { TicketOffer } from './ticketPurchaseDomain';

export async function reservePostgresTicketInventory(input: {
  offer: TicketOffer;
  quantity: number;
  reservationId: string;
  expiresAt: string;
}): Promise<'reserved' | 'unavailable'> {
  if (!databasePool) throw new Error('PostgreSQL não está configurado para reservar bilhetes.');
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const inventory = await client.query<{ quantity: number; event_status: string }>(
      `SELECT tt.quantity, e.status AS event_status
         FROM ticket_types tt
         JOIN events e ON e.id = tt.event_id
        WHERE tt.id = $1 AND tt.event_id = $2
        FOR UPDATE OF tt`,
      [input.offer.ticketTypeId, input.offer.eventId],
    );
    const row = inventory.rows[0];
    if (!row || row.event_status !== 'published') {
      await client.query('ROLLBACK');
      return 'unavailable';
    }

    const existing = await client.query<{ event_id: string; ticket_type_id: string; quantity: number; status: string }>(
      'SELECT event_id, ticket_type_id, quantity, status FROM ticket_reservations WHERE id=$1',
      [input.reservationId],
    );
    const existingReservation = existing.rows[0];
    if (existingReservation) {
      await client.query('COMMIT');
      return existingReservation.event_id === input.offer.eventId
        && existingReservation.ticket_type_id === input.offer.ticketTypeId
        && Number(existingReservation.quantity) === input.quantity
        && existingReservation.status === 'pending'
        ? 'reserved'
        : 'unavailable';
    }

    const sold = await client.query<{ quantity: number }>(
      `SELECT COUNT(*)::integer AS quantity
         FROM tickets
        WHERE ticket_type_id = $1
          AND (
            status IN ('valid', 'used')
            OR (status = 'pending' AND created_at > NOW() - INTERVAL '15 minutes')
          )`,
      [input.offer.ticketTypeId],
    );
    const reserved = await client.query<{ quantity: number }>(
      `SELECT COALESCE(SUM(quantity), 0)::integer AS quantity
         FROM ticket_reservations
        WHERE ticket_type_id = $1 AND status = 'pending' AND expires_at > NOW()`,
      [input.offer.ticketTypeId],
    );
    const available = Number(row.quantity) - Number(sold.rows[0]?.quantity || 0) - Number(reserved.rows[0]?.quantity || 0);
    if (available < input.quantity) {
      await client.query('ROLLBACK');
      return 'unavailable';
    }

    await client.query(
      `INSERT INTO ticket_reservations (id, event_id, ticket_type_id, quantity, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.reservationId, input.offer.eventId, input.offer.ticketTypeId, input.quantity, input.expiresAt],
    );
    await client.query('COMMIT');
    return 'reserved';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmPostgresTicketReservation(reservationId: string): Promise<void> {
  if (!databasePool) throw new Error('PostgreSQL não está configurado para confirmar a reserva de bilhetes.');
  const result = await databasePool.query(
    `UPDATE ticket_reservations SET status='confirmed', updated_at=NOW()
      WHERE id=$1 AND status='pending' RETURNING id`,
    [reservationId],
  );
  if (result.rowCount !== 1) {
    const existing = await databasePool.query('SELECT id FROM ticket_reservations WHERE id=$1 AND status=\'confirmed\'', [reservationId]);
    if (existing.rowCount !== 1) throw new Error('A reserva de bilhetes não pôde ser confirmada.');
  }
}

export async function releasePostgresTicketReservation(reservationId: string): Promise<void> {
  if (!databasePool) throw new Error('PostgreSQL não está configurado para libertar a reserva de bilhetes.');
  await databasePool.query(
    `UPDATE ticket_reservations SET status='released', updated_at=NOW()
      WHERE id=$1 AND status='pending'`,
    [reservationId],
  );
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

export async function persistPostgresTickets(tickets: TicketForValidation[], buyerUserId?: string): Promise<void> {
  if (!databasePool || tickets.length === 0) return;
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    for (const ticket of tickets) {
      const businessId = ticket.businessId || 'biz-migrated';
      const eventId = ticket.eventId || `event-${ticket.id}`;
      const orderId = `order-${ticket.id}`;
      const typeName = ticket.ticketTypeName || 'Entrada Geral';
      await client.query(`INSERT INTO companies (id,name,status) VALUES ($1,$2,'active') ON CONFLICT (id) DO NOTHING`, [businessId, `Empresa ${businessId}`]);
      await client.query(`INSERT INTO events (id,company_id,title,status) VALUES ($1,$2,$3,'published') ON CONFLICT (id) DO NOTHING`, [eventId, businessId, ticket.eventTitle || 'Evento Guigui']);
      await client.query(`INSERT INTO orders (id,buyer_user_id,event_id,status,gross_amount_xof,net_amount_xof,created_at,updated_at) VALUES ($1,$2,$3,'paid',$4,$4,$5,$5) ON CONFLICT (id) DO UPDATE SET buyer_user_id=COALESCE(EXCLUDED.buyer_user_id,orders.buyer_user_id)`, [orderId, buyerUserId || null, eventId, ticket.priceXOF, ticket.purchasedAt || new Date().toISOString()]);
      const typeResult = ticket.ticketTypeId
        ? await client.query(`SELECT id FROM ticket_types WHERE id=$1 AND event_id=$2`, [ticket.ticketTypeId, eventId])
        : await client.query(
            `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity)
             VALUES ($1,$2,$3,$4,1)
             ON CONFLICT (event_id,name) DO UPDATE SET price_xof=EXCLUDED.price_xof RETURNING id`,
            [`type-${eventId}-${typeName}`.slice(0, 255), eventId, typeName, ticket.priceXOF],
          );
      if (!typeResult.rows[0]?.id) throw new Error(`Tipo de bilhete inexistente para persistir o bilhete ${ticket.id}.`);
      await client.query(
        `INSERT INTO tickets (id,order_id,event_id,ticket_type_id,qr_token,ticket_code,pin_hash,signature,status,expires_at,created_at,buyer_name,buyer_phone,holder_name,holder_phone,payment_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, signature=EXCLUDED.signature, expires_at=EXCLUDED.expires_at,
         buyer_name=EXCLUDED.buyer_name, buyer_phone=EXCLUDED.buyer_phone, holder_name=EXCLUDED.holder_name, holder_phone=EXCLUDED.holder_phone`,
        [ticket.id, orderId, eventId, typeResult.rows[0].id, ticket.qrToken, ticket.ticketCode, ticket.pinCode ? hashPin(ticket.pinCode) : null, ticket.signature || 'runtime-ticket-signature', ticket.status, ticket.expiresAt || null, ticket.purchasedAt || new Date().toISOString(), ticket.buyerName, ticket.buyerPhone, ticket.holderName || null, ticket.holderPhone || null, ticket.paymentMethod || null],
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

export async function listPostgresTicketsForUser(userId: string): Promise<TicketForValidation[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(
    `SELECT t.*, e.title AS event_title, tt.name AS ticket_type_name, tt.price_xof
     FROM tickets t
     JOIN orders o ON o.id=t.order_id
     LEFT JOIN events e ON e.id=t.event_id
     LEFT JOIN ticket_types tt ON tt.id=t.ticket_type_id
     WHERE o.buyer_user_id=$1
     ORDER BY t.created_at DESC
     LIMIT 500`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id, ticketCode: row.ticket_code, qrToken: row.qr_token, eventId: row.event_id,
    eventTitle: row.event_title, ticketTypeName: row.ticket_type_name, priceXOF: row.price_xof || 0,
    buyerName: row.buyer_name || '', buyerPhone: row.buyer_phone || '', holderName: row.holder_name || undefined,
    holderPhone: row.holder_phone || undefined, status: row.status, purchasedAt: row.created_at?.toISOString?.() || row.created_at,
    expiresAt: row.expires_at?.toISOString?.() || row.expires_at, signature: row.signature, paymentMethod: row.payment_method,
  }));
}

export async function findPostgresTicket(value: string, phone?: string): Promise<TicketForValidation | null> {
  if (!databasePool) return null;
  const result = await databasePool.query(
    `SELECT t.*, e.title AS event_title, tt.name AS ticket_type_name, tt.price_xof
     FROM tickets t LEFT JOIN events e ON e.id=t.event_id LEFT JOIN ticket_types tt ON tt.id=t.ticket_type_id
     WHERE t.qr_token=$1 OR t.ticket_code=$1 OR t.pin_hash IS NOT NULL`,
    [value],
  );
  for (const row of result.rows) {
    if (phone) {
      const normalize = (candidate: unknown) => String(candidate || '').replace(/\D/g, '').slice(-9);
      if (normalize(row.buyer_phone) !== phone && normalize(row.holder_phone) !== phone) continue;
    }
    if (row.qr_token !== value && row.ticket_code !== value) {
      const [salt, expectedHex] = String(row.pin_hash).split(':');
      const expected = Buffer.from(expectedHex || '', 'hex');
      const actual = salt ? scryptSync(value, salt, 32) : Buffer.alloc(0);
      if (!expected.length || expected.length !== actual.length || !timingSafeEqual(actual, expected)) continue;
    }
    return {
      id: row.id, ticketCode: row.ticket_code, qrToken: row.qr_token, eventId: row.event_id,
      eventTitle: row.event_title, ticketTypeName: row.ticket_type_name, priceXOF: row.price_xof || 0,
      buyerName: row.buyer_name || '', buyerPhone: row.buyer_phone || '', holderName: row.holder_name || undefined,
      holderPhone: row.holder_phone || undefined, status: row.status, purchasedAt: row.created_at?.toISOString?.() || row.created_at,
      expiresAt: row.expires_at?.toISOString?.() || row.expires_at, signature: row.signature, paymentMethod: row.payment_method,
    };
  }
  return null;
}

/**
 * Regra 10.7: validação atómica — o UPDATE condicionado a `status='valid'`
 * garante que duas leituras simultâneas nunca autorizam a mesma entrada.
 */
export async function markPostgresTicketUsed(id: string): Promise<boolean> {
  if (!databasePool) return false;
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(`UPDATE tickets SET status='used' WHERE id=$1 AND status='valid' AND (expires_at IS NULL OR expires_at > NOW()) RETURNING id`, [id]);
    if (updated.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(`INSERT INTO ticket_validations (id,ticket_id,result,created_at) VALUES ($1,$2,'accepted',NOW())`, [`validation-${randomBytes(12).toString('hex')}`, id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Regra 4.3: activa as reservas confirmadas por pagamento (pending → valid).
 * Operação atómica: só altera bilhetes ainda no estado 'pending', pelo que
 * uma confirmação duplicada não tem efeito adicional (Regra 4.6).
 */
export async function activatePostgresTicketReservations(ticketIds: string[]): Promise<string[]> {
  if (!databasePool || ticketIds.length === 0) return [];
  const result = await databasePool.query(
    `UPDATE tickets SET status='valid' WHERE id = ANY($1) AND status='pending' RETURNING id`,
    [ticketIds],
  );
  return result.rows.map((row: { id: string }) => row.id);
}

/**
 * Regra 4.7: liberta as reservas pendentes cujo prazo expirou sem pagamento
 * confirmado, removendo os registos e devolvendo a quantidade ao inventário.
 */
export async function releaseExpiredPostgresTicketReservations(ttlMinutes: number): Promise<number> {
  if (!databasePool) return 0;
  const [tickets, reservations] = await Promise.all([
    databasePool.query(
    `DELETE FROM tickets WHERE status='pending' AND created_at < NOW() - ($1 * INTERVAL '1 minute')`,
    [ttlMinutes],
    ),
    databasePool.query(
      `UPDATE ticket_reservations SET status='expired', updated_at=NOW()
        WHERE status='pending' AND expires_at <= NOW()`,
    ),
  ]);
  return (tickets.rowCount ?? 0) + (reservations.rowCount ?? 0);
}
