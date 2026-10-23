import { randomBytes } from 'node:crypto';
import { databasePool } from './db';

export type TicketLifecycleRow = {
  id: string;
  orderId: string;
  eventId: string;
  companyId: string;
  status: string;
  priceXOF: number;
  buyerUserId?: string;
  buyerPhone?: string;
  holderPhone?: string;
};

const ticketId = (prefix: string) => `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`;

/** Carrega o bilhete com a empresa organizadora, o pedido e o valor pago. */
export async function findPostgresTicketForLifecycle(idOrToken: string): Promise<TicketLifecycleRow | null> {
  if (!databasePool) return null;
  const result = await databasePool.query(
    `SELECT t.id, t.order_id, t.event_id, t.status, COALESCE(tt.price_xof,0) AS price_xof,
            o.buyer_user_id, t.buyer_phone, t.holder_phone,
            COALESCE(e.company_id, o.id) AS company_id
     FROM tickets t
     JOIN orders o ON o.id = t.order_id
     LEFT JOIN events e ON e.id = t.event_id
     LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
     WHERE t.id=$1 OR t.qr_token=$1 OR t.ticket_code=$1
     LIMIT 1`,
    [idOrToken],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    eventId: row.event_id,
    // A empresa organizadora é a dona do evento, não a empresa do pedido.
    companyId: (await findEventCompany(row.event_id)) || row.company_id,
    status: row.status,
    priceXOF: Number(row.price_xof || 0),
    buyerUserId: row.buyer_user_id || undefined,
    buyerPhone: row.buyer_phone || undefined,
    holderPhone: row.holder_phone || undefined,
  };
}

async function findEventCompany(eventId: string): Promise<string | null> {
  if (!databasePool) return null;
  const result = await databasePool.query<{ company_id: string | null }>('SELECT company_id FROM events WHERE id=$1', [eventId]);
  return result.rows[0]?.company_id || null;
}

/**
 * Cancela um bilhete. Só avança a partir de `valid`, de modo que um bilhete já
 * usado ou já cancelado nunca muda de estado em silêncio.
 */
export async function cancelPostgresTicket(id: string, reason: string): Promise<boolean> {
  if (!databasePool) return false;
  const result = await databasePool.query(
    `UPDATE tickets SET status='cancelled', cancelled_at=NOW(), cancel_reason=$2
     WHERE id=$1 AND status='valid' RETURNING id`,
    [id, reason],
  );
  if (result.rowCount !== 1) return false;
  // O pedido passa a cancelado quando já não resta nenhum bilhete utilizável.
  await databasePool.query(
    `UPDATE orders SET status='cancelled', updated_at=NOW()
     WHERE id=(SELECT order_id FROM tickets WHERE id=$1)
       AND NOT EXISTS (SELECT 1 FROM tickets WHERE order_id=orders.id AND status='valid')`,
    [id],
  );
  return true;
}

/**
 * Regista o pedido de reembolso. `requested` significa que o pedido ficou
 * registado: a devolução efectiva depende do gateway comercial do operador.
 */
export async function requestPostgresTicketRefund(
  ticket: TicketLifecycleRow,
  reason: string,
  requestedBy: string | undefined,
): Promise<{ id: string; status: 'requested' }> {
  if (!databasePool) throw new Error('Reembolso exige base de dados configurada.');
  const id = ticketId('RFD');
  await databasePool.query(
    `INSERT INTO ticket_refunds (id, ticket_id, order_id, company_id, amount_xof, reason, status, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,'requested',$7)`,
    [id, ticket.id, ticket.orderId, ticket.companyId, ticket.priceXOF, reason, requestedBy || null],
  );
  await databasePool.query(`UPDATE orders SET status='refunded', updated_at=NOW() WHERE id=$1`, [ticket.orderId]);
  return { id, status: 'requested' };
}

/**
 * Marca um pedido de reembolso como processado, depois de a devolução ter sido
 * confirmada pelo operador. É este passo que fecha o GUI-3.4.11: sem ele o
 * pedido ficaria eternamente em `requested`.
 */
export async function markPostgresTicketRefundProcessed(refundId: string): Promise<boolean> {
  if (!databasePool) return false;
  const result = await databasePool.query(
    `UPDATE ticket_refunds SET status='processed', processed_at=NOW() WHERE id=$1 AND status='requested' RETURNING id`,
    [refundId],
  );
  return result.rowCount === 1;
}

export async function listPostgresTicketRefunds(companyId: string, limit = 100) {
  if (!databasePool) return [];
  const result = await databasePool.query(
    `SELECT r.*, t.ticket_code, e.title AS event_title
     FROM ticket_refunds r
     LEFT JOIN tickets t ON t.id = r.ticket_id
     LEFT JOIN events e ON e.id = t.event_id
     WHERE r.company_id=$1 ORDER BY r.created_at DESC LIMIT $2`,
    [companyId, limit],
  );
  return result.rows;
}

export type SoldTicketRow = {
  id: string;
  ticketCode: string;
  status: string;
  priceXOF: number;
  buyerName: string | null;
  holderName: string | null;
  holderPhone: string | null;
  purchasedAt: string | null;
  eventId: string;
  eventTitle: string | null;
  refundStatus: string | null;
};

/**
 * Bilhetes vendidos pela empresa, para a vista de participantes e reembolsos.
 * O âmbito vem sempre da sessão: o `eventId` do pedido é apenas um filtro dentro
 * dos eventos da própria empresa, nunca uma forma de chegar a outras.
 */
export async function listPostgresTicketsForCompany(companyId: string, eventId?: string, limit = 500): Promise<SoldTicketRow[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(
    `SELECT t.id, t.ticket_code, t.status, t.buyer_name, t.holder_name, t.holder_phone,
            t.created_at, t.event_id, e.title AS event_title,
            COALESCE(tt.price_xof, 0) AS price_xof,
            (SELECT r.status FROM ticket_refunds r WHERE r.ticket_id = t.id ORDER BY r.created_at DESC LIMIT 1) AS refund_status
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
     WHERE e.company_id = $1 AND ($2::text IS NULL OR t.event_id = $2)
     ORDER BY t.created_at DESC
     LIMIT $3`,
    [companyId, eventId || null, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    ticketCode: row.ticket_code,
    status: row.status,
    priceXOF: Number(row.price_xof || 0),
    buyerName: row.buyer_name || null,
    holderName: row.holder_name || null,
    holderPhone: row.holder_phone || null,
    purchasedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    eventId: row.event_id,
    eventTitle: row.event_title || null,
    refundStatus: row.refund_status || null,
  }));
}

