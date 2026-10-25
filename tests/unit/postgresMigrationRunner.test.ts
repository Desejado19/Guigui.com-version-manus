import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { applyPendingMigrations } from '../../server/postgresMigrationRunner';

const { poolConstructor } = vi.hoisted(() => ({
  poolConstructor: vi.fn(),
}));

vi.mock('pg', () => ({ Pool: poolConstructor }));

type MigrationRow = { filename: string; checksum: string };

function createMigrationPool(initialTables: string[] = []) {
  const state = {
    ledgerExists: false,
    ledger: new Map<string, string>(),
    tables: new Set(initialTables),
    migrationExecutions: [] as string[],
    activeMigrations: 0,
    maxActiveMigrations: 0,
    lockTail: Promise.resolve(),
  };

  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      const normalized = sql.trim().toLowerCase();

      if (normalized.includes('pg_advisory_lock')) {
        const previous = state.lockTail;
        let releaseCurrent = () => undefined;
        state.lockTail = new Promise<void>((resolve) => {
          releaseCurrent = resolve;
        });
        await previous;
        client.releaseLock = releaseCurrent;
        return { rows: [] };
      }
      if (normalized.includes('pg_advisory_unlock')) {
        client.releaseLock();
        client.releaseLock = () => undefined;
        return { rows: [] };
      }
      if (normalized.includes('to_regclass')) {
        return { rows: [{ migration_table: state.ledgerExists }] };
      }
      if (normalized.includes('information_schema.tables')) {
        return { rows: [...state.tables].map((table_name) => ({ table_name })) };
      }
      if (normalized.startsWith('create table')) {
        state.ledgerExists = true;
        state.tables.add('guigui_schema_migrations');
        return { rows: [] };
      }
      if (normalized.includes('from public.guigui_schema_migrations')) {
        return {
          rows: [...state.ledger].map(([filename, checksum]) => ({ filename, checksum })) as MigrationRow[],
        };
      }
      if (normalized === 'begin') return { rows: [] };
      if (normalized === 'commit') return { rows: [] };
      if (normalized === 'rollback') return { rows: [] };
      if (normalized.startsWith('insert into public.guigui_schema_migrations')) {
        state.ledger.set(String(values?.[0]), String(values?.[1]));
        return { rows: [] };
      }
      if (sql.includes('FAIL_MIGRATION')) throw new Error('synthetic migration failure');

      state.migrationExecutions.push(sql);
      state.activeMigrations += 1;
      state.maxActiveMigrations = Math.max(
        state.maxActiveMigrations,
        state.activeMigrations,
      );
      if (sql.includes('SLOW_MIGRATION')) {
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      state.activeMigrations -= 1;
      return { rows: [] };
    }),
    release: vi.fn(),
    releaseLock: () => undefined,
  };
  const pool = {
    connect: vi.fn(async () => client),
  };
  poolConstructor.mockImplementation(function () {
    return pool;
  });
  return { pool: new Pool(), client, state };
}

const temporaryDirectories: string[] = [];

function createMigrations(files: Record<string, string>): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-migrations-'));
  temporaryDirectories.push(directory);
  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, filename), contents, 'utf8');
  }
  return directory;
}

afterEach(() => {
  vi.clearAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('applyPendingMigrations', () => {
  it('applies pending migrations in deterministic filename order', async () => {
    const { pool, state } = createMigrationPool();
    const directory = createMigrations({
      '002_second.sql': 'SELECT 2;',
      '001_first.sql': 'SELECT 1;',
    });

    const result = await applyPendingMigrations(pool, directory);

    expect(result.map(({ filename, status }) => [filename, status])).toEqual([
      ['001_first.sql', 'applied'],
      ['002_second.sql', 'applied'],
    ]);
    expect(result.every(({ checksum }) => /^[a-f0-9]{64}$/.test(checksum))).toBe(true);
    expect(state.migrationExecutions).toEqual(['SELECT 1;', 'SELECT 2;']);
    expect(state.ledger.size).toBe(2);
  });

  it('does not reapply a migration with a matching checksum', async () => {
    const { pool, state } = createMigrationPool();
    const directory = createMigrations({ '001_first.sql': 'SELECT 1;' });

    await applyPendingMigrations(pool, directory);
    const repeated = await applyPendingMigrations(pool, directory);

    expect(repeated).toMatchObject([
      { filename: '001_first.sql', status: 'already_applied' },
    ]);
    expect(state.migrationExecutions).toEqual(['SELECT 1;']);
  });

  it('applies new migrations to a previously supported schema', async () => {
    const { pool, state } = createMigrationPool();
    const directory = createMigrations({ '001_supported.sql': 'SELECT 1;' });

    await applyPendingMigrations(pool, directory);
    state.tables.add('users');
    fs.writeFileSync(path.join(directory, '002_next.sql'), 'SELECT 2;', 'utf8');

    const result = await applyPendingMigrations(pool, directory);

    expect(result).toMatchObject([
      { filename: '001_supported.sql', status: 'already_applied' },
      { filename: '002_next.sql', status: 'applied' },
    ]);
    expect(state.migrationExecutions).toEqual(['SELECT 1;', 'SELECT 2;']);
  });

  it('rejects a changed migration that is already recorded', async () => {
    const { pool } = createMigrationPool();
    const directory = createMigrations({ '001_first.sql': 'SELECT 1;' });
    await applyPendingMigrations(pool, directory);
    fs.writeFileSync(path.join(directory, '001_first.sql'), 'SELECT 2;', 'utf8');

    await expect(applyPendingMigrations(pool, directory))
      .rejects.toThrow(/checksum mismatch/i);
  });

  it('rejects a recorded migration that is missing from the current migration directory', async () => {
    const { pool } = createMigrationPool();
    const directory = createMigrations({ '001_first.sql': 'SELECT 1;' });
    await applyPendingMigrations(pool, directory);
    fs.rmSync(path.join(directory, '001_first.sql'));

    await expect(applyPendingMigrations(pool, directory))
      .rejects.toThrow(/recorded migration.*missing/i);
  });

  it('rolls back a migration that fails before its ledger entry commits', async () => {
    const { pool, client, state } = createMigrationPool();
    const directory = createMigrations({ '001_first.sql': 'FAIL_MIGRATION' });

    await expect(applyPendingMigrations(pool, directory))
      .rejects.toThrow('synthetic migration failure');

    expect(state.ledger.size).toBe(0);
    expect(state.migrationExecutions).toEqual([]);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('serializes concurrent migration runs under the advisory lock', async () => {
    const { pool, state } = createMigrationPool();
    const directory = createMigrations({ '001_slow.sql': 'SLOW_MIGRATION' });

    const results = await Promise.all([
      applyPendingMigrations(pool, directory),
      applyPendingMigrations(pool, directory),
    ]);

    expect(state.maxActiveMigrations).toBe(1);
    expect(state.migrationExecutions).toHaveLength(1);
    expect(results.flat().map(({ status }) => status).sort()).toEqual([
      'already_applied',
      'applied',
    ]);
  });

  it('rejects an existing schema without a migration ledger', async () => {
    const { pool, state } = createMigrationPool(['users']);
    const directory = createMigrations({ '001_first.sql': 'SELECT 1;' });

    await expect(applyPendingMigrations(pool, directory))
      .rejects.toThrow(/untracked schema/i);

    expect(state.ledgerExists).toBe(false);
    expect(state.migrationExecutions).toEqual([]);
  });
});
