import { Pool, type PoolClient } from 'pg';
import { seedCategoryCatalog } from '../server/categoryCatalogSeed';

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be explicitly set before seeding categories.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await seedCategoryCatalog(client);
    console.log('Category catalog seed completed.');
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Category seed failed:', error);
  process.exitCode = 1;
});
