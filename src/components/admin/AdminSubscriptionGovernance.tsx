import React, { useMemo, useState } from 'react';
import { History, BarChart3, ShieldCheck, RefreshCw } from 'lucide-react';
import type { Language, Business, SubscriptionPlan, SubscriptionPlanVersion, SubscriptionFeature } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { Badge, Button, Card, EmptyState, IconButton } from '../../ui';
import { AdminPagination } from './AdminPagination';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { AdminFeatureCatalog } from './AdminFeatureCatalog';
import {
  getPlanMonthlyPrice,
  getPlanById,
  limitLabel,
  normaliseSubscriptionPlans,
} from '../../data/subscriptionCatalog';
import {
  computeUsageAlerts,
  type UsageAlert,
  type UsageAlertSeverity,
} from '../../services/usageAlertService';
import { resolvePlan, planIncludesFeature, allPlanFeatures, featuresForPlan } from '../../services/entitlementService';

interface AdminSubscriptionGovernanceProps {
  currentLang: Language;
  businesses: Business[];
  plans: SubscriptionPlan[];
  versions: SubscriptionPlanVersion[];
  onUpdatePlans?: (plans: SubscriptionPlan[]) => void;
  onUpdateVersions?: (versions: SubscriptionPlanVersion[]) => void;
  pageSize?: number;
}

type GovernanceSubTab = 'plans' | 'versions' | 'usage' | 'entitlements' | 'catalog';

