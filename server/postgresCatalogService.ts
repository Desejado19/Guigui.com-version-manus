import { databasePool } from './db';

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isConnectionError =
        error instanceof Error &&
        (error.message.includes('Connection terminated') ||
         error.message.includes('connect') ||
         error.message.includes('timeout') ||
         error.message.includes('ECONNREFUSED'));

      if (attempt < maxRetries && isConnectionError) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`[PersistCatalog] Tentativa ${attempt} falhou, reconectando em ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

export async function persistPostgresCatalog(catalog: { version?: number; updatedAt?: string }): Promise<void> {
  if (!databasePool) return;

  await withRetry(async () => {
    await databasePool.query(
      `INSERT INTO monetization_catalog (id,version,catalog,updated_at)
       VALUES ('default',$1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version,catalog=EXCLUDED.catalog,updated_at=EXCLUDED.updated_at`,
      [catalog.version || 1, JSON.stringify(catalog), catalog.updatedAt || new Date().toISOString()],
    );
  }, 5, 1000);
}
