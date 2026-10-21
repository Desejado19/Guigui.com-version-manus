import { databaseConfigured, databasePool } from './db';
import { loadJson } from './runtimeStore';
import type { TicketOffer } from './ticketPurchaseDomain';

export interface TicketEventSnapshot {
  id: string;
  businessId?: string;
  title: string;
  status?: string;
  date?: string;
  time?: string;
  salesOpen?: boolean;
  ticketSalesOpen?: boolean;
  ticketTypes?: Array<{
    id: string;
    name: string;
    priceXOF: number;
    availableQuantity: number;
    soldQuantity: number;
    salesOpen?: boolean;
  }>;
}

interface LocalTicketSnapshot {
  id: string;
  eventId?: string;
  ticketTypeId?: string;
  ticketTypeName?: string;
  status?: string;
  reservedUntil?: string;
}

interface LocalReservationSnapshot {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  expiresAt: string;
  status: string;
}

interface TicketCatalogDependencies {
  databaseConfigured: boolean;
  loadPostgresOffer(eventId: string, ticketTypeId: string): Promise<TicketOffer | null>;
  loadLocalEvents(): Promise<TicketEventSnapshot[]>;
  loadLocalTickets(): Promise<LocalTicketSnapshot[]>;
  loadLocalReservations(): Promise<LocalReservationSnapshot[]>;
}

function isSalesOpen(value: boolean | undefined): boolean {
  return value !== false;
}

function localOffer(
  events: TicketEventSnapshot[],
  tickets: LocalTicketSnapshot[],
  reservations: LocalReservationSnapshot[],
  eventId: string,
  ticketTypeId: string,
): TicketOffer | null {
  const event = events.find((candidate) => candidate.id === eventId);
  if (!event || (event.status !== 'active' && event.status !== 'published')) return null;
  if (!isSalesOpen(event.salesOpen) || !isSalesOpen(event.ticketSalesOpen)) return null;

  const ticketType = event.ticketTypes?.find((candidate) => candidate.id === ticketTypeId);
  if (!ticketType || !isSalesOpen(ticketType.salesOpen)) return null;
  if (!Number.isSafeInteger(ticketType.priceXOF) || ticketType.priceXOF <= 0 || ticketType.priceXOF > 100_000_000
    || !Number.isSafeInteger(ticketType.availableQuantity) || ticketType.availableQuantity < 0
    || !Number.isSafeInteger(ticketType.soldQuantity) || ticketType.soldQuantity < 0) {
    return null;
  }

  const now = Date.now();
  const ticketRecords = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const soldCount = Array.from(ticketRecords.values()).filter((ticket) =>
    ticket.eventId === eventId
    && (ticket.ticketTypeId === ticketTypeId || (!ticket.ticketTypeId && ticket.ticketTypeName === ticketType.name))
    && (ticket.status === 'valid' || ticket.status === 'used'
      || (ticket.status === 'pending' && (!ticket.reservedUntil || Date.parse(ticket.reservedUntil) > now))),
  ).length;
  const reservedQuantity = reservations
    .filter((reservation) => reservation.eventId === eventId
      && reservation.ticketTypeId === ticketTypeId
      && reservation.status === 'pending'
      && Date.parse(reservation.expiresAt) > now)
    .reduce((sum, reservation) => sum + reservation.quantity, 0);

  return {
    eventId: event.id,
    ...(event.businessId ? { businessId: event.businessId } : {}),
    eventTitle: event.title,
    ...(event.date ? { eventDate: event.date } : {}),
    ...(event.time ? { eventTime: event.time } : {}),
    ticketTypeId: ticketType.id,
    ticketTypeName: ticketType.name,
    unitPriceXOF: ticketType.priceXOF,
    availableQuantity: ticketType.availableQuantity,
    soldQuantity: Math.max(ticketType.soldQuantity, soldCount),
    reservedQuantity,
    salesOpen: true,
  };
}

export function createTicketCatalogService(dependencies: TicketCatalogDependencies) {
  return {
    async getTicketOffer(eventId: string, ticketTypeId: string): Promise<TicketOffer | null> {
      if (dependencies.databaseConfigured) {
        return dependencies.loadPostgresOffer(eventId, ticketTypeId);
      }
      const [events, tickets, reservations] = await Promise.all([
        dependencies.loadLocalEvents(),
        dependencies.loadLocalTickets(),
        dependencies.loadLocalReservations(),
      ]);
      return localOffer(events, tickets, reservations, eventId, ticketTypeId);
    },
  };
}

