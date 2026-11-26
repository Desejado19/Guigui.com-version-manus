import fs from 'node:fs';

/**
 * Agrega a evidência real da suite de auditoria:
 * - `test-results/audit-report.jsonl` (dados gravados pelos próprios testes)
 * - `test-results/audit-run.log` (resultado do runner do Playwright)
 *
 * Uso: node scripts/audit-report-summary.mjs
 */

const reportPath = 'test-results/audit-report.jsonl';
const logPath = 'test-results/audit-run.log';

const entries = fs.existsSync(reportPath)
  ? fs.readFileSync(reportPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  : [];

const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

const passed = [...log.matchAll(/^\s+(\d+) passed/m)].map((match) => Number(match[1])).pop() ?? 0;
const failed = [...log.matchAll(/^\s+(\d+) failed/m)].map((match) => Number(match[1])).pop() ?? 0;
const skipped = [...log.matchAll(/^\s+(\d+) skipped/m)].map((match) => Number(match[1])).pop() ?? 0;
const didNotRun = [...log.matchAll(/^\s+(\d+) did not run/m)].map((match) => Number(match[1])).pop() ?? 0;

const failureLines = log
  .split('\n')
  .filter((line) => /^\s+\d+\)\s/.test(line))
  .map((line) => line.trim());

const byKind = entries.reduce((accumulator, entry) => {
  accumulator[entry.kind] = (accumulator[entry.kind] ?? 0) + 1;
  return accumulator;
}, {});

const sweeps = entries.filter((entry) => entry.kind === 'sidebar-sweep');
const overflow = entries.filter((entry) => /^responsive-/.test(entry.kind));

console.log('=== RESULTADO DO RUNNER ===');
console.log({ passed, failed, skipped, didNotRun });
console.log('\n=== FALHAS ===');
console.log(failureLines.length ? failureLines.join('\n') : 'nenhuma');
console.log('\n=== EVIDÊNCIA RECOLHIDA ===');
console.log(JSON.stringify({ byKind, sweeps, overflow }, null, 2));
