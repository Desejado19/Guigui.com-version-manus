/**
 * Guigui.com - Escopo Técnico e Funcional Types
 */

export type UserRole = 'user' | 'business' | 'admin';
export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  phone: string;
  neighborhood: string;
  avatarUrl: string;
  businessId?: string; // Connected business if role is business
  businessName?: string;
  teamRole?: BusinessTeamRole;
  teamPermissions?: BusinessTeamMember['permissions'];
  /** Acesso granular por módulo quando a conta é de colaborador. */
  teamAccess?: TeamModuleAccess;
  jobTitle?: string;
  accessStatus?: 'active' | 'pending' | 'suspended' | 'disabled';
  /** Acesso administrativo por módulo para membros da equipa da plataforma. */
  adminAccess?: TeamModuleAccess;
  privacySettings?: {
    privateProfile: boolean;
    sessionAlerts: boolean;
    secureMessages: boolean;
    dataPersonalization: boolean;
  };
  ticketPreference?: 'digital' | 'both';
  communicationPreference?: 'email' | 'sms' | 'both';
  /** Idioma preferido guardado na conta; aplicado em qualquer dispositivo após login. */
  preferredLanguage?: Language;
  passwordChangedAt?: string;

  /** Dados de subscrição de utilizador para publicação de Stories (opcional; só entra em vigor após pagamento). */
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPaymentId?: string;
  subscriptionRenewDate?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionPlanId?: string;
}

export type Language = 'pt' | 'fr' | 'en' | 'es';
export type LocaleCode = 'pt-BR' | 'en' | 'fr' | 'es';

export type SubscriptionTier = 'basic' | 'professional' | 'premium' | 'enterprise';

export type SubscriptionLimitValue = number | 'unlimited' | 'negotiated';
export type SubscriptionBillingPeriod = 'monthly' | 'annual' | 'custom';
export type SubscriptionPlanChangePolicy = 'new_subscriptions' | 'next_renewal' | 'immediate';

export interface SubscriptionFeature {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: 'profile' | 'analytics' | 'content' | 'commerce' | 'marketing' | 'support' | 'custom';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: SubscriptionBillingPeriod;
  postsPerMonth: SubscriptionLimitValue;
  promotionsPerMonth: SubscriptionLimitValue;
  maxCategories: SubscriptionLimitValue;
  priorityLevel: number;
  homepageRotation: boolean;
  verifiedBadge: boolean;
  expandedProfile: boolean;
  advancedStatistics: boolean;
  accountManager: boolean;
  monthlyReports: boolean;
  exclusiveBanner: boolean;
  customBranding: boolean;
  annualContract: boolean;
  customConditions?: string;
  featureSlugs: string[];
  limits: Record<string, SubscriptionLimitValue>;
  badges: string[];
  isActive: boolean;
  isPublic: boolean;
  version: number;
  changePolicy: SubscriptionPlanChangePolicy;
  updatedAt: string;
  legacyTier?: SubscriptionTier;
}

export interface SubscriptionPlanVersion {
  id: string;
  planId: string;
  version: number;
  snapshot: SubscriptionPlan;
  changedBy: string;
  changedAt: string;
  changePolicy: SubscriptionPlanChangePolicy;
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
}

export interface SubscriptionUsage {
  periodKey: string;
  postsUsed: number;
  promotionsUsed: number;
  eventsUsed: number;
  imagesUsed: number;
  campaignsUsed: number;
  updatedAt: string;
}

export type CategoryGroupId = 
  | 'restauracao'
  | 'hotelaria_saude_educacao'
  | 'corporativo_financeiro'
  | 'ongs_artesãos'
  | 'servicos_profissionais';

export interface CategoryGroup {
  id: CategoryGroupId;
  name: string;
  description: string;
  prices: Record<SubscriptionTier, number>; // in XOF (Francos CFA)
}

export interface PriceAuditLogItem {
  id: string;
  date: string;
  categoryGroup: string;
  tier: SubscriptionTier;
  oldPrice: number;
  newPrice: number;
  updatedBy: string;
}

