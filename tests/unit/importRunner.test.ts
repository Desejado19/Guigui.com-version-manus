import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import {
  parseImportArguments,
  runImport,
  runImportFromCli,
} from '../../scripts/importRunner';

const { poolConstructor } = vi.hoisted(() => ({
  poolConstructor: vi.fn(),
}));

vi.mock('pg', () => ({ Pool: poolConstructor }));

type ImportRecord = { id: string; valid: boolean };

function createPool(databaseName = 'guigui_synthetic_test') {
  const client = {
    query: vi.fn(async (sql: string) => (
      sql.toLowerCase().includes('current_database')
        ? { rows: [{ database_name: databaseName }] }
        : { rows: [] }
    )),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn(async () => client),
    end: vi.fn(async () => undefined),
  };
  poolConstructor.mockImplementation(function () {
    return pool;
  });
  return { pool, client, instance: new Pool() };
}

function createOptions(
  records: ImportRecord[],
  write: (record: ImportRecord) => Promise<void>,
  conflicts: Set<string> = new Set(),
) {
  return {
    label: 'synthetic records',
    records,
    recordKey: (record: ImportRecord) => record.id,
    validateRecord: (record: ImportRecord) => Boolean(record.id.trim()) && record.valid,
    hasConflict: async (record: ImportRecord) => conflicts.has(record.id),
    importRecord: write,
  };
}

const originalImportDatabaseUrl = process.env.IMPORT_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  process.env.IMPORT_DATABASE_URL = 'postgres://synthetic@127.0.0.1/guigui_synthetic_test';
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  vi.clearAllMocks();
  if (originalImportDatabaseUrl === undefined) delete process.env.IMPORT_DATABASE_URL;
  else process.env.IMPORT_DATABASE_URL = originalImportDatabaseUrl;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('runImport', () => {
  it('defaults to preview-only and returns record counts', async () => {
    createPool();
    const writes: string[] = [];
    const summary = await runImport(createOptions([
      { id: 'accepted', valid: true },
      { id: 'rejected', valid: false },
      { id: 'conflict', valid: true },
    ], async (record) => { writes.push(record.id); }, new Set(['conflict'])));

    expect(summary).toEqual({
      mode: 'dry-run',
      sourceCount: 3,
      acceptedCount: 1,
      rejectedCount: 1,
      conflictCount: 1,
      writtenCount: 0,
    });

    expect(writes).toEqual([]);
  });

  it('does not write records during an explicit dry run', async () => {
    createPool();
    const write = vi.fn(async () => undefined);

    await runImport(createOptions([{ id: 'record-1', valid: true }], write), 'dry-run');

    expect(write).not.toHaveBeenCalled();
  });

  it('requires a target that exactly matches the apply confirmation', async () => {
    createPool();
    const write = vi.fn(async () => undefined);
    const options = {
      ...createOptions([{ id: 'record-1', valid: true }], write),
      confirmTarget: 'different_database',
    };

    await expect(runImport(options, 'apply')).rejects.toThrow(/does not match the connected database/i);
    expect(write).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before applying', async () => {
    createPool();
    const write = vi.fn(async () => undefined);

    await expect(runImport(createOptions(
      [{ id: 'record-1', valid: true }],
      write,
    ), 'apply')).rejects.toThrow(/--confirm-target/i);
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses to inherit DATABASE_URL when IMPORT_DATABASE_URL is missing', async () => {
    delete process.env.IMPORT_DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://synthetic@127.0.0.1/guigui_synthetic_test';

    await expect(runImport(createOptions([], async () => undefined)))
      .rejects.toThrow(/IMPORT_DATABASE_URL/i);

    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it('keeps repeated apply idempotent when an imported record is already present', async () => {
    const existing = new Set<string>();
    const writes: string[] = [];
    const record = { id: 'record-1', valid: true };
    const options = createOptions([record], async (value) => {
      writes.push(value.id);
      existing.add(value.id);
    }, existing);

    createPool();
    const first = await runImport({ ...options, confirmTarget: 'guigui_synthetic_test' }, 'apply');
    createPool();
    const second = await runImport({ ...options, confirmTarget: 'guigui_synthetic_test' }, 'apply');

    expect(first.writtenCount).toBe(1);
    expect(second).toMatchObject({ acceptedCount: 0, conflictCount: 1, writtenCount: 0 });
    expect(writes).toEqual(['record-1']);
  });

  it('preserves rows that are not part of the import source', async () => {
    createPool();
    const rows = new Map([['unowned-row', 'keep'], ['imported-row', 'old']]);
    const options = createOptions([{ id: 'new-row', valid: true }], async (record) => {
      rows.set(record.id, 'new');
    });

    await runImport({ ...options, confirmTarget: 'guigui_synthetic_test' }, 'apply');

    expect([...rows.entries()]).toEqual([
      ['unowned-row', 'keep'],
      ['imported-row', 'old'],
      ['new-row', 'new'],
    ]);
  });
});

describe('import CLI', () => {
  it('defaults CLI imports to preview-only', () => {
    expect(parseImportArguments([])).toEqual({ mode: 'dry-run', confirmTarget: undefined });
  });

  describe('runImportFromCli', () => {
    it('redacts connection strings from import failures', async () => {
      createPool();
      const connectionString = 'postgres://synthetic:do-not-leak@127.0.0.1/guigui_synthetic_test';
      const options = {
        ...createOptions([{ id: 'record-1', valid: true }], async () => undefined),
        hasConflict: async () => {
          throw new Error(`Unable to inspect ${connectionString}`);
        },
      };

      await expect(runImportFromCli(options, []))
        .rejects.toThrow('Unable to inspect [redacted]');
    });
  });

  it('accepts an explicit apply mode and target confirmation', () => {
    expect(parseImportArguments(['--apply', '--confirm-target', 'guigui_synthetic_test']))
      .toEqual({ mode: 'apply', confirmTarget: 'guigui_synthetic_test' });
  });

  it('rejects conflicting modes and unknown options', () => {
    expect(() => parseImportArguments(['--apply', '--dry-run'])).toThrow(/only one import mode/i);
    expect(() => parseImportArguments(['--force'])).toThrow(/unknown import option/i);
  });
});
