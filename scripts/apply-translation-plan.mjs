/**
 * Aplicador de planos de tradução verificados.
 *
 * Uso: node scripts/apply-translation-plan.mjs caminho/do/plano.json
 *
 * O plano é uma lista de substituições:
 *   [{ "file": "...", "old": "texto exacto", "new": "texto novo", "expect": 1 }]
 *
 * Cada `old` tem de aparecer exactamente `expect` vezes (por omissão 1). Se
 * alguma entrada não corresponder, NADA é gravado e o script termina com erro.
 *
 * Isto existe porque substituições silenciosas já produziram traduções erradas:
 * quando o texto de origem tinha sido truncado, o script antigo não encontrava
 * nada e continuava como se tivesse funcionado. Falhar alto evita isso.
 */
import fs from 'node:fs';

const planPath = process.argv[2];
if (!planPath) {
  console.error('uso: node scripts/apply-translation-plan.mjs <plano.json>');
  process.exit(2);
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
let failures = 0;
let applied = 0;
const pending = new Map();

for (const step of plan) {
  const source = pending.get(step.file) ?? fs.readFileSync(step.file, 'utf8');
  const occurrences = source.split(step.old).length - 1;
  const expected = step.expect ?? 1;
  if (occurrences !== expected) {
    failures += 1;
    console.log(`FALHA  ${step.file}  encontrado ${occurrences}x, esperado ${expected}x  ::  ${JSON.stringify(step.old.slice(0, 90))}`);
    continue;
  }
  pending.set(step.file, source.split(step.old).join(step.new));
  applied += 1;
}

if (failures === 0) {
  for (const [file, content] of pending) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`GRAVADO ${file} (${content.length} bytes)`);
  }
}

console.log(`---- aplicadas: ${applied} · falhas: ${failures}`);
if (failures > 0) {
  console.log('nada foi gravado: corrija o plano antes de reaplicar');
  process.exit(1);
}
