import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const backupDirectory = process.argv[2] ? path.resolve(process.argv[2]) : fs.readdirSync(path.resolve(process.env.GUIGUI_BACKUP_DIR || 'backups')).filter((name) => name.startsWith('postgres-')).sort().pop() && path.resolve(process.env.GUIGUI_BACKUP_DIR || 'backups', fs.readdirSync(path.resolve(process.env.GUIGUI_BACKUP_DIR || 'backups')).filter((name) => name.startsWith('postgres-')).sort().pop() as string);
if (!backupDirectory) throw new Error('Diretório de backup PostgreSQL não encontrado.');
const backupFile = path.join(backupDirectory, 'guigui.dump');
if (!fs.existsSync(backupFile)) throw new Error(`Backup não encontrado: ${backupFile}`);
const executable = process.env.PG_RESTORE_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe' : 'pg_restore');
await new Promise<void>((resolve, reject) => {
  const child = spawn(executable, ['--list', backupFile], { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_restore --list terminou com código ${code}`)));
});
const manifestPath = path.join(backupDirectory, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  manifest.verified = true;
  manifest.verifiedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
console.log(`postgres-backup-verify: valid ${backupFile}`);
