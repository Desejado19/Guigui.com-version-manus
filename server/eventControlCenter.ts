import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import writeXlsxFile from 'write-excel-file/node';

/**
 * Centro de controlo individual de eventos.
 *
 * Reaproveita as tabelas operacionais já existentes (`events`, `ticket_types`,
 * `orders`, `tickets`, `ticket_validations`, `ticket_refunds`,
 * `payment_transactions`, `audit_logs`). Não há cálculo financeiro paralelo:
 * a receita bruta, a comissão e o valor da empresa vêm directamente dos
 * pedidos pagos, e os bilhetes usados/válidos das próprias linhas de bilhete.
 */

export interface EventViewer {
  role: 'business' | 'admin';
  userId: string;
  companyId: string | null;
}

type DbRow = Record<string, unknown>;

interface Queryable {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: DbRow[] }>;
}

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const iso = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export interface EventTicketRow {
  id: string;
  ticketCode: string;
  status: string;
  buyerName: string;
  buyerPhone: string;
  holderName: string;
  holderPhone: string;
  ticketTypeName: string;
  priceXOF: number;
  orderId: string;
  orderStatus: string;
  purchasedAt: string | null;
  validatedAt: string | null;
  refundStatus: string | null;
}

export interface EventBuyerRow {
  orderId: string;
  name: string;
  phone: string;
  quantity: number;
  ticketTypes: string;
  totalXOF: number;
  orderStatus: string;
  ticketStatus: string;
  validatedCount: number;
  purchasedAt: string | null;
}

export interface EventControlCenter {
  event: {
    id: string;
    title: string;
    status: string;
    companyId: string | null;
    companyName: string | null;
    startsAt: string | null;
    endsAt: string | null;
    date: string;
    time: string;
    location: string;
    neighborhood: string;
    category: string;
    description: string;
    organizerName: string;
    scannerDoorCode: string;
    createdAt: string | null;
    updatedAt: string | null;
  };
  ticketTypes: Array<{ id: string; name: string; priceXOF: number; quantity: number; sold: number; available: number }>;
  tickets: EventTicketRow[];
  buyers: EventBuyerRow[];
  validations: Array<{ id: string; result: string; reason: string; ticketCode: string; operator: string; createdAt: string | null }>;
  refunds: Array<{ id: string; ticketCode: string; amountXOF: number; status: string; reason: string; createdAt: string | null; processedAt: string | null }>;
  history: Array<{ action: string; result: string; resourceId: string; reason: string; actor: string; createdAt: string | null }>;
  finance: {
    grossXOF: number;
    commissionXOF: number;
    commissionRate: number;
    companyShareXOF: number;
    pendingXOF: number;
    refundedXOF: number;
    paidOrders: number;
    pendingOrders: number;
    refundedOrders: number;
    confirmedPayments: number;
    refundsRequestedXOF: number;
    state: 'no_sales' | 'pending_only' | 'confirmed' | 'partially_refunded';
  };
  indicators: {
    capacity: number;
    sold: number;
    available: number;
    used: number;
    unused: number;
    cancelled: number;
    revenueXOF: number;
    checkInsRate: number;
  };
  salesByDay: Array<{ day: string; tickets: number; revenueXOF: number }>;
  salesByType: Array<{ name: string; tickets: number; revenueXOF: number }>;
  recentPurchases: Array<{ ticketCode: string; buyer: string; type: string; priceXOF: number; purchasedAt: string | null }>;
  recentValidations: Array<{ ticketCode: string; createdAt: string | null }>;
  truncated: boolean;
  generatedAt: string;
}

const TICKET_LIMIT = 2000;

export async function findEventForViewer(
  pool: Queryable,
  eventId: string,
  viewer: EventViewer,
): Promise<{ permissionDenied: boolean; found: boolean }> {
  const result = await pool.query('SELECT id, company_id FROM events WHERE id=$1 LIMIT 1', [eventId]);
  const row = result.rows[0];
  if (!row) return { permissionDenied: false, found: false };
  if (viewer.role === 'business' && (!viewer.companyId || str(row.company_id) !== viewer.companyId)) {
    return { permissionDenied: true, found: true };
  }
  return { permissionDenied: false, found: true };
}

