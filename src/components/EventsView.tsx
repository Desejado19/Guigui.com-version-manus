import React, { useEffect, useRef, useState } from 'react';
import {
  Ticket,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  Bell,
  BellRing,
  Trash2,
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
} from '../types';
import { getTranslation } from '../utils/i18n';
import { translatePublishedText } from '../utils/contentTranslation';
import { QRCodeDisplay } from './QRCodeDisplay';
import { smsService } from '../services/smsService';
import { usePersistentState } from '../utils/persistentState';
import { TicketPurchaseModal } from './TicketPurchaseModal';
import type { BusinessModelConfig, MonetizationCatalog } from '../types';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees, normaliseMonetizationCatalog } from '../data/monetizationCatalog';
import { Badge, Button, Card, EmptyState } from './ui';

interface EventsViewProps {
  events: EventItem[];
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

export const EventsView: React.FC<EventsViewProps> = ({
  events,
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [eventSearch, setEventSearch] = useState(searchQuery);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedTicketType, setSelectedTicketType] = useState<EventTicketType | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [reminderMenuOpenFor, setReminderMenuOpenFor] = useState<string | null>(null);
  const [notificationStatusNotice, setNotificationStatusNotice] = useState<string | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const [monetizationCatalog] = usePersistentState<MonetizationCatalog>('guigui_monetization_catalog', DEFAULT_MONETIZATION_CATALOG);
  const resolvedMonetizationCatalog = normaliseMonetizationCatalog(monetizationCatalog, businessModelConfig);
  const ticketFeeBreakdown = calculateTicketFees(resolvedMonetizationCatalog, selectedTicketType?.priceXOF || 0, ticketQuantity);

  // Purchase Result State
  const [purchasedTickets, setPurchasedTickets] = useState<TicketType[]>([]);
  const [purchaseDelivery, setPurchaseDelivery] = useState<{
    paymentSimulated: boolean;
    email: 'sent' | 'simulated' | 'failed' | 'unavailable';
    notification: 'created' | 'failed' | 'unavailable';
    sms: 'sent' | 'simulated' | 'failed';
  } | null>(null);
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

  useEffect(() => {
    if (!focusEventId) return;
    const event = events.find((candidate) => candidate.id === focusEventId);
    if (!event) return;
    setSelectedEvent(event);
    setSelectedTicketType(event.ticketTypes[0] || null);
    setTicketQuantity(1);
    setPurchasedTickets([]);
  }, [events, focusEventId]);

  useEffect(() => {
    if (currentUser) return;
    setActiveTab('all');
    setSelectedEvent(null);
    setPurchasedTickets([]);
  }, [currentUser]);

  useEffect(() => {
    if (purchasedTickets.length === 0) return;
    const dialog = ticketReceiptRef.current;
    if (!dialog) return;

    dialog.focus({ preventScroll: true });
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPurchasedTickets([]);
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
    setPurchaseDelivery(null);
    setSelectedTicketType(event.ticketTypes[0] || null);
    setTicketQuantity(1);
    setPurchasedTickets([]);
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
  }) => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta para comprar bilhetes.');
      return;
    }
    if (!selectedEvent) {
      setNotificationStatusNotice('Selecione um evento antes de comprar o bilhete.');
      return;
    }
    const ticketType = selectedEvent.ticketTypes.find((type) => type.id === data.ticketTypeId);
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
          eventId: selectedEvent.id,
          businessId: selectedEvent.businessId,
          eventTitle: selectedEvent.title,
          eventDate: selectedEvent.date,
          eventTime: selectedEvent.time,
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

