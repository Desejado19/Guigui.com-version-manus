import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'production';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { runPlatformEntrypoint } = await import('../dist/platform-preflight.mjs');

await runPlatformEntrypoint(
  process.env,
  path.resolve(projectDirectory, 'data'),
  () => import('../dist/server.mjs'),
);
