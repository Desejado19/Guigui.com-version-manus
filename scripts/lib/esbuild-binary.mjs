/**
 * Workaround do limite de caminho do Windows para o binário do esbuild.
 *
 * No Windows o caminho deste projeto é longo demais para o `spawn` do Node
 * conseguir executar `node_modules/.pnpm/@esbuild+win32-x64@.../esbuild.exe`
 * (`spawn ... ENOENT`). Solução: copiar o binário para um diretório curto
 * (temporário) e apontar `ESBUILD_BINARY_PATH` para essa cópia.
 *
 * A cópia tem de ser da versão exacta do esbuild que vai carregá-la, senão o
 * serviço recusa arrancar ("Host version X does not match binary version Y"):
 *  - o build usa a CLI `esbuild` do topo do node_modules (`from: 'esbuild'`);
 *  - o servidor de desenvolvimento usa o esbuild que o Vite resolve
 *    (`from: 'vite'`), que pode ser outra versão.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const platformPackage = () => `@esbuild/win32-${process.arch === 'ia32' ? 'ia32' : process.arch === 'arm64' ? 'arm64' : 'x64'}`;

/**
 * Resolve o pacote `esbuild` que `consumer` (por omissão, o do topo do projeto)
 * vai carregar. Devolve `{ version, binary }` ou `null`.
 */
const resolveEsbuild = (root, consumer) => {
  try {
    const rootEntry = path.join(root, 'package.json');
    const rootRequire = createRequire(rootEntry);
    const packageJsonPath = consumer === 'esbuild'
      ? rootRequire.resolve('esbuild/package.json')
      : createRequire(rootRequire.resolve(`${consumer}/package.json`)).resolve('esbuild/package.json');
    const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const binary = createRequire(packageJsonPath).resolve(`${platformPackage()}/esbuild.exe`);
    if (existsSync(binary)) return { version, binary };
  } catch {
    // Consumidor sem esbuild resolvível: tenta o fallback por diretório abaixo.
  }
  return null;
};

/** Fallback: procura no store do pnpm o binário de qualquer versão instalada. */
const findInPnpmStore = (root, version) => {
  const storeRoot = path.join(root, 'node_modules', '.pnpm');
  if (!existsSync(storeRoot)) return null;

  const prefix = `@esbuild+win32-${process.arch === 'ia32' ? 'ia32' : process.arch === 'arm64' ? 'arm64' : 'x64'}@`;
  const candidates = readdirSync(storeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => ({
      version: entry.name.slice(prefix.length),
      binary: path.join(storeRoot, entry.name, 'node_modules', platformPackage(), 'esbuild.exe'),
    }))
    .filter((candidate) => existsSync(candidate.binary));

  return candidates.find((candidate) => candidate.version === version) ?? candidates[0] ?? null;
};

/** Apaga cópias de execuções anteriores (força-bruta deixa restos). */
const pruneStaleCopies = () => {
  const base = path.join(tmpdir(), 'guigui-esbuild');
  if (!existsSync(base)) return;
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(base, entry.name);
    try {
      if (statSync(directory).mtimeMs < cutoff) rmSync(directory, { recursive: true, force: true });
    } catch {
      // Em uso por outro processo: fica para a próxima.
    }
  }
};

/**
 * Prepara o binário do esbuild num caminho curto.
 * Devolve `{ binaryPath, env, cleanup }`; `binaryPath` é `null` quando o
 * workaround não é necessário (outras plataformas) ou não é possível aplicar.
 */
export const stageEsbuildBinary = (root, { log = () => {}, from = 'esbuild' } = {}) => {
  const env = { ...process.env };

  if (!isWindows) return { binaryPath: null, env, cleanup: () => {} };

  const resolved = resolveEsbuild(root, from) ?? findInPnpmStore(root, null);
  if (!resolved) {
    log('aviso: binário do esbuild não encontrado; a continuar sem workaround de caminho.');
    return { binaryPath: null, env, cleanup: () => {} };
  }

  // Reutiliza uma cópia já preparada por um processo pai (ex.: `dev.mjs` relançado
  // numa junction), desde que seja da mesma versão.
  const inherited = process.env.ESBUILD_BINARY_PATH;
  if (inherited && inherited.includes(resolved.version) && existsSync(inherited)) {
    return { binaryPath: inherited, env, cleanup: () => {} };
  }

  // Cópia própria por execução: se um serviço esbuild de uma execução anterior
  // ainda estiver vivo, o ficheiro antigo está bloqueado (EBUSY) e copiar por
  // cima falhava.
  pruneStaleCopies();
  const directory = path.join(tmpdir(), 'guigui-esbuild', `${resolved.version}-${process.pid}`);
  const target = path.join(directory, 'esbuild.exe');
  try {
    mkdirSync(directory, { recursive: true });
    copyFileSync(resolved.binary, target);
  } catch (error) {
    log(`aviso: não foi possível copiar o esbuild ${resolved.version} (${error.message}); a continuar sem workaround.`);
    return { binaryPath: null, env, cleanup: () => {} };
  }

  env.ESBUILD_BINARY_PATH = target;
  log(`esbuild ${resolved.version} via caminho curto: ${target}`);
  return {
    binaryPath: target,
    env,
    cleanup: () => {
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // Cópia temporária: se ficar bloqueada, o sistema limpa-a depois.
      }
    },
  };
};
