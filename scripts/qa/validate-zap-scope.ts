import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRunningTarget } from './assert-running-target';

export type ZapMode = 'baseline' | 'passive';

export function validateZapScope(baseUrl: string, mode: ZapMode): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('QA_BASE_URL must be the approved local ZAP origin.');
  }

  if (url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port !== '4313'
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash) {
    throw new Error('QA_BASE_URL must be the approved local ZAP origin.');
  }
  if (mode !== 'baseline' && mode !== 'passive') {
    throw new Error('ZAP mode must be baseline or passive; active scanning is prohibited.');
  }
}

const invokedScript = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedScript === fileURLToPath(import.meta.url).toLowerCase()) {
  const baseUrl = process.argv[2] ?? '';
  const mode = process.argv[3];
  const healthCheck = process.argv[4];
  if (mode !== 'baseline' && mode !== 'passive') {
    throw new Error('ZAP mode must be baseline or passive; active scanning is prohibited.');
  }
  if (healthCheck !== undefined && healthCheck !== '--check-health') {
    throw new Error('Unexpected ZAP scope-validator option.');
  }
  validateZapScope(baseUrl, mode);
  if (healthCheck === '--check-health') {
    await assertRunningTarget(baseUrl);
  }
}