      const result = await response.json();
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
      setPurchaseDelivery({
        paymentSimulated: result.transaction?.providerMode === 'simulated',
        email: emailState === 'delivered' || emailState === 'accepted' ? 'sent'
          : emailState === 'simulated' || emailState === 'failed' ? emailState
          : 'unavailable',
        notification: notificationState === 'created' || notificationState === 'failed' ? notificationState : 'unavailable',
        sms: smsState === 'delivered' || smsState === 'accepted' ? 'sent'
          : smsState === 'simulated' ? 'simulated'
          : 'failed',
      });
      if (currentUser?.role === 'user' && typeof result.transaction?.id === 'string') {
        onTicketPurchaseConfirmed?.({
          transactionId: result.transaction.id,
          eventId: selectedEvent.id,
          eventTitle: selectedEvent.title,
          businessId: selectedEvent.businessId,
          ticketId: issuedTickets[0].id,
          ticketIds: issuedTickets.map((ticket: TicketType) => ticket.id),
          ticketCodes: issuedTickets.map((ticket: TicketType) => ticket.ticketCode),
        });
      }
      setPurchasedTickets(issuedTickets);
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
  const filteredEvents = events.filter((ev) => {
    const query = eventSearch.trim().toLowerCase();
    const searchableValues = [
      ev.title,
      ev.description,
      ev.location,
      ev.neighborhood,
      ev.organizerName,
      ev.category,
      ...(ev.ticketTypes || []).map((ticket) => `${ticket.name} ${ticket.priceXOF}`),
    ];

    const matchesSearch = !query || searchableValues.some((value) => value.toLowerCase().includes(query));
    const matchesCat = selectedCategory === 'all' || ev.category === selectedCategory;

    return matchesSearch && matchesCat;
  });

  const categories = [
    { id: 'all', label: t('events.all') },
    { id: 'musica', label: 'Música & Festivais' },
    { id: 'gastronomia', label: 'Gastronomia' },
    { id: 'cultural', label: 'Cultura & Teatro' },
    { id: 'negocios', label: 'Feiras & Negócios' },
  ];

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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Explorar Agenda ({events.length})
          </button>

          {currentUser && (
            <button type="button"
              onClick={() => setActiveTab('reminders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'reminders'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Meus Lembretes ({reminders.length})</span>
            </button>
          )}
        </div>
      </div>

      {!currentUser && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Faça login para comprar bilhetes, ativar alertas e guardar lembretes. Enquanto isso, pode apenas explorar a agenda.
        </div>
      )}

      {activeTab === 'all' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <label htmlFor="event-search" className="mb-2 block text-xs font-black text-slate-900 dark:text-white">{t('events.search')}</label>
          <div className="flex gap-2">
            <input
              id="event-search"
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              placeholder="Nome, local, organizador ou categoria..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {eventSearch && (
              <button type="button" onClick={() => setEventSearch('')} className="rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300">Limpar</button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{filteredEvents.length} evento(s) encontrado(s).</p>
        </div>
      )}

