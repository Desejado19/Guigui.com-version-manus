/**
 * Guigui.com - Plataforma Digital de Divulgação Comercial e Cultural
 * Facebook-Inspired Social Feed & Marketplace Architecture
 */

import React, { lazy, Suspense, useCallback, useState } from 'react';
import {
  Language,
  UserRole,
  UserProfile,
  Business,
  Promotion,
  EventItem,
  Review,
  BusinessPost,
  Story,
  PurchaseOrder,
  EventReminder,
  ReminderTimeframe,
  AdminStaffMember,
  AuditLogEntry,
  AppNotification,
  NotificationEventType,
  NotificationPreferencesStore,
  Conversation,
  ConversationMessage,
  SupportRequest,
  SupportReply,
  SupportCategory,
  BusinessModelConfig,
  SubscriptionPlan,
  MonetizationCatalog,
} from './types';
import { INITIAL_STORIES } from './data/initialData';
import { INITIAL_ADMIN_STAFF } from './data/adminStaffData';
import { INITIAL_AUDIT_LOGS } from './data/auditLogsData';
import { INITIAL_NOTIFICATIONS } from './data/notificationsData';
import { motion, AnimatePresence } from 'motion/react';
import { resolveNotificationTarget, focusKeyForTarget, type NotificationTarget } from './utils/notificationTarget';
import { calculateBusinessRating } from './utils/reviews';
import { usePersistentState } from './utils/persistentState';
import { useMarketplaceData } from './hooks/useMarketplaceData';
import { addSubscriptionPeriod, getSubscriptionAccessState, getSubscriptionAlertCode, getSubscriptionAlertMessage } from './utils/subscriptions';
import { mergeStoredBusinessProfile } from './utils/businessProfile';
import { DEFAULT_SUBSCRIPTION_PLANS, getBusinessPlan, getBusinessUsage, limitAllows, normaliseSubscriptionPlans } from './data/subscriptionCatalog';
import { DEFAULT_MONETIZATION_CATALOG, consumeCredit, getActiveAdCampaigns, normaliseMonetizationCatalog } from './data/monetizationCatalog';
import { getFollowerIdsForBusiness, toggleFollowedBusiness } from './utils/followers';
import { getDefaultEntryTarget, scrollToPageTop, usePageEntryScroll } from './utils/navigationBehavior';
import { CitizenBottomNav } from './components/navigation';
import { detectLanguage, getTranslation } from './utils/i18n';
import {
  buildNotificationsForEvent,
  filterNotificationsForContext,
  getDefaultPreferences,
} from './services/notificationService';
import { syncCommunicationData, syncUserNotifications } from './services/communicationSync';
import { flagBusinessReview, replyBusinessReview, submitBusinessReview, syncBusinessReviews } from './services/reviewSync';
import { canSendConversationMessage, getRoleLandingTab, markOptimisticMessageStatus, mergeSyncedNotifications } from './utils/appCommunicationFlows';
import { startCommunicationPolling } from './utils/communicationPolling';

import { Navbar } from './components/Navbar';
import { LocationFilter, Panel, PanelHeader } from './components/ui';
import { PostEngagementProvider } from './components/PostEngagementProvider';
import { useLocationCatalog } from './hooks/useLocationCatalog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginModal } from './components/LoginModal';
import { StoriesBar } from './components/StoriesBar';
import { CreatePostBox } from './components/CreatePostBox';
import { FeedPostCard } from './components/FeedPostCard';
import { BusinessCard } from './components/BusinessCard';
import { BusinessDetailModal } from './components/BusinessDetailModal';
import { FeaturedHomepageBanner } from './components/FeaturedHomepageBanner';
import { PromotionsView } from './components/PromotionsView';
import { EventsView } from './components/EventsView';
import { TicketScannerView } from './components/TicketScannerView';
import type { BusinessDashboardTab } from './components/BusinessDashboard';
import { CommunicationHub } from './components/CommunicationHub';
import { InstitutionalPages } from './components/InstitutionalPages';
import { Footer } from './components/Footer';
import { BusinessComparisonModal } from './components/BusinessComparisonModal';
import { EventAlertsManager } from './components/EventAlertsManager';
import { SmsSimulatorToast } from './components/SmsSimulatorToast';

const APP_TAB_IDS = ['feed', 'directory', 'map', 'promotions', 'events', 'scanner', 'client', 'messages', 'support', 'admin', 'institutional'] as const;
const isAppTab = (value: string): value is typeof APP_TAB_IDS[number] => (APP_TAB_IDS as readonly string[]).includes(value);

const BusinessDashboard = lazy(() => import('./components/BusinessDashboard').then((module) => ({ default: module.BusinessDashboard })));
const CitizenDashboard = lazy(() => import('./components/CitizenDashboard').then((module) => ({ default: module.CitizenDashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));

import {
  Search,
  Store,
  Filter,
  Trophy,
  Sparkles,
  MapPin,
  User,
  Building2,
  ShieldCheck,
  ArrowRightLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ChevronDown,
  LayoutList,
  QrCode,
  Scale,
  Trash2,
  ArrowLeft,
  Home,
  Bell,
  X,
  ExternalLink,
} from 'lucide-react';

const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'ord-101',
    orderCode: 'LEV-8842',
    qrToken: 'GUI-QR-88421-BSS',
    businessId: 'biz-1',
    businessName: 'Supermercado Papagaio',
    buyerId: 'usr-1',
    customerName: 'Sene Biai',
    customerPhone: '+245 955 12 34 56',
    itemType: 'product',
    itemTitle: 'Cesto de Produtos Bissau Import',
    quantity: 1,
    totalPriceXOF: 15000,
    paymentMethod: 'orange_money',
    purchasedAt: '2026-08-18T14:30:00.000Z',
    status: 'pending',
  },
  {
    id: 'ord-102',
    orderCode: 'LEV-5519',
    qrToken: 'GUI-QR-55192-BSS',
    businessId: 'biz-1',
    businessName: 'Supermercado Papagaio',
    customerName: 'Fatoumata Djaló',
    customerPhone: '+245 966 88 77 66',
    itemType: 'promotion',
    itemTitle: 'Voucher 10% Desconto Compras > 20mil XOF',
    quantity: 1,
    totalPriceXOF: 0,
    paymentMethod: 'orange_money',
    purchasedAt: '2026-08-17T10:15:00.000Z',
    status: 'redeemed',
    redeemedAt: '2026-08-17T11:00:00.000Z',
  },
  {
    id: 'ord-103',
    orderCode: 'LEV-9931',
    qrToken: 'GUI-QR-99310-BSS',
    businessId: 'biz-1',
    businessName: 'Supermercado Papagaio',
    customerName: 'Braima Camará',
    customerPhone: '+245 955 44 33 22',
    itemType: 'product',
    itemTitle: 'Pack Família Óleo e Arroz Especial 25kg',
    quantity: 2,
    totalPriceXOF: 32000,
    paymentMethod: 'telecel',
    purchasedAt: '2026-08-16T16:45:00.000Z',
    status: 'redeemed',
    redeemedAt: '2026-08-16T18:20:00.000Z',
  },
  {
    id: 'ord-104',
    orderCode: 'LEV-7712',
    qrToken: 'GUI-QR-77123-BSS',
    businessId: 'biz-1',
    businessName: 'Supermercado Papagaio',
    customerName: 'Mariama Embaló',
    customerPhone: '+245 966 33 22 11',
    itemType: 'ticket',
    itemTitle: 'Passe VIP Feira Gastronómica Papagaio',
    quantity: 1,
    totalPriceXOF: 7500,
    paymentMethod: 'orange_money',
    purchasedAt: '2026-08-15T09:30:00.000Z',
    status: 'pending',
  },
  {
    id: 'ord-105',
    orderCode: 'LEV-4420',
    qrToken: 'GUI-QR-44208-BSS',
    businessId: 'biz-1',
    businessName: 'Supermercado Papagaio',
    customerName: 'Amadu Sanhá',
    customerPhone: '+245 955 88 99 00',
    itemType: 'service',
    itemTitle: 'Entrega Expresso ao Domicílio - Bissau Velho',
    quantity: 1,
    totalPriceXOF: 2500,
    paymentMethod: 'orange_money',
    purchasedAt: '2026-08-12T11:20:00.000Z',
    status: 'redeemed',
    redeemedAt: '2026-08-12T12:00:00.000Z',
  },
  {
    id: 'ord-106',
    orderCode: 'LEV-3318',
    qrToken: 'GUI-QR-33187-BSS',
    businessId: 'biz-1',
    businessName: 'Supermercado Papagaio',
    customerName: 'Carlos Gomes',
    customerPhone: '+245 966 55 44 33',
    itemType: 'product',
    itemTitle: 'Cabaz Alimentar Básico Guigui',
    quantity: 1,
    totalPriceXOF: 18000,
    paymentMethod: 'telecel',
    purchasedAt: '2026-08-08T15:00:00.000Z',
    status: 'cancelled',
  },
  {
    id: 'ord-107',
    orderCode: 'LEV-2204',
    qrToken: 'GUI-QR-22044-BSS',
    businessId: 'biz-1',
    businessName: 'Supermercado Papagaio',
    customerName: 'Aissatu Baldé',
    customerPhone: '+245 955 77 66 55',
    itemType: 'promotion',
    itemTitle: 'Voucher 15% Desconto em Frutas e Legumes',
    quantity: 1,
    totalPriceXOF: 0,
    paymentMethod: 'orange_money',
    purchasedAt: '2026-08-04T08:30:00.000Z',
    status: 'redeemed',
    redeemedAt: '2026-08-04T09:45:00.000Z',
  },
];

const generatedPurchaseTemplate = INITIAL_PURCHASE_ORDERS[0];
INITIAL_PURCHASE_ORDERS.push(...Array.from({ length: 13 }, (_, index): PurchaseOrder => ({
  ...generatedPurchaseTemplate,
  id: `ord-seed-${index + 8}`,
  orderCode: `GUI-${String(index + 8).padStart(4, '0')}`,
  qrToken: `GUI-QR-SEED-${index + 8}`,
  businessId: `biz-${(index % 14) + 7}`,
  businessName: `Empresa Guigui ${index + 1}`,
  buyerId: `usr-seed-${(index % 15) + 1}`,
  customerName: `Cliente Guigui ${index + 1}`,
  customerPhone: `+245 955 30 ${String(index + 1).padStart(2, '0')} ${String(index + 11).padStart(2, '0')}`,
  itemType: index % 2 === 0 ? 'product' : 'promotion',
  itemTitle: index % 2 === 0 ? `Compra demonstrativa ${index + 1}` : `Desconto demonstrativo ${index + 1}`,
  quantity: 1,
  totalPriceXOF: 5000 + index * 1000,
  purchasedAt: `2026-09-${String((index % 20) + 1).padStart(2, '0')}T10:00:00.000Z`,
  status: index % 3 === 0 ? 'pending' : 'redeemed',
})));

