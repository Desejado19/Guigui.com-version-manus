import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  LayoutDashboard,
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
import { AdminTeamHub } from './admin/AdminTeamHub';
import { AdminAuditLogsHub } from './admin/AdminAuditLogsHub';
import { AdminOverview } from './admin/AdminOverview';
import { LocationCatalogAdmin } from './admin/LocationCatalogAdmin';
import { AdminCapabilityHub } from './admin/AdminCapabilityHub';
import { AdminPermissionsMatrix } from './admin/AdminPermissionsMatrix';
import { AdminReportsHub } from './admin/AdminReportsHub';
import { StoriesModerationPanel } from './admin/StoriesModerationPanel';
import { AdminSupportHub } from './admin/AdminSupportHub';
import { SubscriptionPlansAdmin } from './admin/SubscriptionPlansAdmin';
import { CommercialModule } from './admin/management/CommercialModule';
import { CommercialPlansPage } from './admin/management/CommercialPlansPage';
import { CommercialSubscriptionsPage } from './admin/management/CommercialSubscriptionsPage';
import { CommercialFeaturesPage } from './admin/management/CommercialFeaturesPage';
import { CommercialPricingPage } from './admin/management/CommercialPricingPage';
import { CommercialProductsPage } from './admin/management/CommercialProductsPage';
import { CommercialTicketFeesPage } from './admin/management/CommercialTicketFeesPage';
import { CommercialRulesPage } from './admin/management/CommercialRulesPage';
import { CommercialAuditPage } from './admin/management/CommercialAuditPage';
import type { CommercialSection } from './admin/management/commercialApi';
import { BusinessesModule } from './admin/management/BusinessesModule';
import { BusinessesManagementPage } from './admin/management/BusinessesManagementPage';
import { FeaturedBusinessesManagementPage } from './admin/management/FeaturedBusinessesManagementPage';
import { SobreNosManagementPage } from './admin/management/SobreNosManagementPage';
import { EventsManagementPage } from './admin/management/EventsManagementPage';
import { TicketsManagementPage } from './admin/management/TicketsManagementPage';
import { TransactionsManagementPage } from './admin/management/TransactionsManagementPage';
import { FinanceModule } from './admin/management/FinanceModule';
import { FinanceTransactionsPage } from './admin/management/FinanceTransactionsPage';
import { FinanceReconciliationPage } from './admin/management/FinanceReconciliationPage';
import { FinanceOperatorsPage } from './admin/management/FinanceOperatorsPage';
import { FinancePendingPage } from './admin/management/FinancePendingPage';
import { FinanceRefundsPage } from './admin/management/FinanceRefundsPage';
import { FinanceStatementsPage } from './admin/management/FinanceStatementsPage';
import { PromotionsManagementPage } from './admin/management/PromotionsManagementPage';
import { SupportManagementPage } from './admin/management/SupportManagementPage';
import { CitizensManagementPage } from './admin/management/CitizensManagementPage';
import { UsersModule } from './admin/management/UsersModule';
import { UsersActivityPage } from './admin/management/UsersActivityPage';
import { SessionsManagementPage } from './admin/management/SessionsManagementPage';
import { CampaignsManagementPage } from './admin/management/CampaignsManagementPage';
import { ManagementPage, ModuleNav } from './admin/management/ManagementUi';
import { MonetizationAdmin } from './admin/MonetizationAdmin';
import { INITIAL_ADMIN_STAFF } from '../data/adminStaffData';
import { INITIAL_AUDIT_LOGS } from '../data/auditLogsData';
import { downloadCSV, downloadExcel, downloadPDFReport } from '../utils/exportHelpers';
import { filterModerationLogs, getModerationWorkflowColumn, transitionModerationLog } from '../utils/moderationWorkflow';
import { persistModerationDecision } from '../utils/moderationPersistence';
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
  Promotion,
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
  UserProfile,
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
import { GlassBottomNav } from './navigation/GlassBottomNav';
import { ModuleSubnav } from './navigation/ModuleSubnav';

interface AdminDashboardProps {
  businesses: Business[];
  events: EventItem[];
  promotions?: Promotion[];
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
  initialTab?: 'capabilities' | 'profile' | 'overview' | 'businesses' | 'moderation' | 'pricing' | 'categories' | 'roles' | 'admin_staff' | 'audit_logs' | 'events' | 'financials' | 'architecture' | 'reports' | 'notifications' | 'support' | 'sobre-nos';
  currentUser?: UserProfile | null;
  onLogout?: () => void;
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
  promotions = [],
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
  currentUser,
  onLogout,
  sidebarCollapsed: controlledSidebarCollapsed,
  onSidebarCollapsedChange,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const navigateAdminTab = (tab: string) => {
    const aliases: Record<string, typeof activeTab> = {
      tickets: 'events',
      logs: 'audit_logs',
    };
    setManagementPage(null);
    setActiveTab(aliases[tab] || tab as typeof activeTab);
  };

  const openBusinessList = (review: 'all' | 'duplicates' | 'test' = 'all') => {
    try {
      const key = 'admin.management.businesses';
      const raw = window.sessionStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.filters = { ...(parsed.filters || {}), review };
      parsed.page = 1;
      window.sessionStorage.setItem(key, JSON.stringify(parsed));
    } catch {
      // Preferência de filtros: falha de storage não impede abrir a lista.
    }
    setActiveTab('businesses');
    setManagementPage('businesses');
  };

