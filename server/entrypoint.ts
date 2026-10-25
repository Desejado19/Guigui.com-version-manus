import 'dotenv/config';
import path from 'path';
import { checkDatabaseConnection } from './db';
import { runPlatformEntrypoint } from './modules/platform-foundation/hosting/runPlatformEntrypoint';

await runPlatformEntrypoint(
  process.env,
  path.resolve(process.cwd(), 'data'),
  () => import('../server.js'),
  async () => {
    const database = await checkDatabaseConnection();
    if (!database.connected) {
      throw new Error('PostgreSQL connection check returned disconnected.');
    }
  },
);
