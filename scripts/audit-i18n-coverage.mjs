/**
 * Auditoria de internacionalização.
 *
 * Mede duas coisas distintas e não as confunde:
 *  1. Dívida de tradução — texto visível escrito directamente em português no
 *     JSX ou em atributos, sem passar pelo tradutor.
 *  2. Paridade de chaves — chaves usadas no código que faltam em algum idioma.
 *
 * Existe porque as contagens feitas à mão já erraram duas vezes. O número
 * tem de sair de uma medição repetível, não de estimativa.
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const ROOT = 'src';
const langs = ['pt', 'en', 'fr', 'es'];

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) files.push(full.replace(/\\/g, '/'));
  }
})(ROOT);

// Texto visível: conteúdo de JSX com caracteres portugueses e atributos comuns.
const jsxText = />([^<>{}]*[\u00C0-\u00FF][^<>{}]*)</g;
const attrs = /\b(?:title|placeholder|aria-label|alt)\s*=\s*"([^"]*[\u00C0-\u00FF][^"]*)"/g;
const translationCall = /\bt\(\s*['"]|getTranslation\(\s*[A-Za-z_$][\w.$]*\s*,/g;

const rows = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const used = (src.match(translationCall) || []).length;
  let fixed = 0;
  for (const m of src.matchAll(jsxText)) if (m[1].trim().length > 2) fixed += 1;
  for (const m of src.matchAll(attrs)) if (m[1].trim().length > 2) fixed += 1;
  if (fixed > 0 || used > 0) rows.push({ file, used, fixed });
}

rows.sort((a, b) => b.fixed - a.fixed || b.used - a.used || a.file.localeCompare(b.file));

console.log('=== DÍVIDA DE TRADUÇÃO (só ficheiros com texto fixo) ===');
console.log('ficheiro'.padEnd(56) + 't()  fixo');
for (const r of rows) {
  if (r.fixed >= 3) console.log(r.file.padEnd(56) + String(r.used).padStart(4) + String(r.fixed).padStart(6));
}
console.log('----');
console.log('ficheiros analisados:', rows.length);
console.log('total t()/getTranslation:', rows.reduce((s, r) => s + r.used, 0));
console.log('total texto fixo:', rows.reduce((s, r) => s + r.fixed, 0));
console.log('ficheiros com texto fixo e zero tradução:', rows.filter((r) => r.used === 0 && r.fixed > 0).length);

const out = path.resolve('scripts/.tmp-i18n-coverage.mjs');
const outLocales = path.resolve('scripts/.tmp-locales-coverage.mjs');
await build({
  entryPoints: [path.resolve('src/utils/i18n.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
await build({
  entryPoints: [path.resolve('src/locales/index.ts')],
  outfile: outLocales,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
const stamp = '?t=' + Date.now();
const mod = await import(pathToFileURL(out).href + stamp);
const localesMod = await import(pathToFileURL(outLocales).href + stamp);
fs.rmSync(out, { force: true });
fs.rmSync(outLocales, { force: true });

// getTranslation procura primeiro no catálogo por locale (src/locales) e só
// depois em TRANSLATIONS. Medir as duas fontes em separado evita declarar
// inexistente uma chave que apenas vive na outra fonte.
const TRANSLATIONS = mod.TRANSLATIONS;
const LOCALES = localesMod.LOCALES;
const localeOf = { pt: 'pt-BR', en: 'en', fr: 'fr', es: 'es' };

const catalog = (lang, key) => {
  const primary = LOCALES[localeOf[lang]];
  return primary[key] ?? TRANSLATIONS[lang]?.[key];
};
const resolve = (lang, key) => catalog(lang, key) ?? catalog('en', key) ?? catalog('pt', key);

const ptKeys = [...new Set([...Object.keys(LOCALES['pt-BR']), ...Object.keys(TRANSLATIONS.pt)])].sort();

console.log('\n=== PARIDADE DE CHAVES (pt como referência) ===');
console.log('  pt-BR (catálogo src/locales): ' + Object.keys(LOCALES['pt-BR']).length + ' chaves');
console.log('  pt (catálogo TRANSLATIONS):   ' + Object.keys(TRANSLATIONS.pt).length + ' chaves');
console.log('  total único em pt:            ' + ptKeys.length + ' chaves');
const translated = (lang, key) => catalog(lang, key) !== undefined;
for (const l of langs) {
  const missing = ptKeys.filter((k) => !translated(l, k));
  console.log('  ' + l.padEnd(3) + String(ptKeys.length - missing.length).padStart(5) + ' traduzidas' + (missing.length ? '   faltam ' + missing.length : '   completo'));
}
console.log('\nchaves em falta por idioma (que caem no fallback):');
for (const l of langs) {
  if (l === 'pt') continue;
  const missing = ptKeys.filter((k) => !translated(l, k));
  if (!missing.length) continue;
  console.log('  --- ' + l + ' (' + missing.length + ') ---');
  console.log('  ' + missing.join(', '));
}

// Chaves referenciadas no código mas sem tradução em português.
const referenced = new Map();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
    if (!referenced.has(m[1])) referenced.set(m[1], file);
  }
  for (const m of src.matchAll(/getTranslation\(\s*[A-Za-z_$][\w.$]*\s*,\s*'([A-Za-z0-9_.]+)'/g)) {
    if (!referenced.has(m[1])) referenced.set(m[1], file);
  }
}
const unknown = [...referenced.entries()].filter(([k]) => resolve('pt', k) === undefined);
console.log('\n=== CHAVES USADAS NO CÓDIGO SEM TRADUÇÃO EM pt ===');
console.log('total: ' + unknown.length);
for (const [k, f] of unknown) console.log('  ' + k + '  (' + f + ')');
console.log('chaves referenciadas no código: ' + referenced.size);