export const AdminSubscriptionGovernance: React.FC<AdminSubscriptionGovernanceProps> = ({
  currentLang = 'pt' as Language,
  businesses,
  plans,
  versions,
  pageSize = 20,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const [subTab, setSubTab] = useState<GovernanceSubTab>('plans');
  const [usageFilter, setUsageFilter] = useState<{ severity?: UsageAlertSeverity; search?: string }>({});
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const activePlans = useMemo(() => normaliseSubscriptionPlans(plans), [plans]);
  const activeVersions = useMemo(() => versions, [versions]);
  const versionPagination = usePaginatedList(activeVersions, {
    persistKey: 'guigui_plan_versions_page_size',
  });
  const featuredBusinesses = useMemo(() => businesses.filter((b) => b.status === 'active').slice(0, 8), [businesses]);
  const allFeatures = useMemo<SubscriptionFeature[]>(() => {
    const combined = new Map<string, SubscriptionFeature>();
    for (const plan of activePlans) {
      for (const feature of featuresForPlan(plan, activePlans as unknown as SubscriptionFeature[])) {
        combined.set(feature.id, feature);
      }
    }
    return Array.from(combined.values());
  }, [activePlans]);

  const totalBusinesses = businesses.length;
  const totalPages = Math.max(1, Math.ceil(totalBusinesses / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const paginatedBusinesses = businesses.slice((safePage - 1) * pageSize, safePage * pageSize);

  const sampleBusiness = useMemo(() => {
    if (activeBusinessId) return businesses.find((b) => b.id === activeBusinessId) ?? businesses[0];
    return businesses[0];
  }, [businesses, activeBusinessId]);

  const sampleAlerts = useMemo(() => (sampleBusiness ? computeUsageAlerts(sampleBusiness, activePlans) : []), [sampleBusiness, activePlans]);
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0 };
    for (const business of businesses) {
      for (const alert of computeUsageAlerts(business, activePlans)) {
        counts[alert.severity] += 1;
      }
    }
    return counts;
  }, [businesses, activePlans]);

  const filteredAlerts = useMemo(() => {
    const out: UsageAlert[] = [];
    for (const business of paginatedBusinesses) {
      for (const alert of computeUsageAlerts(business, activePlans)) {
        if (usageFilter.severity && alert.severity !== usageFilter.severity) continue;
        if (usageFilter.search) {
          const haystack = `${alert.featureLabel} ${alert.businessName ?? ''} ${alert.planName ?? ''}`.toLowerCase();
          if (!haystack.includes(usageFilter.search.toLowerCase())) continue;
        }
        out.push(alert);
      }
    }
    return out;
  }, [paginatedBusinesses, activePlans, usageFilter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{t('admin.govPanelTitle') || 'Painel de Governança SaaS'}</h3>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">
            Gestão centralizada de condições comerciais: catálogo de funcionalidades, versões de plano, alertas de uso, concessão por plano e políticas de evolução.
            O sistema aplica o que a administração define; não reescreve contratos já pagos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info" className="bg-indigo-100 text-indigo-800 border-0 px-3 py-1 text-[10px] font-black">v2 — Governança</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSubTab('catalog')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'catalog' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <ShieldCheck className="inline h-3.5 w-3.5" />
          Catálogo de funcionalidades
        </button>
        <button type="button" onClick={() => setSubTab('plans')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'plans' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <History className="inline h-3.5 w-3.5" />
          Versões de plano
        </button>
        <button type="button" onClick={() => setSubTab('usage')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'usage' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <BarChart3 className="inline h-3.5 w-3.5" />
          Alertas de uso
        </button>
        <button type="button" onClick={() => setSubTab('entitlements')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'entitlements' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <ShieldCheck className="inline h-3.5 w-3.5" />
          Concessão
        </button>
      </div>

      {subTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Histórico de versões de plano</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Cada alteração criou uma nova versão; assinaturas existentes mantêm a fotografia contratada.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-bold">{activeVersions.length} versão(ões)</span>
              <span className="text-slate-300">·</span>
              <span className="font-bold text-indigo-700">{activePlans.length} planos ativos</span>
            </div>
          </div>

          {activeVersions.length === 0 ? (
            <EmptyState title="Sem histórico de versões" description="As versões aparecem quando um plano é criado ou editado no painel de planos." icon={<History className="h-6 w-6" />} />
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="divide-y divide-slate-100 text-xs">
                {versionPagination.pageItems.map((version) => {
                  const plan = activePlans.find((p) => p.id === version.planId);
                  return (
                    <div key={version.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900">{plan?.name ?? version.planId}</span>
                          <Badge variant={plan?.isActive ? 'success' : 'warning'} className="bg-slate-100 dark:bg-slate-800 text-slate-700 border-0 px-2 py-0.5 text-[9px] uppercase tracking-wider">
                            v{version.version}
                          </Badge>
                          {plan?.isActive && <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-0 px-2 py-0.5 text-[9px]">ativo</Badge>}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {version.changedBy} · {new Date(version.changedAt).toLocaleString('pt-PT')} · política {version.changePolicy}
                        </div>
                        {version.changes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {version.changes.slice(0, 6).map((change) => (
                              <span key={change.field} className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-700">
                                {change.field}: {JSON.stringify(change.oldValue).slice(0, 18)} → {JSON.stringify(change.newValue).slice(0, 18)}
                              </span>
                            ))}
                            {version.changes.length > 6 && <span className="text-[9px] text-slate-500 font-bold">+{version.changes.length - 6}</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[11px] text-slate-500">preço base</div>
                        <div className="font-mono font-black text-indigo-700">
                          {plan && plan.price > 0 ? `${plan.price.toLocaleString('pt-PT')} ${plan.currency}` : 'negociado'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {activeVersions.length > 0 && <AdminPagination currentLang={currentLang} currentPage={versionPagination.page} pageSize={versionPagination.pageSize} totalItems={versionPagination.totalItems} onPageChange={versionPagination.setPage} onPageSizeChange={versionPagination.setPageSize} />}
            </div>
          )}
        </div>
      )}

      {subTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Alertas de consumo por plano</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Níveis 70% / 90% / 100% sobre publicações, promoções, eventos, imagens e campanhas.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
                info {severityCounts.info}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-600" />
                aviso {severityCounts.warning}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700">
                <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
                crítico {severityCounts.critical}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={usageFilter.severity === undefined ? 'primary' : 'secondary'} onClick={() => setUsageFilter((prev) => ({ ...prev, severity: undefined }))} className="rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700">
              Todos
            </Button>
            {(['info', 'warning', 'critical'] as const).map((sev) => (
              <Button key={sev} type="button" size="sm" variant={usageFilter.severity === sev ? 'primary' : 'secondary'} onClick={() => setUsageFilter((prev) => ({ ...prev, severity: sev }))} className={sev === 'critical' ? 'rounded-xl bg-red-100 hover:bg-red-200 text-red-800' : 'rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700'}>
                {sev}
              </Button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
            {filteredAlerts.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-500">
                {paginatedBusinesses.length === 0 ? 'Nenhuma empresa nesta página.' : 'Nenhum alerta relevante nesta página com os filtros seleccionados.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${alert.severity === 'critical' ? 'bg-red-100 text-red-800' : alert.severity === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {alert.severity}
                        </span>
                        <span className="font-bold text-slate-900">{alert.businessName}</span>
                        <Badge variant="neutral" className="bg-slate-100 dark:bg-slate-800 text-slate-700 border-0 px-2 py-0.5 text-[9px]">
                          {alert.planName}
                        </Badge>
                        <span className="text-slate-500">{alert.featureLabel}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className={`h-full rounded-full ${alert.percent >= 100 ? 'bg-red-600' : alert.percent >= 90 ? 'bg-amber-600' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, alert.percent)}%` }} />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700">{alert.percent}%</span>
                        <span className="text-[10px] text-slate-500">
                          {alert.currentUsage.toLocaleString('pt-PT')} / {limitLabel(alert.limit)}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500 italic">{alert.message}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={alert.tier === 'enterprise' ? 'success' : alert.tier === 'premium' ? 'info' : alert.tier === 'professional' ? 'neutral' : 'warning'} className="bg-slate-100 dark:bg-slate-800 text-slate-700 border-0 px-2 py-0.5 text-[9px] uppercase tracking-wider">
                        {alert.tier}
                      </Badge>
                      {alert.acknowledged ? <span className="text-[9px] text-slate-400">lido</span> : <span className="text-[9px] text-red-700 font-bold">pendente</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Fila de uso: {filteredAlerts.length} alerta(s) nesta página · {severityCounts.critical} crítico(s) no total.</span>
            <span>Alertas calculados com base nos planos e uso do período corrente.</span>
          </div>
        </div>
      )}

      {subTab === 'entitlements' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Concessão por plano</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Verificação de funcionalidades e quotas por empresa, sem condições codificadas nas regras de negócio.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-bold">{featuredBusinesses.length} empresas de exemplo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3 mb-3">
                <select
                  value={activeBusinessId ?? ''}
                  onChange={(e) => { setActiveBusinessId(e.target.value || null); setPage(1); }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 max-w-[220px]"
                >
                  <option value="">Empresa (exemplo)…</option>
                  {featuredBusinesses.map((business) => (
                    <option key={business.id} value={business.id}>{business.name} — {business.tier}</option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="secondary" onClick={() => setPage(1)} className="rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Recarregar
                </Button>
              </div>

              {sampleBusiness ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800">{sampleBusiness.name}</span>
                    <Badge variant={sampleBusiness.planId || sampleBusiness.tier === 'enterprise' ? 'success' : 'neutral'} className="bg-slate-100 dark:bg-slate-800 text-slate-700 border-0 px-2 py-0.5 text-[9px] uppercase tracking-wider">
                      {resolvePlan(sampleBusiness, activePlans).name} v{resolvePlan(sampleBusiness, activePlans).version}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    {['posts', 'promotions', 'events', 'images', 'campaigns'].map((slug) => {
                      const resolved = resolvePlan(sampleBusiness, activePlans);
                      const meta = (
                        slug === 'posts'
                          ? { limit: resolved.limits.max_posts ?? resolved.postsPerMonth, used: sampleBusiness.subscriptionUsage?.postsUsed ?? 0 }
                          : slug === 'promotions'
                          ? { limit: resolved.limits.max_promotions ?? resolved.promotionsPerMonth, used: sampleBusiness.subscriptionUsage?.promotionsUsed ?? 0 }
                          : slug === 'events'
                          ? { limit: resolved.limits.max_events ?? 1, used: sampleBusiness.subscriptionUsage?.eventsUsed ?? 0 }
                          : slug === 'images'
                          ? { limit: resolved.limits.max_images ?? 10, used: sampleBusiness.subscriptionUsage?.imagesUsed ?? 0 }
                          : slug === 'campaigns'
                          ? { limit: resolved.limits.max_campaigns ?? 0, used: sampleBusiness.subscriptionUsage?.campaignsUsed ?? 0 }
                          : { limit: 0 as number | 'unlimited' | 'negotiated', used: 0 }
                      );
                      const hasFeature = planIncludesFeature(resolved, slug, allFeatures);
                      const allowed = hasFeature && (meta.limit === 'unlimited' || meta.limit === 'negotiated' || typeof meta.limit === 'number' && meta.used < meta.limit);
                      return (
                        <div key={slug} className={`rounded-xl border p-3 ${allowed ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900' : 'border-red-200 bg-red-50/50'}`}>
                          <div className="font-bold text-slate-800 uppercase tracking-wider text-[9px]">{slug.replace(/_/g, ' ')}</div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={allowed ? 'text-emerald-700 font-mono font-bold' : 'text-red-700 font-mono font-bold'}>{limitLabel(meta.limit)}</span>
                            <span className="text-slate-400">·</span>
                            <span className="font-mono text-slate-600">{meta.used} usados</span>
                          </div>
                          <div className="mt-1">
                            <span className={allowed ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                              {allowed ? 'concedido' : 'não incluído'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-[11px] text-slate-700">
                    <span className="font-black text-indigo-800">Resumo de concessão: </span>
                    {allPlanFeatures(resolvePlan(sampleBusiness, activePlans), allFeatures).map((feature) => (
                      <span key={feature.id} className="inline-block rounded-full bg-white dark:bg-slate-900 border border-indigo-200 px-2 py-0.5 text-[9px] font-bold text-indigo-800 mr-1 mb-1">
                        {feature.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="Sem empresa seleccionada" description="Selecione uma empresa da lista para ver a concessão atual." icon={<ShieldCheck className="h-6 w-6" />} />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 mb-3">Regra de concessão</h4>
              <ul className="space-y-2 text-[11px] text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                  <span>Concessão vem do catálogo e do plano, não de if/else fixos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                  <span>Upgrade mantém a fotografia contratada da versão antiga.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-600 flex-shrink-0" />
                  <span>Downgrade aplica na próxima renovação por defeito.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-600 flex-shrink-0" />
                  <span>Alertas de uso actuam em 70/90/100% por recurso.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  <span>Feature flags controlam disponibilidade sem nova entrega.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {subTab === 'catalog' && (
        <AdminFeatureCatalog currentLang={currentLang} />
      )}

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 text-[11px] text-slate-700 flex flex-wrap items-start justify-between gap-3 shadow-sm">
        <div>
          <span className="font-black text-indigo-800">Nota de governança: </span>
          O painel de governança agrupa catálogo, versões, alertas e concessão num fluxo continuo. O plano e o uso fornecidos pela aplicação alimentam os cálculos; o catálogo é editável pela administração.
        </div>
        <Badge variant="info" className="bg-indigo-100 text-indigo-800 border-0 px-3 py-1 text-[10px] font-black">Governança SaaS · v2</Badge>
      </div>
    </section>
  );
};
