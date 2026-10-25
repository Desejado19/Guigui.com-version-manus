import type {
  Business,
  BusinessModelConfig,
  AdCampaign,
  CommercialPriceRule,
  CommercialProduct,
  ContentService,
  FeePayer,
  MonetizationCatalog,
  MonetizationLedgerEntry,
  MonetizationWallet,
  SubscriptionLimitValue,
  TicketFeePolicy,
} from '../types';

const INITIAL_DATE = '2026-08-28T00:00:00.000Z';

const priceRules = (productCode: string, items: Array<[number, number, string, number?]>): CommercialPriceRule[] => items.map(([quantity, price, label, durationDays]) => ({
  id: `${productCode}-${quantity}-${durationDays ?? 'unit'}`,
  label,
  quantity,
  price,
  currency: 'XOF',
  durationDays,
  isActive: true,
}));

const product = (input: Omit<CommercialProduct, 'version' | 'createdAt' | 'updatedAt'>): CommercialProduct => ({
  ...input,
  version: 1,
  createdAt: INITIAL_DATE,
  updatedAt: INITIAL_DATE,
});

export const DEFAULT_MONETIZATION_CATALOG: MonetizationCatalog = {
  currency: 'XOF',
  version: 1,
  updatedAt: INITIAL_DATE,
  ticketFeePolicy: {
    commissionPercentage: 10,
    fixedFee: 200,
    currency: 'XOF',
    feePayer: 'organizer',
    billingModel: 'percentage_plus_fixed',
    updatedAt: INITIAL_DATE,
  },
  extraConsumptionOrder: 'included_first',
  products: [
    product({ id: 'product-post-extra', code: 'POST_EXTRA', name: 'Post extra', description: 'Publicação adicional acima da quota do plano.', type: 'extra_posts', unit: 'post', basePrice: 5000, currency: 'XOF', billingModel: 'one_time', quantity: 1, priceRules: priceRules('post-extra', [[1, 5000, '+1 post'], [5, 8000, '+5 posts'], [10, 15000, '+10 posts'], [25, 30000, '+25 posts']]), requiresQuote: false, isActive: true, isPublic: true, configuration: { creditType: 'posts' } }),
    product({ id: 'product-promotion-extra', code: 'PROMOTION_EXTRA', name: 'Promoção extra', description: 'Promoção adicional acima da quota do plano.', type: 'extra_promotions', unit: 'promotion', basePrice: 10000, currency: 'XOF', billingModel: 'one_time', quantity: 1, priceRules: priceRules('promotion-extra', [[1, 10000, '+1 promoção'], [5, 40000, '+5 promoções'], [10, 75000, '+10 promoções']]), requiresQuote: false, isActive: true, isPublic: true, configuration: { creditType: 'promotions' } }),
    product({ id: 'product-homepage-banner', code: 'HOMEPAGE_BANNER', name: 'Banner rotativo na homepage', description: 'Exibição premium numa posição publicitária da homepage.', type: 'advertising', unit: 'week', basePrice: 50000, currency: 'XOF', billingModel: 'per_day', periodDays: 7, priceRules: priceRules('homepage-banner', [[1, 50000, '7 dias', 7], [1, 80000, '30 dias', 30]]), requiresQuote: false, isActive: true, isPublic: true, configuration: { placement: 'homepage_top' } }),
    product({ id: 'product-week-promotion', code: 'WEEK_PROMOTION', name: 'Promoção da Semana', description: 'Destaque comercial de duração limitada.', type: 'advertising', unit: 'week', basePrice: 30000, currency: 'XOF', billingModel: 'per_week', periodDays: 7, priceRules: priceRules('week-promotion', [[1, 30000, '7 dias', 7]]), requiresQuote: false, isActive: true, isPublic: true, configuration: { placement: 'promotion_of_week' } }),
    product({ id: 'product-push-campaign', code: 'PUSH_CAMPAIGN', name: 'Campanha de notificações push', description: 'Campanha segmentada sujeita a consentimento e limites.', type: 'push_campaign', unit: 'campaign', basePrice: 50000, currency: 'XOF', billingModel: 'quote', periodDays: 3, priceRules: priceRules('push-campaign', [[1, 50000, 'Campanha de 3 dias', 3]]), requiresQuote: true, isActive: true, isPublic: true, configuration: { maxRecipients: 1000, segments: ['restaurantes', 'familias', 'turismo'], consentRequired: true } }),
    product({ id: 'product-ticket-fee', code: 'TICKET_FEE', name: 'Taxa de bilheteira', description: 'Comissão e taxa fixa aplicadas conforme a política do evento.', type: 'ticket_fee', unit: 'ticket', basePrice: 0, currency: 'XOF', billingModel: 'percentage_plus_fixed', priceRules: [], requiresQuote: false, isActive: true, isPublic: false }),
  ],
  adPlacements: [
    { id: 'placement-homepage-top', code: 'homepage_top', name: 'Topo da homepage', description: 'Destaque superior da página inicial.', position: 'top', format: 'banner', productId: 'product-homepage-banner', maxConcurrent: 1, isAvailable: true, isActive: true, updatedAt: INITIAL_DATE },
    { id: 'placement-homepage-middle', code: 'homepage_middle', name: 'Centro da homepage', description: 'Espaço entre blocos de descoberta.', position: 'middle', format: 'card', maxConcurrent: 3, isAvailable: true, isActive: true, updatedAt: INITIAL_DATE },
    { id: 'placement-homepage-banner', code: 'homepage_banner', name: 'Banner de homepage', description: 'Faixa publicitária de maior dimensão.', position: 'banner', format: 'wide_banner', productId: 'product-homepage-banner', maxConcurrent: 1, isAvailable: true, isActive: true, updatedAt: INITIAL_DATE },
    { id: 'placement-promotion-week', code: 'promotion_of_week', name: 'Promoção da Semana', description: 'Posição editorial para promoção semanal.', position: 'featured', format: 'promotion', productId: 'product-week-promotion', maxConcurrent: 1, isAvailable: true, isActive: true, updatedAt: INITIAL_DATE },
    { id: 'placement-business-listing', code: 'business_listing', name: 'Destaque no directório', description: 'Maior visibilidade nos resultados do directório.', position: 'listing', format: 'business_card', maxConcurrent: 10, isAvailable: true, isActive: true, updatedAt: INITIAL_DATE },
    { id: 'placement-search-featured', code: 'search_featured', name: 'Prioridade na pesquisa', description: 'Resultado destacado em pesquisa.', position: 'search', format: 'business_card', maxConcurrent: 10, isAvailable: true, isActive: true, updatedAt: INITIAL_DATE },
    { id: 'placement-push', code: 'push_notification', name: 'Notificação push segmentada', description: 'Campanhas para públicos que deram consentimento.', position: 'notification', format: 'push', productId: 'product-push-campaign', maxConcurrent: 3, isAvailable: true, isActive: true, updatedAt: INITIAL_DATE },
  ],
  contentServices: [
    { id: 'service-photography', name: 'Fotografia profissional', description: 'Sessão fotográfica para a presença empresarial.', category: 'photography', basePrice: 0, currency: 'XOF', duration: 'A combinar', requiresQuote: true, isActive: true, createdAt: INITIAL_DATE, updatedAt: INITIAL_DATE },
    { id: 'service-copywriting', name: 'Redacção de conteúdo', description: 'Texto comercial, legendas e organização editorial.', category: 'writing', basePrice: 0, currency: 'XOF', duration: 'A combinar', requiresQuote: true, isActive: true, createdAt: INITIAL_DATE, updatedAt: INITIAL_DATE },
    { id: 'service-photo-copy', name: 'Fotografia + redacção', description: 'Pacote de fotografia e copywriting.', category: 'photography', basePrice: 0, currency: 'XOF', duration: 'A combinar', requiresQuote: true, isActive: true, createdAt: INITIAL_DATE, updatedAt: INITIAL_DATE },
    { id: 'service-video', name: 'Vídeo promocional', description: 'Produção de vídeo curto para divulgação.', category: 'video', basePrice: 0, currency: 'XOF', duration: 'A combinar', requiresQuote: true, isActive: true, createdAt: INITIAL_DATE, updatedAt: INITIAL_DATE },
    { id: 'service-management', name: 'Gestão de publicação', description: 'Acompanhamento editorial e publicação assistida.', category: 'management', basePrice: 0, currency: 'XOF', duration: 'Mensal ou projecto', requiresQuote: true, isActive: true, createdAt: INITIAL_DATE, updatedAt: INITIAL_DATE },
  ],
  adCampaigns: [
    { id: 'campaign-welcome-bissau', businessId: 'biz-1', businessName: 'Restaurante Coqueiros Bissau', productCode: 'HOMEPAGE_BANNER', placementCode: 'homepage_top', title: 'Sabores de Bissau no Restaurante Coqueiros', description: 'Descubra o menu local e reserve a sua mesa.', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80', linkUrl: '#directory', audience: 'all', startsAt: INITIAL_DATE, endsAt: '2027-12-31T23:59:59.000Z', priority: 10, impressions: 0, clicks: 0, isActive: true, createdAt: INITIAL_DATE, updatedAt: INITIAL_DATE },
  ],
};

export const normaliseMonetizationCatalog = (catalog?: MonetizationCatalog, legacyConfig?: Partial<BusinessModelConfig>): MonetizationCatalog => {
  const base = catalog || DEFAULT_MONETIZATION_CATALOG;
  const products = base.products.map((candidate) => {
    const priceRulesWithStableIds = candidate.priceRules.map((rule) => ({
      ...rule,
      id: `${candidate.code.toLowerCase()}-${rule.quantity}-${rule.durationDays ?? 'unit'}`,
    }));
    if (candidate.code === 'POST_EXTRA' && typeof legacyConfig?.extraPostPriceXOF === 'number') return { ...candidate, basePrice: legacyConfig.extraPostPriceXOF, priceRules: priceRulesWithStableIds.map((rule) => rule.quantity === 1 ? { ...rule, price: legacyConfig.extraPostPriceXOF } : rule) };
    if (candidate.code === 'PROMOTION_EXTRA' && typeof legacyConfig?.extraPromotionPriceXOF === 'number') return { ...candidate, basePrice: legacyConfig.extraPromotionPriceXOF, priceRules: priceRulesWithStableIds.map((rule) => rule.quantity === 1 ? { ...rule, price: legacyConfig.extraPromotionPriceXOF } : rule) };
    if (candidate.code === 'HOMEPAGE_BANNER' && typeof legacyConfig?.bannerWeeklyPriceXOF === 'number') return { ...candidate, basePrice: legacyConfig.bannerWeeklyPriceXOF, priceRules: priceRulesWithStableIds.map((rule) => rule.durationDays === 7 ? { ...rule, price: legacyConfig.bannerWeeklyPriceXOF } : rule) };
    return { ...candidate, priceRules: priceRulesWithStableIds };
  });
  const legacyFee: TicketFeePolicy = {
    ...base.ticketFeePolicy,
    commissionPercentage: typeof legacyConfig?.ticketCommissionPercent === 'number' ? legacyConfig.ticketCommissionPercent : base.ticketFeePolicy.commissionPercentage,
    fixedFee: typeof legacyConfig?.ticketFixedFeeXOF === 'number' ? legacyConfig.ticketFixedFeeXOF : base.ticketFeePolicy.fixedFee,
    updatedAt: base.updatedAt,
  };
  return { ...base, products, ticketFeePolicy: legacyFee };
};

export const getCommercialProduct = (catalog: MonetizationCatalog, codeOrId: string): CommercialProduct | undefined => catalog.products.find((item) => item.code === codeOrId || item.id === codeOrId);

export const getActiveCommercialProducts = (catalog: MonetizationCatalog): CommercialProduct[] => catalog.products.filter((item) => item.isActive);

export const getActiveAdCampaigns = (catalog: MonetizationCatalog, now = new Date()): AdCampaign[] => (catalog.adCampaigns || []).filter((campaign) => campaign.isActive && Date.parse(campaign.startsAt) <= now.getTime() && Date.parse(campaign.endsAt) > now.getTime() && catalog.adPlacements.some((placement) => placement.code === campaign.placementCode && placement.isActive && placement.isAvailable)).sort((a, b) => b.priority - a.priority || Date.parse(b.startsAt) - Date.parse(a.startsAt));

export const getPriceRule = (productConfig: CommercialProduct, quantity = 1, durationDays?: number): CommercialPriceRule | undefined => {
  const candidates = productConfig.priceRules.filter((rule) => rule.isActive && rule.quantity === quantity && (!durationDays || rule.durationDays === durationDays));
  return candidates[0] || productConfig.priceRules.find((rule) => rule.isActive && rule.quantity === quantity) || productConfig.priceRules.find((rule) => rule.isActive && rule.quantity <= quantity);
};

export const resolveProductPrice = (catalog: MonetizationCatalog, codeOrId: string, quantity = 1, durationDays?: number): number => {
  const productConfig = getCommercialProduct(catalog, codeOrId);
  if (!productConfig || !productConfig.isActive || productConfig.requiresQuote) return 0;
  return getPriceRule(productConfig, quantity, durationDays)?.price ?? productConfig.basePrice * quantity;
};

export const calculateTicketFees = (catalog: MonetizationCatalog, ticketPrice: number, quantity = 1, policyOverride?: Partial<TicketFeePolicy>) => {
  const policy = { ...catalog.ticketFeePolicy, ...policyOverride };
  const grossTicketValue = Math.max(0, ticketPrice) * Math.max(0, quantity);
  const percentageFee = policy.billingModel === 'fixed_only' ? 0 : Math.round(grossTicketValue * Math.max(0, policy.commissionPercentage) / 100);
  const fixedFee = policy.billingModel === 'percentage_only' ? 0 : Math.max(0, policy.fixedFee) * Math.max(0, quantity);
  const platformRevenue = percentageFee + fixedFee;
  const buyerShare = policy.feePayer === 'buyer' ? platformRevenue : policy.feePayer === 'split' ? Math.ceil(platformRevenue / 2) : 0;
  const organizerShare = policy.feePayer === 'organizer' ? platformRevenue : policy.feePayer === 'split' ? Math.floor(platformRevenue / 2) : 0;
  const buyerTotal = grossTicketValue + buyerShare;
  return { grossTicketValue, percentageFee, fixedFee, platformRevenue, buyerShare, organizerShare, buyerTotal, organizerNet: grossTicketValue - organizerShare, feePayer: policy.feePayer, currency: policy.currency };
};

export const getWallet = (business: Business): MonetizationWallet => business.monetizationWallet || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0, updatedAt: new Date().toISOString() };

