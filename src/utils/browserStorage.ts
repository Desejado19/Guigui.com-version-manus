import { reportStorageIssue } from './storageMonitor';

/**
 * Camada única de cache local do browser.
 *
 * - localStorage: apenas preferências pequenas (ver isLargeStateKey).
 * - IndexedDB: colecções, caches offline e dados que podem crescer.
 *
 * O objectivo é impedir que uma colecção completa volte a esgotar a quota do
 * localStorage. Os dados antigos em localStorage são migrados na primeira
 * leitura e só são removidos depois de a escrita em IndexedDB ter sucesso.
 */

const DB_NAME = 'guigui-browser-cache';
const DB_VERSION = 1;
const STORE_NAME = 'state';
export const COLLECTION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Chaves que guardam colecções/estado potencialmente grande.
const LARGE_STATE_KEYS = new Set([
  'guigui_events',
  'guigui_businesses',
  'guigui_system_notifications',
  'guigui_purchase_orders',
  'guigui_user_posts',
  'guigui_promotions',
  'guigui_stories',
  'guigui_subscription_plans',
  'guigui_monetization_catalog',
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
  'guigui_admin_category_groups',
  'guigui_admin_price_audit_logs',
  'guigui_subscription_features',
  'guigui_feature_catalog',
  'guigui_subscription_plan_versions',
  'guigui_monetization_ledger',
  'guigui_admin_content_sections',
  'guigui_published_content_translations_v1',
  'guigui_sms_history',
  'guigui_audit_logs',
  'guigui_admin_staff',
  'guigui_event_reminders',
  'guigui_plans_content',
  'guigui_about_content',
  'guigui_faq_content',
  'guigui_terms_content',
]);

const LARGE_STATE_PREFIXES = [
  'guigui_marketing_campaigns_',
  'guigui_marketing_segments_',
  'guigui_business_team_',
  'guigui_business_team_audit_',
  'guigui_business_staff_',
  'guigui_scanner_manifest_',
  'guigui_scanner_offline_queue_',
  'guigui_export_history_',
  'guigui:pending:',
];

export function isLargeStateKey(key: string): boolean {
  return LARGE_STATE_KEYS.has(key) || LARGE_STATE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

interface CacheRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
  expiresAt?: number;
  bytes: number;
  pending?: boolean;
}

export interface CacheReadResult<T> {
  found: boolean;
  value?: T;
  updatedAt?: number;
  /** Alteração local ainda não confirmada pelo servidor. */
  pending?: boolean;
}

export interface CacheWriteOptions {
  /** Tempo de vida do cache; omitido = sem expiração. */
  ttlMs?: number;
  /** Marca uma alteração local ainda por confirmar no servidor. */
  pending?: boolean;
}

let databasePromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reportStorageIssue('indexeddb_unavailable', DB_NAME, error);
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reportStorageIssue('indexeddb_unavailable', DB_NAME, request.error);
      resolve(null);
    };
    request.onblocked = () => {
      reportStorageIssue('indexeddb_unavailable', DB_NAME, new Error('IndexedDB bloqueado por outra janela.'));
      resolve(null);
    };
  });
  return databasePromise;
}

function estimateBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value) ?? '']).size;
  } catch {
    return 0;
  }
}

async function getRecord<T>(key: string): Promise<CacheRecord<T> | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CacheRecord<T> | undefined) ?? null);
      request.onerror = () => {
        reportStorageIssue('read_failed', key, request.error);
        resolve(null);
      };
    } catch (error) {
      reportStorageIssue('read_failed', key, error);
      resolve(null);
    }
  });
}

export async function readCachedValue<T>(key: string): Promise<CacheReadResult<T>> {
  const record = await getRecord<T>(key);
  if (!record) return { found: false };
  if (record.expiresAt && record.expiresAt <= Date.now()) {
    await deleteCachedValue(key);
    reportStorageIssue('cache_expired', key, new Error('Cache expirado.'));
    return { found: false };
  }
  return { found: true, value: record.value, updatedAt: record.updatedAt, pending: Boolean(record.pending) };
}

