import React, { useMemo, useState, useEffect } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  Heart,
  LockKeyhole,
  MapPin,
  Palette,
  ShieldCheck,
  UserX,
  Ticket,
  UserRound,
  WalletCards,
  X,
  MessageCircle,
  LifeBuoy,
} from 'lucide-react';
import { AppNotification, Business, Conversation, ConversationMessage, EventReminder, Language, NotificationPreferences, PurchaseOrder, SupportCategory, SupportRequest, UserProfile } from '../types';
import { CommunicationHub } from './CommunicationHub';
import { QRCodeDisplay } from './QRCodeDisplay';
import { MyTicketsPanel } from './MyTicketsPanel';
import { formatCurrencyXOF, getLanguageShortLabel, getNextLanguage, getTranslation } from '../utils/i18n';
import { Badge, Button, Card, EmptyState, IconButton, Panel, PanelHeader, StatCard } from './ui';

interface CitizenDashboardProps {
  currentUser: UserProfile;
  currentLang: Language;
  currentThemeMode?: 'light' | 'dark' | 'auto';
  onLanguageChange?: (lang: Language) => void;
  onThemeModeChange?: (mode: 'light' | 'dark' | 'auto') => void;
  purchaseOrders: PurchaseOrder[];
  focusOrderId?: string | null;
  focusConversationId?: string | null;
  focusSupportId?: string | null;
  initialSection?: 'overview' | 'support' | 'tickets';
  initialMessageBusinessId?: string | null;
  reminders: EventReminder[];
  notifications: AppNotification[];
  favoriteBusinesses: Business[];
  businesses: Business[];
  conversations: Conversation[];
  conversationMessages: ConversationMessage[];
  supportRequests: SupportRequest[];
  onCreateConversation: (businessId: string, subject: string, text: string) => void;
  onSendMessage: (conversationId: string, text: string) => void;
  onCreateSupport: (subject: string, description: string, businessId?: string, category?: SupportCategory) => void;
  onReplySupport: (requestId: string, text: string) => void;
  onMarkConversationRead: (conversationId: string) => void;
  onMarkNotificationAsRead?: (id: string) => void;
  onOpenNotification?: (notification: AppNotification) => void;
  notificationPreferences?: NotificationPreferences;
  onNotificationPreferencesChange?: (next: NotificationPreferences) => void;
  onProfileChange?: (profile: Partial<UserProfile>) => void;
  onPasswordChange?: (currentPassword: string, newPassword: string) => Promise<void>;
  onDeactivateAccount?: () => Promise<void>;
  onDeleteAccount?: () => Promise<void>;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  onExplore: () => void;
}

