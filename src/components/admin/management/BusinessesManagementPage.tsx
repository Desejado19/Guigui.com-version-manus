import React, { useMemo, useState } from 'react';
import { Download, Eye, FileSpreadsheet, FileText, Pencil, ShieldCheck, ShieldOff, Store, X } from 'lucide-react';
import type { Business, SubscriptionTier } from '../../../types';
import {
  formatManagementDate,
  MANAGEMENT_DEFAULT_PAGE_SIZE,
  matchesSearch,
  paginateItems,
  normaliseSearch,
  useManagementListState,
} from './managementState';
import {
  ManagementActionButton,
  ManagementFilter,
  ManagementKpiGrid,
  ManagementPage,
  ManagementPagination,
  ManagementRowActions,
  ManagementTable,
  ManagementToolbar,
  type ManagementColumn,
} from './ManagementUi';
import { exportManagementCsv, exportManagementExcel, exportManagementPdf } from './managementExports';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';
import { locationMatches } from '../../../../shared/bissauLocations';

type BusinessesFilterKey = 'status' | 'tier' | 'category' | 'location' | 'review' | 'dateFrom' | 'dateTo';

interface BusinessesManagementPageProps {
  businesses: Business[];
  onBack: () => void;
  onBusinessesChanged: (businesses: Business[]) => void;
  onDecision: (id: string, decision: 'approve' | 'reject', reason?: string) => Promise<boolean | void>;
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  basic: 'Basic',
  professional: 'Professional',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

const STATUS_META: Record<Business['status'], { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  pending: { label: 'Pendente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  suspended: { label: 'Suspensa', className: 'border-rose-200 bg-rose-50 text-rose-800' },
  rejected: { label: 'Rejeitada', className: 'border-slate-300 bg-slate-100 text-slate-700' },
};

function normalizeIdentity(value: string | undefined | null): string {
  return normaliseSearch(value);
}

function isTestRecord(business: Business): boolean {
  const haystack = [
    business.name,
    business.slug,
    business.email,
    business.publicEmail,
    business.phone,
    business.whatsapp,
    business.description,
  ]
    .map((value) => normalizeIdentity(value))
    .join(' ');

  return /(^|\s)(teste|test|demo|sandbox|exemplo)(\s|$)/.test(haystack)
    || haystack.includes('@example.')
    || haystack.includes('empresa teste')
    || haystack.includes('restaurante teste');
}

function buildDuplicateIds(businesses: Business[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const business of businesses) {
    const name = normalizeIdentity(business.name);
    const phone = normalizeIdentity(business.phone || business.whatsapp);
    if (!name && !phone) continue;
    const key = `${name}|${phone}`;
    const ids = groups.get(key) || [];
    ids.push(business.id);
    groups.set(key, ids);
  }

  const duplicates = new Set<string>();
  groups.forEach((ids) => {
    if (ids.length > 1) ids.forEach((id) => duplicates.add(id));
  });
  return duplicates;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-800 outline-none transition focus:border-[#123e3b] focus:ring-2 focus:ring-[#123e3b]/10';

export const BusinessesManagementPage: React.FC<BusinessesManagementPageProps> = ({
  businesses,
  onBack,
  onBusinessesChanged,
  onDecision,
}) => {
  const { state, setQuery, setFilter, setSort, setPage, setPageSize, reset } = useManagementListState<BusinessesFilterKey>(
    'admin.management.businesses',
    { status: 'all', tier: 'all', category: 'all', location: 'all', review: 'all', dateFrom: '', dateTo: '' },
    'createdAt',
    'desc',
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const duplicateIds = useMemo(() => buildDuplicateIds(businesses), [businesses]);
  const testIds = useMemo(() => new Set(businesses.filter(isTestRecord).map((business) => business.id)), [businesses]);

  const categories = useMemo(
    () => [...new Set(businesses.map((business) => business.category || business.categoryId).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt')),
    [businesses],
  );
  const { locations: catalogLocations } = useLocationCatalog();
  const locations = useMemo(() => {
    const fromData = businesses.map((business) => business.neighborhood).filter(Boolean);
    return Array.from(new Set([...catalogLocations.map((entry) => entry.name), ...fromData])).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [businesses, catalogLocations]);

  const filtered = useMemo(() => {
    const rows = businesses.filter((business) => {
      if (!matchesSearch(state.query, [
        business.name,
        business.slug,
        business.id,
        business.category,
        business.categoryId,
        business.neighborhood,
        business.address,
        business.phone,
        business.whatsapp,
        business.email,
        business.publicEmail,
      ])) return false;

      if (state.filters.status !== 'all' && business.status !== state.filters.status) return false;
      if (state.filters.tier !== 'all' && business.tier !== state.filters.tier) return false;
      if (state.filters.category !== 'all' && (business.category || business.categoryId) !== state.filters.category) return false;
      if (state.filters.location !== 'all' && !locationMatches(business.neighborhood, state.filters.location)) return false;
      if (state.filters.review === 'duplicates' && !duplicateIds.has(business.id)) return false;
      if (state.filters.review === 'test' && !testIds.has(business.id)) return false;

      const createdAt = business.createdAt ? business.createdAt.slice(0, 10) : '';
      if (state.filters.dateFrom && (!createdAt || createdAt < state.filters.dateFrom)) return false;
      if (state.filters.dateTo && (!createdAt || createdAt > state.filters.dateTo)) return false;

      return true;
    });

    const direction = state.sortDirection === 'asc' ? 1 : -1;
    return rows.sort((left, right) => {
      switch (state.sortKey) {
        case 'name':
          return left.name.localeCompare(right.name, 'pt') * direction;
        case 'category':
          return (left.category || '').localeCompare(right.category || '', 'pt') * direction;
        case 'location':
          return (left.neighborhood || '').localeCompare(right.neighborhood || '', 'pt') * direction;
        case 'tier':
          return (left.tier || '').localeCompare(right.tier || '', 'pt') * direction;
        case 'status':
          return (left.status || '').localeCompare(right.status || '', 'pt') * direction;
        case 'createdAt':
        default: {
          const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          return (leftTime - rightTime) * direction;
        }
      }
    });
  }, [businesses, duplicateIds, state.filters, state.query, state.sortDirection, state.sortKey, testIds]);

  const page = paginateItems(filtered, state.page, state.pageSize || MANAGEMENT_DEFAULT_PAGE_SIZE);
  const detail = detailId ? businesses.find((business) => business.id === detailId) || null : null;

  const counts = useMemo(() => ({
    total: businesses.length,
    active: businesses.filter((business) => business.status === 'active').length,
    pending: businesses.filter((business) => business.status === 'pending').length,
    suspended: businesses.filter((business) => business.status === 'suspended').length,
    rejected: businesses.filter((business) => business.status === 'rejected').length,
    duplicates: duplicateIds.size,
    test: testIds.size,
  }), [businesses, duplicateIds, testIds]);

  const exportHeaders = ['ID', 'Nome', 'Categoria', 'Localização', 'Plano', 'Estado', 'Telefone', 'Email', 'Registo'];
  const exportRows = filtered.map((business) => [
    business.id,
    business.name,
    business.category || business.categoryId || '',
    business.neighborhood || '',
    TIER_LABELS[business.tier] || business.tier,
    STATUS_META[business.status]?.label || business.status,
    business.phone || '',
    business.publicEmail || business.email || '',
    business.createdAt ? formatManagementDate(business.createdAt) : '',
  ]);

  const runExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    const filename = `empresas-guigui-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      exportManagementCsv(`${filename}.csv`, exportHeaders, exportRows);
      return;
    }
    if (format === 'xlsx') {
      exportManagementExcel(`${filename}.xlsx`, 'Empresas', exportHeaders, exportRows);
      return;
    }
    exportManagementPdf({
      title: 'Relatório de Empresas Registadas — Guigui.com',
      description: `Listagem administrativa com ${filtered.length} empresa(s) após aplicação dos filtros atuais.`,
      kpis: [
        { label: 'Total registadas', value: String(counts.total) },
        { label: 'Ativas', value: String(counts.active) },
        { label: 'Pendentes', value: String(counts.pending) },
        { label: 'Suspensas', value: String(counts.suspended) },
      ],
      headers: exportHeaders,
      rows: exportRows,
    });
  };

  const applyBusinessUpdate = (updated: Business) => {
    onBusinessesChanged(businesses.map((business) => (business.id === updated.id ? { ...business, ...updated } : business)));
  };

  const changeStatus = async (business: Business, status: 'active' | 'suspended') => {
    if (status === 'suspended' && !window.confirm(`Suspender "${business.name}"? A empresa deixa de aparecer publicamente sem perder a configuração de destaque.`)) {
      return;
    }
    setBusyId(business.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/businesses/${encodeURIComponent(business.id)}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Não foi possível alterar o estado da empresa.');
      }
      applyBusinessUpdate({ ...business, status });
      setFeedback({ tone: 'success', message: status === 'suspended' ? 'Empresa suspensa.' : 'Empresa reativada.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Falha ao alterar o estado da empresa.' });
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (business: Business, decision: 'approve' | 'reject') => {
    setBusyId(business.id);
    setFeedback(null);
    try {
      const applied = await onDecision(business.id, decision);
      if (applied === false) return;
      applyBusinessUpdate({ ...business, status: decision === 'approve' ? 'active' : 'rejected' });
      setFeedback({ tone: 'success', message: decision === 'approve' ? 'Empresa aprovada.' : 'Empresa rejeitada.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Falha ao registar a decisão.' });
    } finally {
      setBusyId(null);
    }
  };

  const startEditing = (business: Business) => {
    setEditing(true);
    setFeedback(null);
    setEditForm({
      name: business.name || '',
      categoryId: business.categoryId || '',
      description: business.description || '',
      phone: business.phone || '',
      neighborhood: business.neighborhood || '',
      address: business.address || '',
      whatsapp: business.whatsapp || '',
      publicEmail: business.publicEmail || business.email || '',
      website: business.website || '',
      openingHours: business.openingHours || '',
    });
  };

  const saveEdit = async () => {
    if (!detail) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload: Record<string, string> = {};
      Object.entries(editForm).forEach(([key, value]) => {
        const trimmed = value.trim();
        // Campos vazios não são enviados: evita apagar dados obrigatórios e
        // mantém a validação do servidor focada no que o administrador alterou.
        if (trimmed) payload[key] = trimmed;
      });
      if (Object.keys(payload).length === 0) {
        throw new Error('Altere pelo menos um campo antes de guardar.');
      }
      if (payload.description && payload.description.length < 30) {
        throw new Error('A descrição deve conter pelo menos 30 caracteres.');
      }
      const response = await fetch(`/api/businesses/${encodeURIComponent(detail.id)}/profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Não foi possível guardar as alterações.');
      }
      applyBusinessUpdate({ ...detail, ...payload });
      setEditing(false);
      setFeedback({ tone: 'success', message: 'Dados da empresa atualizados.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Falha ao guardar as alterações.' });
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<ManagementColumn<Business>> = [
    {
      key: 'name',
      label: 'Empresa',
      sortable: true,
      render: (business) => (
        <div className="flex min-w-[200px] items-center gap-2">
          {business.logo ? (
            <img src={business.logo} alt="" className="h-8 w-8 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Store className="h-4 w-4" /></div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-black text-slate-900">{business.name}</span>
              {duplicateIds.has(business.id) && <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[8px] font-black text-violet-700">DUPLICADO?</span>}
              {testIds.has(business.id) && <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[8px] font-black text-orange-700">TESTE</span>}
            </div>
            <div className="truncate text-[9.5px] font-medium text-slate-400">{business.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Categoria',
      sortable: true,
      render: (business) => <span className="text-[10.5px]">{business.category || business.categoryId || '—'}</span>,
    },
    {
      key: 'location',
      label: 'Localização',
      sortable: true,
      render: (business) => <span className="text-[10.5px]">{business.neighborhood || '—'}</span>,
    },
    {
      key: 'tier',
      label: 'Plano',
      sortable: true,
      render: (business) => <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">{TIER_LABELS[business.tier] || business.tier}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: (business) => {
        const meta = STATUS_META[business.status] || { label: business.status, className: 'border-slate-200 bg-slate-50 text-slate-700' };
        return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${meta.className}`}>{meta.label}</span>;
      },
    },
    {
      key: 'createdAt',
      label: 'Registo',
      sortable: true,
      render: (business) => <span className="whitespace-nowrap text-[10px] tabular-nums text-slate-500">{formatManagementDate(business.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Ações',
      className: 'text-right',
      render: (business) => (
        <ManagementRowActions>
          <ManagementActionButton onClick={() => { setDetailId(business.id); setEditing(false); setFeedback(null); }} title="Ver ficha">
            <Eye className="h-3.5 w-3.5" /> Ver
          </ManagementActionButton>
          <ManagementActionButton onClick={() => { setDetailId(business.id); startEditing(business); }} title="Editar dados">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </ManagementActionButton>
          {(business.status === 'pending' || business.status === 'rejected') && (
            <ManagementActionButton tone="success" disabled={busyId === business.id} onClick={() => void decide(business, 'approve')}>
              <ShieldCheck className="h-3.5 w-3.5" /> Aprovar
            </ManagementActionButton>
          )}
          {business.status === 'pending' && (
            <ManagementActionButton tone="danger" disabled={busyId === business.id} onClick={() => void decide(business, 'reject')}>
              <X className="h-3.5 w-3.5" /> Rejeitar
            </ManagementActionButton>
          )}
          {business.status === 'active' ? (
            <ManagementActionButton tone="warning" disabled={busyId === business.id} onClick={() => void changeStatus(business, 'suspended')}>
              <ShieldOff className="h-3.5 w-3.5" /> Suspender
            </ManagementActionButton>
          ) : (
            <ManagementActionButton tone="success" disabled={busyId === business.id} onClick={() => void changeStatus(business, 'active')}>
              <ShieldCheck className="h-3.5 w-3.5" /> Reativar
            </ManagementActionButton>
          )}
        </ManagementRowActions>
      ),
    },
  ];

  return (
    <ManagementPage
      title="Lista de empresas"
      description="Pesquise, filtre e ordene todas as empresas registadas. Cada ação é aplicada ao identificador único da empresa; empresas com o mesmo nome e contactos são sinalizadas para revisão."
      moduleLabel="Empresas & Negócios"
      onBack={onBack}
      kpis={[
        { label: 'Registos filtrados', value: filtered.length, hint: `${counts.total} no total`, tone: 'info' },
        { label: 'Ativas', value: counts.active, tone: 'success' },
        { label: 'Pendentes', value: counts.pending, tone: 'warning' },
        { label: 'Suspensas', value: counts.suspended, tone: 'danger' },
        { label: 'Revisão', value: counts.duplicates + counts.test, hint: `${counts.duplicates} duplicações · ${counts.test} teste`, tone: 'neutral' },
      ]}
      actions={
        <>
          <ManagementActionButton onClick={() => runExport('csv')}><Download className="h-3.5 w-3.5" /> CSV</ManagementActionButton>
          <ManagementActionButton onClick={() => runExport('xlsx')}><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</ManagementActionButton>
          <ManagementActionButton onClick={() => runExport('pdf')}><FileText className="h-3.5 w-3.5" /> PDF</ManagementActionButton>
        </>
      }
    >
      {feedback && (
        <div role="status" className={`rounded-xl border px-3.5 py-2.5 text-[11px] font-bold ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {feedback.message}
        </div>
      )}

      <ManagementToolbar
        query={state.query}
        onQueryChange={setQuery}
        placeholder="Pesquisar por nome, categoria, localização, contacto ou referência…"
        totalLabel={`${filtered.length} registo(s) encontrado(s) · página ${page.page} de ${page.totalPages}`}
        onReset={reset}
      >
        <ManagementFilter label="Estado" value={state.filters.status} onChange={(value) => setFilter('status', value)} options={[
          { value: 'all', label: 'Todos' },
          { value: 'active', label: 'Ativas' },
          { value: 'pending', label: 'Pendentes' },
          { value: 'suspended', label: 'Suspensas' },
          { value: 'rejected', label: 'Rejeitadas' },
        ]} />
        <ManagementFilter label="Plano" value={state.filters.tier} onChange={(value) => setFilter('tier', value)} options={[
          { value: 'all', label: 'Todos os planos' },
          { value: 'basic', label: 'Basic' },
          { value: 'professional', label: 'Professional' },
          { value: 'premium', label: 'Premium' },
          { value: 'enterprise', label: 'Enterprise' },
        ]} />
        <ManagementFilter label="Categoria" value={state.filters.category} onChange={(value) => setFilter('category', value)} options={[
          { value: 'all', label: 'Todas' },
          ...categories.map((category) => ({ value: category, label: category })),
        ]} />
        <ManagementFilter label="Localização" value={state.filters.location} onChange={(value) => setFilter('location', value)} options={[
          { value: 'all', label: 'Todas' },
          ...locations.map((location) => ({ value: location, label: location })),
        ]} />
        <ManagementFilter label="Revisão" value={state.filters.review} onChange={(value) => setFilter('review', value)} options={[
          { value: 'all', label: 'Sem destaque' },
          { value: 'duplicates', label: 'Possíveis duplicações' },
          { value: 'test', label: 'Possíveis testes' },
        ]} />
        <label className="flex min-w-[130px] flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Registo desde</span>
          <input type="date" value={state.filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} className={inputClass} />
        </label>
        <label className="flex min-w-[130px] flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Até</span>
          <input type="date" value={state.filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} className={inputClass} />
        </label>
      </ManagementToolbar>

      <ManagementTable
        columns={columns}
        rows={page.items}
        rowKey={(business) => business.id}
        sortKey={state.sortKey}
        sortDirection={state.sortDirection}
        onSort={setSort}
        rowClassName={(business) => (duplicateIds.has(business.id) || testIds.has(business.id) ? 'bg-violet-50/30' : '')}
      />

      <ManagementPagination
        page={page.page}
        pageSize={state.pageSize}
        totalItems={page.totalItems}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {detail && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${detail.name}`}>
          <div className="my-6 w-full max-w-3xl rounded-2xl border border-[#e6dac8] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                {detail.logo ? (
                  <img src={detail.logo} alt="" className="h-12 w-12 rounded-xl border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Store className="h-5 w-5" /></div>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900">{detail.name}</h3>
                  <p className="text-[10px] font-medium text-slate-500">{detail.category || detail.categoryId} · {detail.neighborhood} · {detail.id}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setDetailId(null); setEditing(false); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fechar ficha">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 text-[11px]">
              <div className="flex flex-wrap gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${STATUS_META[detail.status]?.className || ''}`}>{STATUS_META[detail.status]?.label || detail.status}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-600">{TIER_LABELS[detail.tier] || detail.tier}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-600">Registo: {formatManagementDate(detail.createdAt)}</span>
                {duplicateIds.has(detail.id) && <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-black text-violet-700">Possível duplicação</span>}
                {testIds.has(detail.id) && <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[9px] font-black text-orange-700">Possível registo de teste</span>}
              </div>

              {feedback && (
                <div className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                  {feedback.message}
                </div>
              )}

              {editing ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ['name', 'Nome'],
                    ['phone', 'Telefone'],
                    ['whatsapp', 'WhatsApp'],
                    ['publicEmail', 'Email público'],
                    ['neighborhood', 'Bairro / localização'],
                    ['address', 'Endereço'],
                    ['website', 'Website'],
                    ['openingHours', 'Horário'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
                      <input value={editForm[key] || ''} onChange={(event) => setEditForm((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Referência de categoria (ID)</span>
                    <input value={editForm.categoryId || ''} onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Descrição (mínimo 30 caracteres)</span>
                    <textarea rows={4} value={editForm.description || ''} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} />
                  </label>
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  {[
                    ['Telefone', detail.phone],
                    ['WhatsApp', detail.whatsapp],
                    ['Email', detail.publicEmail || detail.email],
                    ['Endereço', detail.address],
                    ['Horário', detail.openingHours],
                    ['Website', detail.website],
                    ['Categoria', detail.category || detail.categoryId],
                    ['Descrição', detail.description],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</dt>
                      <dd className="mt-0.5 text-[11px] font-medium text-slate-700">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-3.5">
              {editing ? (
                <>
                  <ManagementActionButton onClick={() => setEditing(false)} disabled={saving}>Cancelar</ManagementActionButton>
                  <ManagementActionButton tone="primary" onClick={() => void saveEdit()} disabled={saving}>
                    {saving ? 'A guardar…' : 'Guardar alterações'}
                  </ManagementActionButton>
                </>
              ) : (
                <>
                  <ManagementActionButton onClick={() => startEditing(detail)}><Pencil className="h-3.5 w-3.5" /> Editar</ManagementActionButton>
                  {detail.status === 'active' ? (
                    <ManagementActionButton tone="warning" onClick={() => void changeStatus(detail, 'suspended')}><ShieldOff className="h-3.5 w-3.5" /> Suspender</ManagementActionButton>
                  ) : (
                    <ManagementActionButton tone="success" onClick={() => void changeStatus(detail, 'active')}><ShieldCheck className="h-3.5 w-3.5" /> Reativar</ManagementActionButton>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ManagementPage>
  );
};

