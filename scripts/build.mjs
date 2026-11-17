#!/usr/bin/env node
/**
 * Build de produção do Guigui.com.
 *
 * No Windows o caminho deste projeto é demasiado longo para o `spawn` do Node
 * conseguir executar `node_modules/.pnpm/@esbuild+win32-x64@.../esbuild.exe`
 * (erro `spawn ... ENOENT`). Antes de correr o build, copiamos o binário para
 * um diretório curto (temporário) e apontamos `ESBUILD_BINARY_PATH` para essa
 * cópia — é o mesmo workaround que era feito à mão, agora automático.
 *
 * Etapas (as mesmas do antigo `npm run build`):
 *   1. vite build
 *   2. esbuild server.ts -> dist/server.mjs
 *   3. esbuild .../runPlatformEntrypoint.ts -> dist/platform-preflight.mjs
 *   4. node scripts/check-no-dev-exposure.mjs
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const log = (message) => console.log(`[build] ${message}`);

/** Versão do esbuild instalada, para escolher o binário correspondente no store do pnpm. */
const esbuildVersion = () => {
  try {
    return JSON.parse(readFileSync(path.join(root, 'node_modules', 'esbuild', 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
};

/** Localiza o esbuild.exe da plataforma atual (install direto ou via pnpm). */
const findEsbuildBinary = () => {
  if (!isWindows) return null;

  const arch = process.arch === 'ia32' ? 'ia32' : process.arch === 'arm64' ? 'arm64' : 'x64';
  const packageName = `win32-${arch}`;
  const direct = path.join(root, 'node_modules', '@esbuild', packageName, 'esbuild.exe');
  if (existsSync(direct)) return direct;

  const storeRoot = path.join(root, 'node_modules', '.pnpm');
  if (!existsSync(storeRoot)) return null;

  const prefix = `@esbuild+${packageName}@`;
  const version = esbuildVersion();
  const candidates = readdirSync(storeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => ({
      version: entry.name.slice(prefix.length),
      binary: path.join(storeRoot, entry.name, 'node_modules', '@esbuild', packageName, 'esbuild.exe'),
    }))
    .filter((candidate) => existsSync(candidate.binary));

  return (candidates.find((candidate) => candidate.version === version) ?? candidates[0])?.binary ?? null;
};

/** Copia o esbuild.exe para um caminho curto; devolve a cópia ou `null` se não for preciso. */
const stageShortBinary = () => {
  if (!isWindows) return null;

  const source = findEsbuildBinary();
  if (!source) {
    log('aviso: binário do esbuild não encontrado; a correr o build sem workaround de caminho.');
    return null;
  }

  const target = path.join(tmpdir(), 'guigui-esbuild', 'esbuild.exe');
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    return target;
  } catch (error) {
    log(`aviso: não foi possível copiar o esbuild (${error.message}); a continuar sem workaround.`);
    return null;
  }
};

const stagedBinary = stageShortBinary();
const env = { ...process.env };
if (stagedBinary) {
  env.ESBUILD_BINARY_PATH = stagedBinary;
  log(`esbuild via caminho curto: ${stagedBinary}`);
}

const cleanup = () => {
  if (!stagedBinary) return;
  try {
    rmSync(path.dirname(stagedBinary), { recursive: true, force: true });
  } catch {
    // A cópia é temporária; se ficar bloqueada, o sistema limpa-a depois.
  }
};

const esbuild = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const steps = [
  ['vite build', path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), ['build']],
  ['dist/server.mjs', esbuild, ['server.ts', '--bundle', '--platform=node', '--format=esm', '--packages=external', '--outfile=dist/server.mjs']],
  [
    'dist/platform-preflight.mjs',
    esbuild,
    [
      'server/modules/platform-foundation/hosting/runPlatformEntrypoint.ts',
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--packages=external',
      '--outfile=dist/platform-preflight.mjs',
    ],
  ],
  ['check-no-dev-exposure', path.join(root, 'scripts', 'check-no-dev-exposure.mjs'), []],
];

for (const [label, script, args] of steps) {
  log(label);
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    cleanup();
    console.error(`[build] falhou em ${label}: ${result.error?.message ?? `código ${result.status}`}`);
    process.exit(result.status || 1);
  }
}

cleanup();
log('build concluído');
