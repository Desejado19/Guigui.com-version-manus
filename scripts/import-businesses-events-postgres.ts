import { runImportFromCli, type ImportPool } from './importRunner';
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

async function importBusinessRecord(record: BusinessRecord, pool: ImportPool): Promise<boolean> {
  if (record.kind === 'business') {
    const business = record.business;
    const result = await pool.query(
      `INSERT INTO companies (id,name,status,category_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
      [business.id, business.name, companyStatus[business.status] || 'active', business.categoryId || null],
    );
    return result.rowCount === 1;
  }
  const event = record.event;
  const startsAt = event.date ? `${event.date}T${(event.time || '00:00').split(' - ')[0]}:00Z` : null;
  const eventResult = await pool.query(
    `INSERT INTO events (id,company_id,title,status,starts_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`,
    [event.id, event.businessId || null, event.title, eventStatus[event.status] || 'draft', startsAt],
  );
  if (eventResult.rowCount !== 1) return false;
  for (const ticketType of event.ticketTypes || []) {
    await pool.query(
      `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (event_id,name) DO NOTHING`,
      [ticketType.id, event.id, ticketType.name, ticketType.priceXOF, ticketType.availableQuantity + ticketType.soldQuantity],
    );
  }
  return true;
}

await runImportFromCli({
  label: 'empresas e eventos',
  records,
  recordKey: (record) => `${record.kind}:${record.kind === 'business' ? record.business.id : record.event.id}`,
  validateRecord: (record) => record.kind === 'business'
    ? Boolean(record.business && typeof record.business.id === 'string' && record.business.id.trim() && typeof record.business.name === 'string')
    : Boolean(record.event && typeof record.event.id === 'string' && record.event.id.trim() && typeof record.event.title === 'string'),
  hasConflict: async (record, pool) => {
    if (record.kind === 'business') {
      return (await pool.query('SELECT 1 FROM companies WHERE id = $1 LIMIT 1', [record.business.id])).rows.length > 0;
    }
    return (await pool.query('SELECT 1 FROM events WHERE id = $1 LIMIT 1', [record.event.id])).rows.length > 0;
  },
  importRecord: (record, pool) => importBusinessRecord(record, pool),
});
