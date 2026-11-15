import type {
  Business,
  SubscriptionFeature,
  SubscriptionPlan,
  SubscriptionUsage,
} from '../types';
import {
  getBusinessPlan,
  isUnlimited,
  limitAllows,
  getBusinessUsage,
  getUsagePeriodKey,
  hasPlanFeature,
  getPlanFeatureSlugs,
} from '../data/subscriptionCatalog';

interface EntitlementResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: SubscriptionUsage;
  plan?: SubscriptionPlan;
  feature?: SubscriptionFeature;
  remaining?: number | 'unlimited' | 'negotiated';
}

const DEFAULT_FALLBACK_PLAN: SubscriptionPlan = {
  id: 'plan-unknown',
  slug: 'unknown',
  name: 'Sem plano',
  description: 'Plano não encontrado.',
  price: 0,
  currency: 'XOF',
  billingPeriod: 'monthly',
  postsPerMonth: 0,
  promotionsPerMonth: 0,
  maxCategories: 0,
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
  featureSlugs: [],
  limits: {},
  badges: [],
  isActive: true,
  isPublic: true,
  version: 1,
  changePolicy: 'new_subscriptions',
  updatedAt: new Date().toISOString(),
};

export const resolvePlan = (
  business: Business,
  plans: SubscriptionPlan[],
  fallbackTier: SubscriptionPlan['legacyTier'] = business.tier,
): SubscriptionPlan => {
  const snapshot = (business as Business & { subscriptionPlanSnapshot?: SubscriptionPlan }).subscriptionPlanSnapshot;
  if (snapshot && business.planId) {
    return snapshot;
  }
  const plan = getBusinessPlan(business, plans);
  if (plan) return plan;
  return plans.find((candidate) => candidate.legacyTier === fallbackTier) ?? plans[0] ?? DEFAULT_FALLBACK_PLAN;
};

export const checkEntitlement = (
  business: Business,
  featureSlug: string,
  features: SubscriptionFeature[] = [],
  plans: SubscriptionPlan[] = [],
): EntitlementResult => {
  const plan = resolvePlan(business, plans);
  const feature = features.find((candidate) => candidate.slug === featureSlug);
  if (!hasPlanFeature(plan, featureSlug, features)) {
    return {
      allowed: false,
      reason: `A funcionalidade “${featureSlug}” não está incluída no plano ${plan.name}.`,
      plan,
      feature: feature ?? undefined,
    };
  }
  const usage = getBusinessUsage(business);

  if (featureSlug === 'posts') {
    const limit = plan.limits.max_posts ?? plan.postsPerMonth;
    return {
      allowed: limitAllows(limit, usage.postsUsed),
      currentUsage: usage,
      plan,
      feature,
      remaining: isUnlimited(limit) ? (limit ?? 'unlimited') : Math.max(0, Number(limit || 0) - usage.postsUsed),
    };
  }

  if (featureSlug === 'promotions') {
    const limit = plan.limits.max_promotions ?? plan.promotionsPerMonth;
    return {
      allowed: limitAllows(limit, usage.promotionsUsed),
      currentUsage: usage,
      plan,
      feature,
      remaining: isUnlimited(limit) ? (limit ?? 'unlimited') : Math.max(0, Number(limit || 0) - usage.promotionsUsed),
    };
  }

  if (featureSlug === 'events') {
    const limit = plan.limits.max_events ?? 1;
    return {
      allowed: limitAllows(limit, usage.eventsUsed),
      currentUsage: usage,
      plan,
      feature,
      remaining: isUnlimited(limit) ? (limit ?? 'unlimited') : Math.max(0, Number(limit || 0) - usage.eventsUsed),
    };
  }

  if (featureSlug === 'images') {
    const limit = plan.limits.max_images ?? 10;
    return {
      allowed: limitAllows(limit, usage.imagesUsed),
      currentUsage: usage,
      plan,
      feature,
      remaining: isUnlimited(limit) ? (limit ?? 'unlimited') : Math.max(0, Number(limit || 0) - usage.imagesUsed),
    };
  }

  if (featureSlug === 'campaigns') {
    const limit = plan.limits.max_campaigns ?? 0;
    return {
      allowed: limitAllows(limit, usage.campaignsUsed),
      currentUsage: usage,
      plan,
      feature,
      remaining: isUnlimited(limit) ? (limit ?? 'unlimited') : Math.max(0, Number(limit || 0) - usage.campaignsUsed),
    };
  }

  return {
    allowed: true,
    currentUsage: usage,
    plan,
    feature,
  };
};

