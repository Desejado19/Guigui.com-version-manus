#!/usr/bin/env node
/**
 * Verificador de cor: garante que os componentes usam a paleta canonica
 * definida em src/index.css e nao valores hexadecimais avulsos.
 *
 * Uso:
 *   node scripts/audit-colors.mjs            -> relatorio (sai 0)
 *   node scripts/audit-colors.mjs --strict   -> falha se houver violacoes
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src'];
const EXTENSIONS = ['.ts', '.tsx'];

/** Ficheiros onde a cor literal e legitima (exigida por bibliotecas ou exportacoes). */
const ALLOWED_FILES = new Set([
  'src/index.css',
  'src/utils/exportHelpers.ts', // HTML/XLSX exportado: sem folha de estilos propria
  'src/components/QRCodeDisplay.tsx', // a biblioteca de QR exige valores hexadecimais
]);

/** Series de graficos permitidas (documentadas em docs/PALETA-CORES-GUIGUI.md). */
const ALLOWED_HEX = new Set(['#1570ef', '#2f9e68', '#c9852a', '#ec6640']);

/** Excecoes pontuais: nao sao cores. */
const EXCEPTIONS = new Set([
  'src/components/AdminDashboard.tsx::#991023', // referencia de talao "BDC #991023"
]);

const HEX = /#[0-9a-fA-F]{6}\b/g;
const SVG_PRESENTATION = /\b(fill|stroke)="#[0-9a-fA-F]{6}"/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (ALLOWED_FILES.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((rawLine, index) => {
      const line = rawLine.replace(SVG_PRESENTATION, '');
      const found = (line.match(HEX) || []).map((color) => color.toLowerCase());
      const offenders = [...new Set(found)].filter(
        (color) => !ALLOWED_HEX.has(color) && !EXCEPTIONS.has(`${rel}::${color}`),
      );
      if (offenders.length) violations.push({ file: rel, line: index + 1, colors: offenders });
    });
  }
}

const total = violations.reduce((sum, item) => sum + item.colors.length, 0);

if (total === 0) {
  console.log('Paleta: sem cores literais fora de src/index.css.');
  process.exit(0);
}

console.log(`Paleta: ${total} cor(es) fora do padrao em ${violations.length} linha(s).`);
const byFile = new Map();
for (const item of violations) {
  const entry = byFile.get(item.file) ?? { lines: 0, colors: new Set() };
  entry.lines += 1;
  for (const color of item.colors) entry.colors.add(color);
  byFile.set(item.file, entry);
}
for (const [file, entry] of [...byFile.entries()].sort((a, b) => b[1].lines - a[1].lines)) {
  console.log(`  ${file.padEnd(52)} ${String(entry.lines).padStart(3)} linha(s)  ${[...entry.colors].join(' ')}`);
}

if (process.argv.includes('--strict')) {
  console.error('\nFalha: substituir por var(--token) ou por uma classe da paleta.');
  process.exit(1);
}
