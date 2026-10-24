import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertQaTarget, buildQaDatabaseUrl, parseQaTarget } from './validate-target';
import type { QaTarget } from './validate-target';

export async function provisionQaDatabase(
  target: QaTarget,
  adminConnectionString: string,
): Promise<void> {
  assertQaTarget(target);
  const qaConnectionString = buildQaDatabaseUrl(adminConnectionString, target.databaseName);
  const adminPool = new Pool({ connectionString: adminConnectionString });
  try {
    const version = await adminPool.query<{ server_version_num: string }>(
      "SELECT current_setting('server_version_num') AS server_version_num",
    );
    const versionNumber = Number(version.rows[0]?.server_version_num);
    if (!Number.isInteger(versionNumber) || Math.floor(versionNumber / 10000) !== 18) {
      throw new Error('QA provisioning requires PostgreSQL 18.');
    }

    const existing = await adminPool.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [target.databaseName],
    );
    if (existing.rows[0]?.exists) {
      throw new Error(`QA database ${target.databaseName} already exists; refusing to reuse it.`);
    }

    await adminPool.query(`CREATE DATABASE "${target.databaseName}"`);
  } finally {
    await adminPool.end();
  }

  const qaPool = new Pool({
    connectionString: qaConnectionString,
  });
  try {
    const migrationDirectory = path.resolve(process.cwd(), 'db', 'migrations');
    const migrations = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (migrations.length === 0) {
      throw new Error('No SQL migrations were found for the QA database.');
    }

    for (const file of migrations) {
      const sql = await readFile(path.join(migrationDirectory, file), 'utf8');
      await qaPool.query(sql);
    }
  } finally {
    await qaPool.end();
  }
}

async function main(): Promise<void> {
  const target = parseQaTarget(process.env);
  const connectionString = process.env.QA_ADMIN_DATABASE_URL?.trim();
  if (!connectionString) throw new Error('QA_ADMIN_DATABASE_URL is required for local QA provisioning.');

  await provisionQaDatabase(target, connectionString);
  console.log(`Created and migrated new PostgreSQL 18 QA database ${target.databaseName}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(
      '[qa:provision] Failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
