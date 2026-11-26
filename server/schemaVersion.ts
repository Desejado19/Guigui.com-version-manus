/**
 * Versão do esquema PostgreSQL do Guigui.com.
 *
 * Todo o DDL vive em `db/migrations/*.sql`. Este módulo é a única fonte de
 * verdade para responder a duas perguntas:
 *
 *   1. Que migrações existem no repositório e qual é o checksum de cada uma?
 *   2. Que migrações já foram aplicadas na base de dados (tabela
 *      `schema_migrations`)?
 *
 * É usado pelo migrador (`scripts/migrate-db.ts`) e pela verificação de
 * arranque (`runPlatformEntrypoint`), para que o servidor nunca tente criar
 * tabelas em runtime: o utilizador da base de dados de produção pode não ter
 * permissão de CREATE TABLE, e o primeiro pedido não é o sítio certo para
 * descobrir que falta uma migração.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Tabela de controlo já existente no projecto (colunas `filename`/`checksum`,
// com RLS configurada em db/migrations/014_remaining_tables_rls.sql). Reutilizada
// para não introduzir uma segunda convenção de registo.
export const SCHEMA_MIGRATIONS_TABLE = 'guigui_schema_migrations';

export const CREATE_SCHEMA_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS ${SCHEMA_MIGRATIONS_TABLE} (
    filename TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

export interface MigrationFile {
  name: string;
  checksum: string;
}

export interface SchemaStatus {
  /** Migrações registadas e com checksum igual ao ficheiro actual. */
  applied: string[];
  /** Ficheiros do repositório ainda sem registo na base de dados. */
  pending: string[];
  /** Registadas mas cujo ficheiro mudou depois de aplicado. */
  drifted: string[];
  /** Registadas na base de dados sem ficheiro correspondente no repositório. */
  unknown: string[];
  /** `true` quando não há migrações pendentes nem divergentes. */
  upToDate: boolean;
}

export interface SchemaQueryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export class SchemaOutOfDateError extends Error {
  readonly status: SchemaStatus;
  constructor(status: SchemaStatus) {
    super(describeSchemaStatus(status));
    this.name = 'SchemaOutOfDateError';
    this.status = status;
  }
}

/** SHA-256 do ficheiro tal como está no repositório (convenção já gravada
 *  em `guigui_schema_migrations`). */
export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export function readMigrationFiles(directory: string): MigrationFile[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      checksum: checksumOf(readFileSync(join(directory, name), 'utf8')),
    }));
}

async function readRecordedMigrations(client: SchemaQueryable): Promise<Map<string, string>> {
  const exists = await client.query<{ present: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [`public.${SCHEMA_MIGRATIONS_TABLE}`],
  );
  if (!exists.rows[0]?.present) return new Map();
  const rows = await client.query<{ filename: string; checksum: string }>(
    `SELECT filename, checksum FROM ${SCHEMA_MIGRATIONS_TABLE}`,
  );
  return new Map(rows.rows.map((row) => [String(row.filename), String(row.checksum)]));
}

export async function readSchemaStatus(
  client: SchemaQueryable,
  directory: string,
): Promise<SchemaStatus> {
  const files = readMigrationFiles(directory);
  const recorded = await readRecordedMigrations(client);
  const fileNames = new Set(files.map((file) => file.name));

  const applied: string[] = [];
  const pending: string[] = [];
  const drifted: string[] = [];

  for (const file of files) {
    const recordedChecksum = recorded.get(file.name);
    if (recordedChecksum === undefined) {
      pending.push(file.name);
    } else if (recordedChecksum !== file.checksum) {
      drifted.push(file.name);
    } else {
      applied.push(file.name);
    }
  }

  const unknown = [...recorded.keys()].filter((name) => !fileNames.has(name));

  return {
    applied,
    pending,
    drifted,
    unknown,
    upToDate: pending.length === 0 && drifted.length === 0,
  };
}

export function describeSchemaStatus(status: SchemaStatus): string {
  const lines: string[] = [];
  if (status.pending.length > 0) {
    lines.push(`Migrações pendentes (${status.pending.length}): ${status.pending.join(', ')}`);
  }
  if (status.drifted.length > 0) {
    lines.push(
      `Migrações alteradas depois de aplicadas (${status.drifted.length}): ${status.drifted.join(', ')}`,
    );
  }
  if (status.unknown.length > 0) {
    lines.push(
      `Migrações registadas na base de dados sem ficheiro no repositório (${status.unknown.length}): ${status.unknown.join(', ')}`,
    );
  }
  lines.push('Execute `npm run db:migrate` antes de arrancar o servidor.');
  return `Esquema da base de dados desatualizado.\n${lines.join('\n')}`;
}

/**
 * Aplica as migrações pendentes, uma de cada vez, registando o checksum.
 *
 * Uma migração cujo ficheiro mudou depois de ter sido registada é reaplicada
 * (todas as migrações são idempotentes) e o checksum passa a reflectir o
 * ficheiro actual. As migrações alteradas ficam registadas no log para que a
 * mudança não passe silenciosa; `npm run db:check` continua a recusar.
 *
 * Registos de ficheiros que já não existem no repositório são removidos: a
 * tabela descreve o conjunto actual de migrações.
 */
export async function applyPendingMigrations(
  client: SchemaQueryable,
  directory: string,
  log: (message: string) => void = () => {},
): Promise<{ applied: string[]; reconciled: string[]; alreadyApplied: number; pruned: string[] }> {
  await client.query(CREATE_SCHEMA_MIGRATIONS_TABLE);

  const files = readMigrationFiles(directory);
  const recorded = await readRecordedMigrations(client);
  const fileNames = new Set(files.map((file) => file.name));
  const applied: string[] = [];
  const reconciled: string[] = [];
  const pruned: string[] = [];
  let alreadyApplied = 0;

  for (const name of [...recorded.keys()]) {
    if (fileNames.has(name)) continue;
    await client.query(`DELETE FROM ${SCHEMA_MIGRATIONS_TABLE} WHERE filename = $1`, [name]);
    pruned.push(name);
    log(`registro órfão removido: ${name}`);
  }

  for (const file of files) {
    const recordedChecksum = recorded.get(file.name);
    if (recordedChecksum === file.checksum) {
      alreadyApplied += 1;
      continue;
    }

    const sql = readFileSync(join(directory, file.name), 'utf8');
    await client.query(sql);
    await client.query(
      `INSERT INTO ${SCHEMA_MIGRATIONS_TABLE} (filename, checksum)
       VALUES ($1, $2)
       ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()`,
      [file.name, file.checksum],
    );

    if (recordedChecksum === undefined) {
      applied.push(file.name);
      log(`aplicada: ${file.name}`);
    } else {
      reconciled.push(file.name);
      log(`reconciliada: ${file.name} (ficheiro mudou desde o último registo; SQL idempotente reaplicado)`);
    }
  }

  return { applied, reconciled, alreadyApplied, pruned };
}
