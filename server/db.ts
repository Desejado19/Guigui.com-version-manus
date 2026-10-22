import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();

export const databaseConfigured = Boolean(connectionString);
export const databasePool = connectionString
  ? new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
  })
  : null;

if (databasePool) {
  databasePool.on('error', (err) => {
    console.error('[Guigui.com] Erro inesperado no cliente ocioso do banco de dados (databasePool):', err.message);
  });
}

export async function checkDatabaseConnection(): Promise<{ configured: boolean; connected: boolean }> {
  if (!databasePool) return { configured: false, connected: false };
  const client = await databasePool.connect();
  try {
    await client.query('SELECT 1');
    return { configured: true, connected: true };
  } finally {
    client.release();
  }
}
