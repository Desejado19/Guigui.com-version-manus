import type {
  Business,
  SubscriptionFeature,
  SubscriptionLimitValue,
  SubscriptionPlan,
  SubscriptionPlanChangePolicy,
  SubscriptionPlanVersion,
  SubscriptionTier,
  SubscriptionUsage,
} from '../types';

export const DEMO_NOW = '2026-08-28T00:00:00.000Z';
const now = DEMO_NOW;

export const DEFAULT_SUBSCRIPTION_FEATURES: SubscriptionFeature[] = [
  { id: 'feature-standard-profile', name: 'Ficha padrão', slug: 'standard_profile', description: 'Presença base no directório.', type: 'profile', isActive: true },
  { id: 'feature-expanded-profile', name: 'Ficha expandida', slug: 'expanded_profile', description: 'Galeria, contactos e apresentação ampliada.', type: 'profile', isActive: true },
  { id: 'feature-basic-statistics', name: 'Estatísticas simples', slug: 'basic_statistics', description: 'Visitas e interacções essenciais.', type: 'analytics', isActive: true },
  { id: 'feature-advanced-statistics', name: 'Estatísticas detalhadas', slug: 'advanced_statistics', description: 'Métricas detalhadas de alcance e conversão.', type: 'analytics', isActive: true },
  { id: 'feature-verified-badge', name: 'Badge Verificado', slug: 'verified_badge', description: 'Selo de confiança do directório.', type: 'profile', isActive: true },
  { id: 'feature-homepage-rotation', name: 'Rotação na homepage', slug: 'homepage_rotation', description: 'Possibilidade de aparecer nos destaques da página inicial.', type: 'marketing', isActive: true },
  { id: 'feature-search-priority', name: 'Prioridade na pesquisa', slug: 'search_priority', description: 'Maior prioridade de ordenação nos resultados.', type: 'marketing', isActive: true },
  { id: 'feature-account-manager', name: 'Gestor de conta', slug: 'account_manager', description: 'Acompanhamento comercial dedicado.', type: 'support', isActive: true },
  { id: 'feature-monthly-reports', name: 'Relatórios mensais', slug: 'monthly_reports', description: 'Relatório mensal estruturado.', type: 'analytics', isActive: true },
  { id: 'feature-exclusive-banner', name: 'Banner exclusivo', slug: 'exclusive_banner', description: 'Espaço de publicidade exclusivo.', type: 'marketing', isActive: true },
  { id: 'feature-custom-branding', name: 'Branding próprio', slug: 'custom_branding', description: 'Personalização visual da presença empresarial.', type: 'marketing', isActive: true },
  { id: 'feature-posts', name: 'Publicações', slug: 'posts', description: 'Criação de publicações empresariais.', type: 'content', isActive: true },
  { id: 'feature-promotions', name: 'Promoções', slug: 'promotions', description: 'Criação de promoções e campanhas comerciais.', type: 'commerce', isActive: true },
  { id: 'feature-events', name: 'Eventos', slug: 'events', description: 'Gestão de eventos culturais.', type: 'content', isActive: true },
  { id: 'feature-ticketing', name: 'Bilheteira', slug: 'ticketing', description: 'Venda e validação de bilhetes.', type: 'commerce', isActive: true },
  { id: 'feature-advertising', name: 'Publicidade', slug: 'advertising', description: 'Campanhas e anúncios.', type: 'marketing', isActive: true },
];

