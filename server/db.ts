import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';

// Ligação principal de runtime: usa DATABASE_URL ou pooler Supabase separado, se configurado.
// Em Serverless, cada instância tem o seu processo/node; por isso os limites são por instância,
// não globais. Não fixo valores de produção sem conhecer o limite real do PostgreSQL/Supabase
// e o número esperado de instâncias; para manter o Guigui.com seguro por omissão, começo com
// limites conservadores elegíveis a revisão.

const connectionString = (process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL)?.trim();

export const databaseConfigured = Boolean(connectionString);

const poolConfig: ConstructorParameters<typeof Pool>[0] = {
  connectionString,
  min: Number(process.env.DATABASE_POOL_MIN || 1),
  max: Number(process.env.DATABASE_POOL_MAX || 5),
  maxUses: Number(process.env.DATABASE_POOL_MAX_USES || 200),
  idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || 30_000),
  connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS || 10_000),
  allowExitOnIdle: false,
};

// Sessão/serverless: protege contra consultas e transacções paradas, e liberta
// clientes ociosos mais cedo para não esgotar o PostgreSQL/Supabase com instâncias stateless.
export const databasePool = connectionString
  ? new Pool({
      ...poolConfig,
    })
  : null;

// Backend/db.Runtime/status de saúde segura e sem vcredenciais.
export const poolState = {
  configured: databaseConfigured,
  created: databasePool ? true : false,
  totalCount: 0,
  idleCount: 0,
  activeCount: 0,
  waitedCount: 0,
  waitedTimeMs: 0,
  acquiredCount: 0,
  releasedCount: 0,
  errorCount: 0,
  releaseCount: 0,
  lastHealthCheckAt: 0,
  lastHealthOk: false,
};

if (databasePool) {
  databasePool.on('connect', () => {
    poolState.acquiredCount += 1;
  });

  databasePool.on('remove', () => {
    poolState.totalCount -= 1;
  });

  databasePool.on('error', (err) => {
    poolState.errorCount += 1;
    console.error(
      '[Guigui.com] Erro inesperado no cliente ocioso do banco de dados (databasePool):',
      err.message,
    );
  });
}

// --- Identidade por pedido (RLS) -------------------------------------------
// Cada consulta corre numa transacção curta com `SET LOCAL ROLE guigui_app` e
// `app.user_id` / `app.role` / `app.business_id`, para que as políticas da
// migração 012 se apliquem sem depender do código Express. Sem identidade no
// contexto (arranque, login, tarefas internas), mantém-se o comportamento
// anterior como `postgres`.
export type DbIdentityRole = 'user' | 'business' | 'admin' | 'anon';

export type DbIdentity = {
  userId: string;
  role: DbIdentityRole;
  businessId?: string;
  /** Tarefas internas (arranque, login, migrações): correm como `postgres`. */
  system?: boolean;
};

const dbIdentityStorage = new AsyncLocalStorage<DbIdentity>();

export function rlsEnabled(): boolean {
  return process.env.RLS_ENABLED === '1';
}

export function withDbIdentity<T>(identity: DbIdentity, callback: () => T): T {
  return dbIdentityStorage.run(identity, callback);
}

export function currentDbIdentity(): DbIdentity | undefined {
  return dbIdentityStorage.getStore();
}

async function applyIdentitySettings(client: PoolClient, identity: DbIdentity): Promise<void> {
  await client.query(
    "SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true), set_config('app.business_id', $3, true)",
    [identity.userId || '', identity.role, identity.businessId || ''],
  );
  if (!identity.system) {
    await client.query('SET LOCAL ROLE guigui_app');
  }
}

async function applySessionIdentity(client: PoolClient, identity: DbIdentity): Promise<void> {
  await client.query(
    "SELECT set_config('app.user_id', $1, false), set_config('app.role', $2, false), set_config('app.business_id', $3, false)",
    [identity.userId || '', identity.role, identity.businessId || ''],
  );
  if (!identity.system) {
    await client.query('SET ROLE guigui_app');
    (client as PoolClient & { __guiguiIdentityApplied?: boolean }).__guiguiIdentityApplied = true;
  }
}

