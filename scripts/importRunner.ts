import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';

export type ImportPool = Pick<PoolClient, 'query'>;
export type ImportMode = 'dry-run' | 'apply';
export type ImportSummary = {
  mode: ImportMode;
  sourceCount: number;
  acceptedCount: number;
  rejectedCount: number;
  conflictCount: number;
  writtenCount: number;
};

export interface ImportRunOptions<T> {
  /** Human-readable source name used in safe validation errors. */
  label: string;
  records: T[];
  recordKey: (record: T) => string;
  validateRecord: (record: T) => boolean;
  hasConflict: (record: T, pool: ImportPool) => Promise<boolean>;
  importRecord: (record: T, pool: ImportPool) => Promise<boolean | void>;
  confirmTarget?: string;
}

export function requireImportDatabaseUrl(label: string): string {
  const connectionString = process.env.IMPORT_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(`IMPORT_DATABASE_URL is required to preview or import ${label}.`);
  }
  return connectionString;
}

export function resolveDataDirectory(): string {
  return process.env.GUIGUI_DATA_DIR || 'data';
}

export function readSnapshot<T>(fileName: string, fallback?: T): T {
  const sourcePath = path.resolve(resolveDataDirectory(), fileName);
  if (!fs.existsSync(sourcePath)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Ficheiro de dados não encontrado: ${sourcePath}`);
  }
  return JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as T;
}

export function parseImportArguments(args: string[]): {
  mode: ImportMode;
  confirmTarget?: string;
} {
  let mode: ImportMode = 'dry-run';
  let explicitMode: ImportMode | undefined;
  let confirmTarget: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply' || argument === '--dry-run') {
      const nextMode = argument === '--apply' ? 'apply' : 'dry-run';
      if (explicitMode && explicitMode !== nextMode) {
        throw new Error('Choose only one import mode: --dry-run or --apply.');
      }
      explicitMode = nextMode;
      mode = nextMode;
      continue;
    }
    if (argument === '--confirm-target') {
      if (confirmTarget || !args[index + 1]?.trim()) {
        throw new Error('--confirm-target requires one database name.');
      }
      confirmTarget = args[index + 1].trim();
      index += 1;
      continue;
    }
    throw new Error('Unknown import option.');
  }

  return { mode, confirmTarget };
}

async function applyRecord<T>(
  record: T,
  client: PoolClient,
  importRecord: ImportRunOptions<T>['importRecord'],
): Promise<boolean | void> {
  await client.query('BEGIN');
  try {
    const written = await importRecord(record, client);
    await client.query('COMMIT');
    return written;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'Import record failed and its transaction could not be rolled back.',
      );
    }
    throw error;
  }
}

export async function runImport<T>(
  options: ImportRunOptions<T>,
  mode: ImportMode = 'dry-run',
): Promise<ImportSummary> {
  if (mode !== 'dry-run' && mode !== 'apply') {
    throw new Error('Import mode must be dry-run or apply.');
  }
  if (!Array.isArray(options.records)) {
    throw new Error(`The import source for ${options.label} must contain an array of records.`);
  }
  const connectionString = requireImportDatabaseUrl(options.label);
  const pool = new Pool({ connectionString });
  let client: PoolClient | undefined;
  let lockAcquired = false;
  try {
    client = await pool.connect();
    await client.query('SELECT pg_advisory_lock($1, $2)', [1196576845, 2]);
    lockAcquired = true;
    const targetResult = await client.query<{ database_name: string }>(
      'SELECT current_database() AS database_name',
    );
    const databaseName = targetResult.rows[0]?.database_name;
    if (!databaseName) {
      throw new Error('The PostgreSQL import target could not be identified.');
    }
    if (mode === 'apply') {
      if (!options.confirmTarget?.trim()) {
        throw new Error('--confirm-target <database-name> is required with --apply.');
      }
      if (options.confirmTarget.trim() !== databaseName) {
        throw new Error('The --confirm-target value does not match the connected database.');
      }
    }

    const summary: ImportSummary = {
      mode,
      sourceCount: options.records.length,
      acceptedCount: 0,
      rejectedCount: 0,
      conflictCount: 0,
      writtenCount: 0,
    };
    const seenKeys = new Set<string>();

    for (const record of options.records) {
      if (!options.validateRecord(record)) {
        summary.rejectedCount += 1;
        continue;
      }

      const key = options.recordKey(record).trim();
      if (!key) {
        summary.rejectedCount += 1;
        continue;
      }
      if (seenKeys.has(key)) {
        summary.conflictCount += 1;
        continue;
      }
      seenKeys.add(key);

      if (await options.hasConflict(record, client)) {
        summary.conflictCount += 1;
        continue;
      }

      if (mode === 'apply') {
        const written = await applyRecord(record, client, options.importRecord);
        if (written === false) {
          summary.conflictCount += 1;
          continue;
        }
        summary.writtenCount += 1;
      }
      summary.acceptedCount += 1;
    }

    return summary;
  } finally {
    try {
      try {
        if (lockAcquired) {
          await client?.query('SELECT pg_advisory_unlock($1, $2)', [1196576845, 2]);
        }
      } finally {
        client?.release();
      }
    } finally {
      await pool.end();
    }
  }
}

export async function runImportFromCli<T>(
  options: ImportRunOptions<T>,
  args = process.argv.slice(2),
): Promise<ImportSummary> {
  try {
    const parsed = parseImportArguments(args);
    const summary = await runImport(
      { ...options, confirmTarget: parsed.confirmTarget },
      parsed.mode,
    );
    console.log(JSON.stringify(summary));
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown import failure.';
    throw new Error(message.replace(/(?:postgres|postgresql):\/\/[^\s"'<>]+/gi, '[redacted]'));
  }
}
