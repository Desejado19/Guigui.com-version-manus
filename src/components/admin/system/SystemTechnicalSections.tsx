import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, HardDrive, Network, Server, Wrench } from 'lucide-react';
import {
  formatSystemBytes,
  formatSystemDate,
  formatSystemMs,
  formatSystemNumber,
  formatSystemPercent,
  systemRequest,
  type SystemApis,
  type SystemDatabase,
  type SystemInfrastructure,
  type SystemResources,
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

function useSectionData<T>(url: string, refreshToken: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      setData(await systemRequest<T>(url));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao consultar a monitorização.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return { data, loading, refreshing, error, reload: load };
}

const Toolbar: React.FC<{ refreshing: boolean; onRefresh: () => void; generatedAt?: string; extra?: React.ReactNode }> = ({
  refreshing,
  onRefresh,
  generatedAt,
  extra,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="text-[10px] font-bold text-slate-500">Última leitura: {formatSystemDate(generatedAt)}</div>
    <div className="flex flex-wrap items-center gap-2">
      {extra}
      <RefreshButton onClick={onRefresh} busy={refreshing} />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Infraestrutura
// ---------------------------------------------------------------------------

export const SystemInfrastructurePage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const { data, loading, refreshing, error, reload } = useSectionData<SystemInfrastructure>(
    '/api/admin/system/infrastructure',
    refreshToken,
  );
  const [selected, setSelected] = useState<string | null>(null);

  if (loading && !data) return <SystemLoading label="A verificar os componentes reais…" />;
  if (error && !data) return <SystemMessage tone="error">{error}</SystemMessage>;
  if (!data) return <SystemEmpty text="Sem dados de infraestrutura." />;

  const active = data.components.find((component) => component.id === selected) || null;

  return (
    <div className="space-y-3">
      <Toolbar refreshing={refreshing} onRefresh={() => void reload(true)} generatedAt={data.generatedAt} />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {data.warnings.length > 0 && <SystemMessage tone="warning">{data.warnings.join(' · ')}</SystemMessage>}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SystemMetricTile label="Componentes" value={data.components.length} hint="Inventariados pelo runtime" tone="info" />
        <SystemMetricTile label="Operacionais" value={data.components.filter((component) => component.status === 'operational').length} tone="success" />
        <SystemMetricTile label="Degradados / indisponíveis" value={data.components.filter((component) => component.status === 'degraded' || component.status === 'unavailable').length} tone={data.components.some((component) => component.status === 'unavailable') ? 'danger' : 'warning'} />
        <SystemMetricTile label="Não configurados / simulados" value={data.components.filter((component) => component.status === 'not_configured' || component.status === 'simulated').length} tone="neutral" />
      </div>

      <SystemCard title="Componentes" description="Cada componente é verificado a partir da sua fonte real. Clique para ver detalhes e métricas suportadas.">
        <div className="grid gap-2 md:grid-cols-2">
          {data.components.map((component) => (
            <button
              key={component.id}
              type="button"
              onClick={() => setSelected(component.id)}
              className={`rounded-xl border p-3 text-left transition hover:border-[var(--color-green-700)] ${selected === component.id ? 'border-[var(--color-green-700)] bg-[var(--color-bg-subtle)]' : 'border-[var(--color-border-subtle)] bg-white'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11.5px] font-black text-slate-800">
                  <Server className="h-3.5 w-3.5 text-slate-400" />
                  {component.name}
                </div>
                <StatusPill status={component.status} />
              </div>
              <div className="mt-1 text-[9.5px] text-slate-500">{component.type} · {component.source}</div>
              <div className="mt-1 line-clamp-2 text-[10px] text-slate-600">{component.notes}</div>
            </button>
          ))}
        </div>
      </SystemCard>

      {active && (
        <SystemCard title={`Detalhe: ${active.name}`} description={active.notes}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <SystemMetricTile label="Estado" value={<StatusPill status={active.status} />} hint={active.source} />
            <SystemMetricTile label="Versão" value={active.version || '—'} hint="Reportada pela fonte" />
            <SystemMetricTile label="Dependências" value={active.dependencies.length || '—'} hint={active.dependencies.join(', ') || 'Nenhuma'} />
            <SystemMetricTile label="Última verificação" value={formatSystemDate(active.lastCheckedAt, false)} hint={formatSystemDate(active.lastCheckedAt)} />
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Métricas suportadas</div>
            <div className="flex flex-wrap gap-1.5">
              {active.metricsSupported.map((metric) => (
                <span key={metric} className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-2 py-1 text-[9.5px] font-bold text-slate-600">{metric}</span>
              ))}
            </div>
          </div>
        </SystemCard>
      )}

      <SystemCard title="Base de dados e armazenamento" description="Valores medidos diretamente, sem estimativas.">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SystemMetricTile label="PostgreSQL" value={data.database.connected ? 'Ligado' : data.database.configured ? 'Inacessível' : 'Não configurado'} hint={`Latência ${formatSystemMs(data.database.latencyMs)}`} tone={data.database.connected ? 'success' : 'danger'} />
          <SystemMetricTile label="Tamanho da base" value={formatSystemBytes(data.database.sizeBytes)} hint={`${data.database.connections ?? '—'} ligações`} />
          <SystemMetricTile label="Disco" value={formatSystemPercent(data.disk.usedPercent)} hint={data.disk.available ? `${formatSystemBytes(data.disk.freeBytes)} livres` : data.disk.reason} tone={data.disk.available ? 'neutral' : 'warning'} />
          <SystemMetricTile label="Espaço total" value={formatSystemBytes(data.disk.totalBytes)} hint={data.disk.path} />
        </div>
      </SystemCard>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Recursos e capacidade
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: 1, label: '1 hora' },
  { value: 6, label: '6 horas' },
  { value: 24, label: '24 horas' },
  { value: 72, label: '3 dias' },
  { value: 168, label: '7 dias' },
];

export const SystemResourcesPage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const [hours, setHours] = useState(24);
  const { data, loading, refreshing, error, reload } = useSectionData<SystemResources>(
    `/api/admin/system/resources?hours=${hours}`,
    refreshToken,
  );

  if (loading && !data) return <SystemLoading label="A ler CPU, memória e disco reais…" />;
  if (error && !data) return <SystemMessage tone="error">{error}</SystemMessage>;
  if (!data) return <SystemEmpty text="Sem dados de recursos." />;

  const chartData = data.series.map((point) => ({
    time: point.capturedAt ? new Date(point.capturedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '',
    cpu: point.cpuPercent,
    memory: point.memoryUsedPercent,
    latency: point.dbLatencyMs,
  }));

  return (
    <div className="space-y-3">
      <Toolbar
        refreshing={refreshing}
        onRefresh={() => void reload(true)}
        generatedAt={data.generatedAt}
        extra={
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
            Período
            <select value={hours} onChange={(event) => setHours(Number(event.target.value))} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2 py-1.5 text-[10px] font-bold">
              {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        }
      />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <SystemMetricTile label="CPU atual" value={formatSystemPercent(data.process.cpuPercent)} hint={`Média ${formatSystemPercent(data.summary.cpuAvg)} · pico ${formatSystemPercent(data.summary.cpuPeak)}`} tone={(data.process.cpuPercent || 0) >= 85 ? 'danger' : 'neutral'} />
        <SystemMetricTile label="CPU do sistema" value={formatSystemPercent(data.host.loadAverage[0] !== null ? (data.host.loadAverage[0] / Math.max(1, data.host.cpuCount)) * 100 : null)} hint={`Load average ${data.host.loadAverage.join(' / ')}`} />
        <SystemMetricTile label="Memória do host" value={formatSystemPercent(data.host.memoryUsedPercent)} hint={`${formatSystemBytes(data.host.totalMemoryBytes - data.host.freeMemoryBytes)} em uso`} />
        <SystemMetricTile label="RSS do processo" value={formatSystemBytes(data.process.rssBytes)} hint={`Heap ${formatSystemBytes(data.process.heapUsedBytes)} / ${formatSystemBytes(data.process.heapTotalBytes)}`} />
        <SystemMetricTile label="Disco" value={formatSystemPercent(data.disk.usedPercent)} hint={data.disk.available ? `${formatSystemBytes(data.disk.freeBytes)} livres de ${formatSystemBytes(data.disk.totalBytes)}` : data.disk.reason} tone={data.disk.available ? 'neutral' : 'warning'} />
        <SystemMetricTile label="Uptime" value={`${Math.floor(data.process.uptimeSeconds / 3600)}h`} hint={`${data.process.nodeVersion} · PID ${data.process.pid}`} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard title="CPU e memória" description={`Amostras reais das últimas ${hours}h. Cada ponto foi medido pelo processo.`}>
          {chartData.length === 0 ? (
            <SystemEmpty text="Sem amostras neste período. Os pontos aparecem após o ciclo de monitorização." />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} minTickGap={24} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number, name) => [`${value}%`, name === 'cpu' ? 'CPU processo' : 'Memória']} />
                  <Line type="monotone" dataKey="cpu" stroke="#123e3b" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="memory" stroke="#c2853b" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SystemCard>

        <SystemCard title="Latência do PostgreSQL" description="Tempo da verificação direta à base de dados em cada amostra.">
          {chartData.length === 0 ? (
            <SystemEmpty text="Sem amostras neste período." />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 9 }} unit="ms" />
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number) => [`${value} ms`, 'Latência']} />
                  <Line type="monotone" dataKey="latency" stroke="#2f6f9f" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SystemCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard title="Capacidade" description="Consumo atual e espaço disponível.">
          <SystemTable
            headers={['Recurso', 'Consumo', 'Limite / disponível']}
            rows={[
              ['Base de dados', formatSystemBytes(data.capacity.databaseBytes), 'Sem limite configurado (cresce com os dados)'],
              ['Uploads', `${formatSystemNumber(data.uploads.files)} ficheiros · ${formatSystemBytes(data.uploads.bytes)}`, data.uploads.truncated ? 'Contagem limitada a 5000 ficheiros' : data.uploads.path],
              ['Disco', formatSystemPercent(data.capacity.diskUsedPercent), `${formatSystemBytes(data.capacity.diskFreeBytes)} livres de ${formatSystemBytes(data.capacity.diskTotalBytes)}`],
              ['Memória do host', formatSystemBytes(data.host.totalMemoryBytes - data.host.freeMemoryBytes), `${formatSystemBytes(data.host.totalMemoryBytes)} totais`],
              ['Amostras guardadas', formatSystemNumber(data.capacity.samplesStored), `Período consultado: ${hours}h`],
            ]}
            empty="Sem dados de capacidade."
          />
          <div className="mt-2 text-[9.5px] text-slate-500">
            Projeções de crescimento não são apresentadas porque exigiriam uma série histórica longa. O crescimento das tabelas é medido na área Base de Dados.
          </div>
        </SystemCard>

        <SystemCard title="Métricas não suportadas" description="Limitações reais da instrumentação atual. Nada disto é simulado.">
          <div className="space-y-2">
            {data.unsupported.map((item) => (
              <UnavailableMetric key={item.metric} label={item.metric} reason={item.reason} />
            ))}
          </div>
        </SystemCard>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Base de dados
// ---------------------------------------------------------------------------

export const SystemDatabasePage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const { data, loading, refreshing, error, reload } = useSectionData<SystemDatabase>(
    '/api/admin/system/database',
    refreshToken,
  );

  if (loading && !data) return <SystemLoading label="A consultar o PostgreSQL real…" />;
  if (error && !data) return <SystemMessage tone="error">{error}</SystemMessage>;
  if (!data) return <SystemEmpty text="Sem dados da base de dados." />;

  return (
    <div className="space-y-3">
      <Toolbar refreshing={refreshing} onRefresh={() => void reload(true)} generatedAt={data.generatedAt} />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {data.connection.error && <SystemMessage tone="error">{data.connection.error}</SystemMessage>}
      {data.warnings.length > 0 && <SystemMessage tone="warning">{data.warnings.join(' · ')}</SystemMessage>}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <SystemMetricTile label="Estado" value={data.connection.connected ? 'Ligado' : data.connection.configured ? 'Inacessível' : 'Não configurado'} hint={data.connection.version ? `v${data.connection.version}` : 'Versão não disponível'} tone={data.connection.connected ? 'success' : 'danger'} />
        <SystemMetricTile label="Latência" value={formatSystemMs(data.connection.latencyMs)} hint="SELECT 1 medido agora" />
        <SystemMetricTile label="Ligações" value={`${data.connection.connections ?? '—'}/${data.connection.max ?? '—'}`} hint={`${data.connection.active ?? '—'} ativas · ${data.connection.idle ?? '—'} idle`} />
        <SystemMetricTile label="Tamanho" value={formatSystemBytes(data.size.bytes)} hint="pg_database_size" />
        <SystemMetricTile label="Cache hit" value={formatSystemPercent(data.performance.cacheHitRatioPercent)} hint="blks_hit / (hit + read)" />
        <SystemMetricTile label="Locks em espera" value={formatSystemNumber(data.performance.waitingLocks)} hint={`${formatSystemNumber(data.performance.deadlocks)} deadlocks acumulados`} tone={(data.performance.waitingLocks || 0) > 0 ? 'warning' : 'success'} />
      </div>

      <SystemCard title="Tabelas com maior consumo" description="Tamanho total, índices, registos estimados e crescimento desde a primeira amostra diária.">
        <SystemTable
          headers={['Tabela', 'Tamanho', 'Índices', 'Registos (est.)', 'Crescimento', 'Seq. scans']}
          rows={data.tables.map((table) => [
            <span className="font-mono font-bold text-slate-800">{table.name}</span>,
            formatSystemBytes(table.totalBytes),
            formatSystemBytes(table.indexBytes),
            formatSystemNumber(table.rowEstimate),
            table.growthAvailable && table.growthBytes !== null
              ? `${table.growthBytes >= 0 ? '+' : ''}${formatSystemBytes(table.growthBytes)} desde ${table.growthSince}`
              : <span className="text-slate-400">Sem histórico suficiente</span>,
            formatSystemNumber(table.seqScans),
          ])}
          rowKeys={data.tables.map((table) => table.name)}
          empty="Nenhuma tabela de utilizador encontrada."
        />
      </SystemCard>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard title="Queries lentas" description="Fonte: pg_stat_statements, quando a extensão existe.">
          {!data.slowQueries.available ? (
            <SystemMessage tone="warning">{data.slowQueries.reason}</SystemMessage>
          ) : data.slowQueries.items.length === 0 ? (
            <SystemEmpty text="Sem queries registadas pela extensão." />
          ) : (
            <div className="space-y-2">
              {data.slowQueries.items.map((query, index) => (
                <div key={`${query.query.slice(0, 24)}-${index}`} className="rounded-xl border border-[var(--color-border-subtle)] p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-700">
                    <span>{formatSystemNumber(query.calls)} chamadas</span>
                    <span>média {formatSystemMs(query.meanMs)} · total {formatSystemMs(query.totalMs)}</span>
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-2 text-[9.5px] text-slate-200">{query.query}</pre>
                </div>
              ))}
            </div>
          )}
        </SystemCard>

        <SystemCard title="Locks e transações" description="Estado real do motor, sem executar operações destrutivas.">
          <div className="grid gap-2 sm:grid-cols-3">
            <SystemMetricTile label="Commit" value={formatSystemNumber(data.performance.transactionsCommitted)} />
            <SystemMetricTile label="Rollback" value={formatSystemNumber(data.performance.transactionsRolledBack)} />
            <SystemMetricTile label="Deadlocks" value={formatSystemNumber(data.performance.deadlocks)} tone={(data.performance.deadlocks || 0) > 0 ? 'warning' : 'success'} />
          </div>
          <div className="mt-2">
            {!data.locks.available ? (
              <SystemMessage tone="warning">{data.locks.reason}</SystemMessage>
            ) : (
              <SystemTable
                headers={['Tipo', 'Modo', 'Concedido', 'Quantidade']}
                rows={data.locks.items.map((lock) => [
                  lock.lockType,
                  lock.mode,
                  lock.granted ? 'Sim' : 'Em espera',
                  formatSystemNumber(lock.count),
                ])}
                rowKeys={data.locks.items.map((lock, index) => `${lock.lockType}-${lock.mode}-${index}`)}
                empty="Sem locks ativos."
              />
            )}
          </div>
        </SystemCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard title="Backups" description="Configuração e último resultado registado. Nenhum backup é executado nesta vista.">
          <SystemTable
            headers={['Item', 'Estado']}
            rows={[
              ['Agendamento', data.backup.scheduled ? `A cada ${data.backup.intervalHours}h` : 'Não configurado'],
              ['Último backup', data.backup.lastBackup ? `${data.backup.lastBackup.id} · ${data.backup.lastBackup.status} · ${data.backup.lastBackup.timestamp}` : 'Sem registo'],
              ['Cifra', data.backup.encryptionConfigured ? 'Chave configurada (AES-256-GCM)' : 'Não configurada'],
              ['Réplica externa', data.backup.replicaConfigured ? 'Diretório configurado' : 'Não configurada'],
            ]}
            empty="Sem dados de backup."
          />
        </SystemCard>

        <SystemCard title="Replicação" description="Só é apresentada se existir de facto.">
          <SystemMessage tone="info">{data.replication.reason}</SystemMessage>
          <div className="mt-2">
            <UnavailableMetric label="Réplica / standby" reason="Não existe réplica configurada nesta instância; o estado não é inventado." />
          </div>
        </SystemCard>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// APIs & integrações
// ---------------------------------------------------------------------------

export const SystemApisPage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const [days, setDays] = useState(7);
  const { data, loading, refreshing, error, reload } = useSectionData<SystemApis>(
    `/api/admin/system/apis?days=${days}`,
    refreshToken,
  );

  if (loading && !data) return <SystemLoading label="A agregar as requisições reais por rota…" />;
  if (error && !data) return <SystemMessage tone="error">{error}</SystemMessage>;
  if (!data) return <SystemEmpty text="Sem dados de APIs." />;

  const topRoutes = data.routes.slice(0, 10).map((route) => ({
    route: route.route.length > 28 ? `${route.route.slice(0, 28)}…` : route.route,
    requests: route.requests,
  }));

  return (
    <div className="space-y-3">
      <Toolbar
        refreshing={refreshing}
        onRefresh={() => void reload(true)}
        generatedAt={data.generatedAt}
        extra={
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
            Período
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2 py-1.5 text-[10px] font-bold">
              <option value={1}>Hoje</option>
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
        }
      />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      <SystemMessage tone="info">{data.note}</SystemMessage>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <SystemMetricTile label="Requisições" value={formatSystemNumber(data.totals.requests)} hint={`${days} dia(s)`} tone="info" />
        <SystemMetricTile label="Erros" value={formatSystemNumber(data.totals.errors)} hint={`Taxa ${formatSystemPercent(data.totals.errorRatePercent)}`} tone={(data.totals.errorRatePercent || 0) > 5 ? 'danger' : 'neutral'} />
        <SystemMetricTile label="Latência média" value={formatSystemMs(data.totals.averageLatencyMs)} hint="Agregado diário" />
        <SystemMetricTile label="Rotas instrumentadas" value={formatSystemNumber(data.totals.routes)} hint="Middleware HTTP existente" />
        <SystemMetricTile label="Integrações externas" value={data.integrations.length} hint={`${data.integrations.filter((item) => item.status === 'operational').length} operacionais`} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard title="Rotas com mais tráfego" description="Volume real registado em request_metrics.">
          {topRoutes.length === 0 ? (
            <SystemEmpty text="Sem requisições registadas neste período." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRoutes} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="route" width={150} tick={{ fontSize: 8.5 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number) => [formatSystemNumber(value), 'Requisições']} />
                  <Bar dataKey="requests" fill="#123e3b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SystemCard>

        <SystemCard title="Integrações externas" description="Configuração e estado declarados pela fonte real de cada integração.">
          <SystemTable
            headers={['Integração', 'Estado', 'Fonte']}
            rows={data.integrations.map((integration) => [
              <div>
                <div className="font-bold text-slate-800">{integration.name}</div>
                <div className="text-[9.5px] text-slate-500">{integration.notes}</div>
              </div>,
              <StatusPill status={integration.status} />,
              <span className="text-[9.5px] text-slate-500">{integration.source}</span>,
            ])}
            rowKeys={data.integrations.map((integration) => integration.id)}
            empty="Sem integrações externas inventariadas."
          />
        </SystemCard>
      </div>

      <SystemCard title="Todas as rotas" description="Volume, erros e latência média por rota.">
        <SystemTable
          headers={['Rota', 'Requisições', 'Erros', 'Taxa de erro', 'Latência média']}
          rows={data.routes.map((route) => [
            <span className="font-mono text-[9.5px] font-bold text-slate-800">{route.route}</span>,
            formatSystemNumber(route.requests),
            formatSystemNumber(route.errors),
            formatSystemPercent(route.errorRatePercent),
            formatSystemMs(route.averageLatencyMs),
          ])}
          rowKeys={data.routes.map((route) => route.route)}
          empty="Sem rotas registadas."
        />
      </SystemCard>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 text-[10px] font-bold text-slate-600"><Network className="h-3.5 w-3.5" /> Sem sonda externa ativa</div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 text-[10px] font-bold text-slate-600"><Wrench className="h-3.5 w-3.5" /> Sem transações financeiras de teste</div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 text-[10px] font-bold text-slate-600"><HardDrive className="h-3.5 w-3.5" /> Storage medido no filesystem</div>
      </div>
    </div>
  );
};