export async function writeCachedValue<T>(
  key: string,
  value: T,
  options: CacheWriteOptions = {},
): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    // Browser sem IndexedDB: mantém um fallback funcional, mas registado.
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      reportStorageIssue('quota_exceeded', key, error);
    }
    return;
  }
  const record: CacheRecord<T> & { pending?: boolean } = {
    key,
    value,
    updatedAt: Date.now(),
    bytes: estimateBytes(value),
    ...(options.ttlMs ? { expiresAt: Date.now() + options.ttlMs } : {}),
    ...(options.pending ? { pending: true } : {}),
  };
  if (!options.pending) delete record.pending;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transacção IndexedDB abortada.'));
    });
    // Escrita confirmada: a cópia antiga no localStorage é apenas desperdício
    // de quota e passa a estar desactualizada. Removê-la é seguro porque a
    // fonte de verdade é IndexedDB/servidor, não este duplicado.
    try {
      if (window.localStorage.getItem(key) !== null) window.localStorage.removeItem(key);
    } catch {
      // Sem permissão para limpar: o valor antigo fica, mas já não é escrito.
    }
  } catch (error) {
    reportStorageIssue('write_failed', key, error);
  }
}

export async function deleteCachedValue(key: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        reportStorageIssue('write_failed', key, transaction.error);
        resolve();
      };
    } catch (error) {
      reportStorageIssue('write_failed', key, error);
      resolve();
    }
  });
}

/**
 * Lê o cache IndexedDB. Se ainda não existir, migra uma vez o valor legado do
 * localStorage e só então remove a chave antiga. Uma falha de IndexedDB preserva
 * sempre o valor antigo para não perder dados.
 */
export async function readOrMigrateCachedValue<T>(key: string): Promise<CacheReadResult<T>> {
  if (typeof indexedDB === 'undefined') {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? { found: true, value: JSON.parse(raw) as T } : { found: false };
    } catch {
      return { found: false };
    }
  }
  const cached = await readCachedValue<T>(key);
  if (cached.found || typeof window === 'undefined') return cached;

  let legacy: T | undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { found: false };
    legacy = JSON.parse(raw) as T;
  } catch {
    return { found: false };
  }

  await writeCachedValue(key, legacy, { ttlMs: COLLECTION_CACHE_TTL_MS });
  const written = await readCachedValue<T>(key);
  if (written.found) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Sem permissão para limpar: a migração já está concluída.
    }
  }
  return written;
}

export interface BrowserStorageReport {
  indexedDb: { available: boolean; entries: Array<{ key: string; bytes: number; updatedAt: number }>; totalBytes: number };
  localStorage: { entries: Array<{ key: string; bytes: number; large: boolean }>; totalBytes: number };
  quota?: { usage?: number; quota?: number };
  issues: number;
}

export async function getBrowserStorageReport(): Promise<BrowserStorageReport> {
  const database = await openDatabase();
  const entries: Array<{ key: string; bytes: number; updatedAt: number }> = [];
  if (database) {
    await new Promise<void>((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          const record = cursor.value as CacheRecord;
          entries.push({ key: record.key, bytes: record.bytes || 0, updatedAt: record.updatedAt });
          cursor.continue();
        };
        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  const localEntries: Array<{ key: string; bytes: number; large: boolean }> = [];
  if (typeof window !== 'undefined') {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        const value = window.localStorage.getItem(key) || '';
        localEntries.push({ key, bytes: new Blob([value]).size, large: isLargeStateKey(key) });
      }
    } catch {
      // Diagnóstico opcional.
    }
  }

  let quota: BrowserStorageReport['quota'];
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate) quota = { usage: estimate.usage, quota: estimate.quota };
  } catch {
    // Navigator sem estimativa de armazenamento.
  }

  return {
    indexedDb: {
      available: Boolean(database),
      entries: entries.sort((left, right) => right.bytes - left.bytes),
      totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    },
    localStorage: {
      entries: localEntries.sort((left, right) => right.bytes - left.bytes),
      totalBytes: localEntries.reduce((total, entry) => total + entry.bytes, 0),
    },
    quota,
    issues: (await import('./storageMonitor')).getStorageIssues().length,
  };
}

// Diagnóstico acessível na consola do browser sem expor valores guardados.
if (typeof window !== 'undefined') {
  (window as Window & { guiguiStorageReport?: () => Promise<BrowserStorageReport> }).guiguiStorageReport = getBrowserStorageReport;
}
