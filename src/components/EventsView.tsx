import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  Bell,
  BellRing,
  Trash2,
  MessageCircle,
  X,
  ChevronDown,
  Tag,
  Search,
} from 'lucide-react';
import {
  EventItem,
  EventTicketType,
  Ticket as TicketType,
  Language,
  UserProfile,
  PurchaseOrder,
  EventReminder,
  ReminderTimeframe,
  Business,
} from '../types';
import { getTranslation } from '../utils/i18n';
import { translatePublishedText } from '../utils/contentTranslation';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { isEventUpcoming } from '../utils/expiry';
import { SubmoduleNavbar } from './navigation/SubmoduleNavbar';
import { SectionHeader } from './ui/SectionHeader';
import { EventCard } from './events/EventCard';
import { EventDetailModal } from './events/EventDetailModal';
import { TicketVoucher } from './events/TicketVoucher';
import { AdminPagination } from './admin/AdminPagination';
import { smsService } from '../services/smsService';
import { usePersistentState } from '../utils/persistentState';
import { TicketPurchaseModal } from './TicketPurchaseModal';
import type { BusinessModelConfig, MonetizationCatalog } from '../types';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees, normaliseMonetizationCatalog } from '../data/monetizationCatalog';
import { Badge, Button, Card, EmptyState, LocationFilter } from './ui';
import { useLocationCatalog } from '../hooks/useLocationCatalog';
import { locationMatches } from '../../shared/bissauLocations';

interface EventsViewProps {
  events: EventItem[];
  /** Empresas do directório, usadas para pesquisar eventos pelo nome do negócio. */
  businesses?: Business[];
  currentLang: Language;
  currentUser?: UserProfile | null;
  onRequireLogin?: (notice?: string) => void;
  onAddPurchaseOrder?: (order: PurchaseOrder) => void;
  onTicketPurchaseConfirmed?: (purchase: {
    transactionId: string;
    eventId: string;
    eventTitle: string;
    businessId?: string;
    ticketId: string;
    ticketIds: string[];
    ticketCodes: string[];
  }) => void;
  focusEventId?: string | null;
  searchQuery?: string;
  reminders?: EventReminder[];
  onToggleReminder?: (event: EventItem, timeframe?: ReminderTimeframe) => void;
  onRemoveReminder?: (eventId: string) => void;
  onTriggerTestAlert?: (event: EventItem) => void;
  onContactOrganizer?: (event: EventItem) => void;
}

type TicketPurchaseDeliveryStatus = {
  paymentSimulated: boolean;
  email: 'sent' | 'simulated' | 'failed' | 'unavailable';
  notification: 'created' | 'failed' | 'unavailable';
  sms: 'sent' | 'simulated' | 'failed';
};

interface TicketPurchaseReceipt {
  transactionId: string;
  providerMode?: string;
  eventId: string;
  eventTitle: string;
  ticketTypeName: string;
  quantity: number;
  feeBreakdown: ReturnType<typeof calculateTicketFees> | null;
  buyerTotalXOF: number | null;
  tickets: TicketType[];
  delivery: TicketPurchaseDeliveryStatus;
}

