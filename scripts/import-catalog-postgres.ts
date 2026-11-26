import { readSnapshot, runImport, type ImportPool } from './importRunner';
import { DEFAULT_MONETIZATION_CATALOG } from '../src/data/monetizationCatalog';

type Catalog = { version?: number; updatedAt?: string };

const catalog = readSnapshot<Catalog>('monetization-catalog.json', DEFAULT_MONETIZATION_CATALOG as Catalog);

async function importCatalog(entry: Catalog, pool: ImportPool): Promise<void> {
  await pool.query(
    `INSERT INTO monetization_catalog (id,version,catalog,updated_at) VALUES ('default',$1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version,catalog=EXCLUDED.catalog,updated_at=EXCLUDED.updated_at`,
    [entry.version || 1, JSON.stringify(entry), entry.updatedAt || new Date().toISOString()],
  );
}

await runImport({
  label: 'o catálogo',
  records: [catalog],
  importRecord: (entry, pool) => importCatalog(entry, pool),
  summary: (_pool, records) => `postgres-catalog-import: versão ${records[0]?.version || 1} importada`,
});
