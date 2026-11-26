import React, { useEffect, useState } from 'react';
import { ArrowUpDown, Ban, CalendarClock, Eye, Gauge, RotateCcw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import {
  ManagementActionButton,
  ManagementFilter,
  ManagementPagination,
  ManagementTable,
  ManagementToolbar,
  type ManagementColumn,
  type ManagementKpi,
} from './ManagementUi';
import {
  CommercialField,
  CommercialLoading,
  CommercialMessage,
  CommercialModal,
  CommercialPageShell,
  CommercialStatusBadge,
  commercialInputClass,
} from './CommercialShared';
import {
  commercialRequest,
  formatCommercialDate,
  formatCommercialXOF,
  commercialStatusLabel,
  type CommercialGroup,
  type CommercialOverview,
  type CommercialPlan,
  type CommercialSubscription,
  type SubscriptionDetail,
  type SubscriptionEntitlements,
} from './commercialApi';

const limitText = (value: number | 'unlimited' | 'negotiated' | null) => (
  value === 'unlimited' ? 'Ilimitado' : value === 'negotiated' ? 'Negociado' : value === null ? '—' : String(value)
);

export const CommercialSubscriptionsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<CommercialSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [groups, setGroups] = useState<CommercialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [planId, setPlanId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [provider, setProvider] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({ endsAt: '', billingPeriod: 'monthly', contractedPriceXOF: '', paymentTransactionId: '', provider: '', paymentType: '', reason: '' });
  const [statusForm, setStatusForm] = useState<{ status: string; notes: string; reason: string } | null>(null);
  const [entitlements, setEntitlements] = useState<SubscriptionEntitlements | null>(null);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [planChangeForm, setPlanChangeForm] = useState({ planId: '', billingPeriod: 'monthly', contractedPriceXOF: '', reason: '', resetExceptions: false });
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  const [exceptionsForm, setExceptionsForm] = useState<{ priceXOF: string; billingPeriod: string; limits: Record<string, string>; features: Record<string, string>; notes: string; reason: string } | null>(null);

  useEffect(() => {
    void commercialRequest<CommercialOverview>('/api/admin/commercial/overview').then((data) => {
      setPlans(data.plans);
      setGroups(data.groups);
    }).catch(() => undefined);
  }, []);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (query) params.set('q', query);
    if (planId) params.set('planId', planId);
    if (groupId) params.set('groupId', groupId);
    if (provider) params.set('provider', provider);
    if (paymentType) params.set('paymentType', paymentType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const data = await commercialRequest<{ items: CommercialSubscription[]; counts: Record<string, number> }>(`/api/admin/commercial/subscriptions?${params.toString()}`);
      setItems(data.items);
      setCounts(data.counts);
      setTotal(data.items.length);
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status, query, planId, groupId, provider, paymentType, from, to]);

  useEffect(() => { setPage(1); }, [status, query, planId, groupId, provider, paymentType, from, to]);

  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  const kpis: ManagementKpi[] = [
    { label: 'Todas as assinaturas', value: counts.all ?? 0, hint: 'Empresas na base', tone: 'neutral' },
    { label: 'Ativas', value: counts.active ?? 0, hint: 'Contrato válido', tone: 'success' },
    { label: 'Pendentes', value: counts.pending ?? 0, hint: 'A aguardar ativação', tone: 'warning' },
    { label: 'Expiradas / suspensas', value: `${counts.expired ?? 0} / ${counts.suspended ?? 0}`, hint: `${counts.cancelled ?? 0} canceladas`, tone: 'danger' },
  ];

  const openDetail = async (id: string) => {
    setDetail(null);
    setEntitlements(null);
    try {
      const [record, usage] = await Promise.all([
        commercialRequest<SubscriptionDetail>(`/api/admin/commercial/subscriptions/${encodeURIComponent(id)}`),
        commercialRequest<SubscriptionEntitlements>(`/api/admin/commercial/subscriptions/${encodeURIComponent(id)}/entitlements`).catch(() => null),
      ]);
      setDetail(record);
      setEntitlements(usage);
    } catch (detailError) {
      setError((detailError as Error).message);
    }
  };

  const openPlanChange = () => {
    if (!detail) return;
    setPlanChangeForm({
      planId: '',
      billingPeriod: detail.subscription.billingPeriod || 'monthly',
      contractedPriceXOF: '',
      reason: '',
      resetExceptions: false,
    });
    setPlanChangeOpen(true);
  };

  const changePlan = async () => {
    if (!detail || !planChangeForm.planId) return;
    setBusy(true);
    try {
      const result = await commercialRequest<{ changeType: string; planName: string }>(
        `/api/admin/commercial/subscriptions/${detail.subscription.id}/plan-change`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...planChangeForm,
            contractedPriceXOF: planChangeForm.contractedPriceXOF === '' ? undefined : Number(planChangeForm.contractedPriceXOF),
            reason: planChangeForm.reason || `Mudança para ${planChangeForm.planId}`,
          }),
        },
      );
      setPlanChangeOpen(false);
      setNotice(`Plano alterado para ${result.planName} (${result.changeType}). Nova fotografia contratual guardada e auditada.`);
      await openDetail(detail.subscription.id);
      await load();
    } catch (planError) {
      setError((planError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openExceptions = () => {
    if (!detail) return;
    const rows = entitlements?.entitlements || [];
    const limits: Record<string, string> = {};
    const features: Record<string, string> = {};
    for (const row of rows) {
      if (['number', 'unlimited', 'negotiated'].includes(row.limitKind)) {
        const value = detail.exceptions.limits[row.code];
        limits[row.code] = value === undefined ? '' : String(value);
      } else if (row.valueType === 'flag' || row.limitKind === 'flag') {
        const value = detail.exceptions.features[row.code];
        features[row.code] = value === undefined ? 'inherit' : value ? 'true' : 'false';
      }
    }
    setExceptionsForm({
      priceXOF: detail.exceptions.priceXOF === null ? '' : String(detail.exceptions.priceXOF),
      billingPeriod: detail.exceptions.billingPeriod || '',
      limits,
      features,
      notes: detail.exceptions.notes,
      reason: '',
    });
    setExceptionsOpen(true);
  };

  const saveExceptions = async () => {
    if (!detail || !exceptionsForm) return;
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/subscriptions/${detail.subscription.id}/exceptions`, {
        method: 'PUT',
        body: JSON.stringify({
          priceXOF: exceptionsForm.priceXOF === '' ? null : Number(exceptionsForm.priceXOF),
          billingPeriod: exceptionsForm.billingPeriod || null,
          limits: Object.fromEntries(Object.entries(exceptionsForm.limits).map(([code, value]) => [code, value === '' ? null : /^\d+$/.test(value) ? Number(value) : value])),
          features: Object.fromEntries(Object.entries(exceptionsForm.features).map(([code, value]) => [code, value === 'inherit' ? null : value === 'true'])),
          notes: exceptionsForm.notes,
          reason: exceptionsForm.reason || 'Exceções comerciais negociadas',
        }),
      });
      setExceptionsOpen(false);
      setNotice('Exceções comerciais guardadas. A fotografia contratual e o histórico foram preservados.');
      await openDetail(detail.subscription.id);
      await load();
    } catch (exceptionError) {
      setError((exceptionError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openRenew = () => {
    if (!detail) return;
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setRenewForm({
      endsAt: nextYear.toISOString().slice(0, 10),
      billingPeriod: detail.subscription.billingPeriod || 'monthly',
      contractedPriceXOF: String(detail.subscription.priceXOF || ''),
      paymentTransactionId: detail.subscription.paymentTransactionId || '',
      provider: detail.subscription.provider || '',
      paymentType: detail.subscription.paymentType || '',
      reason: '',
    });
    setRenewOpen(true);
  };

  const renew = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/subscriptions/${detail.subscription.id}/renew`, {
        method: 'POST',
        body: JSON.stringify({ ...renewForm, contractedPriceXOF: Number(renewForm.contractedPriceXOF) || 0 }),
      });
      setRenewOpen(false);
      setNotice('Renovação registada. A nova fotografia contratual foi guardada.');
      await openDetail(detail.subscription.id);
      await load();
    } catch (renewError) {
      setError((renewError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async () => {
    if (!detail || !statusForm) return;
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/subscriptions/${detail.subscription.id}`, {
        method: 'PATCH',
        body: JSON.stringify(statusForm),
      });
      setStatusForm(null);
      setNotice('Estado contratual atualizado e auditado.');
      await openDetail(detail.subscription.id);
      await load();
    } catch (statusError) {
      setError((statusError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const columns: Array<ManagementColumn<CommercialSubscription>> = [
    { key: 'company', label: 'Empresa / referência', sortable: true, render: (item) => <div><div className="font-black text-slate-900">{item.companyName}</div><div className="text-[9px] text-slate-500">{item.id} · {item.companyId}</div></div> },
    { key: 'plan', label: 'Plano', sortable: true, render: (item) => <div><div className="font-bold">{item.planName}</div><div className="text-[9px] text-slate-500">{item.categoryGroupName || 'Sem grupo'} · v{item.planVersion}</div></div> },
    { key: 'price', label: 'Preço efetivo', sortable: true, render: (item) => <div><div className="font-black">{formatCommercialXOF(item.priceXOF)}</div><div className="text-[9px] text-slate-500">{item.priceSource === 'contracted' ? 'Contratado' : 'Referência da matriz'} · {item.billingPeriod}</div></div> },
    { key: 'period', label: 'Período', sortable: true, render: (item) => <div><div>{formatCommercialDate(item.startsAt)} → {formatCommercialDate(item.endsAt)}</div><div className="text-[9px] text-slate-500">Catálogo v{item.catalogVersion}</div></div> },
    { key: 'status', label: 'Estado', render: (item) => <CommercialStatusBadge status={item.status} /> },
    { key: 'payment', label: 'Pagamento', render: (item) => <div className="text-[9.5px]"><div>{item.provider || 'Sem operadora'}</div><div className="text-slate-500">{item.paymentType || item.paymentTransactionId || 'Sem referência'}</div></div> },
    { key: 'actions', label: 'Ações', render: (item) => <div className="flex justify-end"><ManagementActionButton onClick={() => void openDetail(item.id)}><Eye className="h-3 w-3" /> Detalhes</ManagementActionButton></div> },
  ];

  return (
    <CommercialPageShell
      title="Assinaturas"
      description="Contratos das empresas com plano, preço, categoria, limites, versão e período. Os detalhes mostram pagamentos e histórico sem reescrever a fotografia contratada."
      onBack={onBack}
      breadcrumb="Assinaturas"
      kpis={kpis}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      {notice && <CommercialMessage tone="success">{notice}</CommercialMessage>}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'active', 'pending', 'expired', 'suspended', 'cancelled'] as const).map((value) => (
          <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-xl border px-3 py-1.5 text-[10px] font-black ${status === value ? 'border-[var(--color-green-700)] bg-[var(--color-green-800)] text-white' : 'border-[var(--color-border-default)] bg-white text-slate-600'}`}>
            {value === 'all' ? 'Todas' : commercialStatusLabel[value]} ({counts[value] ?? 0})
          </button>
        ))}
      </div>
      <ManagementToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Pesquisar empresa, identificação ou referência…"
        totalLabel={`${items.length} assinatura(s) com os filtros atuais`}
        onReset={() => { setStatus('all'); setQuery(''); setPlanId(''); setGroupId(''); setProvider(''); setPaymentType(''); setFrom(''); setTo(''); }}
      >
        <ManagementFilter label="Plano" value={planId} onChange={setPlanId} options={[{ value: '', label: 'Todos' }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]} />
        <ManagementFilter label="Categoria" value={groupId} onChange={setGroupId} options={[{ value: '', label: 'Todas' }, ...groups.map((group) => ({ value: group.id, label: group.name }))]} />
        <ManagementFilter label="Operadora" value={provider} onChange={setProvider} options={[{ value: '', label: 'Todas' }, { value: 'orange_money', label: 'Orange Money' }, { value: 'telecel', label: 'Telecel' }, { value: 'manual_transfer', label: 'Transferência manual' }]} />
        <ManagementFilter label="Pagamento" value={paymentType} onChange={setPaymentType} options={[{ value: '', label: 'Todos' }, { value: 'initial', label: 'Adesão' }, { value: 'renewal', label: 'Renovação' }, { value: 'upgrade', label: 'Upgrade' }, { value: 'manual', label: 'Manual' }]} />
        <label className="flex min-w-[140px] flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Início desde</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold" /></label>
        <label className="flex min-w-[140px] flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Início até</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold" /></label>
      </ManagementToolbar>
      {loading ? <CommercialLoading label="A carregar assinaturas…" /> : (
        <>
          <ManagementTable columns={columns} rows={pageItems} rowKey={(item) => item.id} />
          <ManagementPagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <CommercialModal open={Boolean(detail)} title={`Assinatura — ${detail?.subscription.companyName || ''}`} description={detail?.subscription.id} onClose={() => setDetail(null)} wide
        footer={detail ? <><ManagementActionButton onClick={() => setDetail(null)}>Fechar</ManagementActionButton><ManagementActionButton tone="warning" onClick={() => setStatusForm({ status: 'suspended', notes: detail.subscription.notes || '', reason: '' })}><Ban className="h-3 w-3" /> Suspender</ManagementActionButton><ManagementActionButton onClick={() => setStatusForm({ status: 'active', notes: detail.subscription.notes || '', reason: '' })}><RotateCcw className="h-3 w-3" /> Reativar</ManagementActionButton><ManagementActionButton onClick={openPlanChange}><ArrowUpDown className="h-3 w-3" /> Mudar plano</ManagementActionButton><ManagementActionButton onClick={openExceptions}><SlidersHorizontal className="h-3 w-3" /> Exceções</ManagementActionButton><ManagementActionButton tone="primary" onClick={openRenew}><CalendarClock className="h-3 w-3" /> Registar renovação</ManagementActionButton></> : undefined}
      >
        {detail && (
          <div className="space-y-4 text-[10.5px]">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 p-2.5"><span className="block text-[9px] font-black uppercase text-slate-500">Plano</span>{detail.subscription.planName} · v{detail.subscription.planVersion}</div>
              <div className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 p-2.5"><span className="block text-[9px] font-black uppercase text-slate-500">Preço / período</span>{formatCommercialXOF(detail.subscription.priceXOF)} · {detail.subscription.billingPeriod}</div>
              <div className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 p-2.5"><span className="block text-[9px] font-black uppercase text-slate-500">Estado</span><CommercialStatusBadge status={detail.subscription.status} /></div>
            </div>
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong>Fotografia contratada</strong><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black">catálogo v{detail.snapshot.catalogVersion} · plano v{detail.snapshot.planVersion}</span></div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                {Object.entries(detail.snapshot.limitsSnapshot || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-white p-2"><span className="block font-black text-slate-500">{key}</span>{value === null ? 'Ilimitado/negociado' : String(value)}</div>)}
              </div>
              <p className="mt-2 text-[9.5px] text-slate-600">Esta fotografia não muda quando o catálogo é alterado. Só uma renovação ou mudança de plano confirmada aplica a configuração comercial atual.</p>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[11px] font-black text-slate-900"><Gauge className="mr-1 inline h-3.5 w-3.5" /> Entitlements e utilização do período</h4>
                {entitlements && <span className="text-[9px] font-bold text-slate-500">período {entitlements.period.key} · uso medido {entitlements.period.startsAt.slice(0, 10)} → {(entitlements.period.endsAt || 'hoje').slice(0, 10)}</span>}
              </div>
              {entitlements ? (
                <>
                  <div className="mt-1 overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
                    <table className="w-full min-w-[520px] text-left text-[10px]">
                      <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="p-1.5">Funcionalidade</th><th className="p-1.5">Limite</th><th className="p-1.5">Uso</th><th className="p-1.5">Restante</th><th className="p-1.5">Origem</th></tr></thead>
                      <tbody>
                        {entitlements.entitlements.filter((row) => row.enabled || row.used > 0).map((row) => (
                          <tr key={row.code} className="border-t border-[var(--color-border-subtle)]">
                            <td className="p-1.5"><div className="font-bold text-slate-900">{row.name}</div><div className="text-[9px] text-slate-500">{row.code}{row.unit ? ` · ${row.unit}` : ''}</div></td>
                            <td className="p-1.5 font-mono">{row.enabled ? limitText(row.limit) : 'Não incluído'}</td>
                            <td className="p-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono">{row.used}</span>
                                {row.percent !== null && <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-black ${row.percent >= 100 ? 'bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]' : row.percent >= 90 ? 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]' : 'bg-slate-100 text-slate-600'}`}>{row.percent}%</span>}
                              </div>
                            </td>
                            <td className="p-1.5 font-mono">{limitText(row.remaining)}</td>
                            <td className="p-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-black ${row.source === 'exception' ? 'bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]' : 'bg-slate-100 text-slate-600'}`}>{row.source === 'exception' ? 'Exceção' : 'Contrato'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[9.5px] text-slate-600">
                    <span className="rounded-full bg-white px-2 py-0.5 font-bold">Extras de publicações: {entitlements.extras.posts.available} disponíveis ({entitlements.extras.posts.used} usados)</span>
                    <span className="rounded-full bg-white px-2 py-0.5 font-bold">Extras de promoções: {entitlements.extras.promotions.available} disponíveis ({entitlements.extras.promotions.used} usados)</span>
                  </div>
                  {entitlements.exceptions.priceXOF !== null || entitlements.exceptions.billingPeriod || Object.keys(entitlements.exceptions.limits).length > 0 || Object.keys(entitlements.exceptions.features).length > 0 ? (
                    <p className="mt-2 rounded-lg border border-[var(--tone-info-border)] bg-[var(--tone-info-bg)]/60 p-2 text-[9.5px] text-slate-700">
                      <strong>Exceções ativas:</strong>{' '}
                      {entitlements.exceptions.priceXOF !== null && `preço ${formatCommercialXOF(entitlements.exceptions.priceXOF)} · `}
                      {entitlements.exceptions.billingPeriod && `periodicidade ${entitlements.exceptions.billingPeriod} · `}
                      {Object.entries(entitlements.exceptions.limits).map(([code, value]) => `${code}: ${limitText(value)}`).join(' · ')}
                      {Object.keys(entitlements.exceptions.limits).length > 0 && Object.keys(entitlements.exceptions.features).length > 0 ? ' · ' : ''}
                      {Object.entries(entitlements.exceptions.features).map(([code, value]) => `${code}: ${value ? 'ativa' : 'inativa'}`).join(' · ')}
                    </p>
                  ) : null}
                  {entitlements.alerts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {entitlements.alerts.slice(0, 4).map((alert) => (
                        <div key={alert.code} className={`rounded-lg px-2 py-1 text-[9.5px] font-bold ${alert.severity === 'critical' ? 'bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]' : alert.severity === 'warning' ? 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]' : 'bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]'}`}>{alert.message}</div>
                      ))}
                    </div>
                  )}
                </>
              ) : <p className="mt-2 text-[10px] text-slate-500">A carregar utilização…</p>}
            </div>
            <div>
              <h4 className="text-[11px] font-black text-slate-900">Pagamentos de subscrição</h4>
              <div className="mt-1 divide-y divide-[var(--color-border-subtle)] rounded-xl border border-[var(--color-border-default)]">
                {detail.payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 p-2"><div><strong>{payment.useCase}</strong><div className="text-[9px] text-slate-500">{payment.id} · {payment.provider || '—'} · {payment.status}</div></div><div className="text-right font-bold">{formatCommercialXOF(payment.amountXOF)}<div className="text-[9px] font-normal text-slate-500">{formatCommercialDate(payment.createdAt, true)}</div></div></div>)}
                {detail.payments.length === 0 && <p className="p-3 text-slate-500">Sem pagamentos de subscrição registados para esta empresa.</p>}
              </div>
            </div>
            <div>
              <h4 className="text-[11px] font-black text-slate-900">Histórico auditado</h4>
              <div className="mt-1 divide-y divide-[var(--color-border-subtle)] rounded-xl border border-[var(--color-border-default)]">
                {detail.history.map((entry) => <div key={entry.id} className="p-2"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{entry.action}</strong><span className="text-[9px] text-slate-500">{entry.actorName} · {formatCommercialDate(entry.createdAt, true)}</span></div>{entry.reason && <div className="text-[9.5px] text-slate-500">{entry.reason}</div>}</div>)}
                {detail.history.length === 0 && <p className="p-3 text-slate-500">Sem alterações auditadas.</p>}
              </div>
            </div>
          </div>
        )}
      </CommercialModal>

      <CommercialModal open={renewOpen} title="Registar renovação" description="A renovação aplica a configuração atual do plano e substitui a fotografia contratual. Confirme apenas após pagamento ou decisão administrativa válida." onClose={() => setRenewOpen(false)}
        footer={<><ManagementActionButton onClick={() => setRenewOpen(false)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => void renew()}>{busy ? 'A guardar…' : 'Confirmar renovação'}</ManagementActionButton></>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CommercialField label="Nova data de fim"><input type="date" className={commercialInputClass} value={renewForm.endsAt} onChange={(event) => setRenewForm({ ...renewForm, endsAt: event.target.value })} required /></CommercialField>
          <CommercialField label="Periodicidade"><select className={commercialInputClass} value={renewForm.billingPeriod} onChange={(event) => setRenewForm({ ...renewForm, billingPeriod: event.target.value })}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></CommercialField>
          <CommercialField label="Preço contratado (XOF)"><input type="number" min={0} className={commercialInputClass} value={renewForm.contractedPriceXOF} onChange={(event) => setRenewForm({ ...renewForm, contractedPriceXOF: event.target.value })} /></CommercialField>
          <CommercialField label="Transação de pagamento"><input className={commercialInputClass} value={renewForm.paymentTransactionId} onChange={(event) => setRenewForm({ ...renewForm, paymentTransactionId: event.target.value })} placeholder="Opcional; referência existente" /></CommercialField>
          <CommercialField label="Operadora"><select className={commercialInputClass} value={renewForm.provider} onChange={(event) => setRenewForm({ ...renewForm, provider: event.target.value })}><option value="">Não indicada</option><option value="orange_money">Orange Money</option><option value="telecel">Telecel</option><option value="manual_transfer">Transferência manual</option></select></CommercialField>
          <CommercialField label="Tipo de pagamento"><select className={commercialInputClass} value={renewForm.paymentType} onChange={(event) => setRenewForm({ ...renewForm, paymentType: event.target.value })}><option value="">Não indicado</option><option value="renewal">Renovação</option><option value="manual">Manual</option><option value="upgrade">Upgrade</option></select></CommercialField>
          <CommercialField label="Motivo" className="sm:col-span-2"><input className={commercialInputClass} value={renewForm.reason} onChange={(event) => setRenewForm({ ...renewForm, reason: event.target.value })} placeholder="Registado na auditoria" /></CommercialField>
        </div>
      </CommercialModal>

      <CommercialModal open={Boolean(statusForm)} title="Alterar estado da assinatura" description="A alteração é auditada e não elimina o histórico contratual." onClose={() => setStatusForm(null)}
        footer={<><ManagementActionButton onClick={() => setStatusForm(null)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => void changeStatus()}>{busy ? 'A guardar…' : 'Guardar estado'}</ManagementActionButton></>}
      >
        {statusForm && <div className="space-y-3">
          <CommercialField label="Novo estado"><select className={commercialInputClass} value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })}><option value="active">Ativa</option><option value="pending">Pendente</option><option value="expired">Expirada</option><option value="suspended">Suspensa</option><option value="cancelled">Cancelada</option></select></CommercialField>
          <CommercialField label="Notas"><textarea className={`${commercialInputClass} min-h-16`} value={statusForm.notes} onChange={(event) => setStatusForm({ ...statusForm, notes: event.target.value })} /></CommercialField>
          <CommercialField label="Motivo" hint="Obrigatório para cancelamento."><input className={commercialInputClass} value={statusForm.reason} onChange={(event) => setStatusForm({ ...statusForm, reason: event.target.value })} /></CommercialField>
        </div>}
      </CommercialModal>

      <CommercialModal open={planChangeOpen} title="Mudar plano" description="A mudança cria uma nova fotografia contratual com o plano, preço e versão atuais. Upgrade e downgrade são determinados pelo preço mensal de referência da matriz da categoria." onClose={() => setPlanChangeOpen(false)}
        footer={<><ManagementActionButton onClick={() => setPlanChangeOpen(false)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy || !planChangeForm.planId} onClick={() => void changePlan()}>{busy ? 'A guardar…' : 'Confirmar mudança'}</ManagementActionButton></>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CommercialField label="Plano de destino" className="sm:col-span-2">
            <select className={commercialInputClass} value={planChangeForm.planId} onChange={(event) => setPlanChangeForm({ ...planChangeForm, planId: event.target.value })}>
              <option value="">Selecionar plano ativo…</option>
              {plans.filter((plan) => plan.isActive && plan.id !== detail?.subscription.planId).map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name} — referência {formatCommercialXOF(plan.priceXOF)} · v{plan.version}</option>
              ))}
            </select>
          </CommercialField>
          <CommercialField label="Periodicidade"><select className={commercialInputClass} value={planChangeForm.billingPeriod} onChange={(event) => setPlanChangeForm({ ...planChangeForm, billingPeriod: event.target.value })}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></CommercialField>
          <CommercialField label="Preço contratado (XOF)" hint="Vazio usa a matriz da categoria ou o valor de referência do plano."><input type="number" min={0} className={commercialInputClass} value={planChangeForm.contractedPriceXOF} onChange={(event) => setPlanChangeForm({ ...planChangeForm, contractedPriceXOF: event.target.value })} placeholder="Automático" /></CommercialField>
          <CommercialField label="Motivo" className="sm:col-span-2"><input className={commercialInputClass} value={planChangeForm.reason} onChange={(event) => setPlanChangeForm({ ...planChangeForm, reason: event.target.value })} placeholder="Registado na auditoria" /></CommercialField>
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-700 sm:col-span-2"><input type="checkbox" checked={planChangeForm.resetExceptions} onChange={(event) => setPlanChangeForm({ ...planChangeForm, resetExceptions: event.target.checked })} className="h-3.5 w-3.5 accent-[#123e3b]" /> Limpar exceções comerciais negociadas para o novo plano</label>
          <p className="sm:col-span-2 rounded-lg bg-slate-50 p-2 text-[9.5px] font-bold text-slate-600">A regra <strong>allow_plan_change</strong> é aplicada no servidor: se estiver desativada, a mudança é recusada e auditada.</p>
        </div>
      </CommercialModal>

      <CommercialModal open={exceptionsOpen} title="Exceções comerciais" description="Ajustes negociados apenas para esta assinatura. Não alteram a fotografia contratual nem o catálogo; são validados no servidor e auditados." onClose={() => setExceptionsOpen(false)} wide
        footer={<><ManagementActionButton onClick={() => setExceptionsOpen(false)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => void saveExceptions()}>{busy ? 'A guardar…' : 'Guardar exceções'}</ManagementActionButton></>}
      >
        {exceptionsForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CommercialField label="Preço excecional (XOF)" hint="Vazio remove a exceção de preço; a fotografia contratual mantém-se."><input type="number" min={0} className={commercialInputClass} value={exceptionsForm.priceXOF} onChange={(event) => setExceptionsForm({ ...exceptionsForm, priceXOF: event.target.value })} placeholder="Herdar contrato" /></CommercialField>
              <CommercialField label="Periodicidade"><select className={commercialInputClass} value={exceptionsForm.billingPeriod} onChange={(event) => setExceptionsForm({ ...exceptionsForm, billingPeriod: event.target.value })}><option value="">Herdar contrato</option><option value="monthly">Mensal</option><option value="annual">Anual</option></select></CommercialField>
            </div>
            {Object.keys(exceptionsForm.limits).length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
                <table className="w-full min-w-[420px] text-left text-[10.5px]">
                  <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="p-2">Limite</th><th className="p-2">Valor negociado</th></tr></thead>
                  <tbody>
                    {Object.keys(exceptionsForm.limits).map((code) => (
                      <tr key={code} className="border-t border-[var(--color-border-subtle)]">
                        <td className="p-2 font-bold text-slate-800">{code}</td>
                        <td className="p-2">
                          <input className={commercialInputClass} aria-label={`Limite negociado de ${code}`} value={exceptionsForm.limits[code]} onChange={(event) => setExceptionsForm({ ...exceptionsForm, limits: { ...exceptionsForm.limits, [code]: event.target.value } })} placeholder="Herdar contrato (ou unlimited / negotiated)" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {Object.keys(exceptionsForm.features).length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
                <table className="w-full min-w-[420px] text-left text-[10.5px]">
                  <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="p-2">Funcionalidade</th><th className="p-2">Estado negociado</th></tr></thead>
                  <tbody>
                    {Object.keys(exceptionsForm.features).map((code) => (
                      <tr key={code} className="border-t border-[var(--color-border-subtle)]">
                        <td className="p-2 font-bold text-slate-800">{code}</td>
                        <td className="p-2">
                          <select className={commercialInputClass} aria-label={`Estado negociado de ${code}`} value={exceptionsForm.features[code]} onChange={(event) => setExceptionsForm({ ...exceptionsForm, features: { ...exceptionsForm.features, [code]: event.target.value } })}><option value="inherit">Herdar contrato</option><option value="true">Ativa</option><option value="false">Inativa</option></select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <CommercialField label="Notas da negociação"><textarea className={`${commercialInputClass} min-h-16`} value={exceptionsForm.notes} onChange={(event) => setExceptionsForm({ ...exceptionsForm, notes: event.target.value })} /></CommercialField>
            <CommercialField label="Motivo" hint="Obrigatório para auditoria."><input className={commercialInputClass} value={exceptionsForm.reason} onChange={(event) => setExceptionsForm({ ...exceptionsForm, reason: event.target.value })} /></CommercialField>
          </div>
        )}
      </CommercialModal>

      <p className="text-[9.5px] text-slate-500"><ShieldCheck className="mr-1 inline h-3 w-3" /> A receita de subscrições só conta pagamentos reais confirmados; sandbox e simulações são excluídos.</p>
    </CommercialPageShell>
  );
};
