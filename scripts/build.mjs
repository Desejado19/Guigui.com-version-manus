#!/usr/bin/env node
/**
 * Build de produção do Guigui.com.
 *
 * Antes de correr o build, `stageEsbuildBinary` copia o esbuild.exe para um
 * caminho curto no Windows (o caminho do projeto excede o limite do `spawn`) e
 * devolve o env com `ESBUILD_BINARY_PATH`.
 *
 * Etapas (as mesmas do antigo `npm run build`):
 *   1. vite build
 *   2. esbuild server.ts -> dist/server.mjs
 *   3. esbuild .../runPlatformEntrypoint.ts -> dist/platform-preflight.mjs
 *   4. node scripts/check-no-dev-exposure.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageEsbuildBinary } from './lib/esbuild-binary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (message) => console.log(`[build] ${message}`);

const { env, cleanup } = stageEsbuildBinary(root, { log });

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
