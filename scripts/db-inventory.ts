import 'dotenv/config?override=true';
import { Pool } from 'pg';

const DATABASE_URL = (process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL)?.trim();
if (!DATABASE_URL) {
  console.error('ERRO: DATABASE_URL ou DATABASE_POOLER_URL não está definida no ambiente (.env).');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Diagnóstico opcional: ligação directa vs pooler Supabase
import { poolConfigDiagnostic } from '../server/db';

// Verificação de integridade no pooler Supabase (só se configurado)
async function checkPoolHealth() {
  const poolerUrl = process.env.DATABASE_POOLER_URL?.trim();
  if (!poolerUrl) return;
  try {
    const pool = new Pool({ connectionString: poolerUrl });
    await pool.query('SELECT 1');
    console.log('[db:inventory] Pool Supabase: saudável.');
    await pool.end();
  } catch (e) {
    console.error('[db:inventory] Pool Supabase: falha ao conectar.', e instanceof Error ? e.message : e);
  }
}

// Teste de integridade (ping rápido) após conexão
async function testIntegridade(client: any) {
  try {
    const res = await client.query('SELECT 1 AS ok');
    if (res.rows[0]?.ok !== 1) throw new Error('Resposta inesperada do servidor.');
    console.log('[db:inventory] Ping: executado com sucesso.');
  } catch (e) {
    console.error('[db:inventory] Ping: falhou.', e instanceof Error ? e.message : e);
  }
}

async function main() {
  const diagnostic = poolConfigDiagnostic();
  if (diagnostic.poolerLikely && diagnostic.poolerLikely !== undefined) {
    console.log('[db:inventory] Aviso: ligação parece ser pooler Supabase (DATABASE_POOLER_URL).');
  } else if (diagnostic.poolerLikely === false && diagnostic.poolerLikely !== undefined) {
    console.log('[db:inventory] Aviso: ligação directa detectada num host Supabase típico. Considere usar o pooler Supabase quando estiver disponível.');
  }

  await checkPoolHealth();

  let client;
  try {
    client = await pool.connect();
    console.log('[db:inventory] Conectado ao PostgreSQL.');

    await testIntegridade(client);

    const t = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    console.log('TABELAS: ' + t.rows.map((r) => r.table_name).join(', '));
    for (const r of t.rows) {
      try {
        const c = await client.query(`SELECT COUNT(*)::int AS n FROM "${r.table_name}"`);
        console.log(`${r.table_name}: ${c.rows[0].n}`);
      } catch (e) {
        console.log(`${r.table_name}: ERRO ${(e as Error).message}`);
      }
    }
  } catch (error) {
    console.error('[db:inventory] Falha na consulta:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
