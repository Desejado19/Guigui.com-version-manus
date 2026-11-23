import { resolve } from 'node:path';
import { prepareVercelRuntime } from './prepareVercelRuntime';
import { assertSchemaVersion } from './assertSchemaVersion';

export async function runPlatformEntrypoint<T>(
  env: NodeJS.ProcessEnv,
  sourceDataDirectory: string,
  loadApplication: () => Promise<T>,
): Promise<T> {
  prepareVercelRuntime(env, sourceDataDirectory);
  // `sourceDataDirectory` é <raiz do projecto>/data; as migrações vivem em
  // <raiz>/db/migrations e são o único sítio que cria schema.
  await assertSchemaVersion(env, resolve(sourceDataDirectory, '..'));
  return loadApplication();
}
