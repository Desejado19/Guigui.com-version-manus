import React, { useMemo, useState } from 'react';
import { Archive, Check, Copy, Edit2, History, Plus, Save, SlidersHorizontal, Users, X } from 'lucide-react';
import type { Business, Language, SubscriptionFeature, SubscriptionLimitValue, SubscriptionPlan, SubscriptionPlanChangePolicy, SubscriptionPlanVersion } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { usePersistentState } from '../../utils/persistentState';
import { DEFAULT_SUBSCRIPTION_FEATURES, DEFAULT_SUBSCRIPTION_PLAN_VERSIONS, DEFAULT_SUBSCRIPTION_PLANS, limitLabel, normaliseSubscriptionPlans } from '../../data/subscriptionCatalog';

interface SubscriptionPlansAdminProps {
  currentLang?: Language;
  businesses: Business[];
}

type DraftPlan = SubscriptionPlan;

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `plano-${Date.now()}`;
const numericOrLimit = (value: string): SubscriptionLimitValue => value === 'unlimited' || value === 'negotiated' ? value : Math.max(0, Number(value) || 0);
const createDraft = (source?: SubscriptionPlan): DraftPlan => source ? { ...source, featureSlugs: [...source.featureSlugs], limits: { ...source.limits }, badges: [...source.badges] } : {
  id: `plan-${Date.now()}`,
  slug: 'novo-plano',
  name: 'Novo plano',
  description: 'Plano configurado pela Administração.',
  price: 0,
  currency: 'XOF',
  billingPeriod: 'monthly',
  postsPerMonth: 0,
  promotionsPerMonth: 0,
  maxCategories: 1,
  priorityLevel: 0,
  homepageRotation: false,
  verifiedBadge: false,
  expandedProfile: false,
  advancedStatistics: false,
  accountManager: false,
  monthlyReports: false,
  exclusiveBanner: false,
  customBranding: false,
  annualContract: false,
  customConditions: '',
  featureSlugs: ['standard_profile', 'basic_statistics', 'posts'],
  limits: { max_posts: 0, max_promotions: 0, max_categories: 1, max_images: 10, max_events: 1, max_campaigns: 0 },
  badges: [],
  isActive: true,
  isPublic: true,
  version: 1,
  changePolicy: 'new_subscriptions',
  updatedAt: new Date().toISOString(),
};

