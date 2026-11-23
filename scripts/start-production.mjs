import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'production';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { runPlatformEntrypoint } = await import('../dist/platform-preflight.mjs');

try {
  await runPlatformEntrypoint(
    process.env,
    path.resolve(projectDirectory, 'data'),
    () => import('../dist/server.mjs'),
  );
} catch (error) {
  // O esquema é verificado no arranque; migrações pendentes devem parar o
  // deploy com uma mensagem acionável (npm run db:migrate), nunca servir com
  // tabelas em falta.
  if (error?.name === 'SchemaOutOfDateError') {
    console.error(`[Guigui.com] ${error.message}`);
    process.exit(1);
  }
  throw error;
}
