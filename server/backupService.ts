import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Backup do Guigui.com: cópia cifrada, verificação e retenção.
 *
 * O endpoint administrativo tem de descrever o que aconteceu de facto: só
 * declara `completed` quando existe um ficheiro gerado, cifrado e não vazio.
 * A chave de cifra vem de `GUIGUI_BACKUP_ENCRYPTION_KEY`; sem ela o backup é
 * produzido mas fica marcado como `unencrypted`, porque uma cópia em claro de
 * uma base com dados pessoais é pior do que nenhuma cópia.
 */

export type BackupOutcome = {
  status: 'completed' | 'not_configured' | 'failed';
  engine: 'postgres' | 'json';
  file: string;
  bytes: number;
  sizeMB: number;
  encrypted: boolean;
  sha256: string;
  replicatedTo?: string;
  error?: string;
};

const backupRoot = () => path.resolve(process.env.GUIGUI_BACKUP_DIR || 'backups');
// Lido à chamada, e não no carregamento do módulo, para respeitar a configuração
// em tempo de execução e permitir testar com diretórios temporários.
const dataDirectory = () => process.env.GUIGUI_DATA_DIR || path.resolve(process.cwd(), 'data');

const timestampSlug = () => new Date().toISOString().replace(/[:.]/g, '-');

const encryptionKey = (): Buffer | null => {
  const raw = process.env.GUIGUI_BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  // Aceita hex de 32 bytes ou qualquer frase, derivada por SHA-256.
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw).digest();
};

/** Cifra AES-256-GCM. O IV e a etiqueta de autenticação precedem o conteúdo. */
export function encryptFile(source: string, destination: string, key: Buffer): void {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = fs.readFileSync(source);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  fs.writeFileSync(destination, Buffer.concat([iv, cipher.getAuthTag(), encrypted]));
}

/** Decifra e valida a etiqueta de autenticação; lança se o ficheiro foi alterado. */
export function decryptFile(source: string, destination: string, key: Buffer): void {
  const raw = fs.readFileSync(source);
  if (raw.length < 29) throw new Error('Ficheiro cifrado inválido.');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const payload = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  fs.writeFileSync(destination, Buffer.concat([decipher.update(payload), decipher.final()]));
}

const sha256Of = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Replica a cópia para fora da máquina. Aceita um directório de destino
 * (disco externo, volume montado) — é a alternativa honesta a um bucket que
 * exigiria credenciais de nuvem.
 */
function replicate(file: string): { target: string } | null {
  const target = process.env.GUIGUI_BACKUP_REPLICA_DIR?.trim();
  if (!target) return null;
  const directory = path.resolve(target);
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, path.basename(file));
  fs.copyFileSync(file, destination);
  // A cópia é relida e comparada: copiar não é o mesmo que estar intacto.
  if (sha256Of(destination) !== sha256Of(file)) throw new Error('A réplica não corresponde à original.');
  return { target: destination };
}

/** Apaga as cópias mais antigas, mantendo `GUIGUI_BACKUP_RETENTION` (por omissão 7). */
export function pruneOldBackups(): number {
  const retention = Number(process.env.GUIGUI_BACKUP_RETENTION || 7);
  if (!Number.isFinite(retention) || retention < 1) return 0;
  const directories = fs.readdirSync(backupRoot())
    .filter((name) => name.startsWith('postgres-') || name.startsWith('json-'))
    .sort();
  const removable = directories.slice(0, Math.max(0, directories.length - retention));
  for (const name of removable) fs.rmSync(path.join(backupRoot(), name), { recursive: true, force: true });
  return removable.length;
}

function pgDumpExecutable(): string {
  return process.env.PG_DUMP_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe' : 'pg_dump');
}