export interface BusinessModelConfig {
  ticketCommissionPercent: number; // e.g. 10%
  ticketFixedFeeXOF: number; // e.g. 200 XOF per ticket
  extraPostPriceXOF: number; // e.g. 5000 XOF per extra post (cross-tier rule)
  extraPromotionPriceXOF: number; // e.g. 10000 XOF per extra promotion
  bannerWeeklyPriceXOF: number; // e.g. 50000 XOF per premium banner/week
  annualDiscountPercent: number; // e.g. 15% discount for annual payment
  includedPostsPerMonth: number; // Compatibilidade com configurações antigas
  automaticSubscriptionSuspensionEnabled?: boolean; // Admin-controlled expiry lock
  subscriptionPlans?: SubscriptionPlan[];
  subscriptionFeatures?: SubscriptionFeature[];
  subscriptionPlanVersions?: SubscriptionPlanVersion[];
  monetizationCatalog?: MonetizationCatalog;
}

export type CommercialProductType =
  | 'extra_posts'
  | 'extra_promotions'
  | 'advertising'
  | 'push_campaign'
  | 'content_service'
  | 'ticket_fee'
  | 'future_directory'
  | 'data_api'
  | 'other';

export type CommercialBillingModel = 'one_time' | 'per_day' | 'per_week' | 'per_month' | 'percentage_plus_fixed' | 'quote';
export type CommercialProductUnit = 'post' | 'promotion' | 'day' | 'week' | 'month' | 'campaign' | 'service' | 'ticket' | 'package';
export type FeePayer = 'buyer' | 'organizer' | 'split';
export type ExtraConsumptionOrder = 'included_first' | 'extra_first';

export interface CommercialPriceRule {
  id: string;
  label: string;
  quantity: number;
  price: number;
  currency: string;
  durationDays?: number;
  isActive: boolean;
}

