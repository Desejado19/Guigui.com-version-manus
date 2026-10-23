import 'dotenv/config';
import path from 'path';
import { runPlatformEntrypoint } from './modules/platform-foundation/hosting/runPlatformEntrypoint';

await runPlatformEntrypoint(
  process.env,
  path.resolve(process.cwd(), 'data'),
  () => import('../server.js'),
);
