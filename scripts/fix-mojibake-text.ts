// Repara texto com duplo encoding (UTF-8 lido como Latin-1) na base de dados.
//
// Exemplo: "FarmÃ¡cia" -> "Farmácia", "BijagÃ³s" -> "Bijagós".
// Cobre `companies` (coluna name + jsonb data) e `app_state` (jsonb value).
// Uso: npx tsx scripts/fix-mojibake-text.ts [--apply]
// Sem --apply apenas mostra o que mudaria.
import 'dotenv/config';
import { databasePool } from '../server/db';

const APPLY = process.argv.includes('--apply');
// Sequências típicas de UTF-8 lido como Latin-1: 2, 3 ou 4 bytes.
const MOJIBAKE_SPAN = /(?:[\u00C2-\u00DF][\u0080-\u00BF])+|(?:[\u00E0-\u00EF][\u0080-\u00BF]{2})|(?:[\u00F0-\u00F4][\u0080-\u00BF]{3})/g;

// Repara apenas as sequências corrompidas, deixando o resto do texto intacto
// (há textos misturados: parte já corrigida, parte ainda em duplo encoding).
function decodeOnce(value: string): string | null {
  let changed = false;
  const decoded = value.replace(MOJIBAKE_SPAN, (match) => {
    const bytes = Buffer.from(match, 'latin1');
    const asUtf8 = bytes.toString('utf8');
    if (asUtf8.includes('\uFFFD')) return match;
    changed = true;
    return asUtf8;
  });
  return changed ? decoded : null;
}

function fixDeep(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const fixed = decodeOnce(value);
    return fixed === null ? { value, changed: false } : { value: fixed, changed: true };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = fixDeep(item);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: changed ? next : value, changed };
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const fixedKey = decodeOnce(key) ?? key;
      const result = fixDeep(item);
      if (result.changed || fixedKey !== key) changed = true;
      return [fixedKey, result.value] as const;
    });
    return { value: changed ? Object.fromEntries(entries) : value, changed };
  }
  return { value, changed: false };
}

async function main() {
  const pool = databasePool;
  if (!pool) {
    console.error('DATABASE_URL não configurado: nada a reparar.');
    process.exit(1);
  }

  let touched = 0;

  const companies = await pool.query('SELECT id, name, data FROM companies ORDER BY id');
  for (const row of companies.rows as any[]) {
    const fixedName = decodeOnce(row.name ?? '');
    const fixedData = fixDeep(row.data);
    if (fixedName === null && !fixedData.changed) continue;
    touched += 1;
    console.log(`- companies/${row.id}`);
    if (fixedName !== null) console.log(`    nome: ${row.name} -> ${fixedName}`);
    if (APPLY) {
      await pool.query('UPDATE companies SET name = $1, data = $2::jsonb WHERE id = $3', [
        fixedName ?? row.name,
        JSON.stringify(fixedData.value),
        row.id,
      ]);
    }
  }

  // Sem filtro por `Ã`: o duplo encoding de caracteres de 3/4 bytes começa por
  // `â`/`ð`, pelo que um LIKE estreito deixaria valores por reparar.
  const states = await pool.query('SELECT key, value FROM app_state ORDER BY key');
  for (const row of states.rows as any[]) {
    const fixed = fixDeep(row.value);
    if (!fixed.changed) continue;
    touched += 1;
    console.log(`- app_state/${row.key}`);
    if (APPLY) {
      await pool.query('UPDATE app_state SET value = $1::jsonb WHERE key = $2', [
        JSON.stringify(fixed.value),
        row.key,
      ]);
    }
  }

  console.log(
    APPLY ? `Aplicado em ${touched} registo(s).` : `Dry-run: ${touched} registo(s) seriam corrigidos. Use --apply.`,
  );
  await pool.end();
}

void main();