if (databasePool) {
  const rawQuery = databasePool.query.bind(databasePool) as unknown as (
    text: string,
    values?: unknown[],
  ) => Promise<unknown>;
  const identityAwareQuery = async (text: string, values?: unknown[]) => {
    const identity = dbIdentityStorage.getStore();
    if (!rlsEnabled() || !identity || identity.system) {
      return rawQuery(text, values);
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      await applyIdentitySettings(client, identity);
      const result = await client.query(text, values as never);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ligação já fechada */
      }
      throw error;
    } finally {
      client.release();
    }
  };
  // Substitui apenas a entrada `query` do pool: os 24 módulos que importam
  // `databasePool` passam a correr com identidade sem alterações nos call sites.
  (databasePool as unknown as { query: unknown }).query = identityAwareQuery;
}

// Considera valores ambientais de timeout/limite, aplicados em nível de cliente para transações,
// compatível com a versão do pg deste ambiente e sem introduzir type errors no construtor do Pool.
const statementTimeoutMs =
  Number(process.env.DATABASE_POOL_STATEMENT_TIMEOUT_MS ?? 8000);
const idleInTransactionSessionTimeoutMs =
  Number(process.env.DATABASE_POOL_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS ?? 15000);
const lockTimeoutMs = Number(process.env.DATABASE_POOL_LOCK_TIMEOUT_MS ?? 5000);

function applySessionTimeouts(client: PoolClient): void {
  // Definidos apenas se o valor ambiental for explicitamente diferente do padrão, para não
  // sobrescrever configurações globais do PostgreSQL quando não queremos.
  try {
    if (process.env.DATABASE_POOL_STATEMENT_TIMEOUT_MS != null) {
      client.query('SET statement_timeout = $1', [String(statementTimeoutMs)]);
    }
    if (process.env.DATABASE_POOL_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS != null) {
      client.query('SET idle_in_transaction_session_timeout = $1', [
        String(idleInTransactionSessionTimeoutMs),
      ]);
    }
    if (process.env.DATABASE_POOL_LOCK_TIMEOUT_MS != null) {
      client.query('SET lock_timeout = $1', [String(lockTimeoutMs)]);
    }
  } catch {
    /* permissão de configuração num ambiente restrito; ignora e continua */
  }
}

// Abstrai a aquisição de cliente para transações e garante release em qualquer saída.
export async function acquireClient(): Promise<PoolClient> {
  if (!databasePool) {
    throw new Error('PostgreSQL não está configurado para operações transaccionais.');
  }

  const waitedAt = performance.now();
  const client = await databasePool.connect();
  poolState.waitedCount += 1;
  poolState.waitedTimeMs += Math.max(0, performance.now() - waitedAt);
  poolState.activeCount += 1;
  applySessionTimeouts(client);
  // Transacções manuais (acquireClient) herdam a identidade do pedido, para que
  // também nelas valham as políticas da migração 012.
  const identity = dbIdentityStorage.getStore();
  if (rlsEnabled() && identity && !identity.system) {
    try {
      await applySessionIdentity(client, identity);
    } catch (error) {
      // Sem identidade aplicada não se entrega a ligação: evita correr como
      // `postgres` dentro de um pedido autenticado.
      client.release(error instanceof Error ? error : new Error('Falha ao aplicar identidade RLS.'));
      poolState.releaseCount += 1;
      poolState.activeCount = Math.max(0, poolState.activeCount - 1);
      throw error;
    }
  }
  return client;
}

// Usabilidade: liberta cliente adquirido via acquireClient(), evitando releases duplicados.
export async function releaseClient(client: PoolClient | null): Promise<void> {
  if (!client) return;
  const marked = client as PoolClient & { __guiguiIdentityApplied?: boolean };
  try {
    if (marked.__guiguiIdentityApplied) {
      marked.__guiguiIdentityApplied = false;
      try {
        // `SET ROLE` e `set_config(..., false)` são de sessão: repor antes de
        // devolver a ligação ao pool, senão o próximo pedido herdava-os.
        await client.query('RESET ROLE');
        await client.query('RESET ALL');
      } catch {
        // Se a reposição falhar, a ligação não volta ao pool.
        client.release(new Error('Falha ao repor a identidade RLS na ligação.'));
        return;
      }
    }
    client.release();
  } catch {
    /* já libertado ou fechado */
  } finally {
    poolState.releaseCount += 1;
    poolState.activeCount = Math.max(0, poolState.activeCount - 1);
  }
}

