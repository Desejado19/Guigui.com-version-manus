import { readSnapshot, runImportFromCli, type ImportPool } from './importRunner';
import { DEFAULT_MONETIZATION_CATALOG } from '../src/data/monetizationCatalog';

type Catalog = { version?: number; updatedAt?: string };

const catalog = readSnapshot<Catalog>('monetization-catalog.json', DEFAULT_MONETIZATION_CATALOG as Catalog);

async function importCatalog(entry: Catalog, pool: ImportPool): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO monetization_catalog (id,version,catalog,updated_at) VALUES ('default',$1,$2,$3)
     ON CONFLICT (id) DO NOTHING`,
    [entry.version || 1, JSON.stringify(entry), entry.updatedAt || new Date().toISOString()],
  );
  return result.rowCount === 1;
}

await runImportFromCli({
  label: 'o catálogo',
  records: [catalog],
  recordKey: () => 'default',
  validateRecord: (entry) => Boolean(
    entry
    && Number.isInteger(entry.version ?? 1)
    && (entry.version ?? 1) > 0
    && (!entry.updatedAt || Number.isFinite(Date.parse(entry.updatedAt))),
  ),
  hasConflict: async (_entry, pool) => (
    await pool.query("SELECT 1 FROM monetization_catalog WHERE id = 'default' LIMIT 1")
  ).rows.length > 0,
  importRecord: (entry, pool) => importCatalog(entry, pool),
});
