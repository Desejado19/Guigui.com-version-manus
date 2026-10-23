/**
 * Lista de trabalho de tradução.
 *
 * Extrai de um ficheiro o texto visível que ainda não passa pelo tradutor, com
 * o número da linha, para poder ser convertido num plano de tradução. Usa as
 * mesmas três expressões regulares do auditor, para que a contagem deste script
 * e a de `npm run audit:i18n` batam certo.
 *
 * Uso:
 *   node scripts/i18n-worklist.mjs src/components/LoginModal.tsx
 *   node scripts/i18n-worklist.mjs --top            lista os dez maiores focos
 */
import fs from 'node:fs';
import path from 'node:path';

// As mesmas expressões do auditor. Se uma mudar, a outra tem de mudar atrás.
const JSX_TEXT = />([^<>{}]*[\u00C0-\u00FF][^<>{}]*)</g;
const ATTRS = /\b(?:title|placeholder|aria-label|alt)\s*=\s*"([^"]*[\u00C0-\u00FF][^"]*)"/g;
const TRANSLATION_CALL = /\bt\(\s*['"]|getTranslation\(\s*[A-Za-z_$][\w.$]*\s*,/g;

function hitsIn(source) {
  const hits = [];
  const lineOf = (index) => source.slice(0, index).split('\n').length;
  // Corre sobre a fonte inteira, não linha a linha: texto JSX pode ocupar
  // várias linhas e o auditor conta-o. Varrer por linhas dava contagem a menos.
  for (const m of source.matchAll(JSX_TEXT)) {
    if (m[1].trim().length > 2) hits.push({ line: lineOf(m.index), kind: 'JSX', text: m[1].trim().replace(/\s+/g, ' ') });
  }
  for (const m of source.matchAll(ATTRS)) {
    if (m[1].trim().length > 2) hits.push({ line: lineOf(m.index), kind: 'ATR', text: m[1].trim().replace(/\s+/g, ' ') });
  }
  return hits;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

const arg = process.argv[2];
const wantReuse = process.argv.includes('--reuse');

/**
 * Índice valor -> chave do português. Serve para reaproveitar traduções que já
 * existem: sem isto, a mesma string "Título" ganharia uma chave nova em cada
 * ficheiro e o catálogo enchia-se de duplicados.
 */
async function ptValueIndex() {
  const { build } = await import('esbuild');
  const { pathToFileURL } = await import('node:url');
  const tmpLocales = path.resolve('scripts/.tmp-wl-locales.mjs');
  const tmpI18n = path.resolve('scripts/.tmp-wl-i18n.mjs');
  await build({ entryPoints: [path.resolve('src/locales/index.ts')], outfile: tmpLocales, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  await build({ entryPoints: [path.resolve('src/utils/i18n.ts')], outfile: tmpI18n, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  const stamp = '?t=' + Date.now();
  const locales = (await import(pathToFileURL(tmpLocales).href + stamp)).LOCALES;
  const translations = (await import(pathToFileURL(tmpI18n).href + stamp)).TRANSLATIONS;
  fs.rmSync(tmpLocales, { force: true });
  fs.rmSync(tmpI18n, { force: true });
  const index = new Map();
  const add = (key, value) => {
    if (typeof value !== 'string') return;
    const norm = value.trim().replace(/\s+/g, ' ');
    if (!index.has(norm)) index.set(norm, key);
  };
  for (const [k, v] of Object.entries(translations.pt)) add(k, v);
  for (const [k, v] of Object.entries(locales['pt-BR'])) add(k, v);
  return index;
}

if (!arg) {
  console.error('uso: node scripts/i18n-worklist.mjs <ficheiro> [--reuse] | --top');
  process.exit(1);
}

if (arg === '--top') {
  const rows = walk('src', [])
    .map((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return { file, fixed: hitsIn(source).length, used: (source.match(TRANSLATION_CALL) || []).length };
    })
    .filter((r) => r.fixed > 0)
    .sort((a, b) => b.fixed - a.fixed);
  const total = rows.reduce((s, r) => s + r.fixed, 0);
  for (const r of rows.slice(0, 10)) {
    console.log(String(r.fixed).padStart(4) + '  ' + r.file + '   (t(): ' + r.used + ')');
  }
  console.log('----\nrestante por extrair: ' + total + ' em ' + rows.length + ' ficheiros');
  process.exit(0);
}

const source = fs.readFileSync(arg, 'utf8');
const hits = hitsIn(source);
const unique = new Map();
for (const h of hits) if (!unique.has(h.text)) unique.set(h.text, h);

const reuse = wantReuse ? await ptValueIndex() : null;
const reuseLabel = (text) => (reuse && reuse.has(text) ? '  >> JÁ EXISTE: ' + reuse.get(text) : '');

console.log(arg + ': ' + hits.length + ' ocorrências, ' + unique.size + ' strings distintas\n');
let n = 0;
let reusable = 0;
for (const [text, h] of unique) {
  n += 1;
  const label = reuseLabel(text);
  if (label) reusable += 1;
  console.log(String(n).padStart(3) + '. [' + h.line + '] ' + h.kind + '  ' + text + label);
}
if (reuse) console.log('\nreaproveitáveis: ' + reusable + ' | a criar: ' + (unique.size - reusable));
