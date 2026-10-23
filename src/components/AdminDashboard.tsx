import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  Ticket,
  DollarSign,
  Search,
  Sparkles,
  AlertTriangle,
  UserCheck,
  Users,
  Eye,
  Filter,
  Check,
  X,
  AlertCircle,
  Table,
  Tag,
  Palette,
  Settings,
  Edit2,
  Save,
  Clock,
  Percent,
  FolderTree,
  Plus,
  Trash2,
  Archive,
  Layers,
  Info,
  Sliders,
  History,
  MessageSquare,
  HelpCircle,
  RefreshCw,
  FileText,
  SlidersHorizontal,
  ShieldAlert,
  Smartphone,
  Download,
  CreditCard,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Receipt,
  Server,
  HardDrive,
  Globe2,
  WifiOff,
  Database,
  DownloadCloud,
  Wifi,
  Radio,
  Bell,
  Activity,
  LogOut,
  Calendar,
  BarChart3,
  Megaphone,
  Globe,
} from 'lucide-react';
import { AdminProfilePanel } from './admin/AdminProfilePanel';
import { AdminStaffManagement } from './admin/AdminStaffManagement';
import { AdminAuditLogsHub } from './admin/AdminAuditLogsHub';
import { AdminOverview } from './admin/AdminOverview';
import { AdminUsersHub } from './admin/AdminUsersHub';
import { AdminCapabilityHub } from './admin/AdminCapabilityHub';
import { AdminPermissionsMatrix } from './admin/AdminPermissionsMatrix';
import { AdminReportsHub } from './admin/AdminReportsHub';
import { AdminSupportHub } from './admin/AdminSupportHub';
import { SubscriptionPlansAdmin } from './admin/SubscriptionPlansAdmin';
import { FeaturedBusinessesAdmin } from './admin/FeaturedBusinessesAdmin';
import { MonetizationAdmin } from './admin/MonetizationAdmin';
import { INITIAL_ADMIN_STAFF } from '../data/adminStaffData';
import { INITIAL_AUDIT_LOGS } from '../data/auditLogsData';
import { downloadCSV, downloadExcel, downloadPDFReport } from '../utils/exportHelpers';
import { filterModerationLogs, getModerationWorkflowColumn, transitionModerationLog } from '../utils/moderationWorkflow';
import {
  Business,
  EventItem,
  Language,
  CategoryGroup,
  PriceAuditLogItem,
  BusinessModelConfig,
  SubscriptionTier,
  BusinessCategory,
  ModerationLogItem,
  ModerationSettings,
  PaymentTransaction,
  MonetizationCatalog,
  MobileOperatorConfig,
  PaymentUseCase,
  PaymentStatus,
  AdminStaffMember,
  AuditLogEntry,
  AppNotification,
  NotificationPreferences,
  NotificationTargetRole,
  NotificationPriority,
  NotificationChannel,
  SupportRequest,
} from '../types';
import { getLanguageShortLabel, getNextLanguage, getTranslation } from '../utils/i18n';
import { DEFAULT_MODERATION_SETTINGS } from '../utils/moderation';
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel';
import type { NotificationEventInput } from '../services/notificationService';
import { usePersistentState } from '../utils/persistentState';
import { DEFAULT_MONETIZATION_CATALOG } from '../data/monetizationCatalog';
import { usePageEntryScroll } from '../utils/navigationBehavior';
import { Badge, Button, Card, EmptyState, IconButton } from './ui';
import { ADMIN_NAVIGATION } from '../config/navigation';

interface AdminDashboardProps {
  businesses: Business[];
  events: EventItem[];
  currentLang: Language;
  currentThemeMode?: 'light' | 'dark' | 'auto';
  onLanguageChange?: (lang: Language) => void;
  onThemeModeChange?: (mode: 'light' | 'dark' | 'auto') => void;
  onUpdateBusinesses?: (businesses: Business[]) => void;
  onBusinessDecision?: (businessId: string, decision: 'approve' | 'reject', reason?: string) => Promise<Business | undefined>;
  adminStaff?: AdminStaffMember[];
  auditLogs?: AuditLogEntry[];
  onUpdateAdminStaff?: (staff: AdminStaffMember[]) => void;
  onUpdateAuditLogs?: (logs: AuditLogEntry[]) => void;
  notificationPreferences?: NotificationPreferences;
  onNotificationPreferencesChange?: (next: NotificationPreferences) => void;
  onSystemEvent?: (event: NotificationEventInput) => void;
  supportRequests?: SupportRequest[];
  onReplySupport?: (requestId: string, text: string) => void;
  onUpdateSupportStatus?: (requestId: string, status: SupportRequest['status']) => void;
  focusSupportId?: string | null;
  initialTab?: 'capabilities' | 'profile' | 'overview' | 'businesses' | 'moderation' | 'pricing' | 'categories' | 'roles' | 'admin_staff' | 'audit_logs' | 'events' | 'financials' | 'architecture' | 'reports' | 'notifications' | 'support';
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

const getPaymentStatusLabel = (
  transaction: Pick<PaymentTransaction, 'status' | 'providerMode' | 'provider' | 'manualProofReference'>,
) => {
  if (transaction.provider === 'manual_transfer' || transaction.manualProofReference) {
    return 'Registo legado; somente leitura';
  }
  if (transaction.status === 'confirmed_api') {
    return transaction.providerMode === 'simulated' ? 'Confirmado em modo simulado' : 'Confirmado API Sandbox';
  }
  if (transaction.status === 'pending_provider') {
    return transaction.providerMode === 'simulated' ? 'Pendente em modo simulado' : 'Pendente do provider';
  }
  if (transaction.status === 'pending_manual_confirmation') return 'Pendente de confirmação manual';
  return transaction.status;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  businesses: initialBusinesses,
  events,
  currentLang,
  currentThemeMode = 'auto',
  onLanguageChange,
  onThemeModeChange,
  onUpdateBusinesses,
  onBusinessDecision,
  adminStaff: initialAdminStaff = INITIAL_ADMIN_STAFF,
  auditLogs: initialAuditLogs = INITIAL_AUDIT_LOGS,
  onUpdateAdminStaff,
  onUpdateAuditLogs,
  notificationPreferences,
  onNotificationPreferencesChange,
  onSystemEvent,
  supportRequests = [],
  onReplySupport,
  onUpdateSupportStatus,
  focusSupportId,
  initialTab = 'overview',
  sidebarCollapsed: controlledSidebarCollapsed,
  onSidebarCollapsedChange,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const navigateAdminTab = (tab: string) => {
    const aliases: Record<string, typeof activeTab> = {
      tickets: 'events',
      logs: 'audit_logs',
    };
    setActiveTab(aliases[tab] || tab as typeof activeTab);
  };

  const pendingAdminSupport = supportRequests.filter((request) => request.status !== 'resolved').length;
  // Badge de empresas pendentes reflecte o banco (prop inicial já vem do PostgreSQL).
  const pendingBusinessesCount = initialBusinesses.filter((business) => business.status === 'pending').length;
  // Badge de moderação pendente vem das estatísticas reais agregadas do banco.
  const [pendingModerationCount, setPendingModerationCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        const pending = Number(data?.moderation?.byStatus?.pending ?? 0);
        if (!cancelled && Number.isFinite(pending)) setPendingModerationCount(pending);
      } catch {
        // Badge informativo: uma falha de rede não deve bloquear o painel.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const adminNavigationGroups: Array<{ heading: string; items: Array<{ label: string; tab: typeof activeTab; icon: React.ComponentType<{ className?: string }>; help: string; count?: number }> }> = [
    {
      heading: t('adminNavDashboard'),
      items: [
        { label: t('adminNavOverview'), tab: 'overview', icon: Activity, help: t('adminNavOverviewHelp') },
      ],
    },
    {
      heading: t('adminNavManagement'),
      items: [
        { label: t('adminNavBusinesses'), tab: 'businesses', icon: Building2, help: t('adminNavBusinessesHelp'), count: pendingBusinessesCount },
        { label: t('adminNavEvents'), tab: 'events', icon: Ticket, help: t('adminNavEventsHelp') },
        { label: t('adminNavUsers'), tab: 'users', icon: Users, help: t('adminNavUsersHelp') },
      ],
    },
    {
      heading: t('adminNavFinance'),
      items: [
        { label: t('adminNavFinancials'), tab: 'financials', icon: DollarSign, help: t('adminNavFinancialsHelp') },
        { label: t('adminNavPricing'), tab: 'pricing', icon: CreditCard, help: t('adminNavPricingHelp') },
      ],
    },
    {
      heading: t('adminNavControl'),
      items: [
        { label: t('adminNavModeration'), tab: 'moderation', icon: ShieldAlert, help: t('adminNavModerationHelp'), count: pendingModerationCount },
        { label: t('adminNavReports'), tab: 'reports', icon: BarChart3, help: t('adminNavReportsHelp') },
      ],
    },
    {
      heading: t('admin.support'),
      items: [
        { label: t('admin.support'), tab: 'support', icon: MessageSquare, help: t('admin.supportHelp'), count: pendingAdminSupport },
        { label: t('adminNavNotifications'), tab: 'notifications', icon: Bell, help: t('adminNavNotificationsHelp') },
      ],
    },
    {
      heading: t('adminNavAdministration'),
      items: [
        { label: t('adminNavRoles'), tab: 'roles', icon: ShieldCheck, help: t('adminNavRolesHelp') },
        { label: t('admin.team'), tab: 'admin_staff', icon: UserCheck, help: t('adminNavStaffHelp') },
        { label: t('adminNavCategories'), tab: 'categories', icon: Tag, help: t('adminNavCategoriesHelp') },
        { label: t('adminNavSystem'), tab: 'architecture', icon: Server, help: t('adminNavSystemHelp') },
        { label: t('adminNavGlobal'), tab: 'capabilities', icon: SlidersHorizontal, help: t('adminNavGlobalHelp') },
      ],
    },
    {
      heading: t('adminNavSecurity'),
      items: [
        { label: 'Auditoria', tab: 'audit_logs', icon: History, help: t('adminNavAuditHelp') },
      ],
    },
  ];

  const allAdminItems = adminNavigationGroups.flatMap((group) => group.items);
  const configuredAdminNavigation = ADMIN_NAVIGATION;
  const [activeTab, setActiveTab] = useState<'capabilities' | 'profile' | 'overview' | 'businesses' | 'moderation' | 'pricing' | 'categories' | 'users' | 'roles' | 'admin_staff' | 'audit_logs' | 'events' | 'financials' | 'architecture' | 'reports' | 'notifications' | 'support'>(initialTab);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  usePageEntryScroll(activeTab);
  // Events & tickets tab: estado + dados derivados
  const [eventsQuery, setEventsQuery] = useState('');
  const [eventsStatusFilter, setEventsStatusFilter] = useState<'all' | EventItem['status']>('all');
  const [selectedEventDetail, setSelectedEventDetail] = useState<EventItem | null>(null);
  const filteredAdminEvents = useMemo(() => {
    const query = eventsQuery.trim().toLowerCase();
    return events.filter((ev) => {
      if (eventsStatusFilter !== 'all' && ev.status !== eventsStatusFilter) return false;
      if (!query) return true;
      return [ev.title, ev.organizerName, ev.location, ev.category, ev.neighborhood]
        .some((field) => field.toLowerCase().includes(query));
    });
  }, [events, eventsQuery, eventsStatusFilter]);
  const adminEventsKpis = useMemo(() => ({
    total: events.length,
    active: events.filter((ev) => ev.status === 'active').length,
    ticketsSold: events.reduce((acc, ev) => acc + ev.totalTicketsSold, 0),
    revenueXOF: events.reduce((acc, ev) => acc + ev.totalRevenueXOF, 0),
  }), [events]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [internalSidebarCollapsed, setInternalSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('guigui-admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const sidebarCollapsed = controlledSidebarCollapsed ?? internalSidebarCollapsed;
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const setSidebarCollapsed = (next: boolean | ((value: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(sidebarCollapsed) : next;
    if (controlledSidebarCollapsed === undefined) setInternalSidebarCollapsed(value);
    onSidebarCollapsedChange?.(value);
  };
  const [businessesList, setBusinessesList] = useState<Business[]>(initialBusinesses);
  // Reflecte no painel as alterações do estado global (carregado do app_state/BD),
  // para a lista de empresas mostrar sempre a base de dados e não uma cópia presa.
  useEffect(() => {
    setBusinessesList(initialBusinesses);
  }, [initialBusinesses]);
  const [staffList, setStaffList] = useState<AdminStaffMember[]>(initialAdminStaff);
  const [logsList, setLogsList] = useState<AuditLogEntry[]>(initialAuditLogs);
  useEffect(() => {
    if (focusSupportId) setActiveTab('support');
    else setActiveTab(initialTab);
  }, [focusSupportId, initialTab]);
  const [announcementTargetRole, setAnnouncementTargetRole] = useState<NotificationTargetRole>('admin');
  const [announcementRecipient, setAnnouncementRecipient] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<NotificationPriority>('info');
  const [announcementChannels, setAnnouncementChannels] = useState<NotificationChannel[]>(['in_app']);
  const [announcementExpiresAt, setAnnouncementExpiresAt] = useState('');

  const handleUpdateStaff = (newStaff: AdminStaffMember[]) => {
    setStaffList(newStaff);
    if (onUpdateAdminStaff) onUpdateAdminStaff(newStaff);
  };

  const handleAddStaff = (newStaff: AdminStaffMember) => {
    handleUpdateStaff([...staffList, newStaff]);
  };

  const handleUpdateStaffEntry = (updatedStaff: AdminStaffMember) => {
    handleUpdateStaff(staffList.map((staff) => staff.id === updatedStaff.id ? updatedStaff : staff));
  };

  const handleRevokeStaffAccess = (id: string, reason: string) => {
    handleUpdateStaff(staffList.map((staff) => staff.id === id ? { ...staff, status: 'revoked' as const } : staff));
    handleUpdateLogs([
      {
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        action: 'admin_revoked',
        actionLabel: 'Acesso de Administrador Revogado',
        category: 'admin_management',
        severity: 'critical',
        targetEntity: id,
        targetId: id,
        actorId: 'usr-3',
        actorName: 'Administrador Guigui System',
        actorRole: 'super_admin',
        ipAddress: '127.0.0.1',
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Guigui Admin Console',
        details: reason,
      },
      ...logsList,
    ]);
  };

  const handleUpdateLogs = (newLogs: AuditLogEntry[]) => {
    setLogsList(newLogs);
    if (onUpdateAuditLogs) onUpdateAuditLogs(newLogs);
  };

  const handleSendAdminAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSystemEvent || !announcementTitle.trim() || !announcementMessage.trim()) return;
    if ((announcementTargetRole === 'user' || announcementTargetRole === 'business') && !announcementRecipient.trim()) return;

    const metadata: Record<string, unknown> = {
      targetRole: announcementTargetRole,
      title: announcementTitle.trim(),
      priority: announcementPriority,
      category: 'system',
      channels: announcementChannels,
      actionLabel: 'Ver aviso',
    };
    if (announcementTargetRole === 'user') metadata.targetUserId = announcementRecipient.trim();
    if (announcementTargetRole === 'business') metadata.targetBusinessId = announcementRecipient.trim();
    if (announcementExpiresAt) metadata.expiresAt = `${announcementExpiresAt}T23:59:59.000Z`;

    onSystemEvent({
      eventType: 'ADMIN_ANNOUNCEMENT',
      entityType: 'system',
      message: announcementMessage.trim(),
      metadata,
    });
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementRecipient('');
    setAnnouncementExpiresAt('');
    setAnnouncementChannels(['in_app']);
  };

  // Section 11 Architecture & Security State
  const [archBackupLogs, setArchBackupLogs] = useState([
    {
      id: 'BKP-2026-08-04-0200',
      type: 'automatic_daily',
      regionPrimary: 'DigitalOcean Frankfurt (fra1)',
      regionSecondary: 'DigitalOcean Amsterdam (ams3)',
      status: 'completed_verified',
      sizeMB: 842,
      timestamp: '2026-08-04 02:00:00',
    },
    {
      id: 'BKP-2026-08-03-0200',
      type: 'automatic_daily',
      regionPrimary: 'DigitalOcean Frankfurt (fra1)',
      regionSecondary: 'DigitalOcean Amsterdam (ams3)',
      status: 'completed_verified',
      sizeMB: 835,
      timestamp: '2026-08-03 02:00:00',
    },
  ]);

  const [consentLogsList, setConsentLogsList] = useState([
    {
      id: 'CONSENT-2026-001',
      userName: 'Mamadu Djaló',
      phone: '+245 955 12 34 56',
      ipAddress: '197.214.42.10 (Bissau)',
      acceptedAt: '2026-08-01 10:14:22',
      termsVersion: 'v2.4_GDPR_Guigui_2026',
      diasporaGdprCompliant: true,
    },
    {
      id: 'CONSENT-2026-002',
      userName: 'Soraia Gomes',
      phone: '+245 966 44 33 22',
      ipAddress: '82.155.192.4 (Lisboa)',
      acceptedAt: '2026-08-04 14:18:02',
      termsVersion: 'v2.4_GDPR_Guigui_2026',
      diasporaGdprCompliant: true,
    },
  ]);

  const [isTriggeringBackup, setIsTriggeringBackup] = useState(false);

  // Category Structure Management State (Section 5)
  const [categoriesList, setCategoriesList] = useState<BusinessCategory[]>([]);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroupId, setNewCatGroupId] = useState<'restauracao' | 'hotelaria_saude_educacao' | 'corporativo_financeiro' | 'ongs_artesãos' | 'servicos_profissionais'>('restauracao');
  const [newCatSubcategories, setNewCatSubcategories] = useState('');
  const [selectedCatForSub, setSelectedCatForSub] = useState<string | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');

  React.useEffect(() => {
    // Load categories from database (PostgreSQL) instead of static initialData.ts fallback.
    const loadCategoriesFromDb = async () => {
      try {
        const response = await fetch('/api/admin/categories');
        if (!response.ok) return;
        const data = await response.json() as { categories?: Array<{ id: string; name: string; groupId: string; subcategories?: string[] }> };
        if (!Array.isArray(data.categories)) return;
        setCategoriesList(data.categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          groupId: (cat.groupId || '') as BusinessCategory['groupId'],
          iconName: 'FolderTree',
          subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : ['Geral'],
        })));
      } catch {
        // Database unavailable: remain empty; no static fallback.
      }
    };
    void loadCategoriesFromDb();
  }, []);
  React.useEffect(() => {
    const isModalOpen = Boolean(showAddCategoryModal);
    if (isModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      return () => {
        document.body.style.overflow = prev;
        document.body.classList.remove('modal-open');
      };
    }
  }, [showAddCategoryModal]);