export const consumeEntitlement = (
  business: Business,
  featureSlug: string,
  quantity: number = 1,
  plans: SubscriptionPlan[] = [],
): EntitlementResult => {
  const plan = resolvePlan(business, plans);
  const snapshot = (business as Business & { subscriptionPlanSnapshot?: SubscriptionPlan }).subscriptionPlanSnapshot;
  const effectivePlan = snapshot && business.planId ? snapshot : plan;

  if (!hasPlanFeature(plan, featureSlug, [])) {
    return {
      allowed: false,
      reason: `A funcionalidade “${featureSlug}” não está incluída no plano ${plan.name}.`,
      plan,
    };
  }

  const quotaField =
    featureSlug === 'posts'
      ? 'postsUsed'
      : featureSlug === 'promotions'
      ? 'promotionsUsed'
      : featureSlug === 'events'
      ? 'eventsUsed'
      : featureSlug === 'images'
      ? 'imagesUsed'
      : featureSlug === 'campaigns'
      ? 'campaignsUsed'
      : null;

  if (!quotaField) {
    return {
      allowed: true,
      plan,
      feature: featuresFind(featureSlug, []),
    };
  }

  const usage = getBusinessUsage(business);
  const current = usage[quotaField as keyof SubscriptionUsage] as number;
  const limit =
    featureSlug === 'posts'
      ? plan.limits.max_posts ?? plan.postsPerMonth
      : featureSlug === 'promotions'
      ? plan.limits.max_promotions ?? plan.promotionsPerMonth
      : featureSlug === 'events'
      ? plan.limits.max_events ?? 1
      : featureSlug === 'images'
      ? plan.limits.max_images ?? 10
      : featureSlug === 'campaigns'
      ? plan.limits.max_campaigns ?? 0
      : 0;

  if (!limitAllows(limit, current + quantity)) {
    return {
      allowed: false,
      reason: `Quota excedida para “${featureSlug}”. Limite: ${limitAllows(limit, 0) ? 'ilimitado' : limit}, utilizado: ${current}.`,
      currentUsage: usage,
      plan,
      remaining: isUnlimited(limit) ? (limit ?? 'unlimited') : Math.max(0, Number(limit || 0) - current),
    };
  }

  const nextUsage: SubscriptionUsage = {
    ...usage,
    [quotaField as keyof SubscriptionUsage]: current + quantity,
    updatedAt: new Date().toISOString(),
  };

  return {
    allowed: true,
    currentUsage: nextUsage,
    plan,
    feature: featuresFind(featureSlug, []),
    remaining: isUnlimited(limit) ? (limit ?? 'unlimited') : Math.max(0, Number(limit || 0) - (current + quantity)),
  };
};

export const createUsageSnapshot = (business: Business, plans: SubscriptionPlan[] = []): SubscriptionUsage & { planId: string; planName: string; tier: string } => {
  const plan = resolvePlan(business, plans);
  const usage = getBusinessUsage(business);
  return {
    ...usage,
    planId: plan.id,
    planName: plan.name,
    tier: business.tier,
  };
};

export const getUsagePercent = (business: Business, featureSlug: string, plans: SubscriptionPlan[] = []): number | null => {
  const plan = resolvePlan(business, plans);
  const usage = getBusinessUsage(business);

  const limit =
    featureSlug === 'posts'
      ? plan.limits.max_posts ?? plan.postsPerMonth
      : featureSlug === 'promotions'
      ? plan.limits.max_promotions ?? plan.promotionsPerMonth
      : featureSlug === 'events'
      ? plan.limits.max_events ?? 1
      : featureSlug === 'images'
      ? plan.limits.max_images ?? 10
      : featureSlug === 'campaigns'
      ? plan.limits.max_campaigns ?? 0
      : null;

  if (limit === null || isUnlimited(limit)) return null;
  const used =
    featureSlug === 'posts'
      ? usage.postsUsed
      : featureSlug === 'promotions'
      ? usage.promotionsUsed
      : featureSlug === 'events'
      ? usage.eventsUsed
      : featureSlug === 'images'
      ? usage.imagesUsed
      : featureSlug === 'campaigns'
      ? usage.campaignsUsed
      : 0;

  const denominator = Math.max(1, Number(limit || 0));
  return Math.min(100, Math.round((used / denominator) * 100));
};

export const getUsageAlerts = (business: Business, plans: SubscriptionPlan[] = []): Array<{ featureSlug: string; percent: number; threshold: number; label: string }> => {
  const thresholds = [70, 90, 100];
  const featureSlugs = ['posts', 'promotions', 'events', 'images', 'campaigns'];
  const alerts: Array<{ featureSlug: string; percent: number; threshold: number; label: string }> = [];

  for (const slug of featureSlugs) {
    const percent = getUsagePercent(business, slug, plans);
    if (percent === null) continue;
    for (const threshold of thresholds) {
      if (percent >= threshold) {
        alerts.push({ featureSlug: slug, percent, threshold, label: `${slug} (${percent}%)` });
        break;
      }
    }
  }

  return alerts;
};

export const planIncludesFeature = (plan: SubscriptionPlan, slug: string, features: SubscriptionFeature[] = []): boolean => {
  return hasPlanFeature(plan, slug, features);
};

export const allPlanFeatures = (plan: SubscriptionPlan, features: SubscriptionFeature[] = []): SubscriptionFeature[] => {
  return getPlanFeatureSlugs(plan)
    .map((slug) => features.find((candidate) => candidate.slug === slug))
    .filter((feature): feature is SubscriptionFeature => Boolean(feature));
};

export const featuresForPlan = (plan: SubscriptionPlan, features: SubscriptionFeature[] = []): SubscriptionFeature[] => {
  return allPlanFeatures(plan, features);
};

export const getPlanByName = (plans: SubscriptionPlan[], nameOrId: string): SubscriptionPlan | undefined => {
  return plans.find((plan) => plan.id === nameOrId || plan.name === nameOrId || plan.slug === nameOrId);
};

export const getPlanByTier = (plans: SubscriptionPlan[], tier: SubscriptionPlan['legacyTier']): SubscriptionPlan | undefined => {
  return plans.find((plan) => plan.legacyTier === tier);
};

const featuresFind = (slug: string, features: SubscriptionFeature[]): SubscriptionFeature | undefined => {
  return features.find((candidate) => candidate.slug === slug) ?? undefined;
};