      {notificationStatusNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificationStatusNotice}</span>
        </div>
      )}

      {/* Category Filters (when in 'all' tab) */}
      {activeTab === 'all' && (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {categories.map((c) => (
            <button type="button"
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`guigui-filter-chip transition ${
                selectedCategory === c.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: ALL EVENTS GRID */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const hasReminder = isEventFavorited(event.id);
            const rem = getEventReminder(event.id);

            return (
              <Card
                key={event.id}
                interactive
                className="guigui-event-card overflow-hidden flex flex-col justify-between"
              >
                {/* Event Cover Image */}
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                  {event.mediaType === 'video' ? (
                    <video src={event.coverImage} controls muted className="w-full h-full object-cover" aria-label={event.title} />
                  ) : (
                    <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                  )}
                  <Badge variant="neutral" className="absolute top-3 left-3 border-white/20 bg-slate-900/80 text-white backdrop-blur-xs">
                    {event.category.toUpperCase()}
                  </Badge>

                  <Button type="button"
                    variant={hasReminder ? 'accent' : 'primary'}
                    size="icon"
                    onClick={() => {
                      if (onToggleReminder) onToggleReminder(event, '24h_before');
                    }}
                    className="absolute top-3 right-3 rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80"
                    title={hasReminder ? 'Lembrete ativo' : 'Ativar lembrete'}
                    aria-label={hasReminder ? 'Lembrete ativo' : 'Ativar lembrete'}
                  >
                    <BellRing className="w-4 h-4" />
                  </Button>
                </div>

                {/* Event Details */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-blue-700 font-extrabold uppercase tracking-wide">
                      {event.organizerName}
                    </div>
                    <h3 className="font-extrabold text-base text-slate-900 leading-snug">{translatePublishedText(event.title, currentLang, 'title')}</h3>

                    <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{event.date}</span>
                      <span>⬢</span>
                      <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>{event.time}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>
                        {event.location} ({event.neighborhood})
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 pt-1">{translatePublishedText(event.description, currentLang, 'description')}</p>
                  </div>

                  {/* Pricing Tiers Table */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Tipos de Bilhete & Preços</div>
                    <div className="space-y-1">
                      {event.ticketTypes.map((tt) => (
                        <div
                          key={tt.id}
                          className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-800">{tt.name}</span>
                          <span className="font-mono font-extrabold text-emerald-700">
                            {tt.priceXOF.toLocaleString('pt-PT')} XOF
                          </span>
                        </div>
                      ))}
                    </div>

                    {currentUser && (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button type="button"
                          variant="primary"
                          onClick={(clickEvent) => handleOpenBuyModal(event, clickEvent.currentTarget)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>Comprar Bilhete</span>
                        </Button>

                        <Button type="button"
                          variant="secondary"
                          onClick={() => currentUser ? onTriggerTestAlert?.(event) : onRequireLogin?.('Inicie sessão ou crie uma conta para activar alertas.')}
                          className="w-full"
                        >
                          <BellRing className="w-4 h-4 text-amber-500" />
                          <span>Testar Alerta</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 2: REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-500" />
                <span>Lembretes Ativos da Agenda ({reminders.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Os eventos favoritados disparam avisos na plataforma para garantir que não perde a data.
              </p>
            </div>

            <button type="button"
              onClick={handleRequestBrowserNotifications}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5"
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
                    className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                        <img src={r.eventCover} alt="" className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase">
                          <BellRing className="w-3 h-3 animate-pulse" />
                          <span>Lembrete Ativo</span>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 truncate">{r.eventTitle}</h4>
                        <p className="text-[11px] text-slate-600">
                          📅 {r.eventDate} às {r.eventTime}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          📍 {r.eventLocation} ({r.eventNeighborhood})
                        </p>
                      </div>
                    </div>

                    {currentUser && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500">Avisar:</span>
                          <select
                            value={r.timeframe}
                            onChange={(e) => {
                              if (ev && onToggleReminder) {
                                onToggleReminder(ev, e.target.value as ReminderTimeframe);
                              }
                            }}
                            className="bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2 py-1 outline-none"
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

      {/* Ticket Purchase - novo modal */}
      <TicketPurchaseModal
        isOpen={isPurchaseModalOpen && purchasedTickets.length === 0 && !paymentPending}
        event={selectedEvent}
        ticketTypes={selectedEvent?.ticketTypes || []}
        currentUser={currentUser}
        currentLang={currentLang}
        monetizationCatalog={resolvedMonetizationCatalog}
        isSubmitting={isSubmitting}
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
          <div className="ticket-surface mt-8 w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-5 text-slate-900 shadow-2xl sm:mt-16">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-amber-700">Pagamento pendente</h2>
                <p className="mt-2 text-sm text-slate-700">{paymentPending.message}</p>
                {paymentPending.providerMode === 'simulated' && (
                  <p className="mt-2 text-xs font-semibold text-amber-800">{t('ticketPaymentPendingSimulated')}</p>
                )}
              </div>
              {(paymentPending.providerRef || paymentPending.transactionId) && (
                <p className="text-xs text-slate-600">
                  Referência: <strong>{paymentPending.providerRef || paymentPending.transactionId}</strong>
                </p>
              )}
              {paymentPending.reservationExpiresAt && (
                <p className="text-xs text-slate-600">
                  A reserva dos bilhetes expira em{' '}
                  <strong>{new Date(paymentPending.reservationExpiresAt).toLocaleString('pt-PT')}</strong>.
                </p>
              )}
              <p className="text-xs text-slate-600">O bilhete só será emitido depois da confirmação do pagamento.</p>
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
          className="event-modal-overlay fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-slate-950/70 px-3 py-4 backdrop-blur-xs sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Comprovativo da compra"
          ref={ticketReceiptRef}
          tabIndex={-1}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPurchasedTickets([]);
              setSelectedEvent(null);
            }
          }}
        >
          <div
            className="ticket-surface ticket-purchase-modal ticket-receipt-scroll mt-0 w-full max-w-3xl overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl animate-in zoom-in-95 sm:p-5"
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
          >
            <div className="space-y-3 sm:space-y-4">
              <div className="ticket-success-notice flex items-start gap-3 rounded-2xl border p-3 text-sm sm:p-4" role="status" aria-live="polite">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <div>
                  <h2 className="font-extrabold">Compra concluída com sucesso</h2>
                  <p className="mt-0.5 text-xs sm:text-sm">O seu bilhete digital está pronto. Apresente o QR Code ou o código à entrada.</p>
                </div>
              </div>
              {purchaseDelivery && (
                <div className="ticket-delivery-status space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" role="status" aria-live="polite">
                  {purchaseDelivery.paymentSimulated && <p>{t('ticketPaymentSimulated')}</p>}
                  <p>
                    {purchaseDelivery.email === 'sent' ? t('ticketEmailSent')
                     : purchaseDelivery.email === 'simulated' ? t('ticketEmailSimulated')
                      : purchaseDelivery.email === 'failed' ? t('ticketEmailFailed')
                      : t('ticketEmailUnavailable')}
                  </p>
                  <p>
                    {purchaseDelivery.sms === 'sent' ? t('ticketSmsSent')
                      : purchaseDelivery.sms === 'simulated' ? t('ticketSmsSimulated')
                      : t('ticketSmsFailed')}
                  </p>
                  {purchaseDelivery.notification !== 'unavailable' && (
                    <p>{purchaseDelivery.notification === 'created' ? t('ticketNotificationSaved') : t('ticketNotificationFailed')}</p>
                  )}
                </div>
              )}
              <div className="ticket-receipt-order-summary flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/50">
                <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {purchasedTickets.length} bilhete{purchasedTickets.length === 1 ? '' : 's'} emitido{purchasedTickets.length === 1 ? '' : 's'}
                </span>
                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">
                  Total pago: {ticketFeeBreakdown.buyerTotal.toLocaleString('pt-PT')} XOF
                </span>
              </div>
              <div className="space-y-3">
                {purchasedTickets.map((ticket, index) => (
                  <div key={ticket.id} className="ticket-receipt-ticket rounded-2xl border border-emerald-200/80 p-2 dark:border-emerald-900 sm:p-3">
                    <QRCodeDisplay
                      code={ticket.ticketCode}
                      qrToken={ticket.qrToken || ticket.ticketCode}
                      title={ticket.eventTitle}
                      subtitle={`Bilhete ${ticket.ticketTypeName} (${index + 1}/${purchasedTickets.length})`}
                      buyerName={ticket.buyerName}
                      buyerPhone={ticket.buyerPhone}
                      amountXOF={ticket.priceXOF}
                      amountLabel="qrUnitPrice"
                      pinCode={ticket.pinCode}
                      validUntil={ticket.expiresAt}
                      status={ticket.status}
                      currentLang={currentLang}
                      purchaseReceipt
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {onContactOrganizer && (
                  <button type="button" onClick={() => onContactOrganizer(selectedEvent)} className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-blue-700">
                    Contactar organizador
                  </button>
                )}
                <button
                  type="button"
                  ref={ticketReceiptCloseRef}
                  onClick={() => {
                    setPurchasedTickets([]);
                    setSelectedEvent(null);
                  }}
                  className="ticket-receipt-close min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-3 text-xs font-bold text-white transition hover:bg-emerald-600"
                >
                  {t('close')} comprovativo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
