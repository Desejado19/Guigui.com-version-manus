/**
 * Cliente do módulo Sistema.
 *
 * Todos os tipos correspondem a respostas reais de `/api/admin/system/*`.
 * Nada é preenchido no cliente: quando o backend diz que uma métrica não está
 * disponível, a interface mostra a limitação e a razão.
 */

export type SystemSection =
  | 'overview'
  | 'infrastructure'
  | 'resources'
  | 'database'
  | 'apis'
  | 'incidents'
  | 'logs'
  | 'availability'
  | 'security'
  | 'settings';

export type SystemComponentStatus =
  | 'operational'
  | 'degraded'
  | 'unavailable'
  | 'not_configured'
  | 'simulated';

export interface SystemComponent {
  id: string;
  name: string;
  type: string;
  status: SystemComponentStatus;
  source: string;
  lastCheckedAt: string;
  version: string | null;
  dependencies: string[];
  metricsSupported: string[];
  notes: string;
}

export interface SystemMetricDescriptor {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  status: 'measured' | 'unavailable';
  source: string;
  updatedAt: string | null;
  note?: string;
}

export interface SystemDatabaseSummary {
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
}

export interface SystemDiskUsage {
  available: boolean;
  path: string;
  totalBytes: number | null;
  freeBytes: number | null;
  usedBytes: number | null;
  usedPercent: number | null;
  reason?: string;
}

export interface SystemSettingsValues {
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
}

export interface SystemOverview {
  generatedAt: string;
  status: 'operational' | 'degraded' | 'unavailable';
  period: { label: string; hours: number };
  services: {
    total: number;
    operational: number;
    degraded: number;
    unavailable: number;
    notConfigured: number;
  };
  incidents: {
    open: number;
    acknowledged: number;
    resolved: number;
    critical: number;
    warning: number;
  };
  availability: {
    percent: number | null;
    samples: number;
    healthySamples: number;
    firstSampleAt: string | null;
    note: string;
  };
  requests: {
    total: number | null;
    errors: number | null;
    errorRatePercent: number | null;
    averageLatencyMs: number | null;
    routes: number | null;
    windowHours: number;
    source: string;
    warning?: string;
  };
  process: {
    pid: number;
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuPercent: number;
    systemCpuPercent: number;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    cpuCount: number;
    loadAverage: number[];
  };
  memory: { totalBytes: number; freeBytes: number; usedPercent: number };
  database: SystemDatabaseSummary;
  disk: SystemDiskUsage;
  alerts: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    service: string;
    detectedAt: string | null;
  }>;
  components: SystemComponent[];
  metrics: SystemMetricDescriptor[];
  settings: SystemSettingsValues & { source: 'database' | 'defaults'; warning?: string };
  monitor: { running: boolean; lastCycleAt: string | null; intervalSeconds: number | null };
  warnings: string[];
}

export interface SystemInfrastructure {
  generatedAt: string;
  components: SystemComponent[];
  database: SystemDatabaseSummary;
  disk: SystemDiskUsage;
  warnings: string[];
}

export interface SystemResourcePoint {
  capturedAt: string | null;
  cpuPercent: number | null;
  systemCpuPercent: number | null;
  rssBytes: number | null;
  heapUsedBytes: number | null;
  memoryUsedPercent: number | null;
  dbLatencyMs: number | null;
  dbSizeBytes: number | null;
  requestsToday: number | null;
  errorsToday: number | null;
}

export interface SystemResources {
  generatedAt: string;
  period: { hours: number };
  host: {
    cpuCount: number;
    cpuModel: string | null;
    platform: string;
    arch: string;
    loadAverage: number[];
    uptimeSeconds: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
    memoryUsedPercent: number;
  };
  process: {
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    cpuPercent: number;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
  };
  summary: {
    cpuAvg: number | null;
    cpuPeak: number | null;
    memoryAvg: number | null;
    memoryPeak: number | null;
    dbLatencyAvg: number | null;
    dbLatencyPeak: number | null;
  };
  disk: SystemDiskUsage;
  uploads: { files: number; bytes: number; truncated: boolean; path: string; bytesLabel: string };
  capacity: {
    databaseBytes: number | null;
    uploadsBytes: number;
    diskTotalBytes: number | null;
    diskFreeBytes: number | null;
    diskUsedPercent: number | null;
    samplesStored: number;
  };
  series: SystemResourcePoint[];
  unsupported: Array<{ metric: string; reason: string }>;
  warnings: string[];
}

export interface SystemDatabaseTable {
  name: string;
  totalBytes: number;
  indexBytes: number;
  rowEstimate: number;
  seqScans: number;
  indexScans: number;
  growthBytes: number | null;
  growthSince: string | null;
  growthUntil: string | null;
  growthAvailable: boolean;
}

