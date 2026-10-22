import { runImport, type ImportPool } from './importRunner';
import { INITIAL_BUSINESSES, INITIAL_EVENTS } from '../src/data/initialData';

const companyStatus: Record<string, string> = { active: 'active', pending: 'pending', suspended: 'suspended', rejected: 'rejected' };
const eventStatus: Record<string, string> = { active: 'published', published: 'published', pending: 'pending', cancelled: 'cancelled', rejected: 'rejected', draft: 'draft' };

// A business and each of its events + ticket types is one unit of work so the
// businesses are inserted before any event that references them.
type BusinessRecord =
  | { kind: 'business'; business: (typeof INITIAL_BUSINESSES)[number] }
  | { kind: 'event'; event: (typeof INITIAL_EVENTS)[number] };

const records: BusinessRecord[] = [
  ...INITIAL_BUSINESSES.map((business) => ({ kind: 'business' as const, business })),
  ...INITIAL_EVENTS.map((event) => ({ kind: 'event' as const, event })),
];

async function importBusinessRecord(record: BusinessRecord, pool: ImportPool): Promise<void> {
  if (record.kind === 'business') {
    const business = record.business;
    await pool.query(
      `INSERT INTO companies (id,name,status,category_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,category_id=EXCLUDED.category_id,updated_at=NOW()`,
      [business.id, business.name, companyStatus[business.status] || 'active', business.categoryId || null],
    );
    return;
  }
  const event = record.event;
  const startsAt = event.date ? `${event.date}T${(event.time || '00:00').split(' - ')[0]}:00Z` : null;
  await pool.query(
    `INSERT INTO events (id,company_id,title,status,starts_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET company_id=EXCLUDED.company_id,title=EXCLUDED.title,status=EXCLUDED.status,starts_at=EXCLUDED.starts_at,updated_at=NOW()`,
    [event.id, event.businessId || null, event.title, eventStatus[event.status] || 'draft', startsAt],
  );
  for (const ticketType of event.ticketTypes || []) {
    await pool.query(
      `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (event_id,name) DO UPDATE SET price_xof=EXCLUDED.price_xof,quantity=EXCLUDED.quantity`,
      [ticketType.id, event.id, ticketType.name, ticketType.priceXOF, ticketType.availableQuantity + ticketType.soldQuantity],
    );
  }
}

await runImport({
  label: 'empresas e eventos',
  records,
  importRecord: (record, pool) => importBusinessRecord(record, pool),
  summary: () => `postgres-business-event-import: ${INITIAL_BUSINESSES.length} empresa(s), ${INITIAL_EVENTS.length} evento(s)`,
});
