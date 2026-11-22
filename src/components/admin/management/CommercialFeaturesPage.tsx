import React, { useEffect, useMemo, useState } from 'react';
import { foldForSearch, matchesSearch } from '../../../../shared/textNormalization';
import { Edit2, Plus, SlidersHorizontal } from 'lucide-react';
import {
  ManagementActionButton,
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
  CommercialSaveButton,
  commercialInputClass,
} from './CommercialShared';
import {
  commercialRequest,
  type CommercialFeature,
  type CommercialOverview,
  type CommercialPlanWithConfig,
  type PlanFeatureConfig,
} from './commercialApi';

const emptyFeature = { name: '', code: '', description: '', category: 'custom', valueType: 'flag', unit: '' };

export const CommercialFeaturesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [featureDraft, setFeatureDraft] = useState<typeof emptyFeature | null>(null);
  const [editingFeature, setEditingFeature] = useState<CommercialFeature | null>(null);
  const [reason, setReason] = useState('');
  const [planId, setPlanId] = useState('');
  const [configs, setConfigs] = useState<Record<string, PlanFeatureConfig>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await commercialRequest<CommercialOverview>('/api/admin/commercial/overview');
      setOverview(data);
      setPlanId((current) => current || data.plans[0]?.id || '');
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const plan = overview?.plans_with_config.find((item) => item.id === planId);
  useEffect(() => {
    if (!plan) return;
    setConfigs(Object.fromEntries(plan.configs.map((config) => [config.featureId, { ...config }])));
  }, [planId, overview]);

  const features = overview?.features || [];
  const plans = overview?.plans_with_config || [];
  const filtered = useMemo(() => features.filter((feature) => !query || matchesSearch(`${feature.name} ${feature.code} ${feature.description} ${feature.category}`, foldForSearch(query))), [features, query]);
  const featureConfig = (featureId: string) => configs[featureId] || { featureId, enabled: false, limitKind: 'flag', numericValue: null, textValue: null };
  const postsFeature = features.find((feature) => feature.code === 'posts');
  const postsInconsistent = plans.some((item) => {
    const config = item.configs.find((entry) => entry.featureId === postsFeature?.id);
    return config?.limitKind === 'number' && config.numericValue !== overview?.rules?.monthlyPostRule;
  });

  const kpis: ManagementKpi[] = [
    { label: 'Funcionalidades', value: features.length, hint: `${features.filter((feature) => feature.isActive).length} ativas`, tone: 'info' },
    { label: 'Quotas configuráveis', value: features.filter((feature) => feature.valueType === 'quota').length, hint: 'Zero é um limite válido', tone: 'neutral' },
    { label: 'Publicações mensais', value: overview?.rules?.monthlyPostRule ?? 3, hint: 'Regra transversal única', tone: postsInconsistent ? 'danger' : 'success' },
    { label: 'Planos configurados', value: plans.length, hint: 'Configuração individual por plano', tone: 'warning' },
  ];

  const saveFeature = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!featureDraft) return;
    setBusy(true);
    try {
      if (editingFeature) {
        await commercialRequest(`/api/admin/commercial/features/${editingFeature.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: featureDraft.name, description: featureDraft.description, isActive: true, reason: reason || 'Edição de funcionalidade' }),
        });
      } else {
        await commercialRequest('/api/admin/commercial/features', {
          method: 'POST',
          body: JSON.stringify({ ...featureDraft, reason: reason || 'Criação de funcionalidade' }),
        });
      }
      setFeatureDraft(null);
      setEditingFeature(null);
      setReason('');
      setNotice(editingFeature ? 'Funcionalidade atualizada.' : 'Funcionalidade criada e adicionada a todos os planos.');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleFeature = async (feature: CommercialFeature) => {
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/features/${feature.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !feature.isActive, name: feature.name, description: feature.description, reason: feature.isActive ? 'Desativação de funcionalidade' : 'Reativação de funcionalidade' }),
      });
      setNotice(feature.isActive ? `${feature.name} desativada; os contratos existentes mantêm a fotografia.` : `${feature.name} reativada.`);
      await load();
    } catch (toggleError) {
      setError((toggleError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateConfig = (featureId: string, patch: Partial<PlanFeatureConfig>) => {
    setConfigs((current) => ({ ...current, [featureId]: { ...(current[featureId] || { featureId, enabled: false, limitKind: 'flag', numericValue: null, textValue: null }), ...patch } }));
  };

  const saveConfigs = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/plans/${plan.id}/configuration`, {
        method: 'PUT',
        body: JSON.stringify({ features: Object.values(configs), reason: reason || `Configuração de funcionalidades do plano ${plan.name}` }),
      });
      setReason('');
      setNotice(`Configuração de ${plan.name} guardada numa nova versão.`);
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const columns: Array<ManagementColumn<CommercialFeature>> = [
    { key: 'feature', label: 'Funcionalidade', sortable: true, render: (feature) => <div><div className="font-black text-slate-900">{feature.name}</div><div className="text-[9px] text-slate-500">{feature.code} · {feature.category}</div></div> },
    { key: 'description', label: 'Descrição / unidade', render: (feature) => <div className="max-w-[300px] text-[10px]">{feature.description || '—'}<div className="text-[9px] text-slate-500">{feature.unit || 'Sem unidade'}</div></div> },
    { key: 'type', label: 'Tipo', render: (feature) => <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">{feature.valueType}</span> },
    { key: 'enabled', label: 'Planos com ativação', render: (feature) => <span className="font-bold">{plans.filter((item) => item.configs.find((config) => config.featureId === feature.id)?.enabled).length} de {plans.length}</span> },
    { key: 'status', label: 'Estado', render: (feature) => <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${feature.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{feature.isActive ? 'Ativa' : 'Inativa'}</span> },
    { key: 'actions', label: 'Ações', render: (feature) => <div className="flex justify-end gap-1"><ManagementActionButton onClick={() => { setEditingFeature(feature); setFeatureDraft({ name: feature.name, code: feature.code, description: feature.description, category: feature.category, valueType: feature.valueType === 'quota' ? 'quota' : feature.valueType, unit: feature.unit || '' }); setReason(''); }}><Edit2 className="h-3 w-3" /> Editar</ManagementActionButton><ManagementActionButton tone={feature.isActive ? 'warning' : 'success'} onClick={() => void toggleFeature(feature)} disabled={busy}>{feature.isActive ? 'Desativar' : 'Ativar'}</ManagementActionButton></div> },
  ];

  return (
    <CommercialPageShell
      title="Funcionalidades e Limites"
      description="Catálogo independente de funcionalidades e configuração por plano. Os limites aceitam zero, quantidade definida, ilimitado ou negociado e ficam guardados por versão."
      onBack={onBack}
      breadcrumb="Funcionalidades e Limites"
      kpis={kpis}
      actions={<ManagementActionButton tone="primary" onClick={() => { setEditingFeature(null); setFeatureDraft({ ...emptyFeature }); setReason(''); }}><Plus className="h-3.5 w-3.5" /> Nova funcionalidade</ManagementActionButton>}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      {notice && <CommercialMessage tone="success">{notice}</CommercialMessage>}
      {postsInconsistent && <CommercialMessage tone="error">Existe uma quota de publicações diferente da regra transversal. Uniformize os planos antes de publicar novas adesões.</CommercialMessage>}
      {loading ? <CommercialLoading /> : (
        <>
          <ManagementToolbar query={query} onQueryChange={setQuery} placeholder="Pesquisar funcionalidade…" totalLabel={`${filtered.length} funcionalidade(s)`} onReset={() => setQuery('')} />
          <ManagementTable columns={columns} rows={filtered} rowKey={(feature) => feature.id} />

          <section className="rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-[13px] font-black text-slate-900">Configuração por plano</h3><p className="text-[10px] text-slate-500">Escolha o plano, defina funcionalidades ativas, limites e valores. Alterações não reescrevem assinaturas existentes.</p></div>
              <select aria-label="Plano a configurar" value={planId} onChange={(event) => setPlanId(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-800">{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            </div>
            {plan && (
              <>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-[10.5px]">
                    <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="p-2.5">Funcionalidade</th><th className="p-2.5">Ativa</th><th className="p-2.5">Limite</th><th className="p-2.5">Valor</th></tr></thead>
                    <tbody>
                      {features.filter((feature) => feature.isActive).map((feature) => {
                        const config = featureConfig(feature.id);
                        return <tr key={feature.id} className="border-t border-slate-100"><td className="p-2.5"><strong>{feature.name}</strong><div className="text-[9px] text-slate-500">{feature.description}</div></td><td className="p-2.5"><input type="checkbox" aria-label={`Ativar ${feature.name} em ${plan.name}`} checked={config.enabled} onChange={(event) => updateConfig(feature.id, { enabled: event.target.checked })} className="h-4 w-4 accent-[#123e3b]" /></td><td className="p-2.5"><select aria-label={`Limite de ${feature.name}`} className={commercialInputClass} value={config.limitKind} onChange={(event) => updateConfig(feature.id, { limitKind: event.target.value, numericValue: event.target.value === 'number' ? (config.numericValue || 0) : null })}>{feature.valueType === 'quota' && <><option value="number">Quantidade</option><option value="unlimited">Ilimitado</option><option value="negotiated">Negociado</option></>}{feature.valueType === 'number' && <option value="number">Número</option>}{feature.valueType === 'text' && <option value="text">Texto</option>}{feature.valueType === 'flag' && <option value="flag">Ativa/inativa</option>}</select></td><td className="p-2.5">{config.limitKind === 'number' && <input type="number" min={0} aria-label={`Valor de ${feature.name}`} className={commercialInputClass} value={config.numericValue ?? 0} onChange={(event) => updateConfig(feature.id, { numericValue: Math.max(0, Number(event.target.value) || 0) })} />}{config.limitKind === 'text' && <input aria-label={`Texto de ${feature.name}`} className={commercialInputClass} value={config.textValue || ''} onChange={(event) => updateConfig(feature.id, { textValue: event.target.value })} />}{['unlimited', 'negotiated', 'flag'].includes(config.limitKind) && <span className="text-[9.5px] font-bold text-slate-500">Sem valor numérico</span>}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <CommercialField label="Motivo" className="min-w-[240px] flex-1"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Registado na auditoria" /></CommercialField>
                  <CommercialSaveButton busy={busy} onClick={() => void saveConfigs()}>Guardar configuração</CommercialSaveButton>
                </div>
              </>
            )}
          </section>
        </>
      )}

      <CommercialModal open={Boolean(featureDraft)} title={editingFeature ? 'Editar funcionalidade' : 'Nova funcionalidade'} onClose={() => { setFeatureDraft(null); setEditingFeature(null); }} footer={<><ManagementActionButton onClick={() => { setFeatureDraft(null); setEditingFeature(null); }}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => document.getElementById('feature-form-submit')?.click()}>{busy ? 'A guardar…' : 'Guardar'}</ManagementActionButton></>}>
        {featureDraft && <form onSubmit={(event) => void saveFeature(event)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CommercialField label="Nome"><input className={commercialInputClass} value={featureDraft.name} onChange={(event) => setFeatureDraft({ ...featureDraft, name: event.target.value })} required /></CommercialField>
          <CommercialField label="Código único" hint={editingFeature ? 'O código não pode ser alterado.' : 'Ex.: monthly_reports'}><input className={commercialInputClass} value={featureDraft.code} disabled={Boolean(editingFeature)} onChange={(event) => setFeatureDraft({ ...featureDraft, code: event.target.value })} /></CommercialField>
          <CommercialField label="Categoria"><input className={commercialInputClass} value={featureDraft.category} onChange={(event) => setFeatureDraft({ ...featureDraft, category: event.target.value })} /></CommercialField>
          <CommercialField label="Tipo de valor"><select className={commercialInputClass} value={featureDraft.valueType} disabled={Boolean(editingFeature)} onChange={(event) => setFeatureDraft({ ...featureDraft, valueType: event.target.value })}><option value="flag">Ativa / inativa</option><option value="quota">Quota mensal</option><option value="number">Número</option><option value="text">Texto</option></select></CommercialField>
          <CommercialField label="Unidade"><input className={commercialInputClass} value={featureDraft.unit} onChange={(event) => setFeatureDraft({ ...featureDraft, unit: event.target.value })} placeholder="ex.: publicações/mês" /></CommercialField>
          <CommercialField label="Motivo"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></CommercialField>
          <CommercialField label="Descrição" className="sm:col-span-2"><textarea className={`${commercialInputClass} min-h-16`} value={featureDraft.description} onChange={(event) => setFeatureDraft({ ...featureDraft, description: event.target.value })} /></CommercialField>
          <button id="feature-form-submit" type="submit" className="hidden" />
        </form>}
      </CommercialModal>
    </CommercialPageShell>
  );
};
