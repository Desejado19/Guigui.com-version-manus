import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória para criar backup PostgreSQL.');
const outputRoot = path.resolve(process.env.GUIGUI_BACKUP_DIR || 'backups');
const outputDirectory = path.join(outputRoot, `postgres-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outputDirectory, { recursive: true });
const outputFile = path.join(outputDirectory, 'guigui.dump');
const executable = process.env.PG_DUMP_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe' : 'pg_dump');

await new Promise<void>((resolve, reject) => {
  const child = spawn(executable, ['--format=custom', '--file', outputFile, databaseUrl], { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump terminou com código ${code}`)));
});
const stats = fs.statSync(outputFile);
if (stats.size <= 0) throw new Error('Backup PostgreSQL vazio.');
fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), file: 'guigui.dump', bytes: stats.size, verified: false }, null, 2));
console.log(`postgres-backup: created ${outputFile} (${stats.size} bytes)`);