type CitizenSection = 'overview' | 'system-settings' | 'personal-settings' | 'privacy-settings' | 'account-data' | 'tickets' | 'purchases' | 'notifications' | 'messages' | 'support';

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  currentUser,
  currentLang,
  currentThemeMode = 'auto',
  onLanguageChange,
  onThemeModeChange,
  purchaseOrders,
  focusOrderId,
  focusConversationId,
  focusSupportId,
  initialSection = 'overview',
  initialMessageBusinessId,
  reminders,
  notifications,
  favoriteBusinesses,
  businesses,
  conversations,
  conversationMessages,
  supportRequests,
  onCreateConversation,
  onSendMessage,
  onCreateSupport,
  onReplySupport,
  onMarkConversationRead,
  onMarkNotificationAsRead,
  onOpenNotification,
  notificationPreferences,
  onNotificationPreferencesChange,
  onProfileChange,
  onPasswordChange,
  onDeactivateAccount,
  onDeleteAccount,
  sidebarCollapsed: controlledSidebarCollapsed,
  onSidebarCollapsedChange,
  onExplore,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const formatXOF = (value: number) => formatCurrencyXOF(value, currentLang);
  const [section, setSection] = useState<CitizenSection>(initialSection);

  React.useEffect(() => {
    if (!focusConversationId && !focusSupportId) setSection(initialSection);
  }, [focusConversationId, focusSupportId, initialSection, initialMessageBusinessId]);
    const [selectedTicket, setSelectedTicket] = useState<PurchaseOrder | null>(null);

  // Allow closing the ticket modal via the Escape key for better accessibility
  useEffect(() => {
    if (!selectedTicket) return;
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTicket(null);
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [selectedTicket]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name,
    email: currentUser.email || '',
    phone: currentUser.phone,
    neighborhood: currentUser.neighborhood,
    avatarUrl: currentUser.avatarUrl,
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [privacySettings, setPrivacySettings] = useState(currentUser.privacySettings || {
    privateProfile: true,
    sessionAlerts: true,
    secureMessages: true,
    dataPersonalization: true,
  });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirmation: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(Boolean(currentUser.passwordChangedAt));
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [ticketPreference, setTicketPreference] = useState<'digital' | 'both'>(currentUser.ticketPreference || 'digital');
  const [communicationPreference, setCommunicationPreference] = useState<'email' | 'sms' | 'both'>(currentUser.communicationPreference || 'both');

  React.useEffect(() => {
    setProfileForm({
      name: currentUser.name,
      email: currentUser.email || '',
      phone: currentUser.phone,
      neighborhood: currentUser.neighborhood,
      avatarUrl: currentUser.avatarUrl,
    });
    setPrivacySettings(currentUser.privacySettings || {
      privateProfile: true,
      sessionAlerts: true,
      secureMessages: true,
      dataPersonalization: true,
    });
    setTicketPreference(currentUser.ticketPreference || 'digital');
    setCommunicationPreference(currentUser.communicationPreference || 'both');
    setPasswordChanged(Boolean(currentUser.passwordChangedAt));
  }, [currentUser]);

  const updateProfile = (profile: Partial<UserProfile>) => onProfileChange?.(profile);

  React.useEffect(() => {
    if (focusConversationId || focusSupportId) {
      setSection('support');
      return;
    }
    if (!focusOrderId) return;
    const order = purchaseOrders.find((candidate) => candidate.id === focusOrderId);
    if (order) {
      setSection(order.itemType === 'ticket' ? 'tickets' : 'purchases');
      if (order.itemType === 'ticket') setSelectedTicket(order);
    }
  }, [focusConversationId, focusOrderId, focusSupportId, purchaseOrders]);

  const ticketOrders = useMemo(() => purchaseOrders.filter((order) => order.itemType === 'ticket'), [purchaseOrders]);
  const nonTicketOrders = useMemo(() => purchaseOrders.filter((order) => order.itemType !== 'ticket'), [purchaseOrders]);
  const pendingOrders = purchaseOrders.filter((order) => order.status === 'pending');
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode((current) => current === code ? null : current), 1800);
  };

  const statusLabel = (status: PurchaseOrder['status']) => status === 'redeemed' ? t('ticketUsed') : status === 'cancelled' ? t('ticketCancelled') : t('ticketPending');
  const statusClass = (status: PurchaseOrder['status']) => status === 'redeemed'
    ? 'bg-[var(--color-green-100)] text-[var(--color-green-700)] dark:bg-[var(--color-green-950)/50] dark:text-[var(--color-green-300)]'
    : status === 'cancelled'
      ? 'bg-[var(--color-red-100)] text-[var(--color-red-700)] dark:bg-[var(--color-red-950)/50] dark:text-[var(--color-red-300)]'
      : 'bg-[var(--color-yellow-100)] text-[var(--color-yellow-700)] dark:bg-[var(--color-yellow-950)/50] dark:text-[var(--color-yellow-300)]';

  const settingToggle = (key: keyof typeof privacySettings, label: string, description: string) => (
    <Panel className="flex cursor-pointer items-center justify-between gap-4">
      <span><span className="block text-sm font-black text-[var(--color-text-strong)]">{label}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">{description}</span></span>
      <input type="checkbox" checked={privacySettings[key]} onChange={(event) => { const next = { ...privacySettings, [key]: event.target.checked }; setPrivacySettings(next); updateProfile({ privacySettings: next }); }} className="h-5 w-5 accent-[var(--color-green-600)]" />
    </Panel>
  );

  const fieldClass = 'mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-green-600)]';

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setProfileError('Selecione uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('A fotografia deve ter no máximo 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        setProfileError('Não foi possível carregar a fotografia.');
        return;
      }
      setProfileError('');
      setProfileForm((current) => ({ ...current, avatarUrl: result }));
    };
    reader.onerror = () => setProfileError('Não foi possível carregar a fotografia.');
    reader.readAsDataURL(file);
  };

  const renderOrderCard = (order: PurchaseOrder, isTicket = false) => (
    <Card key={order.id} className="p-4" interactive>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isTicket ? 'bg-[var(--color-blue-100)] text-[var(--color-blue-700)]' : 'bg-[var(--color-yellow-100)] text-[var(--color-yellow-700)]'}`}>
          {isTicket ? <Ticket className="h-5 w-5" aria-hidden="true" /> : <WalletCards className="h-5 w-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-black text-[var(--color-text-strong)]">{order.itemTitle}</p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">{order.businessName} Â· {new Date(order.purchasedAt).toLocaleDateString('pt-PT')}</p>
          <p className="mt-1 font-mono text-[11px] font-black tracking-wide text-[var(--color-blue-600)]">{order.orderCode}</p>
        </div>
        <Badge variant="neutral" className={`shrink-0 border-0 px-2 py-1 text-[9px] uppercase ${statusClass(order.status)}`}>{statusLabel(order.status)}</Badge>
      </div>
      {isTicket && order.ticketCredentials && order.ticketCredentials.length > 1 && <div className="mt-3 rounded-xl bg-[var(--color-blue-50)] p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--color-blue-600)]">Credenciais individuais ({order.ticketCredentials.length})</p><div className="grid gap-2 sm:grid-cols-2">{order.ticketCredentials.map((credential, index) => <button key={credential.id} type="button" onClick={() => setSelectedTicket({ ...order, orderCode: credential.ticketCode, qrToken: credential.qrToken, ticketPin: credential.pinCode, customerName: credential.holderName || order.customerName, customerPhone: credential.holderPhone || order.customerPhone })} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2.5 py-2 text-left text-[10px] font-black text-[var(--color-text-strong)] hover:border-[var(--color-green-600)]">{index + 1}. {credential.holderName || order.holderName || order.customerName}<span className="mt-0.5 block font-mono text-[9px]">{credential.ticketCode}</span></button>)}</div></div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-3">
        <span className="text-xs font-black text-[var(--color-text-strong)]">{formatXOF(order.totalPriceXOF)}</span>
        {isTicket && (
          <Button type="button" variant="primary" size="sm" onClick={() => setSelectedTicket(order)} className="min-h-10 bg-[var(--color-green-600)] text-[11px] hover:bg-[var(--color-green-700)]">
            Abrir bilhete <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </Card>
  );

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [internalSidebarCollapsed, setInternalSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('guigui-citizen-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const sidebarCollapsed = controlledSidebarCollapsed ?? internalSidebarCollapsed;
  const setSidebarCollapsed = (next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(sidebarCollapsed) : next;
    onSidebarCollapsedChange?.(value);
    if (!onSidebarCollapsedChange) setInternalSidebarCollapsed(value);
  };

  React.useEffect(() => {
    try {
      window.localStorage.setItem('guigui-citizen-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Ignore storage write issues in restricted environments.
    }
  }, [sidebarCollapsed]);

  const citizenNavigationGroups: Array<{ heading: string; items: Array<{ id: CitizenSection; label: string; icon: React.ElementType; count?: number }> }> = [
    { heading: 'Geral', items: [
      { id: 'overview', label: 'Minha Conta', icon: WalletCards },
      { id: 'tickets', label: 'Meus bilhetes', icon: Ticket, count: ticketOrders.length },
      { id: 'purchases', label: 'Compras', icon: WalletCards, count: nonTicketOrders.length },
    ] },
    { heading: 'Atendimento', items: [
      { id: 'notifications', label: 'Notificações', icon: Bell, count: unreadNotifications },
      { id: 'support', label: 'Suporte', icon: LifeBuoy },
    ] },
    { heading: 'Gestão da conta', items: [
      { id: 'account-data', label: 'Dados e conta', icon: UserX },
      { id: 'system-settings', label: 'Definições do sistema', icon: Palette },
      { id: 'personal-settings', label: 'Configurações pessoais', icon: UserRound },
      { id: 'privacy-settings', label: 'Privacidade', icon: ShieldCheck },
    ] },
  ];

  const currentCitizenSection = citizenNavigationGroups.flatMap((group) => group.items).find((item) => item.id === section)?.label || 'Minha Conta';
  const effectivePrivacySettings = currentUser.privacySettings || privacySettings;
  const privacyStatusLabel = effectivePrivacySettings.privateProfile ? 'Perfil privado activo' : 'Perfil visível';
  const passwordStatusLabel = currentUser.passwordChangedAt ? `Palavra-passe actualizada em ${new Date(currentUser.passwordChangedAt).toLocaleDateString('pt-PT')}` : 'Palavra-passe protegida';
  const themeLabel = currentThemeMode === 'dark' ? 'Escuro' : currentThemeMode === 'light' ? 'Claro' : 'Auto';
  const nextThemeMode: 'light' | 'dark' | 'auto' = currentThemeMode === 'dark' ? 'light' : currentThemeMode === 'light' ? 'auto' : 'dark';
  const languageLabel = getLanguageShortLabel(currentLang);
  const nextLanguage: Language = getNextLanguage(currentLang);

  return (
    <div className="guigui-profile-dashboard w-full min-h-[calc(100vh-72px)] bg-[var(--color-bg-surface)]">
      <div className="flex min-h-[calc(100vh-72px)] w-full bg-[var(--color-bg-surface)]">
        <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} fixed inset-0 z-40 bg-[var(--color-bg-surface)]/60 backdrop-blur-[1px] md:hidden`} onClick={() => setMobileSidebarOpen(false)} />

        <aside
          style={{ width: sidebarCollapsed ? 72 : 248 }}
          className={`${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-[120px] z-50 h-[calc(100vh-120px)] max-w-[calc(100vw-16px)] shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)] transition-[transform,box-shadow,width] duration-300 ease-out md:top-[120px] md:h-[calc(100vh-120px)] md:translate-x-0`}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/90 px-1.5 py-2.5 backdrop-blur-sm">
              <div className={`flex items-center ${sidebarCollapsed ? 'w-full justify-center' : 'gap-1.5'} pl-0.5`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-bg-surface)] text-[11px] font-black text-[var(--color-text-muted)] shadow-sm">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{t('personalArea')}</div>
                    <div className="text-lg font-black text-[var(--color-text-strong)]">Guigui.com</div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <IconButton
                  label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </IconButton>
                <IconButton
                  label={`${t('close')} menu lateral`}
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
              {citizenNavigationGroups.map((group) => (
                <div key={group.heading} className={`${sidebarCollapsed ? 'space-y-1.5' : 'space-y-2'}`}>
                  {!sidebarCollapsed && (
                    <div className="px-2 text-[8px] font-black uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{group.heading}</div>
                  )}

                  <div className={`${sidebarCollapsed ? 'space-y-1.5' : 'space-y-1'}`}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = section === item.id;

                      return (
                        <React.Fragment key={item.id}>
                        <button
                            type="button"
                            onClick={() => {
                              setSection(item.id);
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
                            </div>
                          )}

                          {!sidebarCollapsed && typeof item.count === 'number' && (
                            <Badge variant={isActive ? 'verified' : 'neutral'} className={`border-0 px-1.5 py-0.5 text-[9px] ${isActive ? 'bg-[var(--color-green-600)]/20 text-white' : ''}`}>{item.count}</Badge>
                          )}
                        </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/80 p-2">
              <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2">
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'} rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-green-100)] text-[var(--color-green-700)]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{t('activeAccountLabel')}</div>
                      <div className="truncate text-xs font-black text-[var(--color-text-strong)]">{currentUser.name}</div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </aside>

        <main
          style={{ '--citizen-sidebar-width': `${sidebarCollapsed ? 72 : 248}px` } as React.CSSProperties}
          className="min-w-0 flex-1 overflow-visible bg-[var(--color-bg-surface)] px-4 pb-4 pt-1 sm:px-5 sm:pb-5 sm:pt-2 md:ml-[var(--citizen-sidebar-width)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconButton
                label="Abrir menu lateral"
                variant="secondary"
                size="sm"
                className="h-9 w-9 rounded-full md:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </IconButton>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{t('citizen.citizenLabel')}</div>
                <h1 className="mt-1 text-xl font-black text-[var(--color-text-strong)] sm:text-2xl">{currentCitizenSection}</h1>
              </div>
            </div>
          </div>

          <section className="space-y-4" aria-labelledby="citizen-dashboard-title">
            <div className="relative overflow-hidden rounded-3xl bg-[var(--color-bg-surface-dark)] px-4 py-4 text-white shadow-xl sm:px-6 sm:py-5">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--color-blue-500)]/20 blur-3xl" />
              <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[var(--color-amber-400)]/15 blur-3xl" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img src={currentUser.avatarUrl} alt={`Fotografia de ${currentUser.name}`} className="h-12 w-12 rounded-xl border-2 border-white/20 object-cover shadow-lg sm:h-16 sm:w-16" />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--color-bg-surface-dark)] bg-[var(--color-green-500)] text-white" title={t('activeAccountLabel')}><CheckCircle2 className="h-3 w-3" aria-hidden="true" /></span>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-blue-200)]">{t('personalArea')}</p>
                    <h1 id="citizen-dashboard-title" className="truncate text-lg font-black tracking-tight sm:text-xl">Olá, {currentUser.name.split(' ')[0]}</h1>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-slate-300)]"><MapPin className="h-3.5 w-3.5 text-[var(--color-amber-300)]" aria-hidden="true" />{currentUser.neighborhood} Â· Conta cidadã</p>
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={onExplore} className="bg-[var(--color-bg-surface)] text-[11px] font-black text-[var(--color-text-strong)] shadow-lg hover:bg-[var(--color-blue-50)]">{t('exploreGuigui')}<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
              </div>
            </div>

            {section === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Bilhetes', value: ticketOrders.length, icon: Ticket, tone: 'info' as const },
              { label: 'Compras pendentes', value: pendingOrders.length, icon: WalletCards, tone: 'warning' as const },
              { label: 'Lembretes', value: reminders.length, icon: CalendarDays, tone: 'accent' as const },
              { label: 'Por ler', value: unreadNotifications, icon: Bell, tone: 'danger' as const },
            ].map((stat) => (
              <StatCard key={stat.label} icon={stat.icon} tone={stat.tone} label={stat.label} value={stat.value} />
            ))}
          </div>

          <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5" aria-label={t('citizen.systemSettingsModule')}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] dark:bg-[var(--color-bg-surface-dark)] dark:text-[var(--color-text-muted-dark)]">
                <Palette className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{t('citizen.personalAreaModule')}</p>
                <h2 className="mt-1 text-base font-black text-[var(--color-text-strong)]">{t('citizen.systemSettings')}</h2>
                <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)] dark:text-[var(--color-text-strong-dark)]">{t('citizen.personalSettings')}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">{t('citizen.personalSettingsHint')}</p>
              </div>
            </div>
          </article>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-blue-700)]">Actividade recente</p><h2 className="mt-1 text-base font-black text-[var(--color-text-strong)]">Os meus bilhetes</h2></div><Ticket className="h-5 w-5 text-[var(--color-green-600)]" aria-hidden="true" /></div>
              <div className="grid gap-3 sm:grid-cols-2">{ticketOrders.slice(0, 4).map((order) => renderOrderCard(order, true))}</div>
              {ticketOrders.length === 0 && <EmptyState title={t('noTicketsExplore')} description="Os seus bilhetes aparecerão aqui depois de uma compra." icon={<Ticket className="h-6 w-6" aria-hidden="true" />} />}
            </div>
            <div className="space-y-5">
              <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[var(--color-violet-600)]" aria-hidden="true" /><h2 className="text-base font-black text-[var(--color-text-strong)]">{t('citizen.upcomingReminders')}</h2></div><div className="space-y-3">{reminders.slice(0, 3).map((reminder) => <div key={reminder.id} className="rounded-2xl bg-[var(--color-violet-50)] p-3 dark:bg-[var(--color-violet-950)]/20"><p className="truncate text-xs font-black text-[var(--color-violet-950)] dark:text-[var(--color-violet-100)]">{reminder.eventTitle}</p><p className="mt-1 text-[10px] font-semibold text-[var(--color-violet-700)] dark:text-[var(--color-violet-300)]">{reminder.eventDate} Â· {reminder.eventTime}</p></div>)}{reminders.length === 0 && <EmptyState title="Sem lembretes activos" description="Os eventos que guardar aparecerão neste espaço." icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />} />}</div></Card>
              <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><Heart className="h-5 w-5 text-[var(--color-rose-600)]" aria-hidden="true" /><h2 className="text-base font-black text-[var(--color-text-strong)]">Empresas seguidas</h2></div>{favoriteBusinesses.length > 0 ? <div className="space-y-2">{favoriteBusinesses.slice(0, 3).map((business) => <p key={business.id} className="truncate rounded-xl bg-[var(--color-rose-50)] px-3 py-2 text-xs font-bold text-[var(--color-rose-950)] dark:bg-[var(--color-rose-950)]/20 dark:text-[var(--color-rose-200)]">{business.name}</p>)}</div> : <EmptyState title={t('citizen.noFollowedBusinesses')} description="As empresas que seguir aparecem aqui e enviam notificações quando publicam novidades." icon={<Heart className="h-6 w-6" aria-hidden="true" />} />}</Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2"><Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-emerald-100)] text-[var(--color-emerald-700)] dark:bg-[var(--color-emerald-950)]/40 dark:text-[var(--color-emerald-300)]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-base font-black text-[var(--color-text-strong)]">{t('citizen.securityPrivacy')}</h2><p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{effectivePrivacySettings.privateProfile ? 'O perfil está restrito à sua área autenticada.' : 'O perfil está configurado como visível.'}</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-subtle)] p-3 text-[11px] font-bold text-[var(--color-text-strong)] dark:bg-[var(--color-bg-subtle-dark)] dark:text-[var(--color-text-muted-dark)]"><LockKeyhole className="h-4 w-4 text-[var(--color-emerald-600)]" aria-hidden="true" /> {passwordStatusLabel}</div><div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-subtle)] p-3 text-[11px] font-bold text-[var(--color-text-strong)] dark:bg-[var(--color-bg-subtle-dark)] dark:text-[var(--color-text-muted-dark)]"><UserRound className="h-4 w-4 text-[var(--color-green-600)]" aria-hidden="true" /> {privacyStatusLabel}</div><div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-subtle)] p-3 text-[11px] font-bold text-[var(--color-text-strong)] dark:bg-[var(--color-bg-subtle-dark)] dark:text-[var(--color-text-muted-dark)]"><MessageCircle className="h-4 w-4 text-[var(--color-violet-600)]" aria-hidden="true" /> {effectivePrivacySettings.secureMessages ? 'Comunicação protegida' : 'Comunicação não protegida'}</div><div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-subtle)] p-3 text-[11px] font-bold text-[var(--color-text-strong)] dark:bg-[var(--color-bg-subtle-dark)] dark:text-[var(--color-text-muted-dark)]"><Bell className="h-4 w-4 text-[var(--color-green-600)]" aria-hidden="true" /> {effectivePrivacySettings.sessionAlerts ? 'Alertas de sessão activos' : 'Alertas de sessão desactivados'}</div></div></Card><Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><Bell className="h-5 w-5 text-[var(--color-green-600)]" aria-hidden="true" /><h2 className="text-base font-black text-[var(--color-text-strong)]">{t('citizen.recentNotifications')}</h2></div><div className="space-y-2">{notifications.slice(0, 3).map((notification) => <button type="button" key={notification.id} onClick={() => { onMarkNotificationAsRead?.(notification.id); onOpenNotification?.(notification); }} className="flex w-full gap-2 rounded-xl bg-[var(--color-bg-subtle)] p-3 text-left transition hover:bg-[var(--color-bg-subtle-dark)] dark:bg-[var(--color-bg-surface-dark)] dark:hover:bg-[var(--color-bg-surface-dark)]/80"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-[var(--color-border-subtle)]' : 'bg-[var(--color-amber-500)]'}`} /><span className="line-clamp-2 text-[11px] font-semibold leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">{notification.message || notification.title}</span></button>)}{notifications.length === 0 && <EmptyState title={t('citizen.noRecentNotifications')} description="As notificações da sua conta aparecerão aqui." icon={<Bell className="h-6 w-6" aria-hidden="true" />} />}</div></Card></div>
        </>
      )}

      {section === 'tickets' && (
        <MyTicketsPanel
          currentLang={currentLang}
          fallback={ticketOrders.length > 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-amber-300)] bg-[var(--color-amber-50)]/60 p-4 dark:border-[var(--color-amber-800)] dark:bg-[var(--color-amber-950)]/20">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">{t('citizen.demoData')}</p>
              <p className="mb-4 text-xs leading-relaxed text-amber-900 dark:text-amber-200">{t('citizen.demoDataHint')}</p>
              <div className="grid gap-3 md:grid-cols-2">{ticketOrders.map((order) => renderOrderCard(order, true))}</div>
            </div>
          ) : undefined}
        />
      )}

      {section === 'system-settings' && <div className="space-y-5">
        <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-violet-100)] text-[var(--color-violet-700)] dark:bg-[var(--color-violet-950)]/40 dark:text-[var(--color-violet-300)]"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-violet-600)]">Funcionamento da plataforma</p><h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">{t('citizen.systemSettings')}</h2><p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{t('citizen.securityChangesSaved')}</p></div></div></Card>
        <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-[var(--color-emerald-600)]" /><h2 className="text-base font-black text-[var(--color-text-strong)]">{t('account.security')}</h2></div><div className="grid gap-4 sm:grid-cols-3"><input type="password" placeholder="Palavra-passe atual" value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} className={fieldClass} /><input type="password" placeholder="Nova palavra-passe" value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} className={fieldClass} /><input type="password" placeholder="Confirmar nova palavra-passe" value={passwordForm.confirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmation: event.target.value }))} className={fieldClass} /></div><Button type="button" variant="primary" size="sm" loading={passwordSubmitting} onClick={async () => { if (!passwordForm.current) { setPasswordMessage('Informe a palavra-passe atual.'); return; } if (passwordForm.next.length < 8) { setPasswordMessage('A nova palavra-passe deve ter pelo menos 8 caracteres.'); return; } if (passwordForm.next !== passwordForm.confirmation) { setPasswordMessage('A confirmação da nova palavra-passe não coincide.'); return; } if (!onPasswordChange) { setPasswordMessage('A alteração de palavra-passe não está disponível.'); return; } setPasswordSubmitting(true); setPasswordMessage(''); try { await onPasswordChange(passwordForm.current, passwordForm.next); setPasswordChanged(true); setPasswordForm({ current: '', next: '', confirmation: '' }); setPasswordMessage('Palavra-passe atualizada com sucesso.'); } catch (error) { setPasswordMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a palavra-passe.'); } finally { setPasswordSubmitting(false); } }} className="mt-4 bg-[var(--color-green-600)] hover:bg-[var(--color-green-700)]">{passwordSubmitting ? 'A atualizar...' : 'Atualizar palavra-passe'}</Button>{passwordMessage && <p className={`mt-2 text-xs font-bold ${passwordMessage.includes('sucesso') ? 'text-[var(--color-emerald-600)]' : 'text-[var(--color-rose-600)]'}`}>{passwordMessage}</p>}{passwordChanged && !passwordMessage.includes('sucesso') && <p className="mt-2 text-xs font-bold text-[var(--color-emerald-600)]">{t('citizen.passwordUpdated')}</p>}</Card>
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[var(--color-green-600)]" /><h2 className="text-base font-black text-[var(--color-text-strong)]">{t('citizen.communicationPreferences')}</h2></div><div className="flex flex-wrap gap-2">{(['email', 'sms', 'both'] as const).map((option) =>         <button key={option} type="button" onClick={() => { setCommunicationPreference(option); updateProfile({ communicationPreference: option }); }} className={`rounded-xl px-3 py-2 text-xs font-black ${communicationPreference === option ? 'bg-[var(--color-green-600)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] dark:bg-[var(--color-bg-surface-dark)] dark:text-[var(--color-text-muted-dark)]'}`}>{option === 'both' ? 'E-mail e telefone' : option === 'email' ? 'E-mail' : 'Telefone'}</button>)}</div></div>
      </div>}

      {section === 'privacy-settings' && <div className="space-y-5">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-emerald-100)] text-[var(--color-emerald-700)] dark:bg-[var(--color-emerald-950)]/40 dark:text-[var(--color-emerald-300)]"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-emerald-600)]">{t('citizen.accountModule')}</p><h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">Privacidade</h2><p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{t('citizen.accountModuleHint')}</p></div></div></div>
        <div className="grid gap-3 lg:grid-cols-2">{settingToggle('privateProfile', 'Perfil privado', 'O seu perfil e dados pessoais ficam visíveis apenas na sua área autenticada.')}{settingToggle('sessionAlerts', 'Alertas de segurança', 'Receba avisos quando uma nova sessão ou dispositivo aceder à sua conta.')}{settingToggle('secureMessages', 'Comunicação protegida', 'Mantenha mensagens e pedidos de suporte acessíveis apenas aos participantes autorizados.')}{settingToggle('dataPersonalization', 'Personalização de dados', 'Permita que a plataforma use os seus favoritos e histórico para melhorar a experiência.')}</div>
        <div className="rounded-2xl border border-[var(--color-emerald-200)] bg-[var(--color-emerald-50)] p-4 text-xs font-semibold leading-relaxed text-[var(--color-emerald-800)] dark:border-[var(--color-emerald-900)] dark:bg-[var(--color-emerald-950)]/30 dark:text-[var(--color-emerald-200)]">{t('citizen.changesAppliedNote')}</div>
      </div>}

      {section === 'account-data' && <div className="space-y-5">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-rose-100)] text-[var(--color-rose-700)] dark:bg-[var(--color-rose-950)]/40 dark:text-[var(--color-rose-300)]"><UserX className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-rose-600)]">{t('citizen.accountManagement')}</p>
              <h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">Dados e conta</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">Escolha o que fazer com a sua conta e com os seus dados pessoais.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-4 dark:border-[var(--color-amber-900)]/60 dark:bg-[var(--color-amber-950)]/20">
            <h3 className="text-sm font-black text-[var(--color-amber-950)] dark:text-[var(--color-amber-100)]">Desativar temporariamente a conta</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-amber-900)]/75 dark:text-[var(--color-amber-200)]/80">{t('citizen.deactivateHint')}</p>
            <Button type="button" variant="secondary" size="sm" onClick={async () => { if (window.confirm('Desativar a sua conta temporariamente? Poderá reativá-la ao voltar a iniciar sessão.')) await onDeactivateAccount?.(); }} className="mt-3 border-[var(--color-amber-300)] bg-[var(--color-bg-surface)] text-[var(--color-amber-950)] hover:bg-[var(--color-amber-100)] dark:border-[var(--color-amber-800)] dark:bg-[var(--color-amber-950)]/40 dark:text-[var(--color-amber-100)]">Desativar a minha conta</Button>
          </div>
          <div className="rounded-2xl border border-[var(--color-rose-200)] bg-[var(--color-rose-50)] p-4 dark:border-[var(--color-rose-900)]/60 dark:bg-[var(--color-rose-950)]/20">
            <h3 className="text-sm font-black text-[var(--color-rose-950)] dark:text-[var(--color-rose-100)]">Eliminar a conta permanentemente</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-rose-900)]/75 dark:text-[var(--color-rose-200)]/80">{t('citizen.deleteAccountHint')}</p>
            <Button type="button" variant="danger" size="sm" onClick={async () => { if (window.confirm('Eliminar permanentemente a sua conta? Esta ação não pode ser desfeita.')) await onDeleteAccount?.(); }} className="mt-3 bg-[var(--color-rose-600)] hover:bg-[var(--color-rose-700)]">Eliminar a minha conta</Button>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4 text-xs font-semibold leading-relaxed text-[var(--color-text-muted)] dark:border-[var(--color-border-subtle-dark)] dark:bg-[var(--color-bg-subtle-dark)] dark:text-[var(--color-text-muted-dark)]">{t('citizen.ownerActionsNote')}</div>
      </div>}

      {section === 'personal-settings' && <div className="space-y-5">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-blue-100)] text-[var(--color-blue-700)] dark:bg-[var(--color-blue-950)]/40 dark:text-[var(--color-blue-300)]"><UserRound className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-green-600)]">{t('citizen.citizenData')}</p><h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">{t('citizen.personalSettings')}</h2><p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{t('citizen.citizenDataHint')}</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-black text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">Nome<input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label><label className="text-xs font-black text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">Fotografia de perfil<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-green-600)] file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white`} /><span className="mt-1 block text-[10px] font-semibold text-[var(--color-text-muted)]">{t('citizen.photoFormats')}</span>{profileForm.avatarUrl && <img src={profileForm.avatarUrl} alt={t('citizen.photoPreview')} className="mt-2 h-16 w-16 rounded-2xl object-cover" />}</label><label className="text-xs font-black text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">E-mail<input type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} className={fieldClass} /></label><label className="text-xs font-black text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">Telefone<input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} className={fieldClass} /></label><label className="text-xs font-black text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)] sm:col-span-2">{t('citizen.neighborhood')}<input value={profileForm.neighborhood} onChange={(event) => setProfileForm((current) => ({ ...current, neighborhood: event.target.value }))} className={fieldClass} /></label></div><button type="button" onClick={() => { onProfileChange?.(profileForm); setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 2500); }} className="mt-4 rounded-xl bg-[var(--color-green-600)] px-4 py-2.5 text-xs font-black text-white hover:bg-[var(--color-green-700)]">Guardar dados pessoais</button>{profileSaved && <span className="ml-3 text-xs font-bold text-[var(--color-emerald-600)]">Dados guardados.</span>}{profileError && <p className="mt-2 text-xs font-bold text-[var(--color-rose-600)]">{profileError}</p>}</div>
        <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><Ticket className="h-5 w-5 text-[var(--color-green-600)]" /><h2 className="text-base font-black text-[var(--color-text-strong)]">{t('citizen.ticketPreferences')}</h2></div><div className="flex flex-wrap gap-2">{(['digital', 'both'] as const).map((option) =>         <button key={option} type="button" onClick={() => { setTicketPreference(option); updateProfile({ ticketPreference: option }); }} className={`rounded-xl px-3 py-2 text-xs font-black ${ticketPreference === option ? 'bg-[var(--color-green-600)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] dark:bg-[var(--color-bg-surface-dark)] dark:text-[var(--color-text-muted-dark)]'}`}>{option === 'digital' ? 'Bilhete digital' : 'Digital e comprovativo'}</button>)}</div></div><div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><Heart className="h-5 w-5 text-[var(--color-rose-600)]" /><h2 className="text-base font-black text-[var(--color-text-strong)]">Favoritos e mensagens</h2></div><p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{favoriteBusinesses.length ? `${favoriteBusinesses.length} empresa(s) seguida(s) na sua conta.` : 'Ainda não segue nenhuma empresa.'} As mensagens comerciais e pedidos de suporte permanecem separados.</p></div></div>
      </div>}

      {section === 'purchases' && <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-green-600)]">{t('citizen.accountHistory')}</p><h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">Compras e reservas</h2></div><WalletCards className="h-6 w-6 text-[var(--color-green-600)]" /></div><div className="grid gap-3 md:grid-cols-2">{nonTicketOrders.map((order) => renderOrderCard(order))}</div>{nonTicketOrders.length === 0 && <EmptyState title="Sem compras" description="Ainda não há compras de produtos, serviços ou promoções nesta conta." icon={<WalletCards className="h-6 w-6" aria-hidden="true" />} />}</Card>}

      {section === 'notifications' && <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-rose-600)]">Centro de actividade</p><h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">{t('businessNavNotifications')}</h2></div><Bell className="h-6 w-6 text-[var(--color-rose-600)]" /></div><div className="space-y-3">{notifications.map((notification) => <Card key={notification.id} className={`p-4 ${notification.read ? 'border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] dark:border-[var(--color-border-subtle-dark)] dark:bg-[var(--color-bg-subtle-dark)]/40' : 'border-[var(--color-blue-200)] bg-[var(--color-blue-50)] dark:border-[var(--color-blue-900)] dark:bg-[var(--color-blue-950)]/20'}`}><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.read ? 'bg-[var(--color-border-subtle)]' : 'bg-[var(--color-green-600)]'}`} /><div className="min-w-0"><p className="text-sm font-black text-[var(--color-text-strong)]">{notification.title}</p><p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">{notification.message}</p><p className="mt-2 text-[10px] font-bold text-[var(--color-text-muted)]">{notification.timeAgo || new Date(notification.createdAt).toLocaleString('pt-PT')}</p></div>{(onOpenNotification || (!notification.read && onMarkNotificationAsRead)) && <div className="ml-auto flex shrink-0 flex-col gap-1"><Button type="button" variant="primary" size="sm" onClick={() => { onMarkNotificationAsRead?.(notification.id); onOpenNotification?.(notification); }} className="min-h-7 rounded-lg bg-[var(--color-green-600)] px-2 py-1 text-[10px] hover:bg-[var(--color-green-700)]">Abrir</Button>{!notification.read && <Button type="button" variant="ghost" size="sm" onClick={() => onMarkNotificationAsRead?.(notification.id)} className="min-h-7 rounded-lg px-2 py-1 text-[10px] text-[var(--color-text-muted)]">Marcar lida</Button>}</div>}</div></Card>)}{notifications.length === 0 && <EmptyState title={t('citizen.noNotifications')} description="A sua caixa de notificações está vazia." icon={<Bell className="h-6 w-6" aria-hidden="true" />} />}</div></Card>}

      {section === 'messages' && <CommunicationHub currentLang={currentLang} mode="user" currentUser={currentUser} businesses={businesses} conversations={conversations} messages={conversationMessages} supportRequests={supportRequests} onCreateConversation={onCreateConversation} onSendMessage={onSendMessage} onCreateSupport={onCreateSupport} onReplySupport={onReplySupport} onMarkConversationRead={onMarkConversationRead} initialChannel="messages" focusConversationId={focusConversationId} initialBusinessId={initialMessageBusinessId} channelOnly />}
      {section === 'support' && <CommunicationHub currentLang={currentLang} mode="user" currentUser={currentUser} businesses={businesses} conversations={conversations} messages={conversationMessages} supportRequests={supportRequests} onCreateConversation={onCreateConversation} onSendMessage={onSendMessage} onCreateSupport={onCreateSupport} onReplySupport={onReplySupport} onMarkConversationRead={onMarkConversationRead} initialChannel="support" focusSupportId={focusSupportId} initialBusinessId={initialMessageBusinessId} channelOnly />}

            {selectedTicket && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--color-bg-surface-dark)]/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title" onClick={() => setSelectedTicket(null)}><div className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-[var(--color-bg-surface)] p-3 shadow-2xl dark:bg-[var(--color-bg-surface-dark)]" onClick={(e) => e.stopPropagation()}><div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 flex items-center justify-between gap-3 rounded-t-3xl border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 pb-2 pt-3 dark:border-[var(--color-border-subtle-dark)] dark:bg-[var(--color-bg-surface-dark)]"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-emerald-700)]">Bilhete</p><p className="truncate text-xs font-bold text-[var(--color-text-muted)]">{selectedTicket.itemTitle}</p></div><button type="button" onClick={() => setSelectedTicket(null)} className="guigui-close-button flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-strong)] shadow-md transition hover:bg-[var(--color-bg-subtle)] dark:bg-[var(--color-bg-surface-dark)] dark:text-white dark:hover:bg-[var(--color-bg-surface-dark)]/80" aria-label={`${t('close')} bilhete`} title={`${t('close')} bilhete`}><X className="h-6 w-6" /></button></div><h2 id="ticket-dialog-title" className="sr-only">Comprovativo do bilhete</h2><QRCodeDisplay code={selectedTicket.orderCode} qrToken={selectedTicket.qrToken} title={selectedTicket.itemTitle} subtitle={selectedTicket.businessName} buyerName={selectedTicket.customerName} buyerPhone={selectedTicket.customerPhone} amountXOF={selectedTicket.totalPriceXOF} pinCode={selectedTicket.ticketPin} validUntil={selectedTicket.purchasedAt ? new Date(new Date(selectedTicket.purchasedAt).getTime() + 60 * 60 * 1000).toISOString() : undefined} status={selectedTicket.status === 'cancelled' ? 'cancelled' : selectedTicket.status === 'redeemed' ? 'used' : 'valid'} onCopyCode={() => copyCode(selectedTicket.orderCode)} currentLang={currentLang} />{copiedCode === selectedTicket.orderCode && <p className="pb-2 text-center text-xs font-black text-[var(--color-emerald-700)]">{t('citizen.codeCopied')}</p>}</div></div>}
    </section>
          </main>
        </div>
      </div>
    );
};








