#!/usr/bin/env tsx
import { Pool } from 'pg';
import path from 'node:path';
import { applyPendingMigrations } from '../server/postgresMigrationRunner';
import { assertMigrationTarget, resolveMigrationTarget } from './migrationTarget';

async function main(): Promise<void> {
  const target = resolveMigrationTarget(process.env, process.argv.slice(2));
  const pool = new Pool({ connectionString: target.connectionString });

  try {
    const targetResult = await pool.query<{ database_name: string }>(
      'SELECT current_database() AS database_name',
    );
    assertMigrationTarget(targetResult.rows[0]?.database_name, target.confirmTarget);

    const migrations = await applyPendingMigrations(
      pool,
      path.resolve(process.cwd(), 'db', 'migrations'),
    );
    console.log(JSON.stringify(migrations));
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown_error';
  console.error('[db:migrate] Migration failed:', message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]'));
  process.exitCode = 1;
});
