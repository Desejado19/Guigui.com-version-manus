import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, History, AlertTriangle } from 'lucide-react';
import type { Language, Business, SubscriptionPlan, SubscriptionPlanVersion, SubscriptionFeature } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { Badge, Button, Card, EmptyState, IconButton } from '../../ui';
import { AdminPagination } from './AdminPagination';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { AdminFeatureCatalog } from './AdminFeatureCatalog';
import {
  limitLabel,
  normaliseSubscriptionPlans,
} from '../../data/subscriptionCatalog';
import {
  computeUsageAlerts,
  type UsageAlert,
  type UsageAlertSeverity,
} from '../../services/usageAlertService';
import { resolvePlan, planIncludesFeature, featuresForPlan } from '../../services/entitlementService';

interface AdminPricingUsageGovernanceProps {
  currentLang: Language;
  businesses: Business[];
  plans: SubscriptionPlan[];
  versions: SubscriptionPlanVersion[];
  features: SubscriptionFeature[];
  pageSize?: number;
}

type PricingSubTab = 'configuracao' | 'alertas' | 'versionamento' | 'catalogo';

export const AdminPricingUsageGovernance: React.FC<AdminPricingUsageGovernanceProps> = ({
  currentLang = 'pt' as Language,
  businesses,
  plans,
  versions,
  features,
  pageSize = 20,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const [subTab, setSubTab] = useState<PricingSubTab>('configuracao');
  const [usageFilter, setUsageFilter] = useState<{ severity?: UsageAlertSeverity; search?: string }>({});
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const activePlans = useMemo(() => normaliseSubscriptionPlans(plans), [plans]);
  const activeVersions = useMemo(() => versions, [versions]);
  const versionPagination = usePaginatedList(activeVersions, {
    persistKey: 'guigui_plan_versions_page_size',
  });
  const featuredBusinesses = useMemo(() => businesses.filter((b) => b.status === 'active').slice(0, 10), [businesses]);
  const allFeatures = useMemo<SubscriptionFeature[]>(() => {
    const combined = new Map<string, SubscriptionFeature>();
    for (const plan of activePlans) {
      for (const feature of featuresForPlan(plan, features)) {
        combined.set(feature.id, feature);
      }
    }
    return Array.from(combined.values());
  }, [activePlans, features]);

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
            <History className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{t('admin.pricingUsageTitle') || 'Governança de Preços e Uso'}</h3>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">
            Configuração dinâmica de preços e condições, monitorização de uso por plano, versionamento de catálogo e política de concessão.
            O código fornece o motor; o painel define os valores, os limites e as flags.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info" className="bg-indigo-100 text-indigo-800 border-0 px-3 py-1 text-[10px] font-black">v2 — Pricing & Usage</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSubTab('configuracao')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'configuracao' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <ArrowUpRight className="inline h-3.5 w-3.5" />
          Configuração dinâmica
        </button>
        <button type="button" onClick={() => setSubTab('alertas')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'alertas' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <AlertTriangle className="inline h-3.5 w-3.5" />
          Alertas de uso
        </button>
        <button type="button" onClick={() => setSubTab('versionamento')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'versionamento' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <History className="inline h-3.5 w-3.5" />
          Versionamento
        </button>
        <button type="button" onClick={() => setSubTab('catalogo')} className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${subTab === 'catalogo' ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'}`}>
          <RefreshCw className="inline h-3.5 w-3.5" />
          Catálogo
        </button>
      </div>

      {subTab === 'configuracao' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Configuração dinâmica de planos e condições</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Atualiza o catálogo e os limites sem alterar o código. Os valores definidos aqui alimentam as regras comerciais.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-bold">{activePlans.length} planos</span>
              <span className="text-slate-300">·</span>
              <span className="font-bold text-indigo-700">{activeFeaturesCount} funcionalidades</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activePlans.slice(0, 12).map((plan) => {
              const resolved = resolvePlan({ id: '', name: '', slug: '', logo: '', coverImage: '', gallery: [], description: '', categoryId: '', subcategoryId: '', groupGroupId: 'restauracao', tier: plan.legacyTier ?? 'basic', neighborhood: '', address: '', phone: '', whatsapp: '', openingHours: '', priceRange: '$', status: 'active', verified: false, featured: false, ratingLabel: '', reviewsCount: 0, reviews: [], posts: [], promotions: [], metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 }, subscriptionRenewDate: '' } as Business, activePlans);
              const featureCount = featuresForPlan(resolved, allFeatures).length;
              return (
                <Card key={plan.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{plan.name}</span>
                        <Badge variant={plan.isActive ? 'success' : 'warning'} className="bg-slate-100 dark:bg-slate-800 text-slate-700 border-0 px-2 py-0.5 text-[9px] uppercase tracking-wider">v{plan.version}</Badge>
                        {plan.isActive && <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-0 px-2 py-0.5 text-[9px]">ativo</Badge>}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">{plan.description}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] text-slate-500">preço base</div>
                      <div className="font-mono font-black text-indigo-700">{plan.price > 0 ? `${plan.price.toLocaleString('pt-PT')} ${plan.currency}` : 'negociado'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Posts</b><br />{limitLabel(plan.postsPerMonth)}</div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Promoções</b><br />{limitLabel(plan.promotionsPerMonth)}</div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Categorias</b><br />{limitLabel(plan.maxCategories)}</div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2"><b>Funcionalidades</b><br />{featureCount}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {featuresForPlan(resolved, allFeatures).slice(0, 4).map((feature) => (
                      <span key={feature.id} className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700">{feature.name}</span>
                    ))}
                    {featureCount > 4 && <span className="text-[9px] text-slate-500 font-bold">+{featureCount - 4}</span>}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 text-[11px] text-slate-700 flex flex-wrap items-start justify-between gap-3 shadow-sm">
            <div>
              <span className="font-black text-indigo-800">Política dinâmica: </span>
              O catálogo de funcionalidades, os limites e as flags são editáveis pelo painel. O sistema aplica esses valores em concessão, consumo e alertas.
            </div>
            <Badge variant="info" className="bg-indigo-100 text-indigo-800 border-0 px-3 py-1 text-[10px] font-black">v2 — Configuração</Badge>
          </div>
        </div>
      )}

      {subTab === 'alertas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Alertas de uso por plano</h4>
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

      {subTab === 'versionamento' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Versionamento de catálogo e plano</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Cada alteração cria uma nova versão. Assinaturas existentes mantêm a fotografia contratada da versão antiga.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-bold">{activeVersions.length} versão(ões)</span>
              <span className="text-slate-300">·</span>
              <span className="font-bold text-indigo-700">{activePlans.length} planos</span>
            </div>
          </div>

          {activeVersions.length === 0 ? (
            <EmptyState title="Sem histórico de versões" description="As versões aparecem quando um plano ou a configuração dinâmica é alterada." icon={<History className="h-6 w-6" />} />
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
                          <Badge variant={plan?.isActive ? 'success' : 'warning'} className="bg-slate-100 dark:bg-slate-800 text-slate-700 border-0 px-2 py-0.5 text-[9px] uppercase tracking-wider">v{version.version}</Badge>
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

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 text-[11px] text-slate-700 flex flex-wrap items-start justify-between gap-3 shadow-sm">
            <div>
              <span className="font-black text-indigo-800">Versão contratual: </span>
              Upgrade e downgrade são versionados. Assinaturas ativas não são reescritas automaticamente; a política aplica-se conforme configurado por plano.
            </div>
            <Badge variant="info" className="bg-indigo-100 text-indigo-800 border-0 px-3 py-1 text-[10px] font-black">v2 — Versionamento</Badge>
          </div>
        </div>
      )}

      {subTab === 'catalogo' && (
        <AdminFeatureCatalog currentLang={currentLang} />
      )}

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 text-[11px] text-slate-700 flex flex-wrap items-start justify-between gap-3 shadow-sm">
        <div>
          <span className="font-black text-indigo-800">Governança de preços e uso: </span>
          A configuração dinâmica, os alertas, o versionamento e o catálogo formam um ciclo fechado. O sistema consome os valores definidos pelo painel e nunca os substitui por valores fixos.
        </div>
        <Badge variant="info" className="bg-indigo-100 text-indigo-800 border-0 px-3 py-1 text-[10px] font-black">v2 — Pricing & Usage</Badge>
      </div>
    </section>
  );
};

const activeFeaturesCount = 0;
