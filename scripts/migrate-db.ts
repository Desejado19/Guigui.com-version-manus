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
import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERRO: DATABASE_URL não está definida no ambiente (.env).');
  console.error('Defina DATABASE_URL=postgresql://user:password@localhost:5432/guigui e volte a executar.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  let client;
  try {
    client = await pool.connect();
    console.log('[db:migrate] Conectado ao PostgreSQL.');

    const migrationsDir = path.resolve(process.cwd(), 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
    console.log(`[db:migrate] ${files.length} migração(ões) encontrada(s).`);

    for (const file of files) {
      const schemaSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
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
