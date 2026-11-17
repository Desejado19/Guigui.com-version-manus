import 'dotenv/config?override=true';
import path from 'path';
import { ensureShortEsbuildBinaryPath } from './modules/platform-foundation/hosting/esbuildBinaryPath';
import { runPlatformEntrypoint } from './modules/platform-foundation/hosting/runPlatformEntrypoint';

// Em desenvolvimento o Vite (middleware mode) arranca o esbuild dentro deste
// processo. Com o projecto num caminho longo do Windows, o spawn falha com
// ENOENT; esta chamada aponta o binário para uma cópia curta antes do Vite
// carregar. Em produção não faz nada (não é win32 / não há esbuild).
ensureShortEsbuildBinaryPath(process.cwd());

// Sem estes handlers, uma promise rejeitada numa rota async (por exemplo um
// erro de SQL) derrubava o processo Node inteiro — o servidor desaparecia e o
// browser passava a receber ERR_CONNECTION_REFUSED. Uma rejeição isolada passa
// a ser registada sem matar o servidor; uma excepção não tratada continua a
// terminar o processo, mas de forma registada e com código de saída explícito.
process.on('unhandledRejection', (reason) => {
  console.error('[Guigui.com] unhandledRejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Guigui.com] uncaughtException:', error);
  process.exit(1);
});

await runPlatformEntrypoint(
  process.env,
  path.resolve(process.cwd(), 'data'),
  () => import('../server.js'),
);
