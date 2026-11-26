import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyPendingMigrations,
  checksumOf,
  CREATE_SCHEMA_MIGRATIONS_TABLE,
  describeSchemaStatus,
  readMigrationFiles,
  readSchemaStatus,
  SchemaOutOfDateError,
  type SchemaQueryable,
} from '../../server/schemaVersion';

interface FakeDatabase {
  client: SchemaQueryable;
  statements: string[];
  records: Map<string, string>;
  evaluates: string[];
}

function createFakeDatabase(initial: Record<string, string> = {}): FakeDatabase {
  const records = new Map(Object.entries(initial));
  const statements: string[] = [];
  const evaluates: string[] = [];
  const client: SchemaQueryable = {
    async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]) {
      const trimmed = sql.trim();
      statements.push(trimmed);
      if (trimmed.includes('to_regclass')) {
        return { rows: [{ present: true }] as unknown as T[] };
      }
      if (trimmed.startsWith('SELECT filename, checksum')) {
        return {
          rows: [...records.entries()].map(([filename, checksum]) => ({ filename, checksum })) as unknown as T[],
        };
      }
      if (trimmed.startsWith('INSERT INTO guigui_schema_migrations')) {
        records.set(String(params?.[0]), String(params?.[1]));
        return { rows: [] as T[] };
      }
      if (trimmed.startsWith('DELETE FROM guigui_schema_migrations')) {
        records.delete(String(params?.[0]));
        return { rows: [] as T[] };
      }
      if (trimmed.startsWith('CREATE TABLE IF NOT EXISTS guigui_schema_migrations')) {
        return { rows: [] as T[] };
      }
      evaluates.push(trimmed);
      return { rows: [] as T[] };
    },
  };
  return { client, statements, records, evaluates };
}

describe('schemaVersion', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'guigui-schema-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function writeMigration(name: string, sql: string) {
    writeFileSync(join(directory, name), sql, 'utf8');
  }

  it('resume o conteúdo do ficheiro num SHA-256 estável', () => {
    expect(checksumOf('SELECT 1;')).toBe(checksumOf('SELECT 1;'));
    expect(checksumOf('SELECT 1;')).not.toBe(checksumOf('SELECT 2;'));
    expect(checksumOf('SELECT 1;')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lê as migrações por ordem alfabética', () => {
    writeMigration('002_b.sql', 'SELECT 2;');
    writeMigration('001_a.sql', 'SELECT 1;');
    writeMigration('notas.md', 'ignorar');
    expect(readMigrationFiles(directory).map((file) => file.name)).toEqual(['001_a.sql', '002_b.sql']);
  });

  it('sem registo na base de dados, todas as migrações estão pendentes', async () => {
    writeMigration('001_a.sql', 'SELECT 1;');
    writeMigration('002_b.sql', 'SELECT 2;');
    const status = await readSchemaStatus(createFakeDatabase().client, directory);
    expect(status.pending).toEqual(['001_a.sql', '002_b.sql']);
    expect(status.upToDate).toBe(false);
    expect(describeSchemaStatus(status)).toContain('npm run db:migrate');
  });

  it('detecta migrações aplicadas, divergentes e órfãs', async () => {
    writeMigration('001_a.sql', 'SELECT 1;');
    writeMigration('002_b.sql', 'SELECT 2;');
    const db = createFakeDatabase({
      '001_a.sql': checksumOf('SELECT 1;'),
      '002_b.sql': checksumOf('SELECT 2; -- editado depois de aplicado'),
      '003_c.sql': 'checksum-qualquer',
    });
    const status = await readSchemaStatus(db.client, directory);
    expect(status.applied).toEqual(['001_a.sql']);
    expect(status.drifted).toEqual(['002_b.sql']);
    expect(status.unknown).toEqual(['003_c.sql']);
    expect(status.pending).toEqual([]);
    expect(status.upToDate).toBe(false);
  });

  it('aplica só as pendentes e registra o checksum', async () => {
    writeMigration('001_a.sql', 'CREATE TABLE a (id TEXT);');
    writeMigration('002_b.sql', 'CREATE TABLE b (id TEXT);');
    const db = createFakeDatabase({ '001_a.sql': checksumOf('CREATE TABLE a (id TEXT);') });

    const result = await applyPendingMigrations(db.client, directory);
    expect(result.applied).toEqual(['002_b.sql']);
    expect(result.reconciled).toEqual([]);
    expect(result.alreadyApplied).toBe(1);
    expect(db.evaluates).toEqual(['CREATE TABLE b (id TEXT);']);
    expect(db.records.get('002_b.sql')).toBe(checksumOf('CREATE TABLE b (id TEXT);'));

    const again = await applyPendingMigrations(db.client, directory);
    expect(again.applied).toEqual([]);
    expect(db.evaluates).toHaveLength(1);
  });

  it('reaplica e actualiza o checksum quando o ficheiro de uma migração registada mudou', async () => {
    writeMigration('001_a.sql', 'CREATE TABLE a (id TEXT);');
    const db = createFakeDatabase({ '001_a.sql': checksumOf('CREATE TABLE a (id TEXT, nome TEXT);') });
    const result = await applyPendingMigrations(db.client, directory);
    expect(result.applied).toEqual([]);
    expect(result.reconciled).toEqual(['001_a.sql']);
    expect(db.evaluates).toEqual(['CREATE TABLE a (id TEXT);']);
    expect(db.records.get('001_a.sql')).toBe(checksumOf('CREATE TABLE a (id TEXT);'));
  });

  it('remove registos de ficheiros que já não existem no repositório', async () => {
    writeMigration('001_a.sql', 'SELECT 1;');
    const db = createFakeDatabase({ '001_a.sql': checksumOf('SELECT 1;'), '000_removida.sql': 'abc' });
    const result = await applyPendingMigrations(db.client, directory);
    expect(result.pruned).toEqual(['000_removida.sql']);
    expect(db.records.has('000_removida.sql')).toBe(false);
  });

  it('cria a tabela de registo antes de aplicar', async () => {
    const db = createFakeDatabase();
    expect(CREATE_SCHEMA_MIGRATIONS_TABLE).toContain('schema_migrations');
    await applyPendingMigrations(db.client, directory);
    expect(db.statements[0]).toContain('CREATE TABLE IF NOT EXISTS guigui_schema_migrations');
  });

  it('expõe o estado no erro para o arranque registar', async () => {
    writeMigration('001_a.sql', 'SELECT 1;');
    const status = await readSchemaStatus(createFakeDatabase().client, directory);
    const error = new SchemaOutOfDateError(status);
    expect(error.name).toBe('SchemaOutOfDateError');
    expect(error.message).toContain('001_a.sql');
  });

  it('a verificação (db:check) recusa um esquema com migrações pendentes', async () => {
    writeMigration('001_a.sql', 'SELECT 1;');
    const status = await readSchemaStatus(createFakeDatabase().client, directory);
    expect(status.upToDate).toBe(false);
    expect(status.pending).toEqual(['001_a.sql']);
  });

  it('não falha com diretório de migrações vazio', async () => {
    mkdirSync(join(directory, 'vazio'), { recursive: true });
    const status = await readSchemaStatus(createFakeDatabase().client, join(directory, 'vazio'));
    expect(status).toMatchObject({ applied: [], pending: [], upToDate: true });
  });
});
