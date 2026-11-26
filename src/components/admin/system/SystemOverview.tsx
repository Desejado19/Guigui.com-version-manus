import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Database,
  Gauge,
  Server,
  ShieldAlert,
  Signal,
} from 'lucide-react';
import {
  formatSystemBytes,
  formatSystemDate,
  formatSystemDuration,
  formatSystemMs,
  formatSystemNumber,
  formatSystemPercent,
  systemRequest,
  type SystemOverview,
  type SystemSection,
} from './systemApi';
import {
  RefreshButton,
  StatusPill,
  SystemCard,
  SystemEmpty,
  SystemLoading,
  SystemMessage,
  SystemMetricTile,
  SystemTable,
  UnavailableMetric,
} from './SystemShared';

export const SystemOverviewPage: React.FC<{
  refreshToken: number;
  onOpenSection: (section: SystemSection) => void;
}> = ({ refreshToken, onOpenSection }) => {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const payload = await systemRequest<SystemOverview>('/api/admin/system/overview');
      setData(payload);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao consultar a monitorização.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  if (loading && !data) return <SystemLoading label="A medir o processo, a base de dados e as requisições reais…" />;

  if (error && !data) {
    return (
      <div className="space-y-3">
        <SystemMessage tone="error">{error}</SystemMessage>
        <RefreshButton onClick={() => void load()} busy={refreshing} />
      </div>
    );
  }

  if (!data) return <SystemEmpty text="A API de monitorização não devolveu dados." />;

  const healthTone = data.status === 'operational' ? 'success' : data.status === 'degraded' ? 'warning' : 'danger';
  const healthLabel = data.status === 'operational' ? 'Operacional' : data.status === 'degraded' ? 'Degradado' : 'Indisponível';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-bold text-slate-500">
          Última atualização: {formatSystemDate(data.generatedAt)} · amostras: {data.availability.samples} · ciclo automático:{' '}
          {data.monitor.running ? `ativo (${data.monitor.intervalSeconds ?? data.settings.intervalSeconds}s)` : 'inativo'}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            Atualizar a cada 30s
          </label>
          <RefreshButton onClick={() => void load(true)} busy={refreshing} />
        </div>
      </div>

      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {data.warnings.length > 0 && (
        <SystemMessage tone="warning">
          Avisos de recolha: {data.warnings.filter(Boolean).join(' · ')}
        </SystemMessage>
      )}
      {data.settings.warning && <SystemMessage tone="warning">{data.settings.warning}</SystemMessage>}

      <div className={`rounded-2xl border p-4 shadow-sm ${healthTone === 'success' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)]' : healthTone === 'warning' ? 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)]' : 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Signal className="mt-0.5 h-5 w-5 text-current opacity-70" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">Estado global da plataforma</div>
              <div className="text-lg font-black">{healthLabel}</div>
              <div className="mt-0.5 text-[10.5px] font-medium opacity-80">
                {data.database.configured
                  ? data.database.connected
                    ? `PostgreSQL ligado em ${formatSystemMs(data.database.latencyMs)}.`
                    : 'PostgreSQL configurado mas inacessível.'
                  : 'PostgreSQL não configurado: a plataforma corre em modo local.'}{' '}
                {data.incidents.critical > 0 ? `${data.incidents.critical} incidente(s) crítico(s) ativo(s).` : 'Sem incidentes críticos ativos.'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenSection('incidents')} className="inline-flex items-center gap-1 rounded-lg border border-white bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-800">
              <ShieldAlert className="h-3.5 w-3.5" /> Ver incidentes
            </button>
            <button type="button" onClick={() => onOpenSection('logs')} className="inline-flex items-center gap-1 rounded-lg border border-white bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-800">
              <Activity className="h-3.5 w-3.5" /> Diagnóstico
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <SystemMetricTile label="Serviços" value={`${data.services.operational}/${data.services.total}`} hint={`${data.services.degraded} degradados · ${data.services.unavailable} indisponíveis`} tone={data.services.degraded || data.services.unavailable ? 'warning' : 'success'} />
        <SystemMetricTile label="Incidentes ativos" value={data.incidents.open + data.incidents.acknowledged} hint={`${data.incidents.critical} críticos · ${data.incidents.warning} avisos`} tone={data.incidents.critical ? 'danger' : data.incidents.open ? 'warning' : 'success'} />
        <SystemMetricTile label="Disponibilidade (24h)" value={formatSystemPercent(data.availability.percent)} hint={data.availability.samples ? `${data.availability.healthySamples}/${data.availability.samples} amostras saudáveis` : 'Sem amostras'} tone={data.availability.percent !== null && data.availability.percent >= data.settings.sloTarget ? 'success' : data.availability.percent === null ? 'neutral' : 'warning'} />
        <SystemMetricTile label="CPU do processo" value={formatSystemPercent(data.process.cpuPercent)} hint={`Sistema: ${formatSystemPercent(data.process.systemCpuPercent)} · ${data.process.cpuCount} núcleos`} tone={(data.process.cpuPercent || 0) >= data.settings.cpuThreshold ? 'danger' : 'neutral'} />
        <SystemMetricTile label="Memória do host" value={formatSystemPercent(data.memory.usedPercent)} hint={`${formatSystemBytes(data.memory.totalBytes - data.memory.freeBytes)} de ${formatSystemBytes(data.memory.totalBytes)}`} tone={data.memory.usedPercent >= data.settings.memoryThreshold ? 'danger' : 'neutral'} />
        <SystemMetricTile label="Latência PostgreSQL" value={formatSystemMs(data.database.latencyMs)} hint={data.database.connected ? `${data.database.connections ?? '—'} ligações · ${data.database.activeConnections ?? '—'} ativas` : 'Não disponível'} tone={data.database.connected ? 'success' : 'danger'} />
        <SystemMetricTile label="Requisições (24h)" value={formatSystemNumber(data.requests.total)} hint={`${data.requests.routes ?? '—'} rotas instrumentadas`} tone="info" />
        <SystemMetricTile label="Erros HTTP (24h)" value={formatSystemNumber(data.requests.errors)} hint={`Taxa: ${formatSystemPercent(data.requests.errorRatePercent)}`} tone={(data.requests.errorRatePercent || 0) >= data.settings.errorRateThreshold ? 'danger' : 'neutral'} />
        <SystemMetricTile label="Latência média HTTP" value={formatSystemMs(data.requests.averageLatencyMs)} hint="Média agregada em request_metrics" tone="neutral" />
        <SystemMetricTile label="Uptime do processo" value={formatSystemDuration(data.process.uptimeSeconds)} hint={`PID ${data.process.pid} · ${data.process.nodeVersion}`} tone="neutral" />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard
          title="Indicadores e fontes"
          description="Cada valor indica a fonte real e se foi medido ou não."
          actions={<button type="button" onClick={() => onOpenSection('resources')} className="inline-flex items-center gap-1 text-[10px] font-black text-[var(--color-green-800)] underline decoration-dotted">Recursos <ArrowUpRight className="h-3 w-3" /></button>}
        >
          <SystemTable
            headers={['Indicador', 'Valor', 'Estado', 'Fonte']}
            rows={data.metrics.map((metric) => [
              <div>
                <div className="font-bold text-slate-800">{metric.label}</div>
                {metric.note && <div className="text-[9.5px] text-slate-500">{metric.note}</div>}
              </div>,
              <span className="font-mono font-bold">{metric.status === 'measured' ? `${metric.value ?? '—'}${metric.unit ? ` ${metric.unit}` : ''}` : '—'}</span>,
              <StatusPill status={metric.status === 'measured' ? 'operational' : 'not_configured'} label={metric.status === 'measured' ? 'Medido' : 'Não disponível'} />,
              <span className="text-[9.5px] text-slate-500">{metric.source}</span>,
            ])}
            rowKeys={data.metrics.map((metric) => metric.key)}
            empty="Sem indicadores."
          />
        </SystemCard>

        <SystemCard
          title="Componentes monitorizados"
          description="Estado derivado de verificações reais, não de valores fixos."
          actions={<button type="button" onClick={() => onOpenSection('infrastructure')} className="inline-flex items-center gap-1 text-[10px] font-black text-[var(--color-green-800)] underline decoration-dotted">Infraestrutura <ArrowUpRight className="h-3 w-3" /></button>}
        >
          <div className="space-y-2">
            {data.components.map((component) => (
              <div key={component.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] px-2.5 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800">
                    <Server className="h-3.5 w-3.5 text-slate-400" />
                    {component.name}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[9.5px] text-slate-500">{component.notes}</div>
                </div>
                <StatusPill status={component.status} />
              </div>
            ))}
          </div>
        </SystemCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard
          title="Alertas ativos"
          description="Incidentes abertos ou reconhecidos, ordenados por gravidade."
          actions={<button type="button" onClick={() => onOpenSection('incidents')} className="inline-flex items-center gap-1 text-[10px] font-black text-[var(--color-green-800)] underline decoration-dotted">Gerir <ArrowUpRight className="h-3 w-3" /></button>}
        >
          {data.alerts.length === 0 ? (
            <SystemMessage tone="success">Sem alertas ativos: nenhuma condição configurada está fora do intervalo.</SystemMessage>
          ) : (
            <div className="space-y-2">
              {data.alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-[var(--color-border-subtle)] p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800">
                      <ShieldAlert className="h-3.5 w-3.5 text-[var(--tone-danger-text)]" />
                      {alert.title}
                    </div>
                    <StatusPill status={alert.severity} />
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">{alert.description}</div>
                  <div className="mt-1 text-[9px] text-slate-400">{alert.service} · {formatSystemDate(alert.detectedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </SystemCard>

        <SystemCard title="Recursos e capacidade" description="Ocupação atual medida no host e na base de dados.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border-subtle)] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500"><Gauge className="h-3.5 w-3.5" /> Disco</div>
              <div className="mt-1 text-sm font-black text-slate-800">{formatSystemPercent(data.disk.usedPercent)} usado</div>
              <div className="text-[9.5px] text-slate-500">{data.disk.available ? `${formatSystemBytes(data.disk.freeBytes)} livres de ${formatSystemBytes(data.disk.totalBytes)}` : data.disk.reason}</div>
            </div>
            <div className="rounded-xl border border-[var(--color-border-subtle)] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500"><Database className="h-3.5 w-3.5" /> Base de dados</div>
              <div className="mt-1 text-sm font-black text-slate-800">{formatSystemBytes(data.database.sizeBytes)}</div>
              <div className="text-[9.5px] text-slate-500">{data.database.connected ? `Cache hit ${formatSystemPercent(data.database.cacheHitRatioPercent)}` : 'Sem ligação'}</div>
            </div>
          </div>
          <div className="mt-2">
            <UnavailableMetric label="Tráfego de rede e I/O de disco" reason="O runtime não expõe estes contadores. Requer agente externo; não são simulados." />
          </div>
        </SystemCard>
      </div>
    </div>
  );
};
