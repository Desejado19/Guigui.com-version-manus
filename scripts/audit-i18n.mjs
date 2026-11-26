import fs from 'fs';
import { build } from 'esbuild';
import path from 'path';
import { pathToFileURL } from 'url';

const out = path.resolve('scripts/.tmp-i18n.mjs');
await build({
  entryPoints: [path.resolve('src/utils/i18n.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});

const mod = await import(pathToFileURL(out).href + '?t=' + Date.now());
const TRANSLATIONS = mod.TRANSLATIONS;
const langs = Object.keys(TRANSLATIONS);

console.log('=== COBERTURA DE CHAVES I18N ===');
const all = new Set();
for (const l of langs) for (const k of Object.keys(TRANSLATIONS[l])) all.add(k);
console.log('Chaves unicas no sistema: ' + all.size);

for (const l of langs) {
  const n = Object.keys(TRANSLATIONS[l]).length;
  console.log('  ' + l.padEnd(3) + ' ' + n + ' chaves' + (n < all.size ? '  <-- INCOMPLETO (' + (all.size - n) + ' em falta)' : '  (completo)'));
}

console.log('\n=== CHAVES DA AREA DE AVALIACOES (Secao 8) ===');
const reviewKeys = ['noReviewsYet','submitReview','qualitativeRating','reviewsCount','nao_gostei','gostei','gostei_muito','muito_bom','smsVerificationCode','sendSmsCode'];
for (const k of reviewKeys) {
  const where = langs.filter((l) => TRANSLATIONS[l][k]);
  console.log('  ' + k.padEnd(22) + (where.length === langs.length ? 'OK (' + where.length + '/' + langs.length + ')' : 'FALTA em: ' + langs.filter((l) => !TRANSLATIONS[l][k]).join(',')));
}

console.log('\n=== CHAVES USADAS NO CODIGO QUE FALTAM EM ALGUM IDIOMA ===');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (/node_modules|\.git|dist|backups|scripts|data/.test(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.tsx?$/.test(e.name)) files.push(f);
  }
})('.');

const used = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(f);
  }
  for (const m of src.matchAll(/getTranslation\(\s*\w+\s*,\s*'([A-Za-z0-9_.]+)'/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(f);
  }
}
console.log('Chaves referenciadas no codigo: ' + used.size);

const gaps = [...used.entries()].filter(([k]) => langs.some((l) => !TRANSLATIONS[l][k]));
console.log('Chaves usadas mas incompletas: ' + gaps.length);
for (const [k, fs_] of gaps) {
  const missing = langs.filter((l) => !TRANSLATIONS[l][k]);
  console.log('  ' + k.padEnd(30) + 'falta: ' + missing.join(',') + '  (' + [...fs_][0] + ')');
}

fs.rmSync(out, { force: true });