async function runPgDump(databaseUrl: string, outputFile: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pgDumpExecutable(), ['--format=custom', '--file', outputFile, databaseUrl], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump terminou com o código ${code}.`))));
  });
}

/** Copia o estado JSON de runtime para uma pasta datada. */
function snapshotJson(targetDirectory: string): { bytes: number; file: string } {
  fs.mkdirSync(targetDirectory, { recursive: true });
  let bytes = 0;
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dataDirectory()).filter((name) => name.endsWith('.json'));
  } catch {
    entries = [];
  }
  for (const entry of entries) {
    const from = path.join(dataDirectory(), entry);
    const to = path.join(targetDirectory, entry);
    fs.copyFileSync(from, to);
    bytes += fs.statSync(to).size;
  }
  if (bytes === 0) throw new Error('Não existe estado JSON para copiar.');
  const manifest = path.join(targetDirectory, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ createdAt: new Date().toISOString(), files: entries, bytes, engine: 'json' }, null, 2), 'utf8');
  return { bytes, file: manifest };
}

export async function triggerLocalBackup(): Promise<BackupOutcome> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return {
      status: 'not_configured',
      engine: 'json',
      file: '',
      bytes: 0,
      sizeMB: 0,
      encrypted: false,
      sha256: '',
      error: 'DATABASE_URL não está configurada. Defina-a para activar o backup PostgreSQL.',
    };
  }

  const directory = path.join(backupRoot(), `postgres-${timestampSlug()}`);
  const plainFile = path.join(directory, 'guigui.dump');
  const key = encryptionKey();
  const finalFile = key ? `${plainFile}.enc` : plainFile;

  try {
    fs.mkdirSync(directory, { recursive: true });
    await runPgDump(databaseUrl, plainFile);
    if (fs.statSync(plainFile).size <= 0) throw new Error('O ficheiro de backup foi criado vazio.');

    if (key) {
      encryptFile(plainFile, finalFile, key);
      // A cópia em claro é removida: deixar o dump original seria inútil.
      fs.rmSync(plainFile, { force: true });
    }
    const bytes = fs.statSync(finalFile).size;
    if (bytes <= 0) throw new Error('O ficheiro de backup ficou vazio após a cifragem.');
    const sha256 = sha256Of(finalFile);
    const replica = replicate(finalFile);

    fs.writeFileSync(
      path.join(directory, 'manifest.json'),
      JSON.stringify({
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        file: path.basename(finalFile),
        bytes,
        engine: 'postgres',
        encrypted: Boolean(key),
        algorithm: key ? 'aes-256-gcm' : null,
        sha256,
        replicatedTo: replica?.target || null,
      }, null, 2),
      'utf8',
    );
    pruneOldBackups();

    return {
      status: 'completed',
      engine: 'postgres',
      file: finalFile,
      bytes,
      sizeMB: Number((bytes / 1_048_576).toFixed(2)),
      encrypted: Boolean(key),
      sha256,
      ...(replica ? { replicatedTo: replica.target } : {}),
      ...(key ? {} : { error: 'Backup SEM CIFRAGEM: defina GUIGUI_BACKUP_ENCRYPTION_KEY para cifrar a cópia.' }),
    };
  } catch (error) {
    // Sem um dump válido, o snapshot JSON ainda dá uma cópia de recuperação útil.
    try {
      const fallbackDirectory = path.join(backupRoot(), `json-${timestampSlug()}`);
      const { bytes, file } = snapshotJson(fallbackDirectory);
      const sha256 = sha256Of(file);
      return {
        status: 'completed',
        engine: 'json',
        file,
        bytes,
        sizeMB: Number((bytes / 1_048_576).toFixed(2)),
        encrypted: false,
        sha256,
        error: `pg_dump falhou (${error instanceof Error ? error.message : 'erro desconhecido'}). Foi gerado apenas o snapshot JSON.`,
      };
    } catch (fallbackError) {
      return {
        status: 'failed',
        engine: 'postgres',
        file: '',
        bytes: 0,
        sizeMB: 0,
        encrypted: false,
        sha256: '',
        error: `${error instanceof Error ? error.message : 'erro desconhecido'} / ${fallbackError instanceof Error ? fallbackError.message : 'sem fallback'}`,
      };
    }
  }
}

/**
 * Agendamento do backup. Sem `GUIGUI_BACKUP_INTERVAL_HOURS` não arranca, para
 * que um ambiente de desenvolvimento não fique a gerar cópias sem parar.
 * Devolve uma função de paragem, como os restantes temporizadores do servidor.
 */
export function startBackupScheduler(run: (outcome: BackupOutcome) => void): () => void {
  const hours = Number(process.env.GUIGUI_BACKUP_INTERVAL_HOURS || 0);
  if (!Number.isFinite(hours) || hours <= 0) return () => undefined;
  const intervalMs = hours * 60 * 60 * 1000;
  const timer = setInterval(() => {
    void triggerLocalBackup().then(run).catch(() => undefined);
  }, intervalMs);
  // Um Node não deve sair por causa de um temporizador de backup.
  timer.unref?.();
  return () => clearInterval(timer);
}