export interface CommercialProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  type: CommercialProductType;
  unit: CommercialProductUnit;
  basePrice: number;
  currency: string;
  billingModel: CommercialBillingModel;
  periodDays?: number;
  quantity?: number;
  priceRules: CommercialPriceRule[];
  requiresQuote: boolean;
  isActive: boolean;
  isPublic: boolean;
  version: number;
  configuration?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdCampaign {
  id: string;
  businessId?: string;
  businessName?: string;
  productCode: string;
  placementCode: string;
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  audience?: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  impressions: number;
  clicks: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdPlacement {
  id: string;
  code: string;
  name: string;
  description: string;
  position: string;
  format: string;
  productId?: string;
  maxConcurrent: number;
  isAvailable: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface ContentService {
  id: string;
  name: string;
  description: string;
  category: 'photography' | 'writing' | 'video' | 'management' | 'other';
  basePrice: number;
  currency: string;
  duration?: string;
  requiresQuote: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponCode {
  id: string;
  code: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  maxRedemptions?: number;
  redeemedCount: number;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonetizationCatalogVersion {
  id: string;
  version: number;
  changedBy: string;
  changedAt: string;
  reason: string;
  changedAreas: string[];
}

export interface TicketFeePolicy {
  commissionPercentage: number;
  fixedFee: number;
  currency: string;
  feePayer: FeePayer;
  billingModel: 'percentage_plus_fixed' | 'percentage_only' | 'fixed_only';
  updatedAt: string;
}

export interface TicketFeeSnapshot {
  /** Momento em que a taxa foi calculada (compra do bilhete). */
  calculatedAt: string;
  commissionPercentage: number;
  fixedFeeXOF: number;
  billingModel: TicketFeePolicy['billingModel'];
  feePayer: FeePayer;
  currency: string;
  grossTicketValueXOF: number;
  percentageFeeXOF: number;
  fixedFeeAmountXOF: number;
  platformFeeXOF: number;
  buyerShareXOF: number;
  organizerShareXOF: number;
  buyerTotalXOF: number;
  organizerNetXOF: number;
}

export interface MonetizationWallet {
  postsExtraPurchased: number;
  promotionsExtraPurchased: number;
  postsExtraUsed: number;
  promotionsExtraUsed: number;
  updatedAt: string;
}

export interface MonetizationLedgerEntry {
  id: string;
  transactionId?: string;
  businessId?: string;
  userId?: string;
  productId: string;
  productCode: string;
  description: string;
  quantity: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MonetizationCatalog {
  currency: string;
  products: CommercialProduct[];
  adPlacements: AdPlacement[];
  contentServices: ContentService[];
  adCampaigns?: AdCampaign[];
  ticketFeePolicy: TicketFeePolicy;
  extraConsumptionOrder: ExtraConsumptionOrder;
  version: number;
  updatedAt: string;
  coupons?: CouponCode[];
  history?: MonetizationCatalogVersion[];
}

export interface BusinessCategory {
  id: string;
  name: string;
  iconName: string;
  groupId: CategoryGroupId;
  subcategories: string[];
}

export interface CategoryGroupSummary {
  id: string;
  name: string;
  description: string;
}

export interface CategoryCatalogResponse {
  groups: CategoryGroupSummary[];
  categories: BusinessCategory[];
}

export type QualitativeScore = 'nao_gostei' | 'gostei' | 'gostei_muito' | 'muito_bom';

export interface Review {
  id: string;
  businessId: string;
  authorName: string;
  authorPhone: string; // obfuscated for public display
  qualitativeScore: QualitativeScore;
  comment?: string;
  createdAt: string;
  verifiedSms: boolean;
  ownerReply?: string;
  status: 'approved' | 'pending' | 'flagged';
  flagReason?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  likesCount?: number;
  parentId?: string;
  replies?: PostComment[];
}

export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface BusinessPost {
  id: string;
  businessId: string;
  businessName: string;
  businessLogo?: string;
  title: string;
  content: string;
  imageUrl?: string;
  mediaType?: 'image' | 'video' | 'gallery' | 'text';
  videoUrl?: string; // mp4, webm, youtube, direct embed
  mediaGallery?: string[]; // Multiple photos
  isPlanSubscriberPost?: boolean;
  planBadge?: string; // e.g. "Plano Ouro", "Plano Profissional", "Verificado VIP"
  videoDuration?: string;
  createdAt: string;
  status: 'approved' | 'pending_moderation' | 'rejected' | 'scheduled' | 'publishing' | 'failed' | 'cancelled' | 'expired';
  scheduledAt?: string;
  publishedAt?: string;
  schedulingError?: string;
  moderationReason?: string;
  likesCount?: number;
  reactions?: {
    like?: number;
    love?: number;
    haha?: number;
    wow?: number;
    sad?: number;
    angry?: number;
  };
  userReaction?: ReactionType;
  comments?: PostComment[];
  sharesCount?: number;
  neighborhood?: string;
}

export interface StoryElement {
  id: string;
  type: 'text' | 'emoji' | 'sticker' | 'poll' | 'question' | 'quiz' | 'countdown'
    | 'link' | 'mention' | 'hashtag' | 'location' | 'music' | 'cta';
  content: Record<string, any>;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  zIndex: number;
  pollCounts?: number[];
  viewerOptionIndex?: number | null;
  responseCount?: number;
}

export interface Story {
  id: string;
  ownerUserId?: string;
  ownerRole?: 'business' | 'admin';
  businessId: string;
  businessName: string;
  businessLogo: string;
  imageUrl?: string;
  mediaUrl?: string;
  storyType?: 'image' | 'video' | 'text';
  caption?: string;
  /** Botão de ação opcional dentro do visualizador (ex.: "Ver oferta"). */
  actionLabel?: string;
  actionUrl?: string;
  createdAt: string;
  isUnread?: boolean;
  /** IDs dos utilizadores que já viram esta story (estado visto por pessoa). */
  seenBy?: string[];
  comments?: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
  }>;
  durationMs?: number;
  backgroundColor?: string;
  visibility?: 'public' | 'limited';
  status?: 'draft' | 'active' | 'expired' | 'removed' | 'suspended';
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  moderationReason?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  shareToken?: string;
  publishedAt?: string | null;
  expiresAt?: string | null;
  archivedAt?: string | null;
  elements?: StoryElement[];
  counts?: {
    views: number; uniqueViews: number; likes: number; reactions: number; replies: number;
    pollVotes: number; questionResponses: number; shares: number; engagementRate: number;
  };
  viewer?: {
    viewed: boolean;
    liked: boolean;
    reaction?: string | null;
    pollVotes: Record<string, number>;
  };
}

export interface Promotion {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  discountBadge: string; // e.g. "-20%", "2 por 1", "Menu Executivo 3500 XOF"
  validUntil: string; // ISO String
  code?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  mediaGallery?: string[];
  categoryName: string;
  neighborhood: string;
  isActive: boolean;
  status?: 'draft' | 'pending_moderation' | 'scheduled' | 'active' | 'failed' | 'cancelled' | 'expired';
  scheduledAt?: string;
  startsAt?: string;
  activatedAt?: string;
  schedulingError?: string;
  clicksCount: number;
}

export type ScheduledItemStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled' | 'expired';

export interface ScheduledItem {
  id: string;
  businessId: string;
  ownerUserId?: string;
  itemType: 'post' | 'promotion' | 'campaign' | 'event' | 'reminder' | string;
  itemId: string;
  label?: string;
  description?: string;
  scheduledAt: string;
  timezone: string;
  status: ScheduledItemStatus;
  attempts: number;
  lastAttemptAt?: string;
  publishedAt?: string;
  errorMessage?: string;
  moderationStatus?: 'approved' | 'pending_moderation' | 'rejected';
  paymentStatus?: 'not_required' | 'paid' | 'pending' | 'failed';
  campaignId?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MarketingCampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'archived';

export interface MarketingCampaign {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  objective?: 'awareness' | 'engagement' | 'traffic' | 'conversions' | 'sales';
  audienceSegmentId?: string;
  contentIds: string[];
  channels: Array<'guigui' | 'social' | 'sms' | 'email' | 'banner'>;
  startsAt?: string;
  endsAt?: string;
  budgetXOF?: number;
  spentXOF?: number;
  status: MarketingCampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingAudienceSegment {
  id: string;
  businessId: string;
  name: string;
  location?: string;
  minAge?: number;
  maxAge?: number;
  interests: string[];
  estimatedReach?: number;
  createdAt: string;
}

export interface MarketingLibraryAsset {
  id: string;
  businessId: string;
  name: string;
  type: 'image' | 'video' | 'banner' | 'logo' | 'document';
  url: string;
  sourceId?: string;
  usedBy: string[];
  archived?: boolean;
  createdAt: string;
}

export type BusinessProfileNotApplicableField =
  | 'address'
  | 'openingHours'
  | 'publicEmail'
  | 'whatsapp'
  | 'website'
  | 'socialLinks'
  | 'serviceLanguages';

export interface Business {
  id: string;
  name: string;
  slug: string;
  logo: string;
  coverImage: string;
  gallery: string[];
  description: string;
  categoryId: string;
  subcategoryId: string;
  groupGroupId: CategoryGroupId;
  category?: string;
  rating?: number;
  tier: SubscriptionTier;
  planId?: string;
  planName?: string;
  subscriptionPlanVersion?: number;
  subscriptionPlanSnapshot?: SubscriptionPlan;
  subscriptionUsage?: SubscriptionUsage;
  neighborhood: string; // e.g., 'Bandim', 'Bissau Velho', 'Praça', 'Santa Luzia', 'Chapa', 'Cuntum'
  address: string;
  phone: string;
  whatsapp: string;
  email?: string;
  publicEmail?: string;
  website?: string;
  openingHours: string;
  notApplicableFields?: BusinessProfileNotApplicableField[];
  homepageFeaturedOrder?: number | null;
  isOpenNow: boolean;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  status: 'active' | 'pending' | 'suspended' | 'rejected';
  ownerName?: string;
  /** Data de registo na plataforma (ISO), fornecida pela base de dados. */
  createdAt?: string;
  features?: string[];
  products?: Array<{ id: string; name: string; category: string; priceXOF: number; isAvailable: boolean }>;
  verified: boolean;
  featured: boolean;
  ratingLabel: string; // Calculated qualitative predominant label e.g., "Muito Bom"
  reviewsCount: number;
  reviews: Review[];
  posts: BusinessPost[];
  promotions: Promotion[];
  socialLinks?: {
    facebook?: string;
    instagram?: string;
  };
  /** Idiomas em que o negócio consegue atender clientes (exibido no perfil público). */
  serviceLanguages?: Language[];
  metrics: {
    views: number;
    whatsappClicks: number;
    phoneClicks: number;
    directionsClicks: number;
    websiteClicks: number;
  };
  subscriptionRenewDate: string;
  subscriptionPeriod?: 'monthly' | 'annual';
  subscriptionStartedAt?: string;
  subscriptionStatus?: 'active' | 'expired' | 'suspended';
  subscriptionPaymentId?: string;
  subscriptionAlertKeys?: string[];
  subscriptionSuspendedAt?: string;
  subscriptionSuspensionReason?: string;
  subscriptionAutoSuspended?: boolean;
  postsQuotaRemaining: number;
  monetizationWallet?: MonetizationWallet;
}

export type BusinessTeamRole = 'manager' | 'editor' | 'finance' | 'support';

/** Mapa de módulos → acções concedidas (ver `config/teamAccess`). */
export type TeamModuleAccess = import('./config/teamAccess').TeamModuleAccess;
export type TeamAction = import('./config/teamAccess').TeamAction;

export type TeamAccessStatus = 'invited' | 'pending' | 'active' | 'suspended' | 'disabled';

export interface BusinessTeamMember {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone?: string;
  role: BusinessTeamRole | string;
  status: TeamAccessStatus;
  /** Permissões legadas mantidas para compatibilidade com contas antigas. */
  permissions: {
    profile: boolean;
    content: boolean;
    events: boolean;
    tickets: boolean;
    billing: boolean;
  };
  /** Acesso granular por módulo. Ausente em contas antigas. */
  access?: TeamModuleAccess;
  jobTitle?: string;
  createdAt: string;
  lastActiveAt?: string;
}

export interface BusinessTeamAuditEntry {
  id: string;
  businessId: string;
  memberName: string;
  action: string;
  createdAt: string;
}

export interface EventTicketType {
  id: string;
  name: string; // e.g., "Normal", "VIP", "Mesa 4 Pessoas"
  priceXOF: number;
  availableQuantity: number;
  soldQuantity: number;
}

export type ReminderTimeframe = 'immediate_test' | 'at_start' | '1h_before' | '24h_before' | '3d_before';

export interface EventReminder {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventNeighborhood: string;
  eventCover: string;
  organizerName: string;
  timeframe: ReminderTimeframe;
  createdAt: string;
  notified: boolean;
  userPhone?: string;
  smsNotified?: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  organizerName: string;
  businessId?: string;
  category: string;
  date: string;
  time: string;
  location: string;
  neighborhood: string;
  coverImage: string;
  mediaType?: 'image' | 'video';
  description: string;
  status: 'active' | 'draft' | 'cancelled' | 'ended';
  organizer?: string;
  ticketTypes: EventTicketType[];
  totalTicketsSold: number;
  totalRevenueXOF: number;
  scannerDoorCode: string; // Password code for door scanner team
}

export interface Ticket {
  id: string;
  ticketCode: string; // Short human readable code e.g. "GUI-8821"
  eventId: string;
  eventTitle: string;
  ticketTypeName: string;
  priceXOF: number;
  buyerName: string;
  buyerPhone: string;
  holderName?: string;
  holderPhone?: string;
  qrToken: string;
  pinCode: string; // 4-digit security PIN sent via SMS
  status: 'pending' | 'valid' | 'used';
  purchasedAt: string;
  expiresAt?: string;
  validatedAt?: string;
  paymentMethod: 'orange_money' | 'telecel' | 'manual_admin';
  /** Taxa de bilheteira aplicada no momento da compra. */
  fee?: TicketFeeSnapshot;
}

export interface PurchaseOrder {
  id: string;
  orderCode: string; // e.g., "LEV-8942"
  qrToken: string;
  businessId: string;
  businessName: string;
  buyerId?: string;
  eventId?: string;
  ticketPin?: string;
  customerName: string;
  customerPhone: string;
  holderName?: string;
  holderPhone?: string;
  itemType: 'ticket' | 'product' | 'promotion' | 'service';
  itemTitle: string;
  quantity: number;
  totalPriceXOF: number;
  paymentMethod: string;
  purchasedAt: string;
  status: 'pending' | 'valid' | 'redeemed' | 'cancelled';
  /** Taxa de bilheteira aplicada no momento da compra. */
  fee?: TicketFeeSnapshot;
  redeemedAt?: string;
  redeemedBy?: string;
  /** Credenciais individuais quando quantity > 1; o primeiro mantém qrToken/ticketPin por compatibilidade. */
  ticketCredentials?: Array<{ id: string; ticketCode: string; qrToken: string; pinCode?: string; holderName?: string; holderPhone?: string; buyerName?: string; ticketTypeName?: string; status?: Ticket['status'] }>;
}

export interface ModerationResult {
  status: 'verde' | 'amarelo' | 'vermelho';
  reason: string;
  confidence: number;
  detectedCategories?: string[];
  suggestedAction: 'approve' | 'flag_for_human_review' | 'reject';
  isCriouloLanguage?: boolean;
}

export interface ModerationAuditLog {
  timestamp: string;
  action: 'auto_classified' | 'human_approved' | 'human_rejected' | 'appealed_by_user' | 'sensitivity_updated' | 'appeal_simulated';
  actor: string; // 'Sistema IA', 'Admin Moderador', 'Autor'
  notes?: string;
}

export interface ModerationLogItem {
  id: string;
  businessName?: string;
  authorName: string;
  authorPhone?: string;
  type: 'post' | 'review' | 'promotion' | 'business_profile';
  contentSnippet: string;
  imageUrl?: string;
  result: ModerationResult;
  status: 'pending_human' | 'approved' | 'rejected' | 'appealed';
  appealReason?: string;
  createdAt: string;
  reviewedByHuman?: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  auditTrail: ModerationAuditLog[];
}

export interface ModerationSettings {
  languageCautionEnabled: boolean; // Sec. 9.3: Default at least 'Amarelo' for Crioulo
  sensitivityLevel: 'strict' | 'standard' | 'relaxed';
  autoApproveGreenThreshold: number; // e.g. 85%
  autoRejectRedThreshold: number; // e.g. 90%
}

// Section 10: Integração de Pagamentos Interfaces
export type PaymentMethod = 'orange_money' | 'telecel';
export type HistoricalPaymentMethod = PaymentMethod | 'manual_transfer';

/** Pedido de levantamento (payout) criado pela empresa e decidido na administração. */
export interface PayoutRequest {
  id: string;
  businessId: string;
  amountXOF: number;
  method: 'orange_money' | 'manual_transfer';
  accountRef?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

export type PaymentUseCase =
  | 'subscription_initial'
  | 'subscription_renewal'
  | 'extra_posts'
  | 'extra_promotions'
  | 'event_tickets'
  | 'event_refund'
  | 'extra_credit_purchase'
  | 'advertising_purchase'
  | 'content_service_request';

export type PaymentStatus =
  | 'pending_provider'
  | 'pending_manual_confirmation'
  | 'confirmed_api'
  | 'confirmed_manual'
  | 'reconciled'
  | 'refunded'
  | 'failed';

export interface PaymentTransaction {
  id: string; // e.g., "TXN-2026-9812"
  useCase: PaymentUseCase;
  useCaseLabel: string; // e.g., "Subscrição Plano Profissional (1 ano)"
  businessId?: string;
  businessName?: string;
  payerName: string;
  payerPhone: string;
  amountXOF: number;
  provider: HistoricalPaymentMethod;
  providerRef?: string; // e.g. "OM-98213-BS"
  status: PaymentStatus;
  isApiIntegrationReady: boolean; // false during onboarding; true when a live adapter is configured
  providerMode?: 'manual' | 'simulated' | 'sandbox' | 'live';
  subscriptionInterval?: 'monthly' | 'annual';
  subscriptionStartedAt?: string;
  subscriptionRenewDate?: string;
  checkoutUrl?: string;
  paymentInstructions?: string;
  manualProofReference?: string; // SMS transfer code or bank reference entered
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  refundedAt?: string;
  refundReason?: string;
  productId?: string;
  productCode?: string;
  eventName?: string;
  quantity?: number;
}

export interface MobileOperatorConfig {
  id: PaymentMethod;
  name: string; // "Orange Money", "Telecel (Teletaco)"
  shortName: string;
  dedicatedPhone: string; // "+245 955 00 00", "+245 966 00 00"
  status: 'negotiating_api' | 'sandbox_testing' | 'live_api';
  onboardingWindow: string; // "2 a 4 meses"
  supportsAutoPushOtp: boolean;
  activeTransactionsCount: number;
  totalVolumeXOF: number;
}

// Centralized Notifications Types
export type NotificationTargetRole = 'all' | 'user' | 'business' | 'admin';
export type NotificationRecipientType = 'USER' | 'BUSINESS' | 'ADMIN';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent' | 'info' | 'success' | 'attention' | 'critical';
export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';
export type NotificationEntityType = 'user' | 'business' | 'event' | 'ticket' | 'payment' | 'order' | 'post' | 'promotion' | 'review' | 'conversation' | 'support' | 'system';
export type NotificationEventType =
  | 'WELCOME'
  | 'EMAIL_CONFIRMED'
  | 'PHONE_CONFIRMED'
  | 'PASSWORD_CHANGED'
  | 'LOGIN_SUSPICIOUS'
  | 'MULTIPLE_LOGIN_ATTEMPTS'
  | 'BUSINESS_CREATED'
  | 'BUSINESS_REPORTED'
  | 'DOCUMENTS_SUBMITTED'
  | 'BUSINESS_APPROVED'
  | 'BUSINESS_REJECTED'
  | 'DOCUMENTS_REQUIRED'
  | 'POST_APPROVED'
  | 'POST_REJECTED'
  | 'POST_NEEDS_CHANGES'
  | 'POST_SUBMITTED'
  | 'FOLLOWED_BUSINESS_POST'
  | 'FAVORITE_PROMOTION'
  | 'FOLLOWED_BUSINESS_EVENT'
  | 'EVENT_SUBMITTED'
  | 'EVENT_APPROVED'
  | 'EVENT_REJECTED'
  | 'EVENT_REPORTED'
  | 'REVIEW_REPORTED'
  | 'EVENT_REMINDER'
  | 'EVENT_CHANGED'
  | 'EVENT_CANCELLED'
  | 'EVENT_VIEWS_MILESTONE'
  | 'TICKET_PURCHASED'
  | 'TICKET_AVAILABLE'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'NEW_CONTACT'
  | 'NEW_SUPPORT_REQUEST'
  | 'NEW_REVIEW'
  | 'NEW_MESSAGE'
  | 'STORY_COMMENT'
  | 'SUPPORT_REPLY'
  | 'BACKUP_COMPLETED'
  | 'BACKUP_FAILED'
  | 'SMS_UNAVAILABLE'
  | 'API_ERRORS'
  | 'ANOMALOUS_REFUNDS'
  | 'SYSTEM_FEATURE'
  | 'ADMIN_ANNOUNCEMENT';

export type NotificationCategory =
  | 'system'
  | 'account'
  | 'business_approval'
  | 'moderation'
  | 'order_redemption'
  | 'billing'
  | 'event_reminder'
  | 'event'
  | 'review'
  | 'followed_business'
  | 'promotion'
  | 'messages'
  | 'support'
  | 'stats'
  | 'security'
  | 'admin_alert';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  targetRole: NotificationTargetRole;
  targetBusinessId?: string;
  targetUserId?: string;
  recipientId?: string;
  recipientType?: NotificationRecipientType;
  eventType?: NotificationEventType;
  entityType?: NotificationEntityType;
  entityId?: string;
  category: NotificationCategory;
  read: boolean;
  createdAt: string;
  timeAgo?: string;
  linkTab?: string;
  actionLabel?: string;
  priority?: NotificationPriority;
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  categories: Partial<Record<NotificationCategory, boolean>>;
  channels: Partial<Record<NotificationChannel, boolean>>;
  language?: Language;
  theme?: 'light' | 'dark';
  notificationsEnabled?: boolean;
  newPosts?: boolean;
  comments?: boolean;
  mentions?: boolean;
  weeklyDigest?: boolean;
}

export type ConversationParticipantType = 'person' | 'business' | 'event' | 'organizer';
export type ConversationMessageType = 'text' | 'image' | 'document' | 'link' | 'shared_content';
export type ConversationMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  id: string;
  userId: string;
  userName?: string;
  businessId: string;
  businessName?: string;
  subject: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
  unreadForUser?: boolean;
  unreadForBusiness?: boolean;
  pinned?: boolean;
  participantType?: ConversationParticipantType;
  participantOnline?: boolean;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'user' | 'business';
  senderName?: string;
  text: string;
  createdAt: string;
  readByUser?: boolean;
  readByBusiness?: boolean;
  type?: ConversationMessageType;
  status?: ConversationMessageStatus;
  clientMessageId?: string;
  replyToId?: string;
  reactions?: Record<string, string[]>;
  attachmentName?: string;
  attachmentUrl?: string;
  sharedContent?: { kind: 'business' | 'event' | 'post'; id: string; title: string; imageUrl?: string; subtitle?: string };
}

export interface SupportReply {
  id: string;
  senderId: string;
  senderRole: 'user' | 'business' | 'admin';
  text: string;
  createdAt: string;
}

export type SupportCategory = 'account' | 'payments' | 'tickets' | 'technical' | 'business_report' | 'other';

export interface SupportRequest {
  id: string;
  requesterId: string;
  userId?: string;
  requesterRole: 'user' | 'business';
  businessId?: string;
  subject: string;
  description: string;
  category?: SupportCategory;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
  lastReply?: string;
  replies?: SupportReply[];
}

export type NotificationPreferencesStore = Record<string, NotificationPreferences>;

// Admin Staff Management Types
export type AdminPermissionKey =
  | 'manageBusinesses'
  | 'manageUsers'
  | 'contentModeration'
  | 'manageContent'
  | 'manageEvents'
  | 'manageSubscriptions'
  | 'manageAdvertising'
  | 'financialAudit'
  | 'manageAdmins'
  | 'viewAuditLogs'
  | 'exportReports'
  | 'managePricing'
  | 'manageCategories'
  | 'manageSupport'
  | 'manageSecurity'
  | 'manageBackups'
  | 'validateTickets';

export type AdminDepartment =
  | 'Diretoria Executiva'
  | 'Moderação & Conteúdo'
  | 'Financeiro & Contabilidade'
  | 'Suporte & Operações'
  | 'Comercial & Parcerias'
  | 'TI & Infraestrutura';

export type AdminAccessLevel =
  | 'super_admin'
  | 'moderator'
  | 'finance_manager'
  | 'support_agent'
  | 'events_coordinator';

export interface AdminStaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: AdminDepartment;
  accessLevel: AdminAccessLevel;
  status: 'active' | 'suspended' | 'revoked';
  avatarUrl?: string;
  permissions: Partial<Record<AdminPermissionKey, boolean>> & {
    manageBusinesses: boolean;
    contentModeration: boolean;
    financialAudit: boolean;
    manageAdmins: boolean;
    viewAuditLogs: boolean;
    exportReports: boolean;
    managePricing: boolean;
    validateTickets: boolean;
  };
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  createdBy: string;
}

// Audit Logs Types
export type AuditLogCategory =
  | 'business'
  | 'moderation'
  | 'financial'
  | 'admin_management'
  | 'security'
  | 'ticket_redemption'
  | 'system';

export type AuditSeverity = 'info' | 'warning' | 'critical' | 'security';

export interface AuditChangeDetail {
  field: string;
  fieldLabel: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  actionLabel: string;
  category: AuditLogCategory;
  severity: AuditSeverity;
  targetEntity: string;
  targetId?: string;
  ipAddress: string;
  deviceInfo: string;
  details: string;
  changes?: AuditChangeDetail[];
}
