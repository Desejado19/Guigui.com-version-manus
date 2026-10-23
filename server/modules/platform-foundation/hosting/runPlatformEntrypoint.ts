import { prepareVercelRuntime } from './prepareVercelRuntime';

export async function runPlatformEntrypoint<T>(
  env: NodeJS.ProcessEnv,
  sourceDataDirectory: string,
  loadApplication: () => Promise<T>,
): Promise<T> {
  prepareVercelRuntime(env, sourceDataDirectory);
  return loadApplication();
}
