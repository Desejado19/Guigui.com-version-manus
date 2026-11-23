#!/usr/bin/env tsx
/**
 * Guigui.com — Migração do esquema PostgreSQL
 *
 * Este é o ÚNICO passo que cria/altera schema. O servidor nunca corre DDL em
 * runtime: em produção o utilizador da base de dados pode não ter permissão de
 * CREATE TABLE, e uma tabela em falta deve falhar no deploy, não no primeiro
 * pedido.
 *
 * Executa, por ordem alfabética, todos os ficheiros SQL de `db/migrations/` que
 * ainda não estejam registados em `schema_migrations`, e grava o checksum de
 * cada um. Corridas seguintes saltam as já aplicadas; se o ficheiro de uma
 * migração já aplicada mudar, o script aborta (crie uma nova migração em vez de
 * editar a antiga).
 *
 * Uso:
 *   npm run db:migrate            aplica as migrações pendentes
 *   npm run db:check              só verifica a versão (sem DDL); sai 1 se desatualizada
 *
 * Requisitos:
 *   - DATABASE_URL (ou DATABASE_POOLER_URL) definida (.env)
 *   - Servidor PostgreSQL acessível
 *   - As migrações devem ser idempotentes (IF NOT EXISTS / IF NOT EXISTS ...
 *     ON CONFLICT), porque uma base de dados anterior a este registo aplica-as
 *     todas uma primeira vez para estabelecer a linha de base.
 */
import 'dotenv/config?override=true';
import { Pool } from 'pg';
import { resolve } from 'path';
import {
  applyPendingMigrations,
  describeSchemaStatus,
  readSchemaStatus,
} from '../server/schemaVersion';

const DATABASE_URL = (process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL)?.trim();
if (!DATABASE_URL) {
  console.error('ERRO: DATABASE_URL ou DATABASE_POOLER_URL não está definida no ambiente (.env).');
  console.error('Defina DATABASE_URL=postgresql://user:password@localhost:5432/guigui (ou DATABASE_POOLER_URL para o pooler Supabase) e volte a executar.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const checkOnly = process.argv.includes('--check');

// Diagnóstico opcional: ligação directa vs pooler Supabase
import { poolConfigDiagnostic } from '../server/db';

async function main() {
  const diagnostic = poolConfigDiagnostic();
  if (diagnostic.poolerLikely && diagnostic.poolerLikely !== undefined) {
    console.log('[db:migrate] Aviso: ligação parece ser pooler Supabase (DATABASE_POOLER_URL).');
  } else if (diagnostic.poolerLikely === false && diagnostic.poolerLikely !== undefined) {
    console.log('[db:migrate] Aviso: ligação directa detectada num host Supabase típico. Considere usar o pooler Supabase quando estiver disponível.');
  }

  let client;
  try {
    client = await pool.connect();
    console.log('[db:migrate] Conectado ao PostgreSQL.');

    const migrationsDir = resolve(process.cwd(), 'db', 'migrations');
    const before = await readSchemaStatus(client, migrationsDir);
    console.log(
      `[db:migrate] Esquema: ${before.applied.length} aplicada(s), ` +
        `${before.pending.length} pendente(s), ${before.drifted.length} divergente(s).`,
    );

    if (before.drifted.length > 0) {
      console.warn(
        `[db:migrate] Ficheiros alterados desde o último registo (serão reaplicados): ${before.drifted.join(', ')}`,
      );
    }
    if (before.unknown.length > 0) {
      console.warn(
        `[db:migrate] Registos de migrações que já não existem no repositório (serão removidos): ${before.unknown.join(', ')}`,
      );
    }

    if (checkOnly) {
      if (!before.upToDate) {
        console.error(`[db:check] ${describeSchemaStatus(before)}`);
        process.exit(1);
      }
      console.log('[db:check] Esquema actualizado.');
      return;
    }

    if (before.upToDate) {
      console.log('[db:migrate] Nada a aplicar.');
    } else {
      const result = await applyPendingMigrations(client, migrationsDir, (message) =>
        console.log(`[db:migrate] ${message}`),
      );
      console.log(
        `[db:migrate] ${result.applied.length} migração(ões) aplicada(s); ` +
          `${result.reconciled.length} reconciliada(s); ` +
          `${result.pruned.length} registo(s) órfão(s) removido(s); ` +
          `${result.alreadyApplied} já estavam registadas.`,
      );
    }

    const after = await readSchemaStatus(client, migrationsDir);
    if (!after.upToDate) {
      console.error(`[db:migrate] ${describeSchemaStatus(after)}`);
      process.exit(1);
    }

    // Verificação rápida: lista tabelas criadas
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
       ORDER BY table_name`
    );
    console.log(`[db:migrate] Esquema na versão ${after.applied.length} (${tables.rows.length} tabelas).`);
  } catch (error) {
    console.error('[db:migrate] Falha na migração:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