export interface SystemDatabase {
  generatedAt: string;
  connection: {
    configured: boolean;
    connected: boolean;
    latencyMs: number | null;
    version: string | null;
    connections: number | null;
    active: number | null;
    idle: number | null;
    max: number | null;
    error?: string;
  };
  pool: Record<string, unknown> | null;
  performance: {
    cacheHitRatioPercent: number | null;
    transactionsCommitted: number | null;
    transactionsRolledBack: number | null;
    deadlocks: number | null;
    waitingLocks: number | null;
  };
  size: { bytes: number | null };
  tables: SystemDatabaseTable[];
  slowQueries: {
    available: boolean;
    reason?: string;
    items: Array<{ query: string; calls: number; meanMs: number; totalMs: number }>;
  };
  locks: {
    available: boolean;
    reason?: string;
    items: Array<{ lockType: string; mode: string; granted: boolean; count: number }>;
  };
  backup: {
    scheduled: boolean;
    intervalHours: number | null;
    lastBackup: { id: string; status: string; timestamp: string; sizeMB: number | null } | null;
    encryptionConfigured: boolean;
    replicaConfigured: boolean;
  };
  replication: { available: boolean; reason: string };
  warnings: string[];
}

export interface SystemApis {
  generatedAt: string;
  periodDays: number;
  totals: {
    requests: number;
    errors: number;
    errorRatePercent: number | null;
    averageLatencyMs: number | null;
    routes: number;
  };
  routes: Array<{
    route: string;
    requests: number;
    errors: number;
    errorRatePercent: number | null;
    averageLatencyMs: number | null;
  }>;
  daily: Array<{ day: string; requests: number; errors: number; averageLatencyMs: number | null }>;
  integrations: SystemComponent[];
  note: string;
  warnings: string[];
}

export interface SystemIncident {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  service: string;
  source: string;
  status: string;
  impact: string;
  probableCause: string;
  resolution: string;
  assignedTo: string | null;
  detectedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string | null;
}

export interface SystemIncidentList {
  incidents: SystemIncident[];
  totals: Record<string, number> | null;
  warning?: string;
}

export interface SystemIncidentDetail {
  incident: SystemIncident;
  events: Array<{ id: string; eventType: string; message: string; actor: string | null; createdAt: string | null }>;
}

export interface SystemLogEntry {
  id: string;
  createdAt: string | null;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  route: string | null;
  message: string;
  context: Record<string, unknown>;
  requestId: string | null;
  traceId: string | null;
  statusCode: number | null;
  durationMs: number | null;
}

export interface SystemLogs {
  generatedAt: string;
  filters: { level: string | null; service: string | null; hours: number; query: string | null };
  logs: SystemLogEntry[];
  services: Array<{ service: string; count: number }>;
  warning?: string;
  retentionNote: string;
}

export interface SystemAvailability {
  generatedAt: string;
  periods: Array<{
    days: number;
    samples: number;
    healthySamples: number;
    uptimePercent: number | null;
    firstSampleAt: string | null;
    lastSampleAt: string | null;
    sufficient: boolean;
    note: string;
    warning?: string;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    severity: string;
    service: string;
    status: string;
    detectedAt: string | null;
    resolvedAt: string | null;
    durationMinutes: number | null;
  }>;
  mttrMinutes: number | null;
  slo: { target: number; current: number | null; met: boolean | null; note: string };
  warnings: string[];
}

export interface SystemSecurity {
  generatedAt: string;
  periodDays: number;
  summary: {
    failedLogins: number;
    authorizationDenied: number;
    adminActions: number;
    failures: number;
    total: number;
  } | null;
  byAction: Array<{ action: string; result: string; count: number }>;
  recent: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    result: string;
    reason: string | null;
    requestId: string | null;
    createdAt: string | null;
    actorRole: string | null;
    actorName: string | null;
  }>;
  source: string;
  note: string;
  warnings: string[];
}

export async function systemRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((payload as { error?: string })?.error || 'Não foi possível consultar a monitorização.');
    (error as Error & { code?: string }).code = (payload as { code?: string })?.code;
    throw error;
  }
  return payload as T;
}

export const formatSystemBytes = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.abs(value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export const formatSystemNumber = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : Math.round(value).toLocaleString('pt-PT');

export const formatSystemPercent = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;

export const formatSystemMs = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(value >= 10 ? 0 : 1)} ms`;

export const formatSystemDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
};

export const formatSystemDate = (value: string | null | undefined, withTime = true): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return withTime ? date.toLocaleString('pt-PT') : date.toLocaleDateString('pt-PT');
};

export const SYSTEM_STATUS_LABELS: Record<string, string> = {
  operational: 'Operacional',
  degraded: 'Degradado',
  unavailable: 'Indisponível',
  not_configured: 'Não configurado',
  simulated: 'Simulado',
  open: 'Aberto',
  acknowledged: 'Reconhecido',
  resolved: 'Resolvido',
  critical: 'Crítico',
  warning: 'Aviso',
  info: 'Informação',
};
