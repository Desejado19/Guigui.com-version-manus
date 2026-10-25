export async function requireProductionDatabase(
  env: NodeJS.ProcessEnv,
  checkConnection: () => Promise<void>,
): Promise<void> {
  if (env.NODE_ENV !== 'production') return;
  if (!env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required in production.');
  }

  try {
    await checkConnection();
  } catch (error) {
    throw new Error('Production PostgreSQL connectivity check failed.', { cause: error });
  }
}
