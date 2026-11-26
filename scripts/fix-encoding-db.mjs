// Repara valores corrompidos (U+FFFD) nas colunas textuais do PostgreSQL.
//
// Antes de escrever, grava um backup JSON com o valor anterior e o novo de cada
// célula em `backups/encoding-repair-<data>.json`, e tudo corre numa única
// transação. Nenhum registo é apagado.
//
// Uso:
//   node scripts/fix-encoding-db.mjs            # dry-run (mostra antes → depois)
//   node scripts/fix-encoding-db.mjs --apply    # grava (transação única)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import {
  REPLACEMENT,
  applyMapping,
  buildMapping,
  buildVocabulary,
  listProjectFiles,
  tokensOf,
} from './lib/encodingRepair.mjs';

const APPLY = process.argv.includes('--apply');
const connectionString = (process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL || '').trim();
if (!connectionString) {
  console.error('DATABASE_URL não configurado.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: /supabase|pooler|amazonaws|neon/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await client.connect();

  const columns = (await client.query(`
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('text', 'character varying')
     ORDER BY table_name, column_name
  `)).rows;

  const rowsWithDamage = [];
  const cleanValues = [];
  for (const { table_name: table, column_name: column } of columns) {
    let rows;
    try {
      rows = (await client.query(
        `SELECT ctid::text AS ctid, "${column}"::text AS value
           FROM "${table}"
          WHERE "${column}"::text LIKE '%' || chr(65533) || '%'`,
      )).rows;
    } catch (error) {
      console.log(`  (ignorada ${table}.${column}: ${error.message})`);
      continue;
    }
    for (const row of rows) {
      rowsWithDamage.push({ table, column, ctid: row.ctid, before: row.value });
    }
  }

  // Vocabulário: texto limpo do código + valores limpos da própria base.
  const projectTexts = [];
  for (const file of listProjectFiles(process.cwd())) {
    try { projectTexts.push(fs.readFileSync(file, 'utf8')); } catch { /* ficheiro ilegível */ }
  }
  for (const { table_name: table, column_name: column } of columns) {
    if (rowsWithDamage.length === 0) break;
    try {
      const rows = (await client.query(`SELECT "${column}"::text AS value FROM "${table}" WHERE "${column}" IS NOT NULL LIMIT 500`)).rows;
      for (const row of rows) cleanValues.push(row.value);
    } catch { /* coluna especial */ }
  }
  const vocab = buildVocabulary([...projectTexts, ...cleanValues]);
  const tokens = new Set();
  for (const row of rowsWithDamage) for (const token of tokensOf(row.before)) tokens.add(token);
  const { mapping, unresolved: unresolvedTokens } = buildMapping(tokens, vocab);
  if (unresolvedTokens.length) {
    console.log('Palavras sem resolução:', unresolvedTokens.map((t) => JSON.stringify(t)).join(', '));
  }
  for (const row of rowsWithDamage) {
    const result = applyMapping(row.before, mapping);
    row.after = result.text;
    row.changes = result.changes;
  }

  const unresolved = rowsWithDamage.filter((row) => row.after.includes(REPLACEMENT));
  console.log(`Células corrompidas: ${rowsWithDamage.length} · sem resolução: ${unresolved.length}`);
  for (const row of rowsWithDamage.slice(0, 30)) {
    console.log(`  ${row.table}.${row.column}: ${JSON.stringify(row.before)} → ${JSON.stringify(row.after)}`);
  }
  if (unresolved.length) {
    for (const row of unresolved) console.log('  POR RESOLVER:', row.table, row.column, JSON.stringify(row.before));
    if (APPLY) {
      console.error('Abortado: há células por resolver. Nada foi gravado.');
      process.exit(1);
    }
  }

  if (!APPLY) {
    console.log('(dry-run; usa --apply para gravar)');
    return;
  }
  if (rowsWithDamage.length === 0) {
    console.log('Nada a reparar.');
    return;
  }

  const fileName = `encoding-repair-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const backupPath = path.join(process.cwd(), 'backups', fileName);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    database: (await client.query('SELECT current_database() AS name')).rows[0].name,
    rows: rowsWithDamage.map(({ table, column, ctid, before, after }) => ({ table, column, ctid, before, after })),
  }, null, 2), 'utf8');
  console.log(`Backup gravado em backups/${fileName}`);

  await client.query('BEGIN');
  try {
    for (const row of unresolved.length === 0 ? rowsWithDamage : []) {
      await client.query(`UPDATE "${row.table}" SET "${row.column}" = $1 WHERE ctid = $2::tid`, [row.after, row.ctid]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  console.log(`Gravadas ${rowsWithDamage.length} células numa transação.`);

  let remaining = 0;
  for (const { table, column } of columns) {
    try {
      const result = await client.query(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "${column}"::text LIKE '%' || chr(65533) || '%'`,
      );
      remaining += result.rows[0].n;
    } catch { /* coluna especial */ }
  }
  console.log(`U+FFFD restantes nas colunas textuais: ${remaining}`);
}

main()
  .catch((error) => { console.error('ERRO:', error.stack); process.exitCode = 1; })
  .finally(() => client.end().catch(() => undefined));
