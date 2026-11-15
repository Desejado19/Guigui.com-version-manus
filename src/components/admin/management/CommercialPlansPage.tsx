import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Edit2, History, Layers3, Plus, Power, Users } from 'lucide-react';
import {
  ManagementActionButton,
  ManagementFilter,
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
  commercialInputClass,
} from './CommercialShared';
import {
  commercialRequest,
  formatCommercialDate,
  formatCommercialXOF,
  type CommercialFeature,
  type CommercialOverview,
  type CommercialPlanWithConfig,
  type CommercialSubscription,
  type PlanFeatureConfig,
} from './commercialApi';

type PlanDraft = {
  id?: string;
  name: string;
  code: string;
  description: string;
  priceXOF: number;
  annualPriceXOF: number | '';
  billingPeriod: string;
  isActive: boolean;
  isPublic: boolean;
  annualContract: boolean;
  badge: string;
  benefitsText: string;
};

const emptyDraft = (): PlanDraft => ({
  name: '',
  code: '',
  description: '',
  priceXOF: 0,
  annualPriceXOF: '',
  billingPeriod: 'monthly',
  isActive: true,
  isPublic: true,
  annualContract: false,
  badge: '',
  benefitsText: '',
});

const draftFromPlan = (plan: CommercialPlanWithConfig): PlanDraft => ({
  id: plan.id,
  name: plan.name,
  code: plan.code,
  description: plan.description,
  priceXOF: plan.priceXOF,
  annualPriceXOF: plan.annualPriceXOF ?? '',
  billingPeriod: plan.billingPeriod,
  isActive: plan.isActive,
  isPublic: plan.isPublic,
  annualContract: plan.annualContract,
  badge: plan.badge || '',
  benefitsText: plan.benefits.join('\n'),
});