export async function loadEventControlCenter(
  pool: Queryable,
  eventId: string,
  viewer: EventViewer,
  options: { ticketLimit?: number } = {},
): Promise<EventControlCenter | null> {
  const ticketLimit = Math.min(Math.max(1, options.ticketLimit ?? TICKET_LIMIT), 50000);
  const access = await findEventForViewer(pool, eventId, viewer);
  if (access.permissionDenied) {
    const error = new Error('Sem permissão para este evento.');
    (error as Error & { code?: string }).code = 'EVENT_FORBIDDEN';
    throw error;
  }
  if (!access.found) return null;

  const [eventResult, typeResult, ticketResult, orderResult, paymentResult, validationResult, refundResult, historyResult] =
    await Promise.all([
      pool.query(
        `SELECT e.id, e.company_id, e.title, e.status, e.starts_at, e.ends_at, e.data, e.created_at, e.updated_at,
                c.name AS company_name
           FROM events e LEFT JOIN companies c ON c.id = e.company_id
          WHERE e.id = $1 LIMIT 1`,
        [eventId],
      ),
      pool.query(
        `SELECT tt.id, tt.name, tt.price_xof, tt.quantity,
                COUNT(t.id) FILTER (WHERE t.status IN ('valid','used'))::int AS sold
           FROM ticket_types tt
           LEFT JOIN tickets t ON t.ticket_type_id = tt.id
          WHERE tt.event_id = $1
          GROUP BY tt.id
          ORDER BY tt.price_xof DESC, tt.name ASC`,
        [eventId],
      ),
      pool.query(
        `SELECT t.id, t.ticket_code, t.status, t.buyer_name, t.buyer_phone, t.holder_name, t.holder_phone,
                t.created_at, o.id AS order_id, o.status AS order_status,
                COALESCE(tt.price_xof, 0) AS price_xof, tt.name AS ticket_type_name,
                v.created_at AS validated_at,
                r.status AS refund_status
           FROM tickets t
           JOIN orders o ON o.id = t.order_id
           LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
           LEFT JOIN ticket_validations v ON v.ticket_id = t.id AND v.result = 'accepted'
           LEFT JOIN LATERAL (
             SELECT status FROM ticket_refunds WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
           ) r ON TRUE
          WHERE t.event_id = $1
          ORDER BY t.created_at DESC
          LIMIT $2`,
        [eventId, ticketLimit + 1],
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS orders, COALESCE(SUM(gross_amount_xof),0)::bigint AS gross,
                COALESCE(SUM(fee_amount_xof),0)::bigint AS fee, COALESCE(SUM(net_amount_xof),0)::bigint AS net
           FROM orders WHERE event_id = $1 GROUP BY status`,
        [eventId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS paid
           FROM payment_transactions pt
           JOIN orders o ON o.id = pt.order_id
          WHERE o.event_id = $1 AND pt.status = 'paid'`,
        [eventId],
      ),
      pool.query(
        `SELECT v.id, v.result, COALESCE(v.reason,'') AS reason, v.created_at, t.ticket_code,
                COALESCE(u.email, '') AS operator
           FROM ticket_validations v
           JOIN tickets t ON t.id = v.ticket_id
           LEFT JOIN users u ON u.id = v.operator_user_id
          WHERE t.event_id = $1
          ORDER BY v.created_at DESC
          LIMIT 200`,
        [eventId],
      ),
      pool.query(
        `SELECT r.id, t.ticket_code, r.amount_xof, r.status, r.reason, r.created_at, r.processed_at
           FROM ticket_refunds r
           JOIN tickets t ON t.id = r.ticket_id
          WHERE t.event_id = $1
          ORDER BY r.created_at DESC
          LIMIT 200`,
        [eventId],
      ),
      pool.query(
        `SELECT a.action, a.result, COALESCE(a.resource_id,'') AS resource_id, COALESCE(a.reason,'') AS reason,
                a.created_at, COALESCE(u.email, '') AS actor
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.actor_user_id
          WHERE a.resource = 'event' AND a.resource_id = $1
          ORDER BY a.created_at DESC
          LIMIT 100`,
        [eventId],
      ),
    ]);

  const eventRow = eventResult.rows[0];
  if (!eventRow) return null;
  const data = (eventRow.data ?? {}) as Record<string, unknown>;

  const ticketTypes = typeResult.rows.map((row) => {
    const quantity = num(row.quantity);
    const sold = num(row.sold);
    return {
      id: str(row.id),
      name: str(row.name),
      priceXOF: num(row.price_xof),
      quantity,
      sold,
      available: Math.max(0, quantity - sold),
    };
  });

  const truncated = ticketResult.rows.length > ticketLimit;
  const tickets: EventTicketRow[] = ticketResult.rows.slice(0, ticketLimit).map((row) => ({
    id: str(row.id),
    ticketCode: str(row.ticket_code),
    status: str(row.status),
    buyerName: str(row.buyer_name),
    buyerPhone: str(row.buyer_phone),
    holderName: str(row.holder_name),
    holderPhone: str(row.holder_phone),
    ticketTypeName: str(row.ticket_type_name) || 'Entrada Geral',
    priceXOF: num(row.price_xof),
    orderId: str(row.order_id),
    orderStatus: str(row.order_status),
    purchasedAt: iso(row.created_at),
    validatedAt: iso(row.validated_at),
    refundStatus: row.refund_status === null || row.refund_status === undefined ? null : str(row.refund_status),
  }));

  // Compradores: uma linha por pedido, com os bilhetes que lhe pertencem.
  const buyersByOrder = new Map<string, EventBuyerRow & { types: Map<string, number> }>();
  for (const ticket of tickets) {
    const key = ticket.orderId || ticket.id;
    const current = buyersByOrder.get(key) ?? {
      orderId: ticket.orderId,
      name: ticket.buyerName || ticket.holderName || 'Comprador não identificado',
      phone: ticket.buyerPhone || ticket.holderPhone || '',
      quantity: 0,
      ticketTypes: '',
      totalXOF: 0,
      orderStatus: ticket.orderStatus,
      ticketStatus: '',
      validatedCount: 0,
      purchasedAt: ticket.purchasedAt,
      types: new Map<string, number>(),
    };
    current.quantity += 1;
    if (ticket.status === 'valid' || ticket.status === 'used') current.totalXOF += ticket.priceXOF;
    if (ticket.status === 'used') current.validatedCount += 1;
    current.types.set(ticket.ticketTypeName, (current.types.get(ticket.ticketTypeName) ?? 0) + 1);
    buyersByOrder.set(key, current);
  }
  const buyers: EventBuyerRow[] = Array.from(buyersByOrder.values()).map((buyer) => {
    const statuses = new Set(tickets.filter((ticket) => ticket.orderId === buyer.orderId).map((ticket) => ticket.status));
    return {
      orderId: buyer.orderId,
      name: buyer.name,
      phone: buyer.phone,
      quantity: buyer.quantity,
      ticketTypes: Array.from(buyer.types.entries()).map(([type, count]) => `${type} x${count}`).join(' + '),
      totalXOF: buyer.totalXOF,
      orderStatus: buyer.orderStatus,
      ticketStatus: Array.from(statuses).join('/'),
      validatedCount: buyer.validatedCount,
      purchasedAt: buyer.purchasedAt,
    };
  });

  const orderTotals = orderResult.rows.reduce<{
    grossXOF: number;
    commissionXOF: number;
    companyShareXOF: number;
    pendingXOF: number;
    refundedXOF: number;
    paidOrders: number;
    pendingOrders: number;
    refundedOrders: number;
  }>(
    (acc, row) => {
      const count = num(row.orders);
      const gross = num(row.gross);
      const fee = num(row.fee);
      const net = num(row.net);
      const status = str(row.status);
      if (status === 'paid') {
        acc.paidOrders += count;
        acc.grossXOF += gross;
        acc.commissionXOF += fee;
        acc.companyShareXOF += net;
      } else if (status === 'created' || status === 'pending') {
        acc.pendingOrders += count;
        acc.pendingXOF += gross;
      } else if (status === 'refunded') {
        acc.refundedOrders += count;
        acc.refundedXOF += gross;
      }
      return acc;
    },
    {
      grossXOF: 0,
      commissionXOF: 0,
      companyShareXOF: 0,
      pendingXOF: 0,
      refundedXOF: 0,
      paidOrders: 0,
      pendingOrders: 0,
      refundedOrders: 0,
    },
  );

  const refunds = refundResult.rows.map((row) => ({
    id: str(row.id),
    ticketCode: str(row.ticket_code),
    amountXOF: num(row.amount_xof),
    status: str(row.status),
    reason: str(row.reason),
    createdAt: iso(row.created_at),
    processedAt: iso(row.processed_at),
  }));

  const finance: EventControlCenter['finance'] = {
    ...orderTotals,
    commissionRate: orderTotals.grossXOF > 0 ? Number(((orderTotals.commissionXOF / orderTotals.grossXOF) * 100).toFixed(2)) : 0,
    confirmedPayments: num(paymentResult.rows[0]?.paid),
    refundsRequestedXOF: refunds
      .filter((refund) => refund.status === 'requested')
      .reduce((sum, refund) => sum + refund.amountXOF, 0),
    state:
      orderTotals.grossXOF === 0 && orderTotals.pendingXOF === 0
        ? 'no_sales'
        : orderTotals.grossXOF === 0
          ? 'pending_only'
          : orderTotals.refundedXOF > 0
            ? 'partially_refunded'
            : 'confirmed',
  };

  const used = tickets.filter((ticket) => ticket.status === 'used').length;
  const unused = tickets.filter((ticket) => ticket.status === 'valid').length;
  const cancelled = tickets.filter((ticket) => ticket.status === 'cancelled').length;
  const sold = used + unused;
  const capacity = ticketTypes.reduce((sum, type) => sum + type.quantity, 0);
  const revenueXOF = tickets
    .filter((ticket) => ticket.status === 'valid' || ticket.status === 'used')
    .reduce((sum, ticket) => sum + ticket.priceXOF, 0);

  // Série diária e por tipo, calculada a partir dos bilhetes pagos.
  const dayMap = new Map<string, { tickets: number; revenueXOF: number }>();
  const typeMap = new Map<string, { tickets: number; revenueXOF: number }>();
  for (const ticket of tickets) {
    if (ticket.status !== 'valid' && ticket.status !== 'used') continue;
    const day = ticket.purchasedAt ? ticket.purchasedAt.slice(0, 10) : '';
    if (day) {
      const current = dayMap.get(day) ?? { tickets: 0, revenueXOF: 0 };
      current.tickets += 1;
      current.revenueXOF += ticket.priceXOF;
      dayMap.set(day, current);
    }
    const type = typeMap.get(ticket.ticketTypeName) ?? { tickets: 0, revenueXOF: 0 };
    type.tickets += 1;
    type.revenueXOF += ticket.priceXOF;
    typeMap.set(ticket.ticketTypeName, type);
  }

  const validations = validationResult.rows.map((row) => ({
    id: str(row.id),
    result: str(row.result),
    reason: str(row.reason),
    ticketCode: str(row.ticket_code),
    operator: str(row.operator),
    createdAt: iso(row.created_at),
  }));

  return {
    event: {
      id: str(eventRow.id),
      title: str(eventRow.title),
      status: str(eventRow.status),
      companyId: rowCompany(eventRow),
      companyName: str(eventRow.company_name),
      startsAt: iso(eventRow.starts_at),
      endsAt: iso(eventRow.ends_at),
      date: str(data.date),
      time: str(data.time),
      location: str(data.location),
      neighborhood: str(data.neighborhood),
      category: str(data.category),
      description: str(data.description),
      organizerName: str(data.organizerName) || str(eventRow.company_name),
      scannerDoorCode: str(data.scannerDoorCode),
      createdAt: iso(eventRow.created_at),
      updatedAt: iso(eventRow.updated_at),
    },
    ticketTypes,
    tickets,
    buyers,
    validations,
    refunds,
    history: historyResult.rows.map((row) => ({
      action: str(row.action),
      result: str(row.result),
      resourceId: str(row.resource_id),
      reason: str(row.reason),
      actor: str(row.actor),
      createdAt: iso(row.created_at),
    })),
    finance,
    indicators: {
      capacity,
      sold,
      available: Math.max(0, capacity - sold),
      used,
      unused,
      cancelled,
      revenueXOF,
      checkInsRate: sold > 0 ? Number(((used / sold) * 100).toFixed(1)) : 0,
    },
    salesByDay: Array.from(dayMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, value]) => ({ day, ...value })),
    salesByType: Array.from(typeMap.entries()).map(([name, value]) => ({ name, ...value })),
    recentPurchases: tickets.slice(0, 10).map((ticket) => ({
      ticketCode: ticket.ticketCode,
      buyer: ticket.buyerName || ticket.holderName || '—',
      type: ticket.ticketTypeName,
      priceXOF: ticket.priceXOF,
      purchasedAt: ticket.purchasedAt,
    })),
    recentValidations: validations.slice(0, 10).map((validation) => ({
      ticketCode: validation.ticketCode,
      createdAt: validation.createdAt,
    })),
    truncated,
    generatedAt: new Date().toISOString(),
  };
}

