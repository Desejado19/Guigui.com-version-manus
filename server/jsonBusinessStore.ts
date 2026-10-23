import type { Business } from '../src/types';
import { loadJsonStrict, saveJson } from './runtimeStore';

export function listJsonBusinesses<T = Business>(): T[] {
  const records = loadJsonStrict<unknown>('businesses.json', []);
  if (!Array.isArray(records)) {
    throw new TypeError('Invalid business collection in businesses.json');
  }
  return records as T[];
}

export function saveJsonBusinesses<T>(businesses: T[]): void {
  saveJson('businesses.json', businesses);
}
