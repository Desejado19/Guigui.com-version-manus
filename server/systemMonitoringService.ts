import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { databasePool, snapshotPoolDiagnostics, withDbIdentity } from './db';
import { resolveEmailConfig } from './email/config';
import { readSmsGatewayConfig } from './smsGatewayService';
import { realtimeStatus } from './realtimeBus';
import { recordSystemLog } from './systemLogService';

/**
 * Monitorização técnica real do Guigui.com.
 *
 * Fontes utilizadas:
 *  - `process.*` e `os.*` para CPU, memória, uptime e carga do processo/host;
 *  - `pg_stat_*`, `pg_database_size`, `pg_locks` e `pg_stat_statements` (se a
 *    extensão existir) para o PostgreSQL;
 *  - `request_metrics` (já alimentada pelo middleware de observabilidade) para
 *    volume, erros e latência por rota;
 *  - `audit_logs` para os eventos de segurança reais;
 *  - configuração de runtime (email, SMS, backups, OAuth, pagamentos) para o
 *    estado dos componentes externos;
 *  - `system_*` para amostras históricas, incidentes, logs e configuração.
 *
 * Quando uma métrica não pode ser recolhida, a resposta diz explicitamente que
 * não está disponível e porquê — nunca inventa valores.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type QueryOutcome<T> = { rows: T[]; error?: string };

async function systemQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryOutcome<T>> {
  if (!databasePool) return { rows: [], error: 'PostgreSQL não está configurado.' };
  try {
    const result = await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
      databasePool!.query(sql, params),
    );
    return { rows: result.rows as T[] };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Erro de consulta desconhecido.' };
  }
}

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const iso = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

// ---------------------------------------------------------------------------
// Amostras do host e do processo
// ---------------------------------------------------------------------------

type HostSnapshot = {
  cpuPercent: number;
  systemCpuPercent: number;
  memoryUsedPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  loadAverage: number[];
  cpuCount: number;
};

let previousProcessCpu = process.cpuUsage();
let previousProcessCpuAt = Date.now();
let previousCpuTimes = os.cpus().map((cpu) => ({ ...cpu.times }));
let latestSample: Record<string, unknown> | null = null;

function processCpuPercent(): number {
  const now = Date.now();
  const usage = process.cpuUsage(previousProcessCpu);
  const elapsedUs = Math.max(1, (now - previousProcessCpuAt) * 1000);
  previousProcessCpu = process.cpuUsage();
  previousProcessCpuAt = now;
  return round(Math.min(100, ((usage.user + usage.system) / elapsedUs) * 100), 2);
}

function systemCpuPercent(): number {
  const current = os.cpus();
  let idleDelta = 0;
  let totalDelta = 0;
  current.forEach((cpu, index) => {
    const previous = previousCpuTimes[index];
    if (!previous) return;
    const idle = cpu.times.idle - previous.idle;
    const total =
      cpu.times.user - previous.user
      + cpu.times.nice - previous.nice
      + cpu.times.sys - previous.sys
      + cpu.times.irq - previous.irq
      + idle;
    idleDelta += idle;
    totalDelta += total;
  });
  previousCpuTimes = current.map((cpu) => ({ ...cpu.times }));
  if (totalDelta <= 0) return 0;
  return round(Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)), 2);
}

function hostSnapshot(): HostSnapshot {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    cpuPercent: processCpuPercent(),
    systemCpuPercent: systemCpuPercent(),
    memoryUsedPercent: total > 0 ? round(((total - free) / total) * 100, 2) : 0,
    totalMemoryBytes: total,
    freeMemoryBytes: free,
    loadAverage: os.loadavg().map((value) => round(value, 2)),
    cpuCount: os.cpus().length,
  };
}

type DatabaseSummary = {
  configured: boolean;
  connected: boolean;
  latencyMs: number | null;
  version: string | null;
  sizeBytes: number | null;
  connections: number | null;
  activeConnections: number | null;
  idleConnections: number | null;
  maxConnections: number | null;
  cacheHitRatioPercent: number | null;
  transactionsCommitted: number | null;
  transactionsRolledBack: number | null;
  deadlocks: number | null;
  waitingLocks: number | null;
  pool: Record<string, unknown> | null;
  error?: string;
};

async function databaseSummary(): Promise<DatabaseSummary> {
  const configured = Boolean(databasePool);
  const base: DatabaseSummary = {
    configured,
    connected: false,
    latencyMs: null,
    version: null,
    sizeBytes: null,
    connections: null,
    activeConnections: null,
    idleConnections: null,
    maxConnections: null,
    cacheHitRatioPercent: null,
    transactionsCommitted: null,
    transactionsRolledBack: null,
    deadlocks: null,
    waitingLocks: null,
    pool: (snapshotPoolDiagnostics().pool as Record<string, unknown> | undefined) || null,
  };
  if (!databasePool) return { ...base, error: 'DATABASE_URL / DATABASE_POOLER_URL não está definida.' };

  const started = performance.now();
  const ping = await systemQuery<{ ok: number }>('SELECT 1 AS ok');
  const latency = round(performance.now() - started, 2);
  if (ping.error) return { ...base, error: ping.error, latencyMs: latency };

  const stats = await systemQuery<Record<string, unknown>>(`
    SELECT
      current_setting('server_version') AS version,
      pg_database_size(current_database())::bigint AS size_bytes,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') AS active_connections,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') AS idle_connections,
      current_setting('max_connections')::int AS max_connections,
      (SELECT count(*)::int FROM pg_locks WHERE NOT granted) AS waiting_locks,
      s.blks_hit, s.blks_read, s.xact_commit, s.xact_rollback, s.deadlocks
    FROM pg_stat_database s
    WHERE s.datname = current_database()
  `);

  if (stats.error || !stats.rows[0]) {
    return { ...base, connected: true, latencyMs: latency, error: stats.error };
  }

  const row = stats.rows[0];
  const hit = numeric(row.blks_hit) ?? 0;
  const read = numeric(row.blks_read) ?? 0;
  return {
    ...base,
    connected: true,
    latencyMs: latency,
    version: row.version ? String(row.version) : null,
    sizeBytes: numeric(row.size_bytes),
    connections: numeric(row.connections),
    activeConnections: numeric(row.active_connections),
    idleConnections: numeric(row.idle_connections),
    maxConnections: numeric(row.max_connections),
    waitingLocks: numeric(row.waiting_locks),
    cacheHitRatioPercent: hit + read > 0 ? round((hit / (hit + read)) * 100, 2) : null,
    transactionsCommitted: numeric(row.xact_commit),
    transactionsRolledBack: numeric(row.xact_rollback),
    deadlocks: numeric(row.deadlocks),
  };
}

// ---------------------------------------------------------------------------
// Disco e armazenamento
// ---------------------------------------------------------------------------

type DiskUsage = {
  available: boolean;
  path: string;
  totalBytes: number | null;
  freeBytes: number | null;
  usedBytes: number | null;
  usedPercent: number | null;
  reason?: string;
};

async function readDiskUsage(directory: string): Promise<DiskUsage> {
  try {
    const stats = await fs.promises.statfs(directory);
    const total = Number(stats.blocks) * Number(stats.bsize);
    const free = Number(stats.bavail) * Number(stats.bsize);
    if (!Number.isFinite(total) || total <= 0) throw new Error('Capacidade do disco não reportada pelo sistema.');
    return {
      available: true,
      path: directory,
      totalBytes: total,
      freeBytes: free,
      usedBytes: total - free,
      usedPercent: round(((total - free) / total) * 100, 2),
    };
  } catch (error) {
    return {
      available: false,
      path: directory,
      totalBytes: null,
      freeBytes: null,
      usedBytes: null,
      usedPercent: null,
      reason: error instanceof Error ? error.message : 'Não foi possível ler o espaço em disco.',
    };
  }
}

type UploadsUsage = { files: number; bytes: number; truncated: boolean; path: string };

let uploadsCache: { at: number; value: UploadsUsage } | null = null;

function readUploadsUsage(): UploadsUsage {
  const directory = path.join(process.cwd(), 'public', 'uploads');
  if (uploadsCache && Date.now() - uploadsCache.at < 60_000) return uploadsCache.value;
  const result: UploadsUsage = { files: 0, bytes: 0, truncated: false, path: directory };
  const walk = (current: string, depth: number) => {
    if (result.files >= 5000) {
      result.truncated = true;
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (result.files >= 5000) {
        result.truncated = true;
        return;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (depth < 4) walk(full, depth + 1);
      } else if (entry.isFile()) {
        try {
          result.files += 1;
          result.bytes += fs.statSync(full).size;
        } catch {
          /* ficheiro removido durante a leitura */
        }
      }
    }
  };
  walk(directory, 0);
  uploadsCache = { at: Date.now(), value: result };
  return result;
}

// ---------------------------------------------------------------------------
// Configuração de monitorização
// ---------------------------------------------------------------------------

