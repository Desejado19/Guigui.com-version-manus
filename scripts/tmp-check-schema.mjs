import pg from 'pg';

const url = process.env.DATABASE_URL || process.env.GUIGUI_LOCAL_DATABASE_URL;
const client = new pg.Client({ connectionString: url });
await client.connect();

const tables = await client.query(`
  SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
`);
console.log('TABLES:', tables.rows.map((r) => r.tablename).join(', '));

const indexes = await client.query(`
  SELECT indexname, indexdef FROM pg_indexes
  WHERE schemaname='public' AND tablename='conversation_messages'
`);
console.log('\nINDEXES on conversation_messages:');
for (const row of indexes.rows) console.log(' -', row.indexname, '::', row.indexdef);

const cols = await client.query(`
  SELECT column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name='conversation_messages' ORDER BY ordinal_position
`);
console.log('\nCOLUMNS:');
for (const row of cols.rows) console.log(' -', row.column_name, row.data_type, 'null=' + row.is_nullable);

const constraints = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
  WHERE conrelid='conversation_messages'::regclass
`);
console.log('\nCONSTRAINTS:');
for (const row of constraints.rows) console.log(' -', row.conname, '::', row.def);

await client.end();
