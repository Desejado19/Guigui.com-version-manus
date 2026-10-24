import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRunningTarget } from './assert-running-target';
import { loadK6Config, validateK6Config } from './validate-k6-config';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function main(): Promise<void> {
  const target = process.env.QA_BASE_URL?.trim();
  if (!target) {
    throw new Error('QA_BASE_URL must be set to the approved local QA origin before k6 runs.');
  }

  const config = loadK6Config();
  validateK6Config(target, config.options, config.endpoints);
  await assertRunningTarget(target);

  const outputDirectory = resolve(projectRoot, '.local-qa', 'k6');
  mkdirSync(outputDirectory, { recursive: true });

  const result = spawnSync('k6', [
    'run',
    '--env',
    `QA_BASE_URL=${target}`,
    '--summary-export',
    resolve(outputDirectory, 'summary.json'),
    'tests/load/guigui-readonly.js',
  ], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new Error(`Unable to start k6: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`k6 terminated by signal ${result.signal}.`);
  }
  process.exitCode = result.status ?? 1;
}

await main();