export type SystemMonitoringSettings = {
  intervalSeconds: number;
  cpuThreshold: number;
  memoryThreshold: number;
  dbLatencyThresholdMs: number;
  errorRateThreshold: number;
  retentionDays: number;
  sloTarget: number;
  alertsEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

const DEFAULT_SETTINGS: SystemMonitoringSettings = {
  intervalSeconds: 60,
  cpuThreshold: 85,
  memoryThreshold: 90,
  dbLatencyThresholdMs: 500,
  errorRateThreshold: 5,
  retentionDays: 14,
  sloTarget: 99.5,
  alertsEnabled: true,
  updatedAt: null,
  updatedBy: null,
};

function mapSettings(row: Record<string, unknown> | undefined): SystemMonitoringSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    intervalSeconds: numeric(row.interval_seconds) ?? DEFAULT_SETTINGS.intervalSeconds,
    cpuThreshold: numeric(row.cpu_threshold) ?? DEFAULT_SETTINGS.cpuThreshold,
    memoryThreshold: numeric(row.memory_threshold) ?? DEFAULT_SETTINGS.memoryThreshold,
    dbLatencyThresholdMs: numeric(row.db_latency_threshold_ms) ?? DEFAULT_SETTINGS.dbLatencyThresholdMs,
    errorRateThreshold: numeric(row.error_rate_threshold) ?? DEFAULT_SETTINGS.errorRateThreshold,
    retentionDays: numeric(row.retention_days) ?? DEFAULT_SETTINGS.retentionDays,
    sloTarget: numeric(row.slo_target) ?? DEFAULT_SETTINGS.sloTarget,
    alertsEnabled: row.alerts_enabled !== false,
    updatedAt: iso(row.updated_at),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
  };
}

export async function getSystemSettings(): Promise<{
  settings: SystemMonitoringSettings;
  source: 'database' | 'defaults';
  warning?: string;
}> {
  const result = await systemQuery<Record<string, unknown>>(
    'SELECT * FROM system_monitoring_settings WHERE id = 1',
  );
  if (result.error || !result.rows[0]) {
    return {
      settings: DEFAULT_SETTINGS,
      source: 'defaults',
      warning: result.error
        ? `Tabela de configuração indisponível: ${result.error}`
        : 'Configuração por omissão (migração 036 ainda não aplicada).',
    };
  }
  return { settings: mapSettings(result.rows[0]), source: 'database' };
}

export const SYSTEM_SETTINGS_LIMITS = {
  intervalSeconds: [10, 3600],
  cpuThreshold: [1, 100],
  memoryThreshold: [1, 100],
  dbLatencyThresholdMs: [10, 60_000],
  errorRateThreshold: [0, 100],
  retentionDays: [1, 365],
  sloTarget: [90, 100],
} as const;

export async function updateSystemSettings(
  input: Partial<SystemMonitoringSettings>,
  actorName: string,
): Promise<{ settings: SystemMonitoringSettings }> {
  const stored = await getSystemSettings();
  const next = { ...stored.settings, ...input };
  const checks: Array<[keyof typeof SYSTEM_SETTINGS_LIMITS, number]> = [
    ['intervalSeconds', next.intervalSeconds],
    ['cpuThreshold', next.cpuThreshold],
    ['memoryThreshold', next.memoryThreshold],
    ['dbLatencyThresholdMs', next.dbLatencyThresholdMs],
    ['errorRateThreshold', next.errorRateThreshold],
    ['retentionDays', next.retentionDays],
    ['sloTarget', next.sloTarget],
  ];
  for (const [key, value] of checks) {
    const [min, max] = SYSTEM_SETTINGS_LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw Object.assign(new Error(`Valor inválido para ${key}: deve estar entre ${min} e ${max}.`), {
        code: 'SYSTEM_SETTING_INVALID',
      });
    }
  }
  if (!databasePool) {
    throw Object.assign(new Error('PostgreSQL não está configurado; a configuração não pode ser persistida.'), {
      code: 'SYSTEM_MONITORING_UNAVAILABLE',
    });
  }
  if (stored.source === 'defaults') {
    throw Object.assign(
      new Error('Tabela de configuração indisponível. Aplique a migração 036 antes de guardar.'),
      { code: 'SYSTEM_MONITORING_UNAVAILABLE' },
    );
  }
  await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
    databasePool!.query(
      `UPDATE system_monitoring_settings SET
         interval_seconds=$1, cpu_threshold=$2, memory_threshold=$3,
         db_latency_threshold_ms=$4, error_rate_threshold=$5, retention_days=$6,
         slo_target=$7, alerts_enabled=$8, updated_at=NOW(), updated_by=$9
       WHERE id=1`,
      [
        Math.round(next.intervalSeconds),
        next.cpuThreshold,
        next.memoryThreshold,
        Math.round(next.dbLatencyThresholdMs),
        next.errorRateThreshold,
        Math.round(next.retentionDays),
        next.sloTarget,
        Boolean(next.alertsEnabled),
        actorName.slice(0, 160),
      ],
    ),
  );
  return { settings: { ...next, updatedAt: new Date().toISOString(), updatedBy: actorName } };
}

// ---------------------------------------------------------------------------
// Recolha e persistência de amostras
// ---------------------------------------------------------------------------

export type CollectedSample = {
  capturedAt: string;
  cpuPercent: number;
  systemCpuPercent: number;
  rssBytes: number;
  heapUsedBytes: number;
  memoryUsedPercent: number;
  dbHealthy: boolean;
  dbLatencyMs: number | null;
  dbConnections: number | null;
  dbSizeBytes: number | null;
  requestsToday: number | null;
  errorsToday: number | null;
};

function todayRequestTotals(): Promise<QueryOutcome<{ requests: number; errors: number }>> {
  return systemQuery<{ requests: number; errors: number }>(
    `SELECT COALESCE(SUM(request_count),0)::int AS requests,
            COALESCE(SUM(error_count),0)::int AS errors
       FROM request_metrics WHERE metric_date = CURRENT_DATE`,
  );
}

async function collectSample(persist: boolean): Promise<CollectedSample> {
  const host = hostSnapshot();
  const memory = process.memoryUsage();
  const db = await databaseSummary();
  const totals = await todayRequestTotals();
  const sample: CollectedSample = {
    capturedAt: new Date().toISOString(),
    cpuPercent: host.cpuPercent,
    systemCpuPercent: host.systemCpuPercent,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    memoryUsedPercent: host.memoryUsedPercent,
    dbHealthy: db.connected,
    dbLatencyMs: db.latencyMs,
    dbConnections: db.connections,
    dbSizeBytes: db.sizeBytes,
    requestsToday: totals.error ? null : (numeric(totals.rows[0]?.requests) ?? 0),
    errorsToday: totals.error ? null : (numeric(totals.rows[0]?.errors) ?? 0),
  };

  if (persist && databasePool) {
    const inserted = await systemQuery<{ id: string }>(
      `INSERT INTO system_metric_samples
        (cpu_percent, system_cpu_percent, rss_bytes, heap_used_bytes, memory_used_percent,
         db_healthy, db_latency_ms, db_connections, db_size_bytes, requests_today, errors_today)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id::text`,
      [
        sample.cpuPercent,
        sample.systemCpuPercent,
        sample.rssBytes,
        sample.heapUsedBytes,
        sample.memoryUsedPercent,
        sample.dbHealthy,
        sample.dbLatencyMs,
        sample.dbConnections,
        sample.dbSizeBytes,
        sample.requestsToday,
        sample.errorsToday,
      ],
    );
    if (!inserted.error) latestSample = sample as unknown as Record<string, unknown>;
  }
  return sample;
}

/** Executa a recolha sem persistir (usado pelo overview quando ainda não há histórico). */
export async function measureNow(): Promise<CollectedSample> {
  return collectSample(false);
}

// ---------------------------------------------------------------------------
// Incidentes automáticos a partir dos limites configurados
// ---------------------------------------------------------------------------

type AlertDecision = {
  dedupeKey: string;
  active: boolean;
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  service: string;
  category: string;
  probableCause: string;
};

