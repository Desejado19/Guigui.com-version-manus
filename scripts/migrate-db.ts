#!/usr/bin/env tsx
/**
 * Guigui.com — Migração do esquema PostgreSQL
 *
 * Executa, por ordem alfabética, todos os ficheiros SQL de `db/migrations/`
 * contra a base de dados configurada em DATABASE_URL. Todas as migrações são
 * idempotentes (IF NOT EXISTS / IF EXISTS), pelo que repetir a execução é seguro.
 *
 * Uso:
 *   npm run db:migrate
 *
 * Requisitos:
 *   - Variável de ambiente DATABASE_URL definida (.env)
 *   - Servidor PostgreSQL acessível
 */
import 'dotenv/config?override=true';
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const DATABASE_URL = (process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL)?.trim();
if (!DATABASE_URL) {
  console.error('ERRO: DATABASE_URL ou DATABASE_POOLER_URL não está definida no ambiente (.env).');
  console.error('Defina DATABASE_URL=postgresql://user:password@localhost:5432/guigui (ou DATABASE_POOLER_URL para o pooler Supabase) e volte a executar.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

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
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
    console.log(`[db:migrate] ${files.length} migração(ões) encontrada(s).`);

    for (const file of files) {
      const schemaSql = readFileSync(join(migrationsDir, file), 'utf8');
      // Executa o ficheiro inteiro (client.query aceita múltiplas statements separadas por ;)
      await client.query(schemaSql);
      console.log('[db:migrate] Aplicada:', file);
    }

    // Verificação rápida: lista tabelas criadas
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
       ORDER BY table_name`
    );
    console.log(`[db:migrate] Tabelas na base de dados (${tables.rows.length}):`);
    for (const row of tables.rows) {
      console.log(`  - ${row.table_name}`);
    }
  } catch (error) {
    console.error('[db:migrate] Falha na migração:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