  // Business Model Configuration State (4.1, 4.2, 4.3)
  const [config, setConfig] = usePersistentState<BusinessModelConfig>('guigui_admin_business_model_config', {
    ticketCommissionPercent: 10,
    ticketFixedFeeXOF: 200,
    extraPostPriceXOF: 5000,
    extraPromotionPriceXOF: 10000,
    bannerWeeklyPriceXOF: 50000,
    annualDiscountPercent: 15,
    includedPostsPerMonth: 3, // Fixed 3 posts across all tiers
    automaticSubscriptionSuspensionEnabled: true,
  });

  React.useEffect(() => {
    if (typeof config.bannerWeeklyPriceXOF !== 'number') {
      setConfig((previous) => ({ ...previous, bannerWeeklyPriceXOF: 50000 }));
    }
  }, [config.bannerWeeklyPriceXOF, setConfig]);

  const [monetizationCatalog, setMonetizationCatalog] = usePersistentState<MonetizationCatalog>('guigui_monetization_catalog', DEFAULT_MONETIZATION_CATALOG);

  // Configurable Category Group x Tier Pricing Matrix (4.2)
  const [categoryGroups, setCategoryGroups] = usePersistentState<CategoryGroup[]>('guigui_admin_category_groups', [
    {
      id: 'restauracao',
      name: 'Restauração, Cafés e Pequeno Comércio',
      description: 'Restaurantes, bares, lanchonetes, padarias, pequenas lojas de bairro',
      prices: { basic: 10000, professional: 25000, premium: 45000, enterprise: 85000 },
    },
    {
      id: 'hotelaria_saude_educacao',
      name: 'Hotelaria, Clínicas, Escolas e Comércio Médio',
      description: 'Hotéis, pousadas, clínicas médicas, escolas privadas, supermercados',
      prices: { basic: 15000, professional: 35000, premium: 65000, enterprise: 120000 },
    },
    {
      id: 'corporativo_financeiro',
      name: 'Bancos, Seguradoras, Telecoms e Construção',
      description: 'Instituições financeiras, operadoras telemóvel, concessionárias, construtoras',
      prices: { basic: 35000, professional: 75000, premium: 150000, enterprise: 300000 },
    },
    {
      id: 'ongs_artesãos',
      name: 'ONGs, Associações e Artesãos Local',
      description: 'Organizações comunitárias, artesãos de Bissau, cooperativas culturais',
      prices: { basic: 5000, professional: 12000, premium: 25000, enterprise: 50000 },
    },
    {
      id: 'servicos_profissionais',
      name: 'Serviços Profissionais e Consultoria',
      description: 'Escritórios de advocacia, contabilidade, oficinas, consultores independentes',
      prices: { basic: 12000, professional: 28000, premium: 50000, enterprise: 95000 },
    },
  ]);

  // Price Audit Log History (4.2.b & 4.2.c)
  const [auditLogs, setAuditLogs] = usePersistentState<PriceAuditLogItem[]>('guigui_admin_price_audit_logs', [
    {
      id: 'audit-1',
      date: '2026-08-01 10:30',
      categoryGroup: 'Restauração, Cafés e Pequeno Comércio',
      tier: 'professional',
      oldPrice: 20000,
      newPrice: 25000,
      updatedBy: 'Admin Guigui',
    },
    {
      id: 'audit-2',
      date: '2026-07-15 14:10',
      categoryGroup: 'Bancos, Seguradoras, Telecoms e Construção',
      tier: 'enterprise',
      oldPrice: 280000,
      newPrice: 300000,
      updatedBy: 'Admin Guigui',
    },
  ]);

  // Editing cell state
  const [editingCell, setEditingCell] = useState<{ groupId: string; tier: SubscriptionTier; price: number } | null>(null);
  const [configNotice, setConfigNotice] = useState<string | null>(null);

  // Section 9 Content Moderation Settings & State
  const [modSettings, setModSettings] = useState<ModerationSettings>(DEFAULT_MODERATION_SETTINGS);
  const [modFilter, setModFilter] = useState<'all' | 'pending' | 'amarelo' | 'vermelho' | 'approved' | 'rejected'>('all');
  const [modTypeFilter, setModTypeFilter] = useState<'all' | ModerationLogItem['type']>('all');
  const [modBusinessFilter, setModBusinessFilter] = useState('all');
  const [modSearchQuery, setModSearchQuery] = useState('');
  const [modDateFrom, setModDateFrom] = useState('');
  const [modDateTo, setModDateTo] = useState('');
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<string | null>(null);

  const [moderationLogsList, setModerationLogsList] = useState<ModerationLogItem[]>([
    {
      id: 'mod-101',
      businessName: 'Bar Restaurant Coqueiros',
      authorName: 'Mamadu Djaló',
      authorPhone: '+245 955 12 34 56',
      type: 'post',
      contentSnippet: 'Kuri pa nos mancebo fasi bo reserva djunto na Restaurant Coqueiros este sábado no Bissau Velho!',
      imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=800',
      result: {
        status: 'amarelo',
        reason: 'Conteúdo em idioma não configurado: Classificado como Amarelo por precaução automática de IA (Secção 9.3).',
        confidence: 88,
        detectedCategories: ['idioma não configurado (Precaução 9.3)', 'Divulgação Comercial'],
        suggestedAction: 'flag_for_human_review',
        isCriouloLanguage: true,
      },
      status: 'pending_human',
      createdAt: '2026-08-04 17:45',
      auditTrail: [
        {
          timestamp: '2026-08-04 17:45',
          action: 'auto_classified',
          actor: 'Sistema IA Gemini',
          notes: 'Classificado como Amarelo devido a vocabulário em idioma não configurado.',
        },
      ],
    },
    {
      id: 'mod-102',
      businessName: 'Farmácia & Saúde Bissau',
      authorName: 'Dr. Aliu Embaló',
      authorPhone: '+245 966 88 77 66',
      type: 'promotion',
      contentSnippet: 'Garantido 100% cura definitiva de ansiedade com novo chá natural importado!',
      imageUrl: '',
      result: {
        status: 'vermelho',
        reason: 'Termos publicitários abusivos e enganosos detetados ("cura definitiva", "garantido 100%").',
        confidence: 96,
        detectedCategories: ['Alegação Médica Abusiva / Promessa Falsa'],
        suggestedAction: 'reject',
        isCriouloLanguage: false,
      },
      status: 'rejected',
      createdAt: '2026-08-04 16:30',
      auditTrail: [
        {
          timestamp: '2026-08-04 16:30',
          action: 'auto_classified',
          actor: 'Sistema IA Gemini',
          notes: 'Conteúdo rejeitado na submissão por violação das regras de alegações de saúde.',
        },
      ],
    },
    {
      id: 'mod-103',
      businessName: 'Clínica Médica Santa Luzia',
      authorName: 'Dra. Fatumata Seidi',
      authorPhone: '+245 955 99 00 11',
      type: 'post',
      contentSnippet: 'Consultas de cirurgia geral e pediatria disponíveis sem marcação prévia na zona de Santa Luzia.',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800',
      result: {
        status: 'verde',
        reason: 'Conteúdo institucional de saúde sem violações detetadas.',
        confidence: 98,
        detectedCategories: ['Conteúdo Conforme'],
        suggestedAction: 'approve',
        isCriouloLanguage: false,
      },
      status: 'approved',
      createdAt: '2026-08-04 15:10',
      auditTrail: [
        {
          timestamp: '2026-08-04 15:10',
          action: 'auto_classified',
          actor: 'Sistema IA Gemini',
          notes: 'Aprovado e publicado automaticamente.',
        },
      ],
    },
  ]);

