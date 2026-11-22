// Repara texto com caracteres perdidos (U+FFFD, "�") nos ficheiros do projeto.
//
// Uso:
//   node scripts/fix-encoding.mjs            # dry-run: mostra o plano
//   node scripts/fix-encoding.mjs --apply    # grava as correções
import fs from 'node:fs';
import path from 'node:path';
import {
  REPLACEMENT,
  applyMapping,
  buildMapping,
  buildVocabulary,
  listProjectFiles,
  tokensOf,
} from './lib/encodingRepair.mjs';

const APPLY = process.argv.includes('--apply');
const ROOT = process.cwd();

const files = listProjectFiles(ROOT);
const texts = new Map();
for (const file of files) {
  try { texts.set(file, fs.readFileSync(file, 'utf8')); } catch { /* ficheiro ilegível */ }
}

const corrupted = new Map();
const perFile = new Map();
for (const [file, text] of texts) {
  if (!text.includes(REPLACEMENT)) continue;
  perFile.set(file, (text.match(/\uFFFD/g) || []).length);
  for (const token of tokensOf(text)) corrupted.set(token, (corrupted.get(token) || 0) + 1);
}

const vocab = buildVocabulary(texts.values());
const { mapping, unresolved } = buildMapping(corrupted.keys(), vocab);

console.log(`Ficheiros com U+FFFD: ${perFile.size} · ocorrências: ${[...perFile.values()].reduce((a, b) => a + b, 0)}`);
console.log(`Palavras corrompidas distintas: ${corrupted.size} · resolvidas: ${mapping.size} · por resolver: ${unresolved.length}`);
if (unresolved.length) console.log('POR RESOLVER:', unresolved.map((t) => JSON.stringify(t)).join(', '));

if (!APPLY) {
  for (const [file, count] of perFile) console.log(`  ${path.relative(ROOT, file)}: ${count}`);
  console.log('(dry-run; usa --apply para gravar)');
  process.exit(unresolved.length ? 2 : 0);
}

if (unresolved.length) {
  console.error('Abortado: existem palavras por resolver. Acrescenta-as ao mapa manual.');
  process.exit(1);
}

let changedFiles = 0;
let replaced = 0;
for (const [file, count] of perFile) {
  const result = applyMapping(fs.readFileSync(file, 'utf8'), mapping);
  fs.writeFileSync(file, result.text, 'utf8');
  replaced += result.changes;
  changedFiles += 1;
  console.log(`reparado ${path.relative(ROOT, file)} (${count} �, ${result.changes} substituições)`);
}
console.log(`Aplicado: ${changedFiles} ficheiros, ${replaced} substituições.`);