// Saúde controlada, sem criar ligações espúrias fora do intervalo.
export let poolHealthTimer: ReturnType<typeof setTimeout> | null = null;
export async function startPoolHealthCheck(intervalMs?: number): Promise<void> {
  if (!databasePool) return;
  const interval = intervalMs ?? Number(process.env.DATABASE_POOL_HEALTH_CHECK_INTERVAL_MS || 30_000);
  poolHealthTimer = setInterval(async () => {
    try {
      const client = await databasePool.connect();
      await client.query('SELECT 1');
      client.release();
      poolState.lastHealthOk = true;
      poolState.lastHealthCheckAt = Date.now();
    } catch (error) {
      poolState.lastHealthOk = false;
      poolState.lastHealthCheckAt = Date.now();
      console.error('[Guigui.com] Verificação de saúde do pool falhou:', error instanceof Error ? error.message : error);
    }
  }, interval);
}

// Encerramento controlado, para arranque/reinício limpos.
export async function endDatabasePool(): Promise<void> {
  if (!databasePool) return;
  if (poolHealthTimer) {
    clearInterval(poolHealthTimer);
    poolHealthTimer = null;
  }
  try {
    await databasePool.end();
  } catch (error) {
    console.error('[Guigui.com] Erro ao encerrar o pool do banco de dados:', error instanceof Error ? error.message : error);
  }
}

// Saúde síncrona-async desejável manual.
export async function checkDatabaseConnection(): Promise<{ configured: boolean; connected: boolean }> {
  if (!databasePool) return { configured: false, connected: false };
  const client = await acquireClient();
  try {
    await client.query('SELECT 1');
    return { configured: true, connected: true };
  } finally {
    await releaseClient(client);
  }
}

// Diagnóstico público (não expõe credenciais): ajuda operação/alerting e sinaliza, sem
// decidir por nós, se a ligação parece ser directa e não pooler, em ambientes Supabase típicos.
export function poolConfigDiagnostic(): {
  ok: boolean;
  poolerLikely: boolean;
  host: string | null;
  database: string | null;
  message: string;
} {
  if (!connectionString) {
    return {
      ok: false,
      poolerLikely: false,
      host: null,
      database: null,
      message: 'DATABASE_URL e DATABASE_POOLER_URL não estão definidas.',
    };
  }

  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const database = url.pathname.replace(/^\//, '') || null;
    const looksLikeSupabaseDirect = host.includes('supabase.co') && !url.pathname.includes('pooler');

    return {
      ok: true,
      poolerLikely: looksLikeSupabaseDirect ? false : undefined !== undefined ? true : false,
      host,
      database,
      message: looksLikeSupabaseDirect
        ? 'Ligação directa detectada num host Supabase típico. Considere usar o pooler Supabase quando estiver disponível.'
        : 'Ligação não parecem ser host Supabase típico directa; usar pooler se disponível e contemplar-se.',
    };
  } catch {
    return {
      ok: true,
      poolerLikely: false,
      host: null,
      database: null,
      message: 'STRING_DE_CONEXAO_INVALIDA.',
    };
  }
}

// Helper de diagnóstico de pool estatal para reads/api admin e health.
export function snapshotPoolDiagnostics(): Record<string, unknown> {
  if (!databasePool) {
    return { configured: false, pool: null, diagnostics: poolConfigDiagnostic() };
  }

  let idleCount = 0;
  let totalCount = 0;
  let activeCount = 0;
  try {
    totalCount = databasePool.totalCount ?? 0;
    idleCount = databasePool.idleCount ?? 0;
    activeCount = totalCount - idleCount;
  } catch {
    /* no disponible */
  }

  poolState.totalCount = totalCount;
  poolState.idleCount = idleCount;
  poolState.activeCount = activeCount;

  return {
    configured: true,
    pool: {
      max: databasePool.options.max,
      min: databasePool.options.min ?? null,
      idleTimeoutMillis: databasePool.options.idleTimeoutMillis,
      connectionTimeoutMillis: databasePool.options.connectionTimeoutMillis,
      maxUses: (databasePool as unknown as { maxUses?: number }).maxUses ?? null,
      total: totalCount,
      idle: idleCount,
      active: activeCount,
    },
    diagnostics: poolConfigDiagnostic(),
    state: {
      acquired: poolState.acquiredCount,
      released: poolState.releaseCount,
      waited: poolState.waitedCount,
      waitedTimeMs: poolState.waitedTimeMs,
      errors: poolState.errorCount,
      lastHealthOk: poolState.lastHealthOk,
      lastHealthCheckAt: poolState.lastHealthCheckAt,
    },
  };
}
