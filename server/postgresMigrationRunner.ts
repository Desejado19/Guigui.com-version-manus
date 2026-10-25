import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';

export type MigrationSummary = {
  filename: string;
  checksum: string;
  status: 'applied' | 'already_applied';
};

const MIGRATION_TABLE = 'guigui_schema_migrations';
const ADVISORY_LOCK_KEYS = [1196576845, 1] as const;

export async function applyPendingMigrations(
  pool: Pool,
  migrationsDirectory: string,
): Promise<MigrationSummary[]> {
  const files = fs.readdirSync(migrationsDirectory)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [...ADVISORY_LOCK_KEYS]);
    lockAcquired = true;

    const tableResult = await client.query<{ migration_table: string | null }>(
      `SELECT to_regclass('public.${MIGRATION_TABLE}') AS migration_table`,
    );
    const ledgerExists = Boolean(tableResult.rows[0]?.migration_table);
    const recordedResult = ledgerExists
      ? await client.query<{ filename: string; checksum: string }>(
        `SELECT filename, checksum FROM public.${MIGRATION_TABLE}`,
      )
      : { rows: [] };
    const recorded = new Map<string, string>();
    for (const { filename, checksum } of recordedResult.rows) {
      recorded.set(filename, checksum);
    }
    const existingTablesResult = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'`,
    );
    const existingTables = existingTablesResult.rows
      .map(({ table_name }) => table_name)
      .filter((tableName) => tableName !== MIGRATION_TABLE);

    if (existingTables.length > 0 && (!ledgerExists || recorded.size === 0)) {
      throw new Error(
        'Untracked schema detected without recorded migrations; operator review is required.',
      );
    }

    const migrationFileNames = new Set(files);
    for (const filename of recorded.keys()) {
      if (!migrationFileNames.has(filename)) {
        throw new Error(`Recorded migration ${filename} is missing from the migration directory.`);
      }
    }

    if (!ledgerExists) {
      await client.query(
        `CREATE TABLE public.${MIGRATION_TABLE} (
          filename TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
      );
    }

    const summaries: MigrationSummary[] = [];
    for (const filename of files) {
      const contents = fs.readFileSync(path.join(migrationsDirectory, filename), 'utf8');
      const checksum = createHash('sha256').update(contents).digest('hex');
      const appliedChecksum = recorded.get(filename);

      if (appliedChecksum !== undefined) {
        if (appliedChecksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${filename}.`);
        }
        summaries.push({ filename, checksum, status: 'already_applied' });
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(contents);
        await client.query(
          `INSERT INTO public.${MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2)`,
          [filename, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `Migration ${filename} failed and its transaction could not be rolled back.`,
          );
        }
        throw error;
      }

      recorded.set(filename, checksum);
      summaries.push({ filename, checksum, status: 'applied' });
    }

    return summaries;
  } finally {
    try {
      if (lockAcquired) {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [...ADVISORY_LOCK_KEYS]);
      }
    } finally {
      client.release();
    }
  }
}
