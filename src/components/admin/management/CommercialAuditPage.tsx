import React, { useEffect, useMemo, useState } from 'react';
import { History, Layers3, UserRound } from 'lucide-react';
import {
  ManagementFilter,
  ManagementPagination,
  ManagementTable,
  ManagementToolbar,
  type ManagementColumn,
  type ManagementKpi,
} from './ManagementUi';
import { CommercialLoading, CommercialMessage, CommercialPageShell } from './CommercialShared';
import {
  commercialAuditLabel,
  commercialEntityLabel,
  commercialRequest,
  formatCommercialDate,
  type CommercialAuditItem,
} from './commercialApi';

type AuditResponse = {
  items: CommercialAuditItem[];
  versions: Array<{ id: string; version: number; reason: string; changedBy: string; snapshot: Record<string, unknown>; createdAt: string | null }>;
  planVersions: Array<{ id: string; planId: string; planName: string; version: number; changedBy: string; reason: string; catalogVersion: number; snapshot: Record<string, unknown>; createdAt: string | null }>;
};

const compactValue = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const relevant = object.after ?? object.newValue ?? object.name ?? object.monthly_xof ?? object.commission_percentage ?? object.status;
    return relevant === undefined ? JSON.stringify(value).slice(0, 80) : String(relevant);
  }
  return String(value);
};