function rowCompany(row: DbRow): string | null {
  return row.company_id === null || row.company_id === undefined ? null : str(row.company_id);
}

/* ------------------------------------------------------------------ *
 * Exportação unificada (secções selecionáveis em CSV, XLSX e PDF)
 * ------------------------------------------------------------------ */

export const EXPORT_SECTIONS = [
  'summary',
  'event',
  'tickets',
  'sales',
  'buyers',
  'finance',
  'commissions',
  'validations',
  'refunds',
  'history',
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export const EXPORT_SECTION_LABELS: Record<ExportSection, string> = {
  summary: 'Resumo',
  event: 'Evento',
  tickets: 'Bilhetes',
  sales: 'Vendas',
  buyers: 'Compradores',
  finance: 'Financeiro',
  commissions: 'Comissões',
  validations: 'Validações',
  refunds: 'Reembolsos',
  history: 'Histórico',
};

const money = (value: number) => `${value.toLocaleString('pt-PT')} XOF`;

const summaryRows = (data: EventControlCenter): Array<[string, string]> => [
  ['Evento', data.event.title],
  ['Organizador', data.event.organizerName],
  ['Estado do evento', data.event.status],
  ['Data', `${data.event.date || '—'} ${data.event.time || ''}`.trim()],
  ['Local', data.event.location],
  ['Capacidade', String(data.indicators.capacity)],
  ['Bilhetes vendidos', String(data.indicators.sold)],
  ['Bilhetes utilizados', String(data.indicators.used)],
  ['Bilhetes por usar', String(data.indicators.unused)],
  ['Bilhetes cancelados', String(data.indicators.cancelled)],
  ['Receita bruta', money(data.finance.grossXOF)],
  ['Comissão Guigui.com', money(data.finance.commissionXOF)],
  ['Valor da empresa', money(data.finance.companyShareXOF)],
  ['Pendente', money(data.finance.pendingXOF)],
  ['Reembolsado', money(data.finance.refundedXOF)],
  ['Estado financeiro', data.finance.state],
];

export interface EventExportFilter {
  query?: string;
  ticketStatus?: string;
  orderStatus?: string;
  validationResult?: string;
}

const matchesQuery = (query: string, values: Array<string | number | null | undefined>) =>
  values.some((value) => String(value ?? '').toLowerCase().includes(query));

/**
 * Aplica à exportação exactamente os filtros visíveis no centro de controlo.
 * Os totais financeiros e o resumo continuam a representar o evento inteiro;
 * apenas as listas (bilhetes, compradores, validações) são filtradas.
 */
export function filterEventData(data: EventControlCenter, filter: EventExportFilter): EventControlCenter {
  const query = (filter.query ?? '').trim().toLowerCase();
  const ticketStatus = filter.ticketStatus && filter.ticketStatus !== 'all' ? filter.ticketStatus : '';
  const orderStatus = filter.orderStatus && filter.orderStatus !== 'all' ? filter.orderStatus : '';
  const validationResult =
    filter.validationResult && filter.validationResult !== 'all' ? filter.validationResult : '';

  const tickets = data.tickets.filter((ticket) => {
    if (ticketStatus && ticket.status !== ticketStatus) return false;
    if (!query) return true;
    return matchesQuery(query, [
      ticket.ticketCode,
      ticket.buyerName,
      ticket.holderName,
      ticket.buyerPhone,
      ticket.holderPhone,
      ticket.ticketTypeName,
    ]);
  });

  const buyers = data.buyers.filter((buyer) => {
    if (orderStatus && buyer.orderStatus !== orderStatus) return false;
    if (!query) return true;
    return matchesQuery(query, [buyer.name, buyer.phone, buyer.orderId, buyer.ticketTypes]);
  });

  const validations = data.validations.filter((validation) => {
    if (validationResult && validation.result !== validationResult) return false;
    if (!query) return true;
    return matchesQuery(query, [validation.ticketCode, validation.operator, validation.reason]);
  });

  return { ...data, tickets, buyers, validations };
}

/** Tabelas por secção: cabeçalho + linhas, usadas por CSV/PDF/XLSX. */
export function buildExportTables(data: EventControlCenter, sections: ExportSection[]) {
  const tables: Array<{ section: ExportSection; title: string; headers: string[]; rows: Array<Array<string | number>> }> = [];
  for (const section of sections) {
    if (section === 'summary') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Indicador', 'Valor'],
        rows: summaryRows(data),
      });
    } else if (section === 'event') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Campo', 'Valor'],
        rows: [
          ['Referência', data.event.id],
          ['Título', data.event.title],
          ['Organizador', data.event.organizerName],
          ['Empresa', data.event.companyName],
          ['Estado', data.event.status],
          ['Data', data.event.date],
          ['Hora', data.event.time],
          ['Local', data.event.location],
          ['Bairro', data.event.neighborhood],
          ['Categoria', data.event.category],
          ['Descrição', data.event.description],
          ['Criado em', data.event.createdAt ?? ''],
          ['Atualizado em', data.event.updatedAt ?? ''],
        ],
      });
    } else if (section === 'tickets') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Tipo', 'Preço (XOF)', 'Capacidade', 'Vendidos', 'Disponíveis'],
        rows: data.ticketTypes.map((type) => [type.name, type.priceXOF, type.quantity, type.sold, type.available]),
      });
    } else if (section === 'sales') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Dia', 'Bilhetes', 'Receita (XOF)'],
        rows: data.salesByDay.map((day) => [day.day, day.tickets, day.revenueXOF]),
      });
    } else if (section === 'buyers') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Comprador', 'Telefone', 'Pedido', 'Bilhetes', 'Tipos', 'Total pago (XOF)', 'Pagamento', 'Bilhetes', 'Validados', 'Data'],
        rows: data.buyers.map((buyer) => [
          buyer.name,
          buyer.phone || '—',
          buyer.orderId,
          buyer.quantity,
          buyer.ticketTypes,
          buyer.totalXOF,
          buyer.orderStatus,
          buyer.ticketStatus,
          buyer.validatedCount,
          buyer.purchasedAt ?? '',
        ]),
      });
    } else if (section === 'finance') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Métrica', 'Valor'],
        rows: [
          ['Receita bruta (pedidos pagos)', money(data.finance.grossXOF)],
          ['Comissão Guigui.com', money(data.finance.commissionXOF)],
          ['Valor atribuído à empresa', money(data.finance.companyShareXOF)],
          ['Pendente', money(data.finance.pendingXOF)],
          ['Reembolsado', money(data.finance.refundedXOF)],
          ['Pedidos pagos', data.finance.paidOrders],
          ['Pedidos pendentes', data.finance.pendingOrders],
          ['Pedidos reembolsados', data.finance.refundedOrders],
          ['Pagamentos confirmados', data.finance.confirmedPayments],
          ['Estado financeiro', data.finance.state],
        ],
      });
    } else if (section === 'commissions') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Métrica', 'Valor'],
        rows: [
          ['Taxa de comissão aplicada (%)', data.finance.commissionRate],
          ['Comissão total', money(data.finance.commissionXOF)],
          ['Base de cálculo (receita bruta)', money(data.finance.grossXOF)],
          ['Valor líquido da empresa', money(data.finance.companyShareXOF)],
        ],
      });
    } else if (section === 'validations') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Bilhete', 'Resultado', 'Motivo', 'Operador', 'Data'],
        rows: data.validations.map((validation) => [
          validation.ticketCode,
          validation.result,
          validation.reason || '—',
          validation.operator || '—',
          validation.createdAt ?? '',
        ]),
      });
    } else if (section === 'refunds') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Reembolso', 'Bilhete', 'Valor (XOF)', 'Estado', 'Motivo', 'Pedido em', 'Processado em'],
        rows: data.refunds.map((refund) => [
          refund.id,
          refund.ticketCode,
          refund.amountXOF,
          refund.status,
          refund.reason,
          refund.createdAt ?? '',
          refund.processedAt ?? '',
        ]),
      });
    } else if (section === 'history') {
      tables.push({
        section,
        title: EXPORT_SECTION_LABELS[section],
        headers: ['Ação', 'Resultado', 'Registo', 'Motivo', 'Responsável', 'Data'],
        rows: data.history.map((entry) => [
          entry.action,
          entry.result,
          entry.resourceId,
          entry.reason || '—',
          entry.actor || '—',
          entry.createdAt ?? '',
        ]),
      });
    }
  }
  return tables;
}

