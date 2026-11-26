import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// O Windows limita qualquer caminho passado ao CreateProcess a 260 caracteres
// (MAX_PATH). O binário nativo do esbuild que o Vite usa vive dentro do
// node_modules/.pnpm do projecto:
//   <cwd>\\node_modules\\.pnpm\\@esbuild+win32-x64@0.25.12\\node_modules\\@esbuild\\win32-x64\\esbuild.exe
// Quando `cwd` é fundo (por exemplo ...\\local-projects\\<uuid>\\threads\\<hash>\\g\\Guigui),
// esse caminho fica com 260 caracteres e o `spawn` falha com ENOENT. Sem esbuild,
// o Vite não transforma .tsx: `/src/App.tsx` cai no fallback SPA, o browser recebe
// `text/html` no lugar de JavaScript e a página fica em branco
// ("Failed to load module script ... MIME type of text/html").
// Solução: expor o MESMO binário num caminho curto (node_modules/.esbuild-bin) e
// apontar ESBUILD_BINARY_PATH para ele. Só actua quando o caminho original excede
// o limite, e usa a versão exacta do esbuild que o Vite carrega para não haver
// desencontro de versões entre o cliente JS e o serviço nativo.
// Abaixo disto o caminho nativo ainda pode falhar no spawn (há folga para
// argumentos e para o quoting do CreateProcess), por isso encurtamos antes.
const PROACTIVE_THRESHOLD = 200;
// Limite duro: acima disto nem a cópia curta vale a pena tentar.
const WINDOWS_MAX_PATH = 260;

/**
 * Força o serviço nativo do esbuild do `tsx` a arrancar antes de
 * `ensureShortEsbuildBinaryPath` trocar `ESBUILD_BINARY_PATH`.
 * 
 * O `tsx` transforma os ficheiros de forma preguiçosa (e o Node 24 consegue
 * despachar TypeScript simples sem esbuild), pelo que o primeiro trabalho que
 * realmente precisa do serviço pode chegar depois da troca da variável — e
 * então o host 0.28.2 arranca com o binário 0.25.12 do Vite e falha com
 * "Host version ... does not match binary version ...".
 * 
 * Aqui carrega-se a MESMA instância do esbuild que o `tsx` usa e faz-se uma
 * transformação trivial enquanto `ESBUILD_BINARY_PATH` ainda aponta para o
 * binário do `tsx`. O serviço fica vivo até ao fim do processo; a troca
 * seguinte só afecta o serviço (distinto) do Vite.
 */
export async function warmTsxEsbuild(projectDirectory = process.cwd()): Promise<boolean> {
  if (process.platform !== 'win32' || !process.env.ESBUILD_BINARY_PATH) return false;
  try {
    const projectRequire = createRequire(path.join(projectDirectory, 'package.json'));
    const tsxEsbuildEntry = createRequire(projectRequire.resolve('tsx/package.json')).resolve(
      'esbuild',
    );
    const tsxEsbuild = projectRequire(tsxEsbuildEntry) as {
      transform(
        source: string,
        options: { loader: 'ts' },
      ): Promise<unknown>;
    };
    await tsxEsbuild.transform('export const esbuildWarm: number = 1;', { loader: 'ts' });
    return true;
  } catch {
    return false;
  }
}

export function ensureShortEsbuildBinaryPath(projectDirectory = process.cwd()): string | null {
  if (process.platform !== 'win32') return null;

  const projectRequire = createRequire(path.join(projectDirectory, 'index.js'));

  let binaryPath: string;
  let version: string;
  try {
    // Use tsx's esbuild version (0.28.2) to match the host, not Vite's (0.25.12)
    const tsxEsbuildPackagePath = createRequire(projectRequire.resolve('tsx/package.json')).resolve(
      'esbuild/package.json',
    );
    version = String(
      (JSON.parse(fs.readFileSync(tsxEsbuildPackagePath, 'utf8')) as { version?: string }).version || 'unknown',
    );
    binaryPath = createRequire(tsxEsbuildPackagePath).resolve('@esbuild/win32-x64/esbuild.exe');
  } catch {
    // Sem esbuild resolvível não há nada a corrigir aqui.
    return null;
  }

  if (binaryPath.length < PROACTIVE_THRESHOLD) return null;

  const shortDirectory = path.join(projectDirectory, 'node_modules', '.esbuild-bin');
  const shortPath = path.join(shortDirectory, `esbuild-${version}.exe`);
  if (shortPath.length >= WINDOWS_MAX_PATH) return null;

  try {
    fs.mkdirSync(shortDirectory, { recursive: true });
    const upToDate = fs.existsSync(shortPath) && fs.statSync(shortPath).size === fs.statSync(binaryPath).size;
    if (!upToDate) {
      fs.rmSync(shortPath, { force: true });
      try {
        // Hard link: instantâneo e sem duplicar 10 MB. Só falha entre volumes.
        fs.linkSync(binaryPath, shortPath);
      } catch {
        fs.copyFileSync(binaryPath, shortPath);
      }
    }
  } catch (error) {
    console.error('[Guigui.com] não foi possível encurtar o caminho do esbuild:', error);
    return null;
  }

  process.env.ESBUILD_BINARY_PATH = shortPath;
  return shortPath;
}