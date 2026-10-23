import fs from 'node:fs';
import path from 'node:path';

const dataDirectory = path.resolve(process.env.GUIGUI_DATA_DIR || 'data');
const outputRoot = path.resolve(process.env.GUIGUI_BACKUP_DIR || 'backups');
const snapshotDirectory = path.join(outputRoot, `json-${new Date().toISOString().replace(/[:.]/g, '-')}`);

if (!fs.existsSync(dataDirectory)) {
  throw new Error(`Diretório de dados não encontrado: ${dataDirectory}`);
}

const files = fs.readdirSync(dataDirectory).filter((file) => file.endsWith('.json')).sort();
if (files.length === 0) {
  throw new Error(`Nenhum ficheiro JSON encontrado em ${dataDirectory}`);
}

fs.mkdirSync(snapshotDirectory, { recursive: true });
const manifest: Array<{ file: string; bytes: number; records: number | null }> = [];

for (const file of files) {
  const sourcePath = path.join(dataDirectory, file);
  const content = fs.readFileSync(sourcePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON inválido em ${sourcePath}`, { cause: error });
  }
  fs.copyFileSync(sourcePath, path.join(snapshotDirectory, file));
  manifest.push({
    file,
    bytes: Buffer.byteLength(content, 'utf8'),
    records: Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === 'object' ? Object.keys(parsed).length : null,
  });
}

fs.writeFileSync(path.join(snapshotDirectory, 'manifest.json'), JSON.stringify({
  createdAt: new Date().toISOString(),
  sourceDirectory: dataDirectory,
  files: manifest,
}, null, 2));

console.log(`json-snapshot: created ${snapshotDirectory} (${files.length} files)`);
