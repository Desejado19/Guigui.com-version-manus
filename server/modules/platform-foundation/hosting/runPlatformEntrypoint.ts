import { prepareVercelRuntime } from './prepareVercelRuntime';
import { requireProductionDatabase } from '../application/requireProductionDatabase';

export async function runPlatformEntrypoint<T>(
  env: NodeJS.ProcessEnv,
  sourceDataDirectory: string,
  loadApplication: () => Promise<T>,
  checkDatabaseConnection?: () => Promise<void>,
): Promise<T> {
  prepareVercelRuntime(env, sourceDataDirectory);
  await requireProductionDatabase(
    env,
    checkDatabaseConnection ?? (async () => {
      throw new Error('Production PostgreSQL connection check is not configured.');
    }),
  );
  return loadApplication();
}
