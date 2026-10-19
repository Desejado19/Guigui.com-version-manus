import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Tag,
  CreditCard,
  Sparkles,
  Eye,
  MessageCircle,
  Phone,
  ArrowUpRight,
  ShieldCheck,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Percent,
  Smartphone,
  Check,
  Award,
  MessageSquare,
  Flag,
  Table,
  Edit2,
  Save,
  Ticket,
  DollarSign,
  History,
  RefreshCw,
  Sliders,
  Download,
  Layers,
  Settings,
  QrCode,
  Search,
  Zap,
  CheckCircle,
  AlertCircle,
  Package,
  Loader2,
  Clock,
  X,
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Calendar,
  ShoppingBag,
  Receipt,
  Filter,
  Printer,
  FileSpreadsheet,
  User,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  FileDown,
  Crown,
  Star,
  Video,
  Image as ImageIcon,
  Play,
  Plus,
  Building2,
  Bell,
  Users,
  Megaphone,
  Palette,
  Globe,
  KeyRound,
  LifeBuoy,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { QRCodeDisplay } from './QRCodeDisplay';
import { ClientBusinessProfile } from './client/ClientBusinessProfile';
import { ClientEventsManagement } from './client/ClientEventsManagement';
import { SoldTicketsPanel } from './SoldTicketsPanel';
import { ClientNotificationsHub } from './client/ClientNotificationsHub';
import { ClientSettingsHub } from './client/ClientSettingsHub';
import { ClientExportHub } from './client/ClientExportHub';
import { CommunicationHub } from './CommunicationHub';
import {
  Business,
  BusinessPost,
  Promotion,
  Language,
  ModerationResult,
  CategoryGroup,
  BusinessModelConfig,
  PriceAuditLogItem,
  SubscriptionTier,
  PurchaseOrder,
  EventItem,
  AppNotification,
  Conversation,
  ConversationMessage,
  SupportRequest,
  SupportCategory,
  UserProfile,
  NotificationPreferences,
  SubscriptionPlan,
  MonetizationCatalog,
  MonetizationWallet,
  ContentService,
  BusinessTeamMember,
  BusinessTeamAuditEntry,
  BusinessTeamRole,
  MarketingCampaign,
  MarketingAudienceSegment,
  MarketingLibraryAsset,
} from '../types';
import { getLanguageShortLabel, getNextLanguage, getTranslation } from '../utils/i18n';
import { QUALITATIVE_SCORE_LABELS, calculateBusinessRating, getQualitativeScoreLabel } from '../utils/reviews';
import { usePersistentState } from '../utils/persistentState';
import { DEFAULT_SUBSCRIPTION_PLANS, getAnnualPlanPrice, getBusinessPlan, getBusinessUsage, getPlanById, limitLabel, normaliseSubscriptionPlans } from '../data/subscriptionCatalog';
import { DEFAULT_MONETIZATION_CATALOG, getCommercialProduct, getPriceRule, normaliseMonetizationCatalog, resolveProductPrice } from '../data/monetizationCatalog';
import { addSubscriptionPeriod, getSubscriptionAccessState, getSubscriptionRemainingMs, getSubscriptionTierLabel, shouldBlockBusinessMutation } from '../utils/subscriptions';
import { BUSINESS_ROLE_PERMISSIONS, BUSINESS_TAB_PERMISSIONS, hasBusinessPermission } from '../utils/businessPermissions';
import { usePageEntryScroll } from '../utils/navigationBehavior';
import { Badge, Button, Card, EmptyState, IconButton, Panel, PanelHeader } from './ui';
import { ChartFrame } from './charts/ChartFrame';
import { ChartTooltip } from './charts/ChartTooltip';
import { chartColors } from './charts/chartTheme';
import type { ScheduledItem } from '../types';
import { BUSINESS_NAVIGATION } from '../config/navigation';

const readLocalMediaFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!/^image\/(jpeg|png|webp|gif)|^video\/(mp4|webm|quicktime)$/.test(file.type)) {
    reject(new Error('Formato n�o suportado. Use imagem JPG/PNG/WebP/GIF ou v�deo MP4/WebM.'));
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    reject(new Error('O ficheiro excede o limite de 25 MB da vers�o de demonstra��o.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('N�o foi poss�vel ler o ficheiro local.'));
  reader.readAsDataURL(file);
});

export type BusinessDashboardTab =
  | 'overview'
  | 'my_business'
  | 'posts'
  | 'promotions'
  | 'events'
  | 'tickets'
  | 'analytics'
  | 'billing'
  | 'pricing'
  | 'team'
  | 'notifications'
  | 'communications'
  | 'clients'
  | 'marketing'
  | 'support'
  | 'settings'
  | 'export'
  | 'reviews'
  | 'order_history'
  | 'redemptions'
  | 'marketing_campaigns'
  | 'marketing_calendar';

interface BusinessDashboardProps {
  business: Business;
  currentUser: UserProfile;
  businesses: Business[];
  followerCount?: number;
  audienceReach?: number;
  initialTab?: BusinessDashboardTab;
  currentLang: Language;
  currentThemeMode?: 'light' | 'dark' | 'auto';
  onLanguageChange?: (lang: Language) => void;
  onThemeModeChange?: (mode: 'light' | 'dark' | 'auto') => void;
  onAddPost: (businessId: string, post: BusinessPost) => void;
  onAddPromotion: (businessId: string, promo: Promotion) => void;
  onReplyReview?: (businessId: string, reviewId: string, replyText: string) => void;
  onFlagReview?: (businessId: string, reviewId: string, reason: string) => void;
  purchaseOrders?: PurchaseOrder[];
  events?: EventItem[];
  onValidatePurchaseOrder?: (orderId: string, redeemedBy: string) => void;
  onUpdateBusiness?: (updatedBiz: Business) => void;
  onEventSubmitted?: (event: EventItem) => void;
  onEventCancelled?: (event: EventItem) => void;
  notifications?: AppNotification[];
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onClearNotifications?: () => void;
  onNavigateNotificationTab?: (tab: string) => void;
  onOpenNotification?: (notification: AppNotification) => void;
  notificationPreferences?: NotificationPreferences;
  onNotificationPreferencesChange?: (next: NotificationPreferences) => void;
  conversations: Conversation[];
  conversationMessages: ConversationMessage[];
  supportRequests: SupportRequest[];
  onCreateConversation: (businessId: string, subject: string, text: string) => void;
  onSendMessage: (conversationId: string, text: string) => void;
  onCreateSupport: (subject: string, description: string, businessId?: string, category?: SupportCategory) => void;
  onReplySupport: (requestId: string, text: string) => void;
  onMarkConversationRead: (conversationId: string) => void;
  focusConversationId?: string | null;
  focusSupportId?: string | null;
  onActiveTabChange?: (tab: BusinessDashboardTab) => void;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

export const BusinessDashboard: React.FC<BusinessDashboardProps> = ({
  business,
  currentUser,
  businesses,
  followerCount = 0,
  audienceReach = 0,
  initialTab = 'overview',
  currentLang,
  currentThemeMode = 'auto',
  onLanguageChange,
  onThemeModeChange,
  onAddPost,
  onAddPromotion,
  onReplyReview,
  onFlagReview,
  purchaseOrders = [],
  events = [],
  onValidatePurchaseOrder,
  onUpdateBusiness,
  onEventSubmitted,
  onEventCancelled,
  notifications = [],
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onClearNotifications,
  onNavigateNotificationTab,
  onOpenNotification,
  notificationPreferences,
  onNotificationPreferencesChange,
  conversations,
  conversationMessages,
  supportRequests,
  onCreateConversation,
  onSendMessage,
  onCreateSupport,
  onReplySupport,
  onMarkConversationRead,
  focusConversationId,
  focusSupportId,
  onActiveTabChange,
  sidebarCollapsed: controlledSidebarCollapsed,
  onSidebarCollapsedChange,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);

  const [activeTab, setActiveTab] = useState<BusinessDashboardTab>('overview');
  const [selectedBusinessPost, setSelectedBusinessPost] = useState<BusinessPost | null>(null);
  const [marketingSection, setMarketingSection] = useState<
    'overview' | 'campaigns' | 'content' | 'audience' | 'calendar' | 'library' | 'budget' | 'reports'
  >('campaigns');
  const [marketingCampaigns, setMarketingCampaigns] = usePersistentState<MarketingCampaign[]>(`guigui_marketing_campaigns_${business.id}`, []);
  const [marketingSegments, setMarketingSegments] = usePersistentState<MarketingAudienceSegment[]>(`guigui_marketing_segments_${business.id}`, []);
  const [campaignName, setCampaignName] = useState('');
  const [campaignObjective, setCampaignObjective] = useState<MarketingCampaign['objective']>('awareness');
  const [campaignBudget, setCampaignBudget] = useState('');
  const [campaignChannels, setCampaignChannels] = useState<MarketingCampaign['channels']>(['guigui']);
  const [campaignAudienceId, setCampaignAudienceId] = useState('');
  const [campaignContentIds, setCampaignContentIds] = useState<string[]>([]);
  const [campaignStartsAt, setCampaignStartsAt] = useState('');
  const [campaignEndsAt, setCampaignEndsAt] = useState('');
  const [contentFilter, setContentFilter] = useState<'all' | 'posts' | 'promotions' | 'scheduled'>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | MarketingLibraryAsset['type']>('all');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  usePageEntryScroll(activeTab);
  useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);
  React.useEffect(() => {
    setOrderItemTypeFilter(activeTab === 'tickets' ? 'ticket' : 'all');
  }, [activeTab]);
  const [teamMembers, setTeamMembers] = usePersistentState<BusinessTeamMember[]>(`guigui_business_team_${business.id}`, []);
  const [teamAudit, setTeamAudit] = usePersistentState<BusinessTeamAuditEntry[]>(`guigui_business_team_audit_${business.id}`, []);
  const [teamName, setTeamName] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [teamRole, setTeamRole] = useState<BusinessTeamRole>('editor');
  const [teamNotice, setTeamNotice] = useState<string | null>(null);
  const can = (permission: keyof BusinessTeamMember['permissions']) => hasBusinessPermission(currentUser, business.id, teamMembers, permission);
  const canTab = (tab: BusinessDashboardTab) => {
    const permission = BUSINESS_TAB_PERMISSIONS[tab];
    return !permission || can(permission);
  };
  const denyPermission = (permission: keyof BusinessTeamMember['permissions']) => {
    if (can(permission)) return true;
    setTeamNotice('N�o tem permiss�o para executar esta opera��o.');
    return false;
  };
  const [internalSidebarCollapsed, setInternalSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('guigui-business-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const sidebarCollapsed = controlledSidebarCollapsed ?? internalSidebarCollapsed;
  const setSidebarCollapsed = (next: boolean | ((value: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(sidebarCollapsed) : next;
    if (controlledSidebarCollapsed === undefined) setInternalSidebarCollapsed(value);
    onSidebarCollapsedChange?.(value);
  };

  React.useEffect(() => {
    setActiveTab(canTab(initialTab as BusinessDashboardTab) ? initialTab : 'overview');
  }, [initialTab, teamMembers, currentUser.id, business.id]);
  React.useEffect(() => {
    if (!canTab(activeTab as BusinessDashboardTab)) setActiveTab('overview');
  }, [activeTab, teamMembers, currentUser.id, business.id]);

  React.useEffect(() => {
    if (activeTab === 'marketing' || activeTab === 'marketing_campaigns') setMarketingSection('campaigns');
    if (activeTab === 'marketing_calendar') setMarketingSection('calendar');
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem('guigui-business-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Ignore storage issues in restricted contexts.
    }
  }, [sidebarCollapsed]);
  useEffect(() => {
    onSidebarCollapsedChange?.(sidebarCollapsed);
  }, [onSidebarCollapsedChange, sidebarCollapsed]);

  const businessNavigationGroups: Array<{ heading: string; items: Array<{ label: string; tab: typeof activeTab; icon: React.ComponentType<{ className?: string }>; help: string; count?: number }> }> = [
    {
      heading: t('businessNavSummary'),
      items: [
        { label: t('businessNavOverview'), tab: 'overview', icon: LayoutDashboard, help: t('businessNavOverviewHelp') },
        { label: t('businessNavMyBusiness'), tab: 'my_business', icon: Building2, help: t('businessNavMyBusinessHelp') },
      ],
    },
    {
      heading: t('businessNavContent'),
      items: [
        { label: t('businessNavEvents'), tab: 'events', icon: Calendar, help: t('businessNavEventsHelp') },
        { label: t('businessNavReviews'), tab: 'reviews', icon: Star, help: t('businessNavReviewsHelp') },
        { label: 'Marketing', tab: 'marketing', icon: Megaphone, help: t('business.GerencieSuasCampanhas') },
      ],
    },
    {
      heading: t('businessNavSales'),
      items: [
        { label: t('businessNavTickets'), tab: 'tickets', icon: Ticket, help: t('businessNavTicketsHelp') },
        { label: t('business.orderHistory'), tab: 'order_history', icon: History, help: t('business.orderHistory') },
        { label: t('businessNavRedemptions'), tab: 'redemptions', icon: QrCode, help: t('businessNavRedemptionsHelp') },
        { label: t('businessNavClients'), tab: 'clients', icon: Users, help: t('businessNavClientsHelp') },
        { label: t('businessNavBilling'), tab: 'billing', icon: CreditCard, help: t('businessNavBillingHelp') },
        { label: t('business.teamPermissions'), tab: 'team', icon: Users, help: t('business.teamPermissions') },
      ],
    },
    {
      heading: t('businessNavSupport'),
      items: [
        { label: t('support'), tab: 'support', icon: LifeBuoy, help: t('businessNavSupportHelp') },
        { label: t('businessNavSecurity'), tab: 'settings', icon: KeyRound, help: t('businessNavSecurityHelp') },
        { label: t('businessNavExport'), tab: 'export', icon: Download, help: t('businessNavExportHelp') },
      ],
    },
  ];

  const currentBusinessSection = businessNavigationGroups.flatMap((group) => group.items).find((item) => item.tab === activeTab)?.label
    || BUSINESS_NAVIGATION[0].items[0].label;
  const isMarketingTab = activeTab === 'marketing' || activeTab === 'marketing_campaigns' || activeTab === 'posts' || activeTab === 'promotions' || activeTab === 'marketing_calendar';
  const businessEvents = events.filter((event) => event.businessId === business.id);
  const overviewEngagementData = [
    { name: t('business.Visualizacoes'), value: business.metrics.views, fill: '#2563eb' },
    { name: 'WhatsApp', value: business.metrics.whatsappClicks, fill: '#059669' },
    { name: t('business.Chamadas'), value: business.metrics.phoneClicks, fill: '#d97706' },
    { name: t('business.Mapa'), value: business.metrics.directionsClicks, fill: '#7c3aed' },
  ];
  const overviewActivityData = [
    { name: t('posts'), total: business.posts.length },
    { name: t('promotions'), total: business.promotions.length },
    { name: t('businessNavEvents'), total: businessEvents.length },
    { name: t('monetization.tabRequests'), total: purchaseOrders.filter((order) => order.businessId === business.id).length },
  ];
  const themeLabel = currentThemeMode === 'dark' ? t('business.Escuro') : currentThemeMode === 'light' ? t('business.Claro') : t('business.Auto');
  const nextThemeMode: 'light' | 'dark' | 'auto' = currentThemeMode === 'dark' ? 'light' : currentThemeMode === 'light' ? 'auto' : 'dark';
  const languageLabel = getLanguageShortLabel(currentLang);
  const nextLanguage: Language = getNextLanguage(currentLang);

  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'daily' | 'weekly'>('daily');
  const [analyticsMetric, setAnalyticsMetric] = useState<'revenue' | 'units'>('revenue');
  const [analyticsSubSection, setAnalyticsSubSection] = useState<'all' | 'views_clicks' | 'promotions' | 'sales'>('all');
  const [replyingToReviewId, setReplyingToReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Redemption & Validation State
  const [redemptionCodeInput, setRedemptionCodeInput] = useState('');
  const [redemptionFilter, setRedemptionFilter] = useState('');
  const [redemptionMessage, setRedemptionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedOrderForQr, setSelectedOrderForQr] = useState<PurchaseOrder | null>(null);

  // New Order History Sub-Section Filters & States
  const [orderDateFilter, setOrderDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [orderItemTypeFilter, setOrderItemTypeFilter] = useState<'all' | 'product' | 'promotion' | 'ticket' | 'service'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'redeemed' | 'cancelled'>('all');
  const [orderPaymentMethodFilter, setOrderPaymentMethodFilter] = useState<'all' | 'orange_money' | 'telecel' | 'cash'>('all');
  const [orderMinAmount, setOrderMinAmount] = useState<number | ''>('');
  const [orderMaxAmount, setOrderMaxAmount] = useState<number | ''>('');
  const [orderValuePreset, setOrderValuePreset] = useState<'all' | 'high_val' | 'very_high' | 'top_tier' | 'under_10k' | 'custom'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderSortBy, setOrderSortBy] = useState<'date_desc' | 'date_asc' | 'price_desc' | 'price_asc'>('date_desc');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<PurchaseOrder | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Instant Automated Subscription Upgrade State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [targetUpgradeTier, setTargetUpgradeTier] = useState<SubscriptionTier>('professional');
  const [targetUpgradePlanId, setTargetUpgradePlanId] = useState('plan-professional');
  const [upgradePaymentPhone, setUpgradePaymentPhone] = useState('955001122');
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Filter orders for this specific business
  const myBusinessOrders = purchaseOrders.filter((ord) => ord.businessId === business.id);

  // Filtered order history calculation
  const filteredOrderHistory = myBusinessOrders.filter((order) => {
    // 1. Date Filter
    if (orderDateFilter === 'today') {
      const orderDate = new Date(order.purchasedAt).toDateString();
      const today = new Date().toDateString();
      if (orderDate !== today) return false;
    } else if (orderDateFilter === '7days') {
      const orderTime = new Date(order.purchasedAt).getTime();
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (orderTime < sevenDaysAgo) return false;
    } else if (orderDateFilter === '30days') {
      const orderTime = new Date(order.purchasedAt).getTime();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (orderTime < thirtyDaysAgo) return false;
    } else if (orderDateFilter === 'custom') {
      const orderTime = new Date(order.purchasedAt).getTime();
      if (orderDateFrom) {
        const fromTime = new Date(orderDateFrom).getTime();
        if (orderTime < fromTime) return false;
      }
      if (orderDateTo) {
        const toTime = new Date(orderDateTo).setHours(23, 59, 59, 999);
        if (orderTime > toTime) return false;
      }
    }

    // 2. Item Type Filter
    if (orderItemTypeFilter !== 'all' && order.itemType !== orderItemTypeFilter) {
      return false;
    }

    // 3. Status Filter
    if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
      return false;
    }

    // 4. Payment Method Filter
    if (orderPaymentMethodFilter !== 'all') {
      if (orderPaymentMethodFilter === 'cash' && !['cash', 'no_local', 'local'].includes(order.paymentMethod.toLowerCase())) {
        return false;
      } else if (orderPaymentMethodFilter !== 'cash' && !order.paymentMethod.toLowerCase().includes(orderPaymentMethodFilter)) {
        return false;
      }
    }

    // 5. Price / Value Range Filter (Min & Max XOF)
    if (orderMinAmount !== '' && order.totalPriceXOF < Number(orderMinAmount)) {
      return false;
    }
    if (orderMaxAmount !== '' && order.totalPriceXOF > Number(orderMaxAmount)) {
      return false;
    }

    // 6. Search Text Filter
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim();
      const matchCode = order.orderCode?.toLowerCase().includes(q);
      const matchCustomer = order.customerName?.toLowerCase().includes(q);
      const matchPhone = order.customerPhone?.toLowerCase().includes(q);
      const matchItem = order.itemTitle?.toLowerCase().includes(q);
      const matchToken = order.qrToken?.toLowerCase().includes(q);
      if (!matchCode && !matchCustomer && !matchPhone && !matchItem && !matchToken) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    if (orderSortBy === 'date_asc') return new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime();
    if (orderSortBy === 'price_desc') return b.totalPriceXOF - a.totalPriceXOF;
    if (orderSortBy === 'price_asc') return a.totalPriceXOF - b.totalPriceXOF;
    return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
  });

  // KPI calculations for Order History
  const totalOrdersAmount = filteredOrderHistory.reduce(
    (acc, o) => acc + (o.status !== 'cancelled' ? o.totalPriceXOF : 0),
    0
  );
  const countRedeemed = filteredOrderHistory.filter((o) => o.status === 'redeemed').length;
  const countPending = filteredOrderHistory.filter((o) => o.status === 'pending').length;
  const countCancelled = filteredOrderHistory.filter((o) => o.status === 'cancelled').length;
  const countHighValue = filteredOrderHistory.filter((o) => o.totalPriceXOF >= 20000).length;
  const averageTicketValue = filteredOrderHistory.length > 0
    ? Math.round(totalOrdersAmount / filteredOrderHistory.length)
    : 0;

  const handleApplyValuePreset = (preset: 'all' | 'high_val' | 'very_high' | 'top_tier' | 'under_10k') => {
    setOrderValuePreset(preset);
    if (preset === 'all') {
      setOrderMinAmount('');
      setOrderMaxAmount('');
    } else if (preset === 'high_val') {
      setOrderMinAmount(20000);
      setOrderMaxAmount('');
    } else if (preset === 'very_high') {
      setOrderMinAmount(50000);
      setOrderMaxAmount('');
    } else if (preset === 'top_tier') {
      setOrderMinAmount(100000);
      setOrderMaxAmount('');
    } else if (preset === 'under_10k') {
      setOrderMinAmount('');
      setOrderMaxAmount(10000);
    }
  };

  const handleResetOrderFilters = () => {
    setOrderDateFilter('all');
    setOrderDateFrom('');
    setOrderDateTo('');
    setOrderItemTypeFilter('all');
    setOrderStatusFilter('all');
    setOrderPaymentMethodFilter('all');
    setOrderMinAmount('');
    setOrderMaxAmount('');
    setOrderValuePreset('all');
    setOrderSearchQuery('');
    setOrderSortBy('date_desc');
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleExportOrdersCsv = () => {
    if (filteredOrderHistory.length === 0) {
      alert('N�o h� pedidos correspondentes aos filtros selecionados para exportar.');
      return;
    }

    const headers = [
      'Codigo_Pedido',
      'Data_Compra',
      'Cliente_Nome',
      'Cliente_Telefone',
      'Tipo_Item',
      'Titulo_Item',
      'Quantidade',
      'Preco_Total_XOF',
      'Metodo_Pagamento',
      'Status_Pedido',
      'QR_Token',
      'Data_Levantamento',
    ];

    const rows = filteredOrderHistory.map((o) => [
      `"${o.orderCode}"`,
      `"${new Date(o.purchasedAt).toLocaleString('pt-PT')}"`,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerPhone}"`,
      `"${o.itemType}"`,
      `"${o.itemTitle.replace(/"/g, '""')}"`,
      o.quantity,
      o.totalPriceXOF,
      `"${o.paymentMethod}"`,
      `"${o.status}"`,
      `"${o.qrToken}"`,
      `"${o.redeemedAt ? new Date(o.redeemedAt).toLocaleString('pt-PT') : 'N/A'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pedidos_${business.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denyPermission('tickets')) return;
    setRedemptionMessage(null);
    const query = redemptionCodeInput.trim();
    if (!query) return;

    const found = myBusinessOrders.find(
      (o) =>
        o.orderCode?.toUpperCase() === query.toUpperCase() ||
        o.qrToken?.toUpperCase() === query.toUpperCase() ||
        o.id.toUpperCase() === query.toUpperCase()
    );

    if (!found) {
      setRedemptionMessage({
        text: t('business.searchEmpty', { query }),
        type: 'error',
      });
      return;
    }

    if (found.itemType !== 'ticket' || !found.eventId) {
      setRedemptionMessage({
        text: 'Este c�digo pertence a uma compra de produto, promo��o ou servi�o e n�o pode ser validado como bilhete.',
        type: 'error',
      });
      return;
    }

    const scopedEvent = events.find((event) => event.id === found.eventId && event.businessId === business.id);
    if (!scopedEvent) {
      setRedemptionMessage({ text: t('business.eventMissing'), type: 'error' });
      return;
    }

    try {
      const response = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeOrToken: query,
          doorCode: scopedEvent.scannerDoorCode,
          eventId: scopedEvent.id,
          businessId: business.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.valid) {
        setRedemptionMessage({
          text: result.message || 'O bilhete n�o foi validado pelo servidor.',
          type: result.status === 'already_used' ? 'info' : 'error',
        });
        return;
      }

      onValidatePurchaseOrder?.(found.id, business.name);
      setRedemptionMessage({
        text: `LEVANTAMENTO CONFIRMADO! Bilhete ${result.ticket?.ticketCode || found.orderCode} validado no servidor para ${found.customerName}.`,
        type: 'success',
      });
      setRedemptionCodeInput('');
    } catch {
      setRedemptionMessage({ text: 'N�o foi poss�vel contactar o servidor de valida��o.', type: 'error' });
    }
  };

  const handleExecuteAutomatedPlanUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denyPermission('billing')) return;
    if (!upgradePaymentPhone.trim()) {
      alert('Introduza o n�mero de telem�vel usado no pagamento.');
      return;
    }

    setIsUpgrading(true);
    try {
      const selectedPlan = getPlanById(normaliseSubscriptionPlans(subscriptionPlans), targetUpgradePlanId, targetUpgradeTier);
      const monthlyPrice = selectedPlan.price;
      if (monthlyPrice <= 0) {
        alert(t('business.planNegotiated'));
        return;
      }
      const selectedPlanAmount = isAnnualBilling
        ? Math.round(monthlyPrice * 12 * (1 - pricingConfig.annualDiscountPercent / 100))
        : monthlyPrice;
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: business.subscriptionStartedAt ? 'subscription_renewal' : 'subscription_initial',
          useCaseLabel: `${business.subscriptionStartedAt ? 'Renova��o' : 'Activa��o'} Plano ${targetUpgradeTier.toUpperCase()} (${isAnnualBilling ? '1 ano' : '1 m�s'})`,
          businessId: business.id,
          businessName: business.name,
          payerName: business.ownerName || business.name,
          payerPhone: upgradePaymentPhone.trim(),
          amountXOF: selectedPlanAmount,
          provider: selectedPaymentProvider === 'orange' ? 'orange_money' : 'telecel',
          subscriptionInterval: isAnnualBilling ? 'annual' : 'monthly',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.transaction) {
        throw new Error(data.error || 'O pagamento do upgrade n�o foi aceite.');
      }

      if (data.transaction.status !== 'confirmed_api' && data.transaction.status !== 'confirmed_manual' && data.transaction.status !== 'reconciled') {
        alert(`Pagamento registado (#${data.transaction.id}) e pendente de confirma��o. O plano s� ser� activado depois da confirma��o.`);
        return;
      }

      const confirmedAt = new Date().toISOString();
      const period = isAnnualBilling ? 'annual' : 'monthly';
      const renewDate = addSubscriptionPeriod(confirmedAt, period).toISOString();
      const updatedBiz: Business = {
        ...business,
          tier: selectedPlan.legacyTier || targetUpgradeTier,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          subscriptionPlanVersion: selectedPlan.version,
          subscriptionPlanSnapshot: selectedPlan,
          subscriptionUsage: { periodKey: new Date().toISOString().slice(0, 7), postsUsed: 0, promotionsUsed: 0, eventsUsed: 0, imagesUsed: 0, campaignsUsed: 0, updatedAt: confirmedAt },
          postsQuotaRemaining: selectedPlan.postsPerMonth === 'unlimited' || selectedPlan.postsPerMonth === 'negotiated' ? Number.MAX_SAFE_INTEGER : Number(selectedPlan.postsPerMonth || 0),
        verified: true,
        status: business.status === 'suspended' && !business.subscriptionAutoSuspended ? 'suspended' : 'active',
        subscriptionStatus: business.status === 'suspended' && !business.subscriptionAutoSuspended ? 'suspended' : 'active',
        subscriptionPeriod: period,
        subscriptionStartedAt: confirmedAt,
        subscriptionPaymentId: data.transaction.id,
        subscriptionRenewDate: renewDate,
        subscriptionAlertKeys: [],
        subscriptionSuspendedAt: undefined,
        subscriptionSuspensionReason: undefined,
        subscriptionAutoSuspended: false,
      };
      onUpdateBusiness?.(updatedBiz);
      setPostsQuota(selectedPlan.postsPerMonth === 'unlimited' || selectedPlan.postsPerMonth === 'negotiated' ? Number.MAX_SAFE_INTEGER : Number(selectedPlan.postsPerMonth || 0));
      setShowUpgradeModal(false);
      alert(`PLANO ${selectedPlan.name.toUpperCase()} ACTIVADO COM SUCESSO!\n\nPer�odo: ${isAnnualBilling ? 'anual' : 'mensal'}. Pr�xima renova��o: ${new Date(renewDate).toLocaleDateString('pt-PT')}. Limites configurados: ${limitLabel(selectedPlan.postsPerMonth)} posts e ${limitLabel(selectedPlan.promotionsPerMonth)} promo��es por m�s.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('business.upgradeFailed'));
    } finally {
      setIsUpgrading(false);
    }
  };

  // Configurable Business Model & Price Matrix State (4.1, 4.2, 4.3)
  const [subscriptionPlans, setSubscriptionPlans] = usePersistentState<SubscriptionPlan[]>('guigui_subscription_plans', DEFAULT_SUBSCRIPTION_PLANS);
  const availableSubscriptionPlans = normaliseSubscriptionPlans(subscriptionPlans).filter((plan) => plan.isActive && plan.isPublic);
  const currentPlan = getBusinessPlan(business, normaliseSubscriptionPlans(subscriptionPlans));
  const currentUsage = getBusinessUsage(business);

  const [extraPostQuantity, setExtraPostQuantity] = useState(1);
  const [extraPromotionQuantity, setExtraPromotionQuantity] = useState(1);
  const [pricingConfig, setPricingConfig] = usePersistentState<BusinessModelConfig>('guigui_admin_business_model_config', {
    ticketCommissionPercent: 10,
    ticketFixedFeeXOF: 200,
    extraPostPriceXOF: 5000,
    extraPromotionPriceXOF: 10000,
    bannerWeeklyPriceXOF: 50000,
    annualDiscountPercent: 15,
    includedPostsPerMonth: 3,
    automaticSubscriptionSuspensionEnabled: true,
  });
  const [monetizationCatalog] = usePersistentState<MonetizationCatalog>('guigui_monetization_catalog', DEFAULT_MONETIZATION_CATALOG);
  const resolvedMonetizationCatalog = normaliseMonetizationCatalog(monetizationCatalog, pricingConfig);
  const postExtraProduct = getCommercialProduct(resolvedMonetizationCatalog, 'POST_EXTRA');
  const promotionExtraProduct = getCommercialProduct(resolvedMonetizationCatalog, 'PROMOTION_EXTRA');
  const postExtraPrice = resolveProductPrice(resolvedMonetizationCatalog, 'POST_EXTRA', extraPostQuantity);
  const promotionExtraPrice = resolveProductPrice(resolvedMonetizationCatalog, 'PROMOTION_EXTRA', extraPromotionQuantity);

  const [categoryGroupsList, setCategoryGroupsList] = usePersistentState<CategoryGroup[]>('guigui_admin_category_groups', [
    {
      id: 'restauracao',
      name: 'Restaura��o, Caf�s e Pequeno Com�rcio',
      description: 'Restaurantes, bares, lanchonetes, padarias, pequenas lojas de bairro',
      prices: { basic: 10000, professional: 25000, premium: 45000, enterprise: 85000 },
    },
    {
      id: 'hotelaria_saude_educacao',
      name: 'Hotelaria, Cl�nicas, Escolas e Com�rcio M�dio',
      description: 'Hot�is, pousadas, cl�nicas m�dicas, escolas privadas, supermercados',
      prices: { basic: 15000, professional: 35000, premium: 65000, enterprise: 120000 },
    },
    {
      id: 'corporativo_financeiro',
      name: 'Bancos, Seguradoras, Telecoms e Constru��o',
      description: 'Institui��es financeiras, operadoras telem�vel, concession�rias, construtoras',
      prices: { basic: 35000, professional: 75000, premium: 150000, enterprise: 300000 },
    },
    {
      id: 'ongs_artesãos',
      name: 'ONGs, Associa��es e Artes�os Local',
      description: 'Organiza��es comunit�rias, artes�os de Bissau, cooperativas culturais',
      prices: { basic: 5000, professional: 12000, premium: 25000, enterprise: 50000 },
    },
    {
      id: 'servicos_profissionais',
      name: 'Servi�os Profissionais e Consultoria',
      description: 'Escrit�rios de advocacia, contabilidade, oficinas, consultores independentes',
      prices: { basic: 12000, professional: 28000, premium: 50000, enterprise: 95000 },
    },
  ]);

  const [editingCell, setEditingCell] = useState<{
    groupId: string;
    tier: SubscriptionTier;
    price: number;
  } | null>(null);

  const [priceAuditLogs, setPriceAuditLogs] = useState<PriceAuditLogItem[]>([
    {
      id: 'audit-2026-101',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      categoryGroup: 'Restaura��o, Caf�s e Pequeno Com�rcio',
      tier: 'professional',
      oldPrice: 20000,
      newPrice: 25000,
      updatedBy: 'Admin da Empresa / ' + (business.ownerName || business.name),
    },
    {
      id: 'audit-2026-102',
      date: '2026-08-01 11:20',
      categoryGroup: 'Bancos, Seguradoras, Telecoms e Constru��o',
      tier: 'enterprise',
      oldPrice: 280000,
      newPrice: 300000,
      updatedBy: 'Administra��o Guigui',
    },
  ]);

  const [saveToast, setSaveToast] = useState<string | null>(null);

  const handleSaveCellPrice = (groupId: string, tier: SubscriptionTier, newPrice: number) => {
    const group = categoryGroupsList.find((g) => g.id === groupId);
    if (!group) return;

    const oldPrice = group.prices[tier];

    setCategoryGroupsList((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            prices: {
              ...g.prices,
              [tier]: newPrice,
            },
          };
        }
        return g;
      })
    );

    const newLog: PriceAuditLogItem = {
      id: `audit-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      categoryGroup: group.name,
      tier,
      oldPrice,
      newPrice,
      updatedBy: 'Gestor / ' + (business.ownerName || business.name),
    };

    setPriceAuditLogs((prev) => [newLog, ...prev]);
    setEditingCell(null);
    setSaveToast(`Pre�o do escal�o ${tier.toUpperCase()} atualizado para ${newPrice.toLocaleString('pt-PT')} XOF!`);
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleUpdateConfigParam = (key: keyof BusinessModelConfig, value: number) => {
    setPricingConfig((prev) => ({ ...prev, [key]: value }));
    setSaveToast(`Valor de tarif�rio (${key}) atualizado com sucesso!`);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleResetPricingDefaults = () => {
    if (confirm('Tem a certeza de que deseja restaurar a matriz de pre�os e taxas de bilh�tica para os valores padr�o?')) {
      setPricingConfig({
        ticketCommissionPercent: 10,
        ticketFixedFeeXOF: 200,
        extraPostPriceXOF: 5000,
        extraPromotionPriceXOF: 10000,
        annualDiscountPercent: 15,
        bannerWeeklyPriceXOF: 50000,
        includedPostsPerMonth: 3,
        automaticSubscriptionSuspensionEnabled: true,
      });
      setCategoryGroupsList([
        {
          id: 'restauracao',
          name: 'Restaura��o, Caf�s e Pequeno Com�rcio',
          description: 'Restaurantes, bares, lanchonetes, padarias, pequenas lojas de bairro',
          prices: { basic: 10000, professional: 25000, premium: 45000, enterprise: 85000 },
        },
        {
          id: 'hotelaria_saude_educacao',
          name: 'Hotelaria, Cl�nicas, Escolas e Com�rcio M�dio',
          description: 'Hot�is, pousadas, cl�nicas m�dicas, escolas privadas, supermercados',
          prices: { basic: 15000, professional: 35000, premium: 65000, enterprise: 120000 },
        },
        {
          id: 'corporativo_financeiro',
          name: 'Bancos, Seguradoras, Telecoms e Constru��o',
          description: 'Institui��es financeiras, operadoras telem�vel, concession�rias, construtoras',
          prices: { basic: 35000, professional: 75000, premium: 150000, enterprise: 300000 },
        },
        {
          id: 'ongs_artesãos',
          name: 'ONGs, Associa��es e Artes�os Local',
          description: 'Organiza��es comunit�rias, artes�os de Bissau, cooperativas culturais',
          prices: { basic: 5000, professional: 12000, premium: 25000, enterprise: 50000 },
        },
        {
          id: 'servicos_profissionais',
          name: 'Servi�os Profissionais e Consultoria',
          description: 'Escrit�rios de advocacia, contabilidade, oficinas, consultores independentes',
          prices: { basic: 12000, professional: 28000, premium: 50000, enterprise: 95000 },
        },
      ]);
      setSaveToast('Valores padr�o da matriz de pre�os restaurados com sucesso.');
      setTimeout(() => setSaveToast(null), 3500);
    }
  };

  const handleExportPricingCsv = () => {
    const csvHeader = 'Grupo_Categoria;Escalao_Basico_XOF;Escalao_Profissional_XOF;Escalao_Premium_XOF;Escalao_Enterprise_XOF\n';
    const csvRows = categoryGroupsList
      .map((g) =>
        [
          `"${g.name}"`,
          g.prices.basic,
          g.prices.professional,
          g.prices.premium,
          g.prices.enterprise,
        ].join(';')
      )
      .join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Guigui_Matriz_Precos_Categorias_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quota & Extra Purchases State (4.1 & 4.3)
  const [postsQuota, setPostsQuota] = useState(business.postsQuotaRemaining);
  const [showBuyPostModal, setShowBuyPostModal] = useState(false);
  const [showBuyPromoModal, setShowBuyPromoModal] = useState(false);
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('955123456');
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<'orange' | 'telecel'>('orange');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedContentServiceId, setSelectedContentServiceId] = useState('');
  const [contentServiceRequestNote, setContentServiceRequestNote] = useState('');
  const [monetizationNotice, setMonetizationNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'my_business') setShowBuyPostModal(false);
  }, [activeTab]);

  React.useEffect(() => {
    const isModalOpen = Boolean(
      showBuyPostModal ||
      showBuyPromoModal ||
      showUpgradeModal ||
      selectedOrderForQr
    );
    if (isModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      return () => {
        document.body.style.overflow = prev;
        document.body.classList.remove('modal-open');
      };
    }
  }, [showBuyPostModal, showBuyPromoModal, showUpgradeModal, selectedOrderForQr]);

  const subscriptionAccessState = getSubscriptionAccessState(business);
  const subscriptionReadOnly = shouldBlockBusinessMutation(business);
  const subscriptionRemainingMs = getSubscriptionRemainingMs(business.subscriptionRenewDate);
  const subscriptionRemainingDays = subscriptionRemainingMs === null ? null : Math.max(0, Math.ceil(subscriptionRemainingMs / (24 * 60 * 60 * 1000)));
  const subscriptionInterval = business.subscriptionPeriod || 'monthly';

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/transactions')
      .then((response) => response.ok ? response.json() : [])
      .then((transactions: Array<Record<string, unknown>>) => {
        if (cancelled) return;
        const confirmed = transactions
          .filter((transaction) => transaction.businessId === business.id
            && ['subscription_initial', 'subscription_renewal', 'subscription_upgrade'].includes(String(transaction.useCase))
            && ['confirmed_api', 'confirmed_manual', 'reconciled'].includes(String(transaction.status)))
          .sort((a, b) => Date.parse(String(b.confirmedAt || b.createdAt || '')) - Date.parse(String(a.confirmedAt || a.createdAt || '')))[0];
        if (!confirmed || confirmed.id === business.subscriptionPaymentId) return;
        const confirmedAt = String(confirmed.subscriptionStartedAt || confirmed.confirmedAt || new Date().toISOString());
        const period = confirmed.subscriptionInterval === 'annual' || /ano|annual/i.test(String(confirmed.useCaseLabel || '')) ? 'annual' : 'monthly';
        const renewAt = String(confirmed.subscriptionRenewDate || addSubscriptionPeriod(confirmedAt, period).toISOString());
        if (can('billing')) {
          onUpdateBusiness?.({
            ...business,
            status: 'active',
            subscriptionStatus: 'active',
            subscriptionPeriod: period,
            subscriptionStartedAt: confirmedAt,
            subscriptionPaymentId: String(confirmed.id),
            subscriptionRenewDate: renewAt,
            subscriptionAlertKeys: [],
            subscriptionSuspendedAt: undefined,
            subscriptionSuspensionReason: undefined,
            subscriptionAutoSuspended: false,
          });
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [business.id]);

  const guardSubscriptionAction = () => {
    if (!subscriptionReadOnly) return true;
    alert('O plano terminou ou a empresa est� suspensa. Pode consultar os dados, mas deve renovar o plano antes de criar, editar, publicar, promover ou gerir opera��es comerciais.');
    return false;
  };

  // Billing Cycle Toggle (4.2.d)
  const [isAnnualBilling, setIsAnnualBilling] = useState(false);

  // New Post Form State
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postMediaType, setPostMediaType] = useState<'image' | 'video' | 'gallery'>('image');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postVideoUrl, setPostVideoUrl] = useState('');
  const [dashboardGalleryUrls, setDashboardGalleryUrls] = useState<string[]>([]);
  const [newDashboardGalleryInput, setNewDashboardGalleryInput] = useState('');
  const [isModerating, setIsModerating] = useState(false);
  const [aiResult, setAiResult] = useState<ModerationResult | null>(null);
  const [postPublishMode, setPostPublishMode] = useState<'now' | 'scheduled'>('now');
  const [postScheduledAt, setPostScheduledAt] = useState('');
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([]);

  // New Promo Form State
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoBadge, setPromoBadge] = useState('-20% OFF');
  const [promoDays, setPromoDays] = useState(15);
  const [promoMediaType, setPromoMediaType] = useState<'image' | 'video'>('image');
  const [promoImageUrl, setPromoImageUrl] = useState('');
  const [promoVideoUrl, setPromoVideoUrl] = useState('');
  const [promoPublishMode, setPromoPublishMode] = useState<'now' | 'scheduled'>('now');
  const [promoScheduledAt, setPromoScheduledAt] = useState('');

  const loadScheduledItems = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/marketing/scheduled-items?businessId=${encodeURIComponent(business.id)}`, { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json() as { items?: ScheduledItem[] };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setScheduledItems(nextItems);
      if (!onUpdateBusiness) return;
      const publishedPostIds = new Set(nextItems.filter((item) => item.itemType === 'post' && item.status === 'published').map((item) => item.itemId));
      const failedPost = nextItems.find((item) => item.itemType === 'post' && item.status === 'failed');
      const publishedPromoIds = new Set(nextItems.filter((item) => item.itemType === 'promotion' && item.status === 'published').map((item) => item.itemId));
      const expiredPromoIds = new Set(nextItems.filter((item) => item.itemType === 'promotion' && item.status === 'expired').map((item) => item.itemId));
      const updatedBusiness: Business = {
        ...business,
        posts: business.posts.map((post) => publishedPostIds.has(post.id)
          ? { ...post, status: 'approved', publishedAt: nextItems.find((item) => item.itemId === post.id)?.publishedAt }
          : failedPost?.itemId === post.id ? { ...post, status: 'failed', schedulingError: failedPost.errorMessage } : post),
        promotions: business.promotions.map((promotion) => publishedPromoIds.has(promotion.id)
          ? { ...promotion, status: 'active', isActive: true, activatedAt: nextItems.find((item) => item.itemId === promotion.id)?.publishedAt }
          : expiredPromoIds.has(promotion.id) ? { ...promotion, status: 'expired', isActive: false } : promotion),
      };
      const postsChanged = updatedBusiness.posts.some((post, index) => post.status !== business.posts[index]?.status || post.publishedAt !== business.posts[index]?.publishedAt || post.schedulingError !== business.posts[index]?.schedulingError);
      const promotionsChanged = updatedBusiness.promotions.some((promotion, index) => promotion.status !== business.promotions[index]?.status || promotion.isActive !== business.promotions[index]?.isActive || promotion.activatedAt !== business.promotions[index]?.activatedAt);
      if (postsChanged || promotionsChanged) onUpdateBusiness(updatedBusiness);
    } catch {
      // The local Marketing view remains usable when the optional backend is unavailable.
    }
  }, [business, onUpdateBusiness]);

  const updateSchedule = async (item: ScheduledItem, action: 'cancel' | 'publish' | 'reschedule') => {
    if (action === 'reschedule') {
      const value = window.prompt('Nova data e hora (formato ISO, por exemplo 2026-09-20T18:00:00):', item.scheduledAt.slice(0, 16));
      if (!value) return;
      const response = await fetch(`/api/marketing/scheduled-items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ scheduledAt: value }) });
      if (!response.ok) alert('N�o foi poss�vel reagendar este conte�do.');
    } else {
      const response = await fetch(`/api/marketing/scheduled-items/${item.id}${action === 'publish' ? '/publish-now' : ''}`, { method: action === 'publish' ? 'POST' : 'PATCH', headers: action === 'cancel' ? { 'Content-Type': 'application/json' } : undefined, credentials: 'include', body: action === 'cancel' ? JSON.stringify({ status: 'cancelled' }) : undefined });
      if (!response.ok) alert('N�o foi poss�vel atualizar este agendamento.');
    }
    await loadScheduledItems();
  };

  useEffect(() => {
    void loadScheduledItems();
    const interval = window.setInterval(() => void loadScheduledItems(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadScheduledItems]);

  const handleLocalPostImage = async (file?: File) => {
    if (!file) return;
    try { setPostImageUrl(await readLocalMediaFile(file)); } catch (error) { alert(error instanceof Error ? error.message : 'Falha ao carregar a imagem.'); }
  };

  const handleLocalPostVideo = async (file?: File) => {
    if (!file) return;
    try { setPostVideoUrl(await readLocalMediaFile(file)); } catch (error) { alert(error instanceof Error ? error.message : 'Falha ao carregar o v�deo.'); }
  };

  const handleLocalGalleryImages = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all(Array.from(files).map(readLocalMediaFile));
      setDashboardGalleryUrls((previous) => [...previous, ...urls]);
    } catch (error) { alert(error instanceof Error ? error.message : 'Falha ao carregar a galeria.'); }
  };

  const handleLocalPromoMedia = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await readLocalMediaFile(file);
      if (promoMediaType === 'video') setPromoVideoUrl(dataUrl);
      else setPromoImageUrl(dataUrl);
    } catch (error) { alert(error instanceof Error ? error.message : 'Falha ao carregar o media da promo��o.'); }
  };

  const handleRequestContentService = async (service: ContentService) => {
    if (!denyPermission('content')) return;
    if (!guardSubscriptionAction()) return;
    try {
      const response = await fetch('/api/monetization/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'content_service', businessId: business.id, businessName: business.name, serviceId: service.id, serviceName: service.name, notes: contentServiceRequestNote.trim() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'N�o foi poss�vel enviar o pedido de or�amento.');
      setMonetizationNotice(`Pedido de or�amento enviado para ${service.name}. A Administra��o entrar� em contacto.`);
      setContentServiceRequestNote('');
      setSelectedContentServiceId('');
    } catch (error) {
      setMonetizationNotice(error instanceof Error ? error.message : 'N�o foi poss�vel enviar o pedido.');
    }
  };

  const handleBuyAdvertising = async (productCode: string) => {
    if (!denyPermission('content')) return;
    if (!guardSubscriptionAction()) return;
    const advertisingProduct = getCommercialProduct(resolvedMonetizationCatalog, productCode);
    if (!advertisingProduct) return;
    if (advertisingProduct.requiresQuote) {
      try {
        const response = await fetch('/api/monetization/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'advertising', businessId: business.id, businessName: business.name, productId: advertisingProduct.id, productCode: advertisingProduct.code, productName: advertisingProduct.name }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'N�o foi poss�vel solicitar a campanha.');
        setMonetizationNotice(`Pedido de or�amento enviado para ${advertisingProduct.name}.`);
      } catch (error) { setMonetizationNotice(error instanceof Error ? error.message : 'N�o foi poss�vel solicitar a campanha.'); }
      return;
    }
    const amount = resolveProductPrice(resolvedMonetizationCatalog, advertisingProduct.code, 1, advertisingProduct.periodDays);
    try {
      const response = await fetch('/api/payments/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `ad-${business.id}-${advertisingProduct.code}-${Date.now()}` }, body: JSON.stringify({ useCase: 'advertising_purchase', useCaseLabel: advertisingProduct.name, productId: advertisingProduct.id, productCode: advertisingProduct.code, quantity: 1, businessId: business.id, businessName: business.name, payerName: business.ownerName || business.name, payerPhone: mobileMoneyPhone.startsWith('+245') ? mobileMoneyPhone : `+245 ${mobileMoneyPhone}`, amountXOF: amount, provider: selectedPaymentProvider === 'orange' ? 'orange_money' : 'telecel' }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'N�o foi poss�vel iniciar o pagamento da publicidade.');
      setMonetizationNotice(result.transaction?.status === 'confirmed_api' ? `${advertisingProduct.name} pago e registado.` : `Pedido de pagamento registado para ${advertisingProduct.name}.`);
    } catch (error) { setMonetizationNotice(error instanceof Error ? error.message : 'N�o foi poss�vel iniciar o pagamento.'); }
  };

  const handleBuyExtraPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denyPermission('content')) return;
    if (!guardSubscriptionAction()) return;
    setIsProcessingPayment(true);
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'extra_posts',
          useCaseLabel: `Pacote Extra +${extraPostQuantity} Posts Sociais (${postExtraPrice.toLocaleString('pt-PT')} XOF)`,
          productId: postExtraProduct?.id,
          productCode: 'POST_EXTRA',
          quantity: extraPostQuantity,
          businessId: business.id,
          businessName: business.name,
          payerName: business.ownerName || business.name,
          payerPhone: mobileMoneyPhone.startsWith('+245') ? mobileMoneyPhone : `+245 ${mobileMoneyPhone}`,
          amountXOF: postExtraPrice,
          provider: selectedPaymentProvider === 'orange' ? 'orange_money' : 'telecel',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.transaction) {
        throw new Error(data.error || 'O pagamento n�o foi aceite pelo servidor.');
      }
      setIsProcessingPayment(false);
      setShowBuyPostModal(false);

      if (data.transaction.status === 'pending_manual_confirmation') {
        alert(
          `Pedido de pagamento registado (#${data.transaction.id})!\n\nEnvie ${postExtraPrice.toLocaleString('pt-PT')} XOF via ${
            selectedPaymentProvider === 'orange' ? 'Orange Money (+245 955 00 00)' : 'Telecel (+245 966 00 00)'
          }.\nO cr�dito ser� adicionado depois da confirma��o da equipa financeira.`
        );
      } else {
        const previousWallet: MonetizationWallet = business.monetizationWallet || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0, updatedAt: new Date().toISOString() };
        onUpdateBusiness?.({ ...business, monetizationWallet: { ...previousWallet, postsExtraPurchased: previousWallet.postsExtraPurchased + extraPostQuantity, updatedAt: new Date().toISOString() } });
        setPostsQuota((prev) => prev + extraPostQuantity);
        alert(`Pagamento de ${postExtraPrice.toLocaleString('pt-PT')} XOF confirmado via SMS/API! +${extraPostQuantity} post(s) extra(s) adicionado(s) � carteira.`);
      }
    } catch (err) {
      console.error(err);
      setIsProcessingPayment(false);
      alert(err instanceof Error ? err.message : 'Erro ao processar pagamento.');
    }
  };

  const handleBuyExtraPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denyPermission('content')) return;
    if (!guardSubscriptionAction()) return;
    setIsProcessingPayment(true);
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'extra_promotions',
          useCaseLabel: `Pacote Extra +${extraPromotionQuantity} Destaque(s) Promocional(is) (${promotionExtraPrice.toLocaleString('pt-PT')} XOF)`,
          productId: promotionExtraProduct?.id,
          productCode: 'PROMOTION_EXTRA',
          quantity: extraPromotionQuantity,
          businessId: business.id,
          businessName: business.name,
          payerName: business.ownerName || business.name,
          payerPhone: mobileMoneyPhone.startsWith('+245') ? mobileMoneyPhone : `+245 ${mobileMoneyPhone}`,
          amountXOF: promotionExtraPrice,
          provider: selectedPaymentProvider === 'orange' ? 'orange_money' : 'telecel',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.transaction) {
        throw new Error(data.error || 'O pagamento n�o foi aceite pelo servidor.');
      }
      setIsProcessingPayment(false);
      setShowBuyPromoModal(false);

      if (data.transaction.status === 'pending_manual_confirmation') {
        alert(
          `Pedido de pagamento registado (#${data.transaction.id})!\n\nEnvie ${promotionExtraPrice.toLocaleString('pt-PT')} XOF via ${
            selectedPaymentProvider === 'orange' ? 'Orange Money (+245 955 00 00)' : 'Telecel (+245 966 00 00)'
          }.\nO destaque ser� ativado depois da confirma��o da equipa financeira.`
        );
      } else {
        const previousWallet: MonetizationWallet = business.monetizationWallet || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0, updatedAt: new Date().toISOString() };
        onUpdateBusiness?.({ ...business, monetizationWallet: { ...previousWallet, promotionsExtraPurchased: previousWallet.promotionsExtraPurchased + extraPromotionQuantity, updatedAt: new Date().toISOString() } });
        alert(`Pagamento de ${promotionExtraPrice.toLocaleString('pt-PT')} XOF confirmado via SMS/API! +${extraPromotionQuantity} promo��o(�es) extra(s) adicionada(s) � carteira.`);
      }
    } catch (err) {
      console.error(err);
      setIsProcessingPayment(false);
      alert(err instanceof Error ? err.message : 'Erro ao processar pagamento.');
    }
  };

  const handleTestAiModerationAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denyPermission('content')) return;
    if (!guardSubscriptionAction()) return;
    if (!postTitle || !postContent) return;

    if (postsQuota <= 0 || (currentPlan.postsPerMonth !== 'unlimited' && currentPlan.postsPerMonth !== 'negotiated' && currentUsage.postsUsed >= Number(currentPlan.postsPerMonth))) {
      alert(`A cota mensal de posts (${limitLabel(currentPlan.postsPerMonth)}) foi atingida. Por favor adquira um post extra por ${pricingConfig.extraPostPriceXOF.toLocaleString('pt-PT')} XOF.`);
      setShowBuyPostModal(true);
      return;
    }

    setIsModerating(true);
    setAiResult(null);

    try {
      const res = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${postTitle}\n${postContent}`,
          author: business.name,
          type: 'post',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.result) {
        throw new Error(data.error || 'O servi�o de modera��o n�o devolveu uma decis�o v�lida.');
      }
      setAiResult(data.result);

      if (data.result.status === 'verde' || data.result.status === 'amarelo') {
        if (postPublishMode === 'scheduled' && data.result.status !== 'verde') {
          alert('Este conte�do precisa de aprova��o antes de ser agendado para publica��o autom�tica.');
          return;
        }
        if (postPublishMode === 'scheduled' && (!postScheduledAt || Date.parse(postScheduledAt) <= Date.now())) {
          alert('Escolha uma data e hora futuras para o agendamento.');
          return;
        }
        const isSubscriber = Boolean(business.tier);
        const finalGallery = postMediaType === 'gallery' ? dashboardGalleryUrls : postImageUrl ? [postImageUrl] : [];

        const newPost: BusinessPost = {
          id: 'post-' + Date.now(),
          businessId: business.id,
          businessName: business.name,
          businessLogo: business.logo,
          title: postTitle,
          content: postContent,
          imageUrl: postImageUrl || (dashboardGalleryUrls.length > 0 ? dashboardGalleryUrls[0] : undefined),
          videoUrl: postMediaType === 'video' && postVideoUrl ? postVideoUrl : undefined,
          mediaType: postMediaType,
          mediaGallery: finalGallery.length > 0 ? finalGallery : undefined,
          isPlanSubscriberPost: isSubscriber,
          planBadge: isSubscriber ? `Plano ${business.tier?.toUpperCase()}` : undefined,
          createdAt: new Date().toISOString(),
          status: postPublishMode === 'scheduled' ? 'scheduled' : data.result.status === 'verde' ? 'approved' : 'pending_moderation',
          scheduledAt: postPublishMode === 'scheduled' ? new Date(postScheduledAt).toISOString() : undefined,
          likesCount: 1,
          reactions: { like: 1 },
          comments: [],
          sharesCount: 0,
          neighborhood: business.neighborhood,
        };

        if (postPublishMode === 'scheduled') {
          const response = await fetch('/api/marketing/scheduled-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              businessId: business.id,
              itemType: 'post',
              itemId: newPost.id,
              scheduledAt: newPost.scheduledAt,
              moderationStatus: 'approved',
              paymentStatus: 'not_required',
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || 'N�o foi poss�vel criar o agendamento.');
        }
        onAddPost(business.id, newPost);
        setPostsQuota((prev) => Math.max(0, prev - 1));
        setPostTitle('');
        setPostContent('');
        setPostImageUrl('');
        setPostVideoUrl('');
        setDashboardGalleryUrls([]);
        setPostPublishMode('now');
        setPostScheduledAt('');
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Erro ao comunicar com o servi�o de modera��o.');
    } finally {
      setIsModerating(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denyPermission('content')) return;
    if (!guardSubscriptionAction()) return;
    if (!promoTitle || !promoDesc) return;
    if (currentPlan.promotionsPerMonth !== 'unlimited' && currentPlan.promotionsPerMonth !== 'negotiated' && currentUsage.promotionsUsed >= Number(currentPlan.promotionsPerMonth)) {
      alert(`A cota mensal de promo��es (${limitLabel(currentPlan.promotionsPerMonth)}) foi atingida. Pode comprar uma promo��o extra por ${pricingConfig.extraPromotionPriceXOF.toLocaleString('pt-PT')} XOF.`);
      setShowBuyPromoModal(true);
      return;
    }

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + promoDays);

    const newPromo: Promotion = {
      id: 'promo-' + Date.now(),
      businessId: business.id,
      businessName: business.name,
      title: promoTitle,
      description: promoDesc,
      discountBadge: promoBadge,
      imageUrl: promoMediaType === 'image' ? promoImageUrl || undefined : undefined,
      videoUrl: promoMediaType === 'video' ? promoVideoUrl || undefined : undefined,
      mediaType: promoMediaType,
      validUntil: validUntilDate.toISOString(),
      code: 'PROMO-' + Math.floor(1000 + Math.random() * 9000),
      categoryName: business.subcategoryId,
      neighborhood: business.neighborhood,
      isActive: promoPublishMode === 'now',
      status: promoPublishMode === 'scheduled' ? 'scheduled' : 'active',
      startsAt: promoPublishMode === 'scheduled' ? new Date(promoScheduledAt).toISOString() : new Date().toISOString(),
      scheduledAt: promoPublishMode === 'scheduled' ? new Date(promoScheduledAt).toISOString() : undefined,
      clicksCount: 0,
    };

    if (promoPublishMode === 'scheduled' && (!promoScheduledAt || Date.parse(promoScheduledAt) <= Date.now())) {
      alert('Escolha uma data e hora futuras para o agendamento.');
      return;
    }
    try {
      const response = await fetch('/api/marketing/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPromo),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'N�o foi poss�vel guardar a promo��o.');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'N�o foi poss�vel guardar a promo��o.');
      return;
    }
    onAddPromotion(business.id, newPromo);
    setPromoPublishMode('now');
    setPromoScheduledAt('');
    setPromoTitle('');
    setPromoDesc('');
    setPromoImageUrl('');
    setPromoVideoUrl('');
    alert('Promo��o criada com sucesso!');
  };

  const teamRoleLabels: Record<BusinessTeamRole, string> = {
    manager: 'Administrador',
    editor: 'Editor',
    finance: 'Financeiro',
    support: 'Atendimento',
  };
  const addTeamAudit = (member: BusinessTeamMember, action: string) => {
    setTeamAudit((previous) => [{ id: `team-audit-${Date.now()}`, businessId: business.id, memberName: member.name, action, createdAt: new Date().toISOString() }, ...previous].slice(0, 50));
  };
  const handleInviteTeamMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!denyPermission('profile')) return;
    const name = teamName.trim();
    const email = teamEmail.trim().toLowerCase();
    if (!name || !email) return;
    if (teamMembers.some((member) => member.email === email)) {
      setTeamNotice('J� existe um colaborador com este e-mail.');
      return;
    }
    const invitationToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    try {
      const response = await fetch('/api/business/team/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: email,
          recipientName: name,
          businessId: business.id,
          businessName: business.name,
          role: teamRole,
          permissions: BUSINESS_ROLE_PERMISSIONS[teamRole],
          roleLabel: teamRoleLabels[teamRole],
          token: invitationToken,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setTeamNotice(payload.error || 'N�o foi poss�vel enviar o convite por e-mail.');
        return;
      }
    } catch {
      setTeamNotice('N�o foi poss�vel contactar o servi�o de e-mail. Tente novamente.');
      return;
    }
    const member: BusinessTeamMember = {
      id: `team-${Date.now()}`,
      businessId: business.id,
      name,
      email,
      role: teamRole,
      status: 'invited',
      permissions: BUSINESS_ROLE_PERMISSIONS[teamRole],
      createdAt: new Date().toISOString(),
    };
    setTeamMembers((previous) => [member, ...previous]);
    addTeamAudit(member, 'Convite enviado');
    setTeamName('');
    setTeamEmail('');
    setTeamNotice(`Convite enviado para ${email}.`);
  };
  const handleTeamStatus = (member: BusinessTeamMember) => {
    if (!denyPermission('profile')) return;
    const status = member.status === 'suspended' ? 'active' : 'suspended';
    const updated = { ...member, status } as BusinessTeamMember;
    setTeamMembers((previous) => previous.map((item) => item.id === member.id ? updated : item));
    addTeamAudit(updated, status === 'active' ? 'Acesso reactivado' : 'Acesso suspenso');
  };
  const handleRemoveTeamMember = (member: BusinessTeamMember) => {
    if (!denyPermission('profile')) return;
    if (!window.confirm(`Remover ${member.name} da equipa?`)) return;
    setTeamMembers((previous) => previous.filter((item) => item.id !== member.id));
    addTeamAudit(member, 'Colaborador removido');
  };

  const marketingAssets = React.useMemo<MarketingLibraryAsset[]>(() => {
    const assets: MarketingLibraryAsset[] = [];
    business.posts.forEach((post) => {
      const urls = [post.imageUrl, post.videoUrl, ...(post.mediaGallery || [])].filter((url): url is string => Boolean(url));
      urls.forEach((url, index) => assets.push({
        id: `asset-${post.id}-${index}`,
        businessId: business.id,
        name: post.title || `Conte�do ${post.id}`,
        type: post.videoUrl === url ? 'video' : post.mediaType === 'gallery' ? 'banner' : 'image',
        url,
        sourceId: post.id,
        usedBy: [post.id, ...marketingCampaigns.filter((campaign) => campaign.contentIds.includes(post.id)).map((campaign) => campaign.id)],
        createdAt: post.createdAt,
      }));
    });
    if (business.logo) assets.push({ id: `asset-logo-${business.id}`, businessId: business.id, name: 'Log�tipo da empresa', type: 'logo', url: business.logo, usedBy: [business.id], createdAt: new Date().toISOString() });
    return assets;
  }, [business, marketingCampaigns]);

  const createMarketingCampaign = async () => {
    if (!denyPermission('content') || !campaignName.trim()) return;
    const startsAt = campaignStartsAt ? new Date(campaignStartsAt) : undefined;
    const endsAt = campaignEndsAt ? new Date(campaignEndsAt) : undefined;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      alert('Escolha uma data de in�cio v�lida.');
      return;
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      alert('Escolha uma data de fim v�lida.');
      return;
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      alert('A data de fim deve ser posterior � data de in�cio.');
      return;
    }
    const now = new Date().toISOString();
    const campaign: MarketingCampaign = {
      id: `campaign-${Date.now()}`,
      businessId: business.id,
      name: campaignName.trim(),
      objective: campaignObjective,
      contentIds: campaignContentIds,
      channels: campaignChannels,
      audienceSegmentId: campaignAudienceId || undefined,
      startsAt: startsAt?.toISOString(),
      endsAt: endsAt?.toISOString(),
      budgetXOF: campaignBudget ? Number(campaignBudget) : undefined,
      spentXOF: 0,
      status: startsAt && startsAt > new Date() ? 'scheduled' : 'draft',
      createdAt: now,
      updatedAt: now,
    };
    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(campaign),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'N�o foi poss�vel guardar a campanha.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'N�o foi poss�vel guardar a campanha.');
      return;
    }
    setMarketingCampaigns((previous) => [campaign, ...previous]);
    setCampaignName('');
    setCampaignObjective('awareness');
    setCampaignBudget('');
    setCampaignAudienceId('');
    setCampaignContentIds([]);
    setCampaignStartsAt('');
    setCampaignEndsAt('');
  };

  const updateCampaignStatus = async (campaign: MarketingCampaign, status: MarketingCampaign['status']) => {
    if (!denyPermission('content')) return;
    const updatedAt = new Date().toISOString();
    try {
      const response = await fetch(`/api/marketing/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, updatedAt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'N�o foi poss�vel atualizar a campanha.');
      setMarketingCampaigns((previous) => previous.map((item) => item.id === campaign.id ? { ...item, status, updatedAt } : item));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'N�o foi poss�vel atualizar a campanha.');
    }
  };

  const createAudienceSegment = () => {
    if (!denyPermission('content')) return;
    const now = new Date().toISOString();
    setMarketingSegments((previous) => [{
      id: `segment-${Date.now()}`,
      businessId: business.id,
      name: 'Bissau · clientes interessados',
      location: business.neighborhood,
      interests: ['conte�do da empresa'],
      estimatedReach: audienceReach > 0 ? audienceReach : undefined,
      createdAt: now,
    }, ...previous]);
  };

  return (
    <div className="guigui-profile-dashboard guigui-light-dashboard w-full min-h-[calc(100vh-72px)] bg-[var(--color-bg-surface)]">
      <div className="flex min-h-[calc(100vh-72px)] w-full bg-[var(--color-bg-surface)]">
        <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} fixed inset-0 z-40 bg-[var(--color-bg-surface-dark)]/35 backdrop-blur-[1px] md:hidden`} onClick={() => setMobileSidebarOpen(false)} />

        <aside
          style={{ width: sidebarCollapsed ? 72 : 248 }}
          className={`${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-[120px] z-[110] h-[calc(100vh-120px)] max-w-[calc(100vw-16px)] shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)] transition-[transform,box-shadow,width] duration-300 ease-out md:top-[120px] md:h-[calc(100vh-120px)] md:translate-x-0 md:z-50`}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/90 px-1.5 py-2.5 backdrop-blur-sm">
              <div className={`flex items-center ${sidebarCollapsed ? 'w-full justify-center' : 'gap-1.5'} pl-0.5`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-bg-surface)] text-[11px] font-black text-[var(--color-text-muted)] shadow-sm">
                  {business.name.slice(0, 2).toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{t('merchantRole')}</div>
                    <div className="text-lg font-black text-[var(--color-text-strong)]">Guigui.com</div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <IconButton
                  label={sidebarCollapsed ? t('expandMenu') : t('collapseMenu')}
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  title={sidebarCollapsed ? t('expandMenu') : t('collapseMenu')}
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </IconButton>
                <IconButton
                  label={t('closeSidebar')}
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 rounded-full md:hidden"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
              {businessNavigationGroups.map((group) => (
                <div key={group.heading} className={`${sidebarCollapsed ? 'space-y-1.5' : 'space-y-2'}`}>
                  {!sidebarCollapsed && (
                    <div className="px-2 text-[8px] font-black uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{group.heading}</div>
                  )}

                  <div className={`${sidebarCollapsed ? 'space-y-1.5' : 'space-y-1'}`}>
                    {group.items.filter((item) => canTab(item.tab)).map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.tab || (item.tab === 'marketing' && isMarketingTab);

                      return (
                        <button
                          key={`${group.heading}-${item.label}`}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.tab);
                            setMobileSidebarOpen(false);
                          }}
                          aria-label={item.label}
                          title={item.label}
                          className={`group relative flex w-full items-center rounded-2xl border text-left transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--color-green-600)] ${
                            sidebarCollapsed
                              ? 'justify-center border-transparent p-2.5'
                              : 'gap-2 border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 shadow-[0_8px_18px_-18px_rgba(15,23,42,0.18)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-surface-hover)]'
                          } ${
                            isActive
                              ? 'border-[var(--color-green-600)] bg-[var(--color-green-600)] text-white shadow-[0_18px_28px_-20px_rgba(63,174,128,0.75)]'
                              : 'text-[var(--color-text-strong)]'
                          }`}
                        >
                          <div className={`flex shrink-0 items-center justify-center rounded-xl ${sidebarCollapsed ? 'h-7 w-7' : 'h-6 w-6'} ${isActive ? 'bg-[var(--color-green-600)]/20 text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'}`}>
                            <Icon className={sidebarCollapsed ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
                          </div>

                          {!sidebarCollapsed && (
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-black leading-snug">{item.label}</div>
                              <div className={`mt-0.5 text-[7.8px] leading-relaxed ${isActive ? 'text-[var(--color-blue-100)]' : 'text-[var(--color-text-muted)]'}`}>{item.help}</div>
                            </div>
                          )}

                          {!sidebarCollapsed && item.count !== undefined && item.count > 0 && (
                            <Badge variant={isActive ? 'verified' : 'danger'} className="border-0 px-1.5 py-0.5 text-[9px]">{item.count}</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/80 p-2">
              <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-2">
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'} rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-emerald-100)] text-[var(--color-emerald-700)]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{t('activeAccount')}</div>
                      <div className="truncate text-xs font-black text-[var(--color-text-strong)]">{business.name}</div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </aside>
        <main
          style={{ '--business-sidebar-width': `${sidebarCollapsed ? 72 : 248}px` } as React.CSSProperties}
          className="min-w-0 flex-1 overflow-visible bg-[#f7f5f3] p-3 sm:p-4 md:ml-[var(--business-sidebar-width)]"
        >
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <IconButton
                label={t('openSidebar')}
                variant="secondary"
                className="h-9 w-9 rounded-full md:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </IconButton>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Guigui.com / {t('merchantRole')}</div>
                <h1 className="mt-0.5 text-lg font-black text-[var(--color-text-strong)] sm:text-xl">{isMarketingTab ? 'Marketing' : currentBusinessSection}</h1>
                {isMarketingTab && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('business.GerencieSuasCampanhas')}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-5 text-[var(--color-text-strong)]">
            {isMarketingTab && (
              <div className="guigui-marketing-tabs" role="tablist" aria-label={t('business.SeccoesMarketing')}>
                {[
                  { id: 'marketing_campaigns' as const, label: 'Campanhas', icon: Megaphone, action: () => { setMarketingSection('campaigns'); setActiveTab('marketing_campaigns'); } },
                  { id: 'posts' as const, label: 'Publica��es', icon: FileText, action: () => setActiveTab('posts') },
                  { id: 'promotions' as const, label: 'Promo��es', icon: Tag, action: () => setActiveTab('promotions') },
                  { id: 'marketing_calendar' as const, label: 'Calend�rio', icon: Calendar, action: () => { setMarketingSection('calendar'); setActiveTab('marketing_calendar'); } },
                ].map(({ id, label, icon: TabIcon, action }) => {
                  const selected = activeTab === id || (id === 'marketing_campaigns' && activeTab === 'marketing');
                  return (
                    <button key={id} type="button" role="tab" aria-selected={selected} className={selected ? 'is-active' : ''} onClick={action}>
                      <TabIcon className="h-4 w-4" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Business Header Banner */}
            {activeTab === 'my_business' && (
              <Card className="min-w-0 border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 sm:p-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-3 shadow-sm">
                <div className="flex min-w-0 w-full items-center gap-2 sm:gap-2.5">
                  <div className="h-10 w-10 rounded-lg border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] overflow-hidden shadow-sm flex-shrink-0 sm:h-11 sm:w-11">
                    <img src={business.logo} alt={`Logotipo de ${business.name}`} className="w-full h-full object-cover" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h1 className="min-w-0 break-words text-base sm:text-lg font-black">{business.name}</h1>
                      <Badge variant="info" className="px-2 py-0.5 text-[9px] uppercase">
                        Escal�o {business.tier}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      📍 {business.neighborhood} • Direct�rio Guigui.com
                    </p>
                  </div>
                </div>

                <div className="w-full bg-[var(--color-bg-subtle)] p-2 sm:p-2.5 rounded-xl border border-[var(--color-border-subtle)] flex flex-wrap items-center gap-2 sm:gap-2.5 sm:w-auto">
                  <div>
                    <div className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold">Cota Mensal de Posts ({limitLabel(currentPlan.postsPerMonth)})</div>
                    <div className="text-xs font-extrabold text-[var(--color-green-700)] mt-0.5">
                      {currentPlan.postsPerMonth === 'unlimited' || currentPlan.postsPerMonth === 'negotiated' ? 'Ilimitado' : `${postsQuota} de ${limitLabel(currentPlan.postsPerMonth)} restantes`}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      Posts extra: {pricingConfig.extraPostPriceXOF.toLocaleString('pt-PT')} XOF/post
                    </div>
                  </div>

                  <Button type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => { if (denyPermission('content') && guardSubscriptionAction()) setShowBuyPostModal(true); }}
                    className="min-h-[30px] rounded-lg bg-[var(--color-green-600)] px-2 py-1 text-[10px] font-bold hover:bg-[var(--color-green-700)]"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Comprar Post Extra</span>
                  </Button>
                </div>
              </Card>
            )}

            {activeTab === 'overview' && (
              <Card className={`rounded-2xl border p-4 ${subscriptionAccessState === 'active' ? 'border-[var(--color-green-200)] bg-[var(--color-green-50)] text-[var(--color-green-950)]' : subscriptionAccessState === 'expired' ? 'border-[var(--color-gold-300)] bg-[var(--color-gold-50)] text-[var(--color-gold-950)]' : 'border-[var(--color-red-300)] bg-[var(--color-red-50)] text-[var(--color-red-950)]'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {subscriptionAccessState === 'active' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-green-600)]" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-gold-600)]" />}
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide">
                        {subscriptionAccessState === 'active' ? `Plano ${getSubscriptionTierLabel(business.tier)} activo` : subscriptionAccessState === 'expired' ? 'Plano expirado — modo de consulta' : 'Empresa suspensa — modo de consulta'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {subscriptionAccessState === 'active'
                          ? `Pr�ximo pagamento: ${new Date(business.subscriptionRenewDate).toLocaleDateString('pt-PT')} (${subscriptionInterval === 'annual' ? 'renova��o anual' : 'renova��o mensal'}${subscriptionRemainingDays !== null ? `, faltam ${subscriptionRemainingDays} dias` : ''}).`
                          : 'Pode consultar dados, hist�rico, m�tricas e factura��o, mas n�o pode criar, editar, publicar, promover, gerir eventos ou validar opera��es at� renovar ou ser reactivada.'}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="primary" size="sm" onClick={() => { if (canTab('billing')) setActiveTab('billing'); else denyPermission('billing'); }} className="bg-[var(--color-bg-surface-dark)] hover:bg-[var(--color-bg-surface-dark)]/80">
                    {subscriptionAccessState === 'active' ? 'Ver renova��o' : 'Renovar plano'}
                  </Button>
                </div>
              </Card>
            )}

            {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="border-[var(--color-border-subtle)]/80 bg-[var(--color-bg-surface)] p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.55)]">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                <span>Seguidores</span>
                <Users className="w-4 h-4 text-[var(--color-violet-600)]" />
              </div>
              <div className="font-mono text-2xl font-black text-[var(--color-violet-700)] mt-2">{followerCount.toLocaleString('pt-PT')}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] font-semibold mt-1">Pessoas com o sino activo</div>
            </Card>

            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                <span>{t('business.AlcanceDosAnuncios')}</span>
                <Megaphone className="w-4 h-4 text-[var(--color-rose-600)]" />
              </div>
              <div className="font-mono text-2xl font-black text-[var(--color-rose-700)] mt-2">{audienceReach.toLocaleString('pt-PT')}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] font-semibold mt-1">{t('business.VisualizacoesDosConteudos')}</div>
            </Card>

            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                <span>{t('business.Visualizacoes')}</span>
                <Eye className="w-4 h-4 text-[var(--color-green-600)]" />
              </div>
              <div className="font-mono text-2xl font-black tabular-nums text-[var(--color-text-strong)] mt-2">
                {business.metrics.views.toLocaleString('pt-PT')}
              </div>
              <div className="text-[10px] text-[var(--color-green-600)] font-semibold mt-1">{t('business.EsteMes')}</div>
            </Card>

            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                <span>WhatsApp Leads</span>
                <MessageCircle className="w-4 h-4 text-[var(--color-green-600)]" />
              </div>
              <div className="font-mono text-2xl font-black text-[var(--color-green-600)] mt-2">
                {business.metrics.whatsappClicks}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] font-semibold mt-1">
                Leads diretos
              </div>
            </Card>

            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                <span>Chamadas</span>
                <Phone className="w-4 h-4 text-[var(--color-gold-600)]" />
              </div>
              <div className="font-mono text-2xl font-black text-[var(--color-gold-600)] mt-2">
                {business.metrics.phoneClicks}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] font-semibold mt-1">
                Contacto voz
              </div>
            </Card>

            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                <span>Mapa</span>
                <ArrowUpRight className="w-4 h-4 text-[var(--color-green-600)]" />
              </div>
              <div className="font-mono text-2xl font-black text-[var(--color-green-600)] mt-2">
                {business.metrics.directionsClicks}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] font-semibold mt-1">
                Visitas presenciais
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <ChartFrame
              title={t('business.InteracaoComPerfil')}
              description="Dados reais dos acessos e contactos registados para esta empresa."
              eyebrow="Atividade"
              height="md"
              action={<BarChart3 className="h-5 w-5 text-[var(--color-green-600)]" />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewEngagementData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--color-border-default)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip cursor={{ fill: 'var(--color-green-600)', opacity: 0.06 }} content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Total" radius={[10, 10, 4, 4]} maxBarSize={38}>
                    {overviewEngagementData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame
              title="Atividade comercial"
              description="Volume atual dos m�dulos da empresa."
              eyebrow="Vis�o geral"
              height="md"
              action={<PieChartIcon className="h-5 w-5 text-[var(--color-green-600)]" />}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overviewActivityData} dataKey="total" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4} cornerRadius={5} stroke="var(--color-bg-surface)" strokeWidth={3}>
                    {overviewActivityData.map((entry, index) => <Cell key={entry.name} fill={[chartColors.primary, chartColors.accent, chartColors.info, chartColors.warm][index % 4]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 8, fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>
        </div>
      )}

      {/* My Business Tab */}
      {activeTab === 'my_business' && (
        <ClientBusinessProfile
          business={business}
          currentLang={currentLang}
          onUpdateBusiness={(updatedBusiness) => {
            if (denyPermission('profile') && guardSubscriptionAction()) onUpdateBusiness?.(updatedBusiness);
          }}
        />
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          <ClientEventsManagement
            business={business}
            currentLang={currentLang}
            events={events}
            purchaseOrders={myBusinessOrders}
            onEventSubmitted={(event) => {
              if (denyPermission('events') && guardSubscriptionAction()) onEventSubmitted?.(event);
            }}
            onEventCancelled={(event) => {
              if (denyPermission('events') && guardSubscriptionAction()) onEventCancelled?.(event);
            }}
          />
          {/* Bilheteira real: bilhetes vendidos e pedido de reembolso (GUI-3.4.11). */}
          <SoldTicketsPanel currentLang={currentLang} />
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="space-y-5 border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-sm sm:p-6 xl:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-green-600)]">{t('business.ProducaoConteudo')}</p>
                <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-[var(--color-text-strong)]">
                  <FileText className="h-5 w-5 text-[var(--color-green-600)]" />{t('business.NovaPublicacao')}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{t('business.CrieUmaAtualizacao')}</p>
              </div>
              <Badge variant="info" className="px-2.5 py-1 text-[10px]">
                Gemini IA
              </Badge>
            </div>

            {/* Media Tabs Selector */}
            <div className="bg-[var(--color-bg-subtle)] p-1 rounded-2xl grid grid-cols-3 gap-1 font-bold text-center text-xs">
              <Button
                type="button"
                variant={postMediaType === 'image' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPostMediaType('image')}
                className="rounded-xl py-2 text-[var(--color-text-strong)]"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                <span>{t('business.FotoUnica')}</span>
              </Button>

              <Button
                type="button"
                variant={postMediaType === 'video' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPostMediaType('video')}
                className="rounded-xl py-2 text-[var(--color-text-strong)]"
              >
                <Video className="w-3.5 h-3.5 text-[var(--color-violet-600)]" />
                <span className="flex items-center gap-1">
                  <span>{t('video')}</span>
                  {business.tier && <Crown className="w-3 h-3 text-[var(--color-gold-500)]" />}
                </span>
              </Button>

              <Button
                type="button"
                variant={postMediaType === 'gallery' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPostMediaType('gallery')}
                className="rounded-xl py-2 text-[var(--color-text-strong)]"
              >
                <Tag className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                <span>Galeria de Fotos</span>
              </Button>
            </div>

            <form onSubmit={handleTestAiModerationAndSubmit} className="space-y-5 text-xs">
              <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{t('business.Publicacao')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" size="sm" variant={postPublishMode === 'now' ? 'primary' : 'ghost'} onClick={() => setPostPublishMode('now')}>Publicar agora</Button>
                  <Button type="button" size="sm" variant={postPublishMode === 'scheduled' ? 'primary' : 'ghost'} onClick={() => setPostPublishMode('scheduled')}>{t('business.AgendarPublicacao')}</Button>
                </div>
                {postPublishMode === 'scheduled' && (
                  <label className="mt-3 block font-bold text-[var(--color-text-strong)]">Data e hora <span className="font-normal text-[var(--color-text-muted)]">(Africa/Bissau)</span>
                    <input type="datetime-local" required value={postScheduledAt} onChange={(e) => setPostScheduledAt(e.target.value)} className="mt-1 w-full rounded-xl border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 text-[var(--color-text-strong)]" />
                  </label>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-text-muted)]">1. Mensagem</p>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{t('business.DefinaTituloInformacao')}</p>
                </div>
                <label className="block font-bold text-[var(--color-text-strong)]">{t('title')}<input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Ex: Novo Prato de Peixe Fresco!"
                  className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 text-[var(--color-text-strong)]"
                />
                </label>

                <label className="block font-bold text-[var(--color-text-strong)]">{t('businessNavContent')}<textarea
                  required
                  rows={4}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Descreva a novidade..."
                  className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 text-[var(--color-text-strong)]"
                />
                </label>
              </div>

              {/* 1. Single Image */}
              {postMediaType === 'image' && (
                <div>
                  <label className="block text-[var(--color-text-strong)] font-semibold mb-1">{t('business.ImagemPublicacao')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--color-green-300)] bg-[var(--color-green-50)] px-3 py-3 text-[11px] font-bold text-[var(--color-emerald-800)] hover:bg-[var(--color-emerald-100)]">
                      <span>Carregar</span>
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleLocalPostImage(e.target.files?.[0])} />
                    </label>
                    <input
                      type="url"
                      value={postImageUrl.startsWith('data:') ? '' : postImageUrl}
                      onChange={(e) => setPostImageUrl(e.target.value)}
                      placeholder="Ou inserir URL da imagem..."
                      className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 text-[var(--color-text-strong)]"
                    />
                  </div>
                  {postImageUrl && (
                    <div className="mt-2 h-32 rounded-xl overflow-hidden border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]">
                      <img src={postImageUrl} alt={t('business.PreVisualizacao')} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}

              {/* 2. Video */}
              {postMediaType === 'video' && (
                <div className="bg-[var(--color-violet-50)]/60 p-3.5 rounded-2xl border-[var(--color-violet-200)] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[var(--color-violet-900)] font-extrabold flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-[var(--color-violet-600)]" />
                      <span>{t('business.LinkVideoComercial')}</span>
                    </label>
                    <span className="text-[10px] font-extrabold text-[var(--color-violet-800)] bg-[var(--color-violet-100)] px-2 py-0.5 rounded-md">
                      👑 Recurso para Assinantes de Planos
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--color-violet-300)] bg-[var(--color-violet-100)]/70 px-3 py-3 text-[11px] font-bold text-[var(--color-violet-900)] hover:bg-[var(--color-violet-100)]">
                      <span>Carregar</span>
                      <input type="file" accept="video/*" className="sr-only" onChange={(e) => handleLocalPostVideo(e.target.files?.[0])} />
                    </label>
                    <input
                      type="url"
                      value={postVideoUrl.startsWith('data:') ? '' : postVideoUrl}
                      onChange={(e) => setPostVideoUrl(e.target.value)}
                      placeholder="Ou inserir URL YouTube, Vimeo ou .MP4..."
                      className="w-full bg-[var(--color-bg-surface)] border-[var(--color-violet-200)] rounded-xl p-2.5 text-[var(--color-text-strong)] font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--color-violet-700)]">{t('business.ReprodutorVideoAlta')}</p>
                </div>
              )}

              {/* 3. Photo Gallery */}
              {postMediaType === 'gallery' && (
                <div className="bg-[var(--color-green-50)]/60 p-3.5 rounded-2xl border-[var(--color-green-200)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[var(--color-green-900)] font-extrabold flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[var(--color-green-600)]" />
                      <span>Galeria de Fotos do Estabelecimento</span>
                    </label>
                    <span className="text-[10px] font-bold text-[var(--color-blue-800)] bg-[var(--color-blue-100)] px-2 py-0.5 rounded-md">
                      {dashboardGalleryUrls.length} foto(s)
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--color-green-300)] bg-[var(--color-blue-100)]/70 px-3 py-2 text-[11px] font-bold text-[var(--color-green-900)] hover:bg-[var(--color-blue-100)]">
                      <span>Carregar</span>
                      <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => handleLocalGalleryImages(e.target.files)} />
                    </label>
                    <input
                      type="url"
                      value={newDashboardGalleryInput}
                      onChange={(e) => setNewDashboardGalleryInput(e.target.value)}
                      placeholder="URL da foto (ex: Unsplash, CDN)..."
                      className="flex-1 bg-[var(--color-bg-surface)] border-[var(--color-green-200)] rounded-xl p-2 text-xs text-[var(--color-text-strong)]"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      onClick={() => {
                        if (!newDashboardGalleryInput.trim()) return;
                        setDashboardGalleryUrls((prev) => [...prev, newDashboardGalleryInput.trim()]);
                        setNewDashboardGalleryInput('');
                      }}
                      className="px-3 py-2 bg-[var(--color-green-600)] text-white font-bold rounded-xl text-xs hover:bg-[var(--color-green-700)] flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Anexar</span>
                    </Button>
                  </div>

                  {dashboardGalleryUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {dashboardGalleryUrls.map((url, idx) => (
                        <div key={idx} className="relative h-16 rounded-xl overflow-hidden border-[var(--color-green-200)]">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <IconButton
                            label="Remover imagem"
                            variant="danger"
                            size="sm"
                            type="button"
                            onClick={() => setDashboardGalleryUrls((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-[var(--color-red-600)] text-white p-1 rounded-full text-[10px]"
                          >
                            <X className="w-3 h-3" />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isModerating}
                className="w-full rounded-xl bg-[var(--color-green-600)] text-xs hover:bg-[var(--color-green-700)]"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isModerating ? 'A Analisar...' : 'Validar com IA & Publicar'}</span>
              </Button>
            </form>

            {aiResult && (
              <div
                className={`p-4 rounded-xl border text-xs ${
                  aiResult.status === 'verde'
                    ? 'bg-[var(--color-green-50)] border-[var(--color-green-300)] text-[var(--color-emerald-900)]'
                    : 'bg-[var(--color-red-50)] border-[var(--color-red-300)] text-[var(--color-red-900)]'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Modera��o IA: {aiResult.status.toUpperCase()}</span>
                </div>
                <p className="mt-1">{aiResult.reason}</p>
              </div>
            )}
          </Card>

          <div className="space-y-4 xl:col-span-5">
            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Biblioteca</p>
              <h3 className="mt-1 text-lg font-black text-[var(--color-text-strong)]">{t('business.PublicacoesActivas')}</h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{business.posts.length} publica��o(�es) vis�vel(eis) no perfil.</p>
            </Card>

            {business.posts.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 space-y-2 transition hover:-translate-y-0.5 hover:border-[var(--color-green-300)] hover:shadow-md focus-within:ring-2 focus-within:ring-[var(--color-green-200)]"
                onClick={() => setSelectedBusinessPost(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedBusinessPost(p);
                  }
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--color-text-strong)]">{p.title || 'Publica��o sem t�tulo'}</span>
                  <Badge variant="success" className="px-2 py-0.5 text-[10px]">
                    Aprovado
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{p.content}</p>
                <span className="text-[10px] font-black uppercase tracking-wide text-[var(--color-green-600)]">{t('business.AbrirPublicacao')}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Promotions Tab */}
      {activeTab === 'promotions' && (
        <Card className="mx-auto w-full max-w-3xl overflow-hidden border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[0_22px_60px_-38px_rgba(15,23,42,0.35)]">
          <div className="border-b border-[var(--color-border-subtle)] bg-gradient-to-br from-[var(--color-bg-surface)] via-[var(--color-bg-surface)] to-[var(--color-gold-50)]/60 px-5 py-5 sm:px-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-gold-100)] text-[var(--color-gold-700)]">
                <Tag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black tracking-tight text-[var(--color-text-strong)]">{t('business.CriarNovaPromocao')}</h3>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--color-text-muted)]">
                  {t('business.DestaqueOfertaClara')}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreatePromo} className="space-y-5 p-5 text-xs sm:p-7">
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{t('business.Ativacao')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" size="sm" variant={promoPublishMode === 'now' ? 'primary' : 'ghost'} onClick={() => setPromoPublishMode('now')}>Ativar agora</Button>
                <Button type="button" size="sm" variant={promoPublishMode === 'scheduled' ? 'primary' : 'ghost'} onClick={() => setPromoPublishMode('scheduled')}>{t('business.AgendarInicio')}</Button>
              </div>
              {promoPublishMode === 'scheduled' && (
                <label className="mt-3 block font-bold text-[var(--color-text-strong)]">{t('monetization.start')}<span className="font-normal text-[var(--color-text-muted)]">(Africa/Bissau)</span>
                  <input type="datetime-local" required value={promoScheduledAt} onChange={(e) => setPromoScheduledAt(e.target.value)} className="mt-1 w-full rounded-xl border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 text-[var(--color-text-strong)]" />
                </label>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-black uppercase tracking-wide text-[10px] text-[var(--color-text-muted)]">{t('title')}</label>
              <input
                type="text"
                required
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                placeholder={t('business.AlmocoComOff')}
                className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 text-[var(--color-text-strong)]"
              />
              </div>

              <div>
                <label className="mb-1.5 block font-black uppercase tracking-wide text-[10px] text-[var(--color-text-muted)]">Selo / Badge</label>
              <input
                type="text"
                required
                value={promoBadge}
                onChange={(e) => setPromoBadge(e.target.value)}
                placeholder="Ex: -20% OFF"
                className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 text-[var(--color-text-strong)]"
              />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-black uppercase tracking-wide text-[10px] text-[var(--color-text-muted)]">{t('description')}</label>
              <textarea
                required
                rows={3}
                value={promoDesc}
                onChange={(e) => setPromoDesc(e.target.value)}
                placeholder={t('business.ExpliqueQueEsta')}
                className="min-h-28 w-full resize-y bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 text-[var(--color-text-strong)]"
              />
            </div>

            <div className="space-y-3 rounded-2xl border-[var(--color-gold-200)] bg-[var(--color-gold-50)]/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <label className="block font-black uppercase tracking-wide text-[10px] text-[var(--color-gold-900)]">{t('business.MediaPromocao')}</label>
                  <p className="mt-1 text-[10px] text-[var(--color-gold-800)]/70">{t('business.UseUmaImagem')}</p>
                </div>
                <div className="flex rounded-xl bg-[var(--color-bg-surface)] p-1 border-[var(--color-gold-200)]">
                  <button type="button" onClick={() => setPromoMediaType('image')} className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${promoMediaType === 'image' ? 'bg-[var(--color-gold-500)] text-[var(--color-text-strong)]' : 'text-[var(--color-text-muted)]'}`}>Foto</button>
                  <button type="button" onClick={() => setPromoMediaType('video')} className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${promoMediaType === 'video' ? 'bg-[var(--color-violet-600)] text-white' : 'text-[var(--color-text-muted)]'}`}>{t('video')}</button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--color-gold-300)] bg-[var(--color-bg-surface)] px-3 py-3 text-[11px] font-bold text-[var(--color-gold-900)] hover:bg-[var(--color-gold-100)]">
                  <span>Carregar</span>
                  <input type="file" accept={promoMediaType === 'image' ? 'image/*' : 'video/*'} className="sr-only" onChange={(e) => handleLocalPromoMedia(e.target.files?.[0])} />
                </label>
                <input
                  type="url"
                  value={(promoMediaType === 'image' ? promoImageUrl : promoVideoUrl).startsWith('data:') ? '' : (promoMediaType === 'image' ? promoImageUrl : promoVideoUrl)}
                  onChange={(e) => promoMediaType === 'image' ? setPromoImageUrl(e.target.value) : setPromoVideoUrl(e.target.value)}
                  placeholder={promoMediaType === 'image' ? 'Ou inserir URL de imagem...' : 'Ou inserir URL de v�deo...'}
                  className="w-full bg-[var(--color-bg-surface)] border-[var(--color-gold-200)] rounded-xl p-3 text-[var(--color-text-strong)]"
                />
              </div>
              {promoMediaType === 'image' && promoImageUrl && <img src={promoImageUrl} alt={t('business.PreVisualizacaoPromocao')} className="h-32 w-full rounded-xl object-cover border-[var(--color-gold-200)]" />}
              {promoMediaType === 'video' && promoVideoUrl && <video src={promoVideoUrl} controls className="h-32 w-full rounded-xl object-cover border-[var(--color-violet-200)]" />}
            </div>

            <div className="max-w-sm">
              <label className="mb-1.5 block font-black uppercase tracking-wide text-[10px] text-[var(--color-text-muted)]">{t('business.DiasDuracao')}</label>
              <input
                type="number"
                min={1}
                max={60}
                value={promoDays}
                onChange={(e) => setPromoDays(Number(e.target.value))}
                className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 text-[var(--color-text-strong)]"
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              type="submit"
              className="w-full rounded-xl bg-[var(--color-green-600)] py-3.5 font-black text-white shadow-sm transition hover:bg-[var(--color-green-700)] min-h-[48px]"
            >{t('business.PublicarPromocao')}</Button>
          </form>
        </Card>
      )}

      {/* Reviews & Replies Tab (Section 8) */}
      {activeTab === 'reviews' && (
        <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 rounded-3xl space-y-6 shadow-sm max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-[var(--color-border-subtle)]">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[var(--color-violet-100)] text-[var(--color-violet-900)] px-2.5 py-0.5 rounded font-black text-[10px] uppercase">{t('business.SeccaoAvaliacoesQualitativas')}</span>
                <h3 className="text-base font-extrabold text-[var(--color-text-strong)] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[var(--color-violet-600)]" />
                  <span>{t('business.GestaoAvaliacoesRespostas')}</span>
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('reviews.dashboardHint')}</p>
            </div>
          </div>

          {/* Qualitative Score Summary */}
          {(() => {
            const ratingData = calculateBusinessRating(business.reviews);
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Main Qualitative Badge */}
                <div className="bg-gradient-to-br from-[var(--color-violet-900)] to-[var(--color-blue-950)] text-white p-5 rounded-2xl space-y-2 border-[var(--color-violet-800)] shadow-sm flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-[var(--color-violet-300)]">{t('business.RotuloPredominante')}</span>
                    <div className="text-xl font-black text-[var(--color-gold-300)] flex items-center gap-2">
                      <Award className="w-5 h-5 text-[var(--color-gold-400)]" />
                      <span>{ratingData.ratingLabel}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--color-violet-200)] border-t-[var(--color-violet-800)]/80 pt-2">
                    Baseado em <strong>{ratingData.reviewsCount}</strong>{t('business.AvaliacoesConfirmadasPor')}</div>
                </div>

                {/* Score Breakdown Bar */}
                <div className="md:col-span-2 bg-[var(--color-bg-subtle)] p-4 rounded-2xl border-[var(--color-border-subtle)] space-y-2">
                  <div className="font-extrabold text-[var(--color-text-strong)] text-xs uppercase tracking-wider mb-2">{t('reviews.breakdown')}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-[var(--color-green-50)] border-[var(--color-green-200)] p-2.5 rounded-xl text-center">
                      <div className="text-lg font-black text-[var(--color-emerald-800)]">{ratingData.breakdown.muito_bom}</div>
                      <div className="text-[10px] font-bold text-[var(--color-emerald-700)]">{getQualitativeScoreLabel(currentLang, 'muito_bom')}</div>
                    </div>
                    <div className="bg-[var(--color-gold-50)] border-[var(--color-gold-200)] p-2.5 rounded-xl text-center">
                      <div className="text-lg font-black text-[var(--color-gold-800)]">{ratingData.breakdown.gostei_muito}</div>
                      <div className="text-[10px] font-bold text-[var(--color-gold-700)]">{getQualitativeScoreLabel(currentLang, 'gostei_muito')}</div>
                    </div>
                    <div className="bg-[var(--color-green-50)] border-[var(--color-green-200)] p-2.5 rounded-xl text-center">
                      <div className="text-lg font-black text-[var(--color-blue-800)]">{ratingData.breakdown.gostei}</div>
                      <div className="text-[10px] font-bold text-[var(--color-green-700)]">{getQualitativeScoreLabel(currentLang, 'gostei')}</div>
                    </div>
                    <div className="bg-[var(--color-red-50)] border-[var(--color-red-200)] p-2.5 rounded-xl text-center">
                      <div className="text-lg font-black text-[var(--color-red-800)]">{ratingData.breakdown.nao_gostei}</div>
                      <div className="text-[10px] font-bold text-[var(--color-red-700)]">{getQualitativeScoreLabel(currentLang, 'nao_gostei')}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Customer Reviews List & Response Controls */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider">
              Todas as Avalia��es ({business.reviews.length})
            </h4>

            {business.reviews.length === 0 ? (
              <EmptyState
                title={t('business.AindaNaoRecebeu')}
                description="As avalia��es confirmadas por SMS aparecer�o aqui."
              />
            ) : (
              business.reviews.map((rev) => {
                const labelInfo = QUALITATIVE_SCORE_LABELS[rev.qualitativeScore] || QUALITATIVE_SCORE_LABELS.gostei;
                const isReplying = replyingToReviewId === rev.id;

                return (
                  <div key={rev.id} className="bg-[var(--color-bg-subtle)] p-5 rounded-2xl border-[var(--color-border-subtle)] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[var(--color-text-strong)] text-xs sm:text-sm">{rev.authorName}</span>
                        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">({rev.authorPhone})</span>
                        {rev.verifiedSms && (
                          <span className="bg-[var(--color-emerald-100)] text-[var(--color-emerald-800)] text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-[var(--color-green-600)]" />
                            SMS Confirmado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {new Date(rev.createdAt).toLocaleDateString('pt-PT')}
                        </span>
                        {onFlagReview && (
                          <button type="button"
                            onClick={() => {
                              if (!denyPermission('content')) return;
                              const reason = prompt('Motivo da den�ncia desta avalia��o (ex: difama��o, n�o-cliente):', 'Aprecia��o inadequada');
                              if (reason) {
                                onFlagReview(business.id, rev.id, reason);
                                alert('Den�ncia enviada � administra��o do Guigui.com.');
                              }
                            }}
                            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-red-600)] font-bold flex items-center gap-1 hover:bg-[var(--color-red-50)] px-2 py-1 rounded transition"
                            title={t('business.DenunciarAvaliacaoAbusiva')}
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>Denunciar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black border ${labelInfo.badgeBg}`}>
                        {getQualitativeScoreLabel(currentLang, rev.qualitativeScore)}
                      </span>
                    </div>

                    {rev.comment && (
                      <p className="text-[var(--color-text-strong)] text-xs leading-relaxed bg-[var(--color-bg-surface)] p-3 rounded-xl border-[var(--color-border-subtle)]">
                        "{rev.comment}"
                      </p>
                    )}

                    {/* Owner Public Reply section */}
                    {rev.ownerReply ? (
                      <div className="bg-[var(--color-violet-50)]/80 border-[var(--color-violet-200)] p-3.5 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[var(--color-violet-900)] flex items-center gap-1.5 text-[11px]">
                            <MessageSquare className="w-3.5 h-3.5 text-[var(--color-violet-600)]" />
                            <span>{t('business.SuaRespostaPublica')}</span>
                          </span>
                          <button type="button"
                            onClick={() => {
                              if (!denyPermission('content')) return;
                              setReplyingToReviewId(rev.id);
                              setReplyText(rev.ownerReply || '');
                            }}
                            className="text-[10px] text-[var(--color-violet-700)] hover:underline font-bold"
                          >
                            Editar resposta
                          </button>
                        </div>
                        <p className="text-[var(--color-violet-950)] font-medium leading-relaxed">{rev.ownerReply}</p>
                      </div>
                    ) : (
                      <div>
                        {!isReplying ? (
                          <button type="button"
                            onClick={() => {
                              if (!denyPermission('content')) return;
                              setReplyingToReviewId(rev.id);
                              setReplyText('');
                            }}
                            className="text-xs font-bold text-[var(--color-violet-700)] hover:text-[var(--color-violet-900)] bg-[var(--color-violet-50)] hover:bg-[var(--color-violet-100)] px-3 py-1.5 rounded-xl border-[var(--color-violet-200)] transition flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Responder Publicamente</span>
                          </button>
                        ) : null}
                      </div>
                    )}

                    {/* Active Reply Editor */}
                    {isReplying && (
                      <div className="bg-[var(--color-bg-surface)] p-4 rounded-xl border-[var(--color-violet-300)] space-y-3 shadow-sm text-xs">
                        <div className="font-extrabold text-[var(--color-text-strong)]">
                          {rev.ownerReply ? 'Editar Resposta' : 'Nova Resposta P�blica do Estabelecimento'}
                        </div>
                        <textarea
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={t('business.AgradecaFeedbackCliente')}
                          className="w-full border-[var(--color-border-subtle)] rounded-xl p-2.5 text-[var(--color-text-strong)] text-xs"
                        />
                        <div className="flex gap-2 justify-end">
                          <button type="button"
                            onClick={() => {
                              if (!replyText.trim()) return;
                              if (!denyPermission('content')) return;
                              if (onReplyReview) {
                                onReplyReview(business.id, rev.id, replyText.trim());
                              } else {
                                rev.ownerReply = replyText.trim();
                              }
                              setReplyingToReviewId(null);
                              setReplyText('');
                              alert('Resposta publicada com sucesso na ficha da sua empresa!');
                            }}
                            className="bg-[var(--color-violet-600)] hover:bg-[var(--color-violet-700)] text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                          >
                            Publicar Resposta
                          </button>
                          <button type="button"
                            onClick={() => {
                              setReplyingToReviewId(null);
                              setReplyText('');
                            }}
                            className="bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] font-medium px-3 py-1.5 rounded-xl text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {activeTab === 'team' && (
        <div className="space-y-5">
          <Card className="rounded-3xl border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-black text-[var(--color-text-strong)]"><Users className="h-5 w-5 text-[var(--color-green-600)]" /> {t('business.teamPermissions')}</h2>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('business.ConvideColaboradoresControle')}</p>
              </div>
              <Badge variant="success" className="px-3 py-1 text-[10px]">{teamMembers.filter((member) => member.status === 'active').length} activos</Badge>
            </div>
            {teamNotice && <div className="mt-4 rounded-xl border border-[var(--color-green-200)] bg-[var(--color-green-50)] px-3 py-2 text-xs font-bold text-[var(--color-emerald-800)]" role="status">{teamNotice}</div>}
            <form onSubmit={handleInviteTeamMember} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto] sm:items-end">
              <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">Nome<input required value={teamName} onChange={(event) => setTeamName(event.target.value)} className="mt-1 w-full rounded-xl border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-strong)]" placeholder="Nome do colaborador" /></label>
              <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">E-mail<input required type="email" value={teamEmail} onChange={(event) => setTeamEmail(event.target.value)} className="mt-1 w-full rounded-xl border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-strong)]" placeholder="colaborador@empresa.gw" /></label>
              <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">{t('business.Funcao')}<select value={teamRole} onChange={(event) => setTeamRole(event.target.value as BusinessTeamRole)} className="mt-1 w-full rounded-xl border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-strong)]">{Object.entries(teamRoleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
              <Button type="submit" variant="primary" size="sm" className="min-h-10 rounded-xl bg-[var(--color-green-600)] px-4 py-2 text-xs font-black text-white hover:bg-[var(--color-emerald-700)]"><Plus className="h-4 w-4" />Convidar</Button>
            </form>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            {teamMembers.map((member) => (
              <div key={member.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="text-sm font-black text-[var(--color-text-strong)]">{member.name}</div><div className="text-[11px] text-[var(--color-text-muted)]">{member.email}</div><Badge variant={member.status === 'suspended' ? 'danger' : member.status === 'invited' ? 'warning' : 'success'} className="mt-2 px-2 py-1 text-[10px]">{member.status === 'invited' ? 'Convite pendente' : member.status === 'suspended' ? 'Suspenso' : 'Activo'}</Badge></div>
                  <div className="flex gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => handleTeamStatus(member)} className="rounded-xl border border-[var(--color-border-subtle)] px-2.5 py-2 text-[10px] font-black text-[var(--color-text-strong)] hover:bg-[var(--color-bg-subtle)]">{member.status === 'suspended' ? 'Reactivar' : 'Suspender'}</Button><Button type="button" variant="danger" size="sm" onClick={() => handleRemoveTeamMember(member)} className="rounded-xl border border-[var(--color-red-200)] px-2.5 py-2 text-[10px] font-black text-[var(--color-red-700)] hover:bg-[var(--color-red-50)]">Remover</Button></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(member.permissions).map(([permission, enabled]) => <span key={permission} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${enabled ? 'bg-[var(--color-green-50)] text-[var(--color-green-700)]' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] line-through'}`}>{permission === 'profile' ? 'Perfil' : permission === 'content' ? 'Conte�do' : permission === 'events' ? 'Eventos' : permission === 'tickets' ? 'Bilhetes' : 'Factura��o'}</span>)}</div>
              </div>
            ))}
            {teamMembers.length === 0 && (
              <div className="lg:col-span-2">
                <EmptyState
                  title={t('business.AindaNaoExistem')}
                  description="Envie o primeiro convite acima."
                />
              </div>
            )}
          </div>
          {teamAudit.length > 0 && <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4"><h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-strong)]">{t('business.HistoricoEquipa')}</h3><div className="mt-3 space-y-2">{teamAudit.slice(0, 8).map((entry) => <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-2 text-[11px]"><span><strong>{entry.memberName}</strong> · {entry.action}</span><time className="text-[var(--color-text-muted)]">{new Date(entry.createdAt).toLocaleString('pt-PT')}</time></div>)}</div></div>}
        </div>
      )}

      {/* Billing Tab (Section 4) */}
      {activeTab === 'billing' && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5 max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-[var(--color-border-subtle)]">
            <div>
              <h3 className="text-base font-extrabold text-[var(--color-text-strong)] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[var(--color-green-600)]" />
                <span>{t('business.GestaoSubscricaoFacturacao')}</span>
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Os limites de posts e promo��es v�m do plano configurado. Desconto de {pricingConfig.annualDiscountPercent}% em pagamentos anuais.
              </p>
            </div>

            {/* Billing Frequency Toggle */}
            <div className="bg-[var(--color-bg-subtle)] p-1 rounded-2xl flex items-center gap-1 border border-[var(--color-border-subtle)] text-xs font-bold">
              <button type="button"
                onClick={() => setIsAnnualBilling(false)}
                className={`px-3 py-1.5 rounded-xl transition ${
                  !isAnnualBilling ? 'bg-[var(--color-neutral-0)] text-[var(--color-green-700)] shadow-sm' : 'text-[var(--color-text-muted)]'
                }`}
              >
                Mensal
              </button>
              <button type="button"
                onClick={() => setIsAnnualBilling(true)}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                  isAnnualBilling ? 'bg-[var(--color-neutral-0)] text-[var(--color-green-700)] shadow-sm' : 'text-[var(--color-text-muted)]'
                }`}
              >
                <span>Anual</span>
                <Badge variant="success" className="px-1.5 py-0.5 text-[9px]">
                  -15% OFF
                </Badge>
              </button>
            </div>
          </div>

          {/* Current Subscription Status */}
          <div className="bg-[var(--color-bg-subtle)] p-4 rounded-2xl border border-[var(--color-border-subtle)] grid grid-cols-1 md:grid-cols-4 gap-4 text-xs items-center">
            <div>
              <span className="text-[var(--color-text-muted)] font-medium">{t('business.EscalaoAtual')}</span>
              <div className="font-extrabold text-[var(--color-green-700)] text-sm uppercase mt-0.5 flex items-center gap-1.5">
                <span>{getSubscriptionTierLabel(business.tier)}</span>
                {business.verified && <CheckCircle className="w-4 h-4 text-[var(--color-green-600)]" aria-label="Verificado" />}
              </div>
              <div className={`mt-1 text-[10px] font-black uppercase ${subscriptionAccessState === 'active' ? 'text-[var(--color-emerald-700)]' : 'text-[var(--color-gold-700)]'}`}>
                {subscriptionAccessState === 'active' ? 'Activo' : subscriptionAccessState === 'expired' ? 'Expirado — consulta' : 'Suspenso'}
              </div>
            </div>

            <div>
              <span className="text-[var(--color-text-muted)] font-medium">{t('business.ProximaRenovacao')}</span>
              <div className="font-bold text-[var(--color-text-strong)] text-sm mt-0.5">
                {new Date(business.subscriptionRenewDate).toLocaleDateString('pt-PT')}
              </div>
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] mt-0.5">
                {subscriptionInterval === 'annual' ? 'Plano anual' : 'Plano mensal'} · alertas: 15d, 10d, 5d e 24h
              </div>
            </div>

            <div>
              <span className="text-[var(--color-text-muted)] font-medium">{t('business.MetodoPagamentoAtivo')}</span>
              <div className="font-bold text-[var(--color-emerald-700)] text-sm mt-0.5 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Orange Money (+245 955 *** **)</span>
              </div>
            </div>

            <div>
              <button type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="w-full px-4 py-2.5 bg-[var(--color-green-600)] hover:bg-[var(--color-green-700)] text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-[var(--color-gold-300)]" />
                <span>{t('business.AlterarLibertarEscalao')}</span>
              </button>
            </div>
          </div>

          {/* Configurable Plan Features Comparison */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider">{t('business.ComparativoPlanosDisponiveis')}</h4>
                <p className="text-[10px] text-[var(--color-text-muted)]">{t('business.ValoresBeneficiosSincronizados')}</p>
              </div>
              <span className="rounded-full border border-[var(--color-indigo-200)] bg-[var(--color-indigo-50)] px-2.5 py-1 text-[10px] font-black text-[var(--color-indigo-700)]">{availableSubscriptionPlans.length} plano(s) activo(s)</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 text-xs">
              {availableSubscriptionPlans.map((plan) => {
                const isCurrent = business.planId === plan.id || (!business.planId && business.tier === plan.legacyTier);
                return (
                  <div key={plan.id} className={`p-4 rounded-2xl border space-y-3 ${isCurrent ? 'bg-[var(--color-green-50)]/60 border-[var(--color-green-300)] ring-2 ring-[var(--color-green-600)]' : 'bg-[var(--color-neutral-0)] border-[var(--color-border-subtle)]'}`}>
                    <div className="space-y-1"><div className="flex items-center justify-between gap-2"><div className="font-extrabold text-[var(--color-text-strong)] text-sm">{plan.name}</div>{isCurrent && <span className="rounded-full bg-[var(--color-green-600)] px-2 py-0.5 text-[9px] font-black text-white">{t('business.ActualBadge')}</span>}</div><div className="text-[10px] text-[var(--color-text-muted)]">{plan.price > 0 ? `${plan.price.toLocaleString('pt-PT')} ${plan.currency}${t('business.Mes')}` : t('business.PrecoNegociado')} · v{plan.version}</div></div>
                    <ul className="space-y-2 text-[11px] text-[var(--color-text-strong)]"><li className="flex items-center gap-1.5 font-bold text-[var(--color-green-700)]"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-green-600)] flex-shrink-0" /><span>{limitLabel(plan.postsPerMonth)} {t('business.PostsPorMes')}</span></li><li className="flex items-center gap-1.5 font-bold text-[var(--color-gold-700)]"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-gold-600)] flex-shrink-0" /><span>{limitLabel(plan.promotionsPerMonth)} {t('business.PromocoesPorMes')}</span></li><li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-green-600)] flex-shrink-0" /><span>{limitLabel(plan.maxCategories)} {t('business.CategoriasCount')}</span></li>{plan.featureSlugs.slice(0, 3).map((feature) => <li key={feature} className="flex items-center gap-1.5 text-[10px]"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-green-600)] flex-shrink-0" /><span>{feature.replaceAll('_', ' ')}</span></li>)}</ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-indigo-200)] bg-[var(--color-indigo-50)]/50 p-4 space-y-4">
            <div><h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-indigo-950)]">{t('business.PublicidadeServicosAdicionais')}</h4><p className="mt-1 text-[10px] text-[var(--color-indigo-800)]">{t('business.ProdutosAbaixoVem')}</p></div>
            {monetizationNotice && <div className="rounded-xl border border-[var(--color-green-200)] bg-[var(--color-green-50)] px-3 py-2 text-xs font-bold text-[var(--color-emerald-800)]">{monetizationNotice}</div>}
            <div className="grid gap-3 md:grid-cols-2">
              {resolvedMonetizationCatalog.products.filter((product) => product.isActive && ['advertising', 'push_campaign'].includes(product.type)).map((product) => <div key={product.id} className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><div className="font-black text-[var(--color-text-strong)]">{product.name}</div><div className="mt-1 text-[10px] text-[var(--color-text-muted)]">{product.description}</div></div><Megaphone className="h-4 w-4 shrink-0 text-[var(--color-indigo-600)]" /></div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs font-black text-[var(--color-indigo-700)]">{product.requiresQuote ? t('business.PrecoNegociado') : `${resolveProductPrice(resolvedMonetizationCatalog, product.code, 1, product.periodDays).toLocaleString('pt-PT')} ${product.currency}`}</span><button type="button" onClick={() => handleBuyAdvertising(product.code)} className="rounded-xl bg-[var(--color-indigo-600)] px-3 py-2 text-[10px] font-black text-white hover:bg-[var(--color-indigo-700)]">{product.requiresQuote ? t('business.SolicitarOrcamento') : t('business.Comprar')}</button></div></div>)}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end"><label className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">{t('business.ServicoConteudo')}<select className="mt-1 w-full rounded-xl border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-bold text-[var(--color-text-strong)]" value={selectedContentServiceId} onChange={(e) => setSelectedContentServiceId(e.target.value)}><option value="">{t('business.EscolherServico')}</option>{resolvedMonetizationCatalog.contentServices.filter((service) => service.isActive).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">{t('business.NotasDoPedido')}<textarea className="mt-1 min-h-10 w-full rounded-xl border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text-strong)]" value={contentServiceRequestNote} onChange={(e) => setContentServiceRequestNote(e.target.value)} placeholder={t('business.IndiqueOQuePrecisa')} /></label><button type="button" disabled={!selectedContentServiceId} onClick={() => { const service = resolvedMonetizationCatalog.contentServices.find((item) => item.id === selectedContentServiceId); if (service) void handleRequestContentService(service); }} className="rounded-xl bg-[var(--color-gold-500)] px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{t('business.SolicitarOrcamento')}</button></div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-strong)]">{t('business.HistoricoPagamentosRecibos')}</h4>
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{t('business.ConsulteTransacoesSubscricao')}</p>
              </div>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl border-[var(--color-border-subtle)] px-3 py-2 text-[10px] font-black text-[var(--color-text-strong)] hover:bg-[var(--color-bg-subtle)]">
                <FileDown className="h-3.5 w-3.5" /> Imprimir recibos
              </button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead className="border-b border-[var(--color-border-subtle)] text-[10px] uppercase text-[var(--color-text-muted)]">
                  <tr><th className="px-2 py-2">Data</th><th className="px-2 py-2">{t('description')}</th><th className="px-2 py-2">{t('business.Referencia')}</th><th className="px-2 py-2 text-right">Valor</th><th className="px-2 py-2 text-right">Estado</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {business.subscriptionPaymentId && (
                    <tr>
                      <td className="px-2 py-2 font-mono text-[var(--color-text-muted)]">{new Date(business.subscriptionStartedAt || business.subscriptionRenewDate).toLocaleDateString('pt-PT')}</td>
                      <td className="px-2 py-2 font-bold text-[var(--color-text-strong)]">Subscri��o {getSubscriptionTierLabel(business.tier)}</td>
                      <td className="px-2 py-2 font-mono text-[var(--color-text-muted)]">{business.subscriptionPaymentId}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[var(--color-text-strong)]">{(currentPlan.price || 0).toLocaleString('pt-PT')} XOF</td>
                      <td className="px-2 py-2 text-right font-bold text-[var(--color-emerald-700)]">Confirmado</td>
                    </tr>
                  )}
                  {myBusinessOrders.slice(0, 8).map((order) => (
                    <tr key={order.id}>
                      <td className="px-2 py-2 font-mono text-[var(--color-text-muted)]">{new Date(order.purchasedAt).toLocaleDateString('pt-PT')}</td>
                      <td className="px-2 py-2 font-bold text-[var(--color-text-strong)]">{order.itemTitle}</td>
                      <td className="px-2 py-2 font-mono text-[var(--color-text-muted)]">{order.orderCode}</td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-[var(--color-text-strong)]">{order.totalPriceXOF.toLocaleString('pt-PT')} XOF</td>
                      <td className={`px-2 py-2 text-right font-bold ${order.status === 'cancelled' ? 'text-[var(--color-red-700)]' : 'text-[var(--color-emerald-700)]'}`}>{order.status === 'cancelled' ? 'Cancelado' : 'Pago'}</td>
                    </tr>
                  ))}
                  {!business.subscriptionPaymentId && myBusinessOrders.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-[var(--color-text-muted)]">{t('business.AindaNaoExistem2')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Pricing Matrix & Tarifas Config (4.1, 4.2, 4.3) */}
      {activeTab === 'pricing' && (
        <div className="space-y-6 text-xs">
          {/* Notification Toast */}
          {saveToast && (
            <div className="bg-[var(--color-green-600)] text-white p-4 rounded-2xl shadow-md flex items-center justify-between font-bold animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>{saveToast}</span>
              </div>
              <IconButton label="Fechar aviso" variant="ghost" size="sm" onClick={() => setSaveToast(null)} className="!h-7 !w-7 !border-0 !bg-transparent !text-[var(--color-green-100)] hover:!bg-[var(--color-neutral-0)]/10 hover:!text-white" title="Fechar">
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </IconButton>
            </div>
          )}

          {/* Banner: Rule of 3 Posts & Business Model */}
          <div className="bg-gradient-to-r from-[var(--color-green-900)] via-[var(--color-green-800)] to-[var(--color-green-950)] text-white p-6 rounded-3xl border border-[var(--color-border-strong)] shadow-md space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="bg-[var(--color-gold-400)] text-[var(--color-text-strong)] px-2.5 py-0.5 rounded-lg font-black text-[10px] uppercase tracking-wider">{t('business.ConfiguracaoGestaoComercial')}</span>
                <span className="bg-[var(--color-green-50)]0/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-bold">{t('business.AcessoAdministradorGestao')}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary"
                  onClick={handleExportPricingCsv}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1.5 min-h-[34px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </Button>
                <Button type="button" size="sm" variant="accent"
                  onClick={handleResetPricingDefaults}
                  className="bg-[var(--color-gold-500)]/20 hover:bg-[var(--color-gold-500)]/30 text-[var(--color-amber-200)] font-bold px-3 py-1.5 rounded-xl border border-[var(--color-gold-500)]/30 transition flex items-center gap-1.5 min-h-[34px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('business.RestaurarPadroes')}</span>
                </Button>
              </div>
            </div>

            <h3 className="font-black text-base sm:text-lg text-white">{t('business.MatrizPrecosPor')}</h3>
            <p className="text-[var(--color-text-muted)] leading-relaxed text-[11px] max-w-4xl">
              <strong>Regra Transversal:</strong>{t('business.TodosEscaloesBasico')}<strong>{t('business.PostsMes')}</strong>{t('business.PostsAdicionaisSao')}</p>
          </div>

          {/* Matrix Configuration Card */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-[var(--color-border-subtle)]">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider flex items-center gap-2">
                  <Table className="w-4.5 h-4.5 text-[var(--color-green-600)]" />{t('business.MatrizConfiguravelSubscricao')}</h3>
                <p className="text-[var(--color-text-muted)] text-[11px] mt-0.5">{t('business.CliqueNumaCelula')}</p>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-bold">
                <div className="bg-[var(--color-green-50)] text-[var(--color-emerald-800)] px-3 py-1.5 rounded-xl border border-[var(--color-green-200)] flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                  <span>Desconto Anual: {pricingConfig.annualDiscountPercent}%</span>
                </div>
                <div className="bg-[var(--color-green-50)] text-[var(--color-blue-800)] px-3 py-1.5 rounded-xl border-[var(--color-green-200)] font-mono">
                  Post Extra: {pricingConfig.extraPostPriceXOF.toLocaleString('pt-PT')} XOF
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] text-[var(--color-text-strong)] font-extrabold uppercase text-[10px]">
                    <th className="p-3.5 w-1/3">Grupo de Categoria (Atividade)</th>
                    <th className="p-3.5 text-center">{t('tierBasic')}</th>
                    <th className="p-3.5 text-center">Profissional</th>
                    <th className="p-3.5 text-center">Premium</th>
                    <th className="p-3.5 text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-strong)]">
                  {categoryGroupsList.map((group) => (
                    <tr key={group.id} className="hover:bg-[var(--color-bg-subtle)]/60 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-[var(--color-text-strong)] text-xs">{group.name}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{group.description}</div>
                      </td>

                      {(['basic', 'professional', 'premium', 'enterprise'] as SubscriptionTier[]).map((tier) => {
                        const isEditing =
                          editingCell?.groupId === group.id && editingCell?.tier === tier;
                        const currentPrice = group.prices[tier];
                        const annualDiscountedPrice = Math.round(
                          currentPrice * 12 * (1 - pricingConfig.annualDiscountPercent / 100)
                        );

                        return (
                          <td key={tier} className="p-3 text-center align-top">
                            {isEditing ? (
                              <div className="p-2 bg-[var(--color-green-50)] border border-[var(--color-green-300)] rounded-xl space-y-2 text-[10px] shadow-sm">
                                <label className="block font-bold text-[var(--color-text-strong)]">{t('business.PrecoXofMes')}</label>
                                <input
                                  type="number"
                                  step={1000}
                                  value={editingCell.price}
                                  onChange={(e) =>
                                    setEditingCell({
                                      ...editingCell,
                                      price: Number(e.target.value),
                                    })
                                  }
                                  className="w-full p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg text-center font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-green-600)]"
                                />
                                <div className="flex gap-1 justify-center pt-1">
                                  <button type="button"
                                    onClick={() => handleSaveCellPrice(group.id, tier, editingCell.price)}
                                    className="bg-[var(--color-green-600)] hover:bg-[var(--color-emerald-700)] text-white font-extrabold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Guardar</span>
                                  </button>
                                  <button type="button"
                                    onClick={() => setEditingCell(null)}
                                    className="bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle-dark)] text-[var(--color-text-strong)] font-bold px-2 py-1.5 rounded-lg transition"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() =>
                                  setEditingCell({
                                    groupId: group.id,
                                    tier,
                                    price: currentPrice,
                                  })
                                }
                                title={t('business.CliqueParaEditar')}
                                className="group/cell p-2.5 rounded-xl hover:bg-[var(--color-green-50)]/80 cursor-pointer transition border border-transparent hover:border-[var(--color-green-300)] space-y-1"
                              >
                                <div className="font-black text-[var(--color-text-strong)] font-mono text-xs flex items-center justify-center gap-1">
                                  <span>{currentPrice.toLocaleString('pt-PT')} XOF</span>
                                  <Edit2 className="w-3 h-3 text-[var(--color-text-muted)] group-hover/cell:text-[var(--color-green-600)] opacity-0 group-hover/cell:opacity-100 transition" />
                                </div>
                                <div className="text-[9px] text-[var(--color-text-muted)]">{t('business.Mes')}</div>
                                <div className="text-[9px] text-[var(--color-emerald-800)] font-semibold bg-[var(--color-green-50)] px-1.5 py-0.5 rounded border border-emerald-100">
                                  Anual: {annualDiscountedPrice.toLocaleString('pt-PT')} XOF
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Global Fees and Additional Revenues Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ticket Fees Config */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
              <h3 className="text-sm font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider flex items-center gap-2">
                <Ticket className="w-4.5 h-4.5 text-[var(--color-green-600)]" />{t('business.ConfiguracaoTaxasBilheteira')}</h3>

              <div className="space-y-4">
                <div className="bg-[var(--color-bg-subtle)] p-3.5 rounded-2xl border border-[var(--color-border-subtle)] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[var(--color-text-strong)] text-xs">{t('business.ComissaoPercentualSobre')}</label>
                    <span className="font-mono font-black text-[var(--color-emerald-700)] bg-[var(--color-green-50)] px-2 py-0.5 rounded border border-[var(--color-green-200)]">
                      {pricingConfig.ticketCommissionPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={pricingConfig.ticketCommissionPercent}
                    onChange={(e) => handleUpdateConfigParam('ticketCommissionPercent', Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)]">Percentagem da venda de cada bilhete retida pela plataforma Guigui.com.</p>
                </div>

                <div className="bg-[var(--color-bg-subtle)] p-3.5 rounded-2xl border border-[var(--color-border-subtle)] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[var(--color-text-strong)] text-xs">{t('business.TaxaFixaPor')}</label>
                    <span className="font-mono font-black text-[var(--color-green-700)] bg-[var(--color-green-50)] px-2 py-0.5 rounded border-[var(--color-green-200)]">
                      {pricingConfig.ticketFixedFeeXOF} XOF
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={50}
                      min={0}
                      max={1000}
                      value={pricingConfig.ticketFixedFeeXOF}
                      onChange={(e) => handleUpdateConfigParam('ticketFixedFeeXOF', Number(e.target.value))}
                      className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-2 font-mono text-[var(--color-text-strong)] text-xs font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{t('business.CustoFixoPor')}</p>
                </div>

                {/* Simulation Example */}
                <div className="p-3.5 bg-[var(--color-green-50)]/80 rounded-2xl border border-[var(--color-green-200)] text-[11px] text-emerald-950 space-y-1">
                  <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-900">
                    <Sparkles className="w-4 h-4 text-[var(--color-green-600)]" />
                    <span>{t('business.SimuladorDinamicoExemplo')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                    <div className="bg-white/80 p-2 rounded-xl border border-[var(--color-green-200)]">
                      <span className="text-[var(--color-text-muted)] block">Comiss�o ({pricingConfig.ticketCommissionPercent}%):</span>
                      <span className="font-extrabold text-[var(--color-emerald-800)] font-mono">
                        {(5000 * (pricingConfig.ticketCommissionPercent / 100)).toLocaleString('pt-PT')} XOF
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-[var(--color-green-200)]">
                      <span className="text-[var(--color-text-muted)] block">Taxa Guigui Total:</span>
                      <span className="font-black text-[var(--color-blue-800)] font-mono">
                        {(5000 * (pricingConfig.ticketCommissionPercent / 100) + pricingConfig.ticketFixedFeeXOF).toLocaleString('pt-PT')} XOF
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Revenues Config */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
              <h3 className="text-sm font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4.5 h-4.5 text-[var(--color-gold-600)]" />{t('business.ConfiguracaoReceitasAdicionais')}</h3>

              <div className="space-y-3">
                <div className="p-3 bg-[var(--color-bg-subtle)] rounded-2xl border border-[var(--color-border-subtle)] space-y-1">
                  <label className="font-bold text-[var(--color-text-strong)] text-xs block">{t('business.PrecoPostExtra')}</label>
                  <input
                    type="number"
                    step={500}
                    value={pricingConfig.extraPostPriceXOF}
                    onChange={(e) => handleUpdateConfigParam('extraPostPriceXOF', Number(e.target.value))}
                    className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-2 font-mono text-[var(--color-text-strong)] text-xs font-bold"
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">{t('business.AplicaAposEsgotar')}</span>
                </div>

                <div className="p-3 bg-[var(--color-bg-subtle)] rounded-2xl border border-[var(--color-border-subtle)] space-y-1">
                  <label className="font-bold text-[var(--color-text-strong)] text-xs block">{t('business.PrecoPromocaoExtra')}</label>
                  <input
                    type="number"
                    step={1000}
                    value={pricingConfig.extraPromotionPriceXOF}
                    onChange={(e) => handleUpdateConfigParam('extraPromotionPriceXOF', Number(e.target.value))}
                    className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-2 font-mono text-[var(--color-text-strong)] text-xs font-bold"
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">Compra avulsa de destaque promocional com badge.</span>
                </div>

                <div className="p-3 bg-[var(--color-bg-subtle)] rounded-2xl border border-[var(--color-border-subtle)] space-y-1">
                  <label className="font-bold text-[var(--color-text-strong)] text-xs block">Desconto em Pagamento Anual Antecipado (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={pricingConfig.annualDiscountPercent}
                    onChange={(e) => handleUpdateConfigParam('annualDiscountPercent', Number(e.target.value))}
                    className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-2 font-mono text-[var(--color-text-strong)] text-xs font-bold"
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">{t('business.DescontoPercentualOferecido')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Log / Hist�rico de Altera��es de Pre�o (4.2.c) */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b pb-3 border-[var(--color-border-subtle)]">
              <h3 className="text-sm font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider flex items-center gap-2">
                <History className="w-4.5 h-4.5 text-[var(--color-green-600)]" />{t('business.HistoricoAlteracoesPreco')}</h3>
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold bg-[var(--color-bg-subtle)] px-2.5 py-1 rounded-lg">
                {priceAuditLogs.length} Registos Guardados
              </span>
            </div>

            <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] text-[var(--color-text-muted)] font-bold uppercase text-[10px]">
                    <th className="p-3">Data / Hora</th>
                    <th className="p-3">Grupo de Categoria</th>
                    <th className="p-3 text-center">{t('business.Escalao')}</th>
                    <th className="p-3 text-right">{t('business.PrecoAnterior')}</th>
                    <th className="p-3 text-right">{t('business.NovoPreco')}</th>
                    <th className="p-3 text-right">Utilizador / Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-strong)]">
                  {priceAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--color-bg-subtle)] transition">
                      <td className="p-3 font-mono text-[var(--color-text-muted)]">{log.date}</td>
                      <td className="p-3 font-semibold text-[var(--color-text-strong)]">{log.categoryGroup}</td>
                      <td className="p-3 text-center font-bold uppercase text-[10px] text-[var(--color-green-700)]">{log.tier}</td>
                      <td className="p-3 text-right font-mono text-[var(--color-text-muted)] line-through">
                        {log.oldPrice.toLocaleString('pt-PT')} XOF
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-[var(--color-emerald-700)]">
                        {log.newPrice.toLocaleString('pt-PT')} XOF
                      </td>
                      <td className="p-3 text-right text-[var(--color-text-muted)] font-medium">{log.updatedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BILHETES E HISTÓRICO DE PEDIDOS */}
      {(activeTab === 'tickets' || activeTab === 'order_history') && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Banner */}
          <div className="bg-[var(--color-bg-surface-dark)] border border-[var(--color-border-strong)] rounded-3xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-[var(--color-green-50)]0/20 text-emerald-400 rounded-2xl shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black">
                    {activeTab === 'tickets' ? 'Bilhetes — Levantamentos e vendas' : t('business.orderHistory')}
                  </h2>
                  <span className="bg-[var(--color-green-50)]0/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-emerald-500/30">
                    {filteredOrderHistory.length} de {myBusinessOrders.length} Pedidos
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {activeTab === 'tickets'
                    ? `Acompanhe bilhetes vendidos, pagamentos e levantamentos de ${business.name}.`
                    : `Filtre e exporte o hist�rico completo de pedidos da empresa ${business.name}.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button type="button"
                onClick={handleExportOrdersCsv}
                className="px-4 py-2.5 bg-[var(--color-green-600)] hover:bg-[var(--color-green-50)]0 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
                title={t('business.DescarregarRelatorioPedidos')}
              >
                <FileDown className="w-4 h-4" />
                <span>{activeTab === 'tickets' ? 'Exportar vendas' : 'Exportar CSV'}</span>
              </button>

              <button type="button"
                onClick={handleResetOrderFilters}
                className="px-3.5 py-2.5 bg-[var(--color-bg-surface-dark)] hover:bg-[var(--color-bg-surface-dark)]/80 text-[var(--color-text-muted-dark)] hover:text-white font-bold text-xs rounded-xl border border-[var(--color-border-subtle-dark)]700 transition flex items-center gap-1.5"
                title="Limpar todos os filtros"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restaurar</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-bold">
                <span>Total de Pedidos</span>
                <Package className="w-4 h-4 text-[var(--color-green-600)]" />
              </div>
              <div className="text-base sm:text-lg font-black text-[var(--color-text-strong)] mt-1 font-mono">
                {filteredOrderHistory.length}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                {filteredOrderHistory.length === myBusinessOrders.length ? 'Todos os registos' : 'Ap�s filtros aplicados'}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-bold">
                <span>Volume Faturado</span>
                <DollarSign className="w-4 h-4 text-[var(--color-green-600)]" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-[var(--color-emerald-700)] mt-1 font-mono">
                {totalOrdersAmount.toLocaleString('pt-PT')} <span className="text-xs">XOF</span>
              </div>
              <div className="text-[10px] text-[var(--color-green-600)] font-medium mt-0.5">
                Ticket M�dio: {averageTicketValue.toLocaleString('pt-PT')} XOF
              </div>
            </div>

            <div className="bg-[var(--color-bg-surface)] border-[var(--color-gold-200)] bg-gradient-to-br from-[var(--color-gold-100)]/50 to-[var(--color-bg-surface)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[var(--color-gold-800)] text-xs font-bold">
                <span>{t('business.TransacoesAltoValor')}</span>
                <Crown className="w-4 h-4 text-[var(--color-gold-600)]" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-[var(--color-gold-700)] mt-1 font-mono">
                {countHighValue}
              </div>
              <div className="text-[10px] text-[var(--color-gold-700)] font-bold mt-0.5">
                ≥ 20.000 XOF por pedido
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-bold">
                <span>Levantados / Entregues</span>
                <CheckCircle2 className="w-4 h-4 text-[var(--color-green-600)]" />
              </div>
              <div className="text-base sm:text-lg font-black text-[var(--color-text-strong)] mt-1 font-mono">
                {countRedeemed}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{t('qrRedeemed')}</div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
              <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-bold">
                <span>Pendentes de Entrega</span>
                <Clock className="w-4 h-4 text-[var(--color-gold-600)]" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-[var(--color-gold-600)] mt-1 font-mono">
                {countPending}
              </div>
              <div className="text-[10px] text-[var(--color-gold-600)] font-medium mt-0.5">{t('business.AguardamValidacaoLoja')}</div>
            </div>
          </div>

          {/* Advanced Multi-Filter Control Panel */}
          {activeTab === 'order_history' && (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[var(--color-green-600)]" />
                <span className="text-xs font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider">{t('business.FiltrosPesquisaSegmentacao')}</span>
              </div>
              {(orderDateFilter !== 'all' || orderItemTypeFilter !== 'all' || orderStatusFilter !== 'all' || orderPaymentMethodFilter !== 'all' || orderMinAmount !== '' || orderMaxAmount !== '' || orderSearchQuery) && (
                <button type="button"
                  onClick={handleResetOrderFilters}
                  className="text-[11px] font-bold text-[var(--color-emerald-700)] hover:text-emerald-900 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar Todos os Filtros Ativos</span>
                </button>
              )}
            </div>

            {/* Value Interval Selector for High-Value Transactions */}
            <div className="bg-[var(--color-bg-subtle)] p-3.5 rounded-2xl border border-[var(--color-border-subtle)]/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[var(--color-text-strong)] text-xs font-extrabold">
                  <DollarSign className="w-4 h-4 text-[var(--color-green-600)]" />
                  <span>{t('business.IntervaloValoresMinimo')}</span>
                </div>
                {(orderMinAmount !== '' || orderMaxAmount !== '') && (
                  <span className="text-[11px] font-mono text-[var(--color-emerald-800)] bg-[var(--color-emerald-100)] font-bold px-2 py-0.5 rounded-md">
                    Filtro Ativo: {orderMinAmount !== '' ? `${Number(orderMinAmount).toLocaleString('pt-PT')} XOF` : '0 XOF'} at� {orderMaxAmount !== '' ? `${Number(orderMaxAmount).toLocaleString('pt-PT')} XOF` : 'Sem Limite'}
                  </span>
                )}
              </div>

              {/* Quick Value Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleApplyValuePreset('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    orderValuePreset === 'all' && orderMinAmount === '' && orderMaxAmount === ''
                      ? 'bg-[var(--color-bg-surface-dark)] text-white shadow-xs'
                      : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-subtle)]'
                  }`}
                >
                  Todos os Valores
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyValuePreset('high_val')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                    orderValuePreset === 'high_val'
                      ? 'bg-[var(--color-gold-600)] text-white shadow-xs'
                      : 'bg-[var(--color-gold-50)] text-[var(--color-gold-900)] border-[var(--color-gold-200)] hover:bg-[var(--color-gold-100)]'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-[var(--color-gold-500)]" />
                  <span>Alto Valor (&gt; 20.000 XOF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyValuePreset('very_high')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                    orderValuePreset === 'very_high'
                      ? 'bg-[var(--color-violet-700)] text-white shadow-xs'
                      : 'bg-[var(--color-violet-50)] text-[var(--color-violet-900)] border-[var(--color-violet-200)] hover:bg-[var(--color-violet-100)]'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 text-[var(--color-gold-300)]" />
                  <span>VIP (&gt; 50.000 XOF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyValuePreset('top_tier')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                    orderValuePreset === 'top_tier'
                      ? 'bg-[var(--color-emerald-700)] text-white shadow-xs'
                      : 'bg-[var(--color-green-50)] text-emerald-900 border border-[var(--color-green-200)] hover:bg-[var(--color-emerald-100)]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                  <span>Top (&gt; 100.000 XOF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyValuePreset('under_10k')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    orderValuePreset === 'under_10k'
                      ? 'bg-[var(--color-green-600)] text-white shadow-xs'
                      : 'bg-[var(--color-green-50)] text-[var(--color-green-900)] border-[var(--color-green-200)] hover:bg-[var(--color-blue-100)]'
                  }`}
                >
                  Pequeno Valor (&lt; 10.000 XOF)
                </button>
              </div>

              {/* Exact Min & Max Number Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-text-muted)] block mb-1">{t('business.ValorMinimoXof')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={orderMinAmount}
                      onChange={(e) => {
                        setOrderMinAmount(e.target.value === '' ? '' : Number(e.target.value));
                        setOrderValuePreset('custom');
                      }}
                      placeholder="Ex: 20000"
                      className="w-full pl-3 pr-12 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl text-xs font-mono font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                    />
                    <span className="absolute right-3 top-2 text-[10px] font-mono text-[var(--color-text-muted)] font-bold">
                      XOF
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-text-muted)] block mb-1">{t('business.ValorMaximoXof')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={orderMaxAmount}
                      onChange={(e) => {
                        setOrderMaxAmount(e.target.value === '' ? '' : Number(e.target.value));
                        setOrderValuePreset('custom');
                      }}
                      placeholder="Ex: 200000"
                      className="w-full pl-3 pr-12 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl text-xs font-mono font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                    />
                    <span className="absolute right-3 top-2 text-[10px] font-mono text-[var(--color-text-muted)] font-bold">
                      XOF
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* 1. FILTRO POR DATA */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[var(--color-text-strong)] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                  <span>Filtrar por Data</span>
                </label>
                <select
                  value={orderDateFilter}
                  onChange={(e) => setOrderDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl text-xs font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todas as Datas</option>
                  <option value="today">Hoje</option>
                  <option value="7days">{t('business.UltimosDias')}</option>
                  <option value="30days">{t('business.UltimosDias2')}</option>
                  <option value="custom">Personalizado (Intervalo)</option>
                </select>

                {/* Custom Date Inputs if 'custom' is selected */}
                {orderDateFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in">
                    <div>
                      <span className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold block mb-0.5">De:</span>
                      <input
                        type="date"
                        value={orderDateFrom}
                        onChange={(e) => setOrderDateFrom(e.target.value)}
                        className="w-full p-1.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-lg text-[11px] font-mono text-[var(--color-text-strong)]"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--color-text-muted)] uppercase font-bold block mb-0.5">{t('business.Ate')}</span>
                      <input
                        type="date"
                        value={orderDateTo}
                        onChange={(e) => setOrderDateTo(e.target.value)}
                        className="w-full p-1.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-lg text-[11px] font-mono text-[var(--color-text-strong)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. FILTRO POR TIPO DE ITEM */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[var(--color-text-strong)] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                  <span>Tipo de Item</span>
                </label>
                <select
                  value={orderItemTypeFilter}
                  onChange={(e) => setOrderItemTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl text-xs font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todos os Tipos de Item</option>
                  <option value="product">{t('business.ProdutosFisicosLoja')}</option>
                  <option value="promotion">{t('business.PromocoesCupoes')}</option>
                  <option value="ticket">Bilhetes de Eventos</option>
                  <option value="service">{t('business.ServicosEntregas')}</option>
                </select>
              </div>

              {/* 3. FILTRO POR STATUS DE PAGAMENTO / LEVANTAMENTO */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[var(--color-text-strong)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                  <span>Status do Pedido / Pagamento</span>
                </label>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl text-xs font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todos os Estados</option>
                  <option value="pending">Pendente (Aguardando Entrega)</option>
                  <option value="redeemed">{t('business.LevantadoConcluidoPago')}</option>
                  <option value="cancelled">Cancelado / Devolvido</option>
                </select>
              </div>

              {/* 4. FILTRO POR M�TODO DE PAGAMENTO */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-[var(--color-text-strong)] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[var(--color-violet-600)]" />
                  <span>{t('business.MetodoPagamento')}</span>
                </label>
                <select
                  value={orderPaymentMethodFilter}
                  onChange={(e) => setOrderPaymentMethodFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl text-xs font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">{t('business.TodosMetodos')}</option>
                  <option value="orange_money">Orange Money Bissau</option>
                  <option value="telecel">Telecel Cash Bissau</option>
                  <option value="cash">Pagamento no Local (Dinheiro)</option>
                </select>
              </div>
            </div>

            {/* Bottom Row: Text Search & Sorting */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder={t('business.searchOrders')}
                  className="w-full pl-10 pr-9 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl text-xs text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {orderSearchQuery && (
                  <button type="button"
                    onClick={() => setOrderSearchQuery('')}
                    className="absolute right-3 top-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] text-xs font-bold"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <span className="text-[11px] font-bold text-[var(--color-text-muted)] whitespace-nowrap">Ordenar por:</span>
                <select
                  value={orderSortBy}
                  onChange={(e) => setOrderSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl text-xs font-bold text-[var(--color-text-strong)] focus:outline-none"
                >
                  <option value="date_desc">Mais Recentes</option>
                  <option value="date_asc">Mais Antigos</option>
                  <option value="price_desc">Maior Valor (XOF)</option>
                  <option value="price_asc">Menor Valor (XOF)</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Orders List Table */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[var(--color-green-600)]" />
                <span>
                  {activeTab === 'tickets' ? 'Bilhetes e levantamentos' : 'Resultados do hist�rico'} ({filteredOrderHistory.length} registos)
                </span>
              </h3>
              <div className="text-[11px] text-[var(--color-text-muted)] font-medium">
                {business.name} • Sistema de Bilh�tica e Checkout Guigui.com
              </div>
            </div>

            {filteredOrderHistory.length === 0 ? (
              <EmptyState
                title={t('business.noOrders')}
                description="Tente alterar o per�odo de datas, o tipo de item selecionado ou limpe a barra de pesquisa para visualizar todos os pedidos."
                actionLabel="Limpar Todos os Filtros"
                onAction={handleResetOrderFilters}
                actionVariant="primary"
                icon={<ShoppingBag className="w-6 h-6" />}
              />
            ) : (
              <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] font-extrabold text-[var(--color-text-strong)] uppercase text-[10px]">
                      <th className="p-3.5">{t('business.CodigoToken')}</th>
                      <th className="p-3.5">Data & Hora</th>
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5">Item & Tipo</th>
                      <th className="p-3.5 text-right">Valor & Pagamento</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">{t('business.Acoes')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-strong)]">
                    {filteredOrderHistory.map((order) => {
                      const isPending = order.status === 'pending';
                      const isRedeemed = order.status === 'redeemed';
                      const isCancelled = order.status === 'cancelled';

                      return (
                        <tr key={order.id} className="hover:bg-[var(--color-bg-subtle)]/80 transition">
                          
                          {/* C�digo & QR Token */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-[var(--color-text-strong)] bg-[var(--color-bg-subtle)] px-2 py-0.5 rounded-md border border-[var(--color-border-subtle)]">
                                {order.orderCode}
                              </span>
                              <button type="button"
                                onClick={() => handleCopyCode(order.orderCode)}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] p-1"
                                title={t('business.CopiarCodigo')}
                              >
                                {copiedCode === order.orderCode ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[130px] mt-0.5">
                              {order.qrToken}
                            </div>
                          </td>

                          {/* Data & Hora */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-bold text-[var(--color-text-strong)]">
                              {new Date(order.purchasedAt).toLocaleDateString('pt-PT', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
                              {new Date(order.purchasedAt).toLocaleTimeString('pt-PT', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Cliente */}
                          <td className="p-3.5">
                            <div className="font-extrabold text-[var(--color-text-strong)]">{order.customerName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <a
                                href={`tel:${order.customerPhone}`}
                                className="text-[10px] text-[var(--color-green-600)] hover:underline flex items-center gap-0.5 font-medium"
                                title="Ligar para o cliente"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{order.customerPhone}</span>
                              </a>
                              <a
                                href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}?text=Ol�%20${encodeURIComponent(order.customerName)},%20contacto%20do%20${encodeURIComponent(business.name)}%20sobre%20o%20pedido%20${order.orderCode}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-[var(--color-green-600)] hover:underline flex items-center gap-0.5 font-medium"
                                title="Enviar mensagem no WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                          </td>

                          {/* Item & Tipo */}
                          <td className="p-3.5">
                            <div className="font-bold text-[var(--color-text-strong)] max-w-xs">{order.itemTitle}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  order.itemType === 'product'
                                    ? 'bg-[var(--color-blue-100)] text-[var(--color-blue-800)]'
                                    : order.itemType === 'promotion'
                                    ? 'bg-[var(--color-gold-100)] text-[var(--color-gold-800)]'
                                    : order.itemType === 'ticket'
                                    ? 'bg-[var(--color-violet-100)] text-[var(--color-violet-800)]'
                                    : 'bg-[var(--color-green-100)] text-[var(--color-green-800)]'
                                }`}
                              >
                                {order.itemType === 'product'
                                  ? 'Produto'
                                  : order.itemType === 'promotion'
                                  ? 'Voucher / Desconto'
                                  : order.itemType === 'ticket'
                                  ? 'Bilhete'
                                  : 'Servi�o'}
                              </span>
                              <span className="text-[10px] text-[var(--color-text-muted)] font-bold">
                                Qtd: {order.quantity}x
                              </span>
                            </div>
                          </td>

                          {/* Valor & Pagamento */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="font-mono font-black text-sm text-[var(--color-emerald-700)] flex items-center justify-end gap-1.5">
                              {order.totalPriceXOF >= 50000 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--color-violet-100)] text-purple-800 border-[var(--color-violet-200)] text-[9px] font-extrabold uppercase font-sans">
                                  <Crown className="w-3 h-3 text-[var(--color-violet-700)]" />
                                  <span>VIP</span>
                                </span>
                              )}
                              {order.totalPriceXOF >= 20000 && order.totalPriceXOF < 50000 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--color-gold-100)] text-[var(--color-gold-800)] border-[var(--color-gold-200)] text-[9px] font-extrabold uppercase font-sans">
                                  <Star className="w-3 h-3 fill-amber-400 text-[var(--color-gold-600)]" />
                                  <span>Alto Valor</span>
                                </span>
                              )}
                              <span>
                                {order.totalPriceXOF === 0 ? (
                                  <span className="text-[var(--color-green-600)] font-extrabold">{t('business.GratisCupao')}</span>
                                ) : (
                                  `${order.totalPriceXOF.toLocaleString('pt-PT')} XOF`
                                )}
                              </span>
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted)] uppercase font-medium mt-0.5">
                              {order.paymentMethod === 'orange_money'
                                ? 'Orange Money'
                                : order.paymentMethod === 'telecel'
                                ? 'Telecel Cash'
                                : 'No Local'}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {isRedeemed && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[var(--color-emerald-100)] text-[var(--color-emerald-800)] border border-[var(--color-green-200)]">
                                <CheckCircle2 className="w-3 h-3 text-[var(--color-green-600)]" />
                                <span>Levantado / Pago</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[var(--color-gold-100)] text-[var(--color-gold-800)] border-[var(--color-gold-200)] animate-pulse">
                                <Clock className="w-3 h-3 text-[var(--color-gold-600)]" />
                                <span>Pendente</span>
                              </span>
                            )}
                            {isCancelled && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[var(--color-red-100)] text-[var(--color-red-800)] border border-[var(--color-red-200)]">
                                <XCircle className="w-3 h-3 text-[var(--color-red-600)]" />
                                <span>Cancelado</span>
                              </span>
                            )}
                          </td>

                          {/* A��es */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button"
                                onClick={() => setSelectedOrderDetails(order)}
                                className="p-1.5 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle-dark)] text-[var(--color-text-strong)] rounded-lg transition font-bold text-[11px] flex items-center gap-1"
                                title="Ver Detalhes do Pedido e Recibo"
                              >
                                <Receipt className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                <span className="hidden md:inline">Recibo</span>
                              </button>

                              {isPending && onValidatePurchaseOrder && (
                                <button type="button"
                                  onClick={() => { if (denyPermission('tickets')) onValidatePurchaseOrder(order.id, business.name); }}
                                  className="px-2.5 py-1.5 bg-[var(--color-green-600)] hover:bg-[var(--color-emerald-700)] active:scale-95 text-white font-extrabold text-[11px] rounded-lg transition shadow-xs flex items-center gap-1"
                                  title="Marcar como entregue / levantado"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Entregar</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal de Detalhes do Pedido & Recibo Imprim�vel */}
          {selectedOrderDetails && (
            <div
              className="fixed inset-0 z-50 bg-[var(--color-bg-surface-dark)]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedOrderDetails(null);
              }}
            >
              <div className="bg-[var(--color-bg-surface)] rounded-3xl max-w-lg w-full shadow-2xl border border-[var(--color-border-subtle)] p-6 space-y-6 text-[var(--color-text-strong)] my-auto animate-in zoom-in-95 duration-150">
                {/* Modal Top Header */}
                <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-[var(--color-emerald-100)] text-[var(--color-emerald-700)] rounded-xl">
                      <Receipt className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-black text-base text-[var(--color-text-strong)]">Comprovativo de Pedido</h3>
                      <p className="text-[11px] text-[var(--color-text-muted)] font-mono">ID: {selectedOrderDetails.orderCode}</p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => setSelectedOrderDetails(null)}
                    className="p-1.5 rounded-full hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* QR Code & Status Badge */}
                <div className="flex flex-col items-center justify-center p-4 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-2xl space-y-3 text-center">
                  <div className="bg-[var(--color-neutral-0)] p-3 rounded-2xl shadow-sm border border-[var(--color-border-subtle)]">
                    <QRCodeDisplay code={selectedOrderDetails.orderCode} qrToken={selectedOrderDetails.qrToken} title={selectedOrderDetails.itemTitle} buyerName={selectedOrderDetails.customerName} buyerPhone={selectedOrderDetails.customerPhone} amountXOF={selectedOrderDetails.totalPriceXOF} currentLang={currentLang} />
                  </div>
                  <div className="font-mono text-xs font-black text-[var(--color-text-strong)] tracking-wider">
                    {selectedOrderDetails.qrToken}
                  </div>
                  <div>
                    {selectedOrderDetails.status === 'redeemed' && (
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--color-emerald-100)] text-[var(--color-emerald-800)] border border-[var(--color-green-200)] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                        <span>{t('business.LevantamentoConcluido')}</span>
                      </span>
                    )}
                    {selectedOrderDetails.status === 'pending' && (
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--color-gold-100)] text-[var(--color-gold-800)] border-[var(--color-gold-200)] flex items-center gap-1 animate-pulse">
                        <Clock className="w-3.5 h-3.5 text-[var(--color-gold-600)]" />
                        <span>Aguardando Levantamento na Loja</span>
                      </span>
                    )}
                    {selectedOrderDetails.status === 'cancelled' && (
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--color-red-100)] text-[var(--color-red-800)] border border-[var(--color-red-200)] flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-[var(--color-red-600)]" />
                        <span>Pedido Cancelado</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Order Details Breakdown */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">Empresa Vendedora:</span>
                    <span className="font-black text-[var(--color-text-strong)]">{business.name}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">Cliente / Comprador:</span>
                    <span className="font-extrabold text-[var(--color-text-strong)]">{selectedOrderDetails.customerName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">Telefone de Contacto:</span>
                    <span className="font-mono font-bold text-[var(--color-text-strong)]">{selectedOrderDetails.customerPhone}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">Item Comprado:</span>
                    <span className="font-bold text-[var(--color-text-strong)] text-right">{selectedOrderDetails.itemTitle}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">Quantidade:</span>
                    <span className="font-bold text-[var(--color-text-strong)]">{selectedOrderDetails.quantity} unidade(s)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">{t('business.MetodoPagamento2')}</span>
                    <span className="font-bold text-[var(--color-text-strong)] uppercase">{selectedOrderDetails.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">Data & Hora da Compra:</span>
                    <span className="font-mono text-[var(--color-text-strong)]">{new Date(selectedOrderDetails.purchasedAt).toLocaleString('pt-PT')}</span>
                  </div>
                  {selectedOrderDetails.redeemedAt && (
                    <div className="flex justify-between py-1.5 border-b border-[var(--color-border-subtle)]">
                      <span className="text-[var(--color-text-muted)] font-bold">Data do Levantamento:</span>
                      <span className="font-mono text-[var(--color-emerald-700)] font-bold">{new Date(selectedOrderDetails.redeemedAt).toLocaleString('pt-PT')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 text-sm font-black">
                    <span className="text-[var(--color-text-strong)]">Total Pago:</span>
                    <span className="text-[var(--color-emerald-700)] font-mono text-base">
                      {selectedOrderDetails.totalPriceXOF.toLocaleString('pt-PT')} XOF
                    </span>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
                  <button type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2.5 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle-dark)] text-[var(--color-text-strong)] font-bold text-xs rounded-xl transition flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4 text-[var(--color-text-muted)]" />
                    <span>Imprimir Comprovativo</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {selectedOrderDetails.status === 'pending' && onValidatePurchaseOrder && (
                      <button type="button"
                        onClick={() => {
                          onValidatePurchaseOrder(selectedOrderDetails.id, business.name);
                          setSelectedOrderDetails((prev) => prev ? { ...prev, status: 'redeemed', redeemedAt: new Date().toISOString() } : null);
                        }}
                        className="px-4 py-2.5 bg-[var(--color-green-600)] hover:bg-[var(--color-emerald-700)] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Validar & Entregar</span>
                      </button>
                    )}
                    <button type="button"
                      onClick={() => setSelectedOrderDetails(null)}
                      className="px-4 py-2.5 bg-[var(--color-bg-surface-dark)] hover:bg-[var(--color-bg-surface-dark)]/80 text-white font-bold text-xs rounded-xl transition"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: REDEMPTIONS / LEVANTAMENTOS */}
      {activeTab === 'redemptions' && (
        <div className="space-y-6">
          <div className="bg-[var(--color-bg-surface-dark)] border border-[var(--color-border-strong)] rounded-3xl p-6 text-white space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-[var(--color-green-50)]0/20 text-emerald-400 rounded-xl">
                <QrCode className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black">{t('business.ValidacaoLevantamentosCodigos')}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Confirme a entrega de compras, bilhetes e vouchers apresentados pelos clientes do Guigui.com.
                </p>
              </div>
            </div>
          </div>

          {/* Code Validation Input Form */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
            <h3 className="text-sm font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider flex items-center gap-2">
              <Search className="w-4.5 h-4.5 text-[var(--color-green-600)]" />
              <span>{t('business.ValidarCodigoLevantamento')}</span>
            </h3>

            <form onSubmit={handleValidateCode} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <QrCode className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={redemptionCodeInput}
                  onChange={(e) => setRedemptionCodeInput(e.target.value)}
                  placeholder={t('business.IntroduzaCodigoLev')}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-2xl text-xs font-mono font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-3 bg-[var(--color-green-600)] hover:bg-[var(--color-emerald-700)] text-white font-black text-xs rounded-2xl shadow-md transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Validar & Entregar</span>
              </button>
            </form>

            {redemptionMessage && (
              <div
                className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-3 animate-in fade-in ${
                  redemptionMessage.type === 'success'
                    ? 'bg-[var(--color-green-50)] border-emerald-300 text-emerald-950'
                    : redemptionMessage.type === 'error'
                    ? 'bg-[var(--color-red-50)] border-red-300 text-red-950'
                    : 'bg-[var(--color-green-50)] border-[var(--color-green-300)] text-blue-950'
                }`}
              >
                {redemptionMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-[var(--color-green-600)] shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[var(--color-gold-600)] shrink-0 mt-0.5" />
                )}
                <span>{redemptionMessage.text}</span>
              </div>
            )}
          </div>

          {/* List of Orders for this Business */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--color-text-strong)] uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4.5 h-4.5 text-[var(--color-green-600)]" />
                <span>Hist�rico de Compras & Reservas Registadas ({myBusinessOrders.length})</span>
              </h3>

              <input
                type="text"
                placeholder="Filtrar por nome ou telefone..."
                value={redemptionFilter}
                onChange={(e) => setRedemptionFilter(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl text-xs text-[var(--color-text-strong)]"
              />
            </div>

            {myBusinessOrders.length === 0 ? (
              <EmptyState
                title={t('business.AindaNaoCompras')}
                description="As compras e reservas confirmadas aparecer�o neste hist�rico."
              />
            ) : (
              <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] font-extrabold text-[var(--color-text-strong)] uppercase text-[10px]">
                      <th className="p-3">{t('business.CodigoToken2')}</th>
                      <th className="p-3">Item Comprado</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-right">{t('business.Acao')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-strong)]">
                    {myBusinessOrders
                      .filter(
                        (ord) =>
                          !redemptionFilter ||
                          ord.customerName.toLowerCase().includes(redemptionFilter.toLowerCase()) ||
                          ord.customerPhone.includes(redemptionFilter) ||
                          ord.orderCode.toLowerCase().includes(redemptionFilter.toLowerCase())
                      )
                      .map((ord) => (
                        <tr key={ord.id} className="hover:bg-[var(--color-bg-subtle)] transition">
                          <td className="p-3 font-mono font-bold text-[var(--color-text-strong)]">
                            <div>{ord.orderCode}</div>
                            <div className="text-[9px] text-[var(--color-text-muted)] font-normal">{ord.qrToken}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-extrabold text-[var(--color-text-strong)]">{ord.itemTitle}</div>
                            <div className="text-[10px] text-[var(--color-text-muted)] uppercase">{ord.itemType} ({ord.quantity}x)</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-[var(--color-text-strong)]">{ord.customerName}</div>
                            <div className="text-[10px] text-[var(--color-text-muted)]">{ord.customerPhone}</div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-[var(--color-emerald-700)]">
                            {ord.totalPriceXOF.toLocaleString('pt-PT')} XOF
                          </td>
                          <td className="p-3 text-center">
                            {ord.status === 'redeemed' ? (
                              <span className="bg-[var(--color-emerald-100)] text-[var(--color-emerald-800)] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-[var(--color-green-600)]" /> Entregue
                              </span>
                            ) : (
                              <span className="bg-[var(--color-gold-100)] text-[var(--color-gold-800)] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[var(--color-gold-600)]" /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForQr(ord)}
                                className="px-2.5 py-1 bg-[var(--color-bg-surface-dark)] hover:bg-[var(--color-bg-surface-dark)]/80 text-emerald-400 font-extrabold text-[11px] rounded-lg transition flex items-center gap-1 shadow-sm"
                                title="Ver QR Code do Pedido"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>QR Code</span>
                              </button>
                              {ord.status === 'pending' && (
                                <button type="button"
                                  onClick={() => {
                                    if (onValidatePurchaseOrder) {
                                      onValidatePurchaseOrder(ord.id, business.name);
                                      setRedemptionMessage({
                                        text: `Entregue a ${ord.customerName} com sucesso!`,
                                        type: 'success',
                                      });
                                    }
                                  }}
                                  className="px-3 py-1 bg-[var(--color-green-600)] hover:bg-[var(--color-emerald-700)] text-white font-bold text-[11px] rounded-lg transition"
                                >
                                  Confirmar Entrega
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Relat�rios e Estat�sticas (Recharts) */}
      {activeTab === 'analytics' && (() => {
        // Daily Data for Ticket & Product Sales
        const dailySalesData = [
          { period: 'Segunda', bilhetesQtd: 12, produtosQtd: 8, bilhetesXOF: 120000, produtosXOF: 40000, totalXOF: 160000 },
          { period: 'Ter�a', bilhetesQtd: 18, produtosQtd: 14, bilhetesXOF: 180000, produtosXOF: 70000, totalXOF: 250000 },
          { period: 'Quarta', bilhetesQtd: 25, produtosQtd: 19, bilhetesXOF: 250000, produtosXOF: 95000, totalXOF: 345000 },
          { period: 'Quinta', bilhetesQtd: 32, produtosQtd: 22, bilhetesXOF: 320000, produtosXOF: 110000, totalXOF: 430000 },
          { period: 'Sexta', bilhetesQtd: 55, produtosQtd: 38, bilhetesXOF: 550000, produtosXOF: 190000, totalXOF: 740000 },
          { period: 'S�bado', bilhetesQtd: 80, produtosQtd: 52, bilhetesXOF: 800000, produtosXOF: 260000, totalXOF: 1060000 },
          { period: 'Domingo', bilhetesQtd: 64, produtosQtd: 41, bilhetesXOF: 640000, produtosXOF: 205000, totalXOF: 845000 },
        ];

        // Weekly Data for Ticket & Product Sales
        const weeklySalesData = [
          { period: 'Semana 1', bilhetesQtd: 180, produtosQtd: 120, bilhetesXOF: 1800000, produtosXOF: 600000, totalXOF: 2400000 },
          { period: 'Semana 2', bilhetesQtd: 210, produtosQtd: 145, bilhetesXOF: 2100000, produtosXOF: 725000, totalXOF: 2825000 },
          { period: 'Semana 3', bilhetesQtd: 260, produtosQtd: 170, bilhetesXOF: 2600000, produtosXOF: 850000, totalXOF: 3450000 },
          { period: 'Semana 4', bilhetesQtd: 310, produtosQtd: 215, bilhetesXOF: 3100000, produtosXOF: 1075000, totalXOF: 4175000 },
        ];

        // Views & Direct Engagement Clicks (Daily)
        const dailyEngagementData = [
          { period: 'Segunda', visualizacoes: 420, cliquesWhatsapp: 38, chamadasVoz: 19, direcoesMapa: 24 },
          { period: 'Ter�a', visualizacoes: 510, cliquesWhatsapp: 45, chamadasVoz: 22, direcoesMapa: 31 },
          { period: 'Quarta', visualizacoes: 580, cliquesWhatsapp: 52, chamadasVoz: 28, direcoesMapa: 39 },
          { period: 'Quinta', visualizacoes: 690, cliquesWhatsapp: 64, chamadasVoz: 34, direcoesMapa: 45 },
          { period: 'Sexta', visualizacoes: 980, cliquesWhatsapp: 95, chamadasVoz: 51, direcoesMapa: 78 },
          { period: 'S�bado', visualizacoes: 1340, cliquesWhatsapp: 142, chamadasVoz: 76, direcoesMapa: 110 },
          { period: 'Domingo', visualizacoes: 1120, cliquesWhatsapp: 118, chamadasVoz: 62, direcoesMapa: 89 },
        ];

        // Views & Direct Engagement Clicks (Weekly)
        const weeklyEngagementData = [
          { period: 'Semana 1', visualizacoes: 3200, cliquesWhatsapp: 310, chamadasVoz: 165, direcoesMapa: 240 },
          { period: 'Semana 2', visualizacoes: 3850, cliquesWhatsapp: 390, chamadasVoz: 195, direcoesMapa: 290 },
          { period: 'Semana 3', visualizacoes: 4600, cliquesWhatsapp: 480, chamadasVoz: 240, direcoesMapa: 360 },
          { period: 'Semana 4', visualizacoes: 5650, cliquesWhatsapp: 554, chamadasVoz: 280, direcoesMapa: 420 },
        ];

        // Promotions Performance Data
        const promoPerformanceData = [
          {
            titulo: 'Desconto 20% Prato de Peixe',
            visualizacoes: 1840,
            resgates: 142,
            cliquesWhatsapp: 88,
            conversao: 7.7,
            desconto: '20% OFF',
          },
          {
            titulo: 'Menu Almo�o Crioulo Especial',
            visualizacoes: 2450,
            resgates: 215,
            cliquesWhatsapp: 130,
            conversao: 8.8,
            desconto: 'Pre�o Fixo 3.500 XOF',
          },
          {
            titulo: 'Happy Hour Chopp & Petisco 2x1',
            visualizacoes: 2980,
            resgates: 312,
            cliquesWhatsapp: 175,
            conversao: 10.5,
            desconto: 'Leve 2 Pague 1',
          },
          {
            titulo: 'Jantar Rom�ntico com M�sica ao Vivo',
            visualizacoes: 1290,
            resgates: 94,
            cliquesWhatsapp: 62,
            conversao: 7.3,
            desconto: '15% OFF Casal',
          },
          {
            titulo: 'Feijoada Completa de S�bado',
            visualizacoes: 1680,
            resgates: 128,
            cliquesWhatsapp: 75,
            conversao: 7.6,
            desconto: 'Sobremesa Gr�tis',
          },
        ];

        const chartData = analyticsTimeframe === 'daily' ? dailySalesData : weeklySalesData;
        const engagementChartData = analyticsTimeframe === 'daily' ? dailyEngagementData : weeklyEngagementData;

        // Calculate Totals
        const totalTickets = chartData.reduce((acc, d) => acc + d.bilhetesQtd, 0);
        const totalProducts = chartData.reduce((acc, d) => acc + d.produtosQtd, 0);
        const totalRevenue = chartData.reduce((acc, d) => acc + d.totalXOF, 0);
        const avgOrderValue = Math.round(totalRevenue / (totalTickets + totalProducts || 1));

        const totalPeriodViews = engagementChartData.reduce((acc, d) => acc + d.visualizacoes, 0);
        const totalPeriodWhatsapp = engagementChartData.reduce((acc, d) => acc + d.cliquesWhatsapp, 0);
        const totalPeriodCalls = engagementChartData.reduce((acc, d) => acc + d.chamadasVoz, 0);
        const totalPeriodMaps = engagementChartData.reduce((acc, d) => acc + d.direcoesMapa, 0);
        const totalLeads = totalPeriodWhatsapp + totalPeriodCalls + totalPeriodMaps;
        const leadConversionRate = totalPeriodViews > 0 ? ((totalLeads / totalPeriodViews) * 100).toFixed(1) : '0.0';
        const firstSalesPoint = chartData[0]?.totalXOF ?? 0;
        const lastSalesPoint = chartData[chartData.length - 1]?.totalXOF ?? 0;
        const salesTrend = firstSalesPoint > 0 ? ((lastSalesPoint - firstSalesPoint) / firstSalesPoint) * 100 : 0;
        const firstViewsPoint = engagementChartData[0]?.visualizacoes ?? 0;
        const lastViewsPoint = engagementChartData[engagementChartData.length - 1]?.visualizacoes ?? 0;
        const viewsTrend = firstViewsPoint > 0 ? ((lastViewsPoint - firstViewsPoint) / firstViewsPoint) * 100 : 0;
        const topPromotion = promoPerformanceData.reduce(
          (top, promotion) => (promotion.resgates > top.resgates ? promotion : top),
          promoPerformanceData[0],
        );

        const pieDistributionData = [
          { name: 'Bilhetes VIP & Mesas', value: 42, color: '#10B981' },
          { name: 'Bilhetes Entrada Geral', value: 33, color: '#3B82F6' },
          { name: 'Menus & Refei��es', value: 15, color: '#F59E0B' },
          { name: 'Vouchers & Bebidas', value: 10, color: '#8B5CF6' },
        ];

        return (
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-base text-[var(--color-text-strong)] flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[var(--color-green-600)]" />
                    <span>{t('business.RelatoriosEstatisticasDesempenho')}</span>
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('business.AcompanheGraficosInterativos')}</p>
                </div>

                {/* Global Timeframe Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="bg-[var(--color-bg-subtle)] p-1 rounded-2xl flex items-center gap-1 border border-[var(--color-border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setAnalyticsTimeframe('daily')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                        analyticsTimeframe === 'daily'
                          ? 'bg-[var(--color-neutral-0)] text-[var(--color-text-strong)] shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                      <span>{t('business.DiarioDias')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsTimeframe('weekly')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                        analyticsTimeframe === 'weekly'
                          ? 'bg-[var(--color-neutral-0)] text-[var(--color-text-strong)] shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                      <span>Semanal (4 semanas)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-Section Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border-subtle)] text-xs">
                <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mr-1">{t('business.FiltrarSeccao')}</span>
                <button
                  type="button"
                  onClick={() => setAnalyticsSubSection('all')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
                    analyticsSubSection === 'all'
                      ? 'bg-[var(--color-bg-surface-dark)] text-white shadow-sm'
                      : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle-dark)]'
                  }`}
                >{t('business.VisaoGeralCompleta')}</button>
                <button
                  type="button"
                  onClick={() => setAnalyticsSubSection('views_clicks')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    analyticsSubSection === 'views_clicks'
                      ? 'bg-[var(--color-green-600)] text-white shadow-sm'
                      : 'bg-[var(--color-green-50)] text-[var(--color-green-700)] hover:bg-[var(--color-blue-100)]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('business.VisualizacoesCliques')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsSubSection('promotions')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    analyticsSubSection === 'promotions'
                      ? 'bg-[var(--color-gold-600)] text-white shadow-sm'
                      : 'bg-[var(--color-gold-50)] text-[var(--color-gold-700)] hover:bg-[var(--color-gold-100)]'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t('business.DesempenhoDasPromocoes')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsSubSection('sales')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    analyticsSubSection === 'sales'
                      ? 'bg-[var(--color-green-600)] text-white shadow-sm'
                      : 'bg-[var(--color-green-50)] text-[var(--color-emerald-700)] hover:bg-[var(--color-emerald-100)]'
                  }`}
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>{t('business.VendasBilhetica')}</span>
                </button>
              </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
                <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                  <span>{t('business.VisualizacoesPerfil')}</span>
                  <Eye className="w-4 h-4 text-[var(--color-green-600)]" />
                </div>
                <div className="mt-2 font-mono font-black text-2xl text-[var(--color-text-strong)]">
                  {totalPeriodViews.toLocaleString('pt-PT')}
                </div>
                <span className="text-[10px] text-[var(--color-green-600)] font-bold mt-1 inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {viewsTrend >= 0 ? '+' : ''}{viewsTrend.toFixed(1)}% desde o in�cio
                </span>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
                <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                  <span>Total Leads Directos</span>
                  <MessageCircle className="w-4 h-4 text-[var(--color-green-600)]" />
                </div>
                <div className="mt-2 font-mono font-black text-2xl text-[var(--color-green-600)]">
                  {totalLeads.toLocaleString('pt-PT')}
                </div>
                <span className="text-[10px] text-[var(--color-emerald-700)] font-bold mt-1 block">
                  Taxa de Convers�o: {leadConversionRate}%
                </span>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
                <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                  <span>{t('business.ResgatesPromocoes')}</span>
                  <Tag className="w-4 h-4 text-[var(--color-gold-500)]" />
                </div>
                <div className="mt-2 font-mono font-black text-2xl text-[var(--color-gold-600)]">
                  {promoPerformanceData.reduce((acc, p) => acc + p.resgates, 0)} <span className="text-xs font-normal text-[var(--color-text-muted)]">vouchers</span>
                </div>
                <span className="text-[10px] text-[var(--color-gold-600)] font-bold mt-1 block">
                  {promoPerformanceData.length} campanhas ativas · melhor: {topPromotion.titulo}
                </span>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
                <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold">
                  <span>{t('business.VolumeBilhetica')}</span>
                  <DollarSign className="w-4 h-4 text-[var(--color-violet-600)]" />
                </div>
                <div className="mt-2 font-mono font-black text-xl text-[var(--color-text-strong)]">
                  {totalRevenue.toLocaleString('pt-PT')} XOF
                </div>
                <span className="text-[10px] text-[var(--color-violet-600)] font-bold mt-1 block">
                  {totalTickets} bilhetes emitidos · {salesTrend >= 0 ? '+' : ''}{salesTrend.toFixed(1)}% desde o in�cio
                </span>
              </div>
            </div>

            {/* SECTION 1: GR�FICO DE VISUALIZA�ÕES E CLIQUES (Recharts Area & Line Chart) */}
            {(analyticsSubSection === 'all' || analyticsSubSection === 'views_clicks') && (
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between border-b border-[var(--color-border-subtle)] pb-3 gap-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-[var(--color-text-strong)] flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[var(--color-green-600)]" />
                      <span>{t('business.EvolucaoVisualizacoesCliques')}</span>
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {t('business.RelacaoVisualizacoesCliques')} ({analyticsTimeframe === 'daily' ? t('business.Diario') : t('business.Semanal')}).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] bg-[var(--color-green-50)] text-[var(--color-green-700)] px-3 py-1 rounded-full font-bold">
                      {totalPeriodViews.toLocaleString('pt-PT')} {t('business.Visitas')}
                    </span>
                    <span className="text-[11px] bg-[var(--color-green-50)] text-[var(--color-emerald-700)] px-3 py-1 rounded-full font-bold">
                      {totalLeads} Contactos Gerados
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={engagementChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.info} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={chartColors.info} stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorWhatsapp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
                      <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'var(--color-green-600)', opacity: 0.06 }}
                        content={
                          <ChartTooltip
                            formatter={(value, name) => [
                              Number(value).toLocaleString('pt-PT'),
                              name === 'visualizacoes' ? t('business.VisualizacoesDaPagina') :
                              name === 'cliquesWhatsapp' ? t('business.CliquesWhatsapp') :
                              name === 'chamadasVoz' ? t('business.ChamadasDeVoz') : t('business.DirecoesNoMapa'),
                            ]}
                          />
                        }
                      />
                      <Legend
                        formatter={(value) =>
                          value === 'visualizacoes' ? t('business.VisualizacoesDaPagina') :
                          value === 'cliquesWhatsapp' ? t('business.CliquesWhatsapp') :
                          value === 'chamadasVoz' ? t('business.ChamadasDeVoz') : t('business.DirecoesNoMapa')
                        }
                        wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="visualizacoes"
                        stroke={chartColors.info}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorViews)"
                      />
                      <Area
                        type="monotone"
                        dataKey="cliquesWhatsapp"
                        stroke={chartColors.primary}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorWhatsapp)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Conversion Breakdown Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[var(--color-emerald-100)] text-[var(--color-emerald-700)] flex items-center justify-center">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--color-text-strong)]">WhatsApp Leads</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Contacto imediato</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-sm text-[var(--color-emerald-700)]">{totalPeriodWhatsapp}</div>
                      <div className="text-[10px] font-bold text-[var(--color-text-muted)]">
                        {totalPeriodViews > 0 ? ((totalPeriodWhatsapp / totalPeriodViews) * 100).toFixed(1) : 0}% conv.
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[var(--color-gold-100)] text-[var(--color-gold-700)] flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--color-text-strong)]">{t('business.ChamadasTelefonicas')}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Linha direta</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-sm text-[var(--color-gold-700)]">{totalPeriodCalls}</div>
                      <div className="text-[10px] font-bold text-[var(--color-text-muted)]">
                        {totalPeriodViews > 0 ? ((totalPeriodCalls / totalPeriodViews) * 100).toFixed(1) : 0}% conv.
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[var(--color-blue-100)] text-[var(--color-green-700)] flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--color-text-strong)]">Rotas & Mapa</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Visitas presenciais</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-sm text-[var(--color-green-700)]">{totalPeriodMaps}</div>
                      <div className="text-[10px] font-bold text-[var(--color-text-muted)]">
                        {totalPeriodViews > 0 ? ((totalPeriodMaps / totalPeriodViews) * 100).toFixed(1) : 0}% conv.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: GR�FICO DE DESEMPENHO DAS PROMO�ÕES (Recharts BarChart) */}
            {(analyticsSubSection === 'all' || analyticsSubSection === 'promotions') && (
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between border-b border-[var(--color-border-subtle)] pb-3 gap-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-[var(--color-text-strong)] flex items-center gap-2">
                      <Tag className="w-4 h-4 text-[var(--color-gold-600)]" />
                      <span>{t('business.DesempenhoComparativoDas')}</span>
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{t('business.VisualizacoesCadaOferta')}</p>
                  </div>
                  <span className="text-[11px] font-mono bg-[var(--color-gold-50)] text-[var(--color-gold-700)] px-3 py-1 rounded-full font-bold">
                    {promoPerformanceData.length} Campanhas Analisadas
                  </span>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={promoPerformanceData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
                      <XAxis
                        dataKey="titulo"
                        tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-12}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'var(--color-green-600)', opacity: 0.06 }}
                        content={
                          <ChartTooltip
                            formatter={(value, name) => [
                              Number(value).toLocaleString('pt-PT'),
                              name === 'visualizacoes' ? t('business.VisualizacoesDaOferta') :
                              name === 'resgates' ? t('business.VouchersResgatados') : t('business.CliquesWhatsapp'),
                            ]}
                          />
                        }
                      />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 12, fontWeight: 600 }} />
                      <Bar dataKey="visualizacoes" name={t('business.Visualizacoes')} fill={chartColors.accent} radius={[6, 6, 2, 2]} maxBarSize={34} />
                      <Bar dataKey="resgates" name={t('business.VouchersResgatados')} fill={chartColors.primary} radius={[6, 6, 2, 2]} maxBarSize={34} />
                      <Bar dataKey="cliquesWhatsapp" name={t('business.CliquesWhatsapp')} fill={chartColors.info} radius={[6, 6, 2, 2]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Promo Performance Table */}
                <div className="overflow-x-auto border-[var(--color-border-subtle)] rounded-2xl mt-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] font-extrabold text-[var(--color-text-strong)] uppercase text-[10px]">
                        <th className="p-3">{t('business.TituloPromocao')}</th>
                        <th className="p-3 text-center">{t('business.TipoBeneficio')}</th>
                        <th className="p-3 text-center">{t('business.Visualizacoes2')}</th>
                        <th className="p-3 text-center">Vouchers Resgatados</th>
                        <th className="p-3 text-center">Cliques WhatsApp</th>
                        <th className="p-3 text-right font-black">Taxa de Resgate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-strong)]">
                      {promoPerformanceData.map((promo, idx) => (
                        <tr key={idx} className="hover:bg-[var(--color-bg-subtle)] transition">
                          <td className="p-3 font-bold text-[var(--color-text-strong)]">{promo.titulo}</td>
                          <td className="p-3 text-center font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)]/50">
                            <span className="bg-[var(--color-gold-100)] text-[var(--color-gold-800)] px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {promo.desconto}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-[var(--color-text-strong)]">
                            {promo.visualizacoes.toLocaleString('pt-PT')}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-[var(--color-green-600)]">
                            {promo.resgates}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-[var(--color-green-600)]">
                            {promo.cliquesWhatsapp}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-[var(--color-emerald-700)] bg-[var(--color-green-50)]/40">
                            {promo.conversao}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 3: VENDAS DE BILHETES & PRODUTOS (Recharts Bar & Area & Pie) */}
            {(analyticsSubSection === 'all' || analyticsSubSection === 'sales') && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Bar Chart: Comparison Bilhetes vs Produtos */}
                  <div className="lg:col-span-2 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
                    <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-[var(--color-text-strong)] flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-[var(--color-green-600)]" />
                          <span>Volume de Vendas: Bilhetes vs. Produtos</span>
                        </h4>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          Compara��o da performance por {analyticsTimeframe === 'daily' ? 'dia da semana' : 'semana do m�s'}.
                        </p>
                      </div>
                      <div className="bg-[var(--color-bg-subtle)] p-1 rounded-xl flex items-center gap-1 border-[var(--color-border-subtle)] text-xs">
                        <button
                          type="button"
                          onClick={() => setAnalyticsMetric('revenue')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition ${
                            analyticsMetric === 'revenue' ? 'bg-[var(--color-green-600)] text-white shadow-xs' : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          XOF
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnalyticsMetric('units')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition ${
                            analyticsMetric === 'units' ? 'bg-[var(--color-green-600)] text-white shadow-xs' : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          Qtd
                        </button>
                      </div>
                    </div>

                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
                          <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                            axisLine={false}
                            tickFormatter={(v) => (analyticsMetric === 'revenue' ? `${v / 1000}k` : v)}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--color-green-600)', opacity: 0.06 }}
                            content={
                              <ChartTooltip
                                formatter={(value) => [
                                  analyticsMetric === 'revenue'
                                    ? `${Number(value).toLocaleString('pt-PT')} XOF`
                                    : `${Number(value).toLocaleString('pt-PT')} un`,
                                  analyticsMetric === 'revenue' ? 'Receita' : 'Quantidade',
                                ]}
                              />
                            }
                          />
                          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 10, fontWeight: 600 }} />
                          <Bar
                            dataKey={analyticsMetric === 'revenue' ? 'bilhetesXOF' : 'bilhetesQtd'}
                            name="Bilhetes de Eventos"
                            fill={chartColors.primary}
                            radius={[6, 6, 2, 2]}
                            maxBarSize={34}
                          />
                          <Bar
                            dataKey={analyticsMetric === 'revenue' ? 'produtosXOF' : 'produtosQtd'}
                            name="Produtos e Menus"
                            fill={chartColors.info}
                            radius={[6, 6, 2, 2]}
                            maxBarSize={34}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pie Chart: Distribution by Category */}
                  <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
                    <div className="border-b border-[var(--color-border-subtle)] pb-3">
                      <h4 className="font-extrabold text-sm text-[var(--color-text-strong)] flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-[var(--color-violet-600)]" />
                        <span>{t('business.DistribuicaoDasVendas')}</span>
                      </h4>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{t('business.ProporcaoPorTipo')}</p>
                    </div>

                    <div className="h-56 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {pieDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`${value}%`, 'Quota']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-1.5 pt-1 text-xs">
                      {pieDistributionData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[var(--color-text-strong)] font-medium text-[11px]">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold text-[var(--color-text-strong)] text-[11px]">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Area Chart: Receita Acumulada */}
                <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
                  <div className="border-b border-[var(--color-border-subtle)] pb-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-[var(--color-text-strong)]">{t('business.EvolucaoReceitaBruta')}</h4>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{t('business.TrajetoriaVolumeFinanceiro')}</p>
                    </div>
                    <span className="font-mono font-extrabold text-[var(--color-green-600)] text-xs bg-[var(--color-green-50)] px-3 py-1 rounded-full">
                      Total: {totalRevenue.toLocaleString('pt-PT')} XOF
                    </span>
                  </div>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
                        <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v / 1000}k`}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--color-green-600)', opacity: 0.06 }}
                          content={<ChartTooltip formatter={(value) => [Number(value).toLocaleString('pt-PT'), 'Receita Total']} />}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalXOF"
                          stroke={chartColors.primary}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorTotal)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detailed Data Table */}
                <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
                    <h4 className="font-extrabold text-sm text-[var(--color-text-strong)]">{t('business.TabelaDetalhadaVendas')}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const csvHeader = 'Periodo;Bilhetes_Qtd;Produtos_Qtd;Receita_Bilhetes_XOF;Receita_Produtos_XOF;Total_XOF\n';
                        const csvRows = chartData.map((r) =>
                          [r.period, r.bilhetesQtd, r.produtosQtd, r.bilhetesXOF, r.produtosXOF, r.totalXOF].join(';')
                        ).join('\n');
                        const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `relatorio_estatisticas_${business.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
                        a.click();
                        window.setTimeout(() => URL.revokeObjectURL(url), 0);
                      }}
                      className="px-3 py-1.5 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle-dark)] text-[var(--color-text-strong)] font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t('business.ExportarRelatorioCsv')}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] font-extrabold text-[var(--color-text-strong)] uppercase text-[10px]">
                          <th className="p-3">{t('business.PeriodoDia')}</th>
                          <th className="p-3 text-center">Bilhetes Vendidos</th>
                          <th className="p-3 text-center">Produtos / Ofertas</th>
                          <th className="p-3 text-right">Receita Bilhetes (XOF)</th>
                          <th className="p-3 text-right">Receita Produtos (XOF)</th>
                          <th className="p-3 text-right font-black">Total Geral (XOF)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-strong)]">
                        {chartData.map((row) => (
                          <tr key={row.period} className="hover:bg-[var(--color-bg-subtle)] transition">
                            <td className="p-3 font-bold text-[var(--color-text-strong)]">{row.period}</td>
                            <td className="p-3 text-center font-mono font-bold text-[var(--color-green-600)]">
                              {row.bilhetesQtd}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-[var(--color-gold-600)]">
                              {row.produtosQtd}
                            </td>
                            <td className="p-3 text-right font-mono text-[var(--color-text-strong)]">
                              {row.bilhetesXOF.toLocaleString('pt-PT')}
                            </td>
                            <td className="p-3 text-right font-mono text-[var(--color-text-strong)]">
                              {row.produtosXOF.toLocaleString('pt-PT')}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-[var(--color-emerald-700)] bg-[var(--color-green-50)]/50">
                              {row.totalXOF.toLocaleString('pt-PT')} XOF
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'clients' && (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Clientes"
          description="Este m�dulo est� preparado para centralizar clientes, hist�rico de relacionamento e segmenta��o."
        />
      )}

      {(activeTab === 'marketing' || activeTab === 'marketing_campaigns' || activeTab === 'marketing_calendar') && (
        <div className="space-y-5">
          {marketingSection === 'overview' && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: t('business.Alcance'), value: business.metrics.views, suffix: t('business.suffixVisualizacoes'), color: 'text-[var(--color-green-700)]', bg: 'bg-[var(--color-green-50)]', icon: Eye },
              { label: t('business.Contactos'), value: business.metrics.whatsappClicks + business.metrics.phoneClicks, suffix: t('business.suffixInteracoes'), color: 'text-[var(--color-emerald-700)]', bg: 'bg-[var(--color-green-50)]', icon: MessageCircle },
              { label: t('content'), value: business.posts.length, suffix: t('business.suffixPublicacoes'), color: 'text-[var(--color-violet-700)]', bg: 'bg-[var(--color-violet-50)]', icon: FileText },
              { label: t('business.Conversao'), value: business.promotions.length + businessEvents.length, suffix: t('business.suffixCampanhasEventos'), color: 'text-[var(--color-gold-700)]', bg: 'bg-[var(--color-gold-50)]', icon: TrendingUp },
            ].map(({ label, value, suffix, color, bg, icon: MetricIcon }) => (
              <Card key={label} className="border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
                    <p className={`mt-2 text-2xl font-black ${color}`}>{value.toLocaleString('pt-PT')}</p>
                    <p className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)]">{suffix}</p>
                  </div>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}`}><MetricIcon className="h-4 w-4" /></span>
                </div>
              </Card>
            ))}
          </div>}

          {marketingSection === 'overview' && <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <ChartFrame
              title={t('business.AlcanceEContactos')}
              description={t('business.ComparacaoResultadosMarketing')}
              eyebrow="Marketing"
              height="md"
              action={<span className="rounded-full bg-[var(--color-green-50)] px-2.5 py-1 text-[10px] font-black text-[var(--color-emerald-700)]">{t('business.DadosReais')}</span>}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { name: t('business.Alcance'), alcance: business.metrics.views, contactos: business.metrics.whatsappClicks + business.metrics.phoneClicks },
                  { name: t('business.Mapa'), alcance: business.metrics.directionsClicks, contactos: business.metrics.directionsClicks },
                  { name: t('content'), alcance: business.posts.length, contactos: business.promotions.length },
                  { name: t('businessNavEvents'), alcance: businessEvents.length, contactos: myBusinessOrders.length },
                ]} margin={{ top: 16, right: 14, left: -18, bottom: 4 }}>
                  <defs>
                    <linearGradient id="marketingReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.3} />
                      <stop offset="90%" stopColor={chartColors.primary} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="marketingContacts" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={chartColors.accent} />
                      <stop offset="100%" stopColor={chartColors.warm} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--color-border-default)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 8, fontWeight: 600 }} />
                  <Area type="monotone" dataKey="alcance" name={t('business.Alcance')} stroke={chartColors.primary} fill="url(#marketingReach)" strokeWidth={2.5} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--color-bg-surface)', fill: chartColors.primary }} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--color-bg-surface)', fill: chartColors.primary }} />
                  <Area type="monotone" dataKey="contactos" name={t('business.Contactos')} stroke={chartColors.accent} fill="transparent" strokeWidth={2.5} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--color-bg-surface)', fill: chartColors.accent }} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--color-bg-surface)', fill: chartColors.accent }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>

            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-sm">
              <h3 className="text-base font-black text-[var(--color-text-strong)]">Ferramentas de Marketing</h3>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{t('business.TudoFicaAgrupado')}</p>
              <div className="mt-4 grid gap-2">
                {[
                  { label: 'Publica��es', description: `${business.posts.length} conte�dos`, tab: 'posts' as const, icon: FileText },
                  { label: 'Promo��es', description: `${business.promotions.length} ofertas`, tab: 'promotions' as const, icon: Tag },
                  { label: 'Estat�sticas', description: 'An�lise detalhada', tab: 'analytics' as const, icon: BarChart3 },
                ].map(({ label, description, tab, icon: ToolIcon }) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-green-300)] hover:bg-[var(--color-green-50)]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-green-700)]"><ToolIcon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-black text-[var(--color-text-strong)]">{label}</span><span className="block text-[10px] text-[var(--color-text-muted)]">{description}</span></span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </button>
                ))}
              </div>
            </Card>
          </div>}

          {marketingSection !== 'overview' && (
            <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-sm">
              {(() => {
                const sectionContent = {
                  campaigns: {
                    eyebrow: 'Planeamento e divulga��o',
                    title: 'Campanhas',
                    description: 'Crie campanhas para promover publica��es, eventos ou ofertas e acompanhe o resultado de cada iniciativa.',
                  },
                  content: {
                    eyebrow: 'Produ��o e distribui��o',
                    title: 'Conte�dos',
                    description: 'Crie publica��es, v�deos e galerias para manter o perfil activo e comunicar com os seus clientes.',
                  },
                  audience: {
                    eyebrow: 'Pessoas e relacionamento',
                    title: 'P�blico-alvo',
                    description: 'Conhe�a quem encontra a empresa, acompanha os seus conte�dos e entra em contacto.',
                  },
                  calendar: {
                    eyebrow: 'Planeamento editorial',
                    title: 'Calend�rio de Conte�do e Campanhas',
                    description: 'Organize publica��es, promo��es e campanhas para manter uma presen�a consistente.',
                  },
                  library: {
                    eyebrow: 'Materiais de campanha',
                    title: 'Biblioteca',
                    description: 'Consulte os materiais j� usados nas publica��es e mantenha os conte�dos prontos para reutiliza��o.',
                  },
                  budget: {
                    eyebrow: 'Investimento e retorno',
                    title: 'Or�amento',
                    description: 'Acompanhe o investimento comercial, os pedidos gerados e os recursos dispon�veis para divulga��o.',
                  },
                  reports: {
                    eyebrow: 'Decis�es baseadas em dados',
                    title: 'Relat�rios',
                    description: 'Analise o desempenho das campanhas, conte�dos, contactos e vendas num s� lugar.',
                  },
                }[marketingSection];

                return (
                  <div>
                    <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-5 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-green-700)]">{sectionContent.eyebrow}</p>
                        <h3 className="mt-1 text-2xl font-black tabular-nums text-[var(--color-text-strong)]">{sectionContent.title}</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">{sectionContent.description}</p>
                      </div>
                      <Badge variant="info" className="w-fit px-3 py-1.5">Marketing</Badge>
                    </div>
                    {marketingSection === 'campaigns' && (
                      <div className="mt-6 grid gap-4 border-t border-[var(--color-border-subtle)] pt-5 lg:grid-cols-[0.8fr_1.2fr]">
                        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
                          <h4 className="text-sm font-black text-[var(--color-text-strong)]">Nova campanha</h4>
                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{t('business.CriePrimeiroComo')}</p>
                          <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Nome da campanha" className="mt-3 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] p-3 text-xs" />
                          <select value={campaignObjective} onChange={(event) => setCampaignObjective(event.target.value as MarketingCampaign['objective'])} className="mt-2 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] p-3 text-xs text-[var(--color-text-strong)]">
                            <option value="awareness">Objetivo: notoriedade</option>
                            <option value="engagement">Objetivo: envolvimento</option>
                            <option value="traffic">{t('business.ObjetivoTrafego')}</option>
                            <option value="conversions">{t('business.ObjetivoConversoes')}</option>
                            <option value="sales">Objetivo: vendas</option>
                          </select>
                          <input value={campaignBudget} onChange={(event) => setCampaignBudget(event.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder={t('business.OrcamentoMaximoXof')} className="mt-2 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] p-3 text-xs" />
                          <select value={campaignAudienceId} onChange={(event) => setCampaignAudienceId(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] p-3 text-xs text-[var(--color-text-strong)]">
                            <option value="">{t('business.PublicoAlvoOpcional')}</option>
                            {marketingSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                          </select>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input type="datetime-local" value={campaignStartsAt} onChange={(event) => setCampaignStartsAt(event.target.value)} aria-label={t('business.InicioCampanha')} className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 text-[10px]" />
                            <input type="datetime-local" value={campaignEndsAt} onChange={(event) => setCampaignEndsAt(event.target.value)} aria-label="Fim da campanha" className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 text-[10px]" />
                          </div>
                          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">As datas usam o fuso Africa/Bissau.</p>
                          <div className="mt-2 max-h-24 space-y-1 overflow-auto rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2">
                            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">{t('business.ConteudosAssociados')}</p>
                            {[...business.posts.slice(0, 8).map((post) => ({ id: post.id, title: post.title })), ...business.promotions.slice(0, 8).map((promotion) => ({ id: promotion.id, title: promotion.title }))].map((content) => <label key={content.id} className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]"><input type="checkbox" checked={campaignContentIds.includes(content.id)} onChange={() => setCampaignContentIds((previous) => previous.includes(content.id) ? previous.filter((id) => id !== content.id) : [...previous, content.id])} /> <span className="truncate">{content.title}</span></label>)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(['guigui', 'social', 'sms', 'email', 'banner'] as const).map((channel) => (
                              <button key={channel} type="button" onClick={() => setCampaignChannels((previous) => previous.includes(channel) ? previous.filter((item) => item !== channel) : [...previous, channel])} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${campaignChannels.includes(channel) ? 'bg-[var(--color-green-700)] text-[var(--color-neutral-0)]' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border-subtle)]'}`}>{channel}</button>
                            ))}
                          </div>
                          <Button type="button" size="sm" className="mt-3 w-full" onClick={createMarketingCampaign}>Guardar rascunho</Button>
                        </div>
                        <div className="space-y-2">
                          {marketingCampaigns.length === 0 && <EmptyState title="Sem campanhas" description="As campanhas criadas aparecer�o aqui." />}
                          {marketingCampaigns.map((campaign) => (
                            <div key={campaign.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div><h4 className="text-sm font-black text-[var(--color-text-strong)]">{campaign.name}</h4><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{campaign.channels.join(' · ')}{campaign.budgetXOF ? ` · ${campaign.budgetXOF.toLocaleString('pt-PT')} XOF` : ''}</p></div>
                                <Badge variant={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'info'}>{({ draft: 'Rascunho', scheduled: 'Agendada', active: 'Ativa', paused: 'Pausada', ended: 'Encerrada', archived: 'Arquivada' } as Record<MarketingCampaign['status'], string>)[campaign.status]}</Badge>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {campaign.status === 'draft' && <Button type="button" size="sm" variant="primary" onClick={() => updateCampaignStatus(campaign, 'scheduled')}>Agendar</Button>}
                                {campaign.status === 'scheduled' && <Button type="button" size="sm" variant="ghost" onClick={() => updateCampaignStatus(campaign, 'active')}>Ativar</Button>}
                                {campaign.status === 'active' && <Button type="button" size="sm" variant="ghost" onClick={() => updateCampaignStatus(campaign, 'paused')}>Pausar</Button>}
                                {campaign.status === 'paused' && <Button type="button" size="sm" variant="ghost" onClick={() => updateCampaignStatus(campaign, 'active')}>Retomar</Button>}
                                {!['ended', 'archived'].includes(campaign.status) && <Button type="button" size="sm" variant="ghost" onClick={() => updateCampaignStatus(campaign, 'ended')}>Encerrar</Button>}
                                <Button type="button" size="sm" variant="ghost" onClick={() => setMarketingCampaigns((previous) => [{ ...campaign, id: `campaign-${Date.now()}`, name: `${campaign.name} (c�pia)`, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...previous])}>Duplicar</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {marketingSection === 'content' && (
                      <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-5">
                        <div className="flex flex-wrap gap-2">
                          {(['all', 'posts', 'promotions', 'scheduled'] as const).map((filter) => <button key={filter} type="button" onClick={() => setContentFilter(filter)} className={`rounded-full px-3 py-1.5 text-[10px] font-black ${contentFilter === filter ? 'bg-[var(--color-bg-surface-dark)] text-white' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>{filter === 'all' ? t('business.Todos') : filter === 'posts' ? t('posts') : filter === 'promotions' ? t('promotions') : t('business.Agendados')}</button>)}
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {(contentFilter !== 'promotions' ? business.posts.map((post) => ({ id: post.id, title: post.title, type: t('business.Publicacao'), status: String(post.status) })) : []).concat(contentFilter !== 'posts' ? business.promotions.map((promotion) => ({ id: promotion.id, title: promotion.title, type: t('business.Promocao'), status: String(promotion.status || (promotion.isActive ? 'active' : 'draft')) })) : []).filter((item) => contentFilter !== 'scheduled' || ['scheduled', 'publishing'].includes(item.status)).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border-subtle)] p-3"><span className="min-w-0"><strong className="block truncate text-xs text-[var(--color-text-strong)]">{item.title}</strong><small className="text-[10px] text-[var(--color-text-muted)]">{item.type}</small></span><Badge variant="info">{item.status}</Badge></div>)}
                        </div>
                      </div>
                    )}
                    {marketingSection === 'audience' && (
                      <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-5">
                        <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-black text-[var(--color-text-strong)]">Segmentos por regras</h4><p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{t('business.EstimativasAparecemQuando')}</p></div><Button type="button" size="sm" onClick={createAudienceSegment}>Criar segmento</Button></div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">{marketingSegments.map((segment) => <div key={segment.id} className="rounded-2xl border border-[var(--color-border-subtle)] p-4"><h4 className="text-xs font-black text-[var(--color-text-strong)]">{segment.name}</h4><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{segment.location} · {segment.interests.join(', ')}</p><p className="mt-3 text-sm font-black text-[var(--color-green-700)]">{segment.estimatedReach === undefined ? 'Estimativa indispon�vel' : `${segment.estimatedReach.toLocaleString('pt-PT')} pessoas estimadas`}</p></div>)}</div>
                      </div>
                    )}
                    {marketingSection === 'library' && (
                      <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-5">
                        <div className="flex flex-wrap gap-2">{(['all', 'image', 'video', 'banner', 'logo'] as const).map((filter) => <button key={filter} type="button" onClick={() => setAssetFilter(filter)} className={`rounded-full px-3 py-1.5 text-[10px] font-black ${assetFilter === filter ? 'bg-[var(--color-bg-surface-dark)] text-white' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>{filter === 'all' ? 'Todos' : filter}</button>)}</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{marketingAssets.filter((asset) => assetFilter === 'all' || asset.type === assetFilter).map((asset) => <div key={asset.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">{asset.type === 'video' ? <video src={asset.url} className="h-28 w-full object-cover" muted /> : <img src={asset.url} alt={asset.name} className="h-28 w-full object-cover" /> }<div className="p-3"><p className="truncate text-xs font-black text-[var(--color-text-strong)]">{asset.name}</p><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{asset.type} · {asset.usedBy.length} utiliza��o(�es)</p><button type="button" disabled={asset.usedBy.length > 0} className="mt-2 text-[10px] font-black text-[var(--color-rose-600)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]">Arquivar</button></div></div>)}</div>
                      </div>
                    )}
                    {marketingSection === 'budget' && (
                      <div className="mt-6 grid gap-3 border-t border-[var(--color-border-subtle)] pt-5 sm:grid-cols-4">
                        {[
                          ['Total planeado', marketingCampaigns.reduce((total, campaign) => total + (campaign.budgetXOF || 0), 0)],
                          ['Gasto registado', marketingCampaigns.reduce((total, campaign) => total + (campaign.spentXOF || 0), 0)],
                          ['Dispon�vel', marketingCampaigns.reduce((total, campaign) => total + Math.max(0, (campaign.budgetXOF || 0) - (campaign.spentXOF || 0)), 0)],
                          ['Campanhas', marketingCampaigns.length],
                        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4"><p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p><p className="mt-2 text-lg font-black text-[var(--color-text-strong)]">{Number(value).toLocaleString('pt-PT')}{label !== 'Campanhas' ? ' XOF' : ''}</p></div>)}
                      </div>
                    )}
                    {marketingSection === 'reports' && (
                      <div className="mt-6 grid gap-4 border-t border-[var(--color-border-subtle)] pt-5 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
                          <h4 className="text-sm font-black text-[var(--color-text-strong)]">{t('business.IndicadoresDisponiveis')}</h4>
                          <div className="mt-3 space-y-2 text-xs text-[var(--color-text-muted)]">
                            <div className="flex justify-between gap-3"><span>{t('business.Visualizacoes3')}</span><strong className="text-[var(--color-text-strong)]">{business.metrics.views.toLocaleString('pt-PT')}</strong></div>
                            <div className="flex justify-between gap-3"><span>Contactos</span><strong className="text-[var(--color-text-strong)]">{(business.metrics.whatsappClicks + business.metrics.phoneClicks).toLocaleString('pt-PT')}</strong></div>
                            <div className="flex justify-between gap-3"><span>Pedidos</span><strong className="text-[var(--color-text-strong)]">{myBusinessOrders.length.toLocaleString('pt-PT')}</strong></div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
                          <h4 className="text-sm font-black text-[var(--color-text-strong)]">{t('business.ExportacaoAnalise')}</h4>
                          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">{t('business.IndicadoresSaoDerivados')}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="primary" onClick={() => setActiveTab('analytics')}>{t('business.AbrirEstatisticas')}</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setActiveTab('export')}>Exportar dados</Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {marketingSection === 'calendar' && (
                      <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-black text-[var(--color-text-strong)]">Agendamentos</h4>
                            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{t('business.FusoHorarioPadrao')}</p>
                          </div>
                          <Badge variant="info">{scheduledItems.length}</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {scheduledItems.length === 0 && <p className="rounded-xl bg-[var(--color-bg-subtle)] p-3 text-xs text-[var(--color-text-muted)]">{t('business.AindaNaoExistem3')}</p>}
                          {scheduledItems.map((item) => (
                            <div key={item.id} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-black text-[var(--color-text-strong)]">{item.label || (item.itemType === 'promotion' ? t('business.Promocao') : item.itemType === 'post' ? t('business.Publicacao') : item.itemType)}</p>
                                <p className="text-[11px] text-[var(--color-text-muted)]">{new Date(item.scheduledAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })} · {item.timezone}</p>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-green-700)]">{item.status === 'scheduled' ? 'Agendado' : item.status === 'published' ? 'Publicado/Ativo' : item.status === 'expired' ? 'Expirado' : item.status === 'failed' ? `Falha: ${item.errorMessage || 'ver detalhes'}` : item.status === 'cancelled' ? 'Cancelado' : 'A publicar'}</p>
                              </div>
                              {item.status === 'scheduled' && <div className="flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant="ghost" onClick={() => void updateSchedule(item, 'reschedule')}>Reagendar</Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => void updateSchedule(item, 'publish')}>Publicar agora</Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => void updateSchedule(item, 'cancel')}>Cancelar</Button>
                              </div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <ClientNotificationsHub
          business={business}
          currentLang={currentLang}
          notifications={notifications}
          onMarkAsRead={onMarkNotificationAsRead}
          onMarkAllAsRead={onMarkAllNotificationsAsRead}
          onClearAll={onClearNotifications}
          onNavigateTab={onNavigateNotificationTab}
          onOpenNotification={onOpenNotification}
        />
      )}

      {/* Settings Tab */}
      {activeTab === 'communications' && (
        <CommunicationHub currentLang={currentLang} mode="business" currentUser={currentUser} businesses={businesses} conversations={conversations} messages={conversationMessages} supportRequests={supportRequests} onCreateConversation={onCreateConversation} onSendMessage={onSendMessage} onCreateSupport={onCreateSupport} onReplySupport={onReplySupport} onMarkConversationRead={onMarkConversationRead} initialChannel="messages" channelOnly focusConversationId={focusConversationId} />
      )}

      {activeTab === 'support' && (
        <CommunicationHub currentLang={currentLang} mode="business" currentUser={currentUser} businesses={businesses} conversations={conversations} messages={conversationMessages} supportRequests={supportRequests} onCreateConversation={onCreateConversation} onSendMessage={onSendMessage} onCreateSupport={onCreateSupport} onReplySupport={onReplySupport} onMarkConversationRead={onMarkConversationRead} initialChannel="support" channelOnly focusSupportId={focusSupportId} />
      )}

      {activeTab === 'settings' && (
        <ClientSettingsHub
          business={business}
          currentLang={currentLang}
          accountEmail={currentUser.email}
          notificationPreferences={notificationPreferences}
          onNotificationPreferencesChange={onNotificationPreferencesChange}
        />
      )}

      {/* Export Hub Tab */}
      {activeTab === 'export' && (
        <ClientExportHub business={business} currentLang={currentLang} purchaseOrders={purchaseOrders} />
      )}

      {selectedBusinessPost && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--color-bg-surface-dark)]/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="business-post-detail-title"
          onClick={() => setSelectedBusinessPost(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] p-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-green-600)]">{t('business.PublicacaoCriadaPela')}</p>
                <h2 id="business-post-detail-title" className="mt-1 text-xl font-black text-[var(--color-text-strong)]">
                  {selectedBusinessPost.title || 'Publica��o sem t�tulo'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
                  {new Date(selectedBusinessPost.createdAt).toLocaleString('pt-PT')}
                </p>
              </div>
              <IconButton label="Fechar publica��o" variant="secondary" size="sm" onClick={() => setSelectedBusinessPost(null)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="space-y-5 p-5">
              {selectedBusinessPost.imageUrl && (
                <img src={selectedBusinessPost.imageUrl} alt={selectedBusinessPost.title || t('business.ImagemPublicacao')} className="max-h-[420px] w-full rounded-2xl object-cover" />
              )}
              {selectedBusinessPost.videoUrl && (
                <video src={selectedBusinessPost.videoUrl} controls className="max-h-[420px] w-full rounded-2xl bg-[var(--color-bg-surface-dark)]" />
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-strong)]">{selectedBusinessPost.content}</p>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold text-[var(--color-text-muted)]">
                <span className="rounded-full bg-[var(--color-bg-subtle)] px-3 py-1">Gostos: {selectedBusinessPost.likesCount}</span>
                <span className="rounded-full bg-[var(--color-green-50)] px-3 py-1 text-[var(--color-emerald-700)]">Estado: {selectedBusinessPost.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy Extra Post Modal (4.3) */}
      {showBuyPostModal && activeTab === 'my_business' && (
        <div className="fixed inset-0 bg-[var(--color-bg-surface-dark)]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-[var(--color-neutral-0)] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overscroll-contain">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-[var(--color-text-strong)] text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[var(--color-green-600)]" />
                <span>Comprar Post Extra (Avulso)</span>
              </h3>
              <IconButton label="Fechar compra de post extra" variant="ghost"
                onClick={() => setShowBuyPostModal(false)}
                className="guigui-close-button"
                title="Fechar"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </IconButton>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t('business.EscolhaPacoteCreditos')}</p>

            <div className="bg-[var(--color-green-50)] p-4 rounded-2xl border-[var(--color-green-200)] space-y-3 font-mono">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-[10px] text-[var(--color-blue-800)] uppercase font-bold">{t('business.PostsExtraPublicaveis')}</div><div className="text-xs text-[var(--color-green-600)]">{t('business.ComAprovacaoVia')}</div></div>
                <select value={extraPostQuantity} onChange={(e) => setExtraPostQuantity(Number(e.target.value) || 1)} className="rounded-xl border-[var(--color-green-200)] bg-[var(--color-bg-surface)] px-2 py-2 text-xs font-black text-[var(--color-green-900)]" aria-label="Pacote de posts extra">
                  {(postExtraProduct?.priceRules || [{ id: 'post-extra-default', quantity: 1, label: '+1 post', price: pricingConfig.extraPostPriceXOF }]).map((rule) => <option key={rule.id} value={rule.quantity}>{rule.label}</option>)}
                </select>
              </div>
              <div className="text-right text-base font-black text-[var(--color-green-700)]">{postExtraPrice.toLocaleString('pt-PT')} XOF</div>
            </div>

            <form onSubmit={handleBuyExtraPost} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--color-text-strong)] font-semibold mb-1">{t('business.SelecioneCarteiraTelemovel')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedPaymentProvider === 'orange' ? 'accent' : 'secondary'}
                    size="sm"
                    type="button"
                    onClick={() => setSelectedPaymentProvider('orange')}
                    className={`p-3 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 ${
                      selectedPaymentProvider === 'orange'
                        ? 'border-[var(--color-gold-500)] bg-[var(--color-gold-50)] text-[var(--color-gold-900)] ring-2 ring-[var(--color-gold-500)]'
                        : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span>Orange Money</span>
                  </Button>
                  <Button
                    variant={selectedPaymentProvider === 'telecel' ? 'primary' : 'secondary'}
                    size="sm"
                    type="button"
                    onClick={() => setSelectedPaymentProvider('telecel')}
                    className={`p-3 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 ${
                      selectedPaymentProvider === 'telecel'
                        ? 'border-[var(--color-green-600)] bg-[var(--color-green-50)] text-[var(--color-green-900)] ring-2 ring-[var(--color-green-600)]'
                        : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span>Telecel Cash</span>
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-[var(--color-text-strong)] font-semibold mb-1">{t('business.NumeroTelemovel245')}</label>
                <input
                  type="text"
                  required
                  value={mobileMoneyPhone}
                  onChange={(e) => setMobileMoneyPhone(e.target.value)}
                  className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 font-mono text-[var(--color-text-strong)]"
                />
              </div>

              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={isProcessingPayment}
                className="w-full py-3.5 bg-[var(--color-green-600)] hover:bg-[var(--color-green-700)] text-white font-extrabold rounded-xl transition shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>{isProcessingPayment ? 'A Processar SMS...' : `Pagar ${postExtraPrice.toLocaleString('pt-PT')} XOF via Telem�vel`}</span>
              </Button>
            </form>
          </div>
        </div>
      )}
      {/* Buy Extra Promotion Modal */}
      {showBuyPromoModal && (
        <div className="fixed inset-0 bg-[var(--color-bg-surface-dark)]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-[var(--color-neutral-0)] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overscroll-contain">
            <div className="flex items-center justify-between border-b pb-3"><h3 className="font-extrabold text-[var(--color-text-strong)] text-base flex items-center gap-2"><Tag className="w-5 h-5 text-[var(--color-gold-600)]" /><span>{t('business.ComprarPromocaoExtra')}</span></h3><button type="button" onClick={() => setShowBuyPromoModal(false)} className="guigui-close-button" aria-label={t('business.FecharCompraPromocao')} title="Fechar"><X className="w-4 h-4" /></button></div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t('business.EscolhaPacotePromocoes')}</p>
            <div className="bg-[var(--color-gold-50)] p-4 rounded-2xl border-[var(--color-gold-200)] space-y-3 font-mono"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] text-[var(--color-gold-800)] uppercase font-bold">Destaques promocionais</div><div className="text-xs text-[var(--color-gold-700)]">{t('business.PrecoQuantidadeDefinidos')}</div></div><select value={extraPromotionQuantity} onChange={(e) => setExtraPromotionQuantity(Number(e.target.value) || 1)} className="rounded-xl border-[var(--color-gold-200)] bg-[var(--color-bg-surface)] px-2 py-2 text-xs font-black text-[var(--color-gold-900)]" aria-label={t('business.PacotePromocoesExtra')}>{(promotionExtraProduct?.priceRules || [{ id: 'promotion-extra-default', quantity: 1, label: '+1 promo��o', price: pricingConfig.extraPromotionPriceXOF }]).map((rule) => <option key={rule.id} value={rule.quantity}>{rule.label}</option>)}</select></div><div className="text-right text-base font-black text-[var(--color-gold-700)]">{promotionExtraPrice.toLocaleString('pt-PT')} XOF</div></div>
            <form onSubmit={handleBuyExtraPromo} className="space-y-4 text-xs"><div><label className="block text-[var(--color-text-strong)] font-semibold mb-1">{t('business.SeleccioneCarteiraTelemovel')}</label><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setSelectedPaymentProvider('orange')} className={`p-3 rounded-xl border text-center font-bold transition ${selectedPaymentProvider === 'orange' ? 'border-[var(--color-gold-500)] bg-[var(--color-gold-50)] text-[var(--color-gold-900)] ring-2 ring-[var(--color-gold-500)]' : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)]'}`}>Orange Money</button><button type="button" onClick={() => setSelectedPaymentProvider('telecel')} className={`p-3 rounded-xl border text-center font-bold transition ${selectedPaymentProvider === 'telecel' ? 'border-[var(--color-green-600)] bg-[var(--color-green-50)] text-[var(--color-green-900)] ring-2 ring-[var(--color-green-600)]' : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)]'}`}>Telecel Cash</button></div></div><div><label className="block text-[var(--color-text-strong)] font-semibold mb-1">{t('business.NumeroTelemovel2452')}</label><input type="text" required value={mobileMoneyPhone} onChange={(e) => setMobileMoneyPhone(e.target.value)} className="w-full bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl p-3 font-mono text-[var(--color-text-strong)]" /></div><button type="submit" disabled={isProcessingPayment} className="w-full py-3.5 bg-[var(--color-gold-600)] hover:bg-[var(--color-gold-700)] text-white font-extrabold rounded-xl transition shadow-sm min-h-[44px]">{isProcessingPayment ? 'A Processar SMS...' : `Pagar ${promotionExtraPrice.toLocaleString('pt-PT')} XOF via Telem�vel`}</button></form>
          </div>
        </div>
      )}

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-[var(--color-bg-surface-dark)]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-[var(--color-bg-surface)] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overscroll-contain">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-[var(--color-text-strong)] text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-[var(--color-gold-500)]" />
                <span>{t('business.EscolherLibertarEscalao')}</span>
              </h3>
              <button type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="guigui-close-button"
                aria-label="Fechar escolha de plano"
                title="Fechar"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t('business.EscolhaNovoEscalao')}<strong>{business.name}</strong>{t('business.ConcluirPagamentoCom')}</p>

            {/* Select Tier Grid */}
            <div className="grid grid-cols-2 gap-3">
              {availableSubscriptionPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => { setTargetUpgradePlanId(plan.id); if (plan.legacyTier) setTargetUpgradeTier(plan.legacyTier); }}
                  className={`p-3.5 rounded-2xl border text-left transition relative ${
                    targetUpgradePlanId === plan.id
                      ? 'bg-[var(--color-green-50)] border-[var(--color-green-600)] ring-2 ring-[var(--color-green-600)] font-extrabold shadow-sm'
                      : 'bg-[var(--color-neutral-0)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  <div className="font-black text-[var(--color-text-strong)] text-xs">{plan.name}</div>
                  <div className="text-[10px] text-[var(--color-green-700)] font-bold mt-1">{limitLabel(plan.postsPerMonth)} posts · {limitLabel(plan.promotionsPerMonth)} promo��es</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{plan.price > 0 ? `${plan.price.toLocaleString('pt-PT')} ${plan.currency}${t('business.Mes')}` : t('business.PrecoNegociado')}</div>
                  {targetUpgradePlanId === plan.id && (
                    <CheckCircle className="w-4 h-4 text-[var(--color-green-600)] absolute top-3 right-3" />
                  )}
                </button>
              ))}
            </div>

            <form onSubmit={handleExecuteAutomatedPlanUpgrade} className="space-y-4 text-xs pt-2">
              <div>
                <label className="block text-[var(--color-text-strong)] font-bold mb-1">{t('business.NumeroTelemovelOrange')}</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={upgradePaymentPhone}
                    onChange={(e) => setUpgradePaymentPhone(e.target.value)}
                    placeholder="+245 955 00 11 22"
                    className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)] rounded-xl font-mono text-[var(--color-text-strong)] text-xs font-bold focus:bg-[var(--color-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-green-600)]"
                  />
                </div>
              </div>

              <div className="bg-[var(--color-green-50)] p-3 rounded-xl border-[var(--color-green-200)] text-[11px] text-[var(--color-emerald-900)] leading-relaxed">
                ⚡ <strong>{t('business.AtivacaoInstantanea')}</strong>{t('business.AssimQueIntroduzir')}<strong>{getPlanById(normaliseSubscriptionPlans(subscriptionPlans), targetUpgradePlanId, targetUpgradeTier).name.toUpperCase()}</strong>{t('business.SeraAutomaticamenteLiberado')}</div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2.5 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle-dark)] text-[var(--color-text-strong)] font-bold rounded-xl transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isUpgrading}
                  className="px-6 py-2.5 bg-[var(--color-green-600)] hover:bg-[var(--color-emerald-700)] text-white font-black rounded-xl transition shadow-md flex items-center gap-2"
                >
                  {isUpgrading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('business.LibertarEscalao')}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-[var(--color-gold-300)]" />
                      <span>Pagar & Libertar {getPlanById(normaliseSubscriptionPlans(subscriptionPlans), targetUpgradePlanId, targetUpgradeTier).name}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal for Purchase Order */}
      {selectedOrderForQr && (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-surface-dark)]/70 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-[var(--color-bg-surface)] rounded-3xl max-w-md w-full p-6 text-[var(--color-text-strong)] relative shadow-2xl space-y-4 overscroll-contain">
            <IconButton label="Fechar QR Code" variant="secondary"
              onClick={() => setSelectedOrderForQr(null)}
              className="absolute top-4 right-4 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle-dark)] text-[var(--color-text-muted)] p-2 rounded-full transition z-10"
              title="Fechar QR Code"
            >
              <X className="w-5 h-5" />
            </IconButton>
  
            <QRCodeDisplay
              code={selectedOrderForQr.orderCode}
              qrToken={selectedOrderForQr.qrToken}
              title={selectedOrderForQr.itemTitle}
              subtitle={selectedOrderForQr.businessName}
              buyerName={selectedOrderForQr.customerName}
              buyerPhone={selectedOrderForQr.customerPhone}
              amountXOF={selectedOrderForQr.totalPriceXOF}
              status={selectedOrderForQr.status}
              currentLang={currentLang}
            />
          </div>
        </div>
      )}
    </div>
    </main>
      </div>
    </div>
  );
};


















