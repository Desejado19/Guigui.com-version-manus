import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CalendarClock,
  Plus,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  formatSystemDate,
  formatSystemNumber,
  formatSystemPercent,
  systemRequest,
  type SystemAvailability,
  type SystemIncident,
  type SystemIncidentDetail,
  type SystemIncidentList,
  type SystemLogs,
  type SystemSecurity,
  type SystemSettingsValues,
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
} from './SystemShared';

function useSection<T>(url: string, refreshToken: number) {
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

const SectionToolbar: React.FC<{ refreshing: boolean; onRefresh: () => void; generatedAt?: string; extra?: React.ReactNode }> = ({
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
// Incidentes
// ---------------------------------------------------------------------------

const emptyIncidentForm = {
  title: '',
  description: '',
  severity: 'warning',
  service: 'platform',
  category: 'operational',
  impact: '',
  probableCause: '',
  assignedTo: '',
};

export const SystemIncidentsPage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('/api/admin/system/incidents');
  const { data, loading, refreshing, error, reload } = useSection<SystemIncidentList>(url, refreshToken);
  const [detail, setDetail] = useState<SystemIncidentDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [form, setForm] = useState(emptyIncidentForm);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [resolution, setResolution] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    if (query.trim()) params.set('q', query.trim());
    setUrl(`/api/admin/system/incidents${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const openDetail = async (incident: SystemIncident) => {
    setDetailError('');
    try {
      setDetail(await systemRequest<SystemIncidentDetail>(`/api/admin/system/incidents/${incident.id}`));
      setResolution(incident.resolution || '');
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : 'Não foi possível abrir o incidente.');
    }
  };

  const createIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setActionError('');
    try {
      await systemRequest('/api/admin/system/incidents', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm(emptyIncidentForm);
      setShowForm(false);
      await reload(true);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível criar o incidente.');
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (incident: SystemIncident, nextStatus: 'acknowledged' | 'resolved') => {
    setSavingId(incident.id);
    setActionError('');
    try {
      await systemRequest(`/api/admin/system/incidents/${incident.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, resolution: nextStatus === 'resolved' ? resolution : undefined }),
      });
      await reload(true);
      if (detail?.incident.id === incident.id) await openDetail(incident);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o incidente.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading && !data) return <SystemLoading label="A carregar incidentes reais…" />;

  return (
    <div className="space-y-3">
      <SectionToolbar refreshing={refreshing} onRefresh={() => void reload(true)} extra={
        <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] bg-white px-2.5 py-1.5 text-[10px] font-black text-[var(--color-green-800)]">
          <Plus className="h-3 w-3" /> {showForm ? 'Fechar formulário' : 'Registar incidente'}
        </button>
      } />

      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {actionError && <SystemMessage tone="error">{actionError}</SystemMessage>}
      {data?.warning && <SystemMessage tone="warning">{data.warning}</SystemMessage>}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SystemMetricTile label="Abertos" value={data?.totals?.open ?? '—'} tone="danger" hint="A aguardar ação" />
        <SystemMetricTile label="Reconhecidos" value={data?.totals?.acknowledged ?? '—'} tone="warning" hint="Em tratamento" />
        <SystemMetricTile label="Resolvidos" value={data?.totals?.resolved ?? '—'} tone="success" hint="Histórico total" />
        <SystemMetricTile label="Mostrados" value={data?.incidents.length ?? 0} tone="info" hint="Filtro atual" />
      </div>

      {showForm && (
        <SystemCard title="Registar incidente manual" description="O incidente é persistido e auditado. Serve para eventos observados fora das métricas automáticas.">
          <form onSubmit={createIncident} className="grid gap-2.5 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Título *</span>
              <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Gravidade</span>
              <select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold">
                <option value="info">Informação</option>
                <option value="warning">Aviso</option>
                <option value="critical">Crítico</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Serviço</span>
              <input value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Categoria</span>
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Responsável</span>
              <input value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Descrição</span>
              <textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Impacto</span>
              <input value={form.impact} onChange={(event) => setForm({ ...form, impact: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Causa provável</span>
              <input value={form.probableCause} onChange={(event) => setForm({ ...form, probableCause: event.target.value })} className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" disabled={creating} className="rounded-lg bg-[var(--color-green-800)] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">
                {creating ? 'A registar…' : 'Registar incidente'}
              </button>
            </div>
          </form>
        </SystemCard>
      )}

      <SystemCard title="Filtros" description="Filtros aplicados no backend sobre incidentes persistidos.">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[130px] flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Estado</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold">
              <option value="">Todos</option>
              <option value="open">Aberto</option>
              <option value="acknowledged">Reconhecido</option>
              <option value="resolved">Resolvido</option>
            </select>
          </label>
          <label className="flex min-w-[130px] flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Gravidade</span>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold">
              <option value="">Todas</option>
              <option value="critical">Crítica</option>
              <option value="warning">Aviso</option>
              <option value="info">Informação</option>
            </select>
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Pesquisar</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título ou descrição" className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
          </label>
          <button type="button" onClick={applyFilters} className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-green-700)] bg-white px-2.5 py-2 text-[10px] font-black text-[var(--color-green-800)]"><Search className="h-3 w-3" /> Aplicar</button>
        </div>
      </SystemCard>

      <SystemCard title="Incidentes" description="Origem automática (limites configurados) ou manual. Clique para abrir o histórico.">
        <SystemTable
          headers={['Incidente', 'Gravidade', 'Serviço', 'Estado', 'Detetado', 'Ações']}
          rows={(data?.incidents || []).map((incident) => [
            <button type="button" onClick={() => void openDetail(incident)} className="text-left">
              <div className="font-bold text-slate-800">{incident.title}</div>
              <div className="text-[9.5px] text-slate-500">{incident.source === 'automatic' ? 'Automático' : 'Manual'} · {incident.category}</div>
            </button>,
            <StatusPill status={incident.severity} />,
            incident.service,
            <StatusPill status={incident.status} />,
            <span className="text-[9.5px] text-slate-500">{formatSystemDate(incident.detectedAt)}</span>,
            <div className="flex flex-wrap gap-1">
              {incident.status === 'open' && (
                <button type="button" disabled={savingId === incident.id} onClick={() => void changeStatus(incident, 'acknowledged')} className="rounded-md border border-[var(--color-border-default)] px-1.5 py-0.5 text-[9px] font-black text-slate-700 disabled:opacity-50">Reconhecer</button>
              )}
              {incident.status !== 'resolved' && (
                <button type="button" disabled={savingId === incident.id} onClick={() => void changeStatus(incident, 'resolved')} className="rounded-md border border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] px-1.5 py-0.5 text-[9px] font-black text-[var(--tone-success-text)] disabled:opacity-50">Resolver</button>
              )}
            </div>,
          ])}
          rowKeys={(data?.incidents || []).map((incident) => incident.id)}
          empty="Sem incidentes para os filtros atuais."
        />
      </SystemCard>

      {detailError && <SystemMessage tone="error">{detailError}</SystemMessage>}

      {detail && (
        <SystemCard
          title={`Incidente ${detail.incident.id}`}
          description={detail.incident.description}
          actions={<button type="button" onClick={() => setDetail(null)} className="text-[10px] font-black text-slate-500 underline">Fechar</button>}
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <SystemMetricTile label="Estado" value={<StatusPill status={detail.incident.status} />} hint={detail.incident.source === 'automatic' ? 'Automático' : 'Manual'} />
            <SystemMetricTile label="Gravidade" value={<StatusPill status={detail.incident.severity} />} hint={detail.incident.category} />
            <SystemMetricTile label="Serviço" value={detail.incident.service} hint={detail.incident.assignedTo || 'Sem responsável'} />
            <SystemMetricTile label="Detetado" value={formatSystemDate(detail.incident.detectedAt, false)} hint={formatSystemDate(detail.incident.detectedAt)} />
          </div>
          {(detail.incident.impact || detail.incident.probableCause) && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {detail.incident.impact && <SystemMessage tone="warning">Impacto: {detail.incident.impact}</SystemMessage>}
              {detail.incident.probableCause && <SystemMessage tone="info">Causa provável: {detail.incident.probableCause}</SystemMessage>}
            </div>
          )}
          {detail.incident.status !== 'resolved' && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-[240px] flex-1 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Resolução</span>
                <input value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Descreva a correção aplicada" className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
              </label>
              <button type="button" disabled={savingId === detail.incident.id} onClick={() => void changeStatus(detail.incident, 'resolved')} className="rounded-lg bg-[var(--color-green-800)] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">Resolver incidente</button>
            </div>
          )}
          <div className="mt-3">
            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Histórico</div>
            <div className="space-y-1.5">
              {detail.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[10px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-slate-700">{event.eventType}</span>
                    <span className="text-[9px] text-slate-400">{formatSystemDate(event.createdAt)} · {event.actor || '—'}</span>
                  </div>
                  <div className="text-slate-600">{event.message}</div>
                </div>
              ))}
              {detail.events.length === 0 && <SystemEmpty text="Sem eventos registados." />}
            </div>
          </div>
        </SystemCard>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Logs & diagnóstico