export const CommercialAuditPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState<'audit' | 'catalog' | 'plans'>('audit');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '1000' });
    if (query) params.set('q', query);
    if (entityType) params.set('entityType', entityType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      setData(await commercialRequest<AuditResponse>(`/api/admin/commercial/audit?${params.toString()}`));
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [query, entityType, from, to]);
  useEffect(() => { setPage(1); }, [query, entityType, from, to, tab]);

  const items = data?.items || [];
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  const entities = useMemo(() => Array.from(new Set(items.map((item) => item.entityType))), [items]);
  const kpis: ManagementKpi[] = [
    { label: 'Alterações auditadas', value: items.length, hint: 'Valor anterior e novo', tone: 'info' },
    { label: 'Versões do catálogo', value: data?.versions.length ?? 0, hint: 'Histórico global', tone: 'success' },
    { label: 'Versões de planos', value: data?.planVersions.length ?? 0, hint: 'Fotografias por plano', tone: 'warning' },
    { label: 'Responsáveis', value: new Set(items.map((item) => item.actorName).filter(Boolean)).size, hint: 'Administradores registados', tone: 'neutral' },
  ];

  const columns: Array<ManagementColumn<CommercialAuditItem>> = [
    { key: 'date', label: 'Data e hora', sortable: true, render: (item) => <div><div className="font-bold">{formatCommercialDate(item.createdAt, true)}</div><div className="text-[9px] text-slate-500">catálogo v{item.catalogVersion}</div></div> },
    { key: 'entity', label: 'Entidade / ação', sortable: true, render: (item) => <div><div className="font-black text-slate-900">{commercialEntityLabel[item.entityType] || item.entityType}</div><div className="text-[9px] text-slate-500">{commercialAuditLabel[item.action] || item.action} · {item.entityId}</div></div> },
    { key: 'field', label: 'Campo', render: (item) => <span className="text-[10px]">{item.field || '—'}</span> },
    { key: 'values', label: 'Valor anterior → novo', render: (item) => <div className="max-w-[300px] space-y-0.5 text-[9.5px]"><div className="line-through text-slate-400">{compactValue((item as CommercialAuditItem & { oldValue?: unknown }).oldValue ?? null)}</div><div className="font-bold text-[var(--tone-success-text)]">{compactValue((item as CommercialAuditItem & { newValue?: unknown }).newValue ?? null)}</div></div> },
    { key: 'reason', label: 'Motivo', render: (item) => <span className="block max-w-[220px] text-[9.5px] text-slate-600">{item.reason || 'Sem motivo indicado'}</span> },
    { key: 'actor', label: 'Responsável', render: (item) => <span className="inline-flex items-center gap-1 text-[9.5px] font-bold"><UserRound className="h-3 w-3 text-slate-400" />{item.actorName || '—'}</span> },
  ];

  return (
    <CommercialPageShell
      title="Histórico e Auditoria"
      description="Registo imutável das alterações comerciais: preços, funcionalidades, quotas, produtos, taxas, categorias e versões do catálogo, com responsável, data, motivo e valor anterior."
      onBack={onBack}
      breadcrumb="Histórico e Auditoria"
      kpis={kpis}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      <div className="flex flex-wrap gap-1.5">
        {([['audit', 'Alterações', data?.items.length ?? 0], ['catalog', 'Versões do catálogo', data?.versions.length ?? 0], ['plans', 'Versões de planos', data?.planVersions.length ?? 0]] as const).map(([value, label, count]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-xl border px-3 py-1.5 text-[10px] font-black ${tab === value ? 'border-[var(--color-green-700)] bg-[var(--color-green-800)] text-white' : 'border-[var(--color-border-default)] bg-white text-slate-600'}`}>{label} ({count})</button>)}
      </div>
      {tab === 'audit' && <>
        <ManagementToolbar query={query} onQueryChange={setQuery} placeholder="Pesquisar entidade, ação, responsável ou motivo…" totalLabel={`${items.length} alteração(ões)`} onReset={() => { setQuery(''); setEntityType(''); setFrom(''); setTo(''); }}>
          <ManagementFilter label="Entidade" value={entityType} onChange={setEntityType} options={[{ value: '', label: 'Todas' }, ...entities.map((entity) => ({ value: entity, label: commercialEntityLabel[entity] || entity }))]} />
          <label className="flex min-w-[140px] flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Desde</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold" /></label>
          <label className="flex min-w-[140px] flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Até</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold" /></label>
        </ManagementToolbar>
        {loading ? <CommercialLoading label="A carregar auditoria…" /> : <>
          <ManagementTable columns={columns} rows={pageItems} rowKey={(item) => item.id} emptyMessage="Sem alterações para os filtros." />
          <ManagementPagination page={page} pageSize={pageSize} totalItems={items.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>}
      </>}
      {tab === 'catalog' && <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {(data?.versions || []).map((version) => <section key={version.id} className="rounded-2xl border border-[var(--color-border-default)] bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><strong className="flex items-center gap-1.5 text-[12px]"><Layers3 className="h-3.5 w-3.5" /> Catálogo v{version.version}</strong><span className="text-[9px] text-slate-500">{formatCommercialDate(version.createdAt, true)}</span></div><p className="mt-1 text-[10px] text-slate-600">{version.reason}</p><div className="mt-2 flex flex-wrap gap-1 text-[8.5px]">{Object.entries(version.snapshot || {}).map(([key, value]) => <span key={key} className="rounded-full bg-slate-100 px-1.5 py-0.5 font-bold text-slate-600">{key}: {typeof value === 'object' ? 'configurado' : String(value)}</span>)}</div><div className="mt-2 text-[9px] text-slate-500">Responsável: {version.changedBy}</div></section>)}
        {(data?.versions || []).length === 0 && <p className="text-[10.5px] text-slate-500">Sem versões de catálogo.</p>}
      </div>}
      {tab === 'plans' && <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-default)] bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-[10.5px]"><thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Plano</th><th className="p-3">Versão</th><th className="p-3">Motivo</th><th className="p-3">Responsável</th><th className="p-3">Data</th><th className="p-3">Catálogo</th></tr></thead><tbody>{(data?.planVersions || []).map((version) => <tr key={version.id} className="border-t border-[var(--color-border-subtle)]"><td className="p-3 font-black text-slate-900">{version.planName}</td><td className="p-3">v{version.version}</td><td className="p-3">{version.reason || '—'}</td><td className="p-3">{version.changedBy}</td><td className="p-3">{formatCommercialDate(version.createdAt, true)}</td><td className="p-3">v{version.catalogVersion}</td></tr>)}</tbody></table>
        {(data?.planVersions || []).length === 0 && <p className="p-6 text-center text-[10.5px] text-slate-500">Sem versões de planos.</p>}
      </div>}
      <p className="text-[9.5px] text-slate-500"><History className="mr-1 inline h-3 w-3" /> A auditoria é apenas de leitura. Nenhuma ação nesta página altera valores comerciais.</p>
    </CommercialPageShell>
  );
};
