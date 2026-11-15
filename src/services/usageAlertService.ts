import type { Business, SubscriptionPlan } from '../types';
import { getUsageAlerts } from './entitlementService';

export type UsageAlertSeverity = 'info' | 'warning' | 'critical';

export interface UsageAlert {
  id: string;
  businessId: string;
  businessName?: string;
  featureSlug: string;
  featureLabel: string;
  currentUsage: number;
  limit: number | 'unlimited' | 'negotiated';
  percent: number;
  threshold: number;
  severity: UsageAlertSeverity;
  message: string;
  createdAt: string;
  acknowledged: boolean;
  planId?: string;
  planName?: string;
  tier?: string;
}

const featureLabels: Record<string, string> = {
  posts: 'Publicações',
  promotions: 'Promoções',
  events: 'Eventos',
  images: 'Imagens',
  campaigns: 'Campanhas',
};

export const computeUsageAlerts = (business: Business, plans: SubscriptionPlan[] = []): UsageAlert[] => {
  const raw = getUsageAlerts(business, plans);
  const plan = plans.find((p) => p.id === (business as Business & { subscriptionPlanSnapshot?: SubscriptionPlan }).subscriptionPlanSnapshot?.id)
    ?? (business as Business & { subscriptionPlanSnapshot?: SubscriptionPlan }).subscriptionPlanSnapshot
    ?? plans[0];

  return raw.map((item) => {
    const label = featureLabels[item.featureSlug] || item.featureSlug.replace(/_/g, ' ');
    const severity =
      item.threshold === 100 ? 'critical' : item.threshold === 90 ? 'warning' : 'info';
    const limit =
      item.featureSlug === 'posts'
        ? (plan?.limits.max_posts ?? plan?.postsPerMonth ?? 0)
        : item.featureSlug === 'promotions'
        ? (plan?.limits.max_promotions ?? plan?.promotionsPerMonth ?? 0)
        : item.featureSlug === 'events'
        ? (plan?.limits.max_events ?? 1)
        : item.featureSlug === 'images'
        ? (plan?.limits.max_images ?? 10)
        : item.featureSlug === 'campaigns'
        ? (plan?.limits.max_campaigns ?? 0)
        : 0;

    return {
      id: `alert-${business.id}-${item.featureSlug}-${item.threshold}`,
      businessId: business.id,
      businessName: business.name,
      featureSlug: item.featureSlug,
      featureLabel: label,
      currentUsage: Math.min(limit === 'unlimited' ? 0 : Number(limit || 0), Math.round((item.percent / 100) * Number(limit || 1))),
      limit: isFiniteNumeric(limit) ? limit : 'unlimited',
      percent: item.percent,
      threshold: item.threshold,
      severity,
      message: `Utilização de ${label} em ${item.percent}% do limite do plano ${plan?.name ?? 'desconhecido'}.`,
      createdAt: new Date().toISOString(),
      acknowledged: false,
      planId: plan?.id,
      planName: plan?.name,
      tier: business.tier,
    };
  });
};

export const hasCriticalUsageAlert = (business: Business, plans: SubscriptionPlan[] = []): boolean => {
  return computeUsageAlerts(business, plans).some((alert) => alert.severity === 'critical');
};

export const getUsageAlertSummary = (business: Business, plans: SubscriptionPlan[] = []): { critical: number; warning: number; info: number; total: number } => {
  const alerts = computeUsageAlerts(business, plans);
  return {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    total: alerts.length,
  };
};

export const acknowledgeUsageAlert = (alert: UsageAlert): UsageAlert => ({
  ...alert,
  acknowledged: true,
});

export const isFiniteNumeric = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

export const formatUsageAlertMessage = (alert: UsageAlert, currentLang: 'pt' | 'en' | 'fr' | 'es' = 'pt'): string => {
  if (currentLang === 'en') {
    return `Usage of ${alert.featureLabel} is at ${alert.percent}% of the plan limit (${alert.planName ?? 'unknown'}).`;
  }
  if (currentLang === 'fr') {
    return `L'utilisation de ${alert.featureLabel} est à ${alert.percent}% de la limite du plan ${alert.planName ?? 'inconnu'}.`;
  }
  if (currentLang === 'es') {
    return `El uso de ${alert.featureLabel} está en un ${alert.percent}% del límite del plan ${alert.planName ?? 'desconocido'}.`;
  }
  return `Utilização de ${alert.featureLabel} em ${alert.percent}% do limite do plano ${alert.planName ?? 'desconhecido'}.`;
};

export const usageAlertMatches = (alert: UsageAlert, filter: { featureSlug?: string; severity?: UsageAlertSeverity; search?: string }): boolean => {
  if (filter.featureSlug && alert.featureSlug !== filter.featureSlug) return false;
  if (filter.severity && alert.severity !== filter.severity) return false;
  if (filter.search) {
    const haystack = `${alert.featureLabel} ${alert.businessName ?? ''}`.toLowerCase();
    if (!haystack.includes(filter.search.toLowerCase())) return false;
  }
  return true;
};
