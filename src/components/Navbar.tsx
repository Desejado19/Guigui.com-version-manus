import React, { useState } from 'react';
import { GuiguiStar } from './GuiguiStar';
import {
  Search,
  Home,
  Building2,
  BadgePercent,
  Newspaper,
  Store,
  Tags,
  CalendarDays,
  Sparkles,
  MessageCircle,
  Bell,
  Menu,
  X,
  ShieldCheck,
  LayoutDashboard,
  QrCode,
  ChevronDown,
  Mic,
  MicOff,
  KeyRound,
  UserPlus,
  UserRound,
  ArrowLeft,
  Bookmark,
  DollarSign,
  BarChart3,
  LifeBuoy,
  FolderTree,
  Megaphone,
  CreditCard,
  Settings,
  Palette,
  Globe,
  SlidersHorizontal,
  LogOut,
  Database,
  Sun,
  Moon,
} from 'lucide-react';
import { AppNotification, UserProfile, Language, UserRole, EventReminder } from '../types';
import { NotificationBell } from './NotificationBell';
import { getTranslation } from '../utils/i18n';
import type { BusinessDashboardTab } from './BusinessDashboard';
import { Button } from './ui';

interface NavbarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentTab: 'feed' | 'directory' | 'map' | 'promotions' | 'events' | 'scanner' | 'client' | 'messages' | 'support' | 'admin' | 'institutional';
  onTabChange: (tab: 'feed' | 'directory' | 'map' | 'promotions' | 'events' | 'scanner' | 'client' | 'messages' | 'support' | 'admin' | 'institutional') => void;
  onFeedRefresh?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  currentUser?: UserProfile | null;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  theme?: 'light' | 'dark';
  themeMode?: 'light' | 'dark' | 'auto';
  onToggleTheme?: (nextMode?: 'light' | 'dark' | 'auto') => void;
  reminders?: EventReminder[];
  notifications?: AppNotification[];
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onClearNotifications?: () => void;
  onNavigateNotificationTab?: (tab: string) => void;
  onOpenNotification?: (notification: AppNotification) => void;
  onOpenMessages?: () => void;
  unreadMessageCount?: number;
  onGoBack?: () => void;
  onBusinessTabChange?: (tab: BusinessDashboardTab) => void;
  onAdminTabChange?: (tab: string) => void;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLang,
  onLanguageChange,
  currentRole,
  onRoleChange,
  currentTab,
  onTabChange,
  onFeedRefresh,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  currentUser,
  onOpenLoginModal,
  onLogout,
  theme = 'light',
  themeMode = 'auto',
  onToggleTheme,
  reminders = [],
  notifications = [],
  onMarkNotificationAsRead = () => undefined,
  onMarkAllNotificationsAsRead = () => undefined,
  onClearNotifications = () => undefined,
  onNavigateNotificationTab,
  onOpenNotification,
  onOpenMessages,
  unreadMessageCount = 0,
  onGoBack,
  onBusinessTabChange,
  onAdminTabChange,
  onSidebarCollapsedChange,
}) => {
  const [leftMenuOpen, setLeftMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  // Menus de preferências da barra superior — funcionam sem sessão iniciada.
  const [topLanguageMenuOpen, setTopLanguageMenuOpen] = useState(false);
  const [topThemeMenuOpen, setTopThemeMenuOpen] = useState(false);
  // Preferências dentro do menu da conta — para qualquer perfil com sessão iniciada.
  const [profileLanguageOpen, setProfileLanguageOpen] = useState(false);
  const [profileThemeOpen, setProfileThemeOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<'settings' | 'theme' | 'language' | null>(null);
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<string | null>(null);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [settingsToggles, setSettingsToggles] = useState<Record<string, boolean>>({
    emailAlerts: true,
    smsAlerts: currentRole === 'business',
    pushAlerts: true,
    twoFactor: true,
    privacyMode: currentRole === 'user',
    publicProfile: currentRole === 'business',
    autoBackup: currentRole !== 'user',
    auditLogs: currentRole === 'admin',
  });
  const recognitionRef = React.useRef<any>(null);
  const topPrefsRef = React.useRef<HTMLDivElement | null>(null);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);

  // Fecha os menus de preferências da barra (idioma/tema) ao clicar fora ou com Escape.
  React.useEffect(() => {
    if (!topLanguageMenuOpen && !topThemeMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!topPrefsRef.current?.contains(event.target as Node)) {
        setTopLanguageMenuOpen(false);
        setTopThemeMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTopLanguageMenuOpen(false);
        setTopThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [topLanguageMenuOpen, topThemeMenuOpen]);

  // Fecha o menu da conta (e as preferências lá dentro) ao clicar fora ou com Escape.
  React.useEffect(() => {
    if (!roleMenuOpen) return;
    const closeProfileMenu = () => {
      setRoleMenuOpen(false);
      setProfileLanguageOpen(false);
      setProfileThemeOpen(false);
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) closeProfileMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeProfileMenu();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [roleMenuOpen]);

  const t = (key: string) => getTranslation(currentLang, key);

  const triggerSearch = (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (onSearchSubmit) {
      onSearchSubmit(q);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
    }
  };

  const handleSearchSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    triggerSearch();
  };

  // Web Speech API Voice Search with graceful fallback & permission handling
  const handleVoiceSearch = () => {
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: any;
      webkitSpeechRecognition?: any;
    };
    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setVoiceNotice(t('voiceSearchUnsupported'));
      setTimeout(() => setVoiceNotice(null), 4000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;
        recognition.lang =
          currentLang === 'pt'
            ? 'pt-PT'
            : currentLang === 'fr'
            ? 'fr-FR'
            : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice(`🎙️ ${t('loading')} ${t('searchInBissau')}`);
      };

      recognition.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            onSearchChange(transcript);
            triggerSearch(transcript);
            setVoiceNotice(`🔎 ${t('voiceSearching')}: "${transcript}"`);
            setTimeout(() => setVoiceNotice(null), 3000);
          }
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const errType = event?.error;
        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          setVoiceNotice(t('microphoneDenied'));
          setTimeout(() => setVoiceNotice(null), 5000);
        } else if (errType !== 'no-speech' && errType !== 'aborted') {
          setVoiceNotice(t('requestFailed'));
          setTimeout(() => setVoiceNotice(null), 4000);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceNotice(t('voiceSearchUnavailable'));
      setTimeout(() => setVoiceNotice(null), 4000);
    }
  };

  const languageLabels = {
    pt: t('language.portuguese'),
    fr: t('language.french'),
    en: t('language.english'),
    es: t('language.spanish'),
  };
  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'pt', name: languageLabels.pt, flag: '🇧🇷' },
    { code: 'fr', name: languageLabels.fr, flag: '🇫🇷' },
    { code: 'en', name: languageLabels.en, flag: '🇬🇧' },
    { code: 'es', name: languageLabels.es, flag: '🇪🇸' },
  ];
  const formatLanguageCode = (code: Language) => (code === 'pt' ? 'PT-BR' : code.toUpperCase());
  const formatLanguageLabel = (code: Language) => `${formatLanguageCode(code)} · ${languageLabels[code]}`;

  const themeOptions: Array<{ value: 'light' | 'dark' | 'auto'; label: string; description: string }> = [
    { value: 'light', label: t('theme.light'), description: t('theme.lightDesc') },
    { value: 'dark', label: t('theme.dark'), description: t('theme.darkDesc') },
    { value: 'auto', label: t('theme.auto'), description: t('theme.autoDesc') },
  ];

  const closeCurrentModule = () => {
    setActiveSettingsPanel(null);
    setSelectedSettingsSection(null);
    setAccountDialogOpen(false);
    setShowLogoutConfirm(false);
  };

  const handleThemeApply = (mode: 'light' | 'dark' | 'auto') => {
    onToggleTheme?.(mode);
    setSelectedSettingsSection(null);
    setActiveSettingsPanel(null);
  };

  const toggleThemeDirectly = () => {
    onToggleTheme?.(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLanguageApply = (lang: Language) => {
    onLanguageChange(lang);
    setSelectedSettingsSection(null);
    setActiveSettingsPanel(null);
  };

  const toggleSetting = (key: string) => {
    setSettingsToggles((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const roleSettingsSections: Record<
    UserRole,
    Array<{
      id: string;
      label: string;
      description: string;
      icon: any;
      accentClass: string;
      action?: 'theme' | 'language' | 'detail';
    }>
  > = {
    user: [
      { id: 'account', label: t('settings.user.account'), description: t('settings.user.accountDesc'), icon: UserRound, accentClass: 'bg-slate-900 text-white', action: 'detail' },
      { id: 'support', label: t('settings.user.support'), description: t('settings.user.supportDesc'), icon: LifeBuoy, accentClass: 'bg-sky-500 text-white', action: 'detail' },
    ],
    business: [
      { id: 'company', label: t('settings.business.company'), description: t('settings.business.companyDesc'), icon: Building2, accentClass: 'bg-slate-900 text-white', action: 'detail' },
      { id: 'billing', label: t('settings.business.billing'), description: t('settings.business.billingDesc'), icon: CreditCard, accentClass: 'bg-emerald-500 text-white', action: 'detail' },
      { id: 'events', label: t('settings.business.events'), description: t('settings.business.eventsDesc'), icon: CalendarDays, accentClass: 'bg-violet-500 text-white', action: 'detail' },
      { id: 'promotions', label: t('settings.business.promotions'), description: t('settings.business.promotionsDesc'), icon: Megaphone, accentClass: 'bg-amber-500 text-white', action: 'detail' },
      { id: 'notifications', label: t('settings.business.notifications'), description: t('settings.business.notificationsDesc'), icon: Bell, accentClass: 'bg-sky-500 text-white', action: 'detail' },
      { id: 'security', label: t('settings.business.security'), description: t('settings.business.securityDesc'), icon: KeyRound, accentClass: 'bg-rose-500 text-white', action: 'detail' },
    ],
    admin: [
      { id: 'governance', label: t('settings.admin.governance'), description: t('settings.admin.governanceDesc'), icon: ShieldCheck, accentClass: 'bg-emerald-500 text-white', action: 'detail' },
      { id: 'platform', label: t('settings.admin.platform'), description: t('settings.admin.platformDesc'), icon: SlidersHorizontal, accentClass: 'bg-violet-500 text-white', action: 'detail' },
      { id: 'analytics', label: t('settings.admin.analytics'), description: t('settings.admin.analyticsDesc'), icon: BarChart3, accentClass: 'bg-cyan-500 text-white', action: 'detail' },
      { id: 'security', label: t('settings.admin.security'), description: t('settings.admin.securityDesc'), icon: KeyRound, accentClass: 'bg-rose-500 text-white', action: 'detail' },
      { id: 'support', label: t('settings.admin.support'), description: t('settings.admin.supportDesc'), icon: LifeBuoy, accentClass: 'bg-amber-500 text-white', action: 'detail' },
    ],
  };

  const roleSettingsCards = roleSettingsSections[currentRole];

  const renderSettingsDetail = () => {
    const currentSection = roleSettingsCards.find((item) => item.id === selectedSettingsSection);
    if (!currentSection) {
      return null;
    }

    const summary = currentRole === 'admin'
      ? 'Configuração da administração do Guigui.com'
      : currentRole === 'business'
      ? 'Configuração da conta comercial no Guigui.com'
      : 'Configuração da conta do cidadão no Guigui.com';

    const renderToggleRow = (label: string, key: string, helper: string) => (
      <button
        type="button"
        onClick={() => toggleSetting(key)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left dark:border-slate-700 dark:bg-slate-800/60"
      >
        <div>
          <div className="text-sm font-black text-slate-900 dark:text-white">{label}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{helper}</div>
        </div>
        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${settingsToggles[key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
          <span className={`inline-block h-4 w-4 rounded-full bg-white dark:bg-slate-900 shadow-sm transition ${settingsToggles[key] ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </button>
    );

    switch (selectedSettingsSection) {
      case 'account':
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <img src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'} alt={currentUser?.name || t('user.placeholder')} className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <div className="text-base font-black text-slate-900 dark:text-white">{currentUser?.name || t('user.placeholder')}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('settings.user.role.' + (currentRole === 'admin' ? 'admin' : currentRole === 'business' ? 'business' : 'citizen'))}</div>
                </div>
              </div>
            </div>
            {currentRole === 'user' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-black text-slate-900 dark:text-white">{t('settings.user.systemSettings')}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t('settings.user.personalSettings')}</div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('settings.user.email')}</div>
                <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{currentUser?.email || t('settings.user.emailFallback')}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('settings.user.region')}</div>
                <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{currentUser?.neighborhood || t('settings.user.regionFallback')}</div>
              </div>
            </div>

            <div className="space-y-2">
              {renderToggleRow('Autenticação em 2 etapas', 'twoFactor', 'Reforça a segurança da conta')}
              {renderToggleRow('Alertas por email', 'emailAlerts', 'Recebe alertas importantes por correio')}
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-3">
            {renderToggleRow('Perfil visível para a comunidade', 'privacyMode', 'Define se o seu perfil aparece em pesquisas e perfis públicos.')}
            {renderToggleRow('Alertas de sessão', 'pushAlerts', 'Receba avisos quando houver acesso a partir de uma nova sessão ou dispositivo.')}
            {renderToggleRow('Comunicação protegida', 'autoBackup', 'Mantém mensagens e pedidos de suporte acessíveis apenas aos participantes autorizados.')}
            {renderToggleRow('Personalização de dados', 'emailAlerts', 'Permite usar favoritos e histórico para melhorar a sua experiência.')}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              Pode alterar estas opções a qualquer momento. As preferências aplicam-se à sua conta e ficam guardadas neste dispositivo.
            </div>
          </div>
        );
      case 'tickets':
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Último bilhete</div>
              <div className="mt-2 text-base font-black text-slate-900 dark:text-white">Festival de Música de Bissau</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Lugar: Sala de Eventos ⬢ 12 de Julho ⬢ QR ativo</div>
            </div>
            {renderToggleRow('Notificações de compra', 'smsAlerts', 'Recebe lembretes e confirmações de compra')}
            {renderToggleRow('Guardar QR no dispositivo', 'autoBackup', 'Disponibiliza download do bilhete')}
          </div>
        );
      case 'support':
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="text-sm font-black text-slate-900 dark:text-white">Contacto oficial</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">WhatsApp: +245 955 000 000</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Email: apoio@guigui.com</div>
            </div>
            {renderToggleRow('Receber ajuda por WhatsApp', 'pushAlerts', 'Ativa respostas rápidas e notificações de suporte')}
            {renderToggleRow('Resumo periódico do estado da conta', 'emailAlerts', 'Recebe relatório semanal')}
          </div>
        );
      case 'company':
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Negócio principal</div>
              <div className="mt-2 text-base font-black text-slate-900 dark:text-white">{currentUser?.businessName || 'Guigui Business'}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('settings.business.mainCategory')}</div>
            </div>
            {renderToggleRow('Perfil público visível', 'publicProfile', 'A loja aparece no diretório e na pesquisa')} 
            {renderToggleRow('Sincronização automática', 'autoBackup', 'Sincroniza promoções e eventos com a plataforma')}
            {renderToggleRow('Notificações de pedidos', 'smsAlerts', 'Recebe alertas por WhatsApp e email')}
          </div>
        );
      case 'billing':
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Plano actual</div>
                  <div className="mt-2 text-base font-black text-slate-900 dark:text-white">Negócios Pro</div>
                </div>
                <div className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Ativo</div>
              </div>
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t('settings.business.nextPayment')}</div>
            </div>
            {renderToggleRow('Cobrança automática', 'autoBackup', 'Renova o plano no vencimento')}
            {renderToggleRow('Faturas por email', 'emailAlerts', 'Recebe recibos e relatórios')}
          </div>
        );
      case 'events':
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Agenda activa</div>
              <div className="mt-2 text-base font-black text-slate-900 dark:text-white">3 eventos em destaque</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">1 show, 2 campanhas promocionais</div>
            </div>
            {renderToggleRow('Lembretes de eventos', 'smsAlerts', 'Avisa clientes antes da data')}
            {renderToggleRow('Vendas automáticas de bilhetes', 'publicProfile', 'Permite reservas e check-in')} 
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-3">
            {renderToggleRow('Notificações de vendas', 'pushAlerts', 'Alertas de nova compra e reservas')}
            {renderToggleRow('Resumo diário', 'emailAlerts', 'Envia um relatório de desempenho')}
            {renderToggleRow('Lembretes de campanhas', 'smsAlerts', 'Avisa acerca de promoções próximas')}
          </div>
        );
      case 'security':
        return (
          <div className="space-y-3">
            {renderToggleRow('Autenticação em 2 etapas', 'twoFactor', currentRole === 'admin' ? 'Protege o painel administrativo' : 'Protege a conta e as configurações')}
            {renderToggleRow('Registo de sessões', 'auditLogs', 'Mantém histórico de acessos e ações')}
            {renderToggleRow('Backup de configuração', 'autoBackup', 'Guarda a estrutura de contas e regras')}
          </div>
        );
      case 'governance':
      case 'platform':
      case 'analytics':
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Estado geral</div>
              <div className="mt-2 text-base font-black text-slate-900 dark:text-white">Sistema estável e operacional</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Última sincronização há 6 minutos</div>
            </div>
            {renderToggleRow('Logs de auditoria', 'auditLogs', 'Regista alterações críticas na plataforma')}
            {renderToggleRow('Backup automático do sistema', 'autoBackup', 'Cria cópias de segurança diárias')}
            {renderToggleRow('Alertas de segurança', 'emailAlerts', 'Notifica ações sensíveis e acessos')}
          </div>
        );
      case 'language':
        return (
          <div className="space-y-3">
            {languages.map((option) => {
              const selected = currentLang === option.code;
              return (
                <button key={option.code} type="button" onClick={() => handleLanguageApply(option.code)} className={`w-full rounded-2xl border p-3 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-700/60'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{option.flag}</span>
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">{option.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatLanguageCode(option.code)}</div>
                      </div>
                    </div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                      {selected && <span className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      default:
        return (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {summary}
          </div>
        );
    }
  };

  const handleAccountSwitch = (nextRole: UserRole) => {
    onRoleChange(nextRole);
    setSelectedSettingsSection(null);
    setAccountDialogOpen(false);
    setLeftMenuOpen(false);
    if (nextRole === 'admin') {
      onTabChange('admin');
    } else if (nextRole === 'business') {
      onTabChange('client');
    } else {
      onTabChange('feed');
    }
  };

  const mainHeaderTabs = [
    {
      id: 'feed' as const,
      icon: Newspaper,
      label: t('navFeed'),
      subtitle: t('navFeedDescription'),
      badge: null,
    },
    {
      id: 'directory' as const,
      icon: Store,
      label: t('navDirectory'),
      subtitle: t('navDirectoryDescription'),
      badge: '10+',
    },
    {
      id: 'promotions' as const,
      icon: Tags,
      label: t('navPromotions'),
      subtitle: t('navPromotionsDescription'),
      badge: null,
    },
    {
      id: 'events' as const,
      icon: CalendarDays,
      label: t('navEvents'),
      subtitle: t('navEventsDescription'),
      badge: null,
    },
  ];

  const handleSelectTab = (tab: 'feed' | 'directory' | 'promotions' | 'events' | 'scanner' | 'client' | 'messages' | 'support' | 'admin' | 'institutional') => {
    if (tab === 'feed' && onFeedRefresh) onFeedRefresh();
    else onTabChange(tab);
    setLeftMenuOpen(false);
  };

  return (
    <>
      {/* Topo minimalista, de fundo sólido */}
      <header className="guigui-navbar">
        <div className="guigui-navbar-inner">
          
          {/* Left: 3 Tracinhos + Botão {t('back')} + Logo + Search Bar */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            
            {/* 3 Tracinhos Button (Menu Principal como no Facebook) */}
            <button
              type="button"
              onClick={() => setLeftMenuOpen(true)}
              className="guigui-menu-button guigui-icon-button shrink-0"
              title="Menu Principal"
              aria-label="Abrir Menu Principal"
            >
              <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </button>

            {/* Brand Logo */}
            <button type="button"
              onClick={() => onTabChange('feed')}
              className="guigui-brand group shrink-0"
              title="Guigui.com Portal Bissau"
            >
              <div className="guigui-brand-mark group-hover:scale-105 transition-transform" aria-hidden="true">
                <GuiguiStar className="h-full w-full" title="Guigui.com" />
              </div>
              <span className="guigui-brand-word hidden sm:inline">Guigui<span className="dot">.com</span></span>
            </button>

            {/* Clean Smart Search Bar */}
            <form className="relative hidden min-w-0 flex-1 items-center sm:flex sm:max-w-[240px] lg:w-64" onSubmit={handleSearchSubmit}>
              <div className={`relative flex items-center w-full bg-slate-100/90 dark:bg-slate-800/90 rounded-full px-3 py-1.5 transition border ${
                isListening
                  ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/10'
                  : 'border-slate-200/80 dark:border-slate-700/80 focus-within:border-emerald-500 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-emerald-500/20'
              }`}>
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label={t('searchAriaLabel')}
                  placeholder={isListening ? 'A ouvir...' : t('searchInBissau')}
                  className="bg-transparent border-none outline-none text-xs w-full text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 min-w-0"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      if (onSearchSubmit) onSearchSubmit('');
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-bold transition mr-1"
                    title={t('clearSearch')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Voice Search Button */}
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`p-1 rounded-full transition shrink-0 flex items-center gap-1 ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-xs'
                      : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                  }`}
                  title={isListening ? t('voiceListeningStop') : t('voiceSearchBtn')}
                >
                  {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Voice Feedback Tooltip */}
              {voiceNotice && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-slate-900 text-white text-[11px] font-medium px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700 whitespace-nowrap animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-ping" />
                  <span>{voiceNotice}</span>
                </div>
              )}
            </form>
          </div>

          {/* Center: Facebook-Style Primary Navigation Icon Tabs with non-repeating refined icons */}
          <nav className="hidden md:flex items-center justify-center gap-1 lg:gap-3 h-full flex-1 max-w-lg mx-auto">
            {mainHeaderTabs.map((tabItem) => {
              const Icon = tabItem.icon;
              const isActive = currentTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => tabItem.id === 'feed' && onFeedRefresh ? onFeedRefresh() : onTabChange(tabItem.id)}
                  className={`group relative flex h-full min-w-[72px] max-w-[112px] flex-1 flex-col items-center justify-center rounded-none px-2 py-1 transition lg:px-3 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                  }`}
                  aria-label={tabItem.label}
                >
                  <div className="guigui-icon-slot relative flex h-8 w-full items-center justify-center pt-1">
                    <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'stroke-[2px] text-emerald-600 dark:text-emerald-400' : 'stroke-[1.8px]'}`} aria-hidden="true" />
                    {tabItem.badge && (
                      <span className="guigui-status-badge absolute right-0 top-0 z-10 min-w-max -translate-y-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-xs dark:bg-emerald-500">
                        {tabItem.badge}
                      </span>
                    )}

                  </div>

                  {/* Facebook-style active bottom indicator bar */}
                  {isActive && (
                    <div className="absolute bottom-0 inset-x-2 h-0.75 bg-emerald-600 dark:bg-emerald-400 rounded-full shadow-xs" />
                  )}

                  {/* Hover Tooltip displaying Title & Subtitle */}
                  <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 flex max-w-[260px] flex-col items-center whitespace-normal text-center animate-in fade-in zoom-in-95 duration-150 hidden">
                    <div className="flex max-w-[260px] flex-col items-center rounded-xl border border-slate-800 bg-slate-900/95 px-3 py-1.5 text-center text-[11px] leading-snug text-white shadow-xl">
                      <span className="font-extrabold text-emerald-400 text-xs">{tabItem.label}</span>
                      <span className="text-[10px] text-slate-300 font-medium">{tabItem.subtitle}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Right: Only Essential, Non-Repetitive Controls (Theme, Notifications, Account) */}
          <div className="guigui-nav-actions shrink-0">
            
            {currentUser && currentRole !== 'admin' && (
              <button
                type="button"
                onClick={() => onTabChange('messages')}
                className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300 transition relative"
                title="Abrir caixa de mensagens"
                aria-label="Abrir caixa de mensagens"
              >
                <MessageCircle className="w-4.5 h-4.5" />
                {unreadMessageCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-600 px-1 text-center text-[9px] font-black leading-4 text-white">{unreadMessageCount > 99 ? '99+' : unreadMessageCount}</span>}
              </button>
            )}

            {currentUser && (
              <NotificationBell
                notifications={notifications}
                onMarkAsRead={onMarkNotificationAsRead}
                onMarkAllAsRead={onMarkAllNotificationsAsRead}
                onClearAll={onClearNotifications}
                currentRole={currentRole}
                currentLang={currentLang}
                currentUserId={currentUser.id}
                currentBusinessId={currentUser.businessId}
                onNavigateTab={onNavigateNotificationTab}
                onOpenNotification={onOpenNotification}
                theme={theme}
              />
            )}

            {/* Visitante (sem sessão): idioma e tema ficam no cabeçalho.
                Com sessão iniciada vivem dentro do menu da conta (dropdown do perfil). */}
            {!currentUser && (
            <div className="relative" ref={topPrefsRef}>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTopLanguageMenuOpen((open) => !open);
                    setTopThemeMenuOpen(false);
                  }}
                  className="guigui-pref-button h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 px-2 sm:px-2.5 text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700"
                  aria-haspopup="menu"
                  aria-expanded={topLanguageMenuOpen}
                  aria-label={`${t('language.select')}: ${formatLanguageCode(currentLang)}`}
                  title={`${t('language.select')}: ${formatLanguageCode(currentLang)}`}
                >
                  <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline text-xs font-bold">{formatLanguageCode(currentLang)}</span>
                  <ChevronDown className={`w-3 h-3 shrink-0 transition ${topLanguageMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTopThemeMenuOpen((open) => !open);
                    setTopLanguageMenuOpen(false);
                  }}
                  className="guigui-pref-button h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700"
                  aria-haspopup="menu"
                  aria-expanded={topThemeMenuOpen}
                  aria-label={themeOptions.find((option) => option.value === themeMode)?.label}
                  title={themeOptions.find((option) => option.value === themeMode)?.label}
                >
                  {theme === 'dark' ? (
                    <Moon className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Sun className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {topLanguageMenuOpen && (
                <div
                  role="menu"
                  aria-label={t('language.select')}
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-[110] text-xs space-y-1"
                >
                  {languages.map((option) => {
                    const selected = currentLang === option.code;
                    return (
                      <button
                        key={option.code}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => {
                          handleLanguageApply(option.code);
                          setTopLanguageMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2 font-bold text-slate-700 dark:text-slate-200 ${selected ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                      >
                        <span className="truncate">{formatLanguageCode(option.code)} · {option.name}</span>
                        {selected && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {topThemeMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-[110] text-xs space-y-1"
                >
                  {themeOptions.map((option) => {
                    const selected = themeMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => {
                          handleThemeApply(option.value);
                          setTopThemeMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2 font-bold text-slate-700 dark:text-slate-200 ${selected ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{option.label}</span>
                          <span className="block truncate text-[10px] font-normal text-slate-500 dark:text-slate-400">{option.description}</span>
                        </span>
                        {selected && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Profile & Login Button */}
            <div className="relative" ref={profileMenuRef}>
              {currentUser ? (
                <button type="button"
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className={`h-9 px-2 sm:px-3 rounded-full flex items-center gap-2 text-xs font-bold transition border ${
                    currentRole === 'admin'
                      ? 'bg-slate-900 text-white border-slate-700 hover:bg-slate-800'
                      : currentRole === 'business'
                      ? 'bg-emerald-700 text-white border-emerald-600 hover:bg-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title="Sessão Iniciada"
                >
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-full object-cover border border-white/40"
                  />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </button>
              ) : (
                <button type="button"
                  onClick={onOpenLoginModal}
                  className="h-9 px-3.5 sm:px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Entrar</span>
                </button>
              )}

              {/* User Dropdown */}
              {roleMenuOpen && currentUser && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-[110] text-xs space-y-1">
                  {currentRole === 'user' && (
                    <button type="button"
                      onClick={() => {
                        setRoleMenuOpen(false);
                        onTabChange('client');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-300 transition flex items-center gap-2 font-extrabold text-xs"
                    >
                      <UserRound className="w-4 h-4" aria-hidden="true" />
                      <span>A minha área pessoal</span>
                    </button>
                  )}

                  {currentRole === 'business' && (
                    <button type="button"
                      onClick={() => {
                        setRoleMenuOpen(false);
                        onTabChange('client');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 transition flex items-center gap-2 font-extrabold text-xs"
                    >
                      <Building2 className="w-4 h-4" aria-hidden="true" />
                      <span>Área da Minha Empresa</span>
                    </button>
                  )}

                  {currentRole === 'admin' && (
                    <button type="button"
                      onClick={() => {
                        setRoleMenuOpen(false);
                        onTabChange('admin');
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 transition flex items-center gap-2 font-extrabold text-xs"
                    >
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      <span>Administração Guigui.com</span>
                    </button>
                  )}
                  {/* Preferências (idioma + tema): disponíveis dentro da conta em todos os perfis com sessão. */}
                  <div className="my-1 border-t border-slate-200 pt-1 space-y-1 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileLanguageOpen((open) => !open);
                        setProfileThemeOpen(false);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={profileLanguageOpen}
                      aria-label={`${t('language.select')}: ${formatLanguageCode(currentLang)}`}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition flex items-center gap-2 font-extrabold text-xs"
                    >
                      <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{t('language.select')}</span>
                      <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">{formatLanguageCode(currentLang)}</span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition ${profileLanguageOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {profileLanguageOpen && (
                      <div role="menu" aria-label={t('language.select')} className="space-y-0.5 rounded-xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-700 dark:bg-slate-800/40">
                        {languages.map((option) => {
                          const selected = currentLang === option.code;
                          return (
                            <button
                              key={option.code}
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              onClick={() => {
                                handleLanguageApply(option.code);
                                setProfileLanguageOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2 font-bold text-slate-700 dark:text-slate-200 ${selected ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                            >
                              <span className="truncate">{formatLanguageCode(option.code)} · {option.name}</span>
                              {selected && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setProfileThemeOpen((open) => !open);
                        setProfileLanguageOpen(false);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={profileThemeOpen}
                      aria-label={`${themeOptions.find((option) => option.value === themeMode)?.label ?? ''}`}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition flex items-center gap-2 font-extrabold text-xs"
                    >
                      {theme === 'dark' ? <Moon className="w-4 h-4 shrink-0" aria-hidden="true" /> : <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />}
                      <span className="min-w-0 flex-1 truncate">Tema</span>
                      <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">{themeOptions.find((option) => option.value === themeMode)?.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition ${profileThemeOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {profileThemeOpen && (
                      <div role="menu" className="space-y-0.5 rounded-xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-700 dark:bg-slate-800/40">
                        {themeOptions.map((option) => {
                          const selected = themeMode === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              onClick={() => {
                                handleThemeApply(option.value);
                                setProfileThemeOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between gap-2 font-bold text-slate-700 dark:text-slate-200 ${selected ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate">{option.label}</span>
                                <span className="block truncate text-[10px] font-normal text-slate-500 dark:text-slate-400">{option.description}</span>
                              </span>
                              {selected && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </header>

      {/* Facebook-Style Left Navigation Menu Drawer (Lista dos 3 Tracinhos) */}
      {leftMenuOpen && (
        <div className="fixed inset-0 z-[120] flex">
          {/* Fundo do menu (sem desfoque) */}
          <div
            className="fixed inset-0 bg-slate-950/60 transition-opacity animate-in fade-in"
            onClick={() => setLeftMenuOpen(false)}
          />

          {/* Sliding Menu Panel */}
          <div className="relative w-full max-w-sm sm:w-96 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 dark:border-slate-800 h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
             
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-slate-900 via-emerald-800 to-emerald-600 text-amber-400 flex items-center justify-center shadow-xs">
                  <GuiguiStar className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900 dark:text-white leading-none">
                    Menu Principal
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Guigui.com ⬢ Bissau Digital
                  </p>
                </div>
              </div>
 
              <button type="button"
                onClick={() => setLeftMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition"
                title={`${t('close')} Menu`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            {/* Drawer Content List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2.5 space-y-2 text-xs">
               
              {/* User Profile Card inside Drawer */}
              {currentUser ? (
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <img
                      src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-black text-slate-900 dark:text-white text-xs truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                        {currentRole === 'admin' ? 'Super Admin' : currentRole === 'business' ? 'Conta Comercial' : 'Cidadão'}
                      </div>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => {
                      setLeftMenuOpen(false);
                      if (onOpenLoginModal) onOpenLoginModal();
                    }}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[10px] rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition shrink-0"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <button type="button"
                  onClick={() => {
                    setLeftMenuOpen(false);
                    if (onOpenLoginModal) onOpenLoginModal();
                  }}
                  className="w-full p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold flex items-center justify-between shadow-xs hover:opacity-95 transition"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <UserPlus className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="text-xs font-black">Iniciar Sessão / Criar Conta</div>
                      <div className="text-[10px] opacity-90">Aceda a compras e publicações</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              )}

              {!currentUser ? (
                <>
                <div className="space-y-1.5 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                    Conta & Sistema
                  </div>

                  <button type="button" onClick={() => { setLeftMenuOpen(false); handleSelectTab('institutional'); }} className="w-full rounded-[14px] p-2 transition flex items-center gap-2.5 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    <div><div className="text-[13px] font-black">Sobre o Guigui</div><div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Quem somos e como funciona</div></div>
                  </button>
                  <a href="https://wa.me/245955000000?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20a%20plataforma%20Guigui.com" target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2.5 rounded-[14px] p-2 font-bold text-emerald-800 transition hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
                    <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <div><div className="text-[13px] font-black">WhatsApp Oficial de Apoio</div><div className="text-[11px] font-normal">+245 955 000 000 (Bissau)</div></div>
                  </a>

                </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-800/40">
                   <div className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                     Conta & Sistema
                   </div>

                  </div>

                   <div className="space-y-1.5 pt-1">
                     {roleSettingsCards.map((item) => {
                       const Icon = item.icon;
                       return (
                         <React.Fragment key={item.id}>
                           <button
                             type="button"
                             onClick={() => {
                               setLeftMenuOpen(false);
                               if (currentRole === 'user' && item.id === 'account') {
                                 onTabChange('client');
                                 return;
                               }
                               // O Suporte vive aqui, no menu principal do cidadão.
                               if (currentRole === 'user' && item.id === 'support') {
                                 onTabChange('support');
                                 return;
                               }
                               if (item.action === 'theme') {
                                 toggleThemeDirectly();
                                 return;
                               }
                               if (currentRole === 'business' && onBusinessTabChange) {
                                 const businessTabBySection: Record<string, BusinessDashboardTab> = {
                                   company: 'overview',
                                   billing: 'billing',
                                   events: 'events',
                                   promotions: 'promotions',
                                   notifications: 'notifications',
                                   security: 'settings',
                                 };
                                 const businessTab = businessTabBySection[item.id];
                                 if (businessTab) {
                                   onBusinessTabChange(businessTab);
                                   return;
                                 }
                               }
                               if (currentRole === 'admin' && onAdminTabChange) {
                                 const adminTabBySection: Record<string, string> = {
                                   account: 'profile',
                                   governance: 'admin_staff',
                                   platform: 'architecture',
                                   analytics: 'reports',
                                   security: 'audit_logs',
                                   support: 'support',
                                 };
                                 const adminTab = adminTabBySection[item.id];
                                 if (adminTab) {
                                   onAdminTabChange(adminTab);
                                   return;
                                 }
                               }
                               setSelectedSettingsSection(item.id);
                               setActiveSettingsPanel('settings');
                             }}
                             className="flex w-full items-center gap-2.5 rounded-[12px] border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                           >
                             <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${item.accentClass}`}>
                               <Icon className="h-3.5 w-3.5" />
                             </div>
                             <div className="min-w-0 flex-1">
                               <div className="text-[11px] font-black leading-snug tracking-[-0.02em] text-slate-900 dark:text-white">{item.label}</div>
                               <div className="text-[9px] text-slate-500 dark:text-slate-400">{item.description}</div>
                             </div>
                           </button>
                         </React.Fragment>
                       );
                     })}
                   </div>

                   <div className="mt-2 space-y-1.5 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-800/40">
                     <button type="button" onClick={() => { setLeftMenuOpen(false); handleSelectTab('institutional'); }} className="w-full rounded-[14px] p-2 transition flex items-center gap-2.5 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                       <div className="w-8 h-8 rounded-xl bg-gray-500/10 text-gray-600 dark:text-gray-400 flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4" /></div>
                       <div className="flex-1 min-w-0"><div className="text-[13px] font-black leading-snug tracking-[-0.02em]">Sobre o Guigui</div><div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Quem somos e como funciona</div></div>
                     </button>
                     <a href="https://wa.me/245955000000?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20a%20plataforma%20Guigui.com" target="_blank" rel="noopener noreferrer" className="w-full rounded-[16px] bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center gap-2.5 font-bold transition hover:bg-emerald-100 px-2.5 py-2">
                       <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                       <div className="text-left"><div className="text-[13px] font-black leading-snug tracking-[-0.02em]">WhatsApp Oficial de Apoio</div><div className="text-[11px] opacity-80">+245 955 000 000 (Bissau)</div></div>
                     </a>
                   </div>

                   <button type="button" onClick={() => { setLeftMenuOpen(false); setShowLogoutConfirm(true); }} className="mt-1 w-full rounded-[14px] border border-emerald-200 bg-emerald-900 p-2 text-left text-white transition hover:bg-emerald-800">
                     <div className="flex items-center gap-2.5">
                       <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200"><LogOut className="h-4 w-4" /></div>
                       <div className="min-w-0 flex-1">
                         <div className="text-[12px] font-black leading-snug tracking-[-0.02em]">Sair</div>
                         <div className="text-[11px] text-emerald-100/80">Terminar sessão</div>
                       </div>
                     </div>
                     <div className="mt-1.5 text-[8px] font-black uppercase tracking-[0.22em] text-emerald-200">Abrir</div>
                   </button>
                </>
              )}


            </div>

            {/* Drawer Footer */}
            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 text-center text-[9px] text-slate-400 font-medium leading-none">
              Guigui.com v2.4 ⬢ Feito com paixão em Bissau
            </div>
          </div>
        </div>
      )}

      {(activeSettingsPanel || accountDialogOpen || showLogoutConfirm) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { setActiveSettingsPanel(null); setSelectedSettingsSection(null); setAccountDialogOpen(false); setShowLogoutConfirm(false); }} />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {accountDialogOpen ? t('settings.user.account') : showLogoutConfirm ? t('settings.user.logoutConfirm') : activeSettingsPanel === 'settings' ? t('settings.label.system') : activeSettingsPanel === 'theme' ? t('theme.select') : t('language.select')}
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                  {accountDialogOpen ? t('settings.user.myAccount') : showLogoutConfirm ? t('settings.user.logoutTitle') : activeSettingsPanel === 'settings' ? t('settings.label.config') : activeSettingsPanel === 'theme' ? t('theme.select') : t('language.select')}
                </h3>
              </div>
              <button type="button" onClick={closeCurrentModule} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" aria-label={`${t('close')} módulo`}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeSettingsPanel === 'settings' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700 dark:bg-slate-700/30 dark:text-slate-200"><Settings className="h-4 w-4" /></div>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">Definições do sistema</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {currentRole === 'admin' ? 'Ajustes de governança e plataforma' : currentRole === 'business' ? 'Ferramentas comerciais e operação do negócio' : 'Configurações pessoais e visita ao portal'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {roleSettingsCards.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.action === 'theme') {
                            toggleThemeDirectly();
                            return;
                          }
                          setSelectedSettingsSection(item.id);
                        }}
                        className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.accentClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">{item.label}</div>
                        </div>
                        {currentRole !== 'admin' && <div className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">{item.description}</div>}
                      </button>
                    );
                  })}
                </div>

                {selectedSettingsSection && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <button type="button" onClick={() => setSelectedSettingsSection(null)} className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                      {t('back')} aos módulos
                    </button>
                  </div>
                )}

                <button type="button" onClick={() => { setActiveSettingsPanel(null); setSelectedSettingsSection(null); }} className="mt-2 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                  {t('close')}
                </button>
              </div>
            )}

            {activeSettingsPanel === 'settings' && selectedSettingsSection && renderSettingsDetail() && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <button type="button" onClick={() => setSelectedSettingsSection(null)} className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t('back')}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {roleSettingsCards.find((item) => item.id === selectedSettingsSection)?.label}
                    </span>
                    <button type="button" onClick={closeCurrentModule} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600" aria-label={`${t('close')} módulo`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {renderSettingsDetail()}
              </div>
            )}

            {activeSettingsPanel === 'theme' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Tema</div>
                  <button type="button" onClick={closeCurrentModule} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600" aria-label={`${t('close')} módulo`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {themeOptions.map((option) => {
                    const selected = themeMode === option.value;
                    return (
                      <button key={option.value} type="button" onClick={() => handleThemeApply(option.value)} className={`w-full rounded-2xl border p-3 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-700/60'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">{option.label}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{option.description}</div>
                          </div>
                          <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                            {selected && <span className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Idioma</div>
                  {languages.map((option) => {
                    const selected = currentLang === option.code;
                    return (
                      <button key={option.code} type="button" onClick={() => handleLanguageApply(option.code)} className={`w-full rounded-2xl border p-3 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-700/60'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">{option.flag} {option.name}</div>
                          </div>
                          <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                            {selected && <span className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSettingsPanel === 'language' && (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <button type="button" onClick={closeCurrentModule} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600" aria-label={`${t('close')} módulo`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {languages.map((option) => {
                  const selected = currentLang === option.code;
                  return (
                    <button key={option.code} type="button" onClick={() => handleLanguageApply(option.code)} className={`w-full rounded-2xl border p-3 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-700/60'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{option.flag}</span>
                          <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">{option.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatLanguageCode(option.code)}</div>
                          </div>
                        </div>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                          {selected && <span className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {accountDialogOpen && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Perfil ativo</div>
                  <div className="mt-2 text-base font-black text-slate-900 dark:text-white">
                    {currentRole === 'admin' ? 'Administrador Guigui System' : currentRole === 'business' ? 'Empresa Guigui' : 'Utilizador Guigui'}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {currentRole === 'admin' ? 'Super Admin' : currentRole === 'business' ? 'Conta Comercial' : 'Perfil Público'}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => handleAccountSwitch('admin')} className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Admin</div>
                    <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">Super Admin</div>
                  </button>
                  <button type="button" onClick={() => handleAccountSwitch('business')} className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Negócios</div>
                    <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">Conta Comercial</div>
                  </button>
                </div>
              </div>
            )}

            {showLogoutConfirm && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Tem a certeza de que deseja sair da Administração Guigui.com?
                </p>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" size="lg" onClick={() => setShowLogoutConfirm(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="button" variant="primary" size="lg" onClick={() => { setShowLogoutConfirm(false); onLogout?.(); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                    Sair
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