  // Carrega auditoria e moderação directamente da base de dados (PostgreSQL).
  // Sem BD disponível, ou em falha de rede, mantêm-se as listas locais de demonstração.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/audit-logs?limit=500', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json() as { logs?: AuditLogEntry[] };
        if (!cancelled && Array.isArray(data.logs) && data.logs.length > 0) setLogsList(data.logs);
      } catch { /* manter lista local */ }
    })();
    void (async () => {
      try {
        const response = await fetch('/api/admin/moderation-logs', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json() as ModerationLogItem[];
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        // Registos vindos da BD podem vir incompletos (item_data antigo sem
        // result.status/confidence ou auditTrail). Normalizar à entrada evita
        // que um único registo malformado derrube o painel inteiro via
        // error boundary (crash em item.result.status.toUpperCase()).
        const normalized: ModerationLogItem[] = data.map((item) => ({
          ...item,
          businessName: item.businessName ?? 'Sem empresa',
          authorName: item.authorName ?? 'Desconhecido',
          createdAt: item.createdAt ?? new Date().toISOString(),
          auditTrail: Array.isArray(item.auditTrail) ? item.auditTrail : [],
          result: {
            status: item.result?.status ?? (item.status === 'approved' ? 'verde' : item.status === 'rejected' || item.status === 'appealed' ? 'vermelho' : 'amarelo'),
            reason: item.result?.reason ?? 'Sem motivo de análise registado.',
            confidence: typeof item.result?.confidence === 'number' ? item.result.confidence : 0,
            suggestedAction: item.result?.suggestedAction ?? 'flag_for_human_review',
            detectedCategories: item.result?.detectedCategories,
            isCriouloLanguage: item.result?.isCriouloLanguage,
          },
        }));
        setModerationLogsList(normalized);
      } catch { /* manter lista local */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Total MRR calculation
  const totalMrrXOF = businessesList.reduce((acc, b) => {
    if (b.status !== 'active') return acc;
    if (b.tier === 'enterprise') return acc + 65000;
    if (b.tier === 'premium') return acc + 35000;
    return acc + 15000;
  }, 0);
  // Cabeçalho com dados reais agregados (PostgreSQL) — substitui a estimativa local.
  const [headerStats, setHeaderStats] = useState<{ revenueGross: number; activeCompanies: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setHeaderStats({
          revenueGross: Number(data?.revenue?.grossXOF ?? 0),
          activeCompanies: Number(data?.companies?.byStatus?.active ?? 0),
        });
      } catch { /* fallback para contagem local */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Section 10 Payment Integration State & Reconciliation
  const [paymentTransactionsList, setPaymentTransactionsList] = useState<PaymentTransaction[]>([
    {
      id: 'TXN-2026-9011',
      useCase: 'subscription_initial',
      useCaseLabel: 'Subscrição Plano Profissional (1 Ano)',
      businessId: 'biz-1',
      businessName: 'Restaurant Coqueiros',
      payerName: 'Mamadu Djaló',
      payerPhone: '+245 955 12 34 56',
      amountXOF: 35000,
      provider: 'orange_money',
      providerRef: 'OM-2026-88192',
      status: 'confirmed_api',
      isApiIntegrationReady: false,
      createdAt: '2026-08-01 10:15',
      confirmedAt: '2026-08-01 10:16',
      confirmedBy: 'Orange Money Push API (Sandbox)',
    },
    {
      id: 'TXN-2026-9012',
      useCase: 'extra_posts',
      useCaseLabel: 'Pacote Extra +10 Posts Sociais',
      businessId: 'biz-2',
      businessName: 'Hotel Coqueiros Bissau',
      payerName: 'Soraia Gomes',
      payerPhone: '+245 966 44 33 22',
      amountXOF: 15000,
      provider: 'telecel',
      providerRef: 'TEL-245-00918',
      status: 'pending_manual_confirmation',
      isApiIntegrationReady: false,
      manualProofReference: 'Ref. SMS Telecel: 772819001 - Transferido para +245 966 00 00',
      createdAt: '2026-08-04 14:20',
    },
    {
      id: 'TXN-2026-9013',
      useCase: 'event_tickets',
      useCaseLabel: 'Compra de 2 Bilhetes VIP Festival de Bissau',
      businessId: 'biz-1',
      businessName: 'Bar Restaurant Coqueiros',
      payerName: 'Adama Baldé',
      payerPhone: '+245 955 99 88 77',
      amountXOF: 10000,
      provider: 'orange_money',
      providerRef: 'OM-2026-99201',
      status: 'confirmed_api',
      isApiIntegrationReady: false,
      createdAt: '2026-08-04 16:05',
      confirmedAt: '2026-08-04 16:05',
      confirmedBy: 'Orange Money Push API (Sandbox)',
    },
    {
      id: 'TXN-2026-9014',
      useCase: 'subscription_renewal',
      useCaseLabel: 'Renovação Anual Plano Premium',
      businessId: 'biz-3',
      businessName: 'Supermercado Bissau',
      payerName: 'Manuel Pereira',
      payerPhone: '+245 955 33 22 11',
      amountXOF: 65000,
      provider: 'manual_transfer',
      status: 'pending_manual_confirmation',
      isApiIntegrationReady: false,
      manualProofReference: 'Talão Depósito BDC #991023 no Balcão Central Guigui',
      createdAt: '2026-08-04 17:10',
    },
  ]);

  const platformPaymentTransactions = paymentTransactionsList.filter(
    (transaction) => transaction.useCase !== 'event_tickets' && transaction.useCase !== 'event_refund'
  );

  // Histórico real de pagamentos do PostgreSQL (100+ transacções). É apenas
  // leitura: alimenta o painel de Finanças sem interferir no fluxo de
  // reconciliação, que continua a operar sobre paymentTransactionsList.
  const [adminPaymentHistory, setAdminPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [adminPaymentHistoryLoading, setAdminPaymentHistoryLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'financials') return;
    let cancelled = false;
    const load = async () => {
      setAdminPaymentHistoryLoading(true);
      try {
        const response = await fetch('/api/admin/payments?limit=200', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data.transactions)) {
          setAdminPaymentHistory(data.transactions);
        }
      } catch {
        // Falha silenciosa: o histórico é complementar ao fluxo de reconciliação.
      } finally {
        if (!cancelled) setAdminPaymentHistoryLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeTab]);

  const isPlatformTransaction = (txnId: string) => {
    const transaction = paymentTransactionsList.find((item) => item.id === txnId);
    if (transaction?.useCase === 'event_tickets' || transaction?.useCase === 'event_refund') {
      alert('Operação bloqueada: compras e reembolsos de bilhetes pertencem à empresa organizadora.');
      return false;
    }
    return true;
  };

  const [operatorsList] = useState<MobileOperatorConfig[]>([
    {
      id: 'orange_money',
      name: 'Orange Money',
      shortName: 'Orange Money',
      dedicatedPhone: '+245 955 00 00',
      status: 'negotiating_api',
      onboardingWindow: '2 a 4 meses',
      supportsAutoPushOtp: true,
      activeTransactionsCount: 2,
      totalVolumeXOF: 45000,
    },
    {
      id: 'telecel',
      name: 'Telecel (Teletaco)',
      shortName: 'Telecel (Teletaco)',
      dedicatedPhone: '+245 966 00 00',
      status: 'negotiating_api',
      onboardingWindow: '2 a 4 meses',
      supportsAutoPushOtp: true,
      activeTransactionsCount: 1,
      totalVolumeXOF: 15000,
    },
  ]);

  const [paymentUseCaseFilter, setPaymentUseCaseFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentProviderFilter, setPaymentProviderFilter] = useState<string>('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState<string>('');

  // 1-Click Confirm Manual Payment
  const handleConfirmManualPayment = async (txnId: string) => {
    if (!isPlatformTransaction(txnId)) return;
    const transaction = paymentTransactionsList.find((item) => item.id === txnId);
    if (!transaction || transaction.provider === 'manual_transfer' || transaction.manualProofReference) {
      alert('Pagamentos legados com comprovativo manual não podem ser confirmados neste modo simulado.');
      return;
    }
    try {
      const res = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txnId, adminName: 'Admin Guigui' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.transaction) throw new Error(data.error || 'O backend não confirmou o pagamento.');
      onSystemEvent?.({
        eventType: 'PAYMENT_CONFIRMED',
        businessId: transaction?.businessId,
        businessName: transaction?.businessName,
        paymentId: txnId,
        entityType: 'payment',
        entityId: txnId,
        message: transaction?.useCaseLabel,
      });
      setPaymentTransactionsList((prev) =>
        prev.map((t) =>
          t.id === txnId
            ? {
                ...t,
                status: 'confirmed_manual',
                confirmedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                confirmedBy: 'Admin Guigui (Confirmação Manual MVP)',
              }
            : t
        )
      );
    } catch (err) {
      console.error(err);
      alert('Erro ao confirmar pagamento manual.');
    }
  };

  // 1-Click Reconcile Transaction
  const handleReconcileTransaction = async (txnId: string) => {
    if (!isPlatformTransaction(txnId)) return;
    try {
      const res = await fetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [txnId], adminName: 'Reconciliação Guigui' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || data.reconciledCount !== 1) throw new Error(data.error || 'A transação não está pronta para reconciliação.');
      setPaymentTransactionsList((prev) =>
        prev.map((t) =>
          t.id === txnId
            ? {
                ...t,
                status: 'reconciled',
                reconciledAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                reconciledBy: 'Reconciliação Extrato Operadora',
              }
            : t
        )
      );
    } catch (err) {
      console.error(err);
      alert('Erro ao reconciliar transação.');
    }
  };

  // Batch Reconcile
  const handleBatchReconcileConfirmed = async () => {
    const confirmedIds = platformPaymentTransactions
      .filter((t) => t.status === 'confirmed_api' || t.status === 'confirmed_manual')
      .map((t) => t.id);

    if (confirmedIds.length === 0) {
      alert('Não existem transações confirmadas pendentes de reconciliação.');
      return;
    }

    try {
      const res = await fetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: confirmedIds, adminName: 'Lote Reconciliação Guigui' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || data.reconciledCount !== confirmedIds.length) throw new Error(data.error || 'O lote não foi reconciliado por completo.');

      setPaymentTransactionsList((prev) =>
        prev.map((t) =>
          confirmedIds.includes(t.id)
            ? {
                ...t,
                status: 'reconciled',
                reconciledAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                reconciledBy: 'Lote Reconciliação Extrato',
              }
            : t
        )
      );
      alert(`${confirmedIds.length} transações reconciliadas com sucesso com os extratos das operadoras!`);
    } catch (err) {
      console.error(err);
      alert('Erro no processo de reconciliação em lote.');
    }
  };

  // Trigger Cloud Backup (Section 11.4)
  const handleTriggerManualCloudBackup = async () => {
    setIsTriggeringBackup(true);
    try {
      const res = await fetch('/api/system/backup/trigger', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.backup) throw new Error(data.error || 'O backup não foi confirmado pelo servidor.');
      setIsTriggeringBackup(false);
      if (data.backup) {
        setArchBackupLogs((prev) => [data.backup, ...prev]);
        onSystemEvent?.({
          eventType: 'BACKUP_COMPLETED',
          entityType: 'system',
          entityId: data.backup.id,
          message: 'Backup manual replicado na região secundária.',
        });
        alert('Backup manual acionado com sucesso e replicado na região secundária (Amsterdam ams3)!');
      }
    } catch (err) {
      console.error(err);
      setIsTriggeringBackup(false);
      onSystemEvent?.({
        eventType: 'BACKUP_FAILED',
        entityType: 'system',
        message: 'Não foi possível concluir o backup manual.',
      });
      alert('Erro ao acionar backup na nuvem.');
    }
  };

  // Refund Handler
  const handleRefundTransaction = async (txnId: string) => {
    if (!isPlatformTransaction(txnId)) return;
    const reason = prompt('Indique o motivo do reembolso (ex: Cancelamento de Evento / Erro de Pagamento):');
    if (!reason) return;

    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txnId, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.transaction) throw new Error(data.error || 'O reembolso não foi confirmado pelo backend.');

      const transaction = paymentTransactionsList.find((item) => item.id === txnId);
      onSystemEvent?.({
        eventType: 'PAYMENT_REFUNDED',
        businessId: transaction?.businessId,
        businessName: transaction?.businessName,
        paymentId: txnId,
        entityType: 'payment',
        entityId: txnId,
        message: transaction?.useCaseLabel,
      });
      setPaymentTransactionsList((prev) =>
        prev.map((t) =>
          t.id === txnId
            ? {
                ...t,
                status: 'refunded',
                refundedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                refundReason: reason,
              }
            : t
        )
      );
    } catch (err) {
      console.error(err);
      alert('Erro ao processar reembolso.');
    }
  };

  // Export Reconciliation Report CSV
  const handleExportReconciliationReport = () => {
    const csvHeader = 'ID_Transacao;Caso_Uso;Cliente;Telemovel;Valor_XOF;Operadora;Ref_Operadora_Comprovativo;Status;Data_Criacao;Data_Reconciliacao\n';
    const csvRows = platformPaymentTransactions
      .map((t) =>
        [
          t.id,
          t.useCaseLabel,
          t.payerName,
          t.payerPhone,
          t.amountXOF,
          t.provider.toUpperCase(),
          t.providerRef || t.manualProofReference || 'N/A',
          t.status.toUpperCase(),
          t.createdAt,
          t.reconciledAt || 'Nenhum',
        ].join(';')
      )
      .join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Guigui_Reconciliacao_Pagamentos_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateFinancialConfig = (field: keyof BusinessModelConfig, value: number) => {
    const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
    setConfig((previous) => ({ ...previous, [field]: safeValue }));
    if (['ticketCommissionPercent', 'ticketFixedFeeXOF', 'extraPostPriceXOF', 'extraPromotionPriceXOF', 'bannerWeeklyPriceXOF'].includes(field)) {
      setMonetizationCatalog((previous) => {
        const next: MonetizationCatalog = {
          ...previous,
          ticketFeePolicy: {
            ...previous.ticketFeePolicy,
            ...(field === 'ticketCommissionPercent' ? { commissionPercentage: safeValue } : {}),
            ...(field === 'ticketFixedFeeXOF' ? { fixedFee: safeValue } : {}),
            updatedAt: new Date().toISOString(),
          },
          products: previous.products.map((product) => (
            field === 'extraPostPriceXOF' && product.code === 'POST_EXTRA'
              ? { ...product, basePrice: safeValue, priceRules: product.priceRules.map((rule) => rule.quantity === 1 ? { ...rule, price: safeValue } : rule) }
              : field === 'extraPromotionPriceXOF' && product.code === 'PROMOTION_EXTRA'
                ? { ...product, basePrice: safeValue, priceRules: product.priceRules.map((rule) => rule.quantity === 1 ? { ...rule, price: safeValue } : rule) }
                : field === 'bannerWeeklyPriceXOF' && product.code === 'HOMEPAGE_BANNER'
                  ? { ...product, basePrice: safeValue, priceRules: product.priceRules.map((rule) => rule.durationDays === 7 ? { ...rule, price: safeValue } : rule) }
                  : product
          )),
          version: Math.max(1, previous.version || 1) + 1,
          updatedAt: new Date().toISOString(),
        };
        void fetch('/api/monetization/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => undefined);
        return next;
      });
    }
  };

  const handleSaveFinancialConfig = () => {
    setConfigNotice('Configuração financeira guardada para novas adesões, vendas e renovações.');
    window.setTimeout(() => setConfigNotice(null), 3500);
  };

  const handleSaveCellPrice = (groupId: string, tier: SubscriptionTier, newPrice: number) => {
    const group = categoryGroups.find((g) => g.id === groupId);
    if (!group) return;
    const oldPrice = group.prices[tier];

    setCategoryGroups((prev) =>
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
      id: 'audit-' + Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      categoryGroup: group.name,
      tier,
      oldPrice,
      newPrice,
      updatedBy: 'Admin Guigui',
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    setConfigNotice(`Preço ${tier} actualizado para ${newPrice.toLocaleString('pt-PT')} XOF.`);
    window.setTimeout(() => setConfigNotice(null), 3500);
    setEditingCell(null);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    const subList = newCatSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newCategory: BusinessCategory = {
      id: 'cat-' + (categoriesList.length + 1),
      name: newCatName,
      iconName: 'FolderTree',
      groupId: newCatGroupId,
      subcategories: subList.length > 0 ? subList : ['Geral'],
    };

    setCategoriesList((prev) => [...prev, newCategory]);
    setNewCatName('');
    setNewCatSubcategories('');
    setShowAddCategoryModal(false);
  };

  const handleAddSubcategory = (catId: string) => {
    if (!newSubcatName.trim()) return;
    setCategoriesList((prev) =>
      prev.map((cat) => {
        if (cat.id === catId) {
          return {
            ...cat,
            subcategories: [...cat.subcategories, newSubcatName.trim()],
          };
        }
        return cat;
      })
    );
    setNewSubcatName('');
    setSelectedCatForSub(null);
  };

  const handleRemoveSubcategory = (catId: string, subName: string) => {
    setCategoriesList((prev) =>
      prev.map((cat) => {
        if (cat.id === catId) {
          return {
            ...cat,
            subcategories: cat.subcategories.filter((s) => s !== subName),
          };
        }
        return cat;
      })
    );
  };

  const handleArchiveCategory = (catId: string) => {
    if (confirm('Tem a certeza que deseja arquivar esta categoria principal?')) {
      setCategoriesList((prev) => prev.filter((c) => c.id !== catId));
    }
  };

  const handleUpdateBusinesses = (nextBusinesses: Business[]) => {
    setBusinessesList(nextBusinesses);
    onUpdateBusinesses?.(nextBusinesses);
  };

  const handleToggleBusinessStatus = (id: string) => {
    const business = businessesList.find((item) => item.id === id);
    if (!business) return;
    const nextStatus = business.status === 'active' ? 'suspended' : 'active';
    handleUpdateBusinesses(businessesList.map((item) => item.id === id ? { ...item, status: nextStatus } : item));
    handleUpdateLogs([
      {
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        actorId: 'usr-3',
        actorName: 'Administrador Guigui System',
        actorRole: 'super_admin',
        action: nextStatus === 'active' ? 'business_reactivated' : 'business_suspended',
        actionLabel: nextStatus === 'active' ? 'Empresa Reativada' : 'Empresa Suspensa',
        category: 'business',
        severity: nextStatus === 'active' ? 'warning' : 'critical',
        targetEntity: business.name,
        targetId: business.id,
        ipAddress: '127.0.0.1',
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Guigui Admin Console',
        details: `Estado empresarial alterado para ${nextStatus}.`,
      },
      ...logsList,
    ]);
  };

  const handlePendingBusinessDecision = async (id: string, decision: 'approve' | 'reject') => {
    if (!onBusinessDecision) {
      alert('A decisão administrativa requer a ligação à base de dados.');
      return;
    }
    const reason = decision === 'reject' ? window.prompt('Indique o motivo da rejeição:')?.trim() : undefined;
    if (decision === 'reject' && (!reason || reason.length < 3)) return;
    try {
      await onBusinessDecision(id, decision, reason);
      setBusinessesList((previous) => previous.map((business) => business.id === id ? { ...business, status: decision === 'approve' ? 'active' : 'rejected' } : business));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível persistir a decisão administrativa.');
    }
  };

  const handleChangeBusinessTier = (id: string, tier: SubscriptionTier) => {
    const business = businessesList.find((item) => item.id === id);
    if (!business || business.tier === tier) return;
    if (business.subscriptionPaymentId || business.subscriptionStartedAt) {
      alert('O plano pago confirmado pertence à empresa e não pode ser alterado pelo Super Admin. A Administração pode suspender a empresa em caso de quebra contratual.');
      handleUpdateLogs([{
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        actorId: 'usr-3',
        actorName: 'Administrador Guigui System',
        actorRole: 'super_admin',
        action: 'business_tier_change_blocked',
        actionLabel: 'Alteração de Plano Bloqueada',
        category: 'security',
        severity: 'warning',
        targetEntity: business.name,
        targetId: business.id,
        ipAddress: '127.0.0.1',
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Guigui Admin Console',
        details: 'Tentativa de alteração de um plano pago confirmado bloqueada pela política de imutabilidade.',
      }, ...logsList]);
      return;
    }
    handleUpdateBusinesses(businessesList.map((item) => item.id === id ? { ...item, tier } : item));
    handleUpdateLogs([
      {
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        actorId: 'usr-3',
        actorName: 'Administrador Guigui System',
        actorRole: 'super_admin',
        action: 'business_tier_changed',
        actionLabel: 'Plano Empresarial Alterado',
        category: 'business',
        severity: 'security',
        targetEntity: business.name,
        targetId: business.id,
        ipAddress: '127.0.0.1',
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Guigui Admin Console',
        details: `Plano alterado de ${business.tier} para ${tier}.`,
        changes: [{ field: 'tier', fieldLabel: 'Plano de subscrição', oldValue: business.tier, newValue: tier }],
      },
      ...logsList,
    ]);
  };

  // Persiste a decisão de moderação no servidor (moderation_items em PostgreSQL).
  const persistModerationDecision = (id: string, action: 'approve' | 'reject' | 'appeal', notes?: string) => {
    void fetch('/api/moderation/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, notes }),
    }).catch(() => {});
  };

  const handleApproveModerationLog = (id: string) => {
    const item = moderationLogsList.find((entry) => entry.id === id);
    const business = item?.businessName ? businessesList.find((entry) => entry.name === item.businessName) : undefined;
    if (item && business) {
      onSystemEvent?.({
        eventType: item.type === 'business_profile' ? 'BUSINESS_APPROVED' : 'POST_APPROVED',
        businessId: business.id,
        businessName: business.name,
        entityType: item.type === 'business_profile' ? 'business' : 'post',
        entityId: item.id,
      });
    }
    setModerationLogsList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return transitionModerationLog(item, 'approved', 'Admin Guigui');
        }
        return item;
      })
    );
    persistModerationDecision(id, 'approve');
  };

  const handleRejectModerationLog = (id: string) => {
    const reason = prompt('Indique o motivo da rejeição a enviar ao autor:', 'Violação de regras de concorrência ou conteúdo inadequado');
    if (!reason) return;

    const item = moderationLogsList.find((entry) => entry.id === id);
    const business = item?.businessName ? businessesList.find((entry) => entry.name === item.businessName) : undefined;
    if (item && business) {
      onSystemEvent?.({
        eventType: item.type === 'business_profile' ? 'BUSINESS_REJECTED' : 'POST_REJECTED',
        businessId: business.id,
        businessName: business.name,
        entityType: item.type === 'business_profile' ? 'business' : 'post',
        entityId: item.id,
        message: reason,
      });
    }
    setModerationLogsList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return transitionModerationLog(item, 'rejected', 'Admin Guigui', reason);
        }
        return item;
      })
    );
    persistModerationDecision(id, 'reject', reason);
  };

  const handleSimulateAppeal = (id: string) => {
    const appealText = prompt('Introduza a mensagem de contestação/recurso do autor:', 'Possuo alvará comercial e pretendo esclarecer a oferta.');
    if (!appealText) return;

    setModerationLogsList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
          return {
            ...item,
            status: 'appealed',
            appealReason: appealText,
            auditTrail: [
              ...item.auditTrail,
              {
                timestamp: nowStr,
                action: 'appealed_by_user',
                actor: 'Autor do Conteúdo',
                notes: `Recurso submetido: "${appealText}"`,
              },
            ],
          };
        }
        return item;
      })
    );
    persistModerationDecision(id, 'appeal', appealText);
  };

  const moderationBusinessOptions: string[] = Array.from(new Set<string>(moderationLogsList.map((item) => item.businessName))).sort((a, b) => a.localeCompare(b));
  const filteredModerationItems = filterModerationLogs(moderationLogsList, {
    workflow: modFilter === 'pending' || modFilter === 'approved' || modFilter === 'rejected' || modFilter === 'amarelo' || modFilter === 'vermelho' ? modFilter : 'all',
    type: modTypeFilter,
    businessName: modBusinessFilter,
    searchQuery: modSearchQuery,
    dateFrom: modDateFrom,
    dateTo: modDateTo,
  });
  const moderationColumns: Array<{ id: 'pending' | 'approved' | 'rejected'; label: string; description: string; className: string }> = [
    { id: 'pending', label: t('moderationPending'), description: t('moderationPendingHelp'), className: 'border-amber-200 bg-amber-50/40' },
    { id: 'approved', label: t('moderationApproved'), description: t('moderationApproved'), className: 'border-emerald-200 bg-emerald-50/40' },
    { id: 'rejected', label: t('moderationRejected'), description: t('moderationRejected'), className: 'border-red-200 bg-red-50/40' },
  ];

  const flattenedNavigation = useMemo(
    () => adminNavigationGroups.flatMap((group) => group.items),
    [adminNavigationGroups]
  );

  const filteredNavigationGroups = useMemo(() => {
    const query = adminSearchQuery.trim().toLowerCase();
    if (!query) return adminNavigationGroups;

    return adminNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = `${item.label} ${item.help}`.toLowerCase();
          return haystack.includes(query);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [adminNavigationGroups, adminSearchQuery]);

  const quickSearchMatches = useMemo(
    () => filteredNavigationGroups.flatMap((group) => group.items).slice(0, 6),
    [filteredNavigationGroups]
  );

  const currentSectionTitle = flattenedNavigation.find((item) => item.tab === activeTab)?.label || 'Visão Geral';
  const themeLabel = currentThemeMode === 'dark' ? 'Escuro' : currentThemeMode === 'light' ? 'Claro' : 'Auto';
  const languageLabel = getLanguageShortLabel(currentLang);
  const nextThemeMode: 'light' | 'dark' | 'auto' = currentThemeMode === 'dark' ? 'light' : currentThemeMode === 'light' ? 'auto' : 'dark';
  const nextLanguage: Language = getNextLanguage(currentLang);

  useEffect(() => {
    try {
      window.localStorage.setItem('guigui-admin-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Ignore storage write issues in private or restricted environments.
    }
  }, [sidebarCollapsed]);
  useEffect(() => {
    onSidebarCollapsedChange?.(sidebarCollapsed);
  }, [onSidebarCollapsedChange, sidebarCollapsed]);

  return (
    <>
      <div className="guigui-profile-dashboard guigui-light-dashboard w-full min-h-[calc(100vh-72px)] bg-[#f3efe9]">
        <div className="flex min-h-[calc(100vh-72px)] w-full bg-[#f3efe9]">
          <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] md:hidden`} onClick={() => setMobileSidebarOpen(false)} />

          <aside
            style={{ width: sidebarCollapsed ? 72 : 260 }}
            data-navigation-groups={configuredAdminNavigation.length}
            className={`${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-[120px] z-50 h-[calc(100vh-120px)] max-w-[calc(100vw-16px)] shrink-0 border-r border-[#e5d9c6] bg-[linear-gradient(180deg,_#fbf7f3_0%,_#f4efe9_100%)] shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)] transition-[transform,box-shadow,width] duration-300 ease-out md:top-[120px] md:h-[calc(100vh-120px)] md:translate-x-0`}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-[#e5d9c6] bg-[#fffdfb]/95 px-1.5 py-2.5 backdrop-blur-sm">
                <div className={`flex items-center ${sidebarCollapsed ? 'w-full justify-center' : 'gap-1.5'} pl-0.5`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#102d2b] text-base font-black text-[#e8a23a] shadow-[0_10px_18px_-14px_rgba(16,45,43,0.9)]">
                    g
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">{t('adminPanel')}</div>
                      <div className="text-lg font-black text-slate-900">Guigui.com</div>
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
                {filteredNavigationGroups.map((group) => (
                  <div key={group.heading} className={`${sidebarCollapsed ? 'space-y-1.5' : 'space-y-2'}`}>
                    {!sidebarCollapsed && (
                      <div className="px-2 text-[8px] font-black uppercase tracking-[0.22em] text-[#52706b]">
                        {group.heading}
                      </div>
                    )}

                    <div className={`${sidebarCollapsed ? 'space-y-1.5' : 'space-y-1'}`}>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.tab;

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
                            className={`group relative flex w-full items-center rounded-2xl border text-left transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#d5b06e]/60 ${
                              sidebarCollapsed
                                ? 'justify-center border-transparent p-2.5'
                                : 'gap-2 border-[#e4ddd2] bg-white p-2.5 shadow-[0_8px_16px_-18px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:border-[#cbbda8] hover:bg-[#fffefa] hover:shadow-[0_16px_26px_-22px_rgba(15,23,42,0.3)]'
                            } ${
                              isActive
                                ? 'border-[#0b4a45] bg-[#0b4a45] text-[#f7f2eb] shadow-[0_18px_28px_-20px_rgba(11,74,69,0.8)]'
                                : 'text-slate-700'
                            }`}
                          >
                            <div className={`flex shrink-0 items-center justify-center rounded-xl ${sidebarCollapsed ? 'h-7 w-7' : 'h-7 w-7'} ${isActive ? 'bg-[#17635b] text-[#f4d497] ring-1 ring-[#e8a23a]/25' : 'bg-[#f7f5f1] text-[#5f706d] group-hover:bg-[#efe6d9]'}`}>
                              <Icon className={sidebarCollapsed ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
                            </div>

                            {!sidebarCollapsed && (
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-black leading-snug">{item.label}</div>
                                <div className={`mt-0.5 text-[7.8px] leading-relaxed ${isActive ? 'text-[#ebe0c8]/85' : 'text-slate-500'}`}>
                                  {item.help}
                                </div>
                              </div>
                            )}

                            {!sidebarCollapsed && (
                              <div className={`text-[6.5px] font-black uppercase tracking-[0.14em] ${isActive ? 'text-[#f0d59c]' : 'text-slate-400'}`}>
                                {t('openLabel')}
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
                {adminSearchQuery && filteredNavigationGroups.length === 0 && (
                  <div className="mt-3 rounded-2xl border border-dashed border-[#d8c7a5] bg-white/60 p-3 text-[11px] font-medium text-slate-500">
                    Nenhum módulo encontrado para “{adminSearchQuery}”.
                  </div>
                )}

              </div>
            </div>
          </aside>
          <main
            style={{ '--admin-sidebar-width': `${sidebarCollapsed ? 72 : 260}px` } as React.CSSProperties}
            className="min-w-0 flex-1 bg-[#f7f2ec] p-0 transition-[width,margin] duration-300 ease-out md:ml-[var(--admin-sidebar-width)]"
          >
            <div className="flex flex-col gap-3 border-b border-[#e6dac8] bg-[#f7f2ec] px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <IconButton
                    label={t('openSidebar')}
                    variant="secondary"
                    className="h-9 w-9 rounded-full md:hidden"
                    onClick={() => setMobileSidebarOpen(true)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </IconButton>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Guigui.com / {t('adminPanel')}</div>
                    <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{currentSectionTitle}</h1>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start lg:self-auto">
                  <div className="relative w-full min-w-0 md:w-auto md:min-w-[220px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={adminSearchQuery}
                      onChange={(event) => setAdminSearchQuery(event.target.value)}
                      placeholder={t('adminSearchPlaceholder')}
                      className="w-full rounded-full border border-[#dccfb7] bg-white px-8 py-2 text-[11px] font-medium text-slate-700 shadow-[0_8px_18px_-18px_rgba(15,23,42,0.22)] outline-none transition focus:border-[#123e3b] focus:ring-2 focus:ring-[#123e3b]/10"
                    />
                  </div>
                  <IconButton label={t('notifications')} variant="secondary" className="relative h-9 w-9 rounded-full" onClick={() => setActiveTab('notifications')}>
                    <Bell className="h-4 w-4" />
                    {supportRequests.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-black text-white">{supportRequests.length > 99 ? '99+' : supportRequests.length}</span>}
                  </IconButton>
                  <button type="button" onClick={() => setActiveTab('profile')} title={t('admin.profile')} aria-label={t('admin.profile')} className="flex items-center gap-2 rounded-full border border-[#e6dac8] bg-white px-2.5 py-1.5 shadow-sm transition hover:border-[#123e3b]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#123e3b] text-[10px] font-black text-[#f0d59c]">AD</div>
                    <div className="hidden text-left sm:block">
                      <div className="text-[10px] font-black text-slate-900">Admin Guigui</div>
                      <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">{t('activeSession')}</div>
                    </div>
                  </button>
                </div>
              </div>

              {adminSearchQuery && quickSearchMatches.length > 0 && (
                <div className="rounded-2xl border border-[#e6dac8] bg-white/75 p-3">
                  <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">{t('quickResults')}</div>
                  <div className="flex flex-wrap gap-2">
                    {quickSearchMatches.map((item) => (
                      <button
                        key={`search-${item.label}`}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.tab);
                          setAdminSearchQuery('');
                          setMobileSidebarOpen(false);
                        }}
                        className="rounded-full border border-[#d9d2c6] bg-[#f9f7f3] px-2.5 py-1 text-[10px] font-bold text-slate-700 transition hover:border-[#123e3b] hover:text-[#123e3b]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 uppercase tracking-[0.18em] text-slate-600">{t('breadcrumb')}</span>
                  <span>Guigui.com</span>
                  <span>/</span>
                  <span className="text-slate-800">Administração</span>
                  <span>/</span>
                  <span className="text-slate-900">{currentSectionTitle}</span>
                </div>
                <Badge variant="success" className="px-3 py-1.5 text-[9px] uppercase tracking-[0.16em] shadow-sm">
                  {(headerStats ? headerStats.revenueGross : totalMrrXOF).toLocaleString('pt-PT')} XOF • {(headerStats ? headerStats.activeCompanies : businessesList.filter((b) => b.status === 'active').length)} ativas
                </Badge>
              </div>
            </div>

      {/* TAB: Perfil do administrador (antes órfão — acessível via avatar) */}
      {activeTab === 'profile' && (
        <AdminProfilePanel
          currentLang={currentLang}
          currentThemeMode={currentThemeMode}
          onLanguageChange={onLanguageChange}
          onThemeModeChange={onThemeModeChange}
          onNavigateTab={navigateAdminTab}
        />
      )}

      {/* TAB 0: Complete Admin Capability Map */}
      {activeTab === 'capabilities' && (
        <AdminCapabilityHub
          currentLang={currentLang}
          onNavigateTab={navigateAdminTab}
          dataSummary={{
            businesses: businessesList.length,
            activeBusinesses: businessesList.filter((business) => business.status === 'active').length,
            events: events.length,
            moderationItems: moderationLogsList.length,
            paymentTransactions: paymentTransactionsList.length,
            auditLogs: logsList.length,
            supportRequests: supportRequests.length,
          }}
          dataPreview={{
            businesses: businessesList.slice(0, 5).map((business) => ({ label: business.name, status: business.status })),
            events: events.slice(0, 5).map((event) => ({ label: event.title, status: event.status })),
            auditLogs: logsList.slice(0, 5).map((log) => ({ label: log.actionLabel, status: log.severity })),
            moderation: moderationLogsList.slice(0, 5).map((item) => ({ label: item.contentSnippet, status: item.status })),
            payments: paymentTransactionsList.slice(0, 5).map((transaction) => ({ label: transaction.useCaseLabel, status: transaction.status })),
            support: supportRequests.slice(0, 5).map((request) => ({ label: request.subject, status: request.status })),
          }}
        />
      )}

      {/* TAB 1: Executive Overview */}
      {activeTab === 'overview' && (
        <AdminOverview
          currentLang={currentLang}
          businesses={businessesList}
          events={events}
          onNavigateTab={navigateAdminTab}
        />
      )}

      {/* TAB 1: Businesses */}
      {activeTab === 'businesses' && (
        <Card className="border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Empresas Registadas na Plataforma Guigui.com ({businessesList.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Aprovação direta, verificação de comerciante e exportação de base de dados
              </p>
            </div>
            
            {/* Export Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Exportar:</span>
              <Button type="button" size="sm" variant="secondary"
                onClick={() => {
                  const headers = ['ID', 'Nome', 'Categoria', 'Bairro', 'Plano', 'Estado', 'Telefone', 'Classificação'];
                  const rows = businessesList.map(b => [b.id, b.name, b.category, b.neighborhood, b.tier, b.status, b.phone, b.rating]);
                  downloadCSV('diretorio_empresas_guigui.csv', headers, rows);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition flex items-center gap-1.5"
                title="Exportar CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </Button>
              <Button type="button" size="sm" variant="secondary"
                onClick={() => {
                  const headers = ['ID', 'Nome', 'Categoria', 'Bairro', 'Plano', 'Estado', 'Telefone', 'Classificação'];
                  const rows = businessesList.map(b => [b.id, b.name, b.category, b.neighborhood, b.tier, b.status, b.phone, b.rating]);
                  downloadExcel('diretorio_empresas_guigui.xls', 'Empresas', headers, rows);
                }}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] transition flex items-center gap-1.5"
                title="Exportar Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </Button>
              <Button type="button" size="sm" variant="secondary"
                onClick={() => {
                  const headers = ['Nome', 'Categoria', 'Bairro', 'Plano', 'Estado', 'Telefone'];
                  const rows = businessesList.map(b => [b.name, b.category, b.neighborhood, b.tier.toUpperCase(), b.status.toUpperCase(), b.phone]);
                  downloadPDFReport(
                    'Relatório Oficial de Comércios - Guigui.com',
                    `Base de dados de empresas cadastradas no portal Guigui.com (Guiné-Bissau). Total de ${businessesList.length} empresas registadas.`,
                    [
                      { label: 'Total Registadas', value: `${businessesList.length}` },
                      { label: 'Empresas Ativas', value: `${businessesList.filter(b => b.status === 'active').length}` },
                      { label: 'Empresas Premium', value: `${businessesList.filter(b => b.tier === 'premium').length}` },
                    ],
                    headers,
                    rows
                  );
                }}
                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 font-bold rounded-lg text-[11px] transition flex items-center gap-1.5"
                title="Exportar PDF Oficial"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </Button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {businessesList.map((b) => (
              <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img src={b.logo} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200" />
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>{b.name}</span>
                      <Badge variant="info" className="px-2 py-0.5 text-[10px] uppercase">
                        {b.tier}
                      </Badge>
                      {b.status === 'active' ? (
                        <Badge variant="success" className="px-2 py-0.5 text-[10px]">
                          {t('workspace.admin.businessActive')}
                        </Badge>
                      ) : b.status === 'pending' ? (
                        <Badge variant="warning" className="px-2 py-0.5 text-[10px]">
                          {t('workspace.admin.businessPending')}
                        </Badge>
                      ) : (
                        <Badge variant="danger" className="px-2 py-0.5 text-[10px]">
                          {b.status === 'rejected' ? t('workspace.admin.businessRejected') : t('workspace.admin.businessSuspended')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      📍 {b.neighborhood} • WhatsApp: {b.whatsapp} • Quota: {b.postsQuotaRemaining} posts
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-black text-blue-800" title="Alterar o plano de acesso empresarial">
                    <span>Plano</span>
                    <select
                      value={b.tier}
                      onChange={(e) => handleChangeBusinessTier(b.id, e.target.value as SubscriptionTier)}
                      className="bg-transparent text-[10px] font-black text-blue-900 outline-none"
                    >
                      <option value="basic">Basic</option>
                      <option value="professional">Professional</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </label>
                  <Button type="button" size="sm"
                    onClick={() => b.status === 'pending' || b.status === 'rejected' ? void handlePendingBusinessDecision(b.id, 'approve') : handleToggleBusinessStatus(b.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 ${
                      b.status === 'active'
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {b.status === 'active' ? t('workspace.admin.suspendBusiness') : t('workspace.admin.approveBusiness')}
                  </Button>
                  {(b.status === 'pending' || b.status === 'rejected') && (
                    <Button type="button" size="sm" onClick={() => void handlePendingBusinessDecision(b.id, 'reject')} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100">
                      {t('workspace.admin.rejectBusiness')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <FeaturedBusinessesAdmin businesses={businessesList} onUpdateBusinesses={handleUpdateBusinesses} />
        </Card>
      )}

      {/* TAB 2: AI & Human Content Moderation Pipeline (Section 9) */}
      {activeTab === 'moderation' && (
        <div className="space-y-6 text-xs">
          {/* Section 9 Summary & Classification Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
              <div>
                <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                  Secção 9 - Moderação de Conteúdo (IA + Revisão Humana)
                </span>
                <h3 className="font-extrabold text-base sm:text-lg text-white mt-1 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>Pipeline Automático de Segurança & Auditoria Humana</span>
                </h3>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-bold text-slate-200">
                  {moderationLogsList.filter((m) => m.status === 'pending_human').length} Itens em Fila de Revisão
                </span>
              </div>
            </div>

            {/* 9.1 Risk Classification Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
              <div className="bg-emerald-950/60 border border-emerald-800/80 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-300 text-xs uppercase">Verde — Aprovado</span>
                  <span className="bg-emerald-800/60 text-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">~85–90%</span>
                </div>
                <p className="text-[11px] text-emerald-200 leading-snug">
                  Publicação imediata e automática. Conteúdo legítimo em conformidade com as diretrizes.
                </p>
              </div>

              <div className="bg-amber-950/60 border border-amber-800/80 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-300 text-xs uppercase">Amarelo — Revisão Humana</span>
                  <span className="bg-amber-800/60 text-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">~8–12%</span>
                </div>
                <p className="text-[11px] text-amber-200 leading-snug">
                  Fica em fila de moderação humana; publicação suspensa até decisão. Aplica-se ao idioma não configurado (Sec. 9.3).
                </p>
              </div>

              <div className="bg-red-950/60 border border-red-800/80 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-red-300 text-xs uppercase">Vermelho — Rejeitado</span>
                  <span className="bg-red-800/60 text-red-200 px-2 py-0.5 rounded text-[10px] font-bold">~2–3%</span>
                </div>
                <p className="text-[11px] text-red-200 leading-snug">
                  Bloqueado automaticamente; notifica autor com o motivo; autor pode submeter recurso/contestação.
                </p>
              </div>
            </div>
          </div>

          {/* Section 9.3 Sensitivity & Policy Settings Controls */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Configuração de Sensibilidade & Regras Especiais (Secção 9.3)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 italic">
                Ajuste direto de parâmetros sem necessidade de alteração de código.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* idioma não configurado Caution Rule Toggle */}
              <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-blue-950 text-xs flex items-center gap-1.5">
                    <span>Precaução idioma não configurado</span>
                    <span className="bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded text-[9px]">Sec. 9.3</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={modSettings.languageCautionEnabled}
                    onChange={(e) =>
                      setModSettings((prev) => ({ ...prev, languageCautionEnabled: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Quando ativo, qualquer texto em <strong>idioma não configurado</strong> é classificado por defeito como no mínimo <strong>"Amarelo"</strong> para validação por revisor humano.
                </p>
              </div>

              {/* Sensitivity Level Selector */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2">
                <label className="font-extrabold text-slate-800 text-xs block">
                  Nível de Sensibilidade da IA
                </label>
                <select
                  value={modSettings.sensitivityLevel}
                  onChange={(e) =>
                    setModSettings((prev) => ({
                      ...prev,
                      sensitivityLevel: e.target.value as 'strict' | 'standard' | 'relaxed',
                    }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs"
                >
                  <option value="strict">Rigorosa (Máxima proteção anti-spam)</option>
                  <option value="standard">Padrão (Recomendado)</option>
                  <option value="relaxed">Relaxada (Apenas bloqueia ofensas graves)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  Controla o rigor na deteção de termos ambíguos e imitação de marcas.
                </p>
              </div>

              {/* Threshold Sliders */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>Limiar Aprovação Verde</span>
                  <span className="text-emerald-700 font-mono">{modSettings.autoApproveGreenThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="98"
                  value={modSettings.autoApproveGreenThreshold}
                  onChange={(e) =>
                    setModSettings((prev) => ({ ...prev, autoApproveGreenThreshold: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">
                  Confiança mínima exigida para publicação direta sem revisão.
                </span>
              </div>
            </div>
          </div>

          {/* Pipeline Filters */}
          <Card className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-900">Filtros do pipeline</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-500">{filteredModerationItems.length} de {moderationLogsList.length} itens visíveis</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-bold">
              {[
                { id: 'pending' as const, label: 'Em revisão', count: moderationLogsList.filter((m) => getModerationWorkflowColumn(m.status) === 'pending').length },
                { id: 'approved' as const, label: 'Aprovados', count: moderationLogsList.filter((m) => getModerationWorkflowColumn(m.status) === 'approved').length },
                { id: 'rejected' as const, label: 'Rejeitados / Recursos', count: moderationLogsList.filter((m) => getModerationWorkflowColumn(m.status) === 'rejected').length },
                { id: 'amarelo' as const, label: 'Classificação Amarela', count: moderationLogsList.filter((m) => m.result.status === 'amarelo').length },
                { id: 'vermelho' as const, label: 'Classificação Vermelha', count: moderationLogsList.filter((m) => m.result.status === 'vermelho').length },
              ].map((filter) => (
                <Button type="button" key={filter.id} size="sm" variant={modFilter === filter.id ? 'primary' : 'secondary'} onClick={() => setModFilter(filter.id)} className="px-3 py-1.5 rounded-xl text-xs">
                  {filter.label} ({filter.count})
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 lg:col-span-2">
                Pesquisar conteúdo, autor ou empresa
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input value={modSearchQuery} onChange={(event) => setModSearchQuery(event.target.value)} placeholder="Ex.: promoção, Mamadu, Coqueiros" className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none" />
                </div>
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Tipo
                <select value={modTypeFilter} onChange={(event) => setModTypeFilter(event.target.value as typeof modTypeFilter)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-900">
                  <option value="pending">Em revisão</option>
                  <option value="promotion">Promoções</option>
                  <option value="event">Eventos</option>
                  <option value="business_profile">Perfis empresariais</option>
                </select>
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Empresa
                <select value={modBusinessFilter} onChange={(event) => setModBusinessFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-900">
                  <option value="">Selecione uma empresa</option>
                  {moderationBusinessOptions.map((businessName) => <option value={businessName} key={businessName}>{businessName}</option>)}
                </select>
              </label>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setModFilter('all'); setModTypeFilter('all'); setModBusinessFilter('all'); setModSearchQuery(''); setModDateFrom(''); setModDateTo(''); }} className="self-end rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">
                Limpar filtros
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Data inicial<input type="date" value={modDateFrom} onChange={(event) => setModDateFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-900" /></label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Data final<input type="date" value={modDateTo} onChange={(event) => setModDateTo(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-900" /></label>
            </div>
          </Card>

          {/* Moderation Workflow Board */}
          {filteredModerationItems.length === 0 ? (
            <EmptyState
              title="Nenhum item corresponde aos filtros seleccionados."
              description="Altere o estado, a empresa, o tipo, o período ou a pesquisa."
              icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              {moderationColumns.map((column) => {
                const columnItems = filteredModerationItems.filter((item) => getModerationWorkflowColumn(item.status) === column.id);
                return (
                  <section key={column.id} className={`rounded-3xl border p-3 ${column.className}`}>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-3 mb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{column.label}</h4>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-600">{column.description}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-800 shadow-sm">{columnItems.length}</span>
                    </div>
                    <div className="space-y-4">
                      {columnItems.length === 0 ? (
                        <EmptyState title="Nenhum conteúdo nesta coluna." />
                      ) : columnItems.map((item) => {
                const isAuditOpen = selectedAuditLogId === item.id;

                return (
                  <Card
                    key={item.id}
                    className={`bg-white rounded-3xl p-5 border text-xs space-y-4 shadow-sm transition ${
                      item.status === 'pending_human'
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : item.status === 'rejected' || item.status === 'appealed'
                        ? 'border-red-300'
                        : 'border-emerald-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{item.businessName}</span>
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase">
                          {item.type}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">por {item.authorName} ({item.authorPhone})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="neutral"
                          className={`px-3 py-1 text-[10px] uppercase tracking-wider ${
                            item.status === 'approved'
                              ? 'bg-emerald-600 text-white'
                              : item.status === 'rejected' || item.status === 'appealed'
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          Decisão {item.status === 'approved' ? 'APROVADA' : item.status === 'rejected' ? 'REJEITADA' : item.status === 'appealed' ? 'EM RECURSO' : 'PENDENTE'} · IA {item.result?.status?.toUpperCase() ?? 'SEM ANÁLISE'} ({item.result?.confidence ?? 0}%)
                        </Badge>

                        {item.status === 'appealed' && (
                          <Badge variant="info" className="bg-purple-600 text-white px-2.5 py-1 text-[10px] uppercase tracking-wider animate-pulse">
                            Recurso Submetido pelo Autor
                          </Badge>
                        )}

                        <span className="text-[10px] text-slate-400 font-mono">{item.createdAt}</span>
                      </div>
                    </div>

                    {/* Detected Categories Tags */}
                    {item.result.detectedCategories && item.result.detectedCategories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Categorias IA:</span>
                        {item.result.detectedCategories.map((cat, idx) => (
                          <Badge
                            variant={cat.includes('idioma não configurado') ? 'info' : 'neutral'}
                            key={idx}
                            className={`px-2 py-0.5 text-[10px] font-bold ${
                              cat.includes('idioma não configurado')
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Content Snippet and Image */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="w-24 h-24 rounded-2xl object-cover border border-slate-200 flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 space-y-2">
                        <p className="text-slate-900 font-medium leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200">
                          "{item.contentSnippet}"
                        </p>

                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-900 text-[11px]">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-extrabold">Motivo da Análise de IA:</strong> {item.result.reason}
                          </div>
                        </div>

                        {item.appealReason && (
                          <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 p-2.5 rounded-xl text-purple-900 text-[11px]">
                            <MessageSquare className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-extrabold">Contestação do Autor:</strong> "{item.appealReason}"
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions and Audit Trail Collapsible */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => setSelectedAuditLogId(isAuditOpen ? null : item.id)}
                        className="text-[11px] font-extrabold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>{isAuditOpen ? 'Ocultar Auditoria' : `Ver Trilho de Auditoria (${item.auditTrail.length})`}</span>
                      </Button>

                      <div className="flex items-center gap-2">
                        {item.status !== 'approved' && (
                          <Button type="button" variant="primary" size="sm"
                            onClick={() => handleApproveModerationLog(item.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center gap-1.5 shadow-sm"
                          >
                            <Check className="w-4 h-4" />
                            <span>Aprovar para Exibição Pública</span>
                          </Button>
                        )}

                        {item.status !== 'rejected' && (
                          <Button type="button" variant="danger" size="sm"
                            onClick={() => handleRejectModerationLog(item.id)}
                            className="px-3.5 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 font-extrabold text-xs transition flex items-center gap-1.5"
                          >
                            <X className="w-4 h-4" />
                            <span>Rejeitar Conteúdo</span>
                          </Button>
                        )}

                        {item.status === 'rejected' && (
                          <Button type="button" variant="secondary" size="sm"
                            onClick={() => handleSimulateAppeal(item.id)}
                            className="px-3 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-[11px] transition flex items-center gap-1"
                            title="Simular submissão de recurso pelo autor"
                          >
                            <span>Simular Recurso do Autor</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Audit Trail Drawer */}
                    {isAuditOpen && (
                      <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl space-y-2 mt-2 border border-slate-800 animate-in fade-in">
                        <div className="font-extrabold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                          <History className="w-4 h-4 text-blue-400" />
                          <span>Histórico de Decisões & Auditoria de Conformidade</span>
                        </div>
                        <div className="space-y-2 pt-1 font-mono text-[11px]">
                          {item.auditTrail.map((log, lIdx) => (
                            <div key={lIdx} className="flex items-start gap-2 border-b border-slate-800/60 pb-1.5 last:border-0">
                              <span className="text-slate-400 text-[10px] min-w-[110px]">{log.timestamp}</span>
                              <span className="bg-slate-800 text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                {log.actor}
                              </span>
                              <span className="text-slate-300 flex-1">{log.notes}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Pricing Matrix & Business Model (Section 4) */}
      {activeTab === 'pricing' && (
        <div className="space-y-6 text-xs">
          {/* Banner: Rule of 3 Posts/month Across All Tiers */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-3xl border border-blue-800 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                Regra Transversal 4.1
              </span>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Catálogo de Planos & Preços Dinâmicos por Categoria
              </h3>
            </div>
            <p className="text-slate-200 leading-relaxed text-[11px]">
              Os valores iniciais do catálogo incluem <strong>3 posts/mês</strong> nos quatro planos base, mas o Super Admin pode alterar este e qualquer outro limite por plano.
              Posts adicionais além da quota configurada são pagos à parte por compra avulsa (<strong>{config.extraPostPriceXOF.toLocaleString('pt-PT')} XOF/post</strong>).
            </p>
          </div>

          <SubscriptionPlansAdmin currentLang={currentLang} businesses={businessesList} />
          <MonetizationAdmin
            currentLang={currentLang}
            businesses={businessesList}
            paymentTransactions={paymentTransactionsList}
            onLegacyConfigChange={(patch) => setConfig((previous) => ({ ...previous, ...patch }))}
          />

          {/* Matrix Configuration Card */}
          <Card className="border-slate-200 bg-white p-6 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Table className="w-4 h-4 text-blue-600" />
                  Matriz Configurável de Preços (Grupo de Categoria × Escalão de Subscrição)
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Preços definidos e ajustados no Guigui.com em XOF. Alterações aplicam-se a novas adesões e renovações.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-bold bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <Percent className="w-3.5 h-3.5 text-emerald-600" />
                <label htmlFor="annual-discount" className="text-slate-700">Desconto anual antecipado</label>
                <input id="annual-discount" type="number" min="0" max="100" step="1" value={config.annualDiscountPercent} onChange={(event) => updateFinancialConfig('annualDiscountPercent', Number(event.target.value))} className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-black text-slate-900" aria-label="Desconto de pagamento anual antecipado em percentagem" />
                <span className="text-slate-700">%</span>
                <Button type="button" variant="primary" size="sm" onClick={handleSaveFinancialConfig} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700">Guardar parâmetros</Button>
              </div>
              {configNotice && <p className="mt-2 text-right text-[11px] font-bold text-emerald-700" role="status">{configNotice}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
                <div>
                  <p className="font-black">Suspensão automática após expiração</p>
                  <p className="mt-0.5 leading-relaxed">Quando activa, a empresa passa para modo suspenso no fim do período pago. Quando desligada, fica em modo de consulta até intervenção manual.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 font-black shadow-sm">
                  <input
                    type="checkbox"
                    checked={config.automaticSubscriptionSuspensionEnabled !== false}
                    onChange={(event) => setConfig((previous) => ({ ...previous, automaticSubscriptionSuspensionEnabled: event.target.checked }))}
                    aria-label="Activar suspensão automática após expiração do plano"
                    className="h-4 w-4 accent-amber-600"
                  />
                  {config.automaticSubscriptionSuspensionEnabled !== false ? 'Activa' : 'Desligada'}
                </label>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10px]">
                    <th className="p-3.5 w-1/3">Grupo de Categoria (Atividade)</th>
                    <th className="p-3.5 text-center">Básico</th>
                    <th className="p-3.5 text-center">Profissional</th>
                    <th className="p-3.5 text-center">Premium</th>
                    <th className="p-3.5 text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {categoryGroups.map((group) => (
                    <tr key={group.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-xs">{group.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{group.description}</div>
                      </td>

                      {(['basic', 'professional', 'premium', 'enterprise'] as SubscriptionTier[]).map((tier) => {
                        const isEditing =
                          editingCell?.groupId === group.id && editingCell?.tier === tier;
                        const currentPrice = group.prices[tier];
                        const annualDiscountedPrice = Math.round(currentPrice * 12 * (1 - config.annualDiscountPercent / 100));

                        return (
                          <td key={tier} className="p-3 text-center align-top">
                            {isEditing ? (
                              <div className="p-2 bg-blue-50 border border-blue-300 rounded-xl space-y-1.5 text-[10px]">
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
                                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-900"
                                />
                                <div className="flex gap-1 justify-center">
                                  <button type="button"
                                    onClick={() => handleSaveCellPrice(group.id, tier, editingCell.price)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2 py-1 rounded flex items-center gap-1"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Guardar</span>
                                  </button>
                                  <button type="button"
                                    onClick={() => setEditingCell(null)}
                                    className="bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded"
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
                                className="group/cell p-2 rounded-xl hover:bg-blue-50/80 cursor-pointer transition border border-transparent hover:border-blue-200"
                              >
                                <div className="font-black text-slate-900 font-mono text-xs flex items-center justify-center gap-1">
                                  <span>{currentPrice.toLocaleString('pt-PT')} XOF</span>
                                  <Edit2 className="w-3 h-3 text-slate-400 group-hover/cell:text-blue-600 opacity-0 group-hover/cell:opacity-100 transition" />
                                </div>
                                <div className="text-[9px] text-slate-400 mt-0.5">/mês</div>
                                <div className="text-[9px] text-emerald-700 font-medium mt-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
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
          </Card>

          {/* Additional Revenue Parameters & Fees */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                Fontes de Receita Adicionais (Venda Avulsa & Banners)
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Post Extra Avulso (Acima dos 3 incluídos)</div>
                    <div className="text-[10px] text-slate-500">Comprado por comerciantes quando esgotam os 3 posts</div>
                  </div>
                  <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                    <input type="number" min="0" step="500" value={config.extraPostPriceXOF} onChange={(event) => updateFinancialConfig('extraPostPriceXOF', Number(event.target.value))} className="w-24 bg-transparent text-right font-black font-mono text-blue-700 outline-none" aria-label="Preço do post extra avulso" />
                    <span className="font-black font-mono text-blue-700">XOF</span>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Promoção Extra Avulsa</div>
                    <div className="text-[10px] text-slate-500">Destaque promocional com selo customizado</div>
                  </div>
                  <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                    <input type="number" min="0" step="500" value={config.extraPromotionPriceXOF} onChange={(event) => updateFinancialConfig('extraPromotionPriceXOF', Number(event.target.value))} className="w-24 bg-transparent text-right font-black font-mono text-amber-700 outline-none" aria-label="Preço da promoção extra avulsa" />
                    <span className="font-black font-mono text-amber-700">XOF</span>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Banner Rotativo de Publicidade Premium</div>
                    <div className="text-[10px] text-slate-500">Exibição de destaque no topo da homepage</div>
                  </div>
                  <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                    <input type="number" min="0" step="1000" value={config.bannerWeeklyPriceXOF} onChange={(event) => updateFinancialConfig('bannerWeeklyPriceXOF', Number(event.target.value))} className="w-24 bg-transparent text-right font-black font-mono text-slate-900 outline-none" aria-label="Preço do banner premium por semana" />
                    <span className="font-black font-mono text-slate-900">XOF / semana</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-600" />
                Taxas da Bilheteira de Eventos Culturais
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Comissão Percentual sobre Bilhete</div>
                    <div className="text-[10px] text-slate-500">Retida automaticamente nas vendas via SMS</div>
                  </div>
                  <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                    <input type="number" min="0" max="100" step="0.5" value={config.ticketCommissionPercent} onChange={(event) => updateFinancialConfig('ticketCommissionPercent', Number(event.target.value))} className="w-16 bg-transparent text-right font-black font-mono text-emerald-700 outline-none" aria-label="Comissão percentual sobre bilhete" />
                    <span className="font-black font-mono text-emerald-700">%</span>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Taxa Fixa por Emissão de Bilhete SMS</div>
                    <div className="text-[10px] text-slate-500">Custo de processamento de gateway e envio SMS</div>
                  </div>
                  <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                    <input type="number" min="0" step="50" value={config.ticketFixedFeeXOF} onChange={(event) => updateFinancialConfig('ticketFixedFeeXOF', Number(event.target.value))} className="w-24 bg-transparent text-right font-black font-mono text-emerald-700 outline-none" aria-label="Taxa fixa por emissão de bilhete" />
                    <span className="font-black font-mono text-emerald-700">XOF / bilhete</span>
                  </label>
                </div>

                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                  💡 <strong>Exemplo:</strong> Num bilhete de 2.500 XOF, a receita da plataforma é {Math.round(2500 * (config.ticketCommissionPercent / 100)) + config.ticketFixedFeeXOF} XOF ({Math.round(2500 * (config.ticketCommissionPercent / 100))} XOF de comissão + {config.ticketFixedFeeXOF} XOF de taxa fixa).
                </div>
              </div>
            </div>
          </div>

          {/* Audit Log / Price Change History (4.2.c) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              Histórico & Auditoria de Alterações de Preço (4.2)
            </h3>

            <div className="divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900">{log.categoryGroup}</span>
                    <span className="text-[10px] text-blue-700 font-extrabold uppercase bg-blue-50 ml-2 px-2 py-0.5 rounded">
                      Escalão {log.tier}
                    </span>
                    <div className="text-[10px] text-slate-500">Alterado por: {log.updatedBy} • {log.date}</div>
                  </div>

                  <div className="font-mono text-xs flex items-center gap-2">
                    <span className="line-through text-slate-400">{log.oldPrice.toLocaleString('pt-PT')} XOF</span>
                    <span className="text-slate-400">➔</span>
                    <span className="font-extrabold text-emerald-700">{log.newPrice.toLocaleString('pt-PT')} XOF</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Categories Structure Management (Section 5) */}
      {activeTab === 'categories' && (
        <div className="space-y-6 text-xs">
          {/* Header & Rules Banner */}
          <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white p-6 rounded-3xl border border-purple-800 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-purple-400 text-purple-950 px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                    Secção 5 - Guigui.com
                  </span>
                  <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-purple-300" />
                    <span>Gestão da Estrutura de Categorias (2 Níveis: Principal & Subcategoria)</span>
                  </h3>
                </div>
                <p className="text-purple-200 text-[11px] max-w-3xl leading-relaxed">
                  Estrutura gerível em dois níveis. O limite de categorias por empresa é determinado pelo escalão de subscrição.
                </p>
              </div>

              <button type="button"
                onClick={() => setShowAddCategoryModal(true)}
                className="bg-purple-500 hover:bg-purple-600 text-white font-extrabold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Categoria Principal</span>
              </button>
            </div>

            {/* Tier Category Limit Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] border-t border-purple-800/60">
              <div className="bg-purple-900/50 p-2.5 rounded-xl border border-purple-700/50 flex items-center gap-2">
                <span className="font-black text-amber-300 bg-purple-950 px-2 py-0.5 rounded">Básico</span>
                <span>Máx. <strong>1 Categoria</strong> associada</span>
              </div>
              <div className="bg-purple-900/50 p-2.5 rounded-xl border border-purple-700/50 flex items-center gap-2">
                <span className="font-black text-blue-300 bg-purple-950 px-2 py-0.5 rounded">Profissional</span>
                <span>Máx. <strong>2 Categorias</strong> associadas</span>
              </div>
              <div className="bg-purple-900/50 p-2.5 rounded-xl border border-purple-700/50 flex items-center gap-2">
                <span className="font-black text-emerald-300 bg-purple-950 px-2 py-0.5 rounded">Premium / Enterprise</span>
                <span>Máx. <strong>3 Categorias</strong> associadas</span>
              </div>
            </div>
          </div>

          {/* Cultural Events Special Differentiated Handling Banner (#14) */}
          <div className="bg-amber-50 border border-amber-300 rounded-3xl p-5 space-y-2 shadow-sm text-amber-950">
            <div className="flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider text-amber-900">
              <Ticket className="w-4 h-4 text-amber-600" />
              <span>Diferenciação Técnica - Categoria 14: Eventos Culturais & Bilhética</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900">
              A categoria <strong>"Eventos Culturais"</strong> possui tratamento técnico diferenciado em relação às outras 15 categorias de negócio: cada evento é um <strong>registo temporário</strong> associado a datas de realização (início e fim) e bilheteira digital, e não uma ficha permanente de empresa. Ao expirar a data do evento, o registo passa automaticamente para o arquivo histórico da agenda cultural.
            </p>
          </div>

          {/* Categories Grid (16 Primary Categories) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoriesList.map((cat, index) => {
              const isCulturalEventCat = cat.id === 'cat-14';
              const isAddingSub = selectedCatForSub === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`bg-white border rounded-3xl p-5 space-y-4 shadow-sm flex flex-col justify-between transition hover:border-purple-300 ${
                    isCulturalEventCat ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b pb-3 border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-700 font-black text-xs flex items-center justify-center border border-purple-200">
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{cat.name}</span>
                            {isCulturalEventCat && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
                                Temporário
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-slate-500 capitalize">Grupo: {(cat.groupId || '').replace(/_/g, ' ')}</span>
                        </div>
                      </div>

                      <button type="button"
                        onClick={() => handleArchiveCategory(cat.id)}
                        title="Arquivar categoria"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition hover:bg-red-50"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Subcategories Chip List */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Subcategorias ({cat.subcategories.length})</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cat.subcategories.map((sub) => (
                          <span
                            key={sub}
                            className="bg-slate-100 text-slate-800 text-[10px] font-semibold px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1 group/sub"
                          >
                            <span>{sub}</span>
                            <button type="button"
                              onClick={() => handleRemoveSubcategory(cat.id, sub)}
                              className="text-slate-400 hover:text-red-600 font-bold text-[9px] opacity-0 group-hover/sub:opacity-100 transition"
                              title="Remover subcategoria"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Add Subcategory Form */}
                  <div className="pt-3 border-t border-slate-100">
                    {isAddingSub ? (
                      <div className="space-y-2 bg-purple-50 p-2.5 rounded-2xl border border-purple-200">
                        <input
                          type="text"
                          placeholder="Nome da subcategoria..."
                          value={newSubcatName}
                          onChange={(e) => setNewSubcatName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                        />
                        <div className="flex gap-2 justify-end">
                          <button type="button"
                            onClick={() => handleAddSubcategory(cat.id)}
                            className="bg-purple-600 text-white font-bold px-2.5 py-1 rounded-lg text-[10px]"
                          >
                            Adicionar
                          </button>
                          <button type="button"
                            onClick={() => setSelectedCatForSub(null)}
                            className="bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-lg text-[10px]"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button"
                        onClick={() => setSelectedCatForSub(cat.id)}
                        className="w-full py-1.5 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-bold rounded-xl border border-slate-200 transition text-[11px] flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Subcategoria</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal: New Primary Category */}
          {showAddCategoryModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overscroll-contain">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overscroll-contain">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-purple-600" />
                    <span>Nova Categoria Principal</span>
                  </h3>
                  <button type="button"
                    onClick={() => setShowAddCategoryModal(false)}
                    className="guigui-close-button"
                    aria-label="Fechar nova categoria"
                    title="Fechar"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <form onSubmit={handleAddCategorySubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nome da Categoria Principal</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Serviços de Energia & Solar"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Grupo de Preço (Atividade)</label>
                    <select
                      value={newCatGroupId}
                      onChange={(e) => setNewCatGroupId(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium"
                    >
                      <option value="restauracao">Restauração, Cafés e Pequeno Comércio</option>
                      <option value="hotelaria_saude_educacao">Hotelaria, Clínicas, Escolas e Comércio Médio</option>
                      <option value="corporativo_financeiro">Bancos, Seguradoras, Telecoms e Construção</option>
                      <option value="ongs_artesãos">ONGs, Associações e Artesãos Local</option>
                      <option value="servicos_profissionais">Serviços Profissionais e Consultoria</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Subcategorias Iniciais (separadas por vírgula)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Painéis Solares, Geradores, Baterias, Manutenção"
                      value={newCatSubcategories}
                      onChange={(e) => setNewCatSubcategories(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl transition shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <span>Criar Categoria</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Users Directory (real accounts from PostgreSQL) */}
      {activeTab === 'users' && (
        <AdminUsersHub />
      )}

      {/* TAB 3: Roles & Permissions Matrix */}
      {activeTab === 'roles' && (
        <>
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm text-xs">
            <AdminPermissionsMatrix
              currentLang={currentLang}
              staffList={staffList}
              onUpdateStaff={handleUpdateStaff}
              onLogAuditAction={(entry) => {
                const newLogs = [
                  {
                    id: `LOG-${Date.now()}`,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    actorId: 'usr-3',
                    actorName: 'Administrador Guigui System',
                    actorRole: 'super_admin',
                    ipAddress: '127.0.0.1',
                    deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Guigui Admin Console',
                    ...entry,
                  } as AuditLogEntry,
                  ...logsList,
                ];
                handleUpdateLogs(newLogs);
              }}
            />
          </div>
          <div className="hidden">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Matriz Explicativa de Perfis e Permissões de Utilizador
            </h3>
            <p className="text-slate-500 mt-1">
              Diferenciação técnica e funcional entre Cidadão Visitante, Perfil Comerciante e Administrador Guigui.com.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Usuario Simples */}
            <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1877F2] font-black flex items-center justify-center text-sm">
                  👤
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Usuário Simples (Cidadão)</h4>
                  <span className="text-[10px] text-blue-700 font-bold">Perfil Padrão de Leitura & Consumo</span>
                </div>
              </div>

              <ul className="space-y-2 text-slate-700 text-[11px] pt-2 border-t border-blue-200/60">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Navegar no Feed Social Guigui</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Reagir a posts (Gostar, Amei, etc) e comentar</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Procurar empresas no Marketplace e filtrar por Zona</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Contactar empresas via WhatsApp ou Telefone</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Comprar Bilhetes de Eventos via SMS com Orange Money ou Telecel</span>
                </li>
                <li className="flex items-center gap-1.5 text-slate-400">
                  <XCircle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  <span className="line-through">Sem acesso a painéis de gestão ou moderação</span>
                </li>
              </ul>
            </div>

            {/* Card 2: Perfil Empresa */}
            <div className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                  🏬
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Perfil Empresa (Comerciante)</h4>
                  <span className="text-[10px] text-emerald-800 font-bold">Gestão Comercial e Publicações</span>
                </div>
              </div>

              <ul className="space-y-2 text-slate-700 text-[11px] pt-2 border-t border-emerald-200/60">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Acesso ao Painel do Comerciante</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Publicar novidades com validação prévia da IA Gemini</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Criar Ofertas Promocionais e Cupões</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Acompanhar estatísticas (Cliques WhatsApp, Chamadas)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Gerir Quotas de Publicação e Faturação CFA</span>
                </li>
                <li className="flex items-center gap-1.5 text-slate-400">
                  <XCircle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  <span className="line-through">Sem acesso a aprovação global de terceiros</span>
                </li>
              </ul>
            </div>

            {/* Card 3: Super Admin */}
            <div className="bg-slate-900 text-white border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm">
                  🛡️
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm">Super Admin</h4>
                  <span className="text-[10px] text-amber-400 font-bold">Controlo Total da Plataforma</span>
                </div>
              </div>

              <ul className="space-y-2 text-slate-300 text-[11px] pt-2 border-t border-slate-800">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Aprovar ou suspender empresas cadastradas</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Moderação manual e audição da Fila IA Gemini</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Relatórios Financeiros Globais (MRR, Comissão de 10%)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Gestão do Scanner de Porta de Eventos</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Gestão de perfis e permissões dos utilizadores</span>
                </li>
              </ul>
            </div>
          </div>
          </div>
        </>
      )}

      {/* TAB: Admin Staff Management (Gestão de Administradores) */}
      {activeTab === 'admin_staff' && (
        <AdminStaffManagement
          currentLang={currentLang}
          staffList={staffList}
          onAddStaff={handleAddStaff}
          onUpdateStaff={handleUpdateStaffEntry}
          onRevokeAccess={handleRevokeStaffAccess}
          onLogAuditAction={(entry) => {
            const newLogs = [
              {
                id: `LOG-${Date.now()}`,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                ...entry,
              } as AuditLogEntry,
              ...logsList,
            ];
            handleUpdateLogs(newLogs);
          }}
        />
      )}

      {/* TAB: Audit Logs Hub (Logs de Auditoria) */}
      {activeTab === 'audit_logs' && (
          <AdminAuditLogsHub
            currentLang={currentLang}
            logs={logsList}
            onRefreshLogs={() => {
              void (async () => {
                try {
                  const response = await fetch('/api/admin/audit-logs?limit=500', { credentials: 'include' });
                  if (!response.ok) return;
                  const data = await response.json() as { logs?: AuditLogEntry[] };
                  if (Array.isArray(data.logs) && data.logs.length > 0) setLogsList(data.logs);
                } catch {
                  // manter a lista actual quando a base de dados estiver indisponível
                }
              })();
            }}
          />
      )}

      {/* TAB 4: Events & Ticket Sales */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Eventos totais', value: adminEventsKpis.total.toLocaleString('pt-PT'), icon: Calendar, tone: 'text-blue-600 bg-blue-50' },
              { label: 'Eventos activos', value: adminEventsKpis.active.toLocaleString('pt-PT'), icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
              { label: 'Bilhetes vendidos', value: adminEventsKpis.ticketsSold.toLocaleString('pt-PT'), icon: Ticket, tone: 'text-purple-600 bg-purple-50' },
              { label: 'Receita de eventos', value: `${adminEventsKpis.revenueXOF.toLocaleString('pt-PT')} XOF`, icon: DollarSign, tone: 'text-amber-600 bg-amber-50' },
            ].map(({ label, value, icon: KpiIcon, tone }) => (
              <div key={label} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-extrabold">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${tone}`}>
                    <KpiIcon className="w-4 h-4" />
                  </span>
                  {label}
                </div>
                <div className="font-mono text-xl font-black text-slate-900 mt-2">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Eventos e Agenda da Plataforma ({filteredAdminEvents.length})
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={eventsQuery}
                  onChange={(e) => setEventsQuery(e.target.value)}
                  placeholder="Procurar evento, organizador, local..."
                  className="w-full rounded-full border border-slate-300 bg-slate-50 pl-8 pr-3 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                { id: 'all', label: 'Todos' },
                { id: 'active', label: 'Activos' },
                { id: 'draft', label: 'Pendentes' },
                { id: 'cancelled', label: 'Cancelados' },
                { id: 'ended', label: 'Encerrados' },
              ] as const).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setEventsStatusFilter(chip.id)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black transition ${eventsStatusFilter === chip.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {filteredAdminEvents.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-6 w-6" />}
                title="Nenhum evento encontrado"
                description={events.length === 0 ? 'A plataforma ainda não tem eventos registados.' : 'Ajuste a pesquisa ou o filtro de estado para ver resultados.'}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {filteredAdminEvents.map((ev) => {
                  const capacity = ev.ticketTypes.reduce((acc, tt) => acc + tt.availableQuantity + tt.soldQuantity, 0);
                  const occupancy = capacity > 0 ? Math.min(100, Math.round((ev.totalTicketsSold / capacity) * 100)) : 0;
                  const statusStyle: Record<EventItem['status'], { label: string; badge: string }> = {
                    active: { label: 'Activo', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                    draft: { label: 'Pendente', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
                    cancelled: { label: 'Cancelado', badge: 'bg-red-100 text-red-800 border-red-200' },
                    ended: { label: 'Encerrado', badge: 'bg-slate-200 text-slate-600 border-slate-300' },
                  };
                  const status = statusStyle[ev.status];
                  return (
                    <div key={ev.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={ev.coverImage}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900 text-sm">{ev.title}</div>
                            <span className={`flex-shrink-0 border px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${status.badge}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            <strong>{ev.organizerName}</strong> • {ev.location}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 mt-1">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {ev.date} às {ev.time}
                            </span>
                            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">{ev.category}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ticket sales summary */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Bilhetes vendidos</span>
                          <span className="font-mono font-bold text-slate-900">
                            {ev.totalTicketsSold} / {capacity} <span className="text-slate-400 font-normal">({occupancy}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${occupancy >= 90 ? 'bg-red-500' : occupancy >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Receita</div>
                            <div className="text-sm font-extrabold text-emerald-700 font-mono">{ev.totalRevenueXOF.toLocaleString('pt-PT')} XOF</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Relação empresarial</div>
                            <div className="text-sm font-extrabold text-slate-700">{ev.businessId ? 'Empresa registada' : 'Organização externa'}</div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedEventDetail(ev)}
                        className="w-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver detalhe do evento
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* EVENT_DETAIL_MODAL */}
            {selectedEventDetail && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setSelectedEventDetail(null)}>
                <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detalhe do evento</div>
                      <h3 className="text-base font-black text-slate-900 mt-0.5">{selectedEventDetail.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Organizado por <strong>{selectedEventDetail.organizerName}</strong>
                        {selectedEventDetail.businessId ? ' · Empresa registada' : ' · Organização externa'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEventDetail(null)}
                      aria-label="Fechar detalhe do evento"
                      className="shrink-0 w-8 h-8 rounded-full border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    {[
                      { label: 'Data', value: selectedEventDetail.date },
                      { label: 'Hora', value: selectedEventDetail.time },
                      { label: 'Local', value: selectedEventDetail.location },
                      { label: 'Bairro', value: selectedEventDetail.neighborhood },
                      { label: 'Categoria', value: selectedEventDetail.category },
                      { label: 'Estado', value: selectedEventDetail.status === 'active' ? 'Activo' : selectedEventDetail.status === 'draft' ? 'Pendente' : selectedEventDetail.status === 'cancelled' ? 'Cancelado' : 'Encerrado' },
                      { label: 'Bilhetes vendidos', value: String(selectedEventDetail.totalTicketsSold) },
                      { label: 'Receita', value: `${selectedEventDetail.totalRevenueXOF.toLocaleString('pt-PT')} XOF` },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">{item.label}</div>
                        <div className="font-bold text-slate-900 mt-0.5 break-words">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedEventDetail.description && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Descrição</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{selectedEventDetail.description}</p>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Tipos de bilhete</div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] text-slate-400 uppercase border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-bold">Tipo</th>
                            <th className="text-right px-3 py-2 font-bold">Preço</th>
                            <th className="text-right px-3 py-2 font-bold">Vendidos</th>
                            <th className="text-right px-3 py-2 font-bold">Disponível</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedEventDetail.ticketTypes.map((tt) => (
                            <tr key={tt.id}>
                              <td className="px-3 py-2 font-bold text-slate-900">{tt.name}</td>
                              <td className="px-3 py-2 text-right font-mono">{tt.priceXOF.toLocaleString('pt-PT')} XOF</td>
                              <td className="px-3 py-2 text-right font-mono">{tt.soldQuantity}</td>
                              <td className="px-3 py-2 text-right font-mono">{tt.availableQuantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedEventDetail(null)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl transition text-xs"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Section 10 Payment Integration & Operator Reconciliation */}
      {activeTab === 'financials' && (
        <div className="space-y-6 text-xs">
          {/* Histórico real de pagamentos (PostgreSQL) — leitura */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Histórico real de pagamentos (base de dados)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {adminPaymentHistoryLoading
                    ? 'A carregar transacções…'
                    : `${adminPaymentHistory.length} transacção${adminPaymentHistory.length === 1 ? '' : 'ões'} registada${adminPaymentHistory.length === 1 ? '' : 's'} no PostgreSQL`}
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-mono">
                {adminPaymentHistory.reduce((sum, t) => sum + t.amountXOF, 0).toLocaleString('pt-PT')} XOF
              </span>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-bold px-4 py-2">ID</th>
                    <th className="text-left font-bold px-4 py-2">Utilizador</th>
                    <th className="text-left font-bold px-4 py-2">Serviço</th>
                    <th className="text-left font-bold px-4 py-2">Provider</th>
                    <th className="text-right font-bold px-4 py-2">Valor</th>
                    <th className="text-left font-bold px-4 py-2">Estado</th>
                    <th className="text-left font-bold px-4 py-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!adminPaymentHistoryLoading && adminPaymentHistory.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhuma transacção encontrada na base de dados.</td></tr>
                  )}
                  {adminPaymentHistory.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-2 font-mono text-slate-500">{t.id}</td>
                      <td className="px-4 py-2 text-slate-700">{t.payerName || '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{t.useCaseLabel || t.useCase}</td>
                      <td className="px-4 py-2 text-slate-600">{t.provider}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">{t.amountXOF.toLocaleString('pt-PT')} XOF</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border ${t.status === 'confirmed_api' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {getPaymentStatusLabel(t)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500 font-mono">{t.createdAt || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 10 Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <span className="bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                  Secção 10 - Integração de Pagamentos Telemóvel & Reconciliação
                </span>
                <h3 className="font-extrabold text-base sm:text-lg text-white mt-1 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span>Subscrições empresariais, planos e reconciliação da plataforma</span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={handleBatchReconcileConfirmed}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reconciliar Subscrições Confirmadas</span>
                </button>

                <button type="button"
                  onClick={handleExportReconciliationReport}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 text-xs"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>Exportar Extrato (CSV)</span>
                </button>
              </div>
            </div>

            {/* Operator Onboarding & API Window Notice */}
            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>
                    Janela Técnica de Negociação API/SDK com Operadoras: <strong>2 a 4 Meses</strong>
                  </span>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-500/30">
                  Modo MVP: Operação com Confirmação Manual Ativa
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Esta área é exclusiva para supervisão de pagamentos da plataforma, planos empresariais, renovações, extras e reconciliação financeira. Compras de bilhetes, dados de compradores e validação de QR pertencem exclusivamente à empresa organizadora.
              </p>
            </div>

            {/* Operators Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Orange Money */}
              <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="font-black text-white text-sm">Orange Money</h4>
                      <span className="text-[10px] text-amber-300">Número Dedicado Guigui: <strong>+245 955 00 00</strong></span>
                    </div>
                  </div>
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    Negociação API
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-amber-900/60 text-[11px]">
                  <span className="text-amber-200">Volume Total Processado:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {platformPaymentTransactions
                      .filter((t) => t.provider === 'orange_money')
                      .reduce((acc, t) => acc + t.amountXOF, 0)
                      .toLocaleString('pt-PT')}{' '}
                    XOF
                  </span>
                </div>
              </div>

              {/* Telecel Teletaco */}
              <div className="bg-blue-950/40 border border-blue-800/60 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                    <div>
                      <h4 className="font-black text-white text-sm">Telecel (Teletaco / Nova Operadora)</h4>
                      <span className="text-[10px] text-blue-300">Número Dedicado Guigui: <strong>+245 966 00 00</strong></span>
                    </div>
                  </div>
                  <span className="bg-blue-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    Negociação API
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-blue-900/60 text-[11px]">
                  <span className="text-blue-200">Volume Total Processado:</span>
                  <span className="font-mono font-bold text-blue-300">
                    {platformPaymentTransactions
                      .filter((t) => t.provider === 'telecel')
                      .reduce((acc, t) => acc + t.amountXOF, 0)
                      .toLocaleString('pt-PT')}{' '}
                    XOF
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Volume Total Registado</span>
              <div className="text-xl font-black text-slate-900 font-mono">
                {platformPaymentTransactions.reduce((acc, t) => acc + t.amountXOF, 0).toLocaleString('pt-PT')} XOF
              </div>
              <span className="text-[10px] text-slate-400">{platformPaymentTransactions.length} transações de plataforma</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] text-amber-800 uppercase font-bold block">Pendente Confirmação Manual</span>
              <div className="text-xl font-black text-amber-900 font-mono">
                {platformPaymentTransactions
                  .filter((t) => t.status === 'pending_manual_confirmation')
                  .reduce((acc, t) => acc + t.amountXOF, 0)
                  .toLocaleString('pt-PT')}{' '}
                XOF
              </div>
              <span className="text-[10px] text-amber-700 font-bold">
                {platformPaymentTransactions.filter((t) => t.status === 'pending_manual_confirmation').length} pagamentos a validar
              </span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] text-emerald-800 uppercase font-bold block">Total Reconciliado (Extratos)</span>
              <div className="text-xl font-black text-emerald-900 font-mono">
                {platformPaymentTransactions
                  .filter((t) => t.status === 'reconciled')
                  .reduce((acc, t) => acc + t.amountXOF, 0)
                  .toLocaleString('pt-PT')}{' '}
                XOF
              </div>
              <span className="text-[10px] text-emerald-700">Verificado com o banco/operadora</span>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl space-y-1 shadow-sm">
              <span className="text-[10px] text-purple-800 uppercase font-bold block">Reembolsos Efetuados</span>
              <div className="text-xl font-black text-purple-900 font-mono">
                {platformPaymentTransactions
                  .filter((t) => t.status === 'refunded')
                  .reduce((acc, t) => acc + t.amountXOF, 0)
                  .toLocaleString('pt-PT')}{' '}
                XOF
              </div>
              <span className="text-[10px] text-purple-700">Estornos de eventos cancelados</span>
            </div>
          </div>

          {/* Transaction Filters Bar */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Filtros do Registo de Transações</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Mostrando {platformPaymentTransactions.length} transacções de plataforma (bilhetes excluídos)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Search input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Pesquisar ID / Cliente / Tel</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="TXN-2026-..., Nome, +245..."
                    value={paymentSearchQuery}
                    onChange={(e) => setPaymentSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Use Case Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Caso de Uso</label>
                <select
                  value={paymentUseCaseFilter}
                  onChange={(e) => setPaymentUseCaseFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                >
                  <option value="subscription_initial">Subscrição Inicial</option>
                  <option value="subscription_renewal">Renovação de Subscrição</option>
                  <option value="extra_posts">Posts Extra</option>
                  <option value="extra_promotions">Promoções Extra</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Estado do Pagamento</label>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                >
                  <option value="pending_manual_confirmation">Pendente Confirmação Manual (MVP)</option>
                  <option value="confirmed_api">Confirmado via API Sandbox</option>
                  <option value="confirmed_manual">Confirmado Manualmente</option>
                  <option value="reconciled">Reconciliado no Extrato</option>
                  <option value="refunded">Reembolsado</option>
                </select>
              </div>

              {/* Provider Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Operadora / Canal</label>
                <select
                  value={paymentProviderFilter}
                  onChange={(e) => setPaymentProviderFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                >
                  <option value="all">Todas as Operadoras</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="telecel">Telecel (Teletaco)</option>
                  <option value="manual_transfer">Transferência Manual / Balcão</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Registo Único de Transações & Reconciliação com Extratos</span>
              </h4>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">Exportar Transações:</span>
                <button type="button"
                  onClick={() => {
                    const headers = ['ID', 'Data', 'Caso de Uso', 'Pagador', 'Telemóvel', 'Empresa/Evento', 'Valor (XOF)', 'Operadora', 'Estado'];
                    const rows = platformPaymentTransactions.map(t => [
                      t.id, t.createdAt, t.useCase, t.payerName, t.payerPhone, t.businessName || t.eventName || 'N/A', t.amountXOF, t.provider, t.status
                    ]);
                    downloadCSV('transacoes_financeiras_guigui.csv', headers, rows);
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition flex items-center gap-1.5"
                  title="Exportar CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button type="button"
                  onClick={() => {
                    const headers = ['ID', 'Data', 'Caso de Uso', 'Pagador', 'Telemóvel', 'Empresa/Evento', 'Valor (XOF)', 'Operadora', 'Estado'];
                    const rows = platformPaymentTransactions.map(t => [
                      t.id, t.createdAt, t.useCase, t.payerName, t.payerPhone, t.businessName || t.eventName || 'N/A', t.amountXOF, t.provider, t.status
                    ]);
                    downloadExcel('transacoes_financeiras_guigui.xls', 'Transações', headers, rows);
                  }}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] transition flex items-center gap-1.5"
                  title="Exportar Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button type="button"
                  onClick={() => {
                    const headers = ['ID', 'Data', 'Pagador', 'Serviço', 'Valor (XOF)', 'Operadora', 'Estado'];
                    const rows = platformPaymentTransactions.map(t => [
                      t.id, t.createdAt.substring(0, 10), t.payerName, t.useCase, `${t.amountXOF.toLocaleString('pt-PT')} XOF`, t.provider, t.status
                    ]);
                    const totalVolume = platformPaymentTransactions.reduce((acc, t) => acc + t.amountXOF, 0);
                    downloadPDFReport(
                      'Relatório Financeiro & Reconciliação - Guigui.com',
                      `Extrato de pagamentos e reconciliação com operadoras de Mobile Money (Orange Money / Telecel) e balcão em Bissau. Volume total: ${totalVolume.toLocaleString('pt-PT')} XOF.`,
                      [
                        { label: 'Transações', value: `${platformPaymentTransactions.length}` },
                        { label: 'Volume Bruto', value: `${totalVolume.toLocaleString('pt-PT')} XOF` },
                        { label: 'Comissão Estimada', value: `${(totalVolume * 0.1).toLocaleString('pt-PT')} XOF` },
                      ],
                      headers,
                      rows
                    );
                  }}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 font-bold rounded-lg text-[11px] transition flex items-center gap-1.5"
                  title="Exportar PDF Financeiro"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">ID & Data</th>
                    <th className="py-3 px-4">Caso de Uso & Servico</th>
                    <th className="py-3 px-4">Cliente / Empresa</th>
                    <th className="py-3 px-4">Valor (XOF)</th>
                    <th className="py-3 px-4">Operadora & Comprovativo</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Ações de Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(() => {
                    const filteredTxns = platformPaymentTransactions.filter((item) => {
                      if (paymentUseCaseFilter !== 'all' && item.useCase !== paymentUseCaseFilter) return false;
                      if (paymentStatusFilter !== 'all' && item.status !== paymentStatusFilter) return false;
                      if (paymentProviderFilter !== 'all' && item.provider !== paymentProviderFilter) return false;
                      if (paymentSearchQuery.trim()) {
                        const q = paymentSearchQuery.toLowerCase();
                        const matchId = item.id.toLowerCase().includes(q);
                        const matchPayer = item.payerName.toLowerCase().includes(q);
                        const matchPhone = item.payerPhone.toLowerCase().includes(q);
                        const matchBiz = (item.businessName || '').toLowerCase().includes(q);
                        if (!matchId && !matchPayer && !matchPhone && !matchBiz) return false;
                      }
                      return true;
                    });

                    if (filteredTxns.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Nenhuma transação encontrada com os filtros selecionados.
                          </td>
                        </tr>
                      );
                    }

                    return filteredTxns.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        {/* ID & Date */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{item.id}</div>
                          <div className="text-[10px] text-slate-400">{item.createdAt}</div>
                        </td>

                        {/* Use Case */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{item.useCaseLabel}</div>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                            {item.useCase}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{item.payerName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.payerPhone}</div>
                          {item.businessName && (
                            <div className="text-[10px] text-blue-700 font-semibold">{item.businessName}</div>
                          )}
                        </td>

                        {/* Amount XOF */}
                        <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 text-sm">
                          {item.amountXOF.toLocaleString('pt-PT')} XOF
                        </td>

                        {/* Provider & Proof */}
                        <td className="py-3.5 px-4 space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              item.provider === 'orange_money'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : item.provider === 'telecel'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {item.provider === 'orange_money'
                              ? 'Orange Money'
                              : item.provider === 'telecel'
                              ? 'Telecel'
                              : 'Manual / Depósito'}
                          </span>

                          <div className="text-[10px] text-slate-500 font-mono line-clamp-1">
                            {item.providerRef || item.manualProofReference || 'Aguardando comprovativo'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {item.status === 'pending_manual_confirmation' && item.provider !== 'manual_transfer' && !item.manualProofReference && (
                            <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-300 animate-pulse">
                              Pendente Confirmação MVP
                            </span>
                          )}
                          {item.status === 'pending_manual_confirmation' && (item.provider === 'manual_transfer' || item.manualProofReference) && (
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-300">
                              Registo legado; não confirmar
                            </span>
                          )}
                          {item.status === 'confirmed_api' && (
                            <span className="bg-blue-100 text-blue-900 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-200">
                              {getPaymentStatusLabel(item)}
                            </span>
                          )}
                          {item.status === 'pending_provider' && (
                            <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-300">
                              {getPaymentStatusLabel(item)}
                            </span>
                          )}
                          {item.status === 'confirmed_manual' && (
                            <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                              Confirmado Manual
                            </span>
                          )}
                          {item.status === 'reconciled' && (
                            <span className="bg-slate-900 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-700">
                              ✓ Reconciliado
                            </span>
                          )}
                          {item.status === 'refunded' && (
                            <span className="bg-purple-100 text-purple-900 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-purple-200">
                              Reembolsado
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right space-y-1">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === 'pending_manual_confirmation' && item.provider !== 'manual_transfer' && !item.manualProofReference && (
                              <button type="button"
                                onClick={() => handleConfirmManualPayment(item.id)}
                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-2.5 py-1 rounded-lg text-[10px] transition shadow-sm"
                                title="Confirmar recebimento manual de 1-clique"
                              >
                                Confirmar Pagamento
                              </button>
                            )}

                            {(item.status === 'confirmed_api' || item.status === 'confirmed_manual') && (
                              <button type="button"
                                onClick={() => handleReconcileTransaction(item.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg text-[10px] transition shadow-sm flex items-center gap-1"
                                title="Marcar como Reconciliado no Extrato da Operadora"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Reconciliar Extrato</span>
                              </button>
                            )}

                            {item.status !== 'refunded' && (
                              <button type="button"
                                onClick={() => handleRefundTransaction(item.id)}
                                className="bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 font-bold px-2 py-1 rounded-lg text-[10px] transition"
                                title="Processar reembolso de evento cancelado ou contestação"
                              >
                                Reembolsar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB: Reports & Exportação */}
      {activeTab === 'support' && onReplySupport && onUpdateSupportStatus && (
        <AdminSupportHub
          currentLang={currentLang}
          supportRequests={supportRequests}
          businesses={businessesList}
          onReplySupport={onReplySupport}
          onUpdateSupportStatus={onUpdateSupportStatus}
          focusSupportId={focusSupportId}
        />
      )}

      {activeTab === 'reports' && (
        <AdminReportsHub
          currentLang={currentLang}
          businesses={businessesList}
          events={events}
          paymentTransactions={platformPaymentTransactions}
        />
      )}

      {/* TAB 6: Section 11 Technical Architecture & Infrastructure */}
      {activeTab === 'architecture' && (
        <div className="space-y-6 text-xs">
          {/* Section 11 Header Banner */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <span className="bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                  Secção 11 - Requisitos Técnicos & Arquitectura do Sistema
                </span>
                <h3 className="font-extrabold text-base sm:text-lg text-white mt-1 flex items-center gap-2">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <span>Stack Recomendada, PWA, Hospedagem Nuvem, Segurança RGPD & Backups</span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={handleTriggerManualCloudBackup}
                  disabled={isTriggeringBackup}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm text-xs disabled:opacity-50"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>{isTriggeringBackup ? 'A Executar Backup...' : 'Executar Backup Nuvem Agora'}</span>
                </button>
              </div>
            </div>

            {/* Sub-section 11.1 & 11.2 Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
              {/* Stack Card */}
              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-black text-slate-200 text-sm">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>11.1 Stack Recomendada</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-300">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Frontend:</strong> React 19 + Vite + Tailwind CSS v4 + TypeScript</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Backend:</strong> Node.js REST API + Express + TypeScript</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Persistência:</strong> JSON em desenvolvimento + localStorage; base relacional recomendada para produção</span>
                  </li>
                </ul>
              </div>

              {/* Hosting Card (11.2) */}
              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-black text-slate-200 text-sm">
                  <Globe2 className="w-4 h-4 text-emerald-400" />
                  <span>11.2 Hospedagem Nuvem vs Local</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-300">
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-700 flex items-center justify-between">
                    <span>DigitalOcean Frankfurt (fra1)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                      Nó Primário Ativo
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-700 flex items-center justify-between">
                    <span>Hetzner Amsterdam (ams3)</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold border border-blue-500/30">
                      Cópia Fria Replicada
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-300/90 leading-tight pt-1">
                    ⚠️ Servidor Local: Apenas posto de trabalho. Produção 100% na Nuvem para isolar do risco de falhas elétricas/internet locais.
                  </p>
                </div>
              </div>

              {/* PWA & Gate Scanner Card (11.3) */}
              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-black text-slate-200 text-sm">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span>11.3 PWA & Scanner de Porta</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>PWA Manifest & Service Worker:</span>
                    <span className="text-emerald-400 font-bold">✓ Ativo & Instalável</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cache Offline 3G/4G:</span>
                    <span className="text-emerald-400 font-bold">✓ Tolerante a Quebras</span>
                  </div>
                  <div className="pt-1">
                    <button type="button"
                      onClick={() => alert('Download do APK Android "Guigui Gate Scanner v1.2" iniciado no seu dispositivo.')}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-1.5 px-3 rounded-xl transition text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descarregar APK Android (Scanner de Porta)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-section 11.4: Segurança, Privacidade (RGPD / Diáspora) & supervisão empresarial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ticket security architecture — no operational access */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>11.4 Arquitectura de segurança da bilhética</span>
                </h4>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Apenas supervisão
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                A assinatura de uso único, o QR e a validação de entradas são processados pelo scanner autenticado da empresa organizadora. O Super Admin não introduz tokens, não lê QR e não acede a compras ou compradores.
              </p>
              <div className="grid grid-cols-1 gap-2 text-[11px]">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <strong className="text-blue-900">Responsável operacional:</strong> empresa organizadora e equipa de portaria autorizada.
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <strong className="text-emerald-900">Responsável de governação:</strong> Super Admin gere acesso, plano, auditoria e configuração da plataforma.
                </div>
              </div>
            </div>

            {/* Password Security, 2FA & Consent Terms Log */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Segurança, 2FA & Registo de Consentimento (RGPD / Diáspora)</span>
                </h4>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Conformidade Jurídica
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Hash de Passwords</span>
                  <div className="font-bold text-slate-800 font-mono">scrypt + Salt</div>
                  <span className="text-[10px] text-slate-500">Sem armazenamento em plaintext</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Autenticação 2FA</span>
                  <div className="font-bold text-emerald-700">Obrigatório no Super Admin</div>
                  <span className="text-[10px] text-slate-500">Entrega externa ainda simulada na demo</span>
                </div>
              </div>

              {/* Consent Log Snippet */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Registo de Consentimento Explícito aos Termos (IP + Data/Hora)
                </span>
                <div className="bg-slate-900 text-slate-200 p-3 rounded-2xl space-y-2 font-mono text-[10px]">
                  {consentLogsList.map((log) => (
                    <div key={log.id} className="border-b border-slate-800 pb-2 last:border-b-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white">{log.userName}</span> ({log.phone})
                        <div className="text-slate-400">IP: {log.ipAddress} • {log.acceptedAt}</div>
                      </div>
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[9px] font-bold">
                        {log.termsVersion}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cloud Backups Log Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Histórico de Backups Automáticos Diários na Nuvem (Segunda Região)</span>
              </h4>
              <span className="text-[10px] text-slate-500">Replicado em Frankfurt & Amsterdam</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">ID Backup</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Região Primária</th>
                    <th className="py-3 px-4">Região Secundária</th>
                    <th className="py-3 px-4">Tamanho</th>
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {archBackupLogs.map((bkp) => (
                    <tr key={bkp.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{bkp.id}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {bkp.type === 'automatic_daily' ? 'Diário Automático' : 'Manual / Pedido'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{bkp.regionPrimary}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{bkp.regionSecondary}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{bkp.sizeMB} MB</td>
                      <td className="py-3.5 px-4 text-slate-500">{bkp.timestamp}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                          ✓ Integridade Verificada
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-section 11.5 Non-Functional Requirements Summary Grid */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>11.5 Requisitos Não-Funcionais & Resiliência de Rede em Bissau</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Idiomas Suportados</span>
                <div className="text-sm font-black text-emerald-400">Português, Francês, Inglês</div>
                <p className="text-[10px] text-slate-300">Arquitectura multilingue pronta com fallback PT</p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Otimização de Largura de Banda</span>
                <div className="text-sm font-black text-blue-400">Suporte a Ligações 3G/4G Instáveis</div>
                <p className="text-[10px] text-slate-300">Compressão de dados e minificação extrema de assets</p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Funcionamento Offline</span>
                <div className="text-sm font-black text-amber-400">Sem Perda de Dados no Scanner</div>
                <p className="text-[10px] text-slate-300">Validação local bufferizada com sincronização posterior</p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Escalabilidade</span>
                <div className="text-sm font-black text-purple-400">Dezenas a Milhares de Clientes</div>
                <p className="text-[10px] text-slate-300">Sem necessidade de reescrita estrutural do MVP</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Notification Management & Preferences */}
      {activeTab === 'notifications' && notificationPreferences && onNotificationPreferencesChange && (
        <div className="space-y-6">
          <form onSubmit={handleSendAdminAnnouncement} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-600" />
                  {t('admin.sendNotification')}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{t('admin.notificationPrivacy')}</p>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 font-bold">{t('admin.inAppActive')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">{t('admin.audience')}</span>
                <select value={announcementTargetRole} onChange={(e) => setAnnouncementTargetRole(e.target.value as NotificationTargetRole)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800">
                  <option value="admin">Administradores</option>
                  <option value="user">Cidadão específico</option>
                  <option value="business">Empresa específica</option>
                  <option value="all">Todos — anúncio geral</option>
                </select>
              </label>
              {(announcementTargetRole === 'user' || announcementTargetRole === 'business') && (
                <label className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">{t('admin.recipientId')}</span>
                  <input value={announcementRecipient} onChange={(e) => setAnnouncementRecipient(e.target.value)} placeholder={announcementTargetRole === 'user' ? 'ex.: usr-1' : 'ex.: biz-1'} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800" required />
                </label>
              )}
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">{t('admin.noticeTitle')}</span>
                <input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="Título do aviso" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800" required />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">{t('admin.priority')}</span>
                <select value={announcementPriority} onChange={(e) => setAnnouncementPriority(e.target.value as NotificationPriority)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800">
                  <option value="info">Informação</option>
                  <option value="success">Sucesso</option>
                  <option value="attention">Atenção</option>
                  <option value="critical">Crítico</option>
                </select>
              </label>
            </div>

            <label className="space-y-1.5 block">
              <span className="text-[10px] font-bold uppercase text-slate-500">{t('admin.message')}</span>
              <textarea value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} placeholder="Escreva uma mensagem sem dados privados desnecessários." rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 resize-y" required />
            </label>

            <div className="flex flex-wrap items-end gap-4">
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Expira em (opcional)</span>
                <input type="date" value={announcementExpiresAt} onChange={(e) => setAnnouncementExpiresAt(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800" />
              </label>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">{t('admin.additionalChannels')}</span>
                <div className="flex flex-wrap gap-2">
                  {(['push', 'email', 'sms'] as NotificationChannel[]).map((channel) => (
                    <label key={channel} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <input type="checkbox" checked={announcementChannels.includes(channel)} onChange={(e) => setAnnouncementChannels((prev) => e.target.checked ? [...prev, channel] : prev.filter((item) => item !== channel))} />
                      {channel === 'push' ? 'Push' : channel === 'email' ? 'Email' : 'SMS'}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={!onSystemEvent} className="ml-auto rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition">
                {t('admin.issueNotice')}
              </button>
            </div>
          </form>

          <NotificationPreferencesPanel
            role="admin"
            value={notificationPreferences}
            onChange={onNotificationPreferencesChange}
          />
        </div>
      )}

            </main>
          </div>
        </div>
    </>
  );
};
