import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDataDir = process.env.GUIGUI_DATA_DIR;
const originalBackupDir = process.env.GUIGUI_BACKUP_DIR;
const originalDumpPath = process.env.PG_DUMP_PATH;

let workDir: string;

async function runBackup() {
  // Importado dinamicamente para que o serviço leia as variáveis de ambiente actuais.
  const module = await import('../../server/backupService');
  return module.triggerLocalBackup();
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-backup-'));
  fs.mkdirSync(path.join(workDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(workDir, 'backups'), { recursive: true });
  fs.writeFileSync(path.join(workDir, 'data', 'auth.json'), JSON.stringify({ users: [{ id: 'u1' }] }), 'utf8');
  process.env.GUIGUI_DATA_DIR = path.join(workDir, 'data');
  process.env.GUIGUI_BACKUP_DIR = path.join(workDir, 'backups');
  // Um executável inexistente força o pg_dump a falhar sem depender da máquina.
  process.env.PG_DUMP_PATH = path.join(workDir, 'pg_dump-inexistente');
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalDataDir === undefined) delete process.env.GUIGUI_DATA_DIR; else process.env.GUIGUI_DATA_DIR = originalDataDir;
  if (originalBackupDir === undefined) delete process.env.GUIGUI_BACKUP_DIR; else process.env.GUIGUI_BACKUP_DIR = originalBackupDir;
  if (originalDumpPath === undefined) delete process.env.PG_DUMP_PATH; else process.env.PG_DUMP_PATH = originalDumpPath;
});

describe('backup local reports only what actually happened', () => {
  it('does not claim success when the database is not configured', async () => {
    delete process.env.DATABASE_URL;
    const outcome = await runBackup();

    expect(outcome.status).toBe('not_configured');
    expect(outcome.sizeMB).toBe(0);
    expect(outcome.error).toContain('DATABASE_URL');
  });

  it('never reports completed with a fabricated size when pg_dump fails', async () => {
    process.env.DATABASE_URL = 'postgresql://utilizador:senha@127.0.0.1:1/base-inexistente';
    const outcome = await runBackup();

    // Com o pg_dump indisponível só é aceitável um snapshot JSON real ou uma falha explícita.
    expect(['completed', 'failed']).toContain(outcome.status);
    if (outcome.status === 'completed') {
      expect(outcome.engine).toBe('json');
      expect(outcome.bytes).toBeGreaterThan(0);
      expect(fs.existsSync(outcome.file)).toBe(true);
      expect(outcome.error).toContain('pg_dump');
    } else {
      expect(outcome.sizeMB).toBe(0);
    }
  });

  it('produces a real JSON snapshot with the true byte count when pg_dump is unavailable', async () => {
    process.env.DATABASE_URL = 'postgresql://utilizador:senha@127.0.0.1:1/base-inexistente';
    const outcome = await runBackup();

    expect(outcome.status).toBe('completed');
    expect(outcome.engine).toBe('json');
    expect(outcome.bytes).toBe(fs.statSync(path.join(workDir, 'data', 'auth.json')).size);
    expect(fs.existsSync(outcome.file)).toBe(true);
    expect(JSON.parse(fs.readFileSync(outcome.file, 'utf8')).engine).toBe('json');
  });

  it('fails explicitly when there is no data at all to copy', async () => {
    fs.rmSync(path.join(workDir, 'data'), { recursive: true, force: true });
    fs.mkdirSync(path.join(workDir, 'data'), { recursive: true });
    process.env.DATABASE_URL = 'postgresql://utilizador:senha@127.0.0.1:1/base-inexistente';

    const outcome = await runBackup();
    expect(outcome.status).toBe('failed');
    expect(outcome.sizeMB).toBe(0);
  });
});