function decideAlerts(sample: CollectedSample, settings: SystemMonitoringSettings): AlertDecision[] {
  const decisions: AlertDecision[] = [];
  decisions.push({
    dedupeKey: 'auto:cpu',
    active: sample.cpuPercent >= settings.cpuThreshold,
    severity: sample.cpuPercent >= settings.cpuThreshold * 1.2 ? 'critical' : 'warning',
    title: 'CPU do processo acima do limite',
    description: `O processo usou ${sample.cpuPercent}% de CPU, acima do limite configurado de ${settings.cpuThreshold}%.`,
    service: 'api',
    category: 'performance',
    probableCause: 'Carga elevada, consulta pesada ou processamento síncrono.',
  });
  decisions.push({
    dedupeKey: 'auto:memory',
    active: sample.memoryUsedPercent >= settings.memoryThreshold,
    severity: sample.memoryUsedPercent >= settings.memoryThreshold * 1.1 ? 'critical' : 'warning',
    title: 'Memória do host acima do limite',
    description: `A memória em uso no host está em ${sample.memoryUsedPercent}%, acima do limite de ${settings.memoryThreshold}%.`,
    service: 'api',
    category: 'performance',
    probableCause: 'Consumo elevado do processo ou de outro serviço no mesmo host.',
  });
  if (sample.dbHealthy) {
    decisions.push({
      dedupeKey: 'auto:db_latency',
      active: (sample.dbLatencyMs ?? 0) >= settings.dbLatencyThresholdMs,
      severity: (sample.dbLatencyMs ?? 0) >= settings.dbLatencyThresholdMs * 3 ? 'critical' : 'warning',
      title: 'Latência do PostgreSQL acima do limite',
      description: `A verificação atômica à base de dados demorou ${sample.dbLatencyMs} ms (limite: ${settings.dbLatencyThresholdMs} ms).`,
      service: 'postgresql',
      category: 'database',
      probableCause: 'Consultas concorrentes, locks ou contenção de recursos no servidor de base de dados.',
    });
  }
  const totalsKnown = sample.requestsToday !== null && sample.errorsToday !== null && sample.requestsToday >= 20;
  const errorRate = totalsKnown ? (sample.errorsToday! / sample.requestsToday!) * 100 : 0;
  decisions.push({
    dedupeKey: 'auto:error_rate',
    active: totalsKnown && errorRate >= settings.errorRateThreshold,
    severity: errorRate >= settings.errorRateThreshold * 2 ? 'critical' : 'warning',
    title: 'Taxa de erro HTTP acima do limite',
    description: `A taxa de erros de hoje é ${round(errorRate, 2)}% (limite: ${settings.errorRateThreshold}%).`,
    service: 'api',
    category: 'availability',
    probableCause: 'Falhas em endpoints, dependências indisponíveis ou pedidos inválidos em volume.',
  });
  return decisions;
}

async function applyAutomaticAlerts(sample: CollectedSample, settings: SystemMonitoringSettings): Promise<void> {
  if (settings.alertsEnabled) {
    for (const decision of decideAlerts(sample, settings)) {
      const existing = await systemQuery<{ id: string }>(
        `SELECT id FROM system_incidents WHERE dedupe_key=$1 AND status <> 'resolved' LIMIT 1`,
        [decision.dedupeKey],
      );
      if (existing.error) return;
      if (decision.active && !existing.rows[0]) {
        const id = `SYS-${Date.now()}-${decision.dedupeKey.split(':')[1]}`;
        const inserted = await systemQuery<{ id: string }>(
          `INSERT INTO system_incidents
             (id, title, description, category, severity, service, source, status, probable_cause, dedupe_key, detected_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'automatic','open',$7,$8,NOW(),NOW())
           RETURNING id`,
          [
            id,
            decision.title,
            decision.description,
            decision.category,
            decision.severity,
            decision.service,
            decision.probableCause,
            decision.dedupeKey,
          ],
        );
        if (!inserted.error) {
          await systemQuery(
            `INSERT INTO system_incident_events (incident_id, event_type, message, actor)
             VALUES ($1,'detected',$2,'monitorização automática')`,
            [id, decision.description],
          );
          void recordSystemLog({
            level: decision.severity === 'critical' ? 'error' : 'warn',
            service: 'monitoring',
            message: decision.title,
            context: { alert: decision.dedupeKey, service: decision.service, severity: decision.severity },
          });
        }
      } else if (!decision.active && existing.rows[0]) {
        const incidentId = existing.rows[0].id;
        await systemQuery(
          `UPDATE system_incidents
              SET status='resolved', resolved_at=NOW(), updated_at=NOW(),
                  resolution='Recuperação automática: a métrica voltou ao intervalo configurado.'
            WHERE id=$1`,
          [incidentId],
        );
        await systemQuery(
          `INSERT INTO system_incident_events (incident_id, event_type, message, actor)
           VALUES ($1,'recovered','A métrica voltou ao intervalo configurado.','monitorização automática')`,
          [incidentId],
        );
      }
    }
  }

  const unavailable = await systemQuery<{ id: string }>(
    `SELECT id FROM system_incidents WHERE dedupe_key='auto:db_unavailable' AND status <> 'resolved' LIMIT 1`,
  );
  if (unavailable.error) return;
  if (!sample.dbHealthy) {
    if (!unavailable.rows[0]) {
      const id = `SYS-${Date.now()}-db`;
      const inserted = await systemQuery(
        `INSERT INTO system_incidents
           (id, title, description, category, severity, service, source, status, probable_cause, dedupe_key, detected_at, updated_at)
         VALUES ($1,'PostgreSQL indisponível','A verificação de saúde da base de dados falhou.',
                 'database','critical','postgresql','automatic','open',
                 'Ligação recusada, pool esgotado ou servidor de base de dados em baixo.',
                 'auto:db_unavailable',NOW(),NOW())`,
        [id],
      );
      if (!inserted.error) {
        await systemQuery(
          `INSERT INTO system_incident_events (incident_id, event_type, message, actor)
           VALUES ($1,'detected','A verificação de saúde da base de dados falhou.','monitorização automática')`,
          [id],
        );
      }
    }
  } else if (unavailable.rows[0]) {
    await systemQuery(
      `UPDATE system_incidents SET status='resolved', resolved_at=NOW(), updated_at=NOW(),
         resolution='Base de dados novamente acessível.' WHERE id=$1`,
      [unavailable.rows[0].id],
    );
    await systemQuery(
      `INSERT INTO system_incident_events (incident_id, event_type, message, actor)
       VALUES ($1,'recovered','Base de dados novamente acessível.','monitorização automática')`,
      [unavailable.rows[0].id],
    );
  }
}

async function persistDailyTableMetrics(): Promise<void> {
  const tables = await systemQuery<{ table_name: string; total_bytes: number; row_estimate: number }>(
    `SELECT relname AS table_name,
            pg_total_relation_size(relid)::bigint AS total_bytes,
            n_live_tup::bigint AS row_estimate
       FROM pg_stat_user_tables`,
  );
  if (tables.error) return;
  for (const table of tables.rows) {
    await systemQuery(
      `INSERT INTO system_table_metrics (captured_on, table_name, total_bytes, row_estimate)
       VALUES (CURRENT_DATE,$1,$2,$3)
       ON CONFLICT (captured_on, table_name) DO UPDATE
         SET total_bytes=EXCLUDED.total_bytes, row_estimate=EXCLUDED.row_estimate`,
      [table.table_name, numeric(table.total_bytes) ?? 0, numeric(table.row_estimate) ?? 0],
    );
  }
}

async function applyRetention(settings: SystemMonitoringSettings): Promise<void> {
  await systemQuery(
    `DELETE FROM system_metric_samples WHERE captured_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [settings.retentionDays],
  );
  await systemQuery(
    `DELETE FROM system_table_metrics WHERE captured_on < CURRENT_DATE - $1::int`,
    [settings.retentionDays * 2],
  );
  await systemQuery(
    `DELETE FROM system_logs WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [settings.retentionDays],
  );
}

let monitorTimer: ReturnType<typeof setTimeout> | null = null;
let monitorStarted = false;
let lastCycleAt: string | null = null;

export function systemMonitorStatus(): {
  running: boolean;
  lastCycleAt: string | null;
  intervalSeconds: number | null;
} {
  return {
    running: monitorStarted,
    lastCycleAt,
    intervalSeconds: monitorTimer ? currentIntervalSeconds : null,
  };
}

let currentIntervalSeconds: number | null = null;

async function monitorCycle(): Promise<void> {
  const { settings } = await getSystemSettings();
  currentIntervalSeconds = settings.intervalSeconds;
  const sample = await collectSample(true);
  await applyAutomaticAlerts(sample, settings);
  await persistDailyTableMetrics();
  lastCycleAt = new Date().toISOString();
}