const plan = (
  legacyTier: SubscriptionTier,
  name: string,
  description: string,
  price: number,
  postsPerMonth: SubscriptionLimitValue,
  promotionsPerMonth: SubscriptionLimitValue,
  maxCategories: SubscriptionLimitValue,
  featureSlugs: string[],
  options: Partial<SubscriptionPlan> = {},
): SubscriptionPlan => ({
  id: `plan-${legacyTier}`,
  slug: legacyTier,
  name,
  description,
  price,
  currency: 'XOF',
  billingPeriod: 'monthly',
  postsPerMonth,
  promotionsPerMonth,
  maxCategories,
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
  featureSlugs,
  limits: {
    max_posts: postsPerMonth,
    max_promotions: promotionsPerMonth,
    max_categories: maxCategories,
    max_images: 10,
    max_events: 1,
    max_campaigns: 0,
  },
  badges: [],
  isActive: true,
  isPublic: true,
  version: 1,
  changePolicy: 'new_subscriptions',
  updatedAt: now,
  legacyTier,
  ...options,
});

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  plan('basic', 'Básico', 'Ficha padrão para presença essencial no directório.', 5000, 3, 0, 1, ['standard_profile', 'basic_statistics', 'posts'], { badges: ['Básico'] }),
  plan('professional', 'Profissional', 'Ficha expandida para negócios em crescimento.', 10000, 3, 1, 2, ['standard_profile', 'expanded_profile', 'advanced_statistics', 'verified_badge', 'posts', 'promotions'], { verifiedBadge: true, expandedProfile: true, advancedStatistics: true, badges: ['Verificado'] }),
  plan('premium', 'Premium', 'Maior visibilidade, relatórios e acompanhamento comercial.', 20000, 3, 4, 5, ['standard_profile', 'expanded_profile', 'advanced_statistics', 'verified_badge', 'homepage_rotation', 'search_priority', 'account_manager', 'monthly_reports', 'posts', 'promotions', 'events', 'ticketing'], { priorityLevel: 2, homepageRotation: true, verifiedBadge: true, expandedProfile: true, advancedStatistics: true, accountManager: true, monthlyReports: true, badges: ['Premium'] }),
  plan('enterprise', 'Enterprise', 'Condições empresariais personalizadas e contrato anual.', 0, 'unlimited', 'negotiated', 'unlimited', ['standard_profile', 'expanded_profile', 'advanced_statistics', 'verified_badge', 'homepage_rotation', 'search_priority', 'account_manager', 'monthly_reports', 'exclusive_banner', 'custom_branding', 'posts', 'promotions', 'events', 'ticketing', 'advertising'], { priorityLevel: 3, homepageRotation: true, verifiedBadge: true, expandedProfile: true, advancedStatistics: true, accountManager: true, monthlyReports: true, exclusiveBanner: true, customBranding: true, annualContract: true, customConditions: 'Preço e condições negociados com a Administração.', badges: ['Enterprise'] }),
];

export const DEFAULT_SUBSCRIPTION_PLAN_VERSIONS: SubscriptionPlanVersion[] = DEFAULT_SUBSCRIPTION_PLANS.map((snapshot) => ({
  id: `${snapshot.id}-v1`,
  planId: snapshot.id,
  version: 1,
  snapshot,
  changedBy: 'Sistema Guigui',
  changedAt: now,
  changePolicy: snapshot.changePolicy,
  changes: [],
}));

export const getPlanById = (plans: SubscriptionPlan[], planId?: string, tier?: SubscriptionTier): SubscriptionPlan => {
  return plans.find((candidate) => candidate.id === planId || candidate.slug === planId)
    || plans.find((candidate) => candidate.legacyTier === tier)
    || DEFAULT_SUBSCRIPTION_PLANS.find((candidate) => candidate.legacyTier === tier)
    || DEFAULT_SUBSCRIPTION_PLANS[0];
};

export const getBusinessPlan = (business: Business, plans: SubscriptionPlan[]): SubscriptionPlan => {
  return business.subscriptionPlanSnapshot || getPlanById(plans, business.planId, business.tier);
};

export const isUnlimited = (value: SubscriptionLimitValue | undefined): boolean => value === 'unlimited' || value === 'negotiated';

export const limitAllows = (limit: SubscriptionLimitValue | undefined, used: number): boolean => {
  if (isUnlimited(limit)) return true;
  return typeof limit === 'number' && used < limit;
};

export const limitLabel = (value: SubscriptionLimitValue | undefined): string => {
  if (value === 'unlimited') return 'Ilimitado';
  if (value === 'negotiated') return 'Negociado';
  return typeof value === 'number' ? String(value) : '—';
};

export const getPlanFeatureSlugs = (plan: SubscriptionPlan): string[] => {
  const legacyFlags: Array<[boolean, string]> = [
    [plan.homepageRotation, 'homepage_rotation'],
    [plan.verifiedBadge, 'verified_badge'],
    [plan.expandedProfile, 'expanded_profile'],
    [plan.advancedStatistics, 'advanced_statistics'],
    [plan.accountManager, 'account_manager'],
    [plan.monthlyReports, 'monthly_reports'],
    [plan.exclusiveBanner, 'exclusive_banner'],
    [plan.customBranding, 'custom_branding'],
  ];
  return Array.from(new Set([...plan.featureSlugs, ...legacyFlags.filter(([enabled]) => enabled).map(([, slug]) => slug)]));
};