async function loadPostgresOffer(eventId: string, ticketTypeId: string): Promise<TicketOffer | null> {
  if (!databasePool) return null;
  const result = await databasePool.query<{
    event_id: string;
    business_id: string | null;
    event_title: string;
    event_date: string | null;
    event_status: string;
    ticket_type_id: string;
    ticket_type_name: string;
    unit_price_xof: number;
    available_quantity: number;
    sold_quantity: number;
    reserved_quantity: number;
    event_snapshot: Record<string, unknown> | null;
  }>(
    `SELECT e.id AS event_id, e.company_id AS business_id, e.title AS event_title, e.status AS event_status,
            e.starts_at::text AS event_date,
            tt.id AS ticket_type_id, tt.name AS ticket_type_name, tt.price_xof AS unit_price_xof,
            tt.quantity AS available_quantity,
            COUNT(t.id) FILTER (
              WHERE t.status IN ('valid', 'used')
                 OR (t.status = 'pending' AND t.created_at > NOW() - INTERVAL '15 minutes')
            )::integer AS sold_quantity,
            COALESCE((
                SELECT SUM(tr.quantity)::integer
                  FROM ticket_reservations tr
                 WHERE tr.ticket_type_id = tt.id AND tr.status = 'pending' AND tr.expires_at > NOW()
            ), 0) AS reserved_quantity,
            e.data AS event_snapshot
       FROM events e
       JOIN ticket_types tt ON tt.event_id = e.id
       LEFT JOIN tickets t ON t.ticket_type_id = tt.id
      WHERE e.id = $1 AND tt.id = $2 AND e.status = 'published'
        AND COALESCE(e.data->>'salesOpen', e.data->>'ticketSalesOpen', 'true') <> 'false'
        AND (
          jsonb_typeof(e.data->'ticketTypes') IS DISTINCT FROM 'array'
          OR EXISTS (
            SELECT 1
              FROM jsonb_array_elements(COALESCE(e.data->'ticketTypes', '[]'::jsonb)) ticket_type
             WHERE ticket_type->>'id' = tt.id
          )
        )
        AND COALESCE((
          SELECT ticket_type->>'salesOpen'
            FROM jsonb_array_elements(COALESCE(e.data->'ticketTypes', '[]'::jsonb)) ticket_type
           WHERE ticket_type->>'id' = tt.id
           LIMIT 1
        ), 'true') <> 'false'
      GROUP BY e.id, tt.id`,
    [eventId, ticketTypeId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    eventId: row.event_id,
    ...(row.business_id ? { businessId: row.business_id } : {}),
    eventTitle: row.event_title,
    ...(row.event_snapshot && typeof row.event_snapshot.date === 'string'
      ? { eventDate: row.event_snapshot.date }
      : row.event_date ? { eventDate: row.event_date.slice(0, 10) } : {}),
    ...(row.event_snapshot && typeof row.event_snapshot.time === 'string'
      ? { eventTime: row.event_snapshot.time }
      : row.event_date ? { eventTime: row.event_date.slice(11, 16) } : {}),
    ticketTypeId: row.ticket_type_id,
    ticketTypeName: row.ticket_type_name,
    unitPriceXOF: Number(row.unit_price_xof),
    availableQuantity: Number(row.available_quantity),
    soldQuantity: Number(row.sold_quantity),
    reservedQuantity: Number(row.reserved_quantity),
    salesOpen: true,
  };
}

const localCatalog = createTicketCatalogService({
  databaseConfigured,
  loadPostgresOffer,
  loadLocalEvents: async () => loadJson<TicketEventSnapshot[]>('events.json', []),
  loadLocalTickets: async () => loadJson<Array<[string, LocalTicketSnapshot]>>('tickets.json', []).map(([, ticket]) => ticket),
  loadLocalReservations: async () => loadJson<LocalReservationSnapshot[]>('ticket-reservations.json', []),
});

export const getTicketOffer = localCatalog.getTicketOffer;