export function buildEventCsv(data: EventControlCenter, sections: ExportSection[]): string {
  const tables = buildExportTables(data, sections);
  const cell = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const blocks = tables.map((table) =>
    [cell(table.title), table.headers.map(cell).join(';'), ...table.rows.map((row) => row.map(cell).join(';'))].join('\r\n'),
  );
  return `\uFEFF${blocks.join('\r\n\r\n')}`;
}

export async function buildEventXlsx(data: EventControlCenter, sections: ExportSection[]): Promise<Buffer> {
  const tables = buildExportTables(data, sections);
  const sheets = tables.map((table) => ({
    name: table.title.slice(0, 31),
    data: [
      table.headers.map((header) => ({ value: header, fontWeight: 'bold' as const })),
      ...table.rows.map((row) => row.map((value) => ({ value: typeof value === 'number' ? value : String(value ?? '') }))),
    ],
  }));
  const file = writeXlsxFile(sheets);
  return file.toBuffer();
}

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;

export async function buildEventPdf(data: EventControlCenter, sections: ExportSection[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tables = buildExportTables(data, sections);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const write = (text: string, options: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
    if (y < MARGIN + 20) newPage();
    const size = options.size ?? 9;
    const safe = text.replace(/[\u0000-\u001f]/g, ' ').slice(0, 220);
    page.drawText(safe, {
      x: MARGIN,
      y,
      size,
      font: options.bold ? bold : font,
      color: options.color ? rgb(...options.color) : rgb(0.1, 0.13, 0.15),
    });
    y -= size + 4;
  };

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 70, width: PAGE_WIDTH, height: 70, color: rgb(0.043, 0.231, 0.216) });
  page.drawText('Relatório de evento — Guigui.com', { x: MARGIN, y: PAGE_HEIGHT - 40, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(data.event.title.slice(0, 110), { x: MARGIN, y: PAGE_HEIGHT - 58, size: 10, font, color: rgb(0.85, 0.95, 0.92) });
  y = PAGE_HEIGHT - 90;

  // Cartões de indicadores reais do evento.
  const kpis: Array<[string, string]> = [
    ['Bilhetes vendidos', `${data.indicators.sold} / ${data.indicators.capacity}`],
    ['Receita bruta', money(data.finance.grossXOF)],
    ['Comissão Guigui.com', money(data.finance.commissionXOF)],
    ['Valor da empresa', money(data.finance.companyShareXOF)],
  ];
  const kpiWidth = (PAGE_WIDTH - MARGIN * 2 - 18) / 4;
  kpis.forEach(([label, value], index) => {
    const x = MARGIN + index * (kpiWidth + 6);
    page.drawRectangle({
      x,
      y: y - 40,
      width: kpiWidth,
      height: 40,
      color: rgb(0.96, 0.98, 0.97),
      borderColor: rgb(0.85, 0.9, 0.88),
      borderWidth: 0.6,
    });
    page.drawText(label.toUpperCase().slice(0, 30), { x: x + 7, y: y - 14, size: 6.5, font: bold, color: rgb(0.36, 0.44, 0.42) });
    page.drawText(value.slice(0, 28), { x: x + 7, y: y - 30, size: 10, font: bold, color: rgb(0.04, 0.23, 0.2) });
  });
  y -= 56;

  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const fit = (value: string, width: number, size: number, useBold: boolean) => {
    const activeFont = useBold ? bold : font;
    let text = value.replace(/\s+/g, ' ').trim();
    if (activeFont.widthOfTextAtSize(text, size) <= width - 8) return text;
    while (text.length > 1 && activeFont.widthOfTextAtSize(`${text}…`, size) > width - 8) {
      text = text.slice(0, -1);
    }
    return `${text}…`;
  };

  for (const table of tables) {
    if (y < MARGIN + 70) newPage();
    write(table.title, { size: 11, bold: true, color: [0.04, 0.35, 0.3] });

    // Larguras proporcionais ao conteúdo de cada coluna.
    const weights = table.headers.map((header, index) => {
      const longest = table.rows.reduce(
        (max, row) => Math.max(max, String(row[index] ?? '').length),
        header.length,
      );
      return Math.min(42, Math.max(7, longest));
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const widths = weights.map((weight) => (weight / totalWeight) * tableWidth);

    const drawTableHeader = () => {
      if (y < MARGIN + 30) newPage();
      page.drawRectangle({ x: MARGIN, y: y - 12, width: tableWidth, height: 15, color: rgb(0.93, 0.96, 0.95) });
      let x = MARGIN;
      table.headers.forEach((header, index) => {
        page.drawText(fit(header, widths[index], 7.5, true), {
          x: x + 4,
          y: y - 8,
          size: 7.5,
          font: bold,
          color: rgb(0.25, 0.33, 0.31),
        });
        x += widths[index];
      });
      y -= 17;
    };
    drawTableHeader();

    table.rows.forEach((row, rowIndex) => {
      if (y < MARGIN + 16) {
        newPage();
        write(table.title, { size: 11, bold: true, color: [0.04, 0.35, 0.3] });
        drawTableHeader();
      }
      if (rowIndex % 2 === 1) {
        page.drawRectangle({ x: MARGIN, y: y - 10, width: tableWidth, height: 14, color: rgb(0.975, 0.98, 0.975) });
      }
      let x = MARGIN;
      row.forEach((value, index) => {
        page.drawText(fit(String(value ?? ''), widths[index], 7.3, false), {
          x: x + 4,
          y: y - 6,
          size: 7.3,
          font,
          color: rgb(0.12, 0.16, 0.18),
        });
        x += widths[index];
      });
      y -= 14;
    });
    y -= 10;
  }

  const footer = `Gerado em ${new Date(data.generatedAt).toLocaleString('pt-PT')} · Guigui.com`;
  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText(footer, { x: MARGIN, y: 18, size: 7, font, color: rgb(0.45, 0.5, 0.53) });
    current.drawText(`${index + 1}/${pages.length}`, { x: PAGE_WIDTH - MARGIN - 24, y: 18, size: 7, font, color: rgb(0.45, 0.5, 0.53) });
  });

  return Buffer.from(await pdf.save());
}

export function normaliseSections(input: unknown): ExportSection[] {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  const selected = list
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter((value): value is ExportSection => (EXPORT_SECTIONS as readonly string[]).includes(value));
  return selected.length > 0 ? Array.from(new Set(selected)) : [...EXPORT_SECTIONS];
}
