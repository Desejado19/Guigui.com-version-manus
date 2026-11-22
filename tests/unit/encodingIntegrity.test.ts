// Guarda contra regressões de codificação: nenhum ficheiro do produto pode
// voltar a conter U+FFFD nem bytes que não sejam UTF-8 válido.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['src', 'server', 'shared', 'data', 'scripts', 'tests'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'playwright-report', '.superpowers', 'fixtures', 'backups']);
const SKIP_FILES = new Set(['fix-encoding.mjs', 'fix-encoding-db.mjs', 'encodingRepair.mjs']);
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.html', '.md']);

function listFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { listFiles(full, out); continue; }
    if (!EXTS.has(path.extname(entry.name).toLowerCase())) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    out.push(full);
  }
  return out;
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function isUtf8(buffer: Buffer): boolean {
  try {
    utf8Decoder.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

describe('integridade de codificação', () => {
  const files = DIRS.flatMap((dir) => listFiles(path.join(ROOT, dir)));

  it('encontra ficheiros para verificar', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('nenhum ficheiro contém o carácter de substituição U+FFFD', () => {
    const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes('\uFFFD'));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it('todos os ficheiros são UTF-8 válido', () => {
    const offenders = files
      .filter((file) => !isUtf8(fs.readFileSync(file)))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('os snapshots JSON continuam legíveis', () => {
    for (const file of files.filter((entry) => entry.endsWith('.json') && entry.includes(`${path.sep}data${path.sep}`))) {
      expect(() => JSON.parse(fs.readFileSync(file, 'utf8'))).not.toThrow();
    }
  });
});