// Comparação tolerante para o filtro de tipos de evento (ignora maiúsculas e espaços).
const normaliseEventCategory = (value?: string) => (value || '').trim().toLowerCase();

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  businesses = [],
  currentLang,
  currentUser,
  onRequireLogin,
  onAddPurchaseOrder,
  onTicketPurchaseConfirmed,
  focusEventId,
  searchQuery = '',
  reminders = [],
  onToggleReminder,
  onRemoveReminder,
  onTriggerTestAlert,
  onContactOrganizer,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const [businessModelConfig] = usePersistentState<BusinessModelConfig>('guigui_admin_business_model_config', {
    ticketCommissionPercent: 10,
    ticketFixedFeeXOF: 200,
    extraPostPriceXOF: 5000,
    extraPromotionPriceXOF: 10000,
    bannerWeeklyPriceXOF: 50000,
    annualDiscountPercent: 15,
    includedPostsPerMonth: 3,
  });

  const [activeTab, setActiveTab] = useState<'all' | 'reminders'>('all');
  type AgendaTab = 'all' | 'week' | 'month';
  const AGENDA_TABS: AgendaTab[] = ['all', 'week', 'month'];
  const [agendaTab, setAgendaTab] = useState<AgendaTab>('all');
  const AGENDA_LABELS: Record<Language, Record<AgendaTab, string>> = {
    pt: { all: 'Todos os eventos', week: 'Esta semana', month: 'Este mês' },
    en: { all: 'All events', week: 'This week', month: 'This month' },
    fr: { all: 'Tous les événements', week: 'Cette semaine', month: 'Ce mois' },
    es: { all: 'Todos los eventos', week: 'Esta semana', month: 'Este mes' },
  };
  const AGENDA_DESCRIPTIONS: Record<Language, Record<AgendaTab, string>> = {
    pt: { all: 'Toda a agenda cultural publicada em Bissau.', week: 'Eventos que acontecem nos próximos sete dias.', month: 'Eventos marcados para o mês corrente.' },
    en: { all: 'The full cultural agenda published in Bissau.', week: 'Events happening in the next seven days.', month: 'Events scheduled for the current month.' },
    fr: { all: 'Toute l’agenda culturelle publiée à Bissau.', week: 'Événements des sept prochains jours.', month: 'Événements du mois en cours.' },
    es: { all: 'Toda la agenda cultural publicada en Bissau.', week: 'Eventos de los próximos siete días.', month: 'Eventos del mes en curso.' },
  };
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const { locations: bissauLocations } = useLocationCatalog();
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const [eventSearch, setEventSearch] = useState(searchQuery);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [purchaseSeed, setPurchaseSeed] = useState<{ ticketTypeId: string; quantity: number } | null>(null);
  const [selectedTicketType, setSelectedTicketType] = useState<EventTicketType | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [reminderMenuOpenFor, setReminderMenuOpenFor] = useState<string | null>(null);
  const [notificationStatusNotice, setNotificationStatusNotice] = useState<string | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const [monetizationCatalog, setMonetizationCatalog] = usePersistentState<MonetizationCatalog>('guigui_monetization_catalog', DEFAULT_MONETIZATION_CATALOG);
  const resolvedMonetizationCatalog = normaliseMonetizationCatalog(monetizationCatalog, businessModelConfig);

  useEffect(() => {
    let active = true;
    fetch('/api/commercial/public-catalog')
      .then((response) => response.ok ? response.json() : null)
      .then((catalog) => {
        if (!active || !catalog?.ticketFeePolicy) return;
        setMonetizationCatalog((previous) => ({ ...previous, ticketFeePolicy: catalog.ticketFeePolicy, updatedAt: catalog.updatedAt || previous.updatedAt }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [setMonetizationCatalog]);
  const ticketFeeBreakdown = calculateTicketFees(resolvedMonetizationCatalog, selectedTicketType?.priceXOF || 0, ticketQuantity);

  const [purchaseReceipt, setPurchaseReceipt] = useState<TicketPurchaseReceipt | null>(null);
  const purchasedTickets = purchaseReceipt?.tickets || [];
  const ticketPurchaseTriggerRef = useRef<HTMLElement | null>(null);
  const ticketReceiptRef = useRef<HTMLDivElement | null>(null);
  const ticketReceiptCloseRef = useRef<HTMLButtonElement | null>(null);
  const [paymentPending, setPaymentPending] = useState<{
    message: string;
    transactionId?: string;
    providerRef?: string;
    reservationExpiresAt?: string;
    providerMode?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const purchaseIdempotencyKeyRef = useRef<string | null>(null);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState<{ ok: boolean; message: string; ticket?: { ticketCode: string; eventTitle: string; ticketTypeName: string; buyerName: string; status: string; viewPath: string } } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isResendingSms, setIsResendingSms] = useState(false);

  useEffect(() => {
    setEventSearch(searchQuery);
  }, [searchQuery]);

  // O seletor de tipos de evento fecha ao clicar fora ou com Escape, como o
  // filtro de localização, para não ficar aberto por cima da grelha.
  useEffect(() => {
    if (!categoryMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoryMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [categoryMenuOpen]);

  useEffect(() => {
    if (!focusEventId) return;
    const event = events.find((candidate) => candidate.id === focusEventId);
    if (!event) return;
    setSelectedEvent(event);
    setSelectedTicketType(event.ticketTypes[0] || null);
    setTicketQuantity(1);
    setPurchaseReceipt(null);
  }, [events, focusEventId]);

  useEffect(() => {
    if (currentUser) return;
    setActiveTab('all');
    setSelectedEvent(null);
    setPurchaseReceipt(null);
  }, [currentUser]);

  useEffect(() => {
    if (purchasedTickets.length === 0) return;
    const dialog = ticketReceiptRef.current;
    if (!dialog) return;

    dialog.focus({ preventScroll: true });
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPurchaseReceipt(null);
        setSelectedEvent(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      if (ticketPurchaseTriggerRef.current?.isConnected) ticketPurchaseTriggerRef.current.focus();
    };
  }, [purchasedTickets.length]);

  const handleOpenBuyModal = (event: EventItem, trigger?: HTMLElement) => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta para comprar bilhetes.');
      return;
    }
    ticketPurchaseTriggerRef.current = trigger
      || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSelectedEvent(event);
    setPurchaseReceipt(null);
    setSelectedTicketType(event.ticketTypes[0] || null);
    setTicketQuantity(1);
    setPurchaseReceipt(null);
    setPaymentPending(null);
    purchaseIdempotencyKeyRef.current = null;
    setIsPurchaseModalOpen(true);
  };

  const handleModalConfirm = async (data: {
    category: string;
    quantity: number;
    buyerName: string;
    buyerPhone: string;
    paymentMethod: 'orange' | 'telecel';
    policyAccepted: boolean;
    policyVersion: string;
    policyAcceptedAt: string;
    ticketTypeId: string;
    categoryPriceXOF: number;
    chargedAmountXOF: number;
    holderName?: string;
    holderPhone?: string;
  }, eventOverride?: EventItem | null) => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta para comprar bilhetes.');
      return;
    }
    const event = eventOverride ?? selectedEvent;
    if (!event) {
      setNotificationStatusNotice('Selecione um evento antes de comprar o bilhete.');
      return;
    }
    const ticketType = event.ticketTypes.find((type) => type.id === data.ticketTypeId);
    if (!ticketType || ticketType.priceXOF !== data.categoryPriceXOF) {
      setNotificationStatusNotice('A categoria selecionada foi alterada. Feche e abra a compra novamente.');
      return;
    }

    setIsSubmitting(true);
    purchaseIdempotencyKeyRef.current ||= typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const response = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': purchaseIdempotencyKeyRef.current,
        },
        body: JSON.stringify({
          eventId: event.id,
          businessId: event.businessId,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time,
          ticketTypeId: ticketType.id,
          ticketTypeName: ticketType.name,
          priceXOF: ticketType.priceXOF,
          pricePerTicketXOF: ticketType.priceXOF,
          quantity: data.quantity,
          buyerName: data.buyerName,
          buyerPhone: data.buyerPhone,
          ...(data.holderName && data.holderPhone ? { holderName: data.holderName, holderPhone: data.holderPhone } : {}),
          paymentMethod: {
            orange: 'orange_money',
            telecel: 'telecel',
          }[data.paymentMethod],
          chargedAmountXOF: data.chargedAmountXOF,
          policyAccepted: data.policyAccepted,
          policyVersion: data.policyVersion,
          policyAcceptedAt: data.policyAcceptedAt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setNotificationStatusNotice(errorData.error || errorData.message || 'Erro ao comprar bilhete.');
        setTimeout(() => setNotificationStatusNotice(null), 4000);
        return;
      }

      const result = await response.json().catch(() => ({}));
      if (result.paymentPending) {
        setPaymentPending({
          message: result.message || 'O pagamento está pendente de confirmação.',
          transactionId: result.transaction?.id,
          providerRef: result.transaction?.providerRef,
          reservationExpiresAt: result.reservationExpiresAt,
          providerMode: result.transaction?.providerMode,
        });
        setIsPurchaseModalOpen(false);
        return;
      }
      if (!result.success || !result.ticket) {
        setNotificationStatusNotice(result.message || 'A API não confirmou a emissão do bilhete.');
        setTimeout(() => setNotificationStatusNotice(null), 4000);
        return;
      }

      setSelectedTicketType(ticketType);
      setTicketQuantity(data.quantity);
      const issuedTickets = Array.isArray(result.tickets) && result.tickets.length > 0
        ? result.tickets
        : [result.ticket];
      const emailState = result.delivery?.email?.state;
      const notificationState = result.delivery?.notification?.state;
      const smsState = result.delivery?.sms?.state;
      const delivery: TicketPurchaseDeliveryStatus = {
        paymentSimulated: result.transaction?.providerMode === 'simulated',
        email: emailState === 'delivered' || emailState === 'accepted' ? 'sent'
          : emailState === 'simulated' || emailState === 'failed' ? emailState
          : 'unavailable',
        notification: notificationState === 'created' || notificationState === 'failed' ? notificationState : 'unavailable',
        sms: smsState === 'delivered' || smsState === 'accepted' ? 'sent'
          : smsState === 'simulated' ? 'simulated'
          : 'failed',
      };
      const feeBreakdown = result.quote?.feeBreakdown || result.feeBreakdown || null;
      const buyerTotalXOF = Number.isSafeInteger(result.quote?.buyerTotalXOF)
        ? result.quote.buyerTotalXOF
        : Number.isSafeInteger(feeBreakdown?.buyerTotal) ? feeBreakdown.buyerTotal : null;
      if (currentUser?.role === 'user' && typeof result.transaction?.id === 'string') {
        onTicketPurchaseConfirmed?.({
          transactionId: result.transaction.id,
          eventId: event.id,
          eventTitle: event.title,
          businessId: event.businessId,
          ticketId: issuedTickets[0].id,
          ticketIds: issuedTickets.map((ticket: TicketType) => ticket.id),
          ticketCodes: issuedTickets.map((ticket: TicketType) => ticket.ticketCode),
        });
      }
      setPurchaseReceipt({
        transactionId: typeof result.transaction?.id === 'string' ? result.transaction.id : '',
        providerMode: result.transaction?.providerMode,
        eventId: issuedTickets[0].eventId || event.id,
        eventTitle: issuedTickets[0].eventTitle || event.title,
        ticketTypeName: issuedTickets[0].ticketTypeName || ticketType.name,
        quantity: issuedTickets.length,
        feeBreakdown,
        buyerTotalXOF,
        tickets: issuedTickets,
        delivery,
      });
      setIsPurchaseModalOpen(false);
    } catch (error) {
      setNotificationStatusNotice('Erro de conexão ao comprar bilhete.');
      setTimeout(() => setNotificationStatusNotice(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleLookupTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLookingUp(true);
    setLookupResult(null);
    try {
      const response = await fetch('/api/tickets/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: lookupPhone, code: lookupCode }) });
      const payload = await response.json().catch(() => ({}));
      setLookupResult({ ok: response.ok && Boolean(payload.ticket), message: payload.message || 'Não foi possível localizar o bilhete.', ticket: payload.ticket });
    } catch {
      setLookupResult({ ok: false, message: 'Não foi possível contactar o serviço de consulta. Tente novamente.' });
    } finally {
      setIsLookingUp(false);
    }
  };


  const handleResendTicketSms = async () => {
    setIsResendingSms(true);
    try {
      const response = await fetch('/api/tickets/resend-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: lookupPhone, code: lookupCode }) });
      const payload = await response.json().catch(() => ({}));
      setNotificationStatusNotice(payload.message || (response.ok ? 'Pedido de reenvio registado.' : 'Não foi possível reenviar o SMS.'));
    } catch {
      setNotificationStatusNotice('Não foi possível contactar o serviço de SMS.');
    } finally {
      setIsResendingSms(false);
      setTimeout(() => setNotificationStatusNotice(null), 5000);
    }
  };

  const handleRequestBrowserNotifications = async () => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta para activar alertas.');
      return;
    }
    if (!('Notification' in window)) {
      setNotificationStatusNotice('O seu navegador não suporta notificações de sistema. Os alertas aparecerão na interface do Guigui.');
      setTimeout(() => setNotificationStatusNotice(null), 4000);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationStatusNotice('🔔 Notificações ativadas com sucesso! Receberá alertas dos seus eventos favoritos.');
        new Notification('🔔 Guigui.com Alertas Ativados', {
          body: 'Notificações de eventos e bilhetes configuradas com sucesso para Bissau!',
          icon: '/favicon.ico',
        });
      } else {
        setNotificationStatusNotice('Notificações de sistema recusadas. Os alertas continuarão a surgir dentro da aplicação.');
      }
    } catch {
      setNotificationStatusNotice('Alertas ativos na interface do portal.');
    }
    setTimeout(() => setNotificationStatusNotice(null), 5000);
  };

  const isEventFavorited = (eventId: string) => {
    return reminders.some((r) => r.eventId === eventId);
  };

  const getEventReminder = (eventId: string) => {
    return reminders.find((r) => r.eventId === eventId);
  };

  // Filter events based on search query & category
  const businessNameById = new Map(businesses.map((business) => [business.id, business.name]));
  const searchedEvents = events.filter((ev) => {
    // Evento cuja data ja passou sai automaticamente da agenda publica.
    if (!isEventUpcoming(ev)) return false;
    const query = eventSearch.trim().toLowerCase();
    const searchableValues = [
      ev.title,
      ev.description,
      ev.location,
      ev.neighborhood,
      ev.organizerName,
      ev.organizer,
      ev.businessId ? businessNameById.get(ev.businessId) : undefined,
      ev.category,
      ...(ev.ticketTypes || []).map((ticket) => `${ticket.name} ${ticket.priceXOF}`),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);

    const matchesSearch = !query || searchableValues.some((value) => value.toLowerCase().includes(query));
    return matchesSearch && locationMatches(ev.neighborhood, selectedNeighborhood);
  });

  // Se a pesquisa esconder o tipo escolhido, a agenda volta a mostrar tudo em
  // vez de ficar vazia com o seletor a indicar "Todos os eventos".
  const categoryIsAvailable = searchedEvents.some(
    (ev) => normaliseEventCategory(ev.category) === selectedCategory,
  );

  const filteredEvents = searchedEvents.filter(
    (ev) =>
      selectedCategory === 'all' ||
      !categoryIsAvailable ||
      normaliseEventCategory(ev.category) === selectedCategory,
  );

  // Submodulos de agenda: cada um filtra a sua propria janela temporal.
  const eventMatchesAgenda = (ev: EventItem, tab: AgendaTab): boolean => {
    if (tab === 'all') return true;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const eventDate = new Date(`${ev.date}T${ev.time || '00:00'}`);
    if (Number.isNaN(eventDate.getTime())) return false;
    if (eventDate < startOfToday) return false;
    const limit = new Date(startOfToday);
    if (tab === 'week') limit.setDate(limit.getDate() + 7);
    else limit.setMonth(limit.getMonth() + 1);
    return eventDate <= limit;
  };

  const agendaCounts: Record<string, number> = {
    all: filteredEvents.length,
    week: filteredEvents.filter((ev) => eventMatchesAgenda(ev, 'week')).length,
    month: filteredEvents.filter((ev) => eventMatchesAgenda(ev, 'month')).length,
  };

  const agendaEvents = filteredEvents.filter((ev) => eventMatchesAgenda(ev, agendaTab));
  const eventsPagination = usePaginatedList(agendaEvents, {
    resetKey: `${agendaTab}|${eventSearch}|${selectedCategory}|${selectedNeighborhood || 'all'}`,
    persistKey: 'guigui_events_page_size',
  });

  // As categorias vêm dos próprios eventos, para que o filtro nunca mostre
  // zero resultados por usar um rótulo que não existe na agenda.
  const categories = [
    { id: 'all', label: t('events.all'), count: searchedEvents.length },
    ...Array.from(new Set(searchedEvents.map((ev) => ev.category).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt'))
      .map((label) => ({
        id: normaliseEventCategory(label),
        label,
        count: searchedEvents.filter((ev) => normaliseEventCategory(ev.category) === normaliseEventCategory(label)).length,
      })),
  ];
  const activeCategory = categories.find((category) => category.id === selectedCategory) || categories[0];

  return (
    <>
    <div className="w-full px-1 py-8 space-y-6 guigui-secondary-page">
      {/* Top Banner */}
      <div className="guigui-hero text-white">
        <div className="guigui-hero-inner">
          <div className="guigui-eyebrow">
            <Calendar className="h-3.5 w-3.5" />
            Viva a cultura de Bissau
          </div>
          <h1 className="guigui-hero-title">
            Encontre. Viva. <em>Celebre.</em>
          </h1>
          <p className="guigui-hero-copy">
            Concertos, festivais e experiências únicas com bilhetes oficiais e acesso simples.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="relative z-10 mt-6 flex flex-wrap gap-2">
          <button type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${ activeTab === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'bg-white/10 text-white hover:bg-white/20' }`}
          >
            Explorar Agenda ({events.length})
          </button>

          {currentUser && (
            <button type="button"
              onClick={() => setActiveTab('reminders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${ activeTab === 'reminders' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'bg-white/10 text-white hover:bg-white/20' }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Meus Lembretes ({reminders.length})</span>
            </button>
          )}
        </div>
      </div>

      {!currentUser && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Faça login para comprar bilhetes, ativar alertas e guardar lembretes. Enquanto isso, pode apenas explorar a agenda.
        </div>
      )}

      {activeTab === 'all' && (
        <div className="space-y-3">
          <SubmoduleNavbar
            currentTab={agendaTab}
            onTabChange={(tab) => setAgendaTab(tab as AgendaTab)}
            tabs={AGENDA_TABS as string[]}
            tabLabels={AGENDA_LABELS[currentLang]}
            showCounts
            counts={agendaCounts}
            ariaLabel={t('events.title')}
          />
          <SectionHeader
            title={AGENDA_LABELS[currentLang][agendaTab]}
            description={AGENDA_DESCRIPTIONS[currentLang][agendaTab]}
            metrics={[{ label: 'Eventos', value: agendaEvents.length }]}
          />
        </div>
      )}

      {notificationStatusNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificationStatusNotice}</span>
        </div>
      )}

      {/* Tipos de evento dentro de "Todos os eventos" (separador "all") */}
      {activeTab === 'all' && (
        <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="relative w-full sm:max-w-sm">
            <span className="sr-only">{t('events.search')}</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="event-search"
              type="search"
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              placeholder="Pesquisar evento, local, organizador ou empresa"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {eventSearch && (
              <button
                type="button"
                onClick={() => setEventSearch('')}
                aria-label="Limpar pesquisa de eventos"
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <LocationFilter
            locations={bissauLocations}
            selectedLocation={selectedNeighborhood}
            onSelect={setSelectedNeighborhood}
            triggerLabel="Localização"
            allLabel="Ver todos"
            allowAll={false}
          />
          <div ref={categoryMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setCategoryMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={categoryMenuOpen}
              aria-label="Escolher tipo de evento"
              className={`guigui-filter-chip transition flex items-center gap-1.5 ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'}`}
            >
              <Tag className="h-3 w-3" aria-hidden="true" />
              <span>{activeCategory.label}</span>
              <span className="text-[10px] font-black opacity-70">{activeCategory.count}</span>
              <ChevronDown className={`h-3 w-3 transition ${categoryMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {categoryMenuOpen && (
              <div
                role="menu"
                aria-label="Tipos de eventos"
                className="absolute left-0 top-full z-30 mt-1 max-h-72 min-w-[240px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                {categories.map((category, index) => (
                  <React.Fragment key={category.id}>
                    {index === 1 && <div className="my-1 border-t border-slate-100 dark:border-slate-800" />}
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedCategory === category.id}
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setCategoryMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                        selectedCategory === category.id
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{category.label}</span>
                      <span className="text-[10px] font-black opacity-70">{category.count}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          {selectedNeighborhood && (
            <button
              type="button"
              onClick={() => setSelectedNeighborhood(null)}
              className="guigui-filter-chip bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              <X className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Limpar localização
            </button>
          )}
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="guigui-filter-chip bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              <X className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Limpar tipo
            </button>
          )}
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:ml-auto">
            {agendaEvents.length} {agendaEvents.length === 1 ? 'evento' : 'eventos'}
          </span>
        </div>
      )}

      {/* TAB 1: ALL EVENTS GRID */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {eventsPagination.pageItems.map((event) => (
            <EventCard key={event.id} event={event} currentLang={currentLang} onOpen={setDetailEvent} canBuy={Boolean(currentUser)} />
          ))}
        </div>
      )}

      {activeTab === 'all' && agendaEvents.length > 0 && (
        <AdminPagination
          currentLang={currentLang}
          currentPage={eventsPagination.page}
          pageSize={eventsPagination.pageSize}
          totalItems={eventsPagination.totalItems}
          onPageChange={eventsPagination.setPage}
          onPageSizeChange={eventsPagination.setPageSize}
        />
      )}

      {/* TAB 2: REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-500" />
                <span>Lembretes Ativos da Agenda ({reminders.length})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Os eventos favoritados disparam avisos na plataforma para garantir que não perde a data.
              </p>
            </div>

            <button type="button"
              onClick={handleRequestBrowserNotifications}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs transition flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5 text-blue-600" />
              <span>Ativar Notificações</span>
            </button>
          </div>

          {reminders.length === 0 ? (
            <EmptyState
              title="Ainda não tem lembretes de eventos ativos"
              description="Clique no botão com o sino em qualquer evento da agenda para receber avisos prévios."
              actionLabel="Explorar Agenda Cultural"
              onAction={() => setActiveTab('all')}
              actionVariant="primary"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reminders.map((r) => {
                const ev = events.find((e) => e.id === r.eventId);

                return (
                  <div
                    key={r.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                        <img src={r.eventCover} alt="" className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase">
                          <BellRing className="w-3 h-3 animate-pulse" />
                          <span>Lembrete Ativo</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{r.eventTitle}</h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          📅 {r.eventDate} às {r.eventTime}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          📍 {r.eventLocation} ({r.eventNeighborhood})
                        </p>
                      </div>
                    </div>

                    {currentUser && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Avisar:</span>
                          <select
                            value={r.timeframe}
                            onChange={(e) => {
                              if (ev && onToggleReminder) {
                                onToggleReminder(ev, e.target.value as ReminderTimeframe);
                              }
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-[11px] font-bold rounded-lg px-2 py-1 outline-none"
                          >
                            <option value="at_start">No próprio dia</option>
                            <option value="1h_before">1 hora antes</option>
                            <option value="24h_before">24 horas antes</option>
                            <option value="3d_before">3 dias antes</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {ev && (
                            <button type="button"
                              onClick={(clickEvent) => handleOpenBuyModal(ev, clickEvent.currentTarget)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition"
                            >
                              Comprar Bilhete
                            </button>
                          )}

                          <button type="button"
                            onClick={() => onRemoveReminder?.(r.eventId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Remover lembrete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <EventDetailModal
        event={detailEvent}
        currentLang={currentLang}
        currentUser={currentUser}
        hasReminder={detailEvent ? isEventFavorited(detailEvent.id) : false}
        onClose={() => setDetailEvent(null)}
        onRequireLogin={onRequireLogin}
        onToggleReminder={onToggleReminder}
        onContactOrganizer={onContactOrganizer}
        isSubmitting={isSubmitting}
        monetizationCatalog={resolvedMonetizationCatalog}
        onBuy={(payload) => {
          if (!currentUser) {
            onRequireLogin?.('Inicie sessão ou crie uma conta para comprar bilhetes.');
            return;
          }
          const event = detailEvent;
          if (!event) return;
          const ticketType = event.ticketTypes.find((type) => type.id === payload.ticketTypeId);
          if (!ticketType) {
            setNotificationStatusNotice('A categoria selecionada foi alterada. Feche e abra a compra novamente.');
            setTimeout(() => setNotificationStatusNotice(null), 4000);
            return;
          }
          setPurchaseSeed({ ticketTypeId: payload.ticketTypeId, quantity: payload.quantity });
          setSelectedEvent(event);
          setDetailEvent(null);
          setPurchaseReceipt(null);
          setPaymentPending(null);
          purchaseIdempotencyKeyRef.current = null;
          void handleModalConfirm(
            {
              category: payload.category,
              quantity: payload.quantity,
              buyerName: payload.buyerName,
              buyerPhone: payload.buyerPhone,
              paymentMethod: payload.paymentMethod,
              policyAccepted: payload.policyAccepted,
              policyVersion: payload.policyVersion,
              policyAcceptedAt: payload.policyAcceptedAt,
              ticketTypeId: payload.ticketTypeId,
              categoryPriceXOF: payload.categoryPriceXOF,
              chargedAmountXOF: payload.chargedAmountXOF,
              ...(payload.holderName && payload.holderPhone
                ? { holderName: payload.holderName, holderPhone: payload.holderPhone }
                : {}),
            },
            event,
          );
        }}
      />

      {/* Ticket Purchase - novo modal */}
      <TicketPurchaseModal
        isOpen={isPurchaseModalOpen && purchasedTickets.length === 0 && !paymentPending}
        event={selectedEvent}
        ticketTypes={selectedEvent?.ticketTypes || []}
        currentUser={currentUser}
        currentLang={currentLang}
        monetizationCatalog={resolvedMonetizationCatalog}
        isSubmitting={isSubmitting}
        initialTicketTypeId={purchaseSeed?.ticketTypeId}
        initialQuantity={purchaseSeed?.quantity}
        onClose={() => {
          setIsPurchaseModalOpen(false);
          setSelectedEvent(null);
          purchaseIdempotencyKeyRef.current = null;
        }}
        onConfirm={handleModalConfirm}
      />
      {paymentPending && (
        <div
          className="event-modal-overlay fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-slate-950/70 px-3 py-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Pagamento pendente"
        >
          <div className="ticket-surface mt-8 w-full max-w-lg rounded-3xl border border-amber-200 bg-white dark:bg-slate-900 p-5 text-slate-900 dark:text-white shadow-2xl sm:mt-16">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-amber-700">Pagamento pendente</h2>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{paymentPending.message}</p>
                {paymentPending.providerMode === 'simulated' && (
                  <p className="mt-2 text-xs font-semibold text-amber-800">{t('ticketPaymentPendingSimulated')}</p>
                )}
              </div>
              {(paymentPending.providerRef || paymentPending.transactionId) && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Referência: <strong>{paymentPending.providerRef || paymentPending.transactionId}</strong>
                </p>
              )}
              {paymentPending.reservationExpiresAt && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  A reserva dos bilhetes expira em{' '}
                  <strong>{new Date(paymentPending.reservationExpiresAt).toLocaleString('pt-PT')}</strong>.
                </p>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-300">O bilhete só será emitido depois da confirmação do pagamento.</p>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => {
                  setPaymentPending(null);
                  setSelectedEvent(null);
                  setSelectedTicketType(null);
                  setTicketQuantity(1);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Comprovativo apos compra */}
      {purchasedTickets.length > 0 && selectedEvent && (
        <div
          className="event-modal-overlay fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-[rgba(3,16,13,0.92)] px-3 py-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Comprovativo da compra"
          ref={ticketReceiptRef}
          tabIndex={-1}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPurchaseReceipt(null);
              setSelectedEvent(null);
            }
          }}
        >
          <div className="guigui-voucher-modal w-full max-w-md">
            <div className="guigui-voucher-stack">
              {purchasedTickets.map((ticket, index) => (
                <TicketVoucher
                  key={ticket.id}
                  ticket={ticket}
                  index={index}
                  total={purchasedTickets.length}
                  currentLang={currentLang}
                />
              ))}
            </div>
            <div className="guigui-voucher-actions">
              {onContactOrganizer && (
                <button
                  type="button"
                  onClick={() => onContactOrganizer(selectedEvent)}
                  className="guigui-voucher-action is-contact"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Contactar organizador
                </button>
              )}
              <button
                type="button"
                ref={ticketReceiptCloseRef}
                onClick={() => {
                  setPurchaseReceipt(null);
                  setSelectedEvent(null);
                }}
                className="guigui-voucher-action is-close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Fechar comprovativo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
