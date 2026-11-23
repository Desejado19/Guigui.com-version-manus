/**
 * Verificação de arranque da versão do esquema.
 *
 * Corre antes de a aplicação carregar, tanto em `npm run dev` (via
 * `server/entrypoint.ts`) como em produção (`dist/platform-preflight.mjs`).
 * Se houver migrações pendentes, o processo termina com código 1 e uma
 * mensagem acionável em vez de deixar o erro aparecer no primeiro pedido.
 *
 * Se a base de dados estiver inacessível no arranque, regista o aviso e deixa
 * a aplicação subir: uma indisponibilidade transitória não deve provocar um
 * ciclo de reinícios. Erros de esquema são determinísticos e bloqueiam.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { describeSchemaStatus, readSchemaStatus, SchemaOutOfDateError } from '../../../schemaVersion';

export async function assertSchemaVersion(
  env: NodeJS.ProcessEnv,
  projectDirectory: string,
): Promise<void> {
  const connectionString = (env.DATABASE_URL || env.DATABASE_POOLER_URL || '').trim();
  if (!connectionString) {
    console.log('[schema] DATABASE_URL ausente: sem verificação de migrações (modo ficheiros JSON).');
    return;
  }

  const migrationsDirectory = resolve(projectDirectory, 'db', 'migrations');
  if (!existsSync(migrationsDirectory)) {
    console.warn('[schema] db/migrations não encontrado: verificação de migrações ignorada.');
    return;
  }

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const status = await readSchemaStatus(pool, migrationsDirectory);
    if (!status.upToDate) {
      throw new SchemaOutOfDateError(status);
    }
    if (status.unknown.length > 0) {
      console.warn(
        `[schema] Registos de migrações sem ficheiro no repositório (ignorados): ${status.unknown.join(', ')}`,
      );
    }
    console.log(`[schema] ${status.applied.length} migração(ões) aplicada(s); esquema actualizado.`);
  } catch (error) {
    if (error instanceof SchemaOutOfDateError) throw error;
    console.warn(
      '[schema] Não foi possível verificar a versão do esquema:',
      error instanceof Error ? error.message : error,
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export { describeSchemaStatus };