export default function App() {
  const [currentLang, setCurrentLang] = usePersistentState<Language>('guigui_current_lang', detectLanguage());
  // A área pública pode ser consultada sem autenticação; o login é pedido apenas para ações privadas.
  const [currentUser, setCurrentUser] = usePersistentState<UserProfile | null>('guigui_current_user', null);
  // A projeção local não é credencial: a barra inferior só mostra destinos privados
  // depois de `/api/auth/session` confirmar a sessão no servidor.
  type SessionGate = 'checking' | 'authenticated' | 'guest';
  const [sessionGate, setSessionGate] = useState<SessionGate>('checking');
  // Sincroniza a preferência de idioma com a conta do utilizador (persistente entre dispositivos).
  React.useEffect(() => {
    if (!currentUser) return;
    const storageKey = `user_language_${currentUser.id}`;
    let cancelled = false;
    void fetch(`/api/app-state/${storageKey}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { value?: { language?: Language } } | null) => {
        if (!cancelled && body?.value?.language && body.value.language !== currentLang) {
          setCurrentLang(body.value.language);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // Apenas ao autenticar: evita ping-pong quando o utilizador altera o idioma manualmente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);
  React.useEffect(() => {
    if (!currentUser) return;
    void fetch(`/api/app-state/user_language_${currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { language: currentLang, updatedAt: new Date().toISOString() } }),
    }).catch(() => undefined);
  }, [currentLang, currentUser]);
  // A área pública pode ser consultada sem autenticação; o login é pedido apenas para ações privadas.
  React.useEffect(() => {
    document.documentElement.lang = currentLang === 'pt' ? 'pt-BR' : currentLang;
    document.title = getTranslation(currentLang, 'appName');
  }, [currentLang]);
  React.useEffect(() => {
    let cancelled = false;
    const reconcileSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
        const body = response.ok
          ? (await response.json()) as { authenticated?: boolean } | null
          : null;
        if (cancelled) return;
        if (body?.authenticated) {
          setSessionGate('authenticated');
          return;
        }
        // Sessão ausente, expirada ou revogada: a barra inferior volta ao estado
        // de visitante e nenhuma área privada fica aberta.
        setSessionGate('guest');
        setCurrentRole('user');
        setCurrentTab((tab) =>
          ['client', 'messages', 'support', 'scanner', 'admin'].includes(tab) ? 'feed' : tab,
        );
      } catch {
        if (!cancelled) setSessionGate('guest');
      }
    };
    void reconcileSession();
    const revalidate = () => {
      if (document.visibilityState === 'visible') void reconcileSession();
    };
    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('focus', revalidate);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('focus', revalidate);
    };
    // Só no arranque: o login/logout actualizam o estado directamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [teamInviteToken, setTeamInviteToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('team_invite');
  });
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('user');
  const [currentTab, setCurrentTab] = useState<
    'feed' | 'directory' | 'map' | 'promotions' | 'events' | 'scanner' | 'client' | 'messages' | 'support' | 'admin' | 'institutional'
  >('feed');
  const [navigationStack, setNavigationStack] = useState<Array<typeof currentTab>>(['feed']);
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const [businessDashboardStartTab, setBusinessDashboardStartTab] = useState<BusinessDashboardTab>('overview');
  const [adminDashboardStartTab, setAdminDashboardStartTab] = useState<
    'capabilities' | 'profile' | 'overview' | 'businesses' | 'moderation' | 'pricing' | 'categories' | 'roles' | 'admin_staff' | 'audit_logs' | 'events' | 'financials' | 'architecture' | 'reports' | 'notifications' | 'support'
  >('overview');
  const [clientStartSection, setClientStartSection] = useState<'overview' | 'support' | 'tickets'>('overview');
  const [clientSidebarCollapsed, setClientSidebarCollapsed] = useState(false);
  const [businessSidebarCollapsed, setBusinessSidebarCollapsed] = useState(false);
  React.useEffect(() => {
    if (teamInviteToken) setShowLoginModal(true);
  }, [teamInviteToken]);
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(false);
  const [messageBusinessId, setMessageBusinessId] = useState<string | null>(null);

  usePageEntryScroll(currentTab);

  React.useEffect(() => {
    const storageKey = 'guigui_analytics_session';
    const sessionId = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, sessionId);
    const event = {
      eventName: 'page_view',
      source: 'web',
      appVersion: '2026.09',
      sessionId,
      context: { section: currentTab, language: currentLang },
    };
    void fetch('/api/product-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch((error: unknown) => console.warn('product-analytics-unavailable', error));
  }, [currentTab, currentLang]);

  const pushTabToHistory = React.useCallback((tab: typeof currentTab) => {
    setNavigationStack((previous) => {
      const last = previous[previous.length - 1];
      if (last === tab) return previous;
      return [...previous, tab];
    });
  }, []);

  const handleTabChange = (tab: typeof currentTab, clientSection: 'overview' | 'support' | 'tickets' = 'overview') => {
    // Notificações antigas podem trazer destinos que já não são ecrãs válidos
    // (ex.: `moderation`, `financials`): sem esta guarda o conteúdo ficava vazio.
    if (!isAppTab(tab)) {
      setCurrentTab('feed');
      pushTabToHistory('feed');
      return;
    }
    if (tab === 'admin' && currentUser?.role !== 'admin') {
      setCurrentTab('feed');
      pushTabToHistory('feed');
      return;
    }
    if (tab === 'admin' && currentUser?.role === 'admin') {
      setAdminDashboardStartTab('overview');
    }
    if (tab === 'messages' && currentUser?.role === 'admin') {
      setAdminDashboardStartTab('support');
      setCurrentTab('admin');
      pushTabToHistory('admin');
      return;
    }
    if (tab === 'support' && currentUser?.role === 'admin') {
      setAdminDashboardStartTab('support');
      setCurrentTab('admin');
      pushTabToHistory('admin');
      return;
    }
    if (tab === 'scanner' && currentUser?.role !== 'business') {
      setCurrentTab('feed');
      pushTabToHistory('feed');
      return;
    }
    if (tab === 'messages' && !currentUser) {
      handleRequireLogin('Inicie sessão para abrir a sua caixa de mensagens.');
      setCurrentTab('feed');
      pushTabToHistory('feed');
      return;
    }
    if (tab === 'support' && !currentUser) {
      handleRequireLogin('Inicie sessão para abrir o suporte.');
      setCurrentTab('feed');
      pushTabToHistory('feed');
      return;
    }
    if (tab === 'client' && currentUser?.role === 'admin') {
      setCurrentTab('admin');
      pushTabToHistory('admin');
      return;
    }
    if (tab === 'client' && currentUser?.role === 'business') {
      setBusinessDashboardStartTab('overview');
    }
    if (tab === 'client' && currentUser?.role === 'user') {
      setClientStartSection(clientSection);
      setMessageBusinessId(null);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
    pushTabToHistory(tab);
  };

  const handleGoBack = () => {
    if (currentTab === 'client' && currentUser?.role === 'business' && businessDashboardStartTab !== 'overview') {
      setBusinessDashboardStartTab('overview');
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    setNavigationStack((previous) => {
      if (previous.length <= 1) {
        setCurrentTab('feed');
        return ['feed'];
      }
      const nextStack = previous.slice(0, -1);
      setCurrentTab(nextStack[nextStack.length - 1] || 'feed');
      return nextStack;
    });
  };

  const handleGoToFeed = () => {
    setNavigationStack(['feed']);
    setCurrentTab('feed');
  };

  React.useEffect(() => {
    setCurrentRole(currentUser?.role || 'user');
  }, [currentUser]);

  React.useEffect(() => {
    const landingTab = getRoleLandingTab(currentUser?.role || null);
    if (landingTab === 'client') {
      setBusinessDashboardStartTab('overview');
      if (currentTab === 'feed') {
        setNavigationStack(['client']);
        setCurrentTab('client');
      }
    } else if (landingTab === 'admin') {
      setAdminDashboardStartTab('overview');
      if (currentTab === 'feed') {
        setNavigationStack(['admin']);
        setCurrentTab('admin');
      }
    }
  }, [currentUser?.id, currentUser?.role]);

  // Directory View Mode: Default HORIZONTAL list as explicitly requested by user
  const [directoryViewMode, setDirectoryViewMode] = useState<'horizontal' | 'grid'>('horizontal');

  // Global Light/Dark Theme Switcher (persisted in localStorage)
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>(() => {
    try {
      const stored = localStorage.getItem('guigui_theme_mode');
      if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
    } catch {
      // ignore invalid local storage data
    }
    return 'auto';
  });
  const theme = themeMode === 'auto'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;

  // Local Event Alerts & Scheduled Reminders State
  const [reminders, setReminders] = useState<EventReminder[]>(() => {
    try {
      const saved = localStorage.getItem('guigui_event_reminders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          return parsed.filter((reminder): reminder is EventReminder => {
            const eventTime = Date.parse(`${reminder.eventDate}T${reminder.eventTime || '20:00'}:00`);
            return Number.isFinite(eventTime) && eventTime > now;
          });
        }
      }
    } catch {
      // ignore invalid local data
    }
    return [];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('guigui_event_reminders', JSON.stringify(reminders));
    } catch {
      // ignore
    }
  }, [reminders]);

  // Admin Staff Members State (persisted)
  const [adminStaff, setAdminStaff] = useState<AdminStaffMember[]>(() => {
    try {
      const saved = localStorage.getItem('guigui_admin_staff');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map((staff) => ({
          ...staff,
          permissions: {
            ...staff.permissions,
            validateTickets: false,
          },
        }));
      }
    } catch {
      // ignore invalid local data
    }
    return INITIAL_ADMIN_STAFF;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('guigui_admin_staff', JSON.stringify(adminStaff));
    } catch {
      // ignore
    }
  }, [adminStaff]);

  // Audit Logs State (persisted). Ticket redemption logs stay in the business domain.
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('guigui_audit_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((log) => log?.category !== 'ticket_redemption');
        }
      }
    } catch {
      // ignore invalid local data
    }
    return INITIAL_AUDIT_LOGS.filter((log) => log.category !== 'ticket_redemption');
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('guigui_audit_logs', JSON.stringify(auditLogs));
    } catch {
      // ignore
    }
  }, [auditLogs]);

  // Centralized System Notifications State (persisted)
  const [systemNotifications, setSystemNotifications] = usePersistentState<AppNotification[]>('guigui_system_notifications', INITIAL_NOTIFICATIONS);
  const [notificationPreferences, setNotificationPreferences] = usePersistentState<NotificationPreferencesStore>('guigui_notification_preferences', {});
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [focusedConversationId, setFocusedConversationId] = useState<string | null>(null);
  const [focusedSupportId, setFocusedSupportId] = useState<string | null>(null);
  const [conversations, setConversations] = usePersistentState<Conversation[]>('guigui_conversations', []);
  const [conversationMessages, setConversationMessages] = usePersistentState<ConversationMessage[]>('guigui_conversation_messages', []);
  const [supportRequests, setSupportRequests] = usePersistentState<SupportRequest[]>('guigui_support_requests', []);
  const [followedBusinessIdsByUser, setFollowedBusinessIdsByUser] = usePersistentState<Record<string, string[]>>('guigui_followed_businesses', {});
  const [mutedFollowNotificationsByUser, setMutedFollowNotificationsByUser] = usePersistentState<Record<string, string[]>>('guigui_followed_business_notifications_muted', {});
  const resolveFollowers = React.useCallback((businessId: string) => {
    let followedMap = followedBusinessIdsByUser;
    try {
      const stored = localStorage.getItem('guigui_followed_businesses');
      const parsed = stored ? JSON.parse(stored) as Record<string, string[]> : null;
      if (parsed && typeof parsed === 'object') followedMap = parsed;
    } catch {
      // Usa o estado React quando o armazenamento não está disponível.
    }
    return getFollowerIdsForBusiness(followedMap, businessId);
  }, [followedBusinessIdsByUser]);

  /* Migração defensiva para instalações antigas que ainda guardavam o estado de notificações com useState. */
  const ensureNotificationPreferences = React.useCallback((role: UserRole, key?: string) => {
    const storeKey = key || role;
    setNotificationPreferences((previous) => previous[storeKey] ? previous : { ...previous, [storeKey]: getDefaultPreferences(role) });
  }, [setNotificationPreferences]);

  React.useEffect(() => {
    const role = currentUser?.role || 'user';
    setCurrentRole(role);
    ensureNotificationPreferences(role, currentUser?.id);
  }, [currentUser, ensureNotificationPreferences]);

  const notificationPreferenceKey = currentUser?.id || currentRole;
  const activeNotificationPreferences = notificationPreferences[notificationPreferenceKey] || getDefaultPreferences(currentRole);

  const visibleNotifications = React.useMemo(() => {
    const contextNotifications = filterNotificationsForContext(systemNotifications, {
      role: currentRole,
      userId: currentUser?.id,
      businessId: currentUser?.businessId,
    }, notificationPreferences);
    const mutedBusinessIds = currentUser?.role === 'user'
      ? new Set(mutedFollowNotificationsByUser[currentUser.id] || [])
      : new Set<string>();
    return contextNotifications.filter((notification) => {
      if (notification.category === 'messages') return false;
      if (notification.category !== 'followed_business') return true;
      const followedBusinessId = notification.metadata?.followedBusinessId;
      return !followedBusinessId || !mutedBusinessIds.has(String(followedBusinessId));
    });
  }, [systemNotifications, currentRole, currentUser?.id, currentUser?.businessId, currentUser?.role, notificationPreferences, mutedFollowNotificationsByUser]);

  const updateNotificationPreferences = (next: import('./types').NotificationPreferences) => {
    setNotificationPreferences((previous) => ({ ...previous, [notificationPreferenceKey]: next }));
  };

  const emitSystemEvent = React.useCallback((event: Parameters<typeof buildNotificationsForEvent>[0]) => {
    const generated = buildNotificationsForEvent(event);
    if (!generated.length) return;
    setSystemNotifications((previous) => [...generated, ...previous].slice(0, 250));
  }, [setSystemNotifications]);

  React.useEffect(() => {
    if (!currentUser || currentUser.role !== 'user') return;
    let cancelled = false;
    void syncUserNotifications(currentUser.id).then((result) => {
      if (cancelled || result.kind === 'updated' && !result.notifications.length) return;
      if (result.kind === 'unauthorized') {
        setCurrentUser(null);
        return;
      }
      setSystemNotifications((previous) => mergeSyncedNotifications(previous, result.notifications));
    }).catch((error: unknown) => console.error('notification-sync-failed', error));
    return () => { cancelled = true; };
  }, [currentUser, setSystemNotifications]);

  React.useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const refresh = () => void syncCommunicationData(currentUser.role).then((result) => {
      if (cancelled) return;
      if (result.kind === 'unauthorized') {
        setCurrentUser(null);
        return;
      }
      setConversations(result.conversations);
      setConversationMessages(result.messages);
      setSupportRequests(result.supportRequests);
    }).catch((error: unknown) => console.error('communication-sync-failed', error));
    refresh();
    const stopPolling = startCommunicationPolling(
      refresh,
      () => new EventSource('/api/conversations/events'),
    );
    return () => { cancelled = true; stopPolling(); };
  }, [currentUser, setConversations, setConversationMessages, setSupportRequests]);

  const handleMarkNotificationAsRead = (notifId: string) => {
    setSystemNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
    if (currentUser?.role === 'user') {
      void fetch(`/api/notifications/${encodeURIComponent(notifId)}/read`, { method: 'POST' }).catch((error: unknown) => {
        console.error('notification-read-sync-failed', error);
      });
    }
  };

  const handleMarkAllNotificationsAsRead = () => {
    const visibleIds = new Set(visibleNotifications.map((notification) => notification.id));
    setSystemNotifications((prev) => prev.map((n) => visibleIds.has(n.id) ? { ...n, read: true } : n));
    if (currentUser?.role === 'user') {
      visibleIds.forEach((notificationId) => {
        void fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' }).catch((error: unknown) => {
          console.error('notification-read-sync-failed', error);
        });
      });
    }
  };

  const handleClearNotifications = () => {
    const visibleIds = new Set(visibleNotifications.map((notification) => notification.id));
    setSystemNotifications((prev) => prev.filter((n) => !visibleIds.has(n.id)));
  };

  const businessTabForNotification = (kind: NotificationTarget['entity']['kind']): BusinessDashboardTab => {
    switch (kind) {
      case 'conversation':
        return 'communications';
      case 'support':
        return 'support';
      case 'order':
      case 'ticket':
      case 'payment':
      case 'refund':
        return 'tickets';
      case 'post':
        return 'posts';
      case 'event':
        return 'events';
      default:
        return 'overview';
    }
  };

  const handleOpenNotification = (notification: AppNotification) => {
    setSelectedNotification(null);
    handleMarkNotificationAsRead(notification.id);
    setSelectedNotification(notification);

    // Um só resolvedor decide o destino, para nenhuma notificação conseguir
    // levar o feed a um ecrã que não existe (o que deixava a página em branco).
    const target = resolveNotificationTarget(notification, currentUser?.role ?? 'user');
    const focusKey = focusKeyForTarget(target);
    setFocusedOrderId(focusKey === 'order' ? target.entity.id : null);
    setFocusedEventId(focusKey === 'event' ? target.entity.id : null);
    setFocusedPostId(focusKey === 'post' ? target.entity.id : null);
    setFocusedConversationId(focusKey === 'conversation' ? target.entity.id : null);
    setFocusedSupportId(focusKey === 'support' ? target.entity.id : null);

    if (currentUser?.role === 'admin' && target.adminTab) {
      setAdminDashboardStartTab(target.adminTab);
    }
    if (currentUser?.role === 'business' && target.tab === 'client') {
      setBusinessDashboardStartTab(businessTabForNotification(target.entity.kind));
    }
    handleTabChange(target.tab, target.clientSection);
  };

  const handleCreateConversation = async (businessId: string, subject: string, text: string): Promise<string | void> => {
    if (!currentUser || currentUser.role !== 'user') return;
    const existing = conversations.find((conversation) =>
      conversation.userId === currentUser.id && conversation.businessId === businessId,
    );
    if (existing) {
      if (text.trim()) handleSendConversationMessage(existing.id, text);
      setFocusedConversationId(existing.id);
      handleTabChange('messages');
      return existing.id;
    }
    const now = new Date().toISOString();
    let conversationId: string | null = null;
    try {
      const response = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, subject, text }) });
      const payload = await response.json().catch(() => ({})) as { id?: string };
      if (!response.ok || !payload.id) {
        console.error('conversation-create-sync-rejected', response.status);
        return;
      }
      conversationId = String(payload.id);
    } catch (error) {
      console.error('conversation-create-sync-failed', error);
      return;
    }
    if (!conversationId) return;
    const business = businesses.find((candidate) => candidate.id === businessId);
    const conversation: Conversation = { id: conversationId, userId: currentUser.id, userName: currentUser.name, businessId, businessName: business?.name, subject, lastMessage: text, createdAt: now, updatedAt: now, unreadForUser: false, unreadForBusiness: true };
    const message: ConversationMessage = { id: `message-${Date.now()}`, conversationId, senderId: currentUser.id, senderRole: 'user', senderName: currentUser.name, text, createdAt: now, readByUser: true, readByBusiness: false };
    setConversations((previous) => [conversation, ...previous.filter((candidate) => candidate.id !== conversationId)]);
    setConversationMessages((previous) => [...previous.filter((candidate) => candidate.id !== message.id), message]);
    emitSystemEvent({
      eventType: 'NEW_MESSAGE',
      userId: currentUser.id,
      businessId,
      businessName: business?.name,
      message: text,
      entityType: 'conversation',
      entityId: conversationId,
      metadata: {
        conversationId,
        recipientBusinessId: businessId,
        subject,
      },
    });
    setFocusedConversationId(conversationId);
    return conversationId;
  };

  const handleSendConversationMessage = (conversationId: string, text: string, options?: { replyToId?: string }) => {
    if (!currentUser || (currentUser.role !== 'user' && currentUser.role !== 'business')) return;
    const conversation = conversations.find((candidate) => candidate.id === conversationId);
    if (!conversation) return;
    if (!canSendConversationMessage(currentUser, conversation)) return;
    const isUserSender = currentUser.role === 'user' && conversation.userId === currentUser.id;
    const isBusinessSender = currentUser.role === 'business' && conversation.businessId === currentUser.businessId;
    const now = new Date().toISOString();
    const senderName = currentUser.name;
    const clientMessageId = `client-${currentUser.id}-${Date.now()}`;
    const message: ConversationMessage = { id: `message-${Date.now()}`, clientMessageId, conversationId, senderId: currentUser.id, senderRole: currentUser.role, senderName, text, createdAt: now, readByUser: isUserSender, readByBusiness: isBusinessSender, status: 'sending', replyToId: options?.replyToId };
    void fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': clientMessageId }, body: JSON.stringify({ text, replyToId: options?.replyToId, clientMessageId }) }).then((response) => {
      setConversationMessages((previous) => markOptimisticMessageStatus(previous, clientMessageId, response.ok ? 'sent' : 'failed'));
    }).catch((error: unknown) => {
      console.error('conversation-message-sync-failed', error);
      setConversationMessages((previous) => markOptimisticMessageStatus(previous, clientMessageId, 'failed'));
    });
    setConversationMessages((previous) => [...previous.filter((item) => item.clientMessageId !== clientMessageId), message]);
    setConversations((previous) => previous.map((candidate) => candidate.id === conversationId ? { ...candidate, lastMessage: text, updatedAt: now, unreadForUser: !isUserSender, unreadForBusiness: !isBusinessSender } : candidate));
    emitSystemEvent({
      eventType: 'NEW_MESSAGE',
      userId: conversation.userId,
      businessId: conversation.businessId,
      businessName: conversation.businessName,
      message: text,
      entityType: 'conversation',
      entityId: conversationId,
      metadata: {
        conversationId,
        recipientUserId: isBusinessSender ? conversation.userId : undefined,
        recipientBusinessId: isUserSender ? conversation.businessId : undefined,
        subject: conversation.subject,
      },
    });
  };

  const handleCreateSupport = async (subject: string, description: string, _businessId?: string, category: SupportCategory = 'technical'): Promise<string | void> => {
    if (!currentUser || (currentUser.role !== 'user' && currentUser.role !== 'business')) return;
    const now = new Date().toISOString();
    const businessId = currentUser.role === 'business' ? currentUser.businessId : undefined;
    const business = businessId ? businesses.find((candidate) => candidate.id === businessId) : undefined;
    let persistedRequestId: string | null = null;
    try {
      const response = await fetch('/api/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, description, category }) });
      const payload = await response.json().catch(() => ({})) as { ticket?: { id?: string } };
      if (!response.ok || !payload.ticket?.id) {
        console.error('support-create-sync-rejected', response.status);
        return;
      }
      persistedRequestId = String(payload.ticket.id);
    } catch (error) {
      console.error('support-create-sync-failed', error);
      return;
    }
    if (!persistedRequestId) return;
    const request: SupportRequest = { id: persistedRequestId, requesterId: currentUser.id, requesterRole: currentUser.role, businessId, subject, description, category, status: 'open', createdAt: now, updatedAt: now, replies: [] };
    setSupportRequests((previous) => [{ ...request, id: persistedRequestId }, ...previous.filter((candidate) => candidate.id !== persistedRequestId)]);
    emitSystemEvent({ eventType: 'NEW_SUPPORT_REQUEST', userId: currentUser.role === 'user' ? currentUser.id : undefined, userName: currentUser.role === 'user' ? currentUser.name : undefined, requesterName: currentUser.name, businessId, businessName: business?.name || currentUser.businessName, message: description, entityType: 'support', entityId: persistedRequestId, metadata: { supportId: persistedRequestId, requesterRole: currentUser.role, subject, targetRole: 'admin' } });
    return persistedRequestId;
  };

  const handleReplySupport = (requestId: string, text: string) => {
    if (!currentUser || (currentUser.role !== 'user' && currentUser.role !== 'business' && currentUser.role !== 'admin')) return;
    const request = supportRequests.find((candidate) => candidate.id === requestId);
    if (!request) return;
    const canReply = currentUser.role === 'admin'
      || (currentUser.role === 'business' && request.requesterRole === 'business' && request.businessId === currentUser.businessId)
      || (currentUser.role === 'user' && request.requesterId === currentUser.id);
    if (!canReply) return;
    const now = new Date().toISOString();
    const reply: SupportReply = { id: `support-reply-${Date.now()}`, senderId: currentUser.id, senderRole: currentUser.role, text, createdAt: now };
    void fetch(`/api/support/tickets/${encodeURIComponent(requestId)}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).then((response) => {
      if (!response.ok) {
        setSupportRequests((previous) => previous.map((candidate) => candidate.id === requestId ? request : candidate));
        console.error('support-reply-sync-rejected', response.status);
      }
    }).catch((error: unknown) => {
      setSupportRequests((previous) => previous.map((candidate) => candidate.id === requestId ? request : candidate));
      console.error('support-reply-sync-failed', error);
    });
    setSupportRequests((previous) => previous.map((candidate) => candidate.id === requestId ? { ...candidate, lastReply: text, replies: [...(candidate.replies || []), reply], status: currentUser.role === 'admin' ? 'in_progress' : candidate.status, updatedAt: now } : candidate));
    const recipientUserId = currentUser.role === 'admin' && request.requesterRole === 'user' ? request.requesterId : currentUser.role === 'business' ? request.requesterId : undefined;
    const recipientBusinessId = currentUser.role === 'admin' && request.requesterRole === 'business' ? request.businessId : currentUser.role === 'user' ? request.businessId : undefined;
    emitSystemEvent({ eventType: 'SUPPORT_REPLY', userId: request.requesterId, businessId: request.businessId, message: text, entityType: 'support', entityId: request.id, metadata: { supportId: request.id, recipientUserId, recipientBusinessId, subject: request.subject } });
  };

  const handleUpdateSupportStatus = (requestId: string, status: SupportRequest['status']) => {
    if (currentUser?.role !== 'admin') return;
    const previousRequest = supportRequests.find((request) => request.id === requestId);
    setSupportRequests((previous) => previous.map((request) => request.id === requestId ? { ...request, status, updatedAt: new Date().toISOString() } : request));
    void fetch(`/api/support/tickets/${encodeURIComponent(requestId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then((response) => {
      if (!response.ok && previousRequest) {
        setSupportRequests((previous) => previous.map((request) => request.id === requestId ? previousRequest : request));
        console.error('support-status-sync-rejected', response.status);
      }
    }).catch((error: unknown) => {
      if (previousRequest) setSupportRequests((previous) => previous.map((request) => request.id === requestId ? previousRequest : request));
      console.error('support-status-sync-failed', error);
    });
  };

  const handleMarkConversationRead = (conversationId: string) => {
    if (!currentUser) return;
    setConversations((previous) => previous.map((conversation) => conversation.id === conversationId
      ? currentUser.role === 'business' ? { ...conversation, unreadForBusiness: false } : { ...conversation, unreadForUser: false }
      : conversation));
    setConversationMessages((previous) => previous.map((message) => message.conversationId === conversationId
      ? currentUser.role === 'business' ? { ...message, readByBusiness: true, status: 'read' as const } : { ...message, readByUser: true, status: 'read' as const }
      : message));
    void fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST' }).catch((error: unknown) => console.error('conversation-read-sync-failed', error));
  };

  const handleToggleReminder = (event: EventItem, timeframe: ReminderTimeframe = '24h_before') => {
    if (!currentUser) {
      handleRequireLogin('Inicie sessão ou crie uma conta para guardar lembretes de eventos.');
      return;
    }
    if (currentUser.role === 'admin') {
      return;
    }
    setReminders((prev) => {
      const exists = prev.find((r) => r.eventId === event.id);
      if (exists) {
        return prev.map((r) =>
          r.eventId === event.id ? { ...r, timeframe } : r
        );
      }
      const newRem: EventReminder = {
        id: `rem-${Date.now()}`,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        eventNeighborhood: event.neighborhood,
        eventCover: event.coverImage,
        organizerName: event.organizerName,
        timeframe,
        createdAt: new Date().toISOString(),
        notified: false,
        userPhone: currentUser?.phone || '+245 955 00 00',
      };
      return [newRem, ...prev];
    });
  };

  const handleRemoveReminder = (eventId: string) => {
    setReminders((prev) => prev.filter((r) => r.eventId !== eventId));
  };

  const handleTriggerTestAlert = (event: EventItem) => {
    handleToggleReminder(event, 'immediate_test');
    if (currentUser?.role === 'user') {
      emitSystemEvent({
        eventType: 'EVENT_REMINDER',
        userId: currentUser.id,
        userName: currentUser.name,
        eventId: event.id,
        eventTitle: event.title,
        entityType: 'event',
        entityId: event.id,
      });
    }
    try {
      localStorage.removeItem('guigui_dismissed_alert_toasts');
    } catch {
      // ignore
    }
  };

  // Business Comparison State (up to 3 businesses)
  const [comparedBusinessIds, setComparedBusinessIds] = useState<string[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const handleToggleCompareBusiness = (b: Business) => {
    if (!currentUser) {
      handleRequireLogin('Inicie sessão ou crie uma conta para comparar empresas.');
      return;
    }
    setComparedBusinessIds((prev) => {
      if (prev.includes(b.id)) {
        return prev.filter((id) => id !== b.id);
      }
      if (prev.length >= 3) {
        alert('Pode selecionar no máximo 3 empresas para comparação simultânea.');
        return prev;
      }
      return [...prev, b.id];
    });
  };

  const handleRemoveComparedBusiness = (id: string) => {
    setComparedBusinessIds((prev) => prev.filter((bId) => bId !== id));
  };

  React.useEffect(() => {
    try {
      localStorage.setItem('guigui_theme_mode', themeMode);
    } catch {
      // ignore invalid local data
    }
    const root = document.documentElement;
    root.lang = currentLang === 'pt' ? 'pt-BR' : currentLang;
    document.cookie = `guigui_lang=${currentLang}; path=/; max-age=31536000; samesite=lax`;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [currentLang, theme, themeMode]);

  const toggleTheme = (nextMode?: 'light' | 'dark' | 'auto') => {
    if (nextMode) {
      setThemeMode(nextMode);
      return;
    }
    setThemeMode((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'auto' : 'dark'));
  };

  // Purchase Orders & Redemption State
  const [purchaseOrders, setPurchaseOrders] = usePersistentState<PurchaseOrder[]>('guigui_purchase_orders', INITIAL_PURCHASE_ORDERS);

  React.useEffect(() => {
    if (!currentUser || currentUser.role !== 'user') return;
    let cancelled = false;
    const syncTickets = async () => {
      const response = await fetch('/api/tickets/mine');
      if (response.status === 401) {
        setCurrentUser(null);
        return;
      }
      if (!response.ok) throw new Error(`Não foi possível sincronizar bilhetes (${response.status}).`);
      const payload = await response.json() as { tickets?: Array<Record<string, unknown>> };
      if (cancelled || !Array.isArray(payload.tickets)) return;
      const serverOrders: PurchaseOrder[] = payload.tickets.map((ticket) => ({
        id: String(ticket.id),
        orderCode: String(ticket.ticketCode || ''),
        qrToken: String(ticket.qrToken || ''),
        businessId: String(ticket.businessId || 'biz-1'),
        businessName: String(ticket.eventTitle || ''),
        buyerId: currentUser.id,
        eventId: String(ticket.eventId || ''),
        ticketPin: '',
        customerName: String(ticket.buyerName || currentUser.name),
        customerPhone: String(ticket.buyerPhone || currentUser.phone),
        itemType: 'ticket',
        itemTitle: `${String(ticket.eventTitle || 'Evento')} (${String(ticket.ticketTypeName || 'Entrada Geral')})`,
        quantity: 1,
        totalPriceXOF: Number(ticket.priceXOF || 0),
        paymentMethod: String(ticket.paymentMethod || 'orange_money') as PurchaseOrder['paymentMethod'],
        purchasedAt: String(ticket.purchasedAt || new Date().toISOString()),
        status: ticket.status === 'used' ? 'redeemed' : ticket.status === 'cancelled' ? 'cancelled' : 'pending',
        ticketCredentials: [{ id: String(ticket.id), ticketCode: String(ticket.ticketCode || ''), qrToken: String(ticket.qrToken || '') }],
      }));
      setPurchaseOrders((previous) => {
        const byId = new Map<string, PurchaseOrder>();
        previous.forEach((order) => byId.set(order.id, order));
        serverOrders.forEach((order) => {
          const existing = byId.get(order.id);
          byId.set(order.id, existing ? { ...existing, ...order } : order);
        });
        return Array.from(byId.values()).sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
      });
    };
    void syncTickets().catch((error: unknown) => console.error('ticket-sync-failed', error));
    return () => { cancelled = true; };
  }, [currentUser, setPurchaseOrders]);

  const handleAddPurchaseOrder = (newOrder: PurchaseOrder) => {
    const ownedOrder = currentUser && newOrder.itemType === 'ticket' && !newOrder.buyerId
      ? { ...newOrder, buyerId: currentUser.id }
      : newOrder;
    setPurchaseOrders((prev) => [ownedOrder, ...prev]);
    if (currentUser) {
      if (ownedOrder.itemType === 'ticket') {
        emitSystemEvent({
          eventType: 'TICKET_PURCHASED',
          userId: currentUser.id,
          userName: currentUser.name,
          businessId: ownedOrder.businessId,
          businessName: ownedOrder.businessName,
          eventId: ownedOrder.eventId,
          eventTitle: ownedOrder.itemTitle,
          ticketId: ownedOrder.id,
          entityType: 'ticket',
          entityId: ownedOrder.id,
          metadata: { orderId: ownedOrder.id, orderCode: ownedOrder.orderCode, eventId: ownedOrder.eventId, ticketCode: ownedOrder.orderCode, qrToken: ownedOrder.qrToken, pinCode: ownedOrder.ticketPin, totalPriceXOF: ownedOrder.totalPriceXOF },
        });
      }
      if (ownedOrder.totalPriceXOF > 0) {
        emitSystemEvent({
          eventType: 'PAYMENT_CONFIRMED',
          userId: currentUser.id,
          userName: currentUser.name,
          businessId: ownedOrder.businessId,
          businessName: ownedOrder.businessName,
          eventId: ownedOrder.eventId,
          eventTitle: ownedOrder.itemTitle,
          message: ownedOrder.itemTitle,
          entityType: 'payment',
          entityId: ownedOrder.id,
          metadata: { orderId: ownedOrder.id, orderCode: ownedOrder.orderCode, eventId: ownedOrder.eventId, useCase: ownedOrder.itemType === 'ticket' ? 'event_tickets' : ownedOrder.itemType, totalPriceXOF: ownedOrder.totalPriceXOF },
        });
      }
    }
  };

  const handleValidatePurchaseOrder = (orderId: string, redeemedBy: string) => {
    setPurchaseOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        if (ord.status === 'redeemed') return ord;
        return {
          ...ord,
          status: 'redeemed' as const,
          redeemedAt: new Date().toISOString(),
          redeemedBy: redeemedBy || ord.redeemedBy || 'scanner',
        };
      })
    );
  };

  const handleRequireLogin = (notice?: string) => {
    if (notice) setLoginNotice(notice);
    setShowLoginModal(true);
  };

  const handleToggleBusinessFollow = (businessId: string) => {
    if (!currentUser || currentUser.role !== 'user') {
      handleRequireLogin('Inicie sessão como cidadão para seguir empresas e receber as suas novidades.');
      return;
    }
    const wasFollowed = (followedBusinessIdsByUser[currentUser.id] || []).includes(businessId);
    setFollowedBusinessIdsByUser((previous) => toggleFollowedBusiness(previous, currentUser.id, businessId));
    if (wasFollowed) {
      setMutedFollowNotificationsByUser((previous) => ({
        ...previous,
        [currentUser.id]: (previous[currentUser.id] || []).filter((id) => id !== businessId),
      }));
    }
  };

  const handleToggleBusinessNotifications = (businessId: string) => {
    if (!currentUser || currentUser.role !== 'user') {
      handleRequireLogin('Inicie sessão como cidadão para gerir o sino de uma empresa.');
      return;
    }
    const isFollowed = (followedBusinessIdsByUser[currentUser.id] || []).includes(businessId);
    if (!isFollowed) {
      handleToggleBusinessFollow(businessId);
      return;
    }
    setMutedFollowNotificationsByUser((previous) => {
      const muted = previous[currentUser.id] || [];
      const nextMuted = muted.includes(businessId) ? muted.filter((id) => id !== businessId) : [...muted, businessId];
      return { ...previous, [currentUser.id]: nextMuted };
    });
  };

  const handleOpenBusinessMessage = (businessId: string) => {
    if (!currentUser || currentUser.role !== 'user') {
      handleRequireLogin('Inicie sessão como cidadão para enviar uma mensagem ao estabelecimento.');
      return;
    }
    setSelectedBusiness(null);
    setMessageBusinessId(businessId);
    handleTabChange('messages');
  };

  const handlePromotionMessage = (promotion: Promotion) => {
    if (!currentUser || currentUser.role !== 'user') {
      handleRequireLogin('Inicie sessão como cidadão para falar com o estabelecimento sobre esta promoção.');
      return;
    }
    const promotionDetails = [
      `Promoção: ${promotion.title}`,
      `Oferta: ${promotion.discountBadge}`,
      `Estabelecimento: ${promotion.businessName}`,
      `Localização: ${promotion.neighborhood}`,
      `Validade: ${new Date(promotion.validUntil).toLocaleDateString('pt-PT')}`,
      promotion.code ? `Código: ${promotion.code}` : null,
    ].filter(Boolean).join('\\n');
    const text = `Olá! Tenho interesse nesta promoção e gostaria de confirmar a compra:\\n\\n${promotionDetails}\\n\\nPodem confirmar a disponibilidade e informar o que preciso fazer para levantar ou comprar?`;
    setSelectedBusiness(null);
    setMessageBusinessId(promotion.businessId);
    void handleCreateConversation(promotion.businessId, `Interesse na promoção: ${promotion.title}`, text);
  };

  const handleOpenMessages = () => {
    if (!currentUser) {
      handleRequireLogin('Inicie sessão para abrir a sua caixa de mensagens.');
      return;
    }
    setMessageBusinessId(null);
    handleTabChange('messages');
  };

  const handleOpenSupport = () => {
    if (!currentUser) {
      handleRequireLogin('Inicie sessão para abrir o suporte.');
      return;
    }
    handleTabChange('support');
  };

  const handleLogin = (user: UserProfile, registeredBusiness?: Partial<Business>) => {
    let normalizedUser = user;
    const businessId = user.role === 'business' ? (user.businessId || `biz-${user.id}`) : undefined;
    const isNewBusinessRegistration = user.role === 'business' && Boolean(businessId) && !businesses.some((business) => business.id === businessId);
    if (user.role === 'business' && businessId && isNewBusinessRegistration) {
      const businessName = user.businessName || user.name;
      normalizedUser = { ...user, businessId, businessName };
      setBusinesses((previous) => {
        if (previous.some((business) => business.id === businessId)) return previous;
        return [
          {
            id: businessId,
            name: registeredBusiness?.name || businessName,
            slug: registeredBusiness?.slug || businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            logo: registeredBusiness?.logo || '',
            coverImage: registeredBusiness?.coverImage || '',
            gallery: registeredBusiness?.gallery || [],
            description: registeredBusiness?.description || '',
            categoryId: registeredBusiness?.categoryId || '',
            subcategoryId: registeredBusiness?.subcategoryId || '',
            groupGroupId: registeredBusiness?.groupGroupId || 'corporativo_financeiro',
            publicEmail: registeredBusiness?.publicEmail,
            phone: registeredBusiness?.phone || '',
            whatsapp: registeredBusiness?.whatsapp || '',
            neighborhood: registeredBusiness?.neighborhood || '',
            address: registeredBusiness?.address || '',
            tier: registeredBusiness?.tier || 'basic',
            openingHours: registeredBusiness?.openingHours || '',
            isOpenNow: registeredBusiness?.isOpenNow || false,
            priceRange: registeredBusiness?.priceRange || '$$',
            status: registeredBusiness?.status || 'pending',
            verified: registeredBusiness?.verified || false,
            featured: registeredBusiness?.featured || false,
            ratingLabel: registeredBusiness?.ratingLabel || '',
            reviews: registeredBusiness?.reviews || [],
            reviewsCount: registeredBusiness?.reviewsCount || 0,
            posts: registeredBusiness?.posts || [],
            promotions: registeredBusiness?.promotions || [],
            metrics: registeredBusiness?.metrics || { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 },
            subscriptionRenewDate: registeredBusiness?.subscriptionRenewDate || new Date().toISOString(),
            postsQuotaRemaining: registeredBusiness?.postsQuotaRemaining || 3,
          } satisfies Business,
          ...previous,
        ];
      });
    }

    setCurrentUser(normalizedUser);
    setSessionGate('authenticated');
    setCurrentRole(normalizedUser.role);
    // Aplica o idioma preferido guardado na conta (ou o atual, se a conta ainda não o tiver).
    if (normalizedUser.preferredLanguage && normalizedUser.preferredLanguage !== currentLang) {
      setCurrentLang(normalizedUser.preferredLanguage);
    } else if (!normalizedUser.preferredLanguage) {
      normalizedUser = { ...normalizedUser, preferredLanguage: currentLang };
      setCurrentUser(normalizedUser);
    }
    setBusinessDashboardStartTab('overview');
    setFocusedOrderId(null);
    setFocusedEventId(null);
    setFocusedPostId(null);
    setFocusedConversationId(null);
    setFocusedSupportId(null);
    ensureNotificationPreferences(normalizedUser.role, normalizedUser.id);
    if (!systemNotifications.some((notification) => notification.eventType === 'WELCOME' && notification.targetUserId === normalizedUser.id)) {
      emitSystemEvent({ eventType: 'WELCOME', userId: normalizedUser.id, userName: normalizedUser.name, entityType: 'user', entityId: normalizedUser.id });
    }
    if (isNewBusinessRegistration && normalizedUser.businessId) {
      emitSystemEvent({
        eventType: 'BUSINESS_CREATED',
        userId: normalizedUser.id,
        userName: normalizedUser.name,
        businessId: normalizedUser.businessId,
        businessName: normalizedUser.businessName || normalizedUser.name,
        entityType: 'business',
        entityId: normalizedUser.businessId,
      });
    }
    setShowLoginModal(false);
    setTeamInviteToken(null);
    if (typeof window !== 'undefined') window.history.replaceState({}, '', window.location.pathname);
    setLoginNotice(null);

    // A entrada autenticada começa sempre no painel inicial do papel, sem herdar a navegação anterior.
    const entryProfile = normalizedUser.role === 'admin' ? 'admin' : normalizedUser.role === 'business' ? 'business' : 'citizen';
    const entryTab = getDefaultEntryTarget(entryProfile).route;
    setNavigationStack([entryTab]);
    setCurrentTab(entryTab);
    scrollToPageTop();

    // Redireciona automaticamente para a vista adequada conforme o perfil do utilizador
    if (normalizedUser.role === 'admin') {
      setAdminDashboardStartTab('overview');
    } else if (normalizedUser.role === 'business') {
      setBusinessDashboardStartTab('overview');
    }
  };

  const handleCitizenPasswordChange = async (currentPassword: string, newPassword: string) => {
    if (!currentUser?.email) throw new Error('A conta não possui um e-mail válido.');
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, currentPassword, newPassword }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível atualizar a palavra-passe.');
    setCurrentUser((previous) => previous ? { ...previous, passwordChangedAt: new Date().toISOString() } : previous);
  };

  const handleLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setCurrentUser(null);
    setSessionGate('guest');
    setCurrentRole('user');
    setNavigationStack(['feed']);
    setCurrentTab('feed');
    scrollToPageTop();
    setLoginNotice(null);
    setShowLoginModal(true);
  };

  const handleCitizenDeactivateAccount = async () => {
    if (currentUser?.email) {
      const currentPassword = window.prompt('Confirme a sua palavra-passe atual para desativar a conta:');
      if (!currentPassword) return;
      const response = await fetch('/api/account/deactivate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: currentUser.email, currentPassword }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 404) throw new Error(payload.error || 'Não foi possível desativar a conta.');
    }
    setCurrentUser(null);
    setSessionGate('guest');
    setCurrentRole('user');
    setLoginNotice('A sua conta foi desactivada temporariamente. Para reativá-la, contacte o suporte.');
    setShowLoginModal(true);
  };

  const handleCitizenDeleteAccount = async () => {
    if (currentUser?.email) {
      const currentPassword = window.prompt('Confirme a sua palavra-passe atual para eliminar a conta:');
      if (!currentPassword) return;
      const response = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: currentUser.email, currentPassword }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 404) throw new Error(payload.error || 'Não foi possível eliminar a conta.');
    }
    setCurrentUser(null);
    setSessionGate('guest');
    setCurrentRole('user');
    setLoginNotice('A sua conta foi eliminada permanentemente.');
    setShowLoginModal(true);
  };

  // Directory & Social Feed State Data
  const {
    businesses,
    setBusinesses,
    categories: marketplaceCategories,
    events,
    setEvents,
    status: marketplaceStatus,
    error: marketplaceError,
  } = useMarketplaceData();
  React.useEffect(() => {
    let cancelled = false;
    const syncPublishedMarketing = async () => {
      try {
        const response = await fetch('/api/marketing/scheduled-items/public');
        if (!response.ok) return;
        const data = await response.json() as { items?: Array<{ itemType: string; itemId: string; businessId: string; status: string; publishedAt?: string }> };
        if (cancelled || !Array.isArray(data.items)) return;
        const publishedPosts = new Map(data.items.filter((item) => item.itemType === 'post').map((item) => [item.itemId, item]));
        const publishedPromotions = new Map(data.items.filter((item) => item.itemType === 'promotion').map((item) => [item.itemId, item]));
        setBusinesses((previous) => previous.map((business) => ({
          ...business,
          posts: business.posts.map((post) => {
            const schedule = publishedPosts.get(post.id);
            if (!schedule || schedule.businessId !== business.id) return post;
            return schedule.status === 'expired'
              ? { ...post, status: 'expired' }
              : { ...post, status: 'approved', publishedAt: schedule.publishedAt };
          }),
          promotions: business.promotions.map((promotion) => {
            const schedule = publishedPromotions.get(promotion.id);
            if (!schedule || schedule.businessId !== business.id) return promotion;
            return schedule.status === 'expired'
              ? { ...promotion, status: 'expired', isActive: false }
              : { ...promotion, status: 'active', isActive: true, activatedAt: schedule.publishedAt };
          }),
        })));
      } catch {
        // The local data remains the source of truth while the public sync is unavailable.
      }
    };
    void syncPublishedMarketing();
    const interval = window.setInterval(() => void syncPublishedMarketing(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [setBusinesses]);
  const { locations: bissauLocations } = useLocationCatalog();
  const [userPosts, setUserPosts] = usePersistentState<BusinessPost[]>('guigui_user_posts', []);
  const [promotions, setPromotions] = usePersistentState<Promotion[]>('guigui_promotions', []);
  const [stories, setStories] = usePersistentState<Story[]>('guigui_stories', INITIAL_STORIES as Story[]);
  const [subscriptionPlans] = usePersistentState<SubscriptionPlan[]>('guigui_subscription_plans', DEFAULT_SUBSCRIPTION_PLANS);

  React.useEffect(() => {
    const activeBusinessIds = new Set(
      businesses
        .filter((business) => getSubscriptionAccessState(business, new Date()) === 'active')
        .map((business) => business.id)
    );
    setSystemNotifications((previous) => {
      const next = previous.filter((notification) => {
        const isOldSubscriptionAlert = notification.targetBusinessId
          && activeBusinessIds.has(notification.targetBusinessId)
          && ['Plano expirado', 'Empresa suspensa', 'Lembrete de Assinatura'].includes(notification.title);
        return !isOldSubscriptionAlert;
      });
      return next.length === previous.length ? previous : next;
    });
  }, [businesses, setSystemNotifications]);

  React.useEffect(() => {
    const invalidImageUrl = 'https://images.unsplash.com/photo-1556742049-0a67e557b683?auto=format&fit=crop&w=800&q=80';
    const replacementImageUrl = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
    setUserPosts((previous) => previous.map((post) => post.imageUrl === invalidImageUrl ? { ...post, imageUrl: replacementImageUrl } : post));
    setBusinesses((previous) => previous.map((business) => ({
      ...business,
      posts: business.posts.map((post) => post.imageUrl === invalidImageUrl ? { ...post, imageUrl: replacementImageUrl } : post),
    })));
  }, [setBusinesses, setUserPosts]);
  const [monetizationCatalog, setMonetizationCatalog] = usePersistentState<MonetizationCatalog>('guigui_monetization_catalog', DEFAULT_MONETIZATION_CATALOG);
  const resolvedMonetizationCatalog = normaliseMonetizationCatalog(monetizationCatalog);
  const activeAdCampaigns = getActiveAdCampaigns(monetizationCatalog);

  const handleAdCampaignImpression = useCallback((campaignId: string) => {
    setMonetizationCatalog((previous) => ({
      ...previous,
      adCampaigns: (previous.adCampaigns || []).map((campaign) => campaign.id === campaignId
        ? { ...campaign, impressions: campaign.impressions + 1 }
        : campaign),
    }));
  }, [setMonetizationCatalog]);

  const handleAdCampaignClick = (campaignId: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    setMonetizationCatalog((previous) => ({ ...previous, adCampaigns: (previous.adCampaigns || []).map((campaign) => campaign.id === campaignId ? { ...campaign, clicks: campaign.clicks + 1 } : campaign) }));
    if (activeAdCampaigns.find((campaign) => campaign.id === campaignId)?.linkUrl === '#directory') {
      event.preventDefault();
      setCurrentTab('directory');
    }
  };

  const [subscriptionConfig] = usePersistentState<BusinessModelConfig>('guigui_admin_business_model_config', {
    ticketCommissionPercent: 10,
    ticketFixedFeeXOF: 200,
    extraPostPriceXOF: 5000,
    extraPromotionPriceXOF: 10000,
    bannerWeeklyPriceXOF: 50000,
    annualDiscountPercent: 15,
    includedPostsPerMonth: 3,
    automaticSubscriptionSuspensionEnabled: true,
  });

  React.useEffect(() => {
    if (businesses.length === 0) return;
    const now = new Date();
    let changed = false;
    const nextBusinesses = businesses.map((business) => {
      const accessState = getSubscriptionAccessState(business, now);
      const alertCode = getSubscriptionAlertCode(business.subscriptionRenewDate, now);
      const sentAlerts = business.subscriptionAlertKeys || [];
      let nextBusiness = business;

      if (accessState === 'expired') {
        if (business.subscriptionStatus !== 'expired' && business.subscriptionStatus !== 'suspended') {
          nextBusiness = { ...nextBusiness, subscriptionStatus: 'expired' };
          changed = true;
          emitSystemEvent({
            eventType: 'SUBSCRIPTION_EXPIRED',
            businessId: business.id,
            businessName: business.name,
            entityType: 'business',
            entityId: business.id,
            message: 'O período pago terminou. Pode consultar a sua conta, mas as acções comerciais ficam bloqueadas até à renovação.',
          });
        }
        if (subscriptionConfig.automaticSubscriptionSuspensionEnabled !== false && business.status !== 'suspended') {
          nextBusiness = {
            ...nextBusiness,
            status: 'suspended',
            subscriptionStatus: 'suspended',
            subscriptionSuspendedAt: now.toISOString(),
            subscriptionSuspensionReason: 'Expiração do período pago sem renovação.',
            subscriptionAutoSuspended: true,
          };
          changed = true;
          emitSystemEvent({
            eventType: 'SUBSCRIPTION_SUSPENDED',
            businessId: business.id,
            businessName: business.name,
            entityType: 'business',
            entityId: business.id,
            message: 'A suspensão automática por expiração foi aplicada. Renove o plano ou contacte a Administração.',
          });
        }
      }

      if (accessState === 'active' && alertCode && !sentAlerts.includes(alertCode)) {
        nextBusiness = {
          ...nextBusiness,
          subscriptionAlertKeys: [...sentAlerts, alertCode],
        };
        changed = true;
        emitSystemEvent({
          eventType: 'SUBSCRIPTION_EXPIRING',
          businessId: business.id,
          businessName: business.name,
          entityType: 'business',
          entityId: business.id,
          message: getSubscriptionAlertMessage(alertCode, business.subscriptionRenewDate),
          metadata: { alertCode, renewAt: business.subscriptionRenewDate, subscriptionPeriod: business.subscriptionPeriod || 'monthly' },
        });
      }
      return nextBusiness;
    });
    if (changed) setBusinesses(nextBusinesses);
  }, [businesses, emitSystemEvent, setBusinesses, subscriptionConfig.automaticSubscriptionSuspensionEnabled]);

  // Search & Neighborhood Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [directoryCategoryOpen, setDirectoryCategoryOpen] = useState(false);
  const directoryCategoryRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!directoryCategoryOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (directoryCategoryRef.current && !directoryCategoryRef.current.contains(event.target as Node)) {
        setDirectoryCategoryOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDirectoryCategoryOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [directoryCategoryOpen]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [onlyOpenNow, setOnlyOpenNow] = useState(false);
  const [directorySort, setDirectorySort] = useState<'relevance' | 'name' | 'rating' | 'recent'>('relevance');

  // Selected Business for Detail View Modal
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  React.useEffect(() => {
    const closeTransientOverlays = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedNotification) setSelectedNotification(null);
      else if (showComparisonModal) setShowComparisonModal(false);
      else if (selectedBusiness) setSelectedBusiness(null);
    };
    document.addEventListener('keydown', closeTransientOverlays);
    return () => document.removeEventListener('keydown', closeTransientOverlays);
  }, [selectedBusiness, selectedNotification, showComparisonModal]);

  // Flatten all posts from businesses AND system users (5 posts each)
  // Publicações das empresas: usa-se a localização guardada no post; os posts
  // antigos sem localização herdam o bairro da própria empresa.
  const allCompanyPosts = businesses.flatMap((b) =>
    b.posts.map((p) => ({
      ...p,
      businessLogo: p.businessLogo || b.logo,
      businessName: p.businessName || b.name,
      neighborhood: p.neighborhood || b.neighborhood,
    }))
  );

  const localPosts = [...userPosts, ...allCompanyPosts]
    .filter((p) => p.status === 'approved')
    .filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchContent = (p.content || '').toLowerCase().includes(q);
        const matchAuthor = (p.businessName || '').toLowerCase().includes(q);
        const matchNeigh = (p.neighborhood || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchAuthor && !matchNeigh) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // O feed é filtrado pelo backend, diretamente na base de dados. Enquanto a
  // resposta não chega (ou sem rede), mostra-se a lista já carregada.
  // Paginação: 30 publicações na primeira página e 20 de cada vez que o
  // utilizador chega às 5 últimas carregadas, até esgotar o feed.
  const FEED_FIRST_PAGE = 30;
  const FEED_NEXT_PAGE = 20;
  const FEED_PRELOAD_THRESHOLD = 5;
  const [serverFeedPosts, setServerFeedPosts] = React.useState<BusinessPost[] | null>(null);
  const [feedTotal, setFeedTotal] = React.useState<number | null>(null);
  const [feedHasMore, setFeedHasMore] = React.useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = React.useState(false);
  const [feedLoadError, setFeedLoadError] = React.useState<string | null>(null);
  const feedBaseQueryRef = React.useRef('');
  const feedSentinelRef = React.useRef<HTMLDivElement | null>(null);
  // Trava síncrona: o IntersectionObserver pode disparar outra vez antes de o
  // estado `feedLoadingMore` chegar ao próximo render.
  const feedLoadingRef = React.useRef(false);
  // Último pedido da primeira página (filtros + instante) para não repetir
  // pedidos idênticos quando várias colecções locais chegam no arranque.
  const feedFirstPageRef = React.useRef<{ query: string; at: number } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const baseParams = new URLSearchParams();
    if (selectedNeighborhood) baseParams.set('neighborhood', selectedNeighborhood);
    if (searchQuery.trim()) baseParams.set('q', searchQuery.trim());
    feedBaseQueryRef.current = baseParams.toString();
    const params = new URLSearchParams(baseParams);
    params.set('limit', String(FEED_FIRST_PAGE));
    params.set('offset', '0');
    setFeedLoadingMore(false);
    setFeedLoadError(null);
    feedLoadingRef.current = false;
    // Agrupa as actualizações que chegam juntas no arranque (publicações locais,
    // empresas, sessão) num único pedido da primeira página.
    const previous = feedFirstPageRef.current;
    if (previous && previous.query === params.toString() && Date.now() - previous.at < 2000) {
      return () => { cancelled = true; };
    }
    const timer = window.setTimeout(() => {
      // Só conta como pedido feito quando parte mesmo: no StrictMode o
      // primeiro agendamento é cancelado antes de disparar.
      feedFirstPageRef.current = { query: params.toString(), at: Date.now() };
      fetch(`/api/posts?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { posts?: BusinessPost[]; total?: number; hasMore?: boolean } | null) => {
          if (cancelled) return;
          setServerFeedPosts(Array.isArray(payload?.posts) ? payload.posts : null);
          setFeedTotal(typeof payload?.total === 'number' ? payload.total : null);
          setFeedHasMore(Boolean(payload?.hasMore));
        })
        .catch(() => {
          feedFirstPageRef.current = null;
          if (cancelled) return;
          setServerFeedPosts(null);
          setFeedTotal(null);
          setFeedHasMore(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedNeighborhood, searchQuery, userPosts.length, allCompanyPosts.length]);

  const loadMoreFeed = React.useCallback(() => {
    if (feedLoadingRef.current || !feedHasMore) return;
    const loaded = serverFeedPosts?.length ?? 0;
    const params = new URLSearchParams(feedBaseQueryRef.current);
    params.set('limit', String(FEED_NEXT_PAGE));
    params.set('offset', String(loaded));
    feedLoadingRef.current = true;
    setFeedLoadingMore(true);
    setFeedLoadError(null);
    fetch(`/api/posts?${params.toString()}`, { credentials: 'include', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: { posts?: BusinessPost[]; total?: number; hasMore?: boolean } | null) => {
        const nextPosts = Array.isArray(payload?.posts) ? payload.posts : [];
        setServerFeedPosts((previous) => {
          const seen = new Set((previous ?? []).map((item) => item.id));
          return [...(previous ?? []), ...nextPosts.filter((item) => !seen.has(item.id))];
        });
        if (typeof payload?.total === 'number') setFeedTotal(payload.total);
        setFeedHasMore(Boolean(payload?.hasMore));
      })
      .catch(() => {
        // Mantém `hasMore` para o utilizador poder tentar de novo.
        setFeedLoadError('Não foi possível carregar mais publicações.');
      })
      .finally(() => {
        feedLoadingRef.current = false;
        setFeedLoadingMore(false);
      });
  }, [feedHasMore, serverFeedPosts]);

  // O sentinela fica depois da 5.ª publicação a contar do fim: assim que entra
  // no ecrã carregam-se as 20 seguintes.
  React.useEffect(() => {
    if (!feedHasMore || feedLoadingMore || feedLoadError) return;
    const node = feedSentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreFeed();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [feedHasMore, feedLoadingMore, feedLoadError, loadMoreFeed, serverFeedPosts?.length]);

  // Mostrar sempre as publicações mais recentes primeiro, sem reordenar o feed.
  const feedPosts = serverFeedPosts ?? localPosts;
  const feedDisplayTotal = feedTotal ?? feedPosts.length;

  // Filter Businesses for Directory / Marketplace
  const filteredBusinesses = businesses.filter((b) => {
    if (b.status !== 'active') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = b.name.toLowerCase().includes(q);
      const matchDesc = b.description.toLowerCase().includes(q);
      const matchNeigh = b.neighborhood.toLowerCase().includes(q);
      const matchCat = b.subcategoryId.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchNeigh && !matchCat) return false;
    }

    if (selectedCategory && b.categoryId !== selectedCategory) return false;
    if (selectedNeighborhood && b.neighborhood !== selectedNeighborhood) return false;
    if (onlyOpenNow && !b.isOpenNow) return false;

    return true;
  }).sort((a, b) => {
    if (directorySort === 'name') return a.name.localeCompare(b.name, 'pt');
    if (directorySort === 'rating') return (b.reviewsCount - a.reviewsCount) || b.reviews.length - a.reviews.length;
    if (directorySort === 'recent') {
      const latestPost = (business: Business) => Math.max(0, ...business.posts.map((post) => new Date(post.createdAt).getTime()));
      return latestPost(b) - latestPost(a);
    }
    return Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified);
  });

  const featuredBusinesses = React.useMemo(
    () => businesses.filter((b) => b.featured && b.status === 'active').slice(0, 6),
    [businesses]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSearchPromotions = promotions.filter((promotion) => {
    if (!promotion.isActive) return false;
    if (!normalizedSearch) return true;
    return [promotion.title, promotion.description, promotion.businessName, promotion.discountBadge, promotion.neighborhood].some((value) => value.toLowerCase().includes(normalizedSearch));
  });
  const filteredSearchEvents = events.filter((event) => {
    if (event.status !== 'active') return false;
    if (!normalizedSearch) return true;
    return [event.title, event.description, event.neighborhood, event.organizerName].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  // State Handler Actions
  const handleBusinessContactMetric = (businessId: string, metric: 'phoneClicks' | 'whatsappClicks' | 'directionsClicks' | 'websiteClicks') => {
    setBusinesses((previous) => previous.map((business) => business.id === businessId ? { ...business, metrics: { ...business.metrics, [metric]: (business.metrics[metric] || 0) + 1 } } : business));
    setSelectedBusiness((previous) => previous && previous.id === businessId ? { ...previous, metrics: { ...previous.metrics, [metric]: (previous.metrics[metric] || 0) + 1 } } : previous);
  };

  /**
   * Secção 8 — A avaliação é gravada no servidor (fonte de verdade). O cliente
   * apenas reflete o registo devolvido, que já traz o ID real, o telemóvel
   * mascarado e o estado de moderação decidido pelo backend.
   */
  const applyReviewToState = (businessId: string, review: Review) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== businessId) return b;
        const updatedReviews = [review, ...b.reviews.filter((r) => r.id !== review.id)];
        const ratingData = calculateBusinessRating(updatedReviews);
        return {
          ...b,
          reviews: updatedReviews,
          reviewsCount: updatedReviews.length,
          ratingLabel: ratingData.ratingLabel,
          ratingScore: ratingData.averageScore,
        };
      })
    );
    setSelectedBusiness((prev) => {
      if (!prev || prev.id !== businessId) return prev;
      const updatedReviews = [review, ...prev.reviews.filter((r) => r.id !== review.id)];
      const ratingData = calculateBusinessRating(updatedReviews);
      return {
        ...prev,
        reviews: updatedReviews,
        reviewsCount: updatedReviews.length,
        ratingLabel: ratingData.ratingLabel,
        ratingScore: ratingData.averageScore,
      };
    });
  };

  /**
   * Secção 8 — As falhas das ações de avaliação são comunicadas no mesmo centro de
   * notificações usado por todo o sistema, respeitando o idioma escolhido pelo utilizador.
   */
  const notifyReviewFailure = useCallback((message: string) => {
    const notification: AppNotification = {
      id: `review-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: getTranslation(currentLang, 'qualitativeRating'),
      message,
      targetRole: (currentUser?.role || 'user') as AppNotification['targetRole'],
      category: 'review',
      eventType: 'NEW_REVIEW',
      entityType: 'review',
      priority: 'attention',
      read: false,
      createdAt: new Date().toISOString(),
    };
    setSystemNotifications((previous) => [notification, ...previous].slice(0, 250));
  }, [currentLang, currentUser, setSystemNotifications]);

  const handleAddReview = async (businessId: string, review: Review) => {
    const business = businesses.find((item) => item.id === businessId);
    const result = await submitBusinessReview(businessId, {
      authorName: review.authorName,
      authorPhone: review.authorPhone,
      qualitativeScore: review.qualitativeScore,
      comment: review.comment,
      verifiedSms: review.verifiedSms,
    });
    if (result.ok === false) {
      notifyReviewFailure(result.message);
      return;
    }
    const stored = result.review;
    applyReviewToState(businessId, stored);
    if (business) {
      emitSystemEvent({
        eventType: 'NEW_REVIEW',
        businessId,
        businessName: business.name,
        entityType: 'review',
        entityId: stored.id,
      });
    }
  };

  /** Hidrata as avaliações reais do servidor, substituindo os dados de demonstração. */
  const hydrateBusinessReviews = useCallback(async (businessId: string) => {
    try {
      const result = await syncBusinessReviews(businessId);
      if (result.kind === 'unauthorized') return;
      const ratingData = calculateBusinessRating(result.reviews);
      setBusinesses((prev) =>
        prev.map((b) => {
          if (b.id !== businessId) return b;
          return {
            ...b,
            reviews: result.reviews,
            reviewsCount: result.reviews.length,
            ratingLabel: ratingData.ratingLabel,
            ratingScore: ratingData.averageScore,
          };
        })
      );
    } catch {
      // Sem rede ou sem avaliações: mantém a lista atual, sem bloquear a navegação.
    }
  }, [setBusinesses]);

  const handleReplyReview = async (businessId: string, reviewId: string, replyText: string) => {
    const result = await replyBusinessReview(reviewId, replyText);
    if (result.ok === false) {
      notifyReviewFailure(result.message);
      return;
    }
    applyReviewToState(businessId, result.review);
  };

  const handleFlagReview = async (businessId: string, reviewId: string, reason: string) => {
    const business = businesses.find((item) => item.id === businessId);
    const result = await flagBusinessReview(reviewId, reason);
    if (result.ok === false) {
      notifyReviewFailure(result.message);
      return;
    }
    applyReviewToState(businessId, result.review);
    if (business) {
      emitSystemEvent({
        eventType: 'REVIEW_REPORTED',
        businessId,
        businessName: business.name,
        entityType: 'review',
        entityId: reviewId,
        message: reason,
      });
    }
  };

  const handleAddStory = (story: Story) => {
    // Também é chamado pelo módulo de stories do painel: a story publicada aí
    // tem de aparecer na faixa do feed, e publicar duas vezes não a duplica.
    setStories((previous) => {
      const exists = previous.some((candidate) => candidate.id === story.id);
      if (exists) {
        return previous.map((candidate) => (
          candidate.id === story.id ? { ...candidate, ...story, comments: story.comments || candidate.comments || [] } : candidate
        ));
      }
      return [{ ...story, comments: story.comments || [] }, ...previous];
    });
  };

  /** Marca a story como vista: anel da faixa passa a cinzento (estilo Instagram). */
  const handleStoryViewed = (story: Story) => {
    setStories((previous) => {
      let changed = false;
      const next = previous.map((candidate) => {
        if (candidate.id !== story.id) return candidate;
        const seenAlready = candidate.isUnread === false
          && (!currentUser || (candidate.seenBy ?? []).includes(currentUser.id));
        if (seenAlready) return candidate;
        changed = true;
        const seenBy = currentUser
          ? Array.from(new Set([...(candidate.seenBy ?? []), currentUser.id]))
          : candidate.seenBy;
        return { ...candidate, isUnread: false, ...(seenBy !== candidate.seenBy ? { seenBy } : {}) };
      });
      return changed ? next : previous;
    });
  };

  const handleStoryComment = ({ story, text, businessId, businessName, authorName, authorId }: {
    story: Story;
    text: string;
    businessId: string;
    businessName: string;
    authorName: string;
    authorId: string;
  }) => {
    if (!currentUser) {
      handleRequireLogin('Inicie sessão para comentar nas stories.');
      return;
    }
    const now = new Date().toISOString();
    const nextComment = {
      id: `story-comment-${Date.now()}`,
      userId: authorId,
      userName: authorName,
      text,
      createdAt: now,
    };

    setStories((previous) => previous.map((candidate) => candidate.id === story.id ? {
      ...candidate,
      comments: [...(candidate.comments || []), nextComment],
    } : candidate));

    const subject = `Story de ${businessName}`;
    const existingConversation = conversations.find((item) => item.businessId === businessId && item.userId === currentUser.id);
    const nextConversationId = existingConversation?.id || `conversation-story-${Date.now()}`;

    if (existingConversation) {
      setConversationMessages((previous) => [...previous, {
        id: `message-story-${Date.now()}`,
        conversationId: existingConversation.id,
        senderId: currentUser.id,
        senderRole: 'user',
        senderName: currentUser.name,
        text,
        createdAt: now,
        readByUser: true,
        readByBusiness: false,
      }]);
      setConversations((previous) => previous.map((item) => item.id === existingConversation.id ? {
        ...item,
        lastMessage: text,
        updatedAt: now,
        unreadForBusiness: true,
      } : item));
    } else {
      setConversations((previous) => [{
        id: nextConversationId,
        userId: currentUser.id,
        userName: currentUser.name,
        businessId,
        businessName,
        subject,
        lastMessage: text,
        createdAt: now,
        updatedAt: now,
        unreadForUser: false,
        unreadForBusiness: true,
      }, ...previous]);
      setConversationMessages((previous) => [...previous, {
        id: `message-story-${Date.now()}`,
        conversationId: nextConversationId,
        senderId: currentUser.id,
        senderRole: 'user',
        senderName: currentUser.name,
        text,
        createdAt: now,
        readByUser: true,
        readByBusiness: false,
      }]);
    }

    setFocusedConversationId(nextConversationId);
    setMessageBusinessId(businessId);
    handleTabChange('messages');
  };

  const handleAddPost = (businessId: string, post: BusinessPost) => {
    const business = businesses.find((item) => item.id === businessId);
    if (businessId.startsWith('usr-') || !business) {
      setUserPosts((prev) => [post, ...prev]);
      return;
    }
    const planConfig = getBusinessPlan(business, normaliseSubscriptionPlans(subscriptionPlans));
    const usage = getBusinessUsage(business);
    const postLimit = planConfig.limits.max_posts ?? planConfig.postsPerMonth;
    const credit = post.status !== 'rejected'
      ? consumeCredit(postLimit, usage.postsUsed, business.monetizationWallet || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0, updatedAt: new Date().toISOString() }, 'posts', resolvedMonetizationCatalog.extraConsumptionOrder)
      : { ok: true, source: 'included' as const, wallet: business.monetizationWallet };
    if (post.status !== 'rejected' && !credit.ok) return;
    const postEventType: NotificationEventType = post.status === 'approved'
      ? 'POST_APPROVED'
      : post.status === 'rejected'
        ? 'POST_REJECTED'
        : 'POST_SUBMITTED';
    emitSystemEvent({
      eventType: postEventType,
      businessId,
      businessName: business.name,
      entityType: 'post',
      entityId: post.id,
      message: post.moderationReason,
    });
    if (post.status === 'approved') {
      const followerIds = resolveFollowers(businessId);
      followerIds.forEach((followerId) => emitSystemEvent({
        eventType: 'FOLLOWED_BUSINESS_POST',
        userId: followerId,
        businessId,
        businessName: business.name,
        entityType: 'post',
        entityId: post.id,
        message: post.title || post.content,
        metadata: { postId: post.id, followedBusinessId: businessId },
      }));
    }
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === businessId) {
          const usage = getBusinessUsage(b);
          return {
            ...b,
            posts: [post, ...b.posts],
            postsQuotaRemaining: credit.source === 'included' ? Math.max(0, b.postsQuotaRemaining - 1) : b.postsQuotaRemaining,
            subscriptionUsage: { ...usage, postsUsed: credit.source === 'included' ? usage.postsUsed + 1 : usage.postsUsed, updatedAt: new Date().toISOString() },
            monetizationWallet: credit.source === 'extra' ? credit.wallet : b.monetizationWallet,
          };
        }
        return b;
      })
    );
  };

  const handleSearchSubmit = (query: string) => {
    const trimmed = query.trim();
    setSearchQuery(trimmed);

    if (trimmed) {
      const normalized = trimmed.toLowerCase();
      const candidates = businesses
        .filter((business) => business.status === 'active')
        .map((business) => {
          const name = business.name.toLowerCase();
          const description = (business.description || '').toLowerCase();
          const neighborhood = (business.neighborhood || '').toLowerCase();
          const category = (business.subcategoryId || '').toLowerCase();

          let score = 0;
          if (name === normalized) score += 100;
          if (name.includes(normalized)) score += 70;
          if (description.includes(normalized)) score += 35;
          if (neighborhood.includes(normalized)) score += 25;
          if (category.includes(normalized)) score += 20;

          return { business, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score);

      if (candidates.length > 0) {
        setSelectedBusiness(candidates[0].business);
      } else {
        setSelectedBusiness(null);
        const matchingEvent = events.find((event) =>
          [event.title, event.description, event.location, event.neighborhood, event.organizerName]
            .some((value) => value.toLowerCase().includes(normalized))
        );
        const matchingPromotion = promotions.some((promotion) =>
          [promotion.title, promotion.description, promotion.businessName, promotion.neighborhood]
            .some((value) => value.toLowerCase().includes(normalized))
        );
        if (matchingEvent) {
          setCurrentTab('events');
          setFocusedEventId(null);
        } else if (matchingPromotion) {
          setCurrentTab('promotions');
        } else {
          setCurrentTab('feed');
        }
      }
    }

    // If on non-content tabs, automatically redirect to Feed to view live posts/results
    if (['scanner', 'client', 'admin', 'institutional'].includes(currentTab)) {
      setCurrentTab('feed');
    }
  };

  const handleFeedRefresh = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedNeighborhood(null);
    setOnlyOpenNow(false);
    setFeedRefreshToken((previous) => previous + 1);
    setCurrentTab('feed');
  };

  const handleAddBusinessEvent = (event: EventItem) => {
    setEvents((previous) => [event, ...previous.filter((item) => item.id !== event.id)]);
    const business = businesses.find((item) => item.id === event.businessId);
    emitSystemEvent({
      eventType: 'EVENT_SUBMITTED',
      businessId: event.businessId,
      businessName: business?.name || event.organizerName,
      eventId: event.id,
      eventTitle: event.title,
      entityType: 'event',
      entityId: event.id,
    });
    if (event.status === 'active' && event.businessId) {
      resolveFollowers(event.businessId).forEach((followerId) => emitSystemEvent({
        eventType: 'FOLLOWED_BUSINESS_EVENT',
        userId: followerId,
        businessId: event.businessId,
        businessName: business?.name || event.organizerName,
        eventId: event.id,
        eventTitle: event.title,
        entityType: 'event',
        entityId: event.id,
        metadata: { eventId: event.id, followedBusinessId: event.businessId },
      }));
    }
  };

  const handleCancelBusinessEvent = (event: EventItem) => {
    setEvents((previous) => previous.map((item) => item.id === event.id ? { ...item, status: 'cancelled' } : item));
    const business = businesses.find((item) => item.id === event.businessId);
    emitSystemEvent({
      eventType: 'EVENT_CANCELLED',
      businessId: event.businessId,
      businessName: business?.name || event.organizerName,
      eventId: event.id,
      eventTitle: event.title,
      entityType: 'event',
      entityId: event.id,
    });
  };

  const handleAddPromotion = (businessId: string, promo: Promotion) => {
    const business = businesses.find((item) => item.id === businessId);
    let promotionCredit: ReturnType<typeof consumeCredit> | null = null;
    if (business) {
      const planConfig = getBusinessPlan(business, normaliseSubscriptionPlans(subscriptionPlans));
      const usage = getBusinessUsage(business);
      const promotionLimit = planConfig.limits.max_promotions ?? planConfig.promotionsPerMonth;
      promotionCredit = consumeCredit(promotionLimit, usage.promotionsUsed, business.monetizationWallet || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0, updatedAt: new Date().toISOString() }, 'promotions', resolvedMonetizationCatalog.extraConsumptionOrder);
      if (!promotionCredit.ok) return;
    }
    setPromotions((prev) => [promo, ...prev]);
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === businessId) {
          const usage = getBusinessUsage(b);
          return {
            ...b,
            promotions: [promo, ...b.promotions],
            subscriptionUsage: { ...usage, promotionsUsed: promotionCredit?.source === 'included' ? usage.promotionsUsed + 1 : usage.promotionsUsed, updatedAt: new Date().toISOString() },
            monetizationWallet: promotionCredit?.source === 'extra' ? promotionCredit.wallet : b.monetizationWallet,
          };
        }
        return b;
      })
    );
    if (promo.isActive) {
      resolveFollowers(businessId).forEach((followerId) => emitSystemEvent({
        eventType: 'FAVORITE_PROMOTION',
        userId: followerId,
        businessId,
        businessName: promo.businessName,
        entityType: 'promotion',
        entityId: promo.id,
        message: promo.title,
        metadata: { promotionId: promo.id, followedBusinessId: businessId },
      }));
    }
  };

  const handleUpdateBusiness = (updatedBusiness: Business) => {
    setBusinesses((previous) => previous.map((business) => (
      business.id === updatedBusiness.id ? updatedBusiness : business
    )));
    if (currentUser?.role === 'business' && currentUser.businessId === updatedBusiness.id) {
      setCurrentUser((previous) => previous ? { ...previous, businessName: updatedBusiness.name } : previous);
    }
  };

  const handleSaveBusinessProfile = async (updatedBusiness: Business) => {
    const profilePatch: Record<string, unknown> = {
      ...(updatedBusiness.name.trim() ? { name: updatedBusiness.name.trim() } : {}),
      ...(updatedBusiness.categoryId.trim() ? { categoryId: updatedBusiness.categoryId.trim() } : {}),
      ...(updatedBusiness.subcategoryId.trim() ? { subcategoryId: updatedBusiness.subcategoryId.trim() } : {}),
      ...(updatedBusiness.description.trim() ? { description: updatedBusiness.description.trim() } : {}),
      ...(updatedBusiness.phone.trim() ? { phone: updatedBusiness.phone.trim() } : {}),
      ...(updatedBusiness.neighborhood.trim() ? { neighborhood: updatedBusiness.neighborhood.trim() } : {}),
      groupGroupId: updatedBusiness.groupGroupId,
      address: updatedBusiness.address.trim(),
      whatsapp: updatedBusiness.whatsapp.trim(),
      publicEmail: updatedBusiness.publicEmail?.trim() || '',
      website: updatedBusiness.website?.trim() || '',
      openingHours: updatedBusiness.openingHours.trim(),
      socialLinks: {
        facebook: updatedBusiness.socialLinks?.facebook?.trim() || '',
        instagram: updatedBusiness.socialLinks?.instagram?.trim() || '',
      },
      serviceLanguages: updatedBusiness.serviceLanguages || [],
      notApplicableFields: updatedBusiness.notApplicableFields || [],
      logo: updatedBusiness.logo,
      coverImage: updatedBusiness.coverImage,
      gallery: updatedBusiness.gallery,
    };
    const response = await fetch(`/api/businesses/${encodeURIComponent(updatedBusiness.id)}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profilePatch),
    });
    const payload = await response.json().catch(() => ({})) as {
      business?: Partial<Business>;
      error?: string;
    };
    if (!response.ok || !payload.business) {
      throw new Error(payload.error || 'Não foi possível guardar o perfil da empresa.');
    }

    const persistedBusiness: Business = {
      ...updatedBusiness,
      ...mergeStoredBusinessProfile(updatedBusiness, payload.business),
    };
    setBusinesses((previous) => previous.map((business) => (
      business.id === persistedBusiness.id ? persistedBusiness : business
    )));
    if (currentUser?.role === 'business' && currentUser.businessId === persistedBusiness.id) {
      setCurrentUser((previous) => previous ? { ...previous, businessName: persistedBusiness.name } : previous);
    }
  };

  const handleAdminBusinessDecision = async (businessId: string, decision: 'approve' | 'reject', reason?: string) => {
    const response = await fetch(`/api/admin/businesses/${encodeURIComponent(businessId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    });
    const payload = await response.json().catch(() => ({})) as { business?: Business; error?: string };
    if (!response.ok || !payload.business) throw new Error(payload.error || 'Não foi possível persistir a decisão administrativa.');
    setBusinesses((previous) => previous.map((business) => business.id === businessId ? { ...business, ...payload.business } : business));
    return payload.business;
  };

  const activeBusiness = currentUser?.role === 'business' && currentUser.businessId
    ? businesses.find((business) => business.id === currentUser.businessId) || null
    : null;
  const personalPurchaseOrders = currentUser?.role === 'user'
    ? purchaseOrders.filter((order) => order.buyerId === currentUser.id)
    : [];
  const followedBusinessIds = currentUser?.role === 'user'
    ? (followedBusinessIdsByUser[currentUser.id] || [])
    : [];
  const followedBusinesses = currentUser?.role === 'user'
    ? followedBusinessIds
      .map((businessId) => businesses.find((business) => business.id === businessId))
      .filter((business): business is Business => Boolean(business))
    : [];
  const isBusinessNotificationsMuted = (businessId: string) => currentUser?.role === 'user'
    ? (mutedFollowNotificationsByUser[currentUser.id] || []).includes(businessId)
    : false;
  const getBusinessAudienceReach = (business: Business) => business.metrics.views + business.posts.reduce((total, post) => total + (post.likesCount || 0) + (post.sharesCount || 0), 0);
  const unreadMessageCount = currentUser?.role === 'user'
    ? conversations.filter((conversation) => conversation.userId === currentUser.id && conversation.unreadForUser).length
    : currentUser?.role === 'business'
      ? conversations.filter((conversation) => conversation.businessId === currentUser.businessId && conversation.unreadForBusiness).length
      : 0;
  const visibleReminders = currentUser ? reminders : [];
  const unreadNotificationCount = visibleNotifications.filter((notification) => !notification.read).length;
  const pendingSupportCount = currentUser
    ? supportRequests.filter((request) => request.userId === currentUser.id && request.status !== 'resolved').length
    : 0;

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300">A carregar o painel...</div>}>

      <PostEngagementProvider currentUserId={currentUser?.id ?? null}>
             <div className={`guigui-app-shell flex min-h-screen flex-col antialiased ${currentUser?.role === 'user' ? 'pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0' : ''}`}>
      {/* Login Overlay Modal */}
      <LoginModal
        isOpen={showLoginModal}
        currentLang={currentLang}
        messageNotice={loginNotice ?? undefined}
        teamInviteToken={teamInviteToken}
        onLogin={handleLogin}
        onClose={() => { setShowLoginModal(false); setTeamInviteToken(null); window.history.replaceState({}, '', window.location.pathname); }}
      />

      {marketplaceStatus === 'loading' && (
        <p role="status" className="mx-auto w-full max-w-7xl px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
          A carregar os dados do marketplace...
        </p>
      )}
      {marketplaceError && (
        <p role="alert" className="mx-auto w-full max-w-7xl px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300">
          Não foi possível sincronizar o marketplace: {marketplaceError}
        </p>
      )}

      {/* Facebook Sticky Top Navigation Header */}
      <Navbar
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        currentUser={currentUser}
        onSidebarCollapsedChange={setBusinessSidebarCollapsed}
        onOpenLoginModal={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        theme={theme}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
        reminders={visibleReminders}
        onFeedRefresh={handleFeedRefresh}
        notifications={visibleNotifications}
        onMarkNotificationAsRead={handleMarkNotificationAsRead}
        onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
        onClearNotifications={handleClearNotifications}
        onNavigateNotificationTab={(tab) => handleTabChange(tab as typeof currentTab)}
        onOpenNotification={handleOpenNotification}
        onOpenMessages={handleOpenMessages}
        unreadMessageCount={unreadMessageCount}
        onGoBack={handleGoBack}
        onBusinessTabChange={(tab) => {
          handleTabChange('client');
          setBusinessDashboardStartTab(tab);
        }}
        onAdminTabChange={(tab) => {
          setAdminDashboardStartTab(tab as typeof adminDashboardStartTab);
          handleTabChange('admin');
        }}
      />

      {(!currentUser || currentUser.role === 'user') && (
        <CitizenBottomNav
          isAuthenticated={Boolean(currentUser) && sessionGate === 'authenticated'}
          activeId={
            currentTab === 'messages'
              ? 'messages'
              : currentTab === 'client'
                ? 'account'
                : currentTab === 'events'
                  ? 'events'
                  : currentTab === 'directory'
                    ? 'directory'
                    : currentTab === 'promotions'
                    ? 'promotions'
                    : currentTab === 'map'
                    ? 'map'
                    : 'feed'
          }
          badges={{
            unreadMessages: unreadMessageCount,
            unreadNotifications: unreadNotificationCount,
            pendingSupport: pendingSupportCount,
          }}
          onSelect={(module) => {
            const target = module === 'account'
              ? 'client'
              : module === 'messages'
                ? 'messages'
                : module === 'map'
                  ? 'map'
                  : module;
            handleTabChange(target);
          }}
        />
      )}

      {/* Main Container Layout with Fluid Framer-Motion Transitions */}
      <div className="guigui-main flex-1">
        <AnimatePresence mode="wait">
          <motion.main
            key={currentTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            className="w-full min-w-0 space-y-6"
          >
            {/* Dedicated Return / Voltar Navigation Bar whenever inside any sub-page/place */}
            {!['feed', 'directory', 'events', 'promotions', 'client'].includes(currentTab) && (
              <div
                style={
                  currentTab === 'client' || currentTab === 'admin'
                    ? {
                        '--backbar-offset': currentUser?.role === 'user'
                          ? `${clientSidebarCollapsed ? 88 : 264}px`
                          : currentUser?.role === 'business'
                          ? `${businessSidebarCollapsed ? 88 : 264}px`
                          : `${adminSidebarCollapsed ? 88 : 276}px`,
                      } as React.CSSProperties
                    : undefined
                }
                className="guigui-backbar"
              >
                <button type="button"
                  onClick={handleGoBack}
                  className="group flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  <span className="max-w-[42vw] truncate sm:max-w-none">{currentTab === 'directory' ? 'Diretório de Empresas' : currentTab === 'map' ? 'Mapa de Empresas e Serviços' : currentTab === 'promotions' ? 'Ofertas & Descontos' : currentTab === 'events' ? 'Agenda Cultural & Bilhetes' : currentTab === 'scanner' ? 'Validador de Bilhetes' : currentTab === 'messages' ? 'Mensagens' : currentTab === 'support' ? 'Suporte' : currentTab === 'client' ? (currentUser?.role === 'user' ? 'Área Pessoal' : 'Painel Comercial') : currentTab === 'admin' ? 'Administração' : 'Institucional'}</span>
                </button>
                <button type="button"
                  onClick={handleGoToFeed}
                  aria-label="Voltar para o Feed"
                  title="Voltar para o Feed"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/20 hover:text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20 dark:hover:text-emerald-100"
                >
                  <Home className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* TAB 1: Feed Bissau */}
            {currentTab === 'feed' && (
              <div className="space-y-6">
                {/* Active Search Results Feedback Banner */}
                {searchQuery.trim() && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-black text-sm">
                          <Search className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div>
                          <h2 className="text-sm font-black text-slate-900 dark:text-white">
                            Resultados da pesquisa por: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">"{searchQuery}"</span>
                          </h2>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {feedDisplayTotal} publicações • {filteredBusinesses.length} empresas • {filteredSearchPromotions.length} promoções • {filteredSearchEvents.length} eventos
                          </p>
                        </div>
                      </div>

                      <button type="button"
                        onClick={() => setSearchQuery('')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <span>Limpar Pesquisa</span>
                        <span className="text-sm">×</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button type="button"
                        onClick={() => handleTabChange('feed')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                          currentTab === 'feed'
                            ? 'bg-slate-900 dark:bg-emerald-600 text-emerald-400 dark:text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Publicações ({feedDisplayTotal})
                      </button>
                      <button type="button"
                        onClick={() => handleTabChange('directory')}
                        className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition shrink-0"
                      >
                        Empresas ({filteredBusinesses.length})
                      </button>
                      <button type="button"
                        onClick={() => handleTabChange('events')}
                        className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition shrink-0"
                      >
                        Eventos
                      </button>
                      <button type="button"
                        onClick={() => handleTabChange('promotions')}
                        className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition shrink-0"
                      >
                        Promoções ({filteredSearchPromotions.length})
                      </button>
                    </div>
                  </div>
                )}
              {/* Concept-led portal hero */}
              <section className="guigui-hero guigui-home-hero">
                <div className="guigui-hero-inner">
                  <div className="guigui-eyebrow">Diretório & agenda cultural de Bissau</div>
                  <h1 className="guigui-hero-title">{getTranslation(currentLang, 'heroTitle')}</h1>
                  <div className="guigui-search">
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSearchSubmit(searchQuery);
                        }
                      }}
                      placeholder={getTranslation(currentLang, 'searchPlaceholder')}
                      aria-label={getTranslation(currentLang, 'searchAriaLabel')}
                    />
                    <button type="button" className="guigui-search-button whitespace-nowrap" onClick={() => handleSearchSubmit(searchQuery)}>{getTranslation(currentLang, 'search')}</button>
                  </div>
                  <div className="guigui-quick-links" aria-label="Pesquisas rápidas">
                    {['Restaurantes', 'Farmácias', 'Eventos esta semana', 'Serviços públicos'].map((label) => (
                      <button key={label} type="button" className="guigui-quick-link" onClick={() => handleSearchSubmit(label)}>{label}</button>
                    ))}
                  </div>
                </div>
              </section>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
                <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider text-[#5B6B67] flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#C9852A]" />Localização</span>
                <LocationFilter
                  locations={bissauLocations}
                  selectedLocation={selectedNeighborhood}
                  onSelect={setSelectedNeighborhood}
                  triggerLabel="Todos"
                  allLabel="Ver todos"
                />
              </div>

              <FeaturedHomepageBanner
                businesses={businesses}
                campaigns={activeAdCampaigns}
                onBusinessSelect={setSelectedBusiness}
                onCampaignImpression={handleAdCampaignImpression}
                onCampaignClick={handleAdCampaignClick}
              />

              {/* Full-Width Publications & Social Feed Stream (Em baixo cobrindo todo o espaço como no Facebook) */}
              <div className="w-full space-y-4">
                {/* Stories Carousel */}
                <StoriesBar
                  stories={stories}
                  businesses={businesses}
                  currentLang={currentLang}
                  onTabChange={handleTabChange}
                  currentUser={currentUser}
                  currentRole={currentRole}
                  onAddStory={handleAddStory}
                  onRequireLogin={() => handleRequireLogin('Inicie sessão para publicar uma story.')}
                  onStoryComment={handleStoryComment}
                  onStoryViewed={handleStoryViewed}
                />

                {currentUser && (currentUser.role === 'business' || currentUser.role === 'admin') && (
                  <CreatePostBox
                    business={businesses[0]}
                    onAddPost={handleAddPost}
                    currentUser={currentUser}
                    currentLang={currentLang}
                    onRequireLogin={handleRequireLogin}
                  />
                )}

                {/* Active Neighborhood Filter Pill Banner */}
                {selectedNeighborhood && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-emerald-100 shadow-xs">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>A filtrar publicações na zona: <strong>{selectedNeighborhood}</strong></span>
                    </div>
                    <button type="button"
                      onClick={() => setSelectedNeighborhood(null)}
                      className="text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 px-3 py-1 rounded-xl transition"
                    >
                      Remover filtro ×
                    </button>
                  </div>
                )}

                {/* Full-Width Feed Posts List */}
                {feedRefreshToken > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <span>Feed actualizado — a mostrar uma ordem diferente de publicações.</span>
                    <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200">Actualização {feedRefreshToken}</span>
                  </div>
                )}
                <div className="w-full space-y-0">
                  {feedPosts.map((post, index) => {
                    const biz = businesses.find((b) => b.id === post.businessId);
                    const showSentinel = feedHasMore && index === Math.max(0, feedPosts.length - FEED_PRELOAD_THRESHOLD);
                    return (
                      <React.Fragment key={post.id}>
                        <FeedPostCard
                          post={post}
                          business={biz}
                          currentLang={currentLang}
                          onSelectBusiness={setSelectedBusiness}
                          currentUser={currentUser}
                          onRequireLogin={handleRequireLogin}
                          isHighlighted={focusedPostId === post.id}
                        />
                        {showSentinel && <div ref={feedSentinelRef} aria-hidden="true" />}
                      </React.Fragment>
                    );
                  })}
                  <div className="min-h-[48px]" aria-live="polite">
                    {feedLoadingMore && (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden="true" />
                        A carregar mais publicações…
                      </div>
                    )}
                    {!feedLoadingMore && feedLoadError && feedHasMore && (
                      <div className="flex items-center justify-center gap-2 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span>{feedLoadError}</span>
                        <button
                          type="button"
                          onClick={() => loadMoreFeed()}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Tentar novamente
                        </button>
                      </div>
                    )}
                    {!feedLoadingMore && !feedHasMore && serverFeedPosts !== null && feedPosts.length > FEED_FIRST_PAGE && (
                      <div className="py-4 text-center text-[11px] font-bold text-slate-400">
                        Fim do feed — {feedPosts.length} publicações carregadas.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Mapa de empresas e serviços */}
          {currentTab === 'map' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-slate-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                      <MapPin className="h-5 w-5 text-emerald-600" />
                      Empresas perto de si
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Explore os negócios por zona e abra rapidamente o perfil ou as direções.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('directory')}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Ver lista completa
                  </button>
                </div>
              </div>

              <div className="relative min-h-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-[#e7f0e9] shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="absolute inset-0 opacity-60" aria-hidden="true">
                  <div className="absolute left-[12%] top-[18%] h-px w-[76%] rotate-[18deg] bg-white/90" />
                  <div className="absolute left-[8%] top-[52%] h-px w-[84%] -rotate-[12deg] bg-white/90" />
                  <div className="absolute left-[32%] top-0 h-full w-px rotate-[12deg] bg-white/80" />
                  <div className="absolute left-[68%] top-0 h-full w-px -rotate-[18deg] bg-white/80" />
                </div>
                <div className="absolute left-4 top-4 rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-900 shadow-sm">
                  {filteredBusinesses.length} locais encontrados
                </div>
                {filteredBusinesses.map((business, index) => {
                  const left = 14 + ((index * 29) % 72);
                  const top = 22 + ((index * 37) % 62);
                  return (
                    <button
                      key={business.id}
                      type="button"
                      onClick={() => setSelectedBusiness(business)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-left"
                      style={{ left: `${left}%`, top: `${top}%` }}
                      aria-label={`Abrir localização de ${business.name}`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-emerald-700 text-white shadow-lg transition hover:scale-110">
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span className="mt-1 block max-w-32 truncate rounded-lg border border-white/80 bg-white/95 px-2 py-1 text-[10px] font-black text-slate-800 shadow-sm">
                        {business.name}
                      </span>
                    </button>
                  );
                })}
                {filteredBusinesses.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                    <p className="rounded-2xl bg-white/90 px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">Nenhuma empresa corresponde aos filtros atuais.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Directório Commercial & Marketplace */}
          {currentTab === 'directory' && (
            <div className="space-y-6">
              {/* Directory Header & Filter Pills */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                      <Store className="w-6 h-6 text-emerald-600" />
                      <span>Guia de Empresas e Serviços</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Explore restaurantes, hotéis, lojas e serviços profissionais no Guigui.com.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                    {/* View Switcher: Horizontal List vs Grid */}
                    <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
                      <button type="button"
                        onClick={() => setDirectoryViewMode('horizontal')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          directoryViewMode === 'horizontal'
                            ? 'bg-slate-900 text-emerald-400 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Lista Horizontal de Empresas em Bissau"
                      >
                        <LayoutList className="w-4 h-4" />
                        <span className="hidden xs:inline">Lista Horizontal</span>
                      </button>
                      <button type="button"
                        onClick={() => setDirectoryViewMode('grid')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          directoryViewMode === 'grid'
                            ? 'bg-slate-900 text-emerald-400 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Grelha de Cartões"
                      >
                        <LayoutGrid className="w-4 h-4" />
                        <span className="hidden xs:inline">Grelha</span>
                      </button>
                    </div>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-2xl border border-emerald-200">
                      {filteredBusinesses.length} empresas
                    </span>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <span className="sr-only">Ordenar empresas</span>
                      <select
                        value={directorySort}
                        onChange={(event) => setDirectorySort(event.target.value as typeof directorySort)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700 outline-none focus:border-emerald-500"
                        aria-label="Ordenar empresas"
                      >
                        <option value="relevance">Relevância</option>
                        <option value="name">Nome</option>
                        <option value="rating">Mais avaliadas</option>
                        <option value="recent">Mais recentes</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Filtro de categoria: uma única entrada que abre a lista completa */}
                <div className="flex flex-wrap items-center gap-2 py-1 text-xs">
                  <div ref={directoryCategoryRef} className="relative inline-flex">
                    <button
                      type="button"
                      onClick={() => setDirectoryCategoryOpen((value) => !value)}
                      aria-haspopup="listbox"
                      aria-expanded={directoryCategoryOpen}
                      aria-label={`Filtrar por categoria. ${selectedCategory ? marketplaceCategories.find((cat) => cat.id === selectedCategory)?.name ?? 'Todas as Categorias' : 'Todas as Categorias'}`}
                      className={`guigui-filter-chip max-w-[260px] ${selectedCategory === null ? 'active' : ''}`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {selectedCategory
                            ? marketplaceCategories.find((cat) => cat.id === selectedCategory)?.name ?? 'Todas as Categorias'
                            : 'Todas as Categorias'}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${directoryCategoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </span>
                    </button>

                    {directoryCategoryOpen && (
                      <div
                        role="dialog"
                        aria-label="Categorias de empresas"
                        className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5" role="listbox" aria-label="Lista de categorias">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedCategory === null}
                            onClick={() => { setSelectedCategory(null); setDirectoryCategoryOpen(false); }}
                            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold transition ${selectedCategory === null ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                          >
                            <LayoutGrid className={`h-3.5 w-3.5 shrink-0 ${selectedCategory === null ? 'text-white' : 'text-emerald-600'}`} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">Todas as Categorias</span>
                          </button>
                          {marketplaceCategories.map((cat) => {
                            const active = selectedCategory === cat.id;
                            return (
                              <button
                                type="button"
                                role="option"
                                key={cat.id}
                                aria-selected={active}
                                onClick={() => { setSelectedCategory(cat.id); setDirectoryCategoryOpen(false); }}
                                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold transition ${active ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                              >
                                <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Businesses Marketplace Directory Display */}
              {filteredBusinesses.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-600 space-y-3 shadow-sm">
                  <div className="text-base font-bold text-slate-900">
                    Nenhuma empresa encontrada com os filtros selecionados
                  </div>
                  <p className="text-xs">Tente pesquisar por outro nome ou limpar as categorias.</p>
                  <button type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                      setSelectedNeighborhood(null);
                      setOnlyOpenNow(false);
                    }}
                    className="mt-2 bg-emerald-600 text-white font-bold px-4 py-2 rounded-2xl text-xs shadow-sm hover:bg-emerald-700 transition"
                  >
                    Limpar Todos os Filtros
                  </button>
                </div>
              ) : directoryViewMode === 'horizontal' ? (
                /* HORIZONTAL LIST MODE FOR BUSINESS DIRECTORY */
                <div className="relative group">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-emerald-600" />
                      <span>Deslize Horizontalmente pelas Empresas e Serviços em Bissau</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => {
                          const container = document.getElementById('horizontal-biz-container');
                          if (container) container.scrollBy({ left: -340, behavior: 'smooth' });
                        }}
                        className="p-2 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm transition"
                        title="Deslizar para a esquerda"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button type="button"
                        onClick={() => {
                          const container = document.getElementById('horizontal-biz-container');
                          if (container) container.scrollBy({ left: 340, behavior: 'smooth' });
                        }}
                        className="p-2 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm transition"
                        title="Deslizar para a direita"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div
                    id="horizontal-biz-container"
                    className="flex items-stretch gap-5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar"
                  >
                    {filteredBusinesses.map((b) => (
                      <div
                        key={b.id}
                        className="w-[300px] sm:w-[340px] shrink-0 snap-start flex flex-col"
                      >
                        <BusinessCard
                          business={b}
                          categories={marketplaceCategories}
                          currentLang={currentLang}
                          onSelect={(biz) => setSelectedBusiness(biz)}
                          onToggleCompare={handleToggleCompareBusiness}
                          isCompared={comparedBusinessIds.includes(b.id)}
                          compareDisabled={comparedBusinessIds.length >= 3}
                          isFollowed={followedBusinessIds.includes(b.id)}
                          onToggleFollow={handleToggleBusinessFollow}
                          onToggleNotifications={handleToggleBusinessNotifications}
                          notificationsMuted={isBusinessNotificationsMuted(b.id)}
                          onMessage={handleOpenBusinessMessage}
                          onContactMetric={handleBusinessContactMetric}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* GRID MODE FOR BUSINESS DIRECTORY */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredBusinesses.map((b) => (
                    <BusinessCard
                      key={b.id}
                      business={b}
                      categories={marketplaceCategories}
                      currentLang={currentLang}
                      onSelect={(biz) => setSelectedBusiness(biz)}
                      onToggleCompare={handleToggleCompareBusiness}
                      isCompared={comparedBusinessIds.includes(b.id)}
                      compareDisabled={comparedBusinessIds.length >= 3}
                      isFollowed={followedBusinessIds.includes(b.id)}
                      onToggleFollow={handleToggleBusinessFollow}
                      onToggleNotifications={handleToggleBusinessNotifications}
                      notificationsMuted={isBusinessNotificationsMuted(b.id)}
                      onMessage={handleOpenBusinessMessage}
                      onContactMetric={handleBusinessContactMetric}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Promoções & Ofertas */}
          {currentTab === 'promotions' && (
            <PromotionsView
              promotions={promotions}
              currentLang={currentLang}
              currentUser={currentUser}
              onRequireLogin={handleRequireLogin}
              onAddPurchaseOrder={handleAddPurchaseOrder}
              onPromotionMessage={handlePromotionMessage}
              searchQuery={searchQuery}
            />
          )}

          {/* TAB 4: Agenda Cultural & Bilhetes */}
          {currentTab === 'events' && (
            <EventsView
              events={events}
              currentLang={currentLang}
              currentUser={currentUser}
              onRequireLogin={handleRequireLogin}
              onAddPurchaseOrder={handleAddPurchaseOrder}
              onTicketPurchaseConfirmed={(purchase) => {
                if (currentUser?.role !== 'user') return;
                emitSystemEvent({
                  eventType: 'TICKET_PURCHASED',
                  userId: currentUser.id,
                  userName: currentUser.name,
                  businessId: purchase.businessId,
                  eventId: purchase.eventId,
                  eventTitle: purchase.eventTitle,
                  ticketId: purchase.ticketId,
                  entityType: 'ticket',
                  entityId: purchase.ticketId,
                  metadata: {
                    transactionId: purchase.transactionId,
                    ticketIds: purchase.ticketIds,
                    ticketCodes: purchase.ticketCodes,
                  },
                });
              }}
              searchQuery={searchQuery}
              focusEventId={focusedEventId}
              reminders={visibleReminders}
              onToggleReminder={handleToggleReminder}
              onRemoveReminder={handleRemoveReminder}
              onTriggerTestAlert={handleTriggerTestAlert}
              onContactOrganizer={(event) => {
                if (!currentUser || currentUser.role !== 'user') {
                  handleRequireLogin('Inicie sessão como cidadão para contactar o organizador.');
                  return;
                }
                if (event.businessId) handleOpenBusinessMessage(event.businessId);
              }}
            />
          )}

          {/* TAB 5: Scanner de Bilhetes — operação exclusiva da empresa organizadora */}
          {currentTab === 'scanner' && (
            currentUser?.role === 'business' && currentUser.businessId ? (
              <ErrorBoundary currentLang={currentLang} area="scanner">
              <TicketScannerView
                events={events.filter((event) => event.businessId === currentUser.businessId)}
                currentLang={currentLang}
                purchaseOrders={purchaseOrders.filter((order) => order.businessId === currentUser.businessId)}
                onValidatePurchaseOrder={handleValidatePurchaseOrder}
              />
              </ErrorBoundary>
            ) : (
              <div className="mx-auto my-8 max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
                <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
                <h2 className="mt-3 text-lg font-black text-slate-900">Scanner reservado à empresa</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">A validação de QR Code e a entrega de bilhetes só podem ser executadas pela empresa organizadora ou pela sua equipa de porta autorizada.</p>
                <button type="button" onClick={handleGoToFeed} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">Voltar ao Feed</button>
              </div>
            )
          )}

          {/* TAB 6: Painel da Empresa */}
          {currentTab === 'messages' && (
            currentUser && currentUser.role !== 'admin' ? (
              <div className="w-full space-y-6">
                <CommunicationHub
                  mode={currentUser.role === 'business' ? 'business' : 'user'}
                  currentUser={currentUser}
                  businesses={businesses}
                  conversations={conversations}
                  messages={conversationMessages}
                  supportRequests={supportRequests}
                  onCreateConversation={handleCreateConversation}
                  onSendMessage={handleSendConversationMessage}
                  onCreateSupport={handleCreateSupport}
                  onReplySupport={handleReplySupport}
                  onMarkConversationRead={handleMarkConversationRead}
                  initialChannel="messages"
                  initialBusinessId={messageBusinessId}
                  focusConversationId={focusedConversationId}
                  channelOnly
                />
              </div>
            ) : (
              <div className="mx-auto my-8 max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Área de mensagens</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Inicie sessão para ver a sua caixa de mensagens e conversar com as empresas do Guigui.com.</p>
                <button type="button" onClick={() => setShowLoginModal(true)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700">Entrar</button>
              </div>
            )
          )}

          {currentTab === 'support' && (
            <ErrorBoundary currentLang={currentLang} area="Suporte">
            {currentUser ? (
              <div className="mx-auto w-full max-w-6xl space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">Apoio</p>
                      <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Suporte</h2>
                    </div>
                    <button type="button" onClick={handleGoToFeed} className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Voltar ao feed</button>
                  </div>
                </div>
                <CommunicationHub
                  mode={currentUser.role === 'business' ? 'business' : 'user'}
                  currentUser={currentUser}
                  businesses={businesses}
                  conversations={conversations}
                  messages={conversationMessages}
                  supportRequests={supportRequests}
                  onCreateConversation={handleCreateConversation}
                  onSendMessage={handleSendConversationMessage}
                  onCreateSupport={handleCreateSupport}
                  onReplySupport={handleReplySupport}
                  onMarkConversationRead={handleMarkConversationRead}
                  initialChannel="support"
                  initialBusinessId={messageBusinessId}
                  focusSupportId={focusedSupportId}
                />
              </div>
            ) : (
              <div className="mx-auto my-8 max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Suporte do Guigui.com</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Entre na sua conta para abrir um ticket de suporte ou acompanhar as respostas da equipa.</p>
                <button type="button" onClick={() => setShowLoginModal(true)} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">Entrar</button>
              </div>
            )}
            </ErrorBoundary>
          )}

          {currentTab === 'client' && (
            currentUser?.role === 'user' ? (
              <ErrorBoundary currentLang={currentLang} area={getTranslation(currentLang, 'personalArea')}>
              <CitizenDashboard
                currentUser={currentUser}
                currentLang={currentLang}
                currentThemeMode={themeMode}
                onLanguageChange={setCurrentLang}
                onThemeModeChange={toggleTheme}
                purchaseOrders={personalPurchaseOrders}
                focusOrderId={focusedOrderId}
                focusConversationId={focusedConversationId}
                focusSupportId={focusedSupportId}
                reminders={visibleReminders}
                notifications={visibleNotifications}
                favoriteBusinesses={followedBusinesses}
                businesses={businesses}
                conversations={conversations}
                conversationMessages={conversationMessages}
                supportRequests={supportRequests}
                onCreateConversation={handleCreateConversation}
                onSendMessage={handleSendConversationMessage}
                onCreateSupport={handleCreateSupport}
                onReplySupport={handleReplySupport}
                onMarkConversationRead={handleMarkConversationRead}
                onMarkNotificationAsRead={handleMarkNotificationAsRead}
                onOpenNotification={handleOpenNotification}
                notificationPreferences={activeNotificationPreferences}
                onNotificationPreferencesChange={updateNotificationPreferences}
                onProfileChange={(profile) => setCurrentUser((previous) => previous ? { ...previous, ...profile } : previous)}
                onPasswordChange={handleCitizenPasswordChange}
                onDeactivateAccount={handleCitizenDeactivateAccount}
                onDeleteAccount={handleCitizenDeleteAccount}
                initialSection={clientStartSection}
                sidebarCollapsed={clientSidebarCollapsed}
                onSidebarCollapsedChange={setClientSidebarCollapsed}
                initialMessageBusinessId={messageBusinessId}
                onExplore={() => setCurrentTab('feed')}
              />
              </ErrorBoundary>
            ) : currentUser?.role === 'business' ? (
              activeBusiness ? (
                <ErrorBoundary currentLang={currentLang} area={getTranslation(currentLang, 'myBusinessArea')}>
                <BusinessDashboard
                  business={activeBusiness}
                  currentUser={currentUser}
                  businesses={businesses}
                  categories={marketplaceCategories}
                  followerCount={getFollowerIdsForBusiness(followedBusinessIdsByUser, activeBusiness.id).length}
                  audienceReach={getBusinessAudienceReach(activeBusiness)}
                  initialTab={businessDashboardStartTab}
                  currentLang={currentLang}
                  currentThemeMode={themeMode}
                  onLanguageChange={setCurrentLang}
                  onThemeModeChange={toggleTheme}
                  purchaseOrders={purchaseOrders}
                  onValidatePurchaseOrder={handleValidatePurchaseOrder}
                  onAddPost={handleAddPost}
                  onAddPromotion={handleAddPromotion}
                  onReplyReview={handleReplyReview}
                  onFlagReview={handleFlagReview}
                  onEventSubmitted={handleAddBusinessEvent}
                  onEventCancelled={handleCancelBusinessEvent}
                  onUpdateBusiness={handleUpdateBusiness}
                  onSaveBusinessProfile={handleSaveBusinessProfile}
                  onStoryPublished={handleAddStory}
                  notifications={visibleNotifications}
                  onMarkNotificationAsRead={handleMarkNotificationAsRead}
                  onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
                  onClearNotifications={handleClearNotifications}
                  onNavigateNotificationTab={(tab) => handleTabChange(tab as typeof currentTab)}
                  onOpenNotification={handleOpenNotification}
                  notificationPreferences={activeNotificationPreferences}
                  onNotificationPreferencesChange={updateNotificationPreferences}
                  conversations={conversations}
                  conversationMessages={conversationMessages}
                  supportRequests={supportRequests}
                  onCreateConversation={handleCreateConversation}
                  onSendMessage={handleSendConversationMessage}
                  onCreateSupport={handleCreateSupport}
                  onReplySupport={handleReplySupport}
                  onMarkConversationRead={handleMarkConversationRead}
                  focusConversationId={focusedConversationId}
                  focusSupportId={focusedSupportId}
                  onActiveTabChange={setBusinessDashboardStartTab}
                  sidebarCollapsed={businessSidebarCollapsed}
                  onSidebarCollapsedChange={setBusinessSidebarCollapsed}
                />
                </ErrorBoundary>
              ) : (
                <div className="mx-auto my-8 max-w-xl rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
                  <h2 className="text-lg font-black text-rose-900">Conta empresarial sem empresa associada</h2>
                  <p className="mt-2 text-xs leading-relaxed text-rose-800">Não foi possível localizar a empresa desta conta. Por segurança, nenhuma ficha de outra empresa será apresentada.</p>
                </div>
              )
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm my-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center mx-auto border border-slate-200">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  Área Reservada a Contas Comerciais / Empresas
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para aceder a esta área privada, inicie sessão com a conta correspondente. As contas cidadãs, empresariais e administrativas têm permissões separadas.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button type="button"
                    onClick={() => handleRequireLogin('Inicie sessão ou registe a sua Empresa para aceder ao Painel Comercial.')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs transition shadow-sm"
                  >
                    Entrar / Criar conta
                  </button>
                </div>
              </div>
            )
          )}

          {/* TAB 7: Administração Guigui */}
          {currentTab === 'admin' && (
            currentUser?.role === 'admin' ? (
              <ErrorBoundary currentLang={currentLang} area={getTranslation(currentLang, 'adminPanel')}>
              <AdminDashboard
                businesses={businesses}
                events={events}
                currentLang={currentLang}
                currentThemeMode={themeMode}
                onLanguageChange={setCurrentLang}
                onThemeModeChange={toggleTheme}
                onUpdateBusinesses={setBusinesses}
                onBusinessDecision={handleAdminBusinessDecision}
                adminStaff={adminStaff}
                auditLogs={auditLogs}
                onUpdateAdminStaff={setAdminStaff}
                onUpdateAuditLogs={setAuditLogs}
                notificationPreferences={activeNotificationPreferences}
                onNotificationPreferencesChange={updateNotificationPreferences}
                onSystemEvent={emitSystemEvent}
                supportRequests={supportRequests}
                onReplySupport={handleReplySupport}
                onUpdateSupportStatus={handleUpdateSupportStatus}
                focusSupportId={focusedSupportId}
                initialTab={adminDashboardStartTab}
                sidebarCollapsed={adminSidebarCollapsed}
                onSidebarCollapsedChange={setAdminSidebarCollapsed}
              />
              </ErrorBoundary>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm my-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white font-bold flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  Acesso Restrito - Administração Interna
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Esta secção é reservada exclusivamente aos administradores do portal Guigui.com. Não está disponível para contas de cidadãos ou empresas públicas.
                </p>
                <div className="pt-2 flex justify-center">
                  <button type="button"
                    onClick={() => setCurrentTab('feed')}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition border border-slate-200"
                  >
                    Voltar ao Feed Principal
                  </button>
                </div>
              </div>
            )
          )}

          {/* TAB 8: Páginas Institucionais / Anuncie */}
          {currentTab === 'institutional' && (
            <InstitutionalPages currentLang={currentLang} />
          )}
        </motion.main>
      </AnimatePresence>
    </div>

      {/* Floating Comparison Bar */}
      {currentTab === 'directory' && comparedBusinessIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-4 sm:px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center justify-between gap-3 max-w-lg w-[92vw]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex -space-x-2 shrink-0">
              {businesses
                .filter((b) => comparedBusinessIds.includes(b.id))
                .map((b) => (
                  <img
                    key={b.id}
                    src={b.logo}
                    alt={b.name}
                    className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover"
                  />
                ))}
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-xs text-emerald-400 block">
                {comparedBusinessIds.length} de 3 empresas selecionadas
              </span>
              <span className="text-[10px] text-slate-300 truncate block">
                {businesses.filter((b) => comparedBusinessIds.includes(b.id)).map((b) => b.name).join(', ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button type="button"
              onClick={() => setComparedBusinessIds([])}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition"
              title="Limpar Seleção"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button type="button"
              onClick={() => setShowComparisonModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              <Scale className="w-4 h-4" />
              <span>Comparar Tabela</span>
            </button>
          </div>
        </div>
      )}

      {/* Business Comparison Modal */}
      <BusinessComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        businesses={businesses.filter((b) => comparedBusinessIds.includes(b.id))}
        onRemoveBusiness={handleRemoveComparedBusiness}
        onSelectBusiness={(b) => setSelectedBusiness(b)}
        currentLang={currentLang}
      />

      {/* Business Detail Modal */}
      <BusinessDetailModal
        business={selectedBusiness}
        currentLang={currentLang}
        onClose={() => setSelectedBusiness(null)}
        onAddReview={handleAddReview}
        onFlagReview={handleFlagReview}
        currentUser={currentUser}
        onRequireLogin={handleRequireLogin}
        isFollowed={selectedBusiness ? followedBusinessIds.includes(selectedBusiness.id) : false}
        onToggleFollow={handleToggleBusinessFollow}
        onToggleNotifications={handleToggleBusinessNotifications}
        notificationsMuted={selectedBusiness ? isBusinessNotificationsMuted(selectedBusiness.id) : false}
        onMessage={handleOpenBusinessMessage}
        onContactMetric={handleBusinessContactMetric}
      />

      {/* Global Event Alerts & Scheduled Reminders Toast Manager */}
      <EventAlertsManager
        reminders={visibleReminders}
        onDismissReminder={(id) => {
          // Toast dismissed
        }}
        onRemoveReminder={handleRemoveReminder}
        onOpenEvent={(ev) => {
          setCurrentTab('events');
        }}
        onOpenBuyModal={(ev) => {
          setCurrentTab('events');
        }}
        events={events}
      />

      {/* Global Simulated SMS Gateway Toast */}
      <SmsSimulatorToast currentLang={currentLang} />

      {selectedNotification && (
        <div className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-[var(--color-bg-canvas)]/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setSelectedNotification(null); }}>
          <Panel className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border-subtle)]">
            <PanelHeader
              eyebrow="Notificação"
              title={selectedNotification.title}
              icon={<Bell className="h-5 w-5" />}
              actions={
                <button type="button" onClick={() => setSelectedNotification(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-default)]" aria-label="Fechar detalhe da notificação" title="Fechar"><X className="h-4 w-4" /></button>
              }
            />
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">{selectedNotification.message}</p>
            <div className="mt-5 grid gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3 text-[11px]">
              <div className="flex justify-between gap-3"><span className="font-bold text-[var(--color-text-muted)]">Estado</span><span className="font-black text-[var(--color-green-600)]">Lida</span></div>
              <div className="flex justify-between gap-3"><span className="font-bold text-[var(--color-text-muted)]">Recebida</span><span className="font-semibold text-[var(--color-text-strong)]">{selectedNotification.timeAgo || new Date(selectedNotification.createdAt).toLocaleString('pt-PT')}</span></div>
              {selectedNotification.metadata?.orderCode && <div className="flex justify-between gap-3"><span className="font-bold text-[var(--color-text-muted)]">Código</span><span className="font-mono font-black text-[var(--color-blue-700)]">{String(selectedNotification.metadata.orderCode)}</span></div>}
            </div>
            <button type="button" onClick={() => setSelectedNotification(null)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-[var(--color-green-600)] px-4 py-3 text-xs font-black text-white hover:bg-[var(--color-green-700)] shadow-[var(--shadow-xs)]"><span>{selectedNotification.actionLabel || 'Abrir item relacionado'}</span><ExternalLink className="h-4 w-4 text-white" /></button>
          </Panel>
        </div>
      )}

      {/* Global Footer */}
      <Footer
        currentLang={currentLang}
        currentRole={currentRole}
        onTabChange={handleTabChange}
        sidebarOffset={
          currentTab === 'client'
            ? currentRole === 'user'
              ? (clientSidebarCollapsed ? 72 : 248)
              : (businessSidebarCollapsed ? 72 : 248)
            : currentTab === 'admin'
              ? (adminSidebarCollapsed ? 72 : 260)
              : 0
        }
      />
      </div>

      </PostEngagementProvider>
    </Suspense>
  );
}