// ---------------------------------------------------------------------------

export const SystemLogsPage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const [level, setLevel] = useState('');
  const [service, setService] = useState('');
  const [hours, setHours] = useState(24);
  const [query, setQuery] = useState('');
  const [requestId, setRequestId] = useState('');
  const [url, setUrl] = useState('/api/admin/system/logs?hours=24');
  const { data, loading, refreshing, error, reload } = useSection<SystemLogs>(url, refreshToken);
  const [expanded, setExpanded] = useState<string | null>(null);

  const apply = () => {
    const params = new URLSearchParams({ hours: String(hours) });
    if (level) params.set('level', level);
    if (service) params.set('service', service);
    if (query.trim()) params.set('q', query.trim());
    if (requestId.trim()) params.set('requestId', requestId.trim());
    setUrl(`/api/admin/system/logs?${params.toString()}`);
  };

  if (loading && !data) return <SystemLoading label="A consultar os logs técnicos persistidos…" />;

  return (
    <div className="space-y-3">
      <SectionToolbar refreshing={refreshing} onRefresh={() => void reload(true)} generatedAt={data?.generatedAt} />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {data?.warning && <SystemMessage tone="warning">{data.warning}</SystemMessage>}
      {data && <SystemMessage tone="info">{data.retentionNote}</SystemMessage>}

      <SystemCard title="Filtros" description="Pesquisa no backend por nível, serviço, período e identificador de pedido.">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[110px] flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Nível</span>
            <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold">
              <option value="">Todos</option>
              <option value="error">Erro</option>
              <option value="warn">Aviso</option>
              <option value="info">Informação</option>
              <option value="debug">Debug</option>
            </select>
          </label>
          <label className="flex min-w-[140px] flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Serviço</span>
            <select value={service} onChange={(event) => setService(event.target.value)} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold">
              <option value="">Todos</option>
              {(data?.services || []).map((entry) => <option key={entry.service} value={entry.service}>{entry.service} ({entry.count})</option>)}
            </select>
          </label>
          <label className="flex min-w-[110px] flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Período</span>
            <select value={hours} onChange={(event) => setHours(Number(event.target.value))} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold">
              <option value={1}>1 hora</option>
              <option value={24}>24 horas</option>
              <option value={72}>3 dias</option>
              <option value={168}>7 dias</option>
            </select>
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Mensagem / rota</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ex.: 500, /api/payments" className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
          </label>
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Request ID / Trace ID</span>
            <input value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="ID do pedido" className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px]" />
          </label>
          <button type="button" onClick={apply} className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-green-700)] bg-white px-2.5 py-2 text-[10px] font-black text-[var(--color-green-800)]"><Search className="h-3 w-3" /> Filtrar</button>
        </div>
      </SystemCard>

      <SystemCard title="Logs técnicos" description="Respostas HTTP com erro/lentas e eventos explícitos dos serviços. Clique numa linha para ver o contexto sanitizado.">
        <SystemTable
          headers={['Hora', 'Nível', 'Serviço', 'Rota', 'Mensagem', 'Duração']}
          rows={(data?.logs || []).map((log) => [
            <span className="whitespace-nowrap text-[9.5px] text-slate-500">{formatSystemDate(log.createdAt)}</span>,
            <StatusPill status={log.level === 'error' ? 'critical' : log.level === 'warn' ? 'warning' : 'info'} label={log.level} />,
            <span className="font-mono text-[9.5px]">{log.service}</span>,
            <span className="font-mono text-[9.5px]">{log.route || '—'}</span>,
            <button type="button" onClick={() => setExpanded(expanded === log.id ? null : log.id)} className="text-left">
              <span className="font-medium text-slate-800">{log.message}</span>
              {log.requestId && <span className="ml-1 text-[9px] text-slate-400">#{log.requestId.slice(0, 12)}</span>}
              {expanded === log.id && (
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-2 text-[9px] text-slate-200">{JSON.stringify({ ...log.context, statusCode: log.statusCode, requestId: log.requestId, traceId: log.traceId }, null, 2)}</pre>
              )}
            </button>,
            log.durationMs !== null ? `${log.durationMs} ms` : '—',
          ])}
          rowKeys={(data?.logs || []).map((log) => log.id)}
          empty="Sem logs para os filtros atuais. Os logs surgem de respostas >=400 ou com duração >=1000 ms."
        />
      </SystemCard>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Disponibilidade
// ---------------------------------------------------------------------------

export const SystemAvailabilityPage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const { data, loading, refreshing, error, reload } = useSection<SystemAvailability>(
    '/api/admin/system/availability',
    refreshToken,
  );

  if (loading && !data) return <SystemLoading label="A calcular a disponibilidade a partir das amostras…" />;
  if (error && !data) return <SystemMessage tone="error">{error}</SystemMessage>;
  if (!data) return <SystemEmpty text="Sem dados de disponibilidade." />;

  return (
    <div className="space-y-3">
      <SectionToolbar refreshing={refreshing} onRefresh={() => void reload(true)} generatedAt={data.generatedAt} />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {data.warnings.length > 0 && <SystemMessage tone="warning">{data.warnings.join(' · ')}</SystemMessage>}

      <div className="grid gap-2.5 sm:grid-cols-3">
        {data.periods.map((period) => (
          <SystemMetricTile
            key={period.days}
            label={`Disponibilidade ${period.days === 1 ? '24h' : `${period.days} dias`}`}
            value={period.sufficient ? formatSystemPercent(period.uptimePercent) : 'Dados insuficientes'}
            hint={`${period.healthySamples}/${period.samples} amostras saudáveis`}
            tone={period.sufficient ? ((period.uptimePercent || 0) >= data.slo.target ? 'success' : 'warning') : 'neutral'}
          />
        ))}
      </div>

      <SystemCard title="Objetivo de nível de serviço (SLO)" description={data.slo.note}>
        <div className="grid gap-2 sm:grid-cols-3">
          <SystemMetricTile label="SLO configurado" value={formatSystemPercent(data.slo.target)} hint="Definido em Configurações" />
          <SystemMetricTile label="Disponibilidade 24h" value={formatSystemPercent(data.slo.current)} tone={data.slo.met === false ? 'danger' : data.slo.met ? 'success' : 'neutral'} />
          <SystemMetricTile label="Cumprimento" value={data.slo.met === null ? 'Sem dados' : data.slo.met ? 'Cumprido' : 'Não cumprido'} tone={data.slo.met === false ? 'danger' : data.slo.met ? 'success' : 'neutral'} hint={data.mttrMinutes !== null ? `MTTR ${data.mttrMinutes} min` : 'MTTR indisponível'} />
        </div>
        <div className="mt-2">
          <SystemMessage tone="info">
            A percentagem é a proporção de amostras com o processo ativo e a base de dados acessível. Uma paragem total do alojamento interrompe também a recolha, por isso este indicador não substitui um SLA externo.
          </SystemMessage>
        </div>
      </SystemCard>

      <SystemCard title="Incidentes (30 dias)" description="Duração calculada entre deteção e resolução.">
        <SystemTable
          headers={['Incidente', 'Gravidade', 'Serviço', 'Estado', 'Detetado', 'Duração']}
          rows={data.incidents.map((incident) => [
            incident.title,
            <StatusPill status={incident.severity} />,
            incident.service,
            <StatusPill status={incident.status} />,
            <span className="text-[9.5px] text-slate-500">{formatSystemDate(incident.detectedAt)}</span>,
            incident.durationMinutes !== null ? `${Math.round(incident.durationMinutes)} min` : 'Em curso',
          ])}
          rowKeys={data.incidents.map((incident) => incident.id)}
          empty="Sem incidentes nos últimos 30 dias."
        />
      </SystemCard>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 text-[10px] font-bold text-slate-600"><CalendarClock className="h-3.5 w-3.5" /> Amostras: {formatSystemNumber(data.periods[0]?.samples)}</div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 text-[10px] font-bold text-slate-600"><Activity className="h-3.5 w-3.5" /> MTTR: {data.mttrMinutes !== null ? `${data.mttrMinutes} min` : '—'}</div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 text-[10px] font-bold text-slate-600"><ShieldCheck className="h-3.5 w-3.5" /> Fonte: system_metric_samples</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Segurança & auditoria
// ---------------------------------------------------------------------------

export const SystemSecurityPage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const [days, setDays] = useState(7);
  const { data, loading, refreshing, error, reload } = useSection<SystemSecurity>(
    `/api/admin/system/security?days=${days}`,
    refreshToken,
  );

  if (loading && !data) return <SystemLoading label="A ler a trilha de auditoria real…" />;
  if (error && !data) return <SystemMessage tone="error">{error}</SystemMessage>;
  if (!data) return <SystemEmpty text="Sem dados de segurança." />;

  return (
    <div className="space-y-3">
      <SectionToolbar
        refreshing={refreshing}
        onRefresh={() => void reload(true)}
        generatedAt={data.generatedAt}
        extra={
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
            Período
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2 py-1.5 text-[10px] font-bold">
              <option value={1}>24 horas</option>
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
        }
      />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {data.warnings.length > 0 && <SystemMessage tone="warning">{data.warnings.join(' · ')}</SystemMessage>}
      <SystemMessage tone="info">{data.note}</SystemMessage>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <SystemMetricTile label="Falhas de login" value={formatSystemNumber(data.summary?.failedLogins)} hint="Autenticação recusada" tone={(data.summary?.failedLogins || 0) > 0 ? 'warning' : 'success'} />
        <SystemMetricTile label="Acessos negados" value={formatSystemNumber(data.summary?.authorizationDenied)} hint="Autorização recusada" tone={(data.summary?.authorizationDenied || 0) > 0 ? 'warning' : 'success'} />
        <SystemMetricTile label="Ações administrativas" value={formatSystemNumber(data.summary?.adminActions)} hint="Registadas na auditoria" />
        <SystemMetricTile label="Falhas totais" value={formatSystemNumber(data.summary?.failures)} hint="Qualquer resultado failure" tone={(data.summary?.failures || 0) > 0 ? 'warning' : 'success'} />
        <SystemMetricTile label="Eventos totais" value={formatSystemNumber(data.summary?.total)} hint={`${days} dia(s)`} tone="info" />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SystemCard title="Ações mais frequentes" description="Agrupadas por ação e resultado na trilha de auditoria.">
          <SystemTable
            headers={['Ação', 'Resultado', 'Eventos']}
            rows={data.byAction.map((entry) => [entry.action, entry.result === 'success' ? 'Sucesso' : 'Falha', formatSystemNumber(entry.count)])}
            rowKeys={data.byAction.map((entry, index) => `${entry.action}-${entry.result}-${index}`)}
            empty="Sem eventos no período."
          />
        </SystemCard>

        <SystemCard title="Eventos recentes" description="Últimos registos; sem dados sensíveis.">
          <SystemTable
            headers={['Data', 'Ação', 'Recurso', 'Resultado', 'Ator']}
            rows={data.recent.map((entry) => [
              <span className="whitespace-nowrap text-[9.5px] text-slate-500">{formatSystemDate(entry.createdAt)}</span>,
              entry.action,
              entry.resourceId ? `${entry.resource} · ${entry.resourceId}` : entry.resource,
              entry.result === 'success' ? 'Sucesso' : 'Falha',
              entry.actorName || entry.actorRole || '—',
            ])}
            rowKeys={data.recent.map((entry) => entry.id)}
            empty="Sem eventos recentes."
          />
        </SystemCard>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

const SETTING_FIELDS: Array<{
  key: keyof Pick<SystemSettingsValues, 'intervalSeconds' | 'cpuThreshold' | 'memoryThreshold' | 'dbLatencyThresholdMs' | 'errorRateThreshold' | 'retentionDays' | 'sloTarget'>;
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  help: string;
}> = [
  { key: 'intervalSeconds', label: 'Intervalo de recolha', unit: 'segundos', min: 10, max: 3600, help: 'Cada execução grava uma amostra e avalia os limites.' },
  { key: 'cpuThreshold', label: 'Limite de CPU', unit: '%', min: 1, max: 100, help: 'Acima deste valor é aberto um incidente automático.' },
  { key: 'memoryThreshold', label: 'Limite de memória', unit: '%', min: 1, max: 100, help: 'Percentagem de memória usada no host.' },
  { key: 'dbLatencyThresholdMs', label: 'Limite de latência da BD', unit: 'ms', min: 10, max: 60000, help: 'Tempo máximo aceitável para a verificação SELECT 1.' },
  { key: 'errorRateThreshold', label: 'Limite de taxa de erro', unit: '%', min: 0, max: 100, step: 0.1, help: 'Só é avaliado com pelo menos 20 requisições no dia.' },
  { key: 'retentionDays', label: 'Retenção de dados', unit: 'dias', min: 1, max: 365, help: 'Amostras e logs mais antigos são eliminados.' },
  { key: 'sloTarget', label: 'Objetivo de disponibilidade', unit: '%', min: 90, max: 100, step: 0.1, help: 'Usado no cálculo de cumprimento do SLO.' },
];

export const SystemSettingsPage: React.FC<{ refreshToken: number }> = ({ refreshToken }) => {
  const { data, loading, refreshing, error, reload } = useSection<{
    settings: SystemSettingsValues;
    source: 'database' | 'defaults';
    warning?: string;
  }>('/api/admin/system/settings', refreshToken);
  const [form, setForm] = useState<SystemSettingsValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState('');

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaveError('');
    setSaveOk('');
    try {
      const result = await systemRequest<{ settings: SystemSettingsValues }>('/api/admin/system/settings', {
        method: 'PUT',
        body: JSON.stringify({
          intervalSeconds: form.intervalSeconds,
          cpuThreshold: form.cpuThreshold,
          memoryThreshold: form.memoryThreshold,
          dbLatencyThresholdMs: form.dbLatencyThresholdMs,
          errorRateThreshold: form.errorRateThreshold,
          retentionDays: form.retentionDays,
          sloTarget: form.sloTarget,
          alertsEnabled: form.alertsEnabled,
        }),
      });
      setForm(result.settings);
      setSaveOk('Configuração guardada e aplicada ao próximo ciclo de monitorização.');
      await reload(true);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Não foi possível guardar a configuração.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <SystemLoading label="A carregar a configuração persistida…" />;
  if (error && !data) return <SystemMessage tone="error">{error}</SystemMessage>;
  if (!form) return <SystemEmpty text="Sem configuração disponível." />;

  return (
    <div className="space-y-3">
      <SectionToolbar refreshing={refreshing} onRefresh={() => void reload(true)} />
      {error && <SystemMessage tone="error">{error}</SystemMessage>}
      {data?.warning && <SystemMessage tone="warning">{data.warning}</SystemMessage>}
      {data?.source === 'defaults' && <SystemMessage tone="warning">A configuração está a usar valores por omissão porque a tabela não está disponível. Aplique a migração 036.</SystemMessage>}
      {saveError && <SystemMessage tone="error">{saveError}</SystemMessage>}
      {saveOk && <SystemMessage tone="success">{saveOk}</SystemMessage>}

      <SystemCard title="Configuração da monitorização" description="Cada valor é validado e persistido. Os limites são aplicados pelo ciclo automático que cria e resolve incidentes.">
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {SETTING_FIELDS.map((field) => (
              <label key={field.key} className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">{field.label} ({field.unit})</span>
                <input
                  type="number"
                  required
                  min={field.min}
                  max={field.max}
                  step={field.step || 1}
                  value={form[field.key]}
                  onChange={(event) => setForm({ ...form, [field.key]: Number(event.target.value) })}
                  className="w-full rounded-lg border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold tabular-nums"
                />
                <span className="block text-[9.5px] leading-snug text-slate-500">{field.help}</span>
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] px-2.5 py-2 text-[10.5px] font-bold text-slate-700">
            <input type="checkbox" checked={form.alertsEnabled} onChange={(event) => setForm({ ...form, alertsEnabled: event.target.checked })} />
            Gerar incidentes automáticos quando os limites forem excedidos
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[9.5px] text-slate-500">
              Última alteração: {formatSystemDate(form.updatedAt)} · {form.updatedBy || '—'}
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-green-800)] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {saving ? 'A guardar…' : 'Guardar configuração'}
            </button>
          </div>
        </form>
      </SystemCard>

      <SystemCard title="Efeito real das configurações" description="Resumo do que cada parâmetro altera no sistema.">
        <SystemTable
          headers={['Parâmetro', 'Efeito']}
          rows={[
            ['Intervalo de recolha', `O ciclo automático corre a cada ${form.intervalSeconds}s e grava uma amostra em system_metric_samples.`],
            ['Limites de CPU / memória / latência', `Abertos incidentes automáticos acima de ${form.cpuThreshold}% CPU, ${form.memoryThreshold}% memória ou ${form.dbLatencyThresholdMs} ms de latência.`],
            ['Taxa de erro', `Incidente quando a taxa diária exceder ${form.errorRateThreshold}% (com pelo menos 20 requisições).`],
            ['Retenção', `Amostras e logs com mais de ${form.retentionDays} dias são eliminados no arranque do ciclo.`],
            ['SLO', `A disponibilidade de 24h é comparada com ${form.sloTarget}%.`],
            ['Alertas automáticos', form.alertsEnabled ? 'Ativos: incidentes são criados e resolvidos automaticamente.' : 'Desativados: apenas incidentes manuais são registados.'],
          ]}
          empty="Sem configuração."
        />
      </SystemCard>
    </div>
  );
};