export const hasPlanFeature = (plan: SubscriptionPlan, slug: string, features: SubscriptionFeature[] = DEFAULT_SUBSCRIPTION_FEATURES): boolean => {
  const feature = features.find((candidate) => candidate.slug === slug);
  return Boolean(feature?.isActive !== false && getPlanFeatureSlugs(plan).includes(slug));
};

export const getUsagePeriodKey = (date = new Date()): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const getBusinessUsage = (business: Business, nowDate = new Date()): SubscriptionUsage => {
  const currentKey = getUsagePeriodKey(nowDate);
  if (business.subscriptionUsage?.periodKey === currentKey) return business.subscriptionUsage;
  return { periodKey: currentKey, postsUsed: 0, promotionsUsed: 0, eventsUsed: 0, imagesUsed: 0, campaignsUsed: 0, updatedAt: nowDate.toISOString() };
};

export const getRemainingLimit = (limit: SubscriptionLimitValue | undefined, used: number): SubscriptionLimitValue => {
  if (isUnlimited(limit)) return limit || 'unlimited';
  return Math.max(0, Number(limit || 0) - used);
};

export const canCreatePost = (business: Business, plans: SubscriptionPlan[], features = DEFAULT_SUBSCRIPTION_FEATURES, nowDate = new Date()): boolean => {
  const planConfig = getBusinessPlan(business, plans);
  const usage = getBusinessUsage(business, nowDate);
  return hasPlanFeature(planConfig, 'posts', features) && limitAllows(planConfig.limits.max_posts ?? planConfig.postsPerMonth, usage.postsUsed);
};

export const canCreatePromotion = (business: Business, plans: SubscriptionPlan[], features = DEFAULT_SUBSCRIPTION_FEATURES, nowDate = new Date()): boolean => {
  const planConfig = getBusinessPlan(business, plans);
  const usage = getBusinessUsage(business, nowDate);
  return hasPlanFeature(planConfig, 'promotions', features) && limitAllows(planConfig.limits.max_promotions ?? planConfig.promotionsPerMonth, usage.promotionsUsed);
};

export const getPlanMonthlyPrice = (planConfig: SubscriptionPlan): number => planConfig.price;

export const getAnnualPlanPrice = (planConfig: SubscriptionPlan, annualDiscountPercent: number): number => {
  if (planConfig.price <= 0) return 0;
  return Math.round(planConfig.price * 12 * (1 - Math.max(0, Math.min(100, annualDiscountPercent)) / 100));
};

export const normaliseSubscriptionPlans = (plans?: SubscriptionPlan[]): SubscriptionPlan[] => {
  if (!plans || plans.length === 0) return DEFAULT_SUBSCRIPTION_PLANS;
  return plans.map((candidate) => ({
    ...DEFAULT_SUBSCRIPTION_PLANS.find((fallback) => fallback.id === candidate.id || fallback.legacyTier === candidate.legacyTier),
    ...candidate,
    featureSlugs: candidate.featureSlugs || [],
    limits: candidate.limits || {},
    badges: candidate.badges || [],
    version: candidate.version || 1,
    changePolicy: candidate.changePolicy || 'new_subscriptions',
  }));
};

export const buildPlanVersion = (planConfig: SubscriptionPlan, previous: SubscriptionPlan | undefined, changedBy: string, changePolicy: SubscriptionPlanChangePolicy): SubscriptionPlanVersion => {
  const changes = previous ? Object.keys(planConfig).filter((field) => JSON.stringify(previous[field as keyof SubscriptionPlan]) !== JSON.stringify(planConfig[field as keyof SubscriptionPlan])).map((field) => ({ field, oldValue: previous[field as keyof SubscriptionPlan], newValue: planConfig[field as keyof SubscriptionPlan] })) : [];
  return { id: `${planConfig.id}-v${planConfig.version}`, planId: planConfig.id, version: planConfig.version, snapshot: { ...planConfig, changePolicy }, changedBy, changedAt: new Date().toISOString(), changePolicy, changes };
};
