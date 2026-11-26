import { randomBytes, scryptSync } from 'node:crypto';
import { readSnapshot, runImport, type ImportPool } from './importRunner';

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

async function importTicket(ticket: Ticket, pool: ImportPool): Promise<void> {
  const eventId = ticket.eventId || `event-${ticket.id}`;
  const businessId = ticket.businessId || 'biz-migrated';
  const orderId = `order-${ticket.id}`;
  const ticketTypeId = `ticket-type-${ticket.id}`;
  await pool.query(`INSERT INTO companies (id,name,status) VALUES ($1,$2,'active') ON CONFLICT (id) DO NOTHING`, [businessId, `Empresa migrada ${businessId}`]);
  await pool.query(`INSERT INTO events (id,company_id,title,status) VALUES ($1,$2,$3,'published') ON CONFLICT (id) DO NOTHING`, [eventId, businessId, ticket.eventTitle || 'Evento migrado']);
  await pool.query(`INSERT INTO orders (id,event_id,status,gross_amount_xof,net_amount_xof,created_at,updated_at) VALUES ($1,$2,'paid',$3,$3,$4,$4) ON CONFLICT (id) DO NOTHING`, [orderId, eventId, ticket.priceXOF, ticket.purchasedAt || new Date().toISOString()]);
  const ticketTypeResult = await pool.query(
    `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity) VALUES ($1,$2,$3,$4,1)
     ON CONFLICT (event_id,name) DO UPDATE SET price_xof=EXCLUDED.price_xof
     RETURNING id`,
    [ticketTypeId, eventId, ticket.ticketTypeName || 'Entrada Geral', ticket.priceXOF],
  );
  const resolvedTicketTypeId = ticketTypeResult.rows[0]?.id;
  if (!resolvedTicketTypeId) throw new Error(`Não foi possível resolver o tipo de bilhete ${ticketTypeId}.`);
  await pool.query(
    `INSERT INTO tickets (id,order_id,event_id,ticket_type_id,qr_token,ticket_code,pin_hash,signature,status,expires_at,created_at,buyer_name,buyer_phone,holder_name,holder_phone,payment_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, signature=EXCLUDED.signature, expires_at=EXCLUDED.expires_at,
     buyer_name=EXCLUDED.buyer_name, buyer_phone=EXCLUDED.buyer_phone, holder_name=EXCLUDED.holder_name, holder_phone=EXCLUDED.holder_phone`,
    [ticket.id, orderId, eventId, resolvedTicketTypeId, ticket.qrToken, ticket.ticketCode, ticket.pinCode ? pinHash(ticket.pinCode) : null, ticket.signature || 'migrated-ticket-signature', ticket.status, ticket.expiresAt || null, ticket.purchasedAt || new Date().toISOString(), ticket.buyerName, ticket.buyerPhone, ticket.holderName || null, ticket.holderPhone || null, ticket.paymentMethod || null],
  );
}

await runImport({
  label: 'bilhetes',
  records: tickets,
  importRecord: (ticket, pool) => importTicket(ticket, pool),
  summary: (_pool, records) => `postgres-tickets-import: ${records.length} bilhete(s) importado(s)`,
});