export const SubscriptionPlansAdmin: React.FC<SubscriptionPlansAdminProps> = ({ businesses, currentLang = 'pt' as Language }) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const [plans, setPlans] = usePersistentState<SubscriptionPlan[]>('guigui_subscription_plans', DEFAULT_SUBSCRIPTION_PLANS);
  const [features, setFeatures] = usePersistentState<SubscriptionFeature[]>('guigui_subscription_features', DEFAULT_SUBSCRIPTION_FEATURES);
  const [versions, setVersions] = usePersistentState<SubscriptionPlanVersion[]>('guigui_subscription_plan_versions', DEFAULT_SUBSCRIPTION_PLAN_VERSIONS);
  const [editingPlan, setEditingPlan] = useState<DraftPlan | null>(null);
  const [showFeatureEditor, setShowFeatureEditor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureDescription, setNewFeatureDescription] = useState('');

  const activePlans = useMemo(() => normaliseSubscriptionPlans(plans), [plans]);
  const subscriberCount = (plan: SubscriptionPlan) => businesses.filter((business) => business.planId === plan.id || (!business.planId && business.tier === plan.legacyTier)).length;
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 3500); };

  const updateDraft = <K extends keyof DraftPlan>(field: K, value: DraftPlan[K]) => setEditingPlan((current) => current ? { ...current, [field]: value } : current);
  const updateLimit = (key: string, value: string) => setEditingPlan((current) => current ? { ...current, limits: { ...current.limits, [key]: numericOrLimit(value) } } : current);

  const savePlan = () => {
    if (!editingPlan || !editingPlan.name.trim()) return;
    const previous = activePlans.find((plan) => plan.id === editingPlan.id);
    const nextPlan = { ...editingPlan, name: editingPlan.name.trim(), slug: slugify(editingPlan.slug || editingPlan.name), updatedAt: new Date().toISOString(), version: previous ? previous.version + 1 : 1 };
    setPlans((current) => previous ? current.map((plan) => plan.id === nextPlan.id ? nextPlan : plan) : [...current, nextPlan]);
    setVersions((current) => [{ id: `${nextPlan.id}-v${nextPlan.version}-${Date.now()}`, planId: nextPlan.id, version: nextPlan.version, snapshot: nextPlan, changedBy: 'Administrador Guigui', changedAt: nextPlan.updatedAt, changePolicy: nextPlan.changePolicy, changes: previous ? Object.keys(nextPlan).filter((field) => JSON.stringify(previous[field as keyof SubscriptionPlan]) !== JSON.stringify(nextPlan[field as keyof SubscriptionPlan])).map((field) => ({ field, oldValue: previous[field as keyof SubscriptionPlan], newValue: nextPlan[field as keyof SubscriptionPlan] })) : [] }, ...current]);
    setEditingPlan(null);
    notify(previous ? `${nextPlan.name}: ${t('admin.planUpdated')}` : `${nextPlan.name}: ${t('admin.planCreated')}`);
  };

  const duplicatePlan = (source: SubscriptionPlan) => {
    const duplicate = createDraft({ ...source, id: `plan-${slugify(source.name)}-${Date.now()}`, slug: `${source.slug}-copia`, name: `${source.name} (cópia)`, version: 1, isPublic: false, changePolicy: 'new_subscriptions' });
    setPlans((current) => [...current, duplicate]);
    setVersions((current) => [{ id: `${duplicate.id}-v1`, planId: duplicate.id, version: 1, snapshot: duplicate, changedBy: 'Administrador Guigui', changedAt: duplicate.updatedAt, changePolicy: duplicate.changePolicy, changes: [] }, ...current]);
    setEditingPlan(duplicate);
  };

  const togglePlan = (plan: SubscriptionPlan) => {
    const next = { ...plan, isActive: !plan.isActive, updatedAt: new Date().toISOString(), version: plan.version + 1 };
    setPlans((current) => current.map((candidate) => candidate.id === plan.id ? next : candidate));
    setVersions((current) => [{ id: `${plan.id}-v${next.version}-${Date.now()}`, planId: plan.id, version: next.version, snapshot: next, changedBy: 'Administrador Guigui', changedAt: next.updatedAt, changePolicy: next.changePolicy, changes: [{ field: 'isActive', oldValue: plan.isActive, newValue: next.isActive }] }, ...current]);
    notify(next.isActive ? `${plan.name} reactivado.` : `${plan.name} desactivado; assinaturas existentes mantêm a sua fotografia contratada.`);
  };

  const addFeature = () => {
    if (!newFeatureName.trim()) return;
    const feature: SubscriptionFeature = { id: `feature-${slugify(newFeatureName)}-${Date.now()}`, name: newFeatureName.trim(), slug: slugify(newFeatureName), description: newFeatureDescription.trim() || 'Feature configurável pela Administração.', type: 'custom', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setFeatures((current) => [...current, feature]);
    setNewFeatureName('');
    setNewFeatureDescription('');
    notify(`Feature “${feature.name}” criada.`);
  };

  return (
    <section className="rounded-2xl border border-[var(--tone-info-border)] bg-[var(--tone-info-bg)]/40 p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-indigo-600" /><h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{t('admin.plansTitle')}</h3></div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">O código fornece o motor; os nomes, preços, benefícios, limites, status e condições vêm deste catálogo administrável. Alterações ficam versionadas e não reescrevem a fotografia contratada de assinaturas já pagas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditingPlan(createDraft())} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />{t('admin.createPlan')}</button>
          <button type="button" onClick={() => setShowFeatureEditor((value) => !value)} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[var(--tone-info-border)] bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-black text-[var(--tone-info-text)] hover:bg-[var(--tone-info-bg)]">Features ({features.length})</button>
          <button type="button" onClick={() => setShowHistory((value) => !value)} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-black text-slate-700 hover:bg-slate-100"><History className="h-4 w-4" />Histórico ({versions.length})</button>
        </div>
      </div>
      {notice && <div role="status" className="rounded-xl border border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-success-text)]">{notice}</div>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {activePlans.map((plan) => (
          <article key={plan.id} className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 ${plan.isActive ? 'border-[var(--color-border-default)] dark:border-slate-700' : 'border-[var(--tone-warning-border)] opacity-75'}`}>
            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-black text-slate-900">{plan.name}</h4><span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">v{plan.version}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${plan.isActive ? 'bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]'}`}>{plan.isActive ? 'Activo' : 'Desactivado'}</span></div><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{plan.description}</p></div><div className="text-right"><div className="text-base font-black text-[var(--tone-info-text)]">{plan.price > 0 ? `${plan.price.toLocaleString('pt-PT')} ${plan.currency}` : 'Negociado'}</div><div className="text-[10px] text-slate-500">{plan.billingPeriod === 'annual' ? 'por ano' : 'por mês'} · {subscriberCount(plan)} assinante(s)</div></div></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4"><div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Posts</b><br />{limitLabel(plan.postsPerMonth)}</div><div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Promoções</b><br />{limitLabel(plan.promotionsPerMonth)}</div><div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Categorias</b><br />{limitLabel(plan.maxCategories)}</div><div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Prioridade</b><br />{plan.priorityLevel}</div></div>
            <div className="mt-3 flex flex-wrap gap-1">{plan.featureSlugs.slice(0, 6).map((slug) => <span key={slug} className="rounded-md border border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] px-1.5 py-1 text-[9px] font-bold text-[var(--tone-info-text)]">{features.find((feature) => feature.slug === slug)?.name || slug}</span>)}{plan.featureSlugs.length > 6 && <span className="px-1.5 py-1 text-[9px] font-bold text-slate-500">+{plan.featureSlugs.length - 6}</span>}</div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border-subtle)] pt-3"><button type="button" onClick={() => setEditingPlan(createDraft(plan))} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-[10px] font-black text-slate-700 hover:bg-slate-200"><Edit2 className="h-3 w-3" />Editar</button><button type="button" onClick={() => duplicatePlan(plan)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-[10px] font-black text-slate-700 hover:bg-slate-200"><Copy className="h-3 w-3" />Duplicar</button><button type="button" onClick={() => togglePlan(plan)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--tone-warning-bg)] px-2.5 py-1.5 text-[10px] font-black text-[var(--tone-warning-text)] hover:bg-[var(--tone-warning-bg)]"><Archive className="h-3 w-3" />{plan.isActive ? 'Desactivar' : 'Reactivar'}</button></div>
          </article>
        ))}
      </div>

      {showFeatureEditor && <div className="rounded-2xl border border-[var(--tone-info-border)] bg-white dark:bg-slate-900 p-4"><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-black uppercase text-slate-800">Editor visual de funcionalidades</h4><span className="text-[10px] text-slate-500">Features activas podem ser associadas a qualquer plano</span></div><div className="grid grid-cols-1 gap-2 md:grid-cols-2">{features.map((feature) => <div key={feature.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 dark:bg-slate-800 p-2"><div><div className="text-[11px] font-black text-slate-800">{feature.name}</div><div className="text-[9px] text-slate-500">{feature.description}</div></div><button type="button" onClick={() => setFeatures((current) => current.map((candidate) => candidate.id === feature.id ? { ...candidate, isActive: !candidate.isActive, updatedAt: new Date().toISOString() } : candidate))} className={`rounded-lg px-2 py-1 text-[9px] font-black ${feature.isActive ? 'bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'bg-slate-200 text-slate-500'}`}>{feature.isActive ? 'Activa' : 'Inactiva'}</button></div>)}</div><div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]"><input value={newFeatureName} onChange={(event) => setNewFeatureName(event.target.value)} placeholder="Nome da nova feature" className="rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-[11px]" /><input value={newFeatureDescription} onChange={(event) => setNewFeatureDescription(event.target.value)} placeholder="Descrição e regra comercial" className="rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-[11px]" /><button type="button" onClick={addFeature} className="rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-black text-white">Adicionar</button></div></div>}

      {showHistory && <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] p-4"><h4 className="mb-3 text-xs font-black uppercase text-slate-800">Histórico de versões e alterações</h4><div className="max-h-64 space-y-2 overflow-y-auto">{versions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 dark:bg-slate-800 p-2 text-[10px]"><div><b>{activePlans.find((plan) => plan.id === version.planId)?.name || version.planId} v{version.version}</b><div className="text-slate-500">{version.changedBy} · {new Date(version.changedAt).toLocaleString('pt-PT')} · {version.changePolicy}</div></div><span className="font-bold text-[var(--tone-info-text)]">{version.changes.length} campo(s)</span></div>)}</div></div>}

      {editingPlan && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl"><div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3"><div><h3 className="text-base font-black text-slate-900">{activePlans.some((plan) => plan.id === editingPlan.id) ? 'Editar plano' : 'Criar plano'}</h3><p className="text-[10px] text-slate-500">Todos os campos ficam configuráveis e a alteração cria uma nova versão.</p></div><button type="button" onClick={() => setEditingPlan(null)} className="guigui-close-button" aria-label="Fechar editor de plano"><X className="h-4 w-4" /></button></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-[10px] font-black text-slate-600">Nome<input value={editingPlan.name} onChange={(event) => { updateDraft('name', event.target.value); updateDraft('slug', slugify(event.target.value)); }} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600">Slug<input value={editingPlan.slug} onChange={(event) => updateDraft('slug', event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600 md:col-span-2">Descrição<textarea value={editingPlan.description} onChange={(event) => updateDraft('description', event.target.value)} className="mt-1 min-h-16 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600">Preço base<input type="number" min="0" value={editingPlan.price} onChange={(event) => updateDraft('price', Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600">Moeda<input value={editingPlan.currency} onChange={(event) => updateDraft('currency', event.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600">Periodicidade<select value={editingPlan.billingPeriod} onChange={(event) => updateDraft('billingPeriod', event.target.value as DraftPlan['billingPeriod'])} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900"><option value="monthly">Mensal</option><option value="annual">Anual</option><option value="custom">Personalizada</option></select></label><label className="text-[10px] font-black text-slate-600">Política de alteração<select value={editingPlan.changePolicy} onChange={(event) => updateDraft('changePolicy', event.target.value as SubscriptionPlanChangePolicy)} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900"><option value="new_subscriptions">Apenas novas adesões</option><option value="next_renewal">Aplicar na próxima renovação</option><option value="immediate">Aplicar imediatamente</option></select></label></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><label className="text-[10px] font-black text-slate-600">Posts/mês<input value={String(editingPlan.postsPerMonth)} onChange={(event) => { const value = numericOrLimit(event.target.value); updateDraft('postsPerMonth', value); updateLimit('max_posts', event.target.value); }} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-2 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600">Promoções/mês<input value={String(editingPlan.promotionsPerMonth)} onChange={(event) => { const value = numericOrLimit(event.target.value); updateDraft('promotionsPerMonth', value); updateLimit('max_promotions', event.target.value); }} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-2 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600">Máx. categorias<input value={String(editingPlan.maxCategories)} onChange={(event) => { const value = numericOrLimit(event.target.value); updateDraft('maxCategories', value); updateLimit('max_categories', event.target.value); }} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-2 py-2 text-xs text-slate-900" /></label><label className="text-[10px] font-black text-slate-600">Prioridade<input type="number" min="0" value={editingPlan.priorityLevel} onChange={(event) => updateDraft('priorityLevel', Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-2 py-2 text-xs text-slate-900" /></label></div><div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">{features.filter((feature) => feature.isActive).map((feature) => <label key={feature.id} className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 dark:bg-slate-800 px-3 py-2 text-[11px] font-bold text-slate-700"><input type="checkbox" checked={editingPlan.featureSlugs.includes(feature.slug)} onChange={(event) => updateDraft('featureSlugs', event.target.checked ? Array.from(new Set([...editingPlan.featureSlugs, feature.slug])) : editingPlan.featureSlugs.filter((slug) => slug !== feature.slug))} className="h-4 w-4 accent-indigo-600" />{feature.name}</label>)}</div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-[10px] font-black text-slate-600">Condições especiais<textarea value={editingPlan.customConditions || ''} onChange={(event) => updateDraft('customConditions', event.target.value)} placeholder="Condições, exceções ou nota de preço negociado" className="mt-1 min-h-16 w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-700 px-3 py-2 text-xs text-slate-900" /></label><div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-700">{([['homepageRotation', 'Homepage'], ['verifiedBadge', 'Badge'], ['expandedProfile', 'Ficha expandida'], ['advancedStatistics', 'Estatísticas avançadas'], ['accountManager', 'Gestor'], ['monthlyReports', 'Relatórios mensais'], ['exclusiveBanner', 'Banner exclusivo'], ['customBranding', 'Branding próprio'], ['annualContract', 'Contrato anual'], ['isPublic', 'Público']] as Array<[keyof DraftPlan, string]>).map(([key, label]) => <label key={String(key)} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><input type="checkbox" checked={Boolean(editingPlan[key])} onChange={(event) => updateDraft(key, event.target.checked as DraftPlan[typeof key])} className="h-3.5 w-3.5 accent-indigo-600" />{label}</label>)}</div></div><div className="mt-5 flex justify-end gap-2 border-t border-[var(--color-border-subtle)] pt-4"><button type="button" onClick={() => setEditingPlan(null)} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-700">Cancelar</button><button type="button" onClick={savePlan} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700"><Save className="h-4 w-4" />Guardar versão</button></div></div></div>}
    </section>
  );
};
