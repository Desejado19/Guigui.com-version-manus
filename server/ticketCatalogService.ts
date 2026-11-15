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

interface PostgresEventRow {
  id: string;
  company_id: string | null;
  title: string;
  status: string;
  starts_at: string | null;
  data: Record<string, unknown> | null;
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

function readSnapshotTypes(row: PostgresEventRow): Array<Record<string, unknown>> {
  const snapshot = row.data;
  if (!snapshot || typeof snapshot !== 'object') return [];
  const types = (snapshot as Record<string, unknown>).ticketTypes;
  return Array.isArray(types) ? types as Array<Record<string, unknown>> : [];
}

/**
 * A fonte de verdade das categorias de bilhete é o snapshot do evento
 * (`events.data->'ticketTypes'`), que é o mesmo que o checkout mostra. A tabela
 * `ticket_types` pode ter linhas com ids gerados por importações antigas, por
 * isso a oferta é resolvida pelo id do snapshot e a linha física é encontrada
 * por id ou, em alternativa, pelo nome da categoria.
 */
async function loadPostgresOffer(eventId: string, ticketTypeId: string): Promise<TicketOffer | null> {
  if (!databasePool) return null;

  const eventResult = await databasePool.query<PostgresEventRow>(
    `SELECT id, company_id, title, status, starts_at::text AS starts_at, data
       FROM events
      WHERE id = $1 AND status = 'published'`,
    [eventId],
  );
  const event = eventResult.rows[0];
  if (!event) return null;

  const snapshotTypes = readSnapshotTypes(event);
  const snapshot = (event.data ?? {}) as Record<string, unknown>;
  if (String(snapshot.salesOpen ?? snapshot.ticketSalesOpen ?? 'true') === 'false') return null;

  const ticketType = snapshotTypes.find((candidate) => String(candidate.id) === ticketTypeId);
  if (!ticketType) return null;
  if (String(ticketType.salesOpen ?? 'true') === 'false') return null;

  const unitPriceXOF = Number(ticketType.priceXOF);
  const availableQuantity = Number(ticketType.availableQuantity);
  const snapshotSold = Number(ticketType.soldQuantity);
  if (!Number.isSafeInteger(unitPriceXOF) || unitPriceXOF <= 0 || unitPriceXOF > 100_000_000) return null;
  if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) return null;

  const ticketTypeName = String(ticketType.name ?? 'Entrada Geral');

  const rowResult = await databasePool.query<{ id: string }>(
    `SELECT id
       FROM ticket_types
      WHERE event_id = $1 AND (id = $2 OR name = $3)
      ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END
      LIMIT 1`,
    [eventId, ticketTypeId, ticketTypeName],
  );
  const storedTicketTypeId = rowResult.rows[0]?.id;

  let storedSold = 0;
  let reservedQuantity = 0;
  if (storedTicketTypeId) {
    const soldResult = await databasePool.query<{ sold: number }>(
      `SELECT COUNT(t.id)::integer AS sold
         FROM tickets t
        WHERE t.ticket_type_id = $1
          AND (
            t.status IN ('valid', 'used')
            OR (t.status = 'pending' AND t.created_at > NOW() - INTERVAL '15 minutes')
          )`,
      [storedTicketTypeId],
    );
    storedSold = Number(soldResult.rows[0]?.sold ?? 0);

    const reservedResult = await databasePool.query<{ reserved: number }>(
      `SELECT COALESCE(SUM(tr.quantity), 0)::integer AS reserved
         FROM ticket_reservations tr
        WHERE tr.ticket_type_id = $1 AND tr.status = 'pending' AND tr.expires_at > NOW()`,
      [storedTicketTypeId],
    );
    reservedQuantity = Number(reservedResult.rows[0]?.reserved ?? 0);
  }

  const eventDate = typeof snapshot.date === 'string'
    ? snapshot.date
    : event.starts_at ? event.starts_at.slice(0, 10) : undefined;
  const eventTime = typeof snapshot.time === 'string'
    ? snapshot.time
    : event.starts_at ? event.starts_at.slice(11, 16) : undefined;

  return {
    eventId: event.id,
    ...(event.company_id ? { businessId: event.company_id } : {}),
    eventTitle: event.title,
    ...(eventDate ? { eventDate } : {}),
    ...(eventTime ? { eventTime } : {}),
    ticketTypeId,
    ticketTypeName,
    unitPriceXOF,
    availableQuantity,
    soldQuantity: Math.max(Number.isSafeInteger(snapshotSold) ? snapshotSold : 0, storedSold),
    reservedQuantity,
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
