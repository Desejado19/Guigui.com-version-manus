import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCategorySeedRows, seedCategoryCatalog } from '../../server/categoryCatalogSeed';

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const describeIfDb = testDatabaseUrl ? describe : describe.skip;

describeIfDb('PostgreSQL category catalog seed', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required for the category seed integration test.');
    pool = new Pool({ connectionString: testDatabaseUrl });
    await pool.query('SELECT id FROM categories LIMIT 0');
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('is idempotent and preserves a category it does not own', async () => {
    const database = pool;
    if (!database) throw new Error('PostgreSQL test pool was not initialized.');

    const client = await database.connect();
    try {
      await client.query(
        `INSERT INTO categories (id, parent_id, name, description, is_active)
         VALUES ('test-unowned-category', NULL, 'Unowned test category', '', TRUE)
         ON CONFLICT (id) DO NOTHING`,
      );

      await seedCategoryCatalog(client);
      await seedCategoryCatalog(client);
    } finally {
      client.release();
    }

    const seedIds = buildCategorySeedRows().map(({ id }) => id);
    const [{ rows: countRows }, { rows: iconRows }, { rows: unownedRows }] = await Promise.all([
      database.query('SELECT COUNT(*)::integer AS count FROM categories WHERE id = ANY($1::text[])', [seedIds]),
      database.query("SELECT metadata ->> 'iconName' AS icon_name FROM categories WHERE id = 'cat-1'"),
      database.query("SELECT name FROM categories WHERE id = 'test-unowned-category'"),
    ]);

    expect(countRows[0]?.count).toBe(92);
    expect(iconRows[0]?.icon_name).toBe('UtensilsCrossed');
    expect(unownedRows[0]?.name).toBe('Unowned test category');
  });
});
