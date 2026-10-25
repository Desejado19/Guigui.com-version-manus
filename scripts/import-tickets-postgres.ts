import { randomBytes, scryptSync } from 'node:crypto';
import { readSnapshot, runImportFromCli, type ImportPool } from './importRunner';

interface Ticket {
  id: string;
  businessId?: string;
  ticketCode: string;
  qrToken: string;
  pinCode?: string;
  eventId?: string;
  eventTitle?: string;
  ticketTypeName?: string;
  priceXOF: number;
  buyerName: string;
  buyerPhone: string;
  holderName?: string;
  holderPhone?: string;
  paymentMethod?: string;
  status: 'valid' | 'used' | 'cancelled' | 'expired';
  purchasedAt?: string;
  expiresAt?: string;
  signature?: string;
}

const raw = readSnapshot<Array<[string, Ticket]>>('tickets.json');
const tickets = Array.from(new Map(raw.filter((entry) => entry[1]?.id).map((entry) => [entry[1].id, entry[1]])).values());

const pinHash = (pin: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
};

async function importTicket(ticket: Ticket, pool: ImportPool): Promise<boolean> {
  const eventId = ticket.eventId || `event-${ticket.id}`;
  const businessId = ticket.businessId || 'biz-migrated';
  const orderId = `order-${ticket.id}`;
  const ticketTypeId = `ticket-type-${ticket.id}`;
  await pool.query(`INSERT INTO companies (id,name,status) VALUES ($1,$2,'active') ON CONFLICT (id) DO NOTHING`, [businessId, `Empresa migrada ${businessId}`]);
  await pool.query(`INSERT INTO events (id,company_id,title,status) VALUES ($1,$2,$3,'published') ON CONFLICT (id) DO NOTHING`, [eventId, businessId, ticket.eventTitle || 'Evento migrado']);
  await pool.query(`INSERT INTO orders (id,event_id,status,gross_amount_xof,net_amount_xof,created_at,updated_at) VALUES ($1,$2,'paid',$3,$3,$4,$4) ON CONFLICT (id) DO NOTHING`, [orderId, eventId, ticket.priceXOF, ticket.purchasedAt || new Date().toISOString()]);
  const ticketTypeResult = await pool.query<{ id: string }>(
    `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity) VALUES ($1,$2,$3,$4,1)
     ON CONFLICT (event_id,name) DO NOTHING
     RETURNING id`,
    [ticketTypeId, eventId, ticket.ticketTypeName || 'Entrada Geral', ticket.priceXOF],
  );
  const resolvedTicketTypeId = ticketTypeResult.rows[0]?.id
    ?? (await pool.query<{ id: string }>(
      'SELECT id FROM ticket_types WHERE event_id = $1 AND name = $2 LIMIT 1',
      [eventId, ticket.ticketTypeName || 'Entrada Geral'],
    )).rows[0]?.id;
  if (!resolvedTicketTypeId) throw new Error(`Não foi possível resolver o tipo de bilhete ${ticketTypeId}.`);
  const ticketResult = await pool.query<{ id: string }>(
    `INSERT INTO tickets (id,order_id,event_id,ticket_type_id,qr_token,ticket_code,pin_hash,signature,status,expires_at,created_at,buyer_name,buyer_phone,holder_name,holder_phone,payment_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [ticket.id, orderId, eventId, resolvedTicketTypeId, ticket.qrToken, ticket.ticketCode, ticket.pinCode ? pinHash(ticket.pinCode) : null, ticket.signature || 'migrated-ticket-signature', ticket.status, ticket.expiresAt || null, ticket.purchasedAt || new Date().toISOString(), ticket.buyerName, ticket.buyerPhone, ticket.holderName || null, ticket.holderPhone || null, ticket.paymentMethod || null],
  );
  return ticketResult.rows.length === 1;
}

await runImportFromCli({
  label: 'bilhetes',
  records: tickets,
  recordKey: (ticket) => ticket.id,
  validateRecord: (ticket) => Boolean(
    ticket
    && typeof ticket.id === 'string'
    && ticket.id.trim()
    && typeof ticket.ticketCode === 'string'
    && typeof ticket.qrToken === 'string'
    && typeof ticket.buyerName === 'string'
    && typeof ticket.buyerPhone === 'string'
    && Number.isInteger(ticket.priceXOF)
    && ticket.priceXOF > 0
    && ['valid', 'used', 'cancelled', 'expired'].includes(ticket.status),
  ),
  hasConflict: async (ticket, pool) => {
    const eventId = ticket.eventId || `event-${ticket.id}`;
    return (await pool.query(
      `SELECT 1 FROM tickets
       WHERE id = $1 OR qr_token = $2 OR ticket_code = $3
       UNION ALL
       SELECT 1 FROM orders WHERE id = $4
       UNION ALL
       SELECT 1 FROM events
       WHERE id = $5
         AND (
           company_id IS DISTINCT FROM $6
           OR title IS DISTINCT FROM $7
           OR status IS DISTINCT FROM 'published'
         )
       UNION ALL
       SELECT 1 FROM ticket_types WHERE id = $8
       UNION ALL
       SELECT 1 FROM ticket_types
       WHERE event_id = $5 AND name = $9 AND price_xof <> $10
       LIMIT 1`,
      [
        ticket.id,
        ticket.qrToken,
        ticket.ticketCode,
        `order-${ticket.id}`,
        eventId,
        ticket.businessId || 'biz-migrated',
        ticket.eventTitle || 'Evento migrado',
        `ticket-type-${ticket.id}`,
        ticket.ticketTypeName || 'Entrada Geral',
        ticket.priceXOF,
      ],
    )).rows.length > 0;
  },
  importRecord: (ticket, pool) => importTicket(ticket, pool),
});
