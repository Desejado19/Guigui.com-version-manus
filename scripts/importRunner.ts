import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

/**
 * Shared import runner for the `scripts/import-*-postgres.ts` migrations.
 *
 * Every importer follows the same shape: validate DATABASE_URL, build a Pool,
 * loop over records issuing `pool.query`, log a summary, and always close the
 * pool. This helper centralises that lifecycle so each script only supplies its
 * entity-specific config (source, summary, and the per-record work).
 */

export type ImportPool = Pool;

export interface ImportRunOptions<T> {
  /** Human-readable dependency name used in the "DATABASE_URL é obrigatória" error. */
  label: string;
  /** Records loaded from the snapshot, in insertion order. */
  records: T[];
  /** Log line emitted once all records are imported. */
  summary: (pool: Pool, records: T[]) => string | Promise<string>;
  /** Per-record work. Runs sequentially so imports stay deterministic. */
  importRecord: (record: T, pool: Pool, index: number) => Promise<void>;
}

/**
 * Resolves and validates DATABASE_URL, throwing the project-standard message
 * when it is missing.
 */
export function requireDatabaseUrl(label: string): string {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error(`DATABASE_URL é obrigatória para importar ${label}.`);
  return connectionString;
}

/** Resolves the directory that holds the JSON snapshots. */
export function resolveDataDirectory(): string {
  return process.env.GUIGUI_DATA_DIR || 'data';
}

/**
 * Reads and parses a JSON snapshot from the data directory.
 * Returns the fallback when the file does not exist.
 */
export function readSnapshot<T>(fileName: string, fallback?: T): T {
  const sourcePath = path.resolve(resolveDataDirectory(), fileName);
  if (!fs.existsSync(sourcePath)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Ficheiro de dados não encontrado: ${sourcePath}`);
  }
  return JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as T;
}

/**
 * Runs an import against PostgreSQL: opens a pool, imports each record in order,
 * logs the summary, and guarantees the pool is closed even on failure.
 */
export async function runImport<T>(options: ImportRunOptions<T>): Promise<void> {
  const connectionString = requireDatabaseUrl(options.label);
  const pool = new Pool({ connectionString });
  try {
    for (let index = 0; index < options.records.length; index += 1) {
      await options.importRecord(options.records[index], pool, index);
    }
    console.log(await options.summary(pool, options.records));
  } finally {
    await pool.end();
  }
}