export const CommercialPlansPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [reason, setReason] = useState('');
  const [configPlan, setConfigPlan] = useState<CommercialPlanWithConfig | null>(null);
  const [configs, setConfigs] = useState<Record<string, PlanFeatureConfig>>({});
  const [historyPlan, setHistoryPlan] = useState<CommercialPlanWithConfig | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; version: number; changedBy: string; reason: string; catalogVersion: number; createdAt: string | null }>>([]);
  const [subscribersPlan, setSubscribersPlan] = useState<CommercialPlanWithConfig | null>(null);
  const [subscribers, setSubscribers] = useState<CommercialSubscription[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await commercialRequest<CommercialOverview>('/api/admin/commercial/overview');
      setOverview(data);
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const plans = overview?.plans_with_config || [];
  const features = overview?.features || [];
  const filtered = useMemo(() => plans.filter((plan) => {
    if (statusFilter === 'active' && !plan.isActive) return false;
    if (statusFilter === 'inactive' && plan.isActive) return false;
    if (!query) return true;
    return `${plan.name} ${plan.code} ${plan.description}`.toLowerCase().includes(query.toLowerCase());
  }), [plans, query, statusFilter]);

  const totalSubscribers = plans.reduce((sum, plan) => sum + plan.subscribers, 0);
  const kpis: ManagementKpi[] = [
    { label: 'Planos no catálogo', value: plans.length, hint: `${plans.filter((plan) => plan.isActive).length} ativos`, tone: 'info' },
    { label: 'Planos públicos', value: plans.filter((plan) => plan.isPublic).length, hint: 'Visíveis para novas adesões', tone: 'success' },
    { label: 'Assinantes associados', value: totalSubscribers, hint: 'Todas as empresas', tone: 'neutral' },
    { label: 'Versão do catálogo', value: `v${overview?.summary?.catalogVersion ?? '—'}`, hint: 'Cada alteração cria versão', tone: 'warning' },
  ];

  const featureLabel = (featureId: string) => features.find((feature) => feature.id === featureId)?.name || featureId;
  const configValue = (plan: CommercialPlanWithConfig, code: string) => plan.configs.find((config) => {
    const feature = features.find((item) => item.id === config.featureId);
    return feature?.code === code;
  });

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      const body = {
        name: draft.name,
        code: draft.code,
        description: draft.description,
        priceXOF: draft.priceXOF,
        annualPriceXOF: draft.annualPriceXOF === '' ? null : draft.annualPriceXOF,
        billingPeriod: draft.billingPeriod,
        isActive: draft.isActive,
        isPublic: draft.isPublic,
        annualContract: draft.annualContract,
        badge: draft.badge || null,
        benefits: draft.benefitsText.split('\n').map((item) => item.trim()).filter(Boolean),
        reason: reason || (draft.id ? 'Edição do plano no painel comercial' : 'Criação de plano no painel comercial'),
      };
      if (draft.id) {
        await commercialRequest(`/api/admin/commercial/plans/${draft.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await commercialRequest('/api/admin/commercial/plans', { method: 'POST', body: JSON.stringify(body) });
      }
      setDraft(null);
      setReason('');
      setNotice(draft.id ? 'Plano atualizado e nova versão criada.' : 'Plano criado com uma versão inicial.');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (plan: CommercialPlanWithConfig) => {
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/plans/${plan.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Duplicação de ${plan.name}` }),
      });
      setNotice(`${plan.name} duplicado como plano inativo.`);
      await load();
    } catch (duplicateError) {
      setError((duplicateError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (plan: CommercialPlanWithConfig) => {
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/plans/${plan.id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ active: !plan.isActive, reason: plan.isActive ? 'Desativação no catálogo' : 'Reativação no catálogo' }),
      });
      setNotice(plan.isActive ? `${plan.name} desativado. Assinaturas existentes foram preservadas.` : `${plan.name} reativado.`);
      await load();
    } catch (toggleError) {
      setError((toggleError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openConfiguration = async (plan: CommercialPlanWithConfig) => {
    setConfigPlan(plan);
    setConfigs(Object.fromEntries(plan.configs.map((config) => [config.featureId, { ...config }])));
    setReason('');
    setError('');
  };

  const saveConfiguration = async () => {
    if (!configPlan) return;
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/plans/${configPlan.id}/configuration`, {
        method: 'PUT',
        body: JSON.stringify({
          features: Object.values(configs),
          reason: reason || 'Configuração de funcionalidades e limites',
        }),
      });
      setConfigPlan(null);
      setNotice('Funcionalidades e limites guardados numa nova versão do plano.');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (plan: CommercialPlanWithConfig) => {
    setHistoryPlan(plan);
    setHistory([]);
    try {
      const data = await commercialRequest<{ versions: typeof history }>(`/api/admin/commercial/plans/${plan.id}/config`);
      setHistory(data.versions);
    } catch (historyError) {
      setError((historyError as Error).message);
    }
  };

  const openSubscribers = async (plan: CommercialPlanWithConfig) => {
    setSubscribersPlan(plan);
    setSubscribers([]);
    try {
      const data = await commercialRequest<{ items: CommercialSubscription[] }>(`/api/admin/commercial/subscriptions?planId=${encodeURIComponent(plan.id)}`);
      setSubscribers(data.items);
    } catch (subscriberError) {
      setError((subscriberError as Error).message);
    }
  };

  const updateConfig = (featureId: string, patch: Partial<PlanFeatureConfig>) => {
    setConfigs((current) => ({
      ...current,
      [featureId]: { ...(current[featureId] || { featureId, enabled: false, limitKind: 'flag', numericValue: null, textValue: null }), ...patch },
    }));
  };

  const columns: Array<ManagementColumn<CommercialPlanWithConfig>> = [
    { key: 'plan', label: 'Plano', sortable: true, render: (plan) => <div><div className="font-black text-slate-900">{plan.name}</div><div className="text-[9.5px] text-slate-500">{plan.code} · v{plan.version}</div></div> },
    { key: 'price', label: 'Preço de referência', sortable: true, render: (plan) => <div><div className="font-bold">{plan.priceXOF > 0 ? formatCommercialXOF(plan.priceXOF) : 'Negociado'}</div><div className="text-[9px] text-slate-500">Anual: {plan.annualPriceXOF ? formatCommercialXOF(plan.annualPriceXOF) : 'personalizado'}</div></div> },
    { key: 'posts', label: 'Publicações', render: (plan) => { const config = configValue(plan, 'posts'); return <span className="font-bold">{config?.limitKind === 'unlimited' ? 'Ilimitado' : config?.limitKind === 'negotiated' ? 'Negociado' : `${config?.numericValue ?? 0}/mês`}</span>; } },
    { key: 'subscribers', label: 'Assinantes', sortable: true, render: (plan) => <button type="button" onClick={() => void openSubscribers(plan)} className="font-black text-[#123e3b] underline decoration-dotted">{plan.subscribers}</button> },
    { key: 'status', label: 'Estado', render: (plan) => <div className="flex flex-wrap gap-1"><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${plan.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{plan.isActive ? 'Ativo' : 'Inativo'}</span>{plan.isPublic && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-black text-sky-700">Público</span>}</div> },
    {
      key: 'actions',
      label: 'Ações',
      render: (plan) => (
        <div className="flex flex-wrap justify-end gap-1">
          <ManagementActionButton onClick={() => { setDraft(draftFromPlan(plan)); setReason(''); }}><Edit2 className="h-3 w-3" /> Editar</ManagementActionButton>
          <ManagementActionButton onClick={() => void duplicate(plan)} disabled={busy}><Copy className="h-3 w-3" /> Duplicar</ManagementActionButton>
          <ManagementActionButton onClick={() => void openConfiguration(plan)}><SlidersIcon /> Configurar</ManagementActionButton>
          <ManagementActionButton onClick={() => void openHistory(plan)}><History className="h-3 w-3" /> Versões</ManagementActionButton>
          <ManagementActionButton tone={plan.isActive ? 'warning' : 'success'} onClick={() => void toggle(plan)} disabled={busy}><Power className="h-3 w-3" /> {plan.isActive ? 'Desativar' : 'Ativar'}</ManagementActionButton>
        </div>
      ),
    },
  ];

  return (
    <CommercialPageShell
      title="Catálogo de Planos"
      description="Crie, edite, duplique e versione os planos comerciais. Desativar um plano não elimina assinaturas nem o histórico contratual."
      onBack={onBack}
      breadcrumb="Planos"
      kpis={kpis}
      actions={<ManagementActionButton tone="primary" onClick={() => { setDraft(emptyDraft()); setReason(''); }}><Plus className="h-3.5 w-3.5" /> Novo plano</ManagementActionButton>}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      {notice && <CommercialMessage tone="success">{notice}</CommercialMessage>}
      {loading ? <CommercialLoading /> : (
        <>
          <ManagementToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Pesquisar plano, código ou descrição…"
            totalLabel={`${filtered.length} plano(s) apresentados de ${plans.length}`}
            onReset={() => { setQuery(''); setStatusFilter('all'); }}
          >
            <ManagementFilter label="Estado" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'active', label: 'Ativos' }, { value: 'inactive', label: 'Inativos' }]} />
          </ManagementToolbar>
          <ManagementTable columns={columns} rows={filtered} rowKey={(plan) => plan.id} emptyMessage="Nenhum plano corresponde aos filtros." />
          <p className="text-[10px] leading-relaxed text-slate-500"><Layers3 className="mr-1 inline h-3 w-3" /> Os preços do catálogo são valores de referência ou fallback. A matriz por categoria prevalece quando existe uma combinação configurada.</p>
        </>
      )}

      <CommercialModal
        open={Boolean(draft)}
        title={draft?.id ? 'Editar plano' : 'Criar plano'}
        description="Guardar cria uma nova versão do plano. As assinaturas existentes mantêm a fotografia contratada."
        onClose={() => setDraft(null)}
        wide
        footer={<><ManagementActionButton onClick={() => setDraft(null)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => document.getElementById('plan-form-submit')?.click()}>{busy ? 'A guardar…' : 'Guardar versão'}</ManagementActionButton></>}
      >
        {draft && (
          <form id="plan-form" onSubmit={(event) => void savePlan(event)} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CommercialField label="Nome"><input className={commercialInputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></CommercialField>
              <CommercialField label="Código único" hint="Usado como identificador estável do plano."><input className={commercialInputClass} value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="ex.: profissional" /></CommercialField>
              <CommercialField label="Preço mensal de referência (XOF)"><input type="number" min={0} className={commercialInputClass} value={draft.priceXOF} onChange={(event) => setDraft({ ...draft, priceXOF: Number(event.target.value) })} /></CommercialField>
              <CommercialField label="Preço anual de referência (XOF)" hint="Deixe vazio para preço negociado ou personalizado."><input type="number" min={0} className={commercialInputClass} value={draft.annualPriceXOF} onChange={(event) => setDraft({ ...draft, annualPriceXOF: event.target.value === '' ? '' : Number(event.target.value) })} /></CommercialField>
              <CommercialField label="Periodicidade"><select className={commercialInputClass} value={draft.billingPeriod} onChange={(event) => setDraft({ ...draft, billingPeriod: event.target.value })}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></CommercialField>
              <CommercialField label="Selo"><input className={commercialInputClass} value={draft.badge} onChange={(event) => setDraft({ ...draft, badge: event.target.value })} placeholder="ex.: Premium" /></CommercialField>
              <CommercialField label="Descrição" className="sm:col-span-2"><textarea className={`${commercialInputClass} min-h-16`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></CommercialField>
              <CommercialField label="Benefícios (um por linha)" className="sm:col-span-2"><textarea className={`${commercialInputClass} min-h-24`} value={draft.benefitsText} onChange={(event) => setDraft({ ...draft, benefitsText: event.target.value })} /></CommercialField>
              <CommercialField label="Motivo da alteração" className="sm:col-span-2"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Registado na auditoria" /></CommercialField>
            </div>
            <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-bold text-slate-700">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-3.5 w-3.5 accent-[#123e3b]" /> Ativo</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} className="h-3.5 w-3.5 accent-[#123e3b]" /> Público</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.annualContract} onChange={(event) => setDraft({ ...draft, annualContract: event.target.checked })} className="h-3.5 w-3.5 accent-[#123e3b]" /> Contrato anual</label>
            </div>
            <button id="plan-form-submit" type="submit" className="hidden" />
          </form>
        )}
      </CommercialModal>

      <CommercialModal
        open={Boolean(configPlan)}
        title={`Funcionalidades e limites — ${configPlan?.name || ''}`}
        description="Zero é um limite válido. Ilimitado e Negociado não usam valor numérico. A fotografia das assinaturas existentes não é reescrita."
        onClose={() => setConfigPlan(null)}
        wide
        footer={<><ManagementActionButton onClick={() => setConfigPlan(null)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => void saveConfiguration()}>{busy ? 'A guardar…' : 'Guardar configuração'}</ManagementActionButton></>}
      >
        <div className="space-y-3">
          <CommercialField label="Motivo"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Registado na auditoria" /></CommercialField>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-[10.5px]">
              <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="p-2.5">Funcionalidade</th><th className="p-2.5">Ativa</th><th className="p-2.5">Tipo de limite</th><th className="p-2.5">Valor</th></tr></thead>
              <tbody>
                {features.filter((feature) => feature.isActive).map((feature) => {
                  const config = configs[feature.id] || { featureId: feature.id, enabled: false, limitKind: 'flag', numericValue: null, textValue: null };
                  return (
                    <tr key={feature.id} className="border-t border-slate-100">
                      <td className="p-2.5"><div className="font-black text-slate-900">{feature.name}</div><div className="text-[9px] text-slate-500">{feature.description}{feature.unit ? ` · ${feature.unit}` : ''}</div></td>
                      <td className="p-2.5"><input type="checkbox" aria-label={`Ativar ${feature.name}`} checked={config.enabled} onChange={(event) => updateConfig(feature.id, { enabled: event.target.checked })} className="h-4 w-4 accent-[#123e3b]" /></td>
                      <td className="p-2.5">
                        <select className={commercialInputClass} value={config.limitKind} onChange={(event) => updateConfig(feature.id, { limitKind: event.target.value, numericValue: event.target.value === 'number' ? (config.numericValue || 0) : null })}>
                          {feature.valueType === 'quota' && <option value="number">Quantidade</option>}
                          {feature.valueType === 'quota' && <option value="unlimited">Ilimitado</option>}
                          {feature.valueType === 'quota' && <option value="negotiated">Negociado</option>}
                          {feature.valueType === 'number' && <option value="number">Número</option>}
                          {feature.valueType === 'text' && <option value="text">Texto</option>}
                          {feature.valueType === 'flag' && <option value="flag">Ativa / inativa</option>}
                        </select>
                      </td>
                      <td className="p-2.5">
                        {config.limitKind === 'number' ? <input type="number" min={0} aria-label={`Limite de ${feature.name}`} className={commercialInputClass} value={config.numericValue ?? 0} onChange={(event) => updateConfig(feature.id, { numericValue: Math.max(0, Number(event.target.value) || 0) })} /> : null}
                        {config.limitKind === 'text' ? <input className={commercialInputClass} aria-label={`Valor de ${feature.name}`} value={config.textValue || ''} onChange={(event) => updateConfig(feature.id, { textValue: event.target.value })} placeholder={feature.code === 'profile_type' ? 'standard / expanded' : 'none / monthly / advanced'} /> : null}
                        {config.limitKind === 'unlimited' || config.limitKind === 'negotiated' || config.limitKind === 'flag' ? <span className="text-[10px] font-bold text-slate-500">Sem valor numérico</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {Object.values(configs).some((config) => config.enabled && config.limitKind === 'number' && config.featureId === features.find((feature) => feature.code === 'posts')?.id && config.numericValue !== (overview?.rules?.monthlyPostRule ?? 3)) && (
            <CommercialMessage tone="error">A quota de publicações difere da regra transversal configurada ({overview?.rules?.monthlyPostRule ?? 3}). Confirme conscientemente antes de guardar.</CommercialMessage>
          )}
        </div>
      </CommercialModal>

      <CommercialModal open={Boolean(historyPlan)} title={`Versões — ${historyPlan?.name || ''}`} onClose={() => setHistoryPlan(null)} wide>
        <div className="divide-y divide-slate-100">
          {history.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[10.5px]"><div><strong>v{version.version}</strong> · {version.reason || 'Alteração do plano'}<div className="text-[9px] text-slate-500">{version.changedBy} · {formatCommercialDate(version.createdAt, true)}</div></div><span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">catálogo v{version.catalogVersion}</span></div>)}
          {history.length === 0 && <p className="py-6 text-center text-[10.5px] text-slate-500">Sem versões registadas.</p>}
        </div>
      </CommercialModal>

      <CommercialModal open={Boolean(subscribersPlan)} title={`Assinantes — ${subscribersPlan?.name || ''}`} onClose={() => setSubscribersPlan(null)} wide>
        <div className="divide-y divide-slate-100">
          {subscribers.map((subscription) => <div key={subscription.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[10.5px]"><div><strong>{subscription.companyName}</strong><div className="text-[9px] text-slate-500">{subscription.id} · {subscription.status} · {formatCommercialDate(subscription.endsAt)}</div></div><span className="font-bold">{formatCommercialXOF(subscription.priceXOF)}</span></div>)}
          {subscribers.length === 0 && <p className="py-6 text-center text-[10.5px] text-slate-500">Este plano ainda não tem assinantes.</p>}
        </div>
      </CommercialModal>
    </CommercialPageShell>
  );
};

const SlidersIcon = () => <Layers3 className="h-3 w-3" />;
