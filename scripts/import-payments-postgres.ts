import { readSnapshot, runImport, type ImportPool } from './importRunner';

type LegacyPayment = {
  id: string;
  provider: string;
  providerRef?: string;
  amountXOF: number;
  status: string;
  payerName?: string;
  payerPhone?: string;
  useCase?: string;
  useCaseLabel?: string;
  providerMode?: string;
  createdAt?: string;
  confirmedAt?: string;
  businessId?: string;
  businessName?: string;
  ticketDraft?: {
    eventId?: string;
    eventTitle?: string;
    ticketTypeId?: string;
    ticketTypeName?: string;
    unitPriceXOF?: number;
    buyerUserId?: string;
    eventDate?: string;
    eventTime?: string;
    quantity?: number;
  };
};

const statusMap: Record<string, string> = {
  confirmed_api: 'paid',
  confirmed_manual: 'authorized',
  pending_provider: 'pending',
  pending_manual_confirmation: 'pending',
  reconciled: 'paid',
  refunded: 'refunded',
};

function asTimestamp(value?: string): string {
  if (!value) return new Date().toISOString();
  return value.includes('T') ? value : value.replace(' ', 'T');
}

async function ensureCompany(pool: ImportPool, businessId?: string, businessName?: string): Promise<void> {
  if (!businessId) return;
  await pool.query(
    `INSERT INTO companies (id,name,status,created_at,updated_at)
     VALUES ($1,$2,'active',NOW(),NOW())
     ON CONFLICT (id) DO NOTHING`,
    [businessId, businessName || `Empresa migrada ${businessId}`],
  );
}

async function importPayment(payment: LegacyPayment, pool: ImportPool): Promise<void> {
  const mappedStatus = statusMap[payment.status] || 'pending';
  const createdAt = asTimestamp(payment.createdAt);
  const confirmedAt = payment.confirmedAt ? asTimestamp(payment.confirmedAt) : null;
  const businessId = payment.businessId || null;

  await ensureCompany(pool, businessId || undefined, payment.businessName);

  let orderId: string | null = null;
  let eventId: string | null = null;

  if (payment.useCase === 'event_tickets') {
    const draft = payment.ticketDraft;
    if (draft?.eventId) {
      eventId = draft.eventId;
      const eventTitle = draft.eventTitle || payment.useCaseLabel || 'Evento migrado';
      const startsAt = draft.eventDate
        ? `${draft.eventDate}T${(draft.eventTime || '00:00').split(' - ')[0]}:00Z`
        : null;
      await pool.query(
        `INSERT INTO events (id,company_id,title,status,starts_at,created_at,updated_at)
         VALUES ($1,$2,$3,'published',$4,$5,$5)
         ON CONFLICT (id) DO UPDATE SET company_id=EXCLUDED.company_id,title=EXCLUDED.title,status=EXCLUDED.status,starts_at=COALESCE(EXCLUDED.starts_at,events.starts_at),updated_at=NOW()`,
        [eventId, businessId, eventTitle, startsAt, createdAt],
      );

      const ticketTypeId = draft.ticketTypeId || `tt-${payment.id}`;
      const ticketTypeName = draft.ticketTypeName || 'Entrada Geral';
      const unitPrice = draft.unitPriceXOF || payment.amountXOF;
      const quantity = draft.quantity || 1;
      const ticketTypeResult = await pool.query(
        `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (event_id,name) DO UPDATE SET price_xof=EXCLUDED.price_xof,quantity=EXCLUDED.quantity
         RETURNING id`,
        [ticketTypeId, eventId, ticketTypeName, unitPrice, quantity],
      );
      const resolvedTicketTypeId = ticketTypeResult.rows[0]?.id;
      if (!resolvedTicketTypeId) {
        throw new Error(`Não foi possível resolver o tipo de bilhete para ${payment.id}.`);
      }
    } else {
      eventId = `event-${payment.id}`;
      await pool.query(
        `INSERT INTO events (id,company_id,title,status,starts_at,created_at,updated_at)
         VALUES ($1,$2,$3,'published',$4,$5,$5)
         ON CONFLICT (id) DO NOTHING`,
        [eventId, businessId, payment.useCaseLabel || 'Evento migrado', createdAt, createdAt],
      );
      const ticketTypeId = `tt-${payment.id}`;
      await pool.query(
        `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity)
         VALUES ($1,$2,$3,$4,1)
         ON CONFLICT (event_id,name) DO UPDATE SET price_xof=EXCLUDED.price_xof`,
        [ticketTypeId, eventId, 'Entrada Geral', payment.amountXOF],
      );
    }

    orderId = `order-${payment.id}`;
    const buyerUserId = payment.ticketDraft?.buyerUserId || null;
    const orderStatus = ['paid', 'authorized'].includes(mappedStatus) ? 'paid' : 'created';
    await pool.query(
      `INSERT INTO orders (id,buyer_user_id,event_id,status,gross_amount_xof,net_amount_xof,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$6)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,event_id=EXCLUDED.event_id,buyer_user_id=COALESCE(EXCLUDED.buyer_user_id,orders.buyer_user_id),updated_at=NOW()`,
      [orderId, buyerUserId, eventId, orderStatus, payment.amountXOF, createdAt],
    );
  }

  await pool.query(
    `INSERT INTO payment_transactions
     (id,order_id,event_id,company_id,provider,provider_reference,status,gross_amount_xof,net_amount_xof,payer_name,payer_phone,use_case,provider_mode,confirmed_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$14)
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,provider_reference=EXCLUDED.provider_reference,
     payer_name=EXCLUDED.payer_name,payer_phone=EXCLUDED.payer_phone,use_case=EXCLUDED.use_case,
     provider_mode=EXCLUDED.provider_mode,confirmed_at=EXCLUDED.confirmed_at,updated_at=NOW(),
     order_id=COALESCE(EXCLUDED.order_id,payment_transactions.order_id),
     event_id=COALESCE(EXCLUDED.event_id,payment_transactions.event_id),
     company_id=COALESCE(EXCLUDED.company_id,payment_transactions.company_id)`,
    [
      payment.id,
      orderId,
      eventId,
      businessId,
      payment.provider,
      payment.providerRef || null,
      mappedStatus,
      payment.amountXOF,
      payment.payerName || null,
      payment.payerPhone || null,
      payment.useCase || null,
      payment.providerMode || null,
      confirmedAt,
      createdAt,
    ],
  );
}

const payments = readSnapshot<LegacyPayment[]>('payments.json');

await runImport({
  label: 'pagamentos',
  records: payments,
  importRecord: (payment, pool) => importPayment(payment, pool),
  summary: (_pool, records) => `postgres-payments-import: ${records.length} pagamento(s) importado(s)`,
});