/** Arranca o ciclo de monitorização. Idempotente. */
export function startSystemMonitor(): void {
  if (monitorStarted || !databasePool) return;
  monitorStarted = true;
  const schedule = (delayMs: number) => {
    monitorTimer = setTimeout(async () => {
      try {
        await monitorCycle();
      } catch (error) {
        console.error(
          '[Guigui.com] Ciclo de monitorização falhou:',
          error instanceof Error ? error.message : error,
        );
      }
      const { settings } = await getSystemSettings();
      currentIntervalSeconds = settings.intervalSeconds;
      schedule(settings.intervalSeconds * 1000);
    }, delayMs);
    monitorTimer.unref?.();
  };
  // Primeira recolha imediata; retenção corre uma vez por arranque.
  void (async () => {
    try {
      await monitorCycle();
      const { settings } = await getSystemSettings();
      await applyRetention(settings);
    } catch (error) {
      console.error('[Guigui.com] Recolha inicial de monitorização falhou:', error);
    }
    const { settings } = await getSystemSettings();
    currentIntervalSeconds = settings.intervalSeconds;
    schedule(settings.intervalSeconds * 1000);
  })();
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

export type SystemMetricDescriptor = {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  status: 'measured' | 'unavailable';
  source: string;
  updatedAt: string | null;
  note?: string;
};

async function requestWindow(hours: number): Promise<QueryOutcome<{
  requests: number;
  errors: number;
  totalDurationMs: number;
  routes: number;
}>> {
  return systemQuery(
    `SELECT COALESCE(SUM(request_count),0)::int AS requests,
            COALESCE(SUM(error_count),0)::int AS errors,
            COALESCE(SUM(total_duration_ms),0)::bigint AS "totalDurationMs",
            COUNT(DISTINCT route)::int AS routes
       FROM request_metrics
      WHERE metric_date >= CURRENT_DATE - GREATEST(1, CEIL($1::int / 24.0))::int`,
    [hours],
  );
}

export async function getSystemOverview() {
  const generatedAt = new Date().toISOString();
  const { settings, source: settingsSource, warning: settingsWarning } = await getSystemSettings();
  const sample = await measureNow();
  const db = await databaseSummary();
  const disk = await readDiskUsage(process.cwd());
  const window = await requestWindow(24);
  const requests = window.error ? null : numeric(window.rows[0]?.requests) ?? 0;
  const errors = window.error ? null : numeric(window.rows[0]?.errors) ?? 0;
  const totalDuration = window.error ? null : numeric(window.rows[0]?.totalDurationMs) ?? 0;
  const routes = window.error ? null : numeric(window.rows[0]?.routes) ?? 0;

  const incidentCounts = await systemQuery<{ status: string; severity: string; count: number }>(
    `SELECT status, severity, count(*)::int AS count FROM system_incidents GROUP BY status, severity`,
  );
  const counts = { open: 0, acknowledged: 0, resolved: 0, critical: 0, warning: 0 };
  if (!incidentCounts.error) {
    for (const row of incidentCounts.rows) {
      const count = numeric(row.count) ?? 0;
      if (row.status === 'open') counts.open += count;
      else if (row.status === 'acknowledged') counts.acknowledged += count;
      else if (row.status === 'resolved') counts.resolved += count;
      if (row.status !== 'resolved' && row.severity === 'critical') counts.critical += count;
      if (row.status !== 'resolved' && row.severity === 'warning') counts.warning += count;
    }
  }

  const latest = await systemQuery<Record<string, unknown>>(
    'SELECT * FROM system_metric_samples ORDER BY captured_at DESC LIMIT 1',
  );
  const history = await systemQuery<Record<string, unknown>>(
    `SELECT
       count(*)::int AS samples,
       count(*) FILTER (WHERE db_healthy)::int AS healthy,
       min(captured_at) AS first_at
     FROM system_metric_samples
     WHERE captured_at >= NOW() - INTERVAL '24 hours'`,
  );
  const samples = numeric(history.rows[0]?.samples) ?? 0;
  const healthy = numeric(history.rows[0]?.healthy) ?? 0;

  const components = await buildComponents(db, disk);
  const operational = components.filter((component) => component.status === 'operational').length;
  const degraded = components.filter((component) => component.status === 'degraded').length;
  const unavailableComponents = components.filter((component) => component.status === 'unavailable').length;

  const alerts = await systemQuery<Record<string, unknown>>(
    `SELECT id, title, description, severity, service, detected_at
       FROM system_incidents WHERE status <> 'resolved'
      ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
               detected_at DESC LIMIT 8`,
  );

  const errorRate = requests && errors !== null ? round((errors / requests) * 100, 2) : null;
  const averageLatency = requests && totalDuration !== null ? round(totalDuration / requests, 2) : null;

  const status: 'operational' | 'degraded' | 'unavailable' =
    db.configured && !db.connected
      ? 'unavailable'
      : counts.critical > 0 || degraded > 0 || unavailableComponents > 0
        ? 'degraded'
        : 'operational';

  const metrics: SystemMetricDescriptor[] = [
    {
      key: 'cpu',
      label: 'CPU do processo',
      value: sample.cpuPercent,
      unit: '%',
      status: 'measured',
      source: 'process.cpuUsage()',
      updatedAt: generatedAt,
    },
    {
      key: 'memory',
      label: 'Memória do host',
      value: sample.memoryUsedPercent,
      unit: '%',
      status: 'measured',
      source: 'os.totalmem()/os.freemem()',
      updatedAt: generatedAt,
    },
    {
      key: 'db_latency',
      label: 'Latência PostgreSQL',
      value: db.latencyMs,
      unit: 'ms',
      status: db.connected ? 'measured' : 'unavailable',
      source: 'SELECT 1 (medição direta)',
      updatedAt: generatedAt,
      note: db.connected ? undefined : 'Base de dados indisponível ou não configurada.',
    },
    {
      key: 'requests',
      label: 'Requisições (24h)',
      value: requests,
      unit: 'req',
      status: window.error ? 'unavailable' : 'measured',
      source: 'request_metrics (middleware HTTP)',
      updatedAt: generatedAt,
      note: window.error,
    },
    {
      key: 'errors',
      label: 'Erros HTTP (24h)',
      value: errors,
      unit: 'req',
      status: window.error ? 'unavailable' : 'measured',
      source: 'request_metrics (middleware HTTP)',
      updatedAt: generatedAt,
      note: window.error,
    },
    {
      key: 'network',
      label: 'Tráfego de rede',
      value: null,
      unit: 'bytes/s',
      status: 'unavailable',
      source: '—',
      updatedAt: null,
      note: 'O runtime Node.js não expõe contadores por interface. Requer agente externo (por exemplo node_exporter) para medir tráfego real.',
    },
    {
      key: 'disk_io',
      label: 'I/O de disco',
      value: null,
      unit: 'ops/s',
      status: 'unavailable',
      source: '—',
      updatedAt: null,
      note: 'Não existe instrumentação de I/O no processo. A ocupação de disco é medida, mas não a taxa de operações.',
    },
  ];

  return {
    generatedAt,
    status,
    period: { label: '24 horas', hours: 24 },
    services: {
      total: components.length,
      operational,
      degraded,
      unavailable: unavailableComponents,
      notConfigured: components.filter((component) => component.status === 'not_configured' || component.status === 'simulated').length,
    },
    incidents: counts,
    availability: {
      percent: samples > 0 ? round((healthy / samples) * 100, 2) : null,
      samples,
      healthySamples: healthy,
      firstSampleAt: iso(history.rows[0]?.first_at),
      note:
        samples > 0
          ? 'Calculada a partir das amostras de monitorização das últimas 24 horas. Períodos sem processo em execução não geram amostras.'
          : 'Dados insuficientes: ainda não existem amostras de monitorização.',
    },
    requests: {
      total: requests,
      errors,
      errorRatePercent: errorRate,
      averageLatencyMs: averageLatency,
      routes,
      windowHours: 24,
      source: 'request_metrics',
      warning: window.error,
    },
    process: {
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuPercent: sample.cpuPercent,
      systemCpuPercent: sample.systemCpuPercent,
      rssBytes: sample.rssBytes,
      heapUsedBytes: sample.heapUsedBytes,
      heapTotalBytes: process.memoryUsage().heapTotal,
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg().map((value) => round(value, 2)),
    },
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      usedPercent: sample.memoryUsedPercent,
    },
    database: db,
    disk,
    alerts: alerts.error
      ? []
      : alerts.rows.map((row) => ({
          id: String(row.id),
          title: String(row.title),
          description: String(row.description),
          severity: String(row.severity),
          service: String(row.service),
          detectedAt: iso(row.detected_at),
        })),
    components,
    metrics,
    settings: { ...settings, source: settingsSource, warning: settingsWarning },
    monitor: systemMonitorStatus(),
    warnings: [settingsWarning, window.error, history.error, incidentCounts.error, alerts.error].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Infraestrutura
// ---------------------------------------------------------------------------

export type SystemComponent = {
  id: string;
  name: string;
  type: string;
  status: 'operational' | 'degraded' | 'unavailable' | 'not_configured' | 'simulated';
  source: string;
  lastCheckedAt: string;
  version: string | null;
  dependencies: string[];
  metricsSupported: string[];
  notes: string;
};

function lastBackupFromDisk(): { id: string; status: string; timestamp: string; sizeMB: number | null } | null {
  const directory = process.env.GUIGUI_DATA_DIR || path.resolve(process.cwd(), 'data');
  try {
    const raw = fs.readFileSync(path.join(directory, 'backup-logs.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = parsed[0] as Record<string, unknown>;
    return {
      id: String(first.id || '—'),
      status: String(first.status || 'unknown'),
      timestamp: String(first.timestamp || ''),
      sizeMB: numeric(first.sizeMB),
    };
  } catch {
    return null;
  }
}

async function buildComponents(db: DatabaseSummary, disk: DiskUsage): Promise<SystemComponent[]> {
  const now = new Date().toISOString();
  const components: SystemComponent[] = [];
  const realtime = realtimeStatus();
  const email = resolveEmailConfig();
  const sms = readSmsGatewayConfig();
  const backupInterval = Number(process.env.GUIGUI_BACKUP_INTERVAL_HOURS || 0);
  const lastBackup = lastBackupFromDisk();

  components.push({
    id: 'frontend',
    name: 'Frontend (SPA)',
    type: 'application',
    status: 'operational',
    source: 'Servido pelo mesmo processo Express (Vite em desenvolvimento, dist em produção)',
    lastCheckedAt: now,
    version: process.env.npm_package_version || null,
    dependencies: ['api'],
    metricsSupported: ['Disponibilidade do processo', 'Requisições por rota'],
    notes: 'Não existe CDN configurada: os assets são servidos pelo próprio backend.',
  });

  components.push({
    id: 'api',
    name: 'API / Backend',
    type: 'application',
    status: 'operational',
    source: 'processo Node.js em execução',
    lastCheckedAt: now,
    version: `${process.version} (Node.js)`,
    dependencies: db.configured ? ['postgresql'] : [],
    metricsSupported: ['CPU do processo', 'Memória', 'Uptime', 'Requisições', 'Erros', 'Latência'],
    notes: `PID ${process.pid} · ${process.platform}/${process.arch}.`,
  });

  components.push({
    id: 'postgresql',
    name: 'PostgreSQL',
    type: 'database',
    status: db.configured ? (db.connected ? 'operational' : 'unavailable') : 'not_configured',
    source: 'pg (databasePool) + pg_stat_*',
    lastCheckedAt: now,
    version: db.version,
    dependencies: [],
    metricsSupported: ['Conexões', 'Latência', 'Tamanho', 'Cache hit', 'Transações', 'Locks', 'Tabelas'],
    notes: db.configured
      ? db.connected
        ? `Latência ${db.latencyMs} ms · ${db.connections ?? '—'} ligações.`
        : db.error || 'Sem ligação.'
      : 'DATABASE_URL não definida: a plataforma corre em modo local.',
  });

  components.push({
    id: 'storage',
    name: 'Armazenamento de uploads',
    type: 'storage',
    status: disk.available ? 'operational' : 'degraded',
    source: 'sistema de ficheiros local (public/uploads)',
    lastCheckedAt: now,
    version: null,
    dependencies: [],
    metricsSupported: ['Ficheiros', 'Bytes armazenados', 'Espaço livre'],
    notes: disk.available
      ? `Disco ${disk.path}: ${disk.usedPercent}% usado. Não existe storage externo (S3/R2) configurado.`
      : `Espaço em disco não medido: ${disk.reason}`,
  });

  components.push({
    id: 'realtime',
    name: 'Realtime (LISTEN/NOTIFY)',
    type: 'messaging',
    status: realtime.connected === true ? 'operational' : db.connected ? 'degraded' : 'unavailable',
    source: 'server/realtimeBus.ts (canal PostgreSQL)',
    lastCheckedAt: now,
    version: null,
    dependencies: ['postgresql'],
    metricsSupported: ['Estado da subscrição', 'Reconexões'],
    notes: `Canal ${String(realtime.channel || '—')}; reconexões: ${String(realtime.reconnects ?? 0)}.`,
  });

  components.push({
    id: 'email',
    name: 'Email transacional',
    type: 'external',
    status: email.ready ? 'operational' : 'not_configured',
    source: 'server/email/config.ts',
    lastCheckedAt: now,
    version: email.config?.provider || null,
    dependencies: [],
    metricsSupported: ['Configuração', 'Modo de entrega'],
    notes: email.ready
      ? `Fornecedor ${email.config?.provider}; modo ${email.config?.mode}.`
      : email.reason || email.issues[0] || 'Sem fornecedor de email configurado.',
  });

  components.push({
    id: 'sms',
    name: 'Gateway SMS',
    type: 'external',
    status: sms.mode === 'simulated' ? 'simulated' : 'operational',
    source: 'server/smsGatewayService.ts',
    lastCheckedAt: now,
    version: null,
    dependencies: [],
    metricsSupported: ['Modo de entrega'],
    notes:
      sms.mode === 'simulated'
        ? 'Modo simulado: nenhum SMS real é enviado (GUIGUI_SMS_GATEWAY_URL/KEY não configurados).'
        : `Modo ${sms.mode}; endpoint configurado.`,
  });

  components.push({
    id: 'payments',
    name: 'Pagamentos (Orange Money / Telecel)',
    type: 'external',
    status: 'simulated',
    source: 'server/paymentService.ts',
    lastCheckedAt: now,
    version: null,
    dependencies: [],
    metricsSupported: ['Estado do adaptador'],
    notes:
      'Os adaptadores ativos são simulados: nenhuma operadora real é contactada. Não é executada qualquer transação para testar disponibilidade.',
  });

  components.push({
    id: 'google-oauth',
    name: 'Google OAuth',
    type: 'external',
    status: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID ? 'operational' : 'not_configured',
    source: 'server/googleOAuthRoutes.ts',
    lastCheckedAt: now,
    version: null,
    dependencies: [],
    metricsSupported: ['Configuração'],
    notes: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
      ? 'Client ID configurado. A disponibilidade do fornecedor não é sondada ativamente.'
      : 'GOOGLE_CLIENT_ID não definido.',
  });

  components.push({
    id: 'ai',
    name: 'Serviço de IA (Gemini)',
    type: 'external',
    status: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ? 'operational'
      : 'not_configured',
    source: 'server.ts (getAIClient)',
    lastCheckedAt: now,
    version: null,
    dependencies: [],
    metricsSupported: ['Configuração'],
    notes: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ? 'Chave presente. As chamadas são contabilizadas pela aplicação, não sondadas.'
      : 'GEMINI_API_KEY não definida.',
  });

  components.push({
    id: 'backups',
    name: 'Backups',
    type: 'process',
    status: backupInterval > 0 ? 'operational' : 'not_configured',
    source: 'server/backupService.ts + data/backup-logs.json',
    lastCheckedAt: now,
    version: null,
    dependencies: ['postgresql'],
    metricsSupported: ['Agendamento', 'Último backup'],
    notes: lastBackup
      ? `Último backup ${lastBackup.id}: ${lastBackup.status} em ${lastBackup.timestamp}${lastBackup.sizeMB ? ` (${lastBackup.sizeMB} MB)` : ''}.`
      : backupInterval > 0
        ? `Agendado a cada ${backupInterval}h; ainda sem execução registada.`
        : 'Sem agendamento (GUIGUI_BACKUP_INTERVAL_HOURS não definido).',
  });

  return components;
}

export async function getSystemInfrastructure() {
  const db = await databaseSummary();
  const disk = await readDiskUsage(process.cwd());
  const components = await buildComponents(db, disk);
  return {
    generatedAt: new Date().toISOString(),
    components,
    database: db,
    disk,
    warnings: db.error ? [db.error] : [],
  };
}

// ---------------------------------------------------------------------------
// Recursos e capacidade
// ---------------------------------------------------------------------------

export async function getSystemResources(hours: number) {
  const boundedHours = [1, 6, 24, 72, 168].includes(hours) ? hours : 24;
  const db = await databaseSummary();
  const disk = await readDiskUsage(process.cwd());
  const uploads = readUploadsUsage();
  const sample = await measureNow();
  const series = await systemQuery<Record<string, unknown>>(
    `SELECT captured_at, cpu_percent, system_cpu_percent, rss_bytes, heap_used_bytes,
            memory_used_percent, db_latency_ms, db_size_bytes, requests_today, errors_today
       FROM system_metric_samples
      WHERE captured_at >= NOW() - ($1::int * INTERVAL '1 hour')
      ORDER BY captured_at ASC`,
    [boundedHours],
  );

  const points = series.rows.map((row) => ({
    capturedAt: iso(row.captured_at),
    cpuPercent: numeric(row.cpu_percent),
    systemCpuPercent: numeric(row.system_cpu_percent),
    rssBytes: numeric(row.rss_bytes),
    heapUsedBytes: numeric(row.heap_used_bytes),
    memoryUsedPercent: numeric(row.memory_used_percent),
    dbLatencyMs: numeric(row.db_latency_ms),
    dbSizeBytes: numeric(row.db_size_bytes),
    requestsToday: numeric(row.requests_today),
    errorsToday: numeric(row.errors_today),
  }));

  const cpuSamples = points.map((point) => point.cpuPercent).filter((value): value is number => value !== null);
  const memorySamples = points.map((point) => point.memoryUsedPercent).filter((value): value is number => value !== null);
  const dbLatencySamples = points.map((point) => point.dbLatencyMs).filter((value): value is number => value !== null);

  return {
    generatedAt: new Date().toISOString(),
    period: { hours: boundedHours },
    host: {
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || null,
      platform: process.platform,
      arch: process.arch,
      loadAverage: os.loadavg().map((value) => round(value, 2)),
      uptimeSeconds: Math.round(os.uptime()),
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      memoryUsedPercent: sample.memoryUsedPercent,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      cpuPercent: sample.cpuPercent,
      rssBytes: sample.rssBytes,
      heapUsedBytes: sample.heapUsedBytes,
      heapTotalBytes: process.memoryUsage().heapTotal,
      externalBytes: process.memoryUsage().external,
    },
    summary: {
      cpuAvg: cpuSamples.length ? round(cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length, 2) : null,
      cpuPeak: cpuSamples.length ? round(Math.max(...cpuSamples), 2) : null,
      memoryAvg: memorySamples.length ? round(memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length, 2) : null,
      memoryPeak: memorySamples.length ? round(Math.max(...memorySamples), 2) : null,
      dbLatencyAvg: dbLatencySamples.length ? round(dbLatencySamples.reduce((a, b) => a + b, 0) / dbLatencySamples.length, 2) : null,
      dbLatencyPeak: dbLatencySamples.length ? round(Math.max(...dbLatencySamples), 2) : null,
    },
    disk,
    uploads: { ...uploads, bytesLabel: `${round(uploads.bytes / (1024 * 1024), 2)} MB` },
    capacity: {
      databaseBytes: db.sizeBytes,
      uploadsBytes: uploads.bytes,
      diskTotalBytes: disk.totalBytes,
      diskFreeBytes: disk.freeBytes,
      diskUsedPercent: disk.usedPercent,
      samplesStored: points.length,
    },
    series: points,
    unsupported: [
      {
        metric: 'Tráfego de rede por interface',
        reason: 'O Node.js não expõe contadores de bytes por interface. Requer agente externo (node_exporter, netstat periódico ou métricas do alojamento).',
      },
      {
        metric: 'I/O de disco (operações/segundo)',
        reason: 'Não existe instrumentação de I/O no processo. Só a ocupação do disco é mensurável.',
      },
      {
        metric: 'Limites de CPU/RAM do contentor',
        reason: 'O runtime não lê os limites do orchestrator. A memória disponível é a do host reportado pelo sistema operativo.',
      },
    ],
    warnings: [series.error, db.error].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Base de dados
// ---------------------------------------------------------------------------

export async function getSystemDatabase() {
  const db = await databaseSummary();
  const generatedAt = new Date().toISOString();
  const tables = await systemQuery<Record<string, unknown>>(
    `SELECT relname AS table_name,
            pg_total_relation_size(relid)::bigint AS total_bytes,
            pg_indexes_size(relid)::bigint AS index_bytes,
            n_live_tup::bigint AS row_estimate,
            seq_scan::bigint AS seq_scans,
            idx_scan::bigint AS index_scans
       FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 25`,
  );
  const growth = await systemQuery<Record<string, unknown>>(
    `SELECT table_name,
            min(captured_on)::text AS first_day,
            max(captured_on)::text AS last_day,
            (array_agg(total_bytes ORDER BY captured_on ASC))[1]::bigint AS first_bytes,
            (array_agg(total_bytes ORDER BY captured_on DESC))[1]::bigint AS last_bytes
       FROM system_table_metrics
      WHERE captured_on >= CURRENT_DATE - 30
      GROUP BY table_name`,
  );
  const growthByTable = new Map<string, { firstDay: string; lastDay: string; firstBytes: number; lastBytes: number }>();
  for (const row of growth.rows) {
    growthByTable.set(String(row.table_name), {
      firstDay: String(row.first_day),
      lastDay: String(row.last_day),
      firstBytes: numeric(row.first_bytes) ?? 0,
      lastBytes: numeric(row.last_bytes) ?? 0,
    });
  }

  const statStatements = await systemQuery<{ present: number }>(
    `SELECT count(*)::int AS present FROM pg_extension WHERE extname = 'pg_stat_statements'`,
  );
  let slowQueries: {
    available: boolean;
    reason?: string;
    items: Array<{ query: string; calls: number; meanMs: number; totalMs: number }>;
  } = {
    available: false,
    reason: 'A extensão pg_stat_statements não está instalada; o histórico agregado de queries não está disponível.',
    items: [],
  };
  if (!statStatements.error && numeric(statStatements.rows[0]?.present) === 1) {
    const queries = await systemQuery<Record<string, unknown>>(
      `SELECT query, calls::bigint AS calls,
              mean_exec_time::numeric AS mean_ms,
              total_exec_time::numeric AS total_ms
         FROM pg_stat_statements
        WHERE query NOT ILIKE '%pg_stat_statements%'
        ORDER BY mean_exec_time DESC
        LIMIT 10`,
    );
    slowQueries = queries.error
      ? { available: false, reason: `Sem permissão para ler pg_stat_statements: ${queries.error}`, items: [] }
      : {
          available: true,
          items: queries.rows.map((row) => ({
            query: String(row.query).slice(0, 400),
            calls: numeric(row.calls) ?? 0,
            meanMs: round(numeric(row.mean_ms) ?? 0, 2),
            totalMs: round(numeric(row.total_ms) ?? 0, 2),
          })),
        };
  }

  const locks = await systemQuery<Record<string, unknown>>(
    `SELECT l.locktype, l.mode, l.granted, count(*)::int AS count
       FROM pg_locks l
      GROUP BY l.locktype, l.mode, l.granted
      ORDER BY count(*) DESC`,
  );

  return {
    generatedAt,
    connection: {
      configured: db.configured,
      connected: db.connected,
      latencyMs: db.latencyMs,
      version: db.version,
      connections: db.connections,
      active: db.activeConnections,
      idle: db.idleConnections,
      max: db.maxConnections,
      error: db.error,
    },
    pool: db.pool,
    performance: {
      cacheHitRatioPercent: db.cacheHitRatioPercent,
      transactionsCommitted: db.transactionsCommitted,
      transactionsRolledBack: db.transactionsRolledBack,
      deadlocks: db.deadlocks,
      waitingLocks: db.waitingLocks,
    },
    size: { bytes: db.sizeBytes },
    tables: tables.rows.map((row) => {
      const name = String(row.table_name);
      const growthEntry = growthByTable.get(name);
      const deltaBytes = growthEntry ? growthEntry.lastBytes - growthEntry.firstBytes : null;
      return {
        name,
        totalBytes: numeric(row.total_bytes) ?? 0,
        indexBytes: numeric(row.index_bytes) ?? 0,
        rowEstimate: numeric(row.row_estimate) ?? 0,
        seqScans: numeric(row.seq_scans) ?? 0,
        indexScans: numeric(row.index_scans) ?? 0,
        growthBytes: deltaBytes,
        growthSince: growthEntry?.firstDay ?? null,
        growthUntil: growthEntry?.lastDay ?? null,
        growthAvailable: Boolean(growthEntry && growthEntry.firstDay !== growthEntry.lastDay),
      };
    }),
    slowQueries,
    locks: locks.error
      ? { available: false, reason: locks.error, items: [] }
      : {
          available: true,
          items: locks.rows.map((row) => ({
            lockType: String(row.locktype),
            mode: String(row.mode),
            granted: row.granted === true,
            count: numeric(row.count) ?? 0,
          })),
        },
    backup: {
      scheduled: Number(process.env.GUIGUI_BACKUP_INTERVAL_HOURS || 0) > 0,
      intervalHours: Number(process.env.GUIGUI_BACKUP_INTERVAL_HOURS || 0) || null,
      lastBackup: lastBackupFromDisk(),
      encryptionConfigured: Boolean(process.env.GUIGUI_BACKUP_ENCRYPTION_KEY),
      replicaConfigured: Boolean(process.env.GUIGUI_BACKUP_REPLICA_DIR),
    },
    replication: {
      available: false,
      reason: 'Não existe replicação configurada nesta instância; o estado não é apresentado como se existisse.',
    },
    warnings: [tables.error, growth.error, db.error].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// APIs e integrações
// ---------------------------------------------------------------------------

export async function getSystemApiMonitoring(days: number) {
  const boundedDays = [1, 7, 30].includes(days) ? days : 7;
  const routes = await systemQuery<Record<string, unknown>>(
    `SELECT route,
            SUM(request_count)::int AS requests,
            SUM(error_count)::int AS errors,
            SUM(total_duration_ms)::bigint AS total_duration_ms
       FROM request_metrics
      WHERE metric_date >= CURRENT_DATE - $1::int
      GROUP BY route
      ORDER BY SUM(request_count) DESC
      LIMIT 50`,
    [boundedDays],
  );
  const daily = await systemQuery<Record<string, unknown>>(
    `SELECT metric_date::text AS day,
            SUM(request_count)::int AS requests,
            SUM(error_count)::int AS errors,
            SUM(total_duration_ms)::bigint AS total_duration_ms
       FROM request_metrics
      WHERE metric_date >= CURRENT_DATE - $1::int
      GROUP BY metric_date ORDER BY metric_date ASC`,
    [boundedDays],
  );
  const totals = routes.rows.reduce<{ requests: number; errors: number; duration: number }>(
    (acc, row) => {
      acc.requests += numeric(row.requests) ?? 0;
      acc.errors += numeric(row.errors) ?? 0;
      acc.duration += numeric(row.total_duration_ms) ?? 0;
      return acc;
    },
    { requests: 0, errors: 0, duration: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    periodDays: boundedDays,
    totals: {
      requests: totals.requests,
      errors: totals.errors,
      errorRatePercent: totals.requests ? round((totals.errors / totals.requests) * 100, 2) : null,
      averageLatencyMs: totals.requests ? round(totals.duration / totals.requests, 2) : null,
      routes: routes.rows.length,
    },
    routes: routes.rows.map((row) => ({
      route: String(row.route),
      requests: numeric(row.requests) ?? 0,
      errors: numeric(row.errors) ?? 0,
      errorRatePercent: numeric(row.requests) ? round(((numeric(row.errors) ?? 0) / (numeric(row.requests) ?? 1)) * 100, 2) : null,
      averageLatencyMs: numeric(row.requests) ? round((numeric(row.total_duration_ms) ?? 0) / (numeric(row.requests) ?? 1), 2) : null,
    })),
    daily: daily.rows.map((row) => ({
      day: String(row.day),
      requests: numeric(row.requests) ?? 0,
      errors: numeric(row.errors) ?? 0,
      averageLatencyMs: numeric(row.requests)
        ? round((numeric(row.total_duration_ms) ?? 0) / (numeric(row.requests) ?? 1), 2)
        : null,
    })),
    integrations: (await getSystemInfrastructure()).components.filter((component) => component.type === 'external'),
    note:
      'As rotas provêm do middleware HTTP já existente (request_metrics). A latência por rota é a média diária agregada, não uma amostra em tempo real.',
    warnings: [routes.error, daily.error].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Incidentes
// ---------------------------------------------------------------------------

const INCIDENT_SEVERITIES = new Set(['info', 'warning', 'critical']);
const INCIDENT_STATUSES = new Set(['open', 'acknowledged', 'resolved']);

export async function listSystemIncidents(filters: {
  status?: string;
  severity?: string;
  service?: string;
  query?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (filters.status && INCIDENT_STATUSES.has(filters.status)) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filters.severity && INCIDENT_SEVERITIES.has(filters.severity)) {
    params.push(filters.severity);
    clauses.push(`severity = $${params.length}`);
  }
  if (filters.service) {
    params.push(filters.service);
    clauses.push(`service = $${params.length}`);
  }
  if (filters.query) {
    params.push(`%${filters.query}%`);
    clauses.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  params.push(limit);
  const result = await systemQuery<Record<string, unknown>>(
    `SELECT * FROM system_incidents
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
               CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
               detected_at DESC
      LIMIT $${params.length}`,
    params,
  );
  const counts = await systemQuery<{ status: string; count: number }>(
    `SELECT status, count(*)::int AS count FROM system_incidents GROUP BY status`,
  );
  return {
    incidents: result.rows.map(mapIncident),
    totals: counts.error
      ? null
      : counts.rows.reduce<Record<string, number>>((acc, row) => {
          acc[String(row.status)] = numeric(row.count) ?? 0;
          return acc;
        }, { open: 0, acknowledged: 0, resolved: 0 }),
    warning: result.error || counts.error,
  };
}

function mapIncident(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description || ''),
    category: String(row.category || 'operational'),
    severity: String(row.severity),
    service: String(row.service),
    source: String(row.source),
    status: String(row.status),
    impact: String(row.impact || ''),
    probableCause: String(row.probable_cause || ''),
    resolution: String(row.resolution || ''),
    assignedTo: row.assigned_to ? String(row.assigned_to) : null,
    detectedAt: iso(row.detected_at),
    acknowledgedAt: iso(row.acknowledged_at),
    resolvedAt: iso(row.resolved_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function getSystemIncident(id: string) {
  const result = await systemQuery<Record<string, unknown>>(
    'SELECT * FROM system_incidents WHERE id = $1',
    [id],
  );
  if (result.error) throw Object.assign(new Error(result.error), { code: 'SYSTEM_MONITORING_UNAVAILABLE' });
  if (!result.rows[0]) return null;
  const events = await systemQuery<Record<string, unknown>>(
    `SELECT id::text, event_type, message, actor, created_at
       FROM system_incident_events WHERE incident_id=$1 ORDER BY created_at ASC`,
    [id],
  );
  return {
    incident: mapIncident(result.rows[0]),
    events: events.rows.map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      message: String(row.message || ''),
      actor: row.actor ? String(row.actor) : null,
      createdAt: iso(row.created_at),
    })),
  };
}

type IncidentInput = {
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  service?: string;
  impact?: string;
  probableCause?: string;
  assignedTo?: string | null;
};

export async function createSystemIncident(input: IncidentInput, actorName: string) {
  const title = String(input.title || '').trim();
  if (!title) throw Object.assign(new Error('O título do incidente é obrigatório.'), { code: 'SYSTEM_INCIDENT_INVALID' });
  const severity = INCIDENT_SEVERITIES.has(String(input.severity)) ? String(input.severity) : 'warning';
  const id = `SYS-MAN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const result = await systemQuery<Record<string, unknown>>(
    `INSERT INTO system_incidents
       (id, title, description, category, severity, service, source, status, impact, probable_cause, assigned_to, detected_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'manual','open',$7,$8,$9,NOW(),NOW())
     RETURNING *`,
    [
      id,
      title.slice(0, 300),
      String(input.description || '').slice(0, 4000),
      String(input.category || 'operational').slice(0, 80),
      severity,
      String(input.service || 'platform').slice(0, 80),
      String(input.impact || '').slice(0, 2000),
      String(input.probableCause || '').slice(0, 2000),
      input.assignedTo ? String(input.assignedTo).slice(0, 160) : null,
    ],
  );
  if (result.error || !result.rows[0]) {
    throw Object.assign(new Error(result.error || 'Não foi possível criar o incidente.'), {
      code: 'SYSTEM_MONITORING_UNAVAILABLE',
    });
  }
  await systemQuery(
    `INSERT INTO system_incident_events (incident_id, event_type, message, actor)
     VALUES ($1,'created','Incidente criado manualmente.',$2)`,
    [id, actorName],
  );
  void recordSystemLog({
    level: severity === 'critical' ? 'error' : 'warn',
    service: 'incidents',
    message: `Incidente manual criado: ${title}`,
    context: { incidentId: id, severity, service: input.service || 'platform' },
  });
  return mapIncident(result.rows[0]);
}

export async function updateSystemIncident(
  id: string,
  input: {
    status?: string;
    resolution?: string;
    assignedTo?: string | null;
    impact?: string;
    probableCause?: string;
  },
  actorName: string,
) {
  const existing = await systemQuery<Record<string, unknown>>(
    'SELECT * FROM system_incidents WHERE id=$1',
    [id],
  );
  if (existing.error) throw Object.assign(new Error(existing.error), { code: 'SYSTEM_MONITORING_UNAVAILABLE' });
  if (!existing.rows[0]) throw Object.assign(new Error('Incidente não encontrado.'), { code: 'NOT_FOUND' });

  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (sql: string, value: unknown) => {
    params.push(value);
    sets.push(`${sql} = $${params.length}`);
  };
  if (input.status && INCIDENT_STATUSES.has(input.status)) {
    push('status', input.status);
    if (input.status === 'acknowledged') push('acknowledged_at', new Date().toISOString());
    if (input.status === 'resolved') {
      push('resolved_at', new Date().toISOString());
      push('resolution', String(input.resolution || existing.rows[0].resolution || 'Resolvido pela administração.'));
    }
  }
  // `status=resolved` já define a resolução acima; repetir a coluna no mesmo
  // UPDATE é rejeitado pelo PostgreSQL ("multiple assignments to same column").
  if (input.resolution !== undefined && input.status !== 'resolved') {
    push('resolution', String(input.resolution).slice(0, 4000));
  }
  if (input.assignedTo !== undefined) push('assigned_to', input.assignedTo ? String(input.assignedTo).slice(0, 160) : null);
  if (input.impact !== undefined) push('impact', String(input.impact).slice(0, 2000));
  if (input.probableCause !== undefined) push('probable_cause', String(input.probableCause).slice(0, 2000));
  if (!sets.length) throw Object.assign(new Error('Nenhuma alteração válida indicada.'), { code: 'SYSTEM_INCIDENT_INVALID' });

  params.push(id);
  const updated = await systemQuery<Record<string, unknown>>(
    `UPDATE system_incidents SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`,
    params,
  );
  if (updated.error || !updated.rows[0]) {
    throw Object.assign(new Error(updated.error || 'Não foi possível atualizar o incidente.'), {
      code: 'SYSTEM_MONITORING_UNAVAILABLE',
    });
  }
  await systemQuery(
    `INSERT INTO system_incident_events (incident_id, event_type, message, actor)
     VALUES ($1,$2,$3,$4)`,
    [
      id,
      input.status ? `status_${input.status}` : 'updated',
      input.status === 'resolved'
        ? `Incidente resolvido: ${String(input.resolution || existing.rows[0].resolution || '')}`.slice(0, 1000)
        : 'Incidente atualizado.',
      actorName,
    ],
  );
  return mapIncident(updated.rows[0]);
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export async function listSystemLogs(filters: {
  level?: string;
  service?: string;
  query?: string;
  requestId?: string;
  hours?: number;
  limit?: number;
}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
  const hours = Math.min(Math.max(Number(filters.hours) || 24, 1), 24 * 30);
  const params: unknown[] = [hours];
  const clauses = [`created_at >= NOW() - ($1::int * INTERVAL '1 hour')`];
  if (filters.level && ['debug', 'info', 'warn', 'error'].includes(filters.level)) {
    params.push(filters.level);
    clauses.push(`level = $${params.length}`);
  }
  if (filters.service) {
    params.push(filters.service);
    clauses.push(`service = $${params.length}`);
  }
  if (filters.requestId) {
    params.push(`%${filters.requestId}%`);
    clauses.push(`(request_id ILIKE $${params.length} OR trace_id ILIKE $${params.length})`);
  }
  if (filters.query) {
    params.push(`%${filters.query}%`);
    clauses.push(`(message ILIKE $${params.length} OR route ILIKE $${params.length})`);
  }
  params.push(limit);
  const logs = await systemQuery<Record<string, unknown>>(
    `SELECT id::text, created_at, level, service, route, message, context, request_id, trace_id, status_code, duration_ms
       FROM system_logs
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  const services = await systemQuery<{ service: string; count: number }>(
    `SELECT service, count(*)::int AS count FROM system_logs
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
      GROUP BY service ORDER BY count(*) DESC LIMIT 20`,
    [hours],
  );
  return {
    generatedAt: new Date().toISOString(),
    filters: { level: filters.level || null, service: filters.service || null, hours, query: filters.query || null },
    logs: logs.rows.map((row) => ({
      id: String(row.id),
      createdAt: iso(row.created_at),
      level: String(row.level),
      service: String(row.service),
      route: row.route ? String(row.route) : null,
      message: String(row.message),
      context: row.context || {},
      requestId: row.request_id ? String(row.request_id) : null,
      traceId: row.trace_id ? String(row.trace_id) : null,
      statusCode: numeric(row.status_code),
      durationMs: numeric(row.duration_ms),
    })),
    services: services.rows.map((row) => ({ service: String(row.service), count: numeric(row.count) ?? 0 })),
    warning: logs.error || services.error,
    retentionNote:
      'Os logs técnicos são gerados por respostas HTTP com erro/lentas e por eventos explícitos dos serviços. Não são guardados corpos de pedido nem chaves sensíveis.',
  };
}

// ---------------------------------------------------------------------------
// Disponibilidade
// ---------------------------------------------------------------------------

export async function getSystemAvailability() {
  const periods = [1, 7, 30];
  const results = [];
  for (const days of periods) {
    const stats = await systemQuery<Record<string, unknown>>(
      `SELECT count(*)::int AS samples,
              count(*) FILTER (WHERE db_healthy)::int AS healthy,
              min(captured_at) AS first_at,
              max(captured_at) AS last_at
         FROM system_metric_samples
        WHERE captured_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [days],
    );
    const samples = numeric(stats.rows[0]?.samples) ?? 0;
    const healthy = numeric(stats.rows[0]?.healthy) ?? 0;
    results.push({
      days,
      samples,
      healthySamples: healthy,
      uptimePercent: samples > 0 ? round((healthy / samples) * 100, 2) : null,
      firstSampleAt: iso(stats.rows[0]?.first_at),
      lastSampleAt: iso(stats.rows[0]?.last_at),
      sufficient: samples >= (days === 1 ? 2 : 5),
      note:
        samples === 0
          ? 'Sem amostras neste período.'
          : samples < (days === 1 ? 2 : 5)
            ? 'Amostras insuficientes para um valor representativo.'
            : 'Percentagem de amostras com o processo ativo e a base de dados acessível.',
      warning: stats.error,
    });
  }
  const incidents = await systemQuery<Record<string, unknown>>(
    `SELECT id, title, severity, service, status, detected_at, resolved_at,
            EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - detected_at)) / 60 AS duration_minutes
       FROM system_incidents
      WHERE detected_at >= NOW() - INTERVAL '30 days'
      ORDER BY detected_at DESC LIMIT 50`,
  );
  const resolved = incidents.rows.filter((row) => row.resolved_at);
  const mttrMinutes = resolved.length
    ? round(
        resolved.reduce((sum, row) => sum + (numeric(row.duration_minutes) ?? 0), 0) / resolved.length,
        1,
      )
    : null;
  const settings = (await getSystemSettings()).settings;
  const current = results[0];
  return {
    generatedAt: new Date().toISOString(),
    periods: results,
    incidents: incidents.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      severity: String(row.severity),
      service: String(row.service),
      status: String(row.status),
      detectedAt: iso(row.detected_at),
      resolvedAt: iso(row.resolved_at),
      durationMinutes: numeric(row.duration_minutes),
    })),
    mttrMinutes,
    slo: {
      target: settings.sloTarget,
      current: current?.uptimePercent ?? null,
      met: current?.uptimePercent !== null && current?.uptimePercent !== undefined
        ? current.uptimePercent >= settings.sloTarget
        : null,
      note:
        'O SLO é calculado sobre as mesmas amostras. Não substitui um SLA contratual nem mede indisponibilidade total do alojamento (que interrompe também a recolha).',
    },
    warnings: [incidents.error, ...results.map((period) => period.warning)].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Segurança (dados reais de audit_logs)
// ---------------------------------------------------------------------------

export async function getSystemSecurity(days: number) {
  const boundedDays = [1, 7, 30].includes(days) ? days : 7;
  const summary = await systemQuery<Record<string, unknown>>(
    `SELECT
       count(*) FILTER (WHERE action ILIKE '%login%' AND result = 'failure')::int AS failed_logins,
       count(*) FILTER (WHERE action = 'authorization_denied')::int AS authorization_denied,
       count(*) FILTER (WHERE (after_data->>'actorRole') = 'admin')::int AS admin_actions,
       count(*) FILTER (WHERE result = 'failure')::int AS failures,
       count(*)::int AS total
     FROM audit_logs
     WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
    [boundedDays],
  );
  const byAction = await systemQuery<Record<string, unknown>>(
    `SELECT action, result, count(*)::int AS count
       FROM audit_logs
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY action, result
      ORDER BY count(*) DESC LIMIT 20`,
    [boundedDays],
  );
  const recent = await systemQuery<Record<string, unknown>>(
    `SELECT id, action, resource, resource_id, result, reason, request_id, created_at,
            after_data->>'actorRole' AS actor_role, after_data->>'actorName' AS actor_name
       FROM audit_logs
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      ORDER BY created_at DESC LIMIT 50`,
    [boundedDays],
  );
  return {
    generatedAt: new Date().toISOString(),
    periodDays: boundedDays,
    summary: summary.error
      ? null
      : {
          failedLogins: numeric(summary.rows[0]?.failed_logins) ?? 0,
          authorizationDenied: numeric(summary.rows[0]?.authorization_denied) ?? 0,
          adminActions: numeric(summary.rows[0]?.admin_actions) ?? 0,
          failures: numeric(summary.rows[0]?.failures) ?? 0,
          total: numeric(summary.rows[0]?.total) ?? 0,
        },
    byAction: byAction.rows.map((row) => ({
      action: String(row.action),
      result: String(row.result),
      count: numeric(row.count) ?? 0,
    })),
    recent: recent.rows.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      resource: String(row.resource),
      resourceId: row.resource_id ? String(row.resource_id) : null,
      result: String(row.result),
      reason: row.reason ? String(row.reason) : null,
      requestId: row.request_id ? String(row.request_id) : null,
      createdAt: iso(row.created_at),
      actorRole: row.actor_role ? String(row.actor_role) : null,
      actorName: row.actor_name ? String(row.actor_name) : null,
    })),
    source: 'audit_logs (trilha de auditoria existente)',
    note:
      'Não existe um segundo sistema de segurança: esta vista lê os eventos já registados pela auditoria da plataforma. Dados sensíveis não são expostos.',
    warnings: [summary.error, byAction.error, recent.error].filter(Boolean),
  };
}