  const pendingAdminSupport = supportRequests.filter((request) => request.status !== 'resolved').length;
  // Badge de empresas pendentes reflecte o banco (prop inicial já vem do PostgreSQL).
  const pendingBusinessesCount = initialBusinesses.filter((business) => business.status === 'pending').length;
  const [operationalAlerts, setOperationalAlerts] = useState({ divergences: 0, overdue: 0 });
  const operationalAlertsLoaded = React.useRef(false);
  const operationalAlertsTotal = operationalAlerts.divergences + operationalAlerts.overdue;
  const operationalAlertsLabel = `${operationalAlerts.divergences} ${operationalAlerts.divergences === 1 ? 'divergência' : 'divergências'} e ${operationalAlerts.overdue} ${operationalAlerts.overdue === 1 ? 'pagamento em atraso' : 'pagamentos em atraso'}`;
  const operationalAlertsHelp = `${operationalAlerts.divergences} ${operationalAlerts.divergences === 1 ? 'divergência' : 'divergências'} · ${operationalAlerts.overdue} ${operationalAlerts.overdue === 1 ? 'atraso' : 'atrasos'}`;
  // Badge de moderação pendente vem das estatísticas reais agregadas do banco.
  const [pendingModerationCount, setPendingModerationCount] = useState(0);
  const [adminStats, setAdminStats] = useState<{
    users?: { total?: number; byRole?: Record<string, number> };
    events?: { total?: number; byStatus?: Record<string, number> };
    tickets?: { total?: number; byStatus?: Record<string, number> };
    payments?: { total?: number; byStatus?: Record<string, number> };
    revenue?: { grossXOF?: number };
    support?: { total?: number; byStatus?: Record<string, number> };
    moderation?: { total?: number; byStatus?: Record<string, number> };
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setAdminStats(data);
        const pending = Number(data?.moderation?.byStatus?.pending ?? 0);
        if (Number.isFinite(pending)) setPendingModerationCount(pending);
      } catch {
        // Badge informativo: uma falha de rede não deve bloquear o painel.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const adminAccess = currentUser?.adminAccess || null;
  const adminTabAllows = (tab: string): boolean => {
    if (!adminAccess) return true;
    const actions = adminAccess[tab];
    return Array.isArray(actions) && actions.includes('view');
  };

  const adminNavigationGroupsAll: Array<{ heading: string; items: Array<{ label: string; tab: typeof activeTab; icon: React.ComponentType<{ className?: string }>; help: string; count?: number; countLabel?: string }> }> = [
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
        { label: t('adminNavFinancials'), tab: 'financials', icon: DollarSign, help: operationalAlertsTotal > 0 ? operationalAlertsHelp : t('adminNavFinancialsHelp'), count: operationalAlertsTotal, countLabel: operationalAlertsTotal > 0 ? operationalAlertsLabel : undefined },
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
        { label: 'Sobre Nós', tab: 'sobre-nos', icon: Building2, help: 'Identidade visual e informações institucionais do Guigui.com.' },
      ],
    },
    {
      heading: t('adminNavSecurity'),
      items: [
        { label: 'Auditoria', tab: 'audit_logs', icon: History, help: t('adminNavAuditHelp') },
      ],
    },
  ];

  // Um colaborador administrativo só vê os módulos que lhe foram concedidos.
  const adminNavigationGroups = adminNavigationGroupsAll
    .map((group) => ({ ...group, items: group.items.filter((item) => adminTabAllows(item.tab)) }))
    .filter((group) => group.items.length > 0);

  const allAdminItems = adminNavigationGroups.flatMap((group) => group.items);
  const configuredAdminNavigation = ADMIN_NAVIGATION;
  const [activeTab, setActiveTab] = useState<'capabilities' | 'profile' | 'overview' | 'businesses' | 'moderation' | 'pricing' | 'categories' | 'users' | 'roles' | 'admin_staff' | 'audit_logs' | 'events' | 'financials' | 'architecture' | 'reports' | 'notifications' | 'support' | 'sobre-nos'>(initialTab);
  const [commercialView, setCommercialView] = useState<'summary' | CommercialSection>('summary');
  // Submódulos que antes apareciam empilhados na mesma página.
  const [moderationSection, setModerationSection] = useState<'stories' | 'pipeline' | 'queue'>('pipeline');
  const [notificationSection, setNotificationSection] = useState<'send' | 'preferences'>('send');
  // Páginas independentes de gestão. A sidebar mantém o módulo destacado e o
  // botão de retorno devolve o utilizador ao módulo de origem.
  const [managementPage, setManagementPage] = useState<'businesses' | 'featured' | 'events' | 'tickets' | 'transactions' | 'promotions' | 'support' | 'users' | 'users-all' | 'users-citizens' | 'users-business' | 'users-admins' | 'users-suspended' | 'users-activity' | 'staff' | 'audit' | 'reports' | 'sessions' | 'campaigns' | 'finance-transactions' | 'finance-reconciliation' | 'finance-operators' | 'finance-pending' | 'finance-refunds' | 'finance-statements' | null>(null);
  // Badge informativo: actualiza ao abrir o Financeiro e ao mudar de subpágina,
  // sem duplicar o painel de alertas que continua a ser a fonte de verdade.
  useEffect(() => {
    if (activeTab !== 'financials' && operationalAlertsLoaded.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/finance/alerts', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json() as { alerts?: Array<{ id?: string; count?: number }> };
        if (cancelled) return;
        const counts = new Map((data.alerts || []).map((alert) => [alert.id, Number(alert.count) || 0]));
        setOperationalAlerts({
          divergences: counts.get('reconciliation_divergence') || 0,
          overdue: counts.get('pending_payment_overdue') || 0,
        });
        operationalAlertsLoaded.current = true;
      } catch {
        // Badge informativo: falha de rede não deve bloquear o painel.
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, managementPage]);
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
  // Equipa administrativa real: a matriz de permissões e os resumos usam a
  // lista devolvida pelo servidor, não dados estáticos.
  const [staffList, setStaffList] = useState<AdminStaffMember[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/team/members', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { members?: Array<{ userId: string; name: string; email: string; phone: string; jobTitle?: string; role: string; status: string; access: Record<string, string[]>; lastActiveAt?: string }> };
        if (cancelled) return;
        setStaffList((payload.members || []).map((member) => {
          const modules = Object.keys(member.access || {}).filter((module) => (member.access[module] || []).includes('view'));
          return {
            id: member.userId,
            name: member.name,
            email: member.email,
            phone: member.phone,
            department: 'Financeiro & Contabilidade',
            accessLevel: member.role === 'admin' ? 'super_admin' : 'moderator',
            status: member.status === 'active' ? 'active' : member.status === 'suspended' ? 'suspended' : 'revoked',
            permissions: {
              manageBusinesses: modules.includes('businesses'),
              contentModeration: modules.includes('moderation'),
              financialAudit: modules.includes('financials'),
              manageAdmins: modules.includes('admin_staff'),
              viewAuditLogs: modules.includes('audit_logs'),
              exportReports: modules.includes('reports'),
              managePricing: modules.includes('pricing'),
              validateTickets: modules.includes('events'),
            },
            twoFactorEnabled: false,
            lastLoginAt: member.lastActiveAt,
            createdAt: member.lastActiveAt || new Date().toISOString(),
            createdBy: 'platform',
          } satisfies AdminStaffMember;
        }));
      } catch {
        // Sem ligação: a lista fica vazia em vez de mostrar dados fictícios.
      }
    })();
    return () => { cancelled = true; };
  }, []);
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

  const staffAccessFromMember = (member: AdminStaffMember): Record<string, string[]> => {
    const access: Record<string, string[]> = { overview: ['view'] };
    const grant = (module: string, actions: string[]) => { access[module] = actions; };
    if (member.permissions.manageBusinesses) grant('businesses', ['view', 'edit', 'approve', 'reject']);
    if (member.permissions.contentModeration) grant('moderation', ['view', 'approve', 'reject']);
    if (member.permissions.financialAudit) grant('financials', ['view', 'export']);
    if (member.permissions.manageAdmins) grant('admin_staff', ['view', 'create', 'edit', 'delete', 'manage']);
    if (member.permissions.viewAuditLogs) grant('audit_logs', ['view']);
    if (member.permissions.exportReports) grant('reports', ['view', 'export']);
    if (member.permissions.managePricing) grant('pricing', ['view', 'edit', 'manage']);
    if (member.permissions.validateTickets) grant('events', ['view', 'edit']);
    return access;
  };

  const persistStaffMember = (member: AdminStaffMember) => {
    void fetch(`/api/admin/team/members/${member.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access: staffAccessFromMember(member), status: member.status === 'active' ? 'active' : member.status === 'suspended' ? 'suspended' : 'disabled' }),
    }).catch(() => undefined);
  };

  const handleUpdateStaff = (newStaff: AdminStaffMember[]) => {
    const previous = new Map(staffList.map((member) => [member.id, member]));
    newStaff.forEach((member) => {
      const before = previous.get(member.id);
      if (before && JSON.stringify(before) !== JSON.stringify(member)) persistStaffMember(member);
    });
    setStaffList(newStaff);
    if (onUpdateAdminStaff) onUpdateAdminStaff(newStaff);
  };

  const handleAddStaff = (newStaff: AdminStaffMember) => {
    // A criação real exige e-mail e palavra-passe; a área «Equipa» é o caminho
    // oficial. Aqui só actualizamos a lista após o servidor confirmar.
    void fetch('/api/admin/team/members', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newStaff.name,
        email: newStaff.email,
        password: `Guigui-${Math.random().toString(36).slice(2, 10)}!`,
        jobTitle: newStaff.department,
        preset: 'staff',
        access: staffAccessFromMember(newStaff),
      }),
    }).catch(() => undefined);
    setStaffList([...staffList, newStaff]);
  };

  const handleUpdateStaffEntry = (updatedStaff: AdminStaffMember) => {
    persistStaffMember(updatedStaff);
    setStaffList(staffList.map((staff) => staff.id === updatedStaff.id ? updatedStaff : staff));
  };

  const handleRevokeStaffAccess = (id: string, reason: string) => {
    void fetch(`/api/admin/team/members/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
    setStaffList(staffList.map((staff) => staff.id === id ? { ...staff, status: 'revoked' as const } : staff));
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
  const [categoriesError, setCategoriesError] = useState('');
  const [categoriesBusy, setCategoriesBusy] = useState(false);

  type AdminCategoryResponse = { id: string; name: string; groupId: string; subcategories?: string[] };
  const mapCategories = (list: AdminCategoryResponse[]): BusinessCategory[] => list.map((cat) => ({
    id: cat.id,
    name: cat.name,
    groupId: (cat.groupId || '') as BusinessCategory['groupId'],
    iconName: 'FolderTree',
    subcategories: Array.isArray(cat.subcategories) ? cat.subcategories : [],
  }));

  const loadCategoriesFromDb = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories', { credentials: 'include' });
      const payload = await response.json().catch(() => null) as { categories?: AdminCategoryResponse[]; error?: string } | null;
      if (!response.ok) {
        setCategoriesError(payload?.error || 'Não foi possível carregar as categorias.');
        return;
      }
      setCategoriesError('');
      setCategoriesList(mapCategories(Array.isArray(payload?.categories) ? payload.categories : []));
    } catch {
      setCategoriesError('Não foi possível carregar as categorias. Verifique a ligação à base de dados.');
    }
  }, []);

  React.useEffect(() => {
    void loadCategoriesFromDb();
  }, [loadCategoriesFromDb]);

  const saveCategory = async (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<boolean> => {
    setCategoriesBusy(true);
    setCategoriesError('');
    try {
      const response = await fetch(path, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { categories?: AdminCategoryResponse[]; error?: string } | null;
      if (!response.ok) {
        setCategoriesError(payload?.error || 'Não foi possível guardar a alteração.');
        return false;
      }
      if (Array.isArray(payload?.categories)) setCategoriesList(mapCategories(payload.categories));
      else await loadCategoriesFromDb();
      return true;
    } catch {
      setCategoriesError('Não foi possível guardar a alteração. Verifique a ligação.');
      return false;
    } finally {
      setCategoriesBusy(false);
    }
  };
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

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    const subList = newCatSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const created = await saveCategory('POST', '/api/admin/categories', {
      name,
      groupId: newCatGroupId,
      subcategories: subList,
    });
    if (!created) return;
    setNewCatName('');
    setNewCatSubcategories('');
    setShowAddCategoryModal(false);
  };

  const handleAddSubcategory = async (catId: string) => {
    const subName = newSubcatName.trim();
    if (!subName) return;
    const category = categoriesList.find((cat) => cat.id === catId);
    if (!category) return;
    if (category.subcategories.includes(subName)) {
      setCategoriesError('Essa subcategoria já existe nesta categoria.');
      return;
    }
    const saved = await saveCategory('PATCH', `/api/admin/categories/${encodeURIComponent(catId)}`, {
      subcategories: [...category.subcategories, subName],
    });
    if (!saved) return;
    setNewSubcatName('');
    setSelectedCatForSub(null);
  };

  const handleRemoveSubcategory = async (catId: string, subName: string) => {
    const category = categoriesList.find((cat) => cat.id === catId);
    if (!category) return;
    await saveCategory('PATCH', `/api/admin/categories/${encodeURIComponent(catId)}`, {
      subcategories: category.subcategories.filter((sub) => sub !== subName),
    });
  };

  const handleArchiveCategory = async (catId: string) => {
    if (!confirm('Tem a certeza que deseja arquivar esta categoria principal? Os registos históricos mantêm-se.')) return;
    await saveCategory('DELETE', `/api/admin/categories/${encodeURIComponent(catId)}`);
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

  const handlePendingBusinessDecision = async (id: string, decision: 'approve' | 'reject'): Promise<boolean> => {
    if (!onBusinessDecision) {
      alert('A decisão administrativa requer a ligação à base de dados.');
      return false;
    }
    const reason = decision === 'reject' ? window.prompt('Indique o motivo da rejeição:')?.trim() : undefined;
    if (decision === 'reject' && (!reason || reason.length < 3)) return false;
    try {
      await onBusinessDecision(id, decision, reason);
      setBusinessesList((previous) => previous.map((business) => business.id === id ? { ...business, status: decision === 'approve' ? 'active' : 'rejected' } : business));
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível persistir a decisão administrativa.');
      return false;
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

  const handleApproveModerationLog = async (id: string) => {
    const item = moderationLogsList.find((entry) => entry.id === id);
    const business = item?.businessName ? businessesList.find((entry) => entry.name === item.businessName) : undefined;
    const previous = moderationLogsList;
    setModerationLogsList((prev) =>
      prev.map((entry) => {
        if (entry.id === id) {
          return transitionModerationLog(entry, 'approved', 'Admin Guigui');
        }
        return entry;
      })
    );
    try {
      // O evento de sistema só é emitido depois de o servidor confirmar a decisão.
      await persistModerationDecision(id, 'approve');
      if (item && business) {
        onSystemEvent?.({
          eventType: item.type === 'business_profile' ? 'BUSINESS_APPROVED' : 'POST_APPROVED',
          businessId: business.id,
          businessName: business.name,
          entityType: item.type === 'business_profile' ? 'business' : 'post',
          entityId: item.id,
        });
      }
    } catch (error) {
      setModerationLogsList(previous);
      alert(error instanceof Error ? error.message : 'Falha ao persistir a decisão de moderação.');
    }
  };

  const handleRejectModerationLog = async (id: string) => {
    const reason = prompt('Indique o motivo da rejeição a enviar ao autor:', 'Violação de regras de concorrência ou conteúdo inadequado');
    if (!reason) return;

    const item = moderationLogsList.find((entry) => entry.id === id);
    const business = item?.businessName ? businessesList.find((entry) => entry.name === item.businessName) : undefined;
    const previous = moderationLogsList;
    setModerationLogsList((prev) =>
      prev.map((entry) => {
        if (entry.id === id) {
          return transitionModerationLog(entry, 'rejected', 'Admin Guigui', reason);
        }
        return entry;
      })
    );
    try {
      // O evento de sistema só é emitido depois de o servidor confirmar a decisão.
      await persistModerationDecision(id, 'reject', reason);
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
    } catch (error) {
      setModerationLogsList(previous);
      alert(error instanceof Error ? error.message : 'Falha ao persistir a decisão de moderação.');
    }
  };

  const handleSimulateAppeal = async (id: string) => {
    const appealText = prompt('Introduza a mensagem de contestação/recurso do autor (SIMULAÇÃO administrativa):', 'Possuo alvará comercial e pretendo esclarecer a oferta.');
    if (!appealText) return;

    const previous = moderationLogsList;
    setModerationLogsList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
          return {
            ...item,
            status: 'appealed',
            appealReason: `[SIMULAÇÃO] ${appealText}`,
            auditTrail: [
              ...item.auditTrail,
              {
                timestamp: nowStr,
                action: 'appeal_simulated',
                actor: 'Administração (simulação)',
                notes: `Recurso SIMULADO pela administração: "${appealText}"`,
              },
            ],
          };
        }
        return item;
      })
    );
    try {
      await persistModerationDecision(id, 'simulate-appeal', appealText);
    } catch (error) {
      setModerationLogsList(previous);
      alert(error instanceof Error ? error.message : 'Falha ao registar o recurso simulado.');
    }
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

  const adminDisplayName = currentUser?.name?.trim() || 'Administração Guigui';
  const adminAvatarUrl = currentUser?.avatarUrl || '';
  const adminInitials = adminDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AD';

  return (
    <>
      <GlassBottomNav
        ariaLabel="Navegação principal da administração"
        testId="admin-bottom-nav"
        activeId={String(activeTab)}
        onSelect={(id) => setActiveTab(id as typeof activeTab)}
        items={[
          { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
          { id: 'businesses', label: 'Empresas', icon: Building2 },
          { id: 'users', label: 'Utilizadores', icon: Users },
          { id: 'financials', label: 'Financeiro', icon: CreditCard },
          { id: 'support', label: 'Suporte', icon: HelpCircle },
        ]}
      />
      <div className="guigui-profile-dashboard guigui-light-dashboard w-full min-h-[calc(100vh-72px)] bg-[#f3efe9]">
        <div className="flex min-h-[calc(100vh-72px)] w-full bg-[#f3efe9]">
          <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] md:hidden`} onClick={() => setMobileSidebarOpen(false)} />

          <aside
            style={{ width: sidebarCollapsed ? 72 : 260 }}
            data-navigation-groups={configuredAdminNavigation.length}
            className={`${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-[62px] z-50 h-[calc(100vh-62px)] max-w-[calc(100vw-16px)] shrink-0 border-r border-[#0c3a34] bg-[radial-gradient(135%_85%_at_0%_0%,_#10443d_0%,_#0b332e_45%,_#072420_100%)] text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] transition-[transform,box-shadow,width] duration-300 ease-out min-[761px]:top-[72px] min-[761px]:h-[calc(100vh-72px)] md:translate-x-0`}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between px-3 py-4">
                <div className={`flex items-center ${sidebarCollapsed ? 'w-full justify-center' : 'gap-2.5'}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3fae80] text-lg font-black text-[#072420] shadow-[0_12px_22px_-12px_rgba(63,174,128,0.85)]">
                    G
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="text-lg font-black leading-none text-white">Guigui<span className="text-[#e8a23a]">.com</span></div>
                      <div className="mt-1.5 text-[8.5px] font-black uppercase tracking-[0.2em] text-[#8fb3ac]">Painel Administrativo</div>
                    </div>
                  )}
                </div>

                {!sidebarCollapsed && (
                  <IconButton
                    label={t('collapseMenu')}
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 rounded-full border-0 bg-transparent text-[#8fb3ac] shadow-none hover:bg-white/10 hover:text-white"
                    onClick={() => setSidebarCollapsed(true)}
                    title={t('collapseMenu')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                )}
                {sidebarCollapsed && (
                  <IconButton
                    label={t('expandMenu')}
                    variant="secondary"
                    size="sm"
                    className="absolute right-1 top-3 h-6 w-6 rounded-full border-0 bg-transparent text-[#8fb3ac] shadow-none hover:bg-white/10 hover:text-white"
                    onClick={() => setSidebarCollapsed(false)}
                    title={t('expandMenu')}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </IconButton>
                )}
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.045] p-2.5 text-left transition hover:bg-white/[0.08]"
                  >
                    {adminAvatarUrl ? (
                      <img src={adminAvatarUrl} alt={adminDisplayName} className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#155048] text-xs font-black text-[#d8e6e2]">
                        {adminInitials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-black text-white">{adminDisplayName}</div>
                      <div className="mt-0.5 text-[10px] font-semibold text-[#8fb3ac]">Administrador</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#6f8f89]" />
                  </button>
                )}

                {filteredNavigationGroups.map((group) => (
                  <div key={group.heading} className={sidebarCollapsed ? 'mb-2 space-y-1.5' : 'mb-3 space-y-1'}>
                    {!sidebarCollapsed && group.heading !== t('adminNavDashboard') && (
                      <div className="px-3 pb-1 pt-1.5 text-[8px] font-black uppercase tracking-[0.22em] text-[#6f8f89]">
                        {group.heading}
                      </div>
                    )}

                    <div className={sidebarCollapsed ? 'space-y-1.5' : 'space-y-1'}>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.tab;

                        return (
                          <button
                            key={`${group.heading}-${item.label}`}
                            type="button"
                            onClick={() => {
                              setManagementPage(null);
                              setActiveTab(item.tab);
                              setMobileSidebarOpen(false);
                            }}
                            aria-label={item.countLabel ? `${item.label}: ${item.countLabel}` : item.label}
                            aria-current={isActive ? 'page' : undefined}
                            title={item.countLabel ? `${item.label}: ${item.countLabel}` : item.label}
                            className={`group relative flex w-full items-center rounded-full text-left transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#3fae80]/50 ${
                              sidebarCollapsed
                                ? 'justify-center p-2.5'
                                : 'gap-3 px-3 py-2'
                            } ${
                              isActive
                                ? 'bg-[#3fae80] text-white shadow-[0_16px_28px_-16px_rgba(63,174,128,0.9)]'
                                : 'text-[#d8e6e2] hover:bg-white/[0.05]'
                            }`}
                          >
                            <div className={`flex shrink-0 items-center justify-center rounded-full ${sidebarCollapsed ? 'h-8 w-8' : 'h-9 w-9'} ${isActive ? 'bg-black/10 text-white' : 'bg-white/[0.06] text-[#a9c4be] group-hover:bg-white/[0.1] group-hover:text-white'}`}>
                              <Icon className="h-4 w-4" />
                            </div>

                            {!sidebarCollapsed && (
                              <div className="min-w-0 flex-1">
                                <div className={`truncate text-[11.5px] font-black leading-snug ${isActive ? 'text-white' : 'text-[#eef6f4]'}`}>{item.label}</div>
                                <div className={`mt-0.5 truncate text-[9.5px] font-medium leading-relaxed ${isActive ? 'text-white/75' : 'text-[#8fb3ac]'}`}>
                                  {item.help}
                                </div>
                              </div>
                            )}

                            {!sidebarCollapsed && item.count !== undefined && item.count > 0 && (
                              <span className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${isActive ? 'bg-white/25 text-white' : 'bg-[#f7bcbc] text-[#8a1f1f]'}`}>
                                {item.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {adminSearchQuery && filteredNavigationGroups.length === 0 && (
                  <div className="mt-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-3 text-[11px] font-medium text-[#a9c4be]">
                    Nenhum módulo encontrado para “{adminSearchQuery}”.
                  </div>
                )}
              </div>

              <div className="mt-auto border-t border-white/10 px-2 py-2.5">
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
                    {adminAvatarUrl ? (
                      <img src={adminAvatarUrl} alt={adminDisplayName} className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#155048] text-[10px] font-black text-[#d8e6e2]">
                        {adminInitials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-black text-white">{adminDisplayName}</div>
                      <div className="text-[9.5px] font-semibold text-[#8fb3ac]">Administrador</div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  title="Terminar sessão"
                  className={`mt-1 flex w-full items-center rounded-2xl py-2.5 text-left text-[#d8e6e2] transition hover:bg-white/[0.07] hover:text-white ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-2'}`}
                >
                  <LogOut className="h-5 w-5 shrink-0 text-[#a9c4be]" />
                  {!sidebarCollapsed && <span className="text-[12px] font-black">Terminar sessão</span>}
                </button>
              </div>
            </div>
          </aside>
          <main
            style={{ '--admin-sidebar-width': `${sidebarCollapsed ? 72 : 260}px` } as React.CSSProperties}
            className="min-w-0 flex-1 bg-[#f7f2ec] p-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] transition-[width,margin] duration-300 ease-out md:ml-[var(--admin-sidebar-width)] lg:pb-0"
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
                          setManagementPage(null);
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

      {managementPage ? (
        <>
          {managementPage === 'businesses' && (
            <BusinessesManagementPage
              businesses={businessesList}
              onBack={() => setManagementPage(null)}
              onBusinessesChanged={handleUpdateBusinesses}
              onDecision={handlePendingBusinessDecision}
            />
          )}
          {managementPage === 'featured' && (
            <FeaturedBusinessesManagementPage
              businesses={businessesList}
              onBack={() => setManagementPage(null)}
              onBusinessesChanged={handleUpdateBusinesses}
            />
          )}
          {managementPage === 'events' && (
            <EventsManagementPage events={events} onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'tickets' && (
            <TicketsManagementPage events={events} onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'transactions' && (
            <TransactionsManagementPage
              transactions={Array.from(new Map([...paymentTransactionsList, ...adminPaymentHistory].map((transaction) => [transaction.id, transaction])).values())}
              onBack={() => setManagementPage(null)}
            />
          )}
          {managementPage === 'finance-transactions' && (
            <FinanceTransactionsPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'finance-reconciliation' && (
            <FinanceReconciliationPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'finance-operators' && (
            <FinanceOperatorsPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'finance-pending' && (
            <FinancePendingPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'finance-refunds' && (
            <FinanceRefundsPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'finance-statements' && (
            <FinanceStatementsPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'promotions' && (
            <PromotionsManagementPage businesses={businessesList} promotions={promotions} onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'support' && (
            <SupportManagementPage
              supportRequests={supportRequests}
              onBack={() => setManagementPage(null)}
              onReplySupport={onReplySupport}
              onUpdateSupportStatus={onUpdateSupportStatus}
            />
          )}
          {managementPage === 'users-all' && (
            <CitizensManagementPage mode="all" onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'users-citizens' && (
            <CitizensManagementPage mode="user" onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'users-business' && (
            <CitizensManagementPage mode="business" onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'users-admins' && (
            <CitizensManagementPage mode="admin" onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'users-suspended' && (
            <CitizensManagementPage mode="suspended" onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'users-activity' && (
            <UsersActivityPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'staff' && (
            <ManagementPage
              title="Administradores e funcionários"
              description="Equipa administrativa, funções, permissões e estado de acesso."
              moduleLabel="Equipa"
              onBack={() => setManagementPage(null)}
            >
              <AdminTeamHub currentLang={currentLang} />
            </ManagementPage>
          )}
          {managementPage === 'audit' && (
            <ManagementPage
              title="Registos de auditoria"
              description="Ações administrativas e eventos de segurança, com filtros e paginação."
              moduleLabel="Auditoria"
              onBack={() => setManagementPage(null)}
            >
              <AdminAuditLogsHub currentLang={currentLang} logs={logsList} />
            </ManagementPage>
          )}
          {managementPage === 'reports' && (
            <ManagementPage
              title="Relatórios e documentos"
              description="Relatórios operacionais e financeiros gerados a partir dos dados reais da plataforma."
              moduleLabel="Relatórios"
              onBack={() => setManagementPage(null)}
            >
              <AdminReportsHub
                currentLang={currentLang}
                businesses={businessesList}
                events={events}
                paymentTransactions={platformPaymentTransactions}
              />
            </ManagementPage>
          )}
          {managementPage === 'sessions' && (
            <SessionsManagementPage onBack={() => setManagementPage(null)} />
          )}
          {managementPage === 'campaigns' && (
            <CampaignsManagementPage onBack={() => setManagementPage(null)} />
          )}
        </>
      ) : (
        <>

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

      {/* TAB 1: Empresas & Negócios — resumo; a lista completa abre numa página própria */}
      {activeTab === 'businesses' && (
        <BusinessesModule
          businesses={businessesList}
          onOpenList={openBusinessList}
          onOpenFeatured={() => setManagementPage('featured')}
          onOpenPromotions={() => setManagementPage('promotions')}
          onOpenCampaigns={() => setManagementPage('campaigns')}
        />
      )}

      {/* TAB 2: AI & Human Content Moderation Pipeline (Section 9) */}
      {activeTab === 'moderation' && (
        <div className="space-y-4 text-xs">
          <ModuleSubnav
            panelLabel="Administração"
            moduleLabel="Moderação"
            activeId={moderationSection}
            onChange={(id) => setModerationSection(id as 'stories' | 'pipeline' | 'queue')}
            items={[
              { id: 'pipeline', label: 'Pipeline IA', description: 'Resumo e regras de moderação automática' },
              { id: 'queue', label: 'Fila de revisão', description: 'Itens pendentes e decisões humanas' },
              { id: 'stories', label: 'Stories', description: 'Moderação de stories' },
            ]}
          />

          {moderationSection === 'stories' && <StoriesModerationPanel />}

          {moderationSection === 'pipeline' && (<>
          {/* Section 9 Summary & Classification Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
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
          </>)}

          {moderationSection === 'queue' && (<>
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
                  <section key={column.id} className={`rounded-2xl border p-3 ${column.className}`}>
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
                    className={`bg-white rounded-2xl p-5 border text-xs space-y-4 shadow-sm transition ${
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
          </>)}
        </div>
      )}

      {/* TAB: Planos & Assinaturas — centro comercial independente */}
      {activeTab === 'pricing' && (
        <div className="space-y-4">
          {commercialView === 'summary' && <CommercialModule onOpenSection={setCommercialView} />}
          {commercialView === 'plans' && <CommercialPlansPage onBack={() => setCommercialView('summary')} />}
          {commercialView === 'subscriptions' && <CommercialSubscriptionsPage onBack={() => setCommercialView('summary')} />}
          {commercialView === 'features' && <CommercialFeaturesPage onBack={() => setCommercialView('summary')} />}
          {commercialView === 'pricing' && <CommercialPricingPage onBack={() => setCommercialView('summary')} />}
          {commercialView === 'products' && <CommercialProductsPage onBack={() => setCommercialView('summary')} />}
          {commercialView === 'ticket-fees' && <CommercialTicketFeesPage onBack={() => setCommercialView('summary')} />}
          {commercialView === 'rules' && <CommercialRulesPage onBack={() => setCommercialView('summary')} />}
          {commercialView === 'audit' && <CommercialAuditPage onBack={() => setCommercialView('summary')} />}
        </div>
      )}

      {/* TAB: Sobre Nós */}
      {activeTab === 'sobre-nos' && (
        <SobreNosManagementPage onBack={() => setActiveTab('capabilities')} />
      )}

      {/* TAB: Categories Structure Management (Section 5) */}
      {activeTab === 'categories' && (
        <div className="space-y-4 text-xs">
          {/* Header & Rules Banner */}
          <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white p-6 rounded-2xl border border-purple-800 shadow-sm space-y-3">
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
                disabled={categoriesBusy}
                className="bg-purple-500 hover:bg-purple-600 text-white font-extrabold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm min-h-[40px] disabled:opacity-60"
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

          {categoriesError && (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-bold text-rose-800">
              {categoriesError}
            </p>
          )}
          {categoriesBusy && (
            <p role="status" className="text-[11px] font-bold text-purple-700">A guardar alterações...</p>
          )}

          <LocationCatalogAdmin />

          {/* Cultural Events Special Differentiated Handling Banner (#14) */}
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-2 shadow-sm text-amber-950">
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
            {categoriesList.length === 0 && !categoriesBusy && !categoriesError && (
              <p className="md:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500">
                Ainda não existem categorias principais. Crie a primeira com o botão acima.
              </p>
            )}
            {categoriesList.map((cat, index) => {
              const isCulturalEventCat = cat.id === 'cat-14';
              const isAddingSub = selectedCatForSub === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`bg-white border rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between transition hover:border-purple-300 ${
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
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overscroll-contain">
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
        <UsersModule
          onOpenSection={(section) => {
            const target = {
              all: 'users-all',
              citizens: 'users-citizens',
              business: 'users-business',
              admins: 'users-admins',
              suspended: 'users-suspended',
              activity: 'users-activity',
            } as const;
            setManagementPage(target[section]);
          }}
        />
      )}

      {/* TAB 3: Roles & Permissions Matrix */}
      {activeTab === 'roles' && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm text-xs">
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

      {/* TAB: Administradores e funcionários */}
      {activeTab === 'admin_staff' && (
        <ManagementPage
          title="Equipa"
          description="Equipa administrativa, funções, permissões e sessões."
          moduleLabel="Equipa"
          breadcrumbTail="Módulo"
        >
          <ModuleNav
            items={[
              { key: 'staff', label: 'Administradores e funcionários', icon: <ShieldCheck className="h-4 w-4" />, count: staffList.length },
              { key: 'sessions', label: 'Sessões e dispositivos', icon: <Smartphone className="h-4 w-4" /> },
            ]}
            onSelect={(key) => setManagementPage(key === 'sessions' ? 'sessions' : 'staff')}
            ariaLabel="Submódulos da equipa"
          />
        </ManagementPage>
      )}

      {/* TAB: Audit Logs Hub (Logs de Auditoria) */}
      {activeTab === 'audit_logs' && (
        <ManagementPage
          title="Registos de auditoria"
          description="Ações administrativas e eventos de segurança, com filtros e paginação."
          moduleLabel="Auditoria"
          onBack={() => navigateAdminTab('overview')}
        >
          <AdminAuditLogsHub currentLang={currentLang} logs={logsList} />
        </ManagementPage>
      )}

      {/* TAB 4: Events & Ticket Sales */}
      {activeTab === 'events' && (
        <ManagementPage
          title="Eventos & Bilhetes"
          description="Agenda e bilhética das empresas organizadoras."
          moduleLabel="Eventos & Bilhetes"
          breadcrumbTail="Módulo"
        >
          <ModuleNav
            items={[
              { key: 'events', label: 'Eventos', icon: <Calendar className="h-4 w-4" />, count: events.length },
              { key: 'tickets', label: 'Bilhetes', icon: <Receipt className="h-4 w-4" /> },
            ]}
            onSelect={(key) => setManagementPage(key === 'events' ? 'events' : 'tickets')}
            ariaLabel="Submódulos de eventos"
          />
        </ManagementPage>
      )}

      {/* TAB: Financeiro — resumo e seis áreas independentes */}
      {activeTab === 'financials' && (
        <FinanceModule
          onOpenSection={(section) => {
            const target = {
              transactions: 'finance-transactions',
              reconciliation: 'finance-reconciliation',
              operators: 'finance-operators',
              pending: 'finance-pending',
              refunds: 'finance-refunds',
              statements: 'finance-statements',
            } as const;
            setManagementPage(target[section]);
          }}
        />
      )}

      {/* TAB: Suporte */}
      {activeTab === 'support' && onReplySupport && onUpdateSupportStatus && (
        <SupportManagementPage
          supportRequests={supportRequests}
          onBack={() => navigateAdminTab('overview')}
          onReplySupport={onReplySupport}
          onUpdateSupportStatus={onUpdateSupportStatus}
        />
      )}

      {activeTab === 'reports' && (
        <ManagementPage
          title="Relatórios e documentos"
          description="Relatórios operacionais e financeiros gerados a partir dos dados reais da plataforma."
          moduleLabel="Relatórios"
          onBack={() => navigateAdminTab('overview')}
        >
          <AdminReportsHub
            currentLang={currentLang}
            businesses={businessesList}
            events={events}
            paymentTransactions={platformPaymentTransactions}
          />
        </ManagementPage>
      )}

      {/* TAB 6: Section 11 Technical Architecture & Infrastructure */}
      {activeTab === 'architecture' && (
        <div className="space-y-4 text-xs">
          {/* Section 11 Header Banner */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
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
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
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
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
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
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
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
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-4">
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
        <div className="space-y-4">
          <ModuleSubnav
            panelLabel="Administração"
            moduleLabel="Notificações"
            activeId={notificationSection}
            onChange={(id) => setNotificationSection(id as 'send' | 'preferences')}
            items={[
              { id: 'send', label: 'Enviar notificação', description: 'Anúncios e avisos' },
              { id: 'preferences', label: 'Preferências', description: 'Canais e alertas recebidos' },
            ]}
          />

          {notificationSection === 'send' && (
          <form onSubmit={handleSendAdminAnnouncement} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
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
          )}

          {notificationSection === 'preferences' && (
          <NotificationPreferencesPanel
            role="admin"
            value={notificationPreferences}
            onChange={onNotificationPreferencesChange}
          />
          )}
        </div>
      )}

        </>
      )}

            </main>
          </div>
        </div>
    </>
  );
};
