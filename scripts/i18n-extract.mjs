/**
 * Extrator de texto para tradução.
 *
 * Faz as duas coisas que é perigoso fazer à mão num ficheiro de cinco mil
 * linhas com acentos portugueses:
 *   1. Localiza o texto visível ainda por traduzir e escreve-o num esqueleto
 *      JSON com o português copiado do próprio ficheiro (nunca transcrito).
 *   2. Lê uma especificação com {linha, chave, traduções}, substitui o texto por
 *      chaves t('...') no componente e acrescenta as entradas aos cinco
 *      catálogos, com o português vindo do código e as restantes línguas da
 *      especificação.
 *
 * Uso:
 *   node scripts/i18n-extract.mjs --skeleton <componente> <spec.json>
 *   node scripts/i18n-extract.mjs <componente> <spec.json> [--dry-run]
 *
 * spec.json:
 *   { "sites": [ { "line": 1771, "index": 1, "key": "painel.subtitulo",
 *                  "en": "...", "fr": "...", "es": "..." } ] }
 *
 * `line` é a linha do auditor e `index` desambigua quando há mais de um texto
 * na mesma linha (1 por omissão). Sem --dry-run escreve; com ele só reporta.
 */
import fs from 'node:fs';
import path from 'node:path';

// As mesmas expressões do auditor e do worklist: as três têm de concordar.
const JSX_TEXT = />([^<>{}]*[\u00C0-\u00FF][^<>{}]*)</g;
const ATTR_FULL = /\b(title|placeholder|aria-label|alt)\s*=\s*"([^"]*[\u00C0-\u00FF][^"]*)"/g;

const LOCALE_LANGS = [
  { lang: 'pt', file: 'src/locales/pt-BR.ts' },
  { lang: 'en', file: 'src/locales/en.ts' },
  { lang: 'fr', file: 'src/locales/fr.ts' },
  { lang: 'es', file: 'src/locales/es.ts' },
];

/** Todos os pontos de texto visível, com o intervalo exato a substituir. */
function findSites(source) {
  const sites = [];
  const lineOf = (index) => source.slice(0, index).split('\n').length;
  for (const m of source.matchAll(JSX_TEXT)) {
    if (m[1].trim().length <= 2) continue;
    sites.push({
      line: lineOf(m.index),
      kind: 'JSX',
      pt: m[1].trim(),
      start: m.index + 1,
      end: m.index + m[0].length - 1,
    });
  }
  for (const m of source.matchAll(ATTR_FULL)) {
    if (m[2].trim().length <= 2) continue;
    sites.push({
      line: lineOf(m.index),
      kind: 'ATR',
      pt: m[2].trim(),
      attr: m[1],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  sites.sort((a, b) => a.start - b.start);
  const perLine = new Map();
  for (const site of sites) {
    const occurrence = (perLine.get(site.line) || 0) + 1;
    perLine.set(site.line, occurrence);
    site.index = occurrence;
  }
  return sites;
}

function quote(value) {
  // O texto JSX pode ocupar várias linhas; o JSX mostra isso como um espaço,
  // por isso o catálogo guarda a versão normalizada, sem quebras de linha.
  return "'" + String(value).replace(/\s+/g, ' ').replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

/**
 * Valor português de cada chave, lendo as duas fontes que `getTranslation`
 * consulta: o catálogo em src/locales e o TRANSLATIONS em i18n.ts. Validar
 * reutilizações contra o texto real evita colar uma etiqueta nova numa chave
 * que diz outra coisa.
 */
async function loadPtValues() {
  const { build } = await import('esbuild');
  const { pathToFileURL } = await import('node:url');
  const tmpLocales = 'scripts/.tmp-extract-locales.mjs';
  const tmpI18n = 'scripts/.tmp-extract-i18n.mjs';
  await build({ entryPoints: ['src/locales/index.ts'], outfile: tmpLocales, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  await build({ entryPoints: ['src/utils/i18n.ts'], outfile: tmpI18n, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  const stamp = '?t=' + Date.now();
  const locales = (await import(pathToFileURL(tmpLocales).href + stamp)).LOCALES;
  const translations = (await import(pathToFileURL(tmpI18n).href + stamp)).TRANSLATIONS;
  fs.rmSync(tmpLocales, { force: true });
  fs.rmSync(tmpI18n, { force: true });
  const norm = (value) => String(value).replace(/\s+/g, ' ').trim();
  const values = new Map();
  for (const entries of [translations.pt, locales['pt-BR']]) {
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === 'string') values.set(key, norm(value));
    }
  }
  return values;
}

/**
 * Insere entradas antes do fecho do objeto do catálogo. Os ficheiros usam
 * `} as const;`, mas `};` também é aceite. Garante vírgula na última entrada
 * existente para não partir a sintaxe.
 */
function appendEntries(source, entries) {
  const closers = [...source.matchAll(/^\}/gm)];
  if (!closers.length) throw new Error('catálogo sem fecho de objeto `}`');
  const close = closers[closers.length - 1].index;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const body = source.slice(0, close).replace(/\s+$/, '');
  const lines = entries.map((entry) => '  ' + quote(entry[0]) + ': ' + quote(entry[1]) + ',');
  return body + (/[,{]$/.test(body) ? '' : ',') + eol + lines.join(eol) + eol + source.slice(close);
}

/** Espaço de nomes derivado do nome do ficheiro: BusinessDashboard → business. */
function namespaceOf(file) {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const stripped = base.replace(/(Dashboard|View|Hub|Panel|Screen|Card|Page|Modal|Form|List|Sidebar|Header|Footer)$/i, '') || base;
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

/** Chave determinística a partir do texto português, sem colisões. */
function slugKey(pt, namespace, taken) {
  const words = pt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2)
    .slice(0, 3);
  const slug = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
  const root = namespace + '.' + (slug || 'texto');
  let key = root;
  let counter = 2;
  while (taken.has(key)) {
    key = root + counter;
    counter += 1;
  }
  taken.add(key);
  return key;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((a) => !a.startsWith('--'));

if (positional.length < 2) {
  console.error('uso: node scripts/i18n-extract.mjs [--skeleton|--fill] <componente|spec> <spec|tabela>');
  process.exit(1);
}

const skeletonMode = args[0] === '--skeleton';
const fillMode = args[0] === '--fill';
const componentFile = positional[0];
const specFile = positional[1];

const ptValues = await loadPtValues();
const norm = (value) => String(value).replace(/\s+/g, ' ').trim();
const source = fillMode ? '' : fs.readFileSync(componentFile, 'utf8');
const sites = fillMode ? [] : findSites(source);

if (fillMode) {
  const table = new Map();
  for (const raw of fs.readFileSync(positional[1], 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('|').map((part) => part.trim());
    if (parts.length !== 5) {
      console.error('tabela com colunas erradas (esperado linha~idx|en|fr|es): ' + line);
      process.exit(1);
    }
    table.set(parts[0], parts.slice(1));
  }
  // Em modo --fill o primeiro argumento é a especificação e o segundo é a
  // tabela de traduções. `specFile` aponta para a tabela, por isso a
  // especificação lê-se — e grava-se — a partir de `componentFile`.
  const specPath = componentFile;
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  let filled = 0;
  const missing = [];
  for (const site of spec.sites) {
    if (!site.key || ptValues.has(site.key)) continue;
    const row = table.get(site.line + '~' + (site.index || 1));
    if (!row) {
      missing.push(site);
      continue;
    }
    [site.en, site.fr, site.es] = row;
    filled += 1;
  }
  fs.writeFileSync(specPath, JSON.stringify({ sites: spec.sites }, null, 2) + '\n', 'utf8');
  console.log('preenchidos ' + filled + ' sitios; ' + (spec.sites.length - filled) + ' reutilizam chaves existentes');
  if (missing.length) {
    console.log('sem linha na tabela (' + missing.length + '), a especificação fica por preencher:');
    for (const site of missing) console.log('  ' + site.line + '~' + (site.index || 1) + '  ' + norm(site.pt));
    process.exit(1);
  }
  process.exit(0);
}

if (skeletonMode) {
  const ptToKey = new Map();
  for (const [key, value] of ptValues) if (!ptToKey.has(value)) ptToKey.set(value, key);
  const namespace = namespaceOf(componentFile);
  const taken = new Set(ptValues.keys());
  const out = sites.map((site) => {
    const reusedKey = ptToKey.get(norm(site.pt)) || '';
    return {
      line: site.line,
      index: site.index,
      pt: site.pt,
      key: reusedKey || slugKey(site.pt, namespace, taken),
      en: '',
      fr: '',
      es: '',
    };
  });
  const lines = out.map((site) => '    ' + JSON.stringify(site));
  fs.writeFileSync(specFile, '{\n  "sites": [\n' + lines.join(',\n') + '\n  ]\n}\n', 'utf8');
  const reusable = out.filter((site) => ptToKey.get(norm(site.pt))).length;
  console.log('esqueleto com ' + out.length + ' pontos escrito em ' + specFile);
  console.log('  ' + reusable + ' reutilizam chaves existentes; ' + (out.length - reusable) + ' precisam de traduções');
  process.exit(0);
}

const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const catalogs = LOCALE_LANGS.map((entry) => ({ ...entry, source: fs.readFileSync(entry.file, 'utf8') }));
const planned = new Map();
const edits = [];
const problems = [];
const reused = new Set();

for (const site of spec.sites) {
  const label = 'linha ' + site.line + (site.index && site.index > 1 ? '#' + site.index : '') + ' (' + site.key + ')';
  const matches = sites.filter((s) => s.line === site.line && (site.index ? s.index === site.index : true));
  if (matches.length === 0) {
    problems.push(label + ': nenhum texto do auditor nesta linha');
    continue;
  }
  if (matches.length > 1) {
    problems.push(label + ': ' + matches.length + ' textos na linha, falta o índice');
    continue;
  }
  const hit = matches[0];
  if (!site.key || !/^[A-Za-z0-9_.]+$/.test(site.key)) {
    problems.push(label + ': chave inválida');
    continue;
  }
  if (ptValues.has(site.key)) {
    const bringsTranslations = ['en', 'fr', 'es'].some((lang) => site[lang]);
    if (bringsTranslations) {
      problems.push(label + ': chave já existe mas a especificação traz traduções');
      continue;
    }
    if (ptValues.get(site.key) !== hit.pt.replace(/\s+/g, ' ').trim()) {
      problems.push(label + ": reutilização rejeitada, o português da chave não é o texto do sítio");
      continue;
    }
    reused.add(site.key);
  } else if (!planned.has(site.key)) {
    for (const lang of ['en', 'fr', 'es']) {
      if (!site[lang] || !String(site[lang]).trim()) problems.push(label + ': tradução em ' + lang + ' vazia');
    }
    planned.set(site.key, { pt: norm(hit.pt), en: site.en, fr: site.fr, es: site.es });
  }
  const call = "t('" + site.key + "')";
  edits.push({ start: hit.start, end: hit.end, text: hit.kind === 'JSX' ? '{' + call + '}' : hit.attr + '={' + call + '}' });
}

if (problems.length) {
  console.error('ABORTADO, nada foi escrito:');
  for (const problem of problems.slice(0, 40)) console.error('  ' + problem);
  if (problems.length > 40) console.error('  ... mais ' + (problems.length - 40));
  process.exit(1);
}

let next = source;
for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
  next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
}
for (const catalog of catalogs) {
  const entries = [...planned.entries()].map((pair) => [pair[0], pair[1][catalog.lang]]);
  catalog.output = appendEntries(catalog.source, entries);
}

console.log('componente: ' + edits.length + ' textos substituídos por t()');
console.log('catálogos: cada um dos ' + catalogs.length + ' recebe ' + planned.size + ' entradas');
if (reused.size) console.log('reutilizadas: ' + reused.size + ' chaves que já existiam');
if (dryRun) {
  console.log('--dry-run: nada escrito');
  process.exit(0);
}
fs.writeFileSync(componentFile, next, 'utf8');
for (const catalog of catalogs) fs.writeFileSync(catalog.file, catalog.output, 'utf8');
console.log('escrito.');
