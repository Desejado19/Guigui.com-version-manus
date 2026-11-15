import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Ticket,
  Clock,
  MapPin,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  X,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { Business, EventItem, Language, PurchaseOrder } from '../../types';
import { getTranslation } from '../../utils/i18n';

const readLocalMedia = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro multimédia.'));
  reader.readAsDataURL(file);
});

interface ClientEventsManagementProps {
  business: Business;
  currentLang?: Language;
  events?: EventItem[];
  purchaseOrders?: PurchaseOrder[];
  onEventSubmitted?: (event: EventItem) => void;
  onEventCancelled?: (event: EventItem) => void;
}

export const ClientEventsManagement: React.FC<ClientEventsManagementProps> = ({
  business,
  currentLang = 'pt' as Language,
  events = [],
  purchaseOrders = [],
  onEventSubmitted,
  onEventCancelled,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const createModalRef = React.useRef<HTMLDivElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myEvents, setMyEvents] = useState<EventItem[]>(
    events.filter((e) => e.businessId === business.id || e.organizer?.toLowerCase().includes(business.name.toLowerCase()))
  );

  React.useEffect(() => {
    setMyEvents(events.filter((e) => e.businessId === business.id || e.organizer?.toLowerCase().includes(business.name.toLowerCase())));
  }, [events, business.id, business.name]);

  // New Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [location, setLocation] = useState(business.name + ` (${business.neighborhood})`);
  const [priceXOF, setPriceXOF] = useState(5000);
  const [vipPriceXOF, setVipPriceXOF] = useState(15000);
  const [capacity, setCapacity] = useState(150);
  const [category, setCategory] = useState<'musica' | 'gastronomia' | 'cultural' | 'workshop'>('gastronomia');
  const [imageUrl, setImageUrl] = useState(business.coverImage || business.logo);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaError, setMediaError] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  React.useEffect(() => {
    if (showCreateModal) {
      createModalRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [showCreateModal]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const newEvent: EventItem = {
      id: `ev-${Date.now()}`,
      businessId: business.id,
      title,
      description,
      date,
      time,
      location,
      neighborhood: business.neighborhood || t('business.Todos'),
      coverImage: imageUrl,
      mediaType,
      category,
      organizerName: business.name,
      status: 'draft',
      ticketTypes: [
        {
          id: `tt-normal-${Date.now()}`,
          name: 'Normal',
          priceXOF,
          availableQuantity: capacity,
          soldQuantity: 0,
        },
        ...(vipPriceXOF > 0
          ? [
              {
                id: `tt-vip-${Date.now()}`,
                name: 'VIP / Esplanada',
                priceXOF: vipPriceXOF,
                availableQuantity: 20,
                soldQuantity: 0,
              },
            ]
          : []),
      ],
      totalTicketsSold: 0,
      totalRevenueXOF: 0,
      scannerDoorCode: String(Math.floor(1000 + Math.random() * 9000)),
    };

    setMyEvents([newEvent, ...myEvents]);
    onEventSubmitted?.(newEvent);
    setShowCreateModal(false);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 4000);

    // Reset Form
    setTitle('');
    setDescription('');
    setDate('');
  };

  const handleCancelEvent = (id: string) => {
    const cancelledEvent = myEvents.find((event) => event.id === id);
    setMyEvents(myEvents.map((e) => (e.id === id ? { ...e, status: 'cancelled' } : e)));
    if (cancelledEvent) onEventCancelled?.({ ...cancelledEvent, status: 'cancelled' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs px-3 py-1 rounded-full font-bold mb-1 border border-amber-200">
              <Calendar className="w-3.5 h-3.5" />
              <span>{t('ownEventsTicketing')}</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[var(--color-text-strong)]">
              Eventos de {business.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('eventsManagementDescription')}
            </p>
          </div>

          <button type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl transition flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('createNewEvent')}</span>
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-3 rounded-2xl border border-emerald-300 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t('eventSubmittedForApproval')}</span>
          </div>
        )}
      </div>

      {/* Events List */}
      {myEvents.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-8 text-center text-[var(--color-text-muted)] space-y-4 shadow-[var(--shadow-xs)]">
          <Calendar className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="font-bold text-sm text-slate-800">
            {t('noEventsCreated')}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {t('noEventsHint')}
          </p>
          <button type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t('createFirstEvent')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {myEvents.map((ev) => (
            <div
              key={ev.id}
              className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)] transition flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="h-36 relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {ev.mediaType === 'video' ? (
                    <video src={ev.coverImage} controls muted className="w-full h-full object-cover" aria-label={ev.title} />
                  ) : (
                    <img src={ev.coverImage || business.coverImage || business.logo} alt={ev.title} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                    {ev.category}
                  </div>
                  {ev.status === 'cancelled' && (
                    <div className="absolute inset-0 bg-red-900/70 backdrop-blur-xs flex items-center justify-center text-white font-black text-xs uppercase">
                      {t('eventCancelled')}
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-3">
                  <h3 className="font-black text-sm text-slate-900 line-clamp-1">{ev.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {ev.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100 font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ev.date} às {ev.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{ev.location}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-slate-900 font-mono">
                        {(ev.ticketTypes?.[0]?.priceXOF || 0).toLocaleString('pt-PT')} XOF
                      </span>
                      <span className="text-[11px] text-emerald-600 font-bold">
                        {ev.totalTicketsSold || 0} / {(ev.ticketTypes?.[0]?.availableQuantity || 100)} bilhetes
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-600 uppercase font-bold">
                  Status: {({
                    active: 'Ativo no Feed',
                    draft: 'Em aprovação',
                    cancelled: 'Cancelado',
                    ended: 'Encerrado',
                  }[ev.status])}
                </span>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setSelectedEvent(ev)} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800">
                    <Users className="h-3.5 w-3.5" /> Participantes
                  </button>
                  {ev.status === 'active' && (
                    <button type="button"
                      onClick={() => handleCancelEvent(ev.id)}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700"
                    >
                      Encerrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Participantes de ${selectedEvent.title}`}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-5 shadow-[var(--shadow-lg)] sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Gestão de bilhetes</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">{selectedEvent.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{selectedEvent.totalTicketsSold || 0} vendidos · {(selectedEvent.totalRevenueXOF || 0).toLocaleString('pt-PT')} XOF de receita</p>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} className="guigui-close-button" aria-label="Fechar participantes"><X className="h-4 w-4" /></button>
            </div>
            {purchaseOrders.filter((order) => order.eventId === selectedEvent.id && order.businessId === business.id).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-8 text-center text-xs text-slate-500">
                <Ticket className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                Ainda não existem participantes ou vendas registadas para este evento.
              </div>
            ) : (
              <div className="space-y-2">
                {purchaseOrders.filter((order) => order.eventId === selectedEvent.id && order.businessId === business.id).map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
                    <div>
                      <div className="text-xs font-black text-slate-900">{order.customerName}</div>
                      <div className="text-[11px] text-slate-500">{order.customerPhone} · {order.quantity} bilhete(s)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-black text-slate-800">{order.qrToken}</div>
                      <div className="text-[10px] font-bold uppercase text-slate-500">{order.status === 'redeemed' ? 'Validado' : order.status === 'cancelled' ? 'Cancelado' : 'Pendente'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {showCreateModal && (
        <div className="event-modal-overlay fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-3 overflow-y-auto">
          <div ref={createModalRef} className="my-4 w-full max-w-3xl space-y-5 overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-4 shadow-[var(--shadow-lg)] sm:my-8 sm:p-7">
          <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-7 sm:-mt-7 sm:px-7">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-black text-base text-slate-900">Novo Evento</h3>
                  <p className="mt-1 truncate text-[11px] text-slate-500">Para {business.name}</p>
                </div>
              </div>
              <button type="button"
                onClick={() => setShowCreateModal(false)}
                className="guigui-close-button"
                aria-label="Fechar janela de criação de evento"
                title="Fechar"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3">
            <div className="event-form-section space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] p-3 sm:p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">1. Informações principais</p>
                  <p className="mt-1 text-[11px] text-slate-500">Apresente o evento com um título e uma descrição objetiva.</p>
                </div>
                <label className="block text-xs font-bold text-slate-700">Título do evento
                <input
                  type="text"
                  required
                  placeholder="Ex: Noite de Kizomba e Marisco na Esplanada"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 min-h-11 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                </label>

                <label className="block text-xs font-bold text-slate-700">Descrição / programa
                <textarea
                  rows={2}
                  required
                  placeholder="Atrações musicais, menu incluído, dress code..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 min-h-28 w-full resize-y px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                </label>
              </div>

              <div className="event-form-section event-schedule-section space-y-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 sm:p-3.5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">2. Data e local</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Ajude os participantes a planear a presença.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] font-bold text-slate-700">Data
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-700">Horário
                    <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-700 sm:col-span-2">Local
                    <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Restaurante Coqueiros, Bissau Velho" className="mt-1 w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-700">Categoria
                    <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="mt-1 w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="todos">Todos</option>
                      <option value="gastronomia">Gastronomia</option>
                      <option value="musica">Música</option>
                      <option value="cultural">Cultural</option>
                      <option value="workshop">Workshop</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="event-form-section space-y-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 sm:p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">3. Divulgação</p>
                    <label className="text-xs font-black text-slate-800">Imagem ou vídeo do evento</label>
                    <p className="mt-0.5 text-[10px] text-slate-500">Escolha um ficheiro ou cole um URL para destacar o evento.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
                    <button type="button" onClick={() => { setMediaType('image'); setMediaError(''); }} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${mediaType === 'image' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}><ImageIcon className="mr-1 inline h-3 w-3" />{t('business.Imagem')}</button>
                    <button type="button" onClick={() => { setMediaType('video'); setMediaError(''); }} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${mediaType === 'video' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}><Video className="mr-1 inline h-3 w-3" />{t('video')}</button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input type="url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setMediaError(''); }} placeholder={mediaType === 'image' ? 'URL da imagem (opcional)' : 'URL do vídeo (opcional)'} className="min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900" />
                  <input type="file" accept={mediaType === 'image' ? 'image/*' : 'video/*'} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const expectedType = mediaType === 'image' ? 'image/' : 'video/';
                    if (!file.type.startsWith(expectedType)) {
                      setMediaError(`Seleccione um ficheiro ${mediaType === 'image' ? 'de imagem' : 'de vídeo'}.`);
                      return;
                    }
                    if (file.size > 20 * 1024 * 1024) {
                      setMediaError('O ficheiro deve ter no máximo 20 MB.');
                      return;
                    }
                    try {
                      setMediaError('');
                      setImageUrl(await readLocalMedia(file));
                    } catch (error) {
                      setMediaError(error instanceof Error ? error.message : 'Não foi possível carregar este ficheiro.');
                    }
                  }} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" />
                </div>
                {mediaError && <p className="text-xs font-semibold text-rose-600">{mediaError}</p>}
                {imageUrl && <div className="h-36 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">{mediaType === 'video' ? <video src={imageUrl} controls muted className="h-full w-full object-cover" /> : <img src={imageUrl} alt="Pré-visualização do evento" className="h-full w-full object-cover" />}</div>}
              </div>

              <div className="event-form-section space-y-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-3.5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">4. Bilhetes e capacidade</p>
                  <p className="mt-1 text-[11px] text-emerald-700">Defina os valores e a lotação disponível.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-bold text-slate-700">Bilhete geral (XOF)
                  <input
                    type="number"
                    required
                    value={priceXOF}
                    onChange={(e) => setPriceXOF(Number(e.target.value))}
                    className="mt-1.5 min-h-11 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  </label>

                  <label className="text-xs font-bold text-slate-700">Bilhete VIP (XOF)
                  <input
                    type="number"
                    value={vipPriceXOF}
                    onChange={(e) => setVipPriceXOF(Number(e.target.value))}
                    className="mt-1.5 min-h-11 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  </label>
                  <label className="text-xs font-bold text-slate-700">Lotação máxima
                  <input
                    type="number"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="mt-1.5 min-h-11 w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-h-11 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition sm:min-h-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-11 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs sm:min-h-0"
                >
                  Enviar para aprovação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