export const getRemainingCredits = (included: SubscriptionLimitValue | undefined, usedIncluded: number, purchased: number, usedExtra: number) => ({ includedRemaining: included === 'unlimited' || included === 'negotiated' ? included : Math.max(0, Number(included || 0) - usedIncluded), extraRemaining: Math.max(0, purchased - usedExtra), totalRemaining: included === 'unlimited' || included === 'negotiated' ? included : Math.max(0, Number(included || 0) - usedIncluded) + Math.max(0, purchased - usedExtra) });

export const consumeCredit = (included: SubscriptionLimitValue | undefined, usedIncluded: number, wallet: MonetizationWallet, kind: 'posts' | 'promotions', order: 'included_first' | 'extra_first' = 'included_first') => {
  const includedLimit = included === 'unlimited' || included === 'negotiated' ? included : Number(included || 0);
  const purchasedKey = kind === 'posts' ? 'postsExtraPurchased' : 'promotionsExtraPurchased';
  const usedKey = kind === 'posts' ? 'postsExtraUsed' : 'promotionsExtraUsed';
  const includedAvailable = includedLimit === 'unlimited' || includedLimit === 'negotiated' ? true : usedIncluded < includedLimit;
  const extraAvailable = wallet[usedKey] < wallet[purchasedKey];
  const consumeIncluded = order === 'included_first' ? includedAvailable : !extraAvailable && includedAvailable;
  if (!consumeIncluded && !extraAvailable) return { ok: false, source: 'none' as const, wallet };
  if (consumeIncluded) return { ok: true, source: 'included' as const, wallet };
  return { ok: true, source: 'extra' as const, wallet: { ...wallet, [usedKey]: wallet[usedKey] + 1, updatedAt: new Date().toISOString() } };
};

export const createLedgerEntry = (input: Omit<MonetizationLedgerEntry, 'id' | 'createdAt' | 'netAmount'>): MonetizationLedgerEntry => ({ ...input, id: `LEDGER-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, createdAt: new Date().toISOString(), netAmount: input.grossAmount - input.platformFee });

export const contentServiceToProduct = (service: ContentService): CommercialProduct => product({ id: service.id, code: `SERVICE_${service.id.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`, name: service.name, description: service.description, type: 'content_service', unit: 'service', basePrice: service.basePrice, currency: service.currency, billingModel: service.requiresQuote ? 'quote' : 'one_time', priceRules: [], requiresQuote: service.requiresQuote, isActive: service.isActive, isPublic: true });

export const getProductLabel = (productConfig: CommercialProduct): string => `${productConfig.name} (${productConfig.currency})`;

export const getFeePayerLabel = (feePayer: FeePayer): string => feePayer === 'buyer' ? 'Cliente/comprador' : feePayer === 'organizer' ? 'Organizador/empresa' : 'Dividido';
