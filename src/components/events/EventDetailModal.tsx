import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Calendar, ChevronDown, Download, MapPin, Minus, MessageCircle, Plus, ShieldCheck, X } from 'lucide-react';
import type { EventItem, Language, UserProfile } from '../../types';
import { translatePublishedText } from '../../utils/contentTranslation';
import {
  DEFAULT_MONETIZATION_CATALOG,
  calculateTicketFees,
  normaliseMonetizationCatalog,
} from '../../data/monetizationCatalog';
import { formatEventDateLong, lowestTicketPrice } from './EventCard';
import { downloadBuyerListCsv } from '../../utils/buyerListExport';

const POLICY_VERSION = '1.0';
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,23}$/;

/** Dados recolhidos no próprio detalhe do evento antes de emitir o bilhete. */
export interface TicketCheckoutPayload {
  ticketTypeId: string;
  category: string;
  quantity: number;
  buyerName: string;
  buyerPhone: string;
  holderName?: string;
  holderPhone?: string;
  paymentMethod: 'orange' | 'telecel';
  policyAccepted: boolean;
  policyVersion: string;
  policyAcceptedAt: string;
  categoryPriceXOF: number;
  chargedAmountXOF: number;
}

interface EventDetailModalProps {
  event: EventItem | null;
  currentLang: Language;
  currentUser?: UserProfile | null;
  hasReminder?: boolean;
  isSubmitting?: boolean;
  monetizationCatalog?: Parameters<typeof normaliseMonetizationCatalog>[0];
  onClose: () => void;
  onBuy: (payload: TicketCheckoutPayload) => void;
  onRequireLogin?: (notice?: string) => void;
  onToggleReminder?: (event: EventItem) => void;
  onContactOrganizer?: (event: EventItem) => void;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      // Ignora palavras que não começam por letra/dígito (ex.: "&" em
      // "Guigui.com & Produções" gerava as iniciais "G&").
      .filter((part) => /^[\p{L}\p{N}]/u.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

const money = (value: number, lang: Language) =>
  `${value.toLocaleString(lang === 'pt' ? 'pt-PT' : lang)} XOF`;

/**
 * Detalhe do evento na estrutura aprovada: hero com imagem, "Sobre o evento",
 * organico, localizacao e painel de bilhetes. A finalizacao da compra acontece
 * aqui: comprador, titular do bilhete, Orange Money/Telecel e politica de
 * bilhetica. O pagamento continua a passar pelo fluxo oficial do servidor
 * (cotacao, taxas, idempotencia e emissao do QR Code).
 */
export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  currentLang,
  currentUser,
  hasReminder = false,
  isSubmitting = false,
  monetizationCatalog,
  onClose,
  onBuy,
  onRequireLogin,
  onToggleReminder,
  onContactOrganizer,
}) => {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isExportingBuyers, setIsExportingBuyers] = useState(false);
  const [buyerExportNotice, setBuyerExportNotice] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState(currentUser?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '');
  const [holderIsOther, setHolderIsOther] = useState(false);
  const [holderName, setHolderName] = useState('');
  const [holderPhone, setHolderPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'orange' | 'telecel'>('orange');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTypeId(null);
    setQuantity(1);
    setBuyerName(currentUser?.name || '');
    setBuyerPhone(currentUser?.phone || '');
    setHolderIsOther(false);
    setHolderName('');
    setHolderPhone('');
    setPaymentMethod('orange');
    setPolicyAccepted(false);
    setValidationError(null);
  }, [event?.id, currentUser?.id, currentUser?.name, currentUser?.phone]);

  const types = event?.ticketTypes || [];
  const selectedType = useMemo(
    () => types.find((type) => type.id === selectedTypeId) || types[0] || null,
    [types, selectedTypeId],
  );

  const available = selectedType
    ? Math.max(0, selectedType.availableQuantity - selectedType.soldQuantity)
    : 0;
  const maxQuantity = Math.max(1, Math.min(10, available || 1));
  const safeQuantity = Math.min(quantity, maxQuantity);
  const feeBreakdown = useMemo(
    () =>
      calculateTicketFees(
        normaliseMonetizationCatalog(monetizationCatalog, undefined) || DEFAULT_MONETIZATION_CATALOG,
        selectedType?.priceXOF || 0,
        safeQuantity,
      ),
    [monetizationCatalog, selectedType?.priceXOF, safeQuantity],
  );
  const total = feeBreakdown.buyerTotal;

  if (!event) return null;

  const fromPrice = lowestTicketPrice(event);
  const mapsQuery = encodeURIComponent(`${event.location}, ${event.neighborhood}, Bissau`);

  // Só a organização do evento (ou a administração) pode descarregar a lista de
  // compradores; a API valida o mesmo âmbito pela empresa da sessão.
  const canExportBuyers = Boolean(
    currentUser
    && (currentUser.role === 'admin'
      || (currentUser.role === 'business'
        && currentUser.businessId
        && event.businessId
        && currentUser.businessId === event.businessId)),
  );

  const handleDownloadBuyers = async () => {
    setIsExportingBuyers(true);
    setBuyerExportNotice(null);
    try {
      const result = await downloadBuyerListCsv(event.id);
      setBuyerExportNotice(result.message);
    } finally {
      setIsExportingBuyers(false);
    }
  };

  const handleSubmit = () => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta para comprar bilhetes.');
      return;
    }
    if (!selectedType) return setValidationError('Selecione uma categoria de bilhete.');
    if (available === 0) return setValidationError('Esta categoria de bilhete está esgotada.');
    if (!buyerName.trim()) return setValidationError('Indique o nome do comprador.');
    if (!PHONE_PATTERN.test(buyerPhone.trim())) {
      return setValidationError('Indique um número de telefone válido.');
    }
    if (holderIsOther && (!holderName.trim() || !PHONE_PATTERN.test(holderPhone.trim()))) {
      return setValidationError('Indique o nome e o telefone de quem vai usar o bilhete.');
    }
    if (!policyAccepted) return setValidationError('Aceite a política de bilhética para continuar.');

    setValidationError(null);
    onBuy({
      ticketTypeId: selectedType.id,
      category: selectedType.name,
      quantity: safeQuantity,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      paymentMethod,
      policyAccepted,
      policyVersion: POLICY_VERSION,
      policyAcceptedAt: new Date().toISOString(),
      categoryPriceXOF: selectedType.priceXOF,
      chargedAmountXOF: total,
      ...(holderIsOther ? { holderName: holderName.trim(), holderPhone: holderPhone.trim() } : {}),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[300] overflow-y-auto bg-[rgba(8,26,22,0.72)] px-3 py-4 sm:px-6 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-label={event.title}
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) onClose();
      }}
    >
      <div className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-[26px] bg-[var(--color-neutral-50)] dark:bg-slate-900 shadow-[0_30px_80px_rgba(8,26,22,0.35)]">
        {/* Hero */}
        <header className="relative h-[280px] w-full overflow-hidden bg-[var(--color-green-950)] sm:h-[320px]">
          {event.mediaType === 'video' ? (
            <video src={event.coverImage} controls muted playsInline className="h-full w-full object-cover" />
          ) : (
            <img src={event.coverImage} alt={event.title} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(6,24,20,0.92)] via-[rgba(6,24,20,0.45)] to-[rgba(6,24,20,0.15)]" />

          <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 sm:p-8">
            <span className="inline-flex items-center rounded-full border border-emerald-500 bg-emerald-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
              {event.category}
            </span>
            <h1 className="max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl">
              {translatePublishedText(event.title, currentLang, 'title')}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-white/90">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--color-gold-400)]" />
                {formatEventDateLong(event, currentLang)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--color-gold-400)]" />
                {event.location}, {event.neighborhood}
              </span>
            </div>
          </div>

          <div className="absolute right-4 top-4 flex items-center gap-2">
            {onToggleReminder && (
              <button
                type="button"
                onClick={() => onToggleReminder(event)}
                aria-label={hasReminder ? 'Lembrete ativo' : 'Ativar lembrete'}
                title={hasReminder ? 'Lembrete ativo' : 'Ativar lembrete'}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${ hasReminder ? 'bg-[var(--color-gold-400)] text-[var(--color-green-950)]' : 'bg-emerald-900 text-white hover:bg-white/30' }`}
              >
                {hasReminder ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhe do evento"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900 text-white transition hover:bg-emerald-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Conteudo */}
          <div className="space-y-5">
            <section className="space-y-2">
              <h2 className="text-2xl font-black tracking-[-0.01em] text-[var(--color-neutral-900)] dark:text-white">Sobre o evento</h2>
              <p className="text-sm leading-relaxed text-[var(--color-neutral-600)] dark:text-slate-300">
                {translatePublishedText(event.description, currentLang, 'description')}
              </p>
            </section>

            {canExportBuyers && (
              <section className="space-y-3 rounded-2xl border border-[var(--color-neutral-200)] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <h3 className="text-base font-black text-[var(--color-neutral-900)] dark:text-white">Compradores deste evento</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-neutral-600)] dark:text-slate-300">
                    Descarregue a lista completa em CSV, com nome, telefone, quantidade de bilhetes e os tipos comprados por cada pessoa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadBuyers()}
                  disabled={isExportingBuyers}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--color-green-700)] px-4 py-2 text-xs font-black text-white transition hover:bg-[var(--color-green-800)] disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {isExportingBuyers ? 'A preparar lista...' : 'Baixar lista de compradores (CSV)'}
                </button>
                {buyerExportNotice && (
                  <p role="status" className="text-[11px] font-semibold text-[var(--color-neutral-600)] dark:text-slate-300">{buyerExportNotice}</p>
                )}
              </section>
            )}

            <section className="flex items-center gap-3 rounded-2xl border border-[var(--color-neutral-200)] dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-green-800)] text-sm font-black text-white">
                {initials(event.organizerName)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-neutral-500)] dark:text-slate-400">Organizado por</p>
                <p className="truncate text-base font-black text-[var(--color-neutral-900)] dark:text-white">{event.organizerName}</p>
              </div>
              {onContactOrganizer && (
                <button
                  type="button"
                  onClick={() => onContactOrganizer(event)}
                  className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-neutral-200)] dark:border-slate-700 px-3 py-2 text-xs font-bold text-[var(--color-green-800)] transition hover:border-[var(--color-green-700)]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Contactar
                </button>
              )}
            </section>

            <section className="space-y-2 rounded-2xl border border-[var(--color-neutral-200)] dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-base font-black text-[var(--color-neutral-900)] dark:text-white">Localização</h3>
              <p className="text-sm text-[var(--color-neutral-600)] dark:text-slate-300">
                {event.location}, {event.neighborhood}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-bold text-[var(--color-green-700)] underline decoration-[var(--color-green-300)] underline-offset-4 hover:text-[var(--color-green-800)]"
              >
                Ver no Google Maps
              </a>
            </section>
          </div>

          {/* Bilhetes e finalizacao da compra */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="space-y-4 rounded-2xl border border-[var(--color-neutral-200)] dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-black text-[var(--color-neutral-900)] dark:text-white">Bilhetes</h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-green-700)]">
                  <ShieldCheck className="h-4 w-4" />
                  Compra segura
                </span>
              </div>

              <div className="space-y-2">
                {types.length === 0 && (
                  <p className="rounded-xl bg-[var(--color-neutral-50)] dark:bg-slate-900 px-3 py-3 text-xs font-semibold text-[var(--color-neutral-600)] dark:text-slate-300">
                    Bilheteira ainda não aberta para este evento.
                  </p>
                )}
                {types.map((type) => {
                  const typeAvailable = Math.max(0, type.availableQuantity - type.soldQuantity);
                  const active = selectedType?.id === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        if (!currentUser) return;
                        setSelectedTypeId(type.id);
                        setQuantity(1);
                        setValidationError(null);
                      }}
                      aria-disabled={!currentUser}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${ active ? 'border-[var(--color-green-700)] bg-[var(--color-green-50)] dark:border-emerald-400 dark:bg-emerald-950' : 'border-[var(--color-neutral-200)] dark:border-slate-600 dark:bg-slate-900 hover:border-[var(--color-neutral-300)]' }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--color-neutral-900)] dark:text-white">{type.name}</p>
                          <p className="text-[11px] text-[var(--color-neutral-500)] dark:text-slate-400">Acesso à festa</p>
                          <p className="mt-0.5 text-[11px] text-[var(--color-neutral-500)] dark:text-slate-400">
                            {typeAvailable > 0 ? `${typeAvailable} disponíveis` : 'Esgotado'}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-black text-[var(--color-coral-600)]">
                          {money(type.priceXOF, currentLang)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentUser ? (
                <>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, safeQuantity - 1))}
                      disabled={safeQuantity <= 1}
                      aria-label="Diminuir quantidade"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] dark:text-slate-200 transition hover:bg-[var(--color-neutral-50)] dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-base font-black text-[var(--color-neutral-900)] dark:text-white">{safeQuantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(maxQuantity, safeQuantity + 1))}
                      disabled={safeQuantity >= maxQuantity || available === 0}
                      aria-label="Aumentar quantidade"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] dark:text-slate-200 transition hover:bg-[var(--color-neutral-50)] dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Dados de quem compra e de quem usa o bilhete */}
                  <div className="space-y-2.5 border-t border-[var(--color-neutral-200)] dark:border-slate-700 pt-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-neutral-500)] dark:text-white">
                      Dados da compra
                    </p>
                    <label className="block text-[11px] font-semibold text-[var(--color-neutral-700)] dark:text-slate-200">
                      Nome de quem compra
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Nome completo"
                        aria-label="Nome de quem compra"
                        className="mt-1 w-full rounded-xl border border-[var(--color-neutral-300)] dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium text-[var(--color-neutral-900)] dark:text-white outline-none focus:border-[var(--color-green-600)]"
                      />
                    </label>
                    <label className="block text-[11px] font-semibold text-[var(--color-neutral-700)] dark:text-slate-200">
                      Telemóvel de quem compra
                      <input
                        type="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="+245 955 000 000"
                        aria-label="Telemóvel de quem compra"
                        className="mt-1 w-full rounded-xl border border-[var(--color-neutral-300)] dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium text-[var(--color-neutral-900)] dark:text-white outline-none focus:border-[var(--color-green-600)]"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setHolderIsOther((previous) => !previous);
                        setValidationError(null);
                      }}
                      aria-expanded={holderIsOther}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--color-neutral-300)] dark:border-slate-600 bg-[var(--color-neutral-50)] dark:bg-slate-950 px-3 py-2 text-left"
                    >
                      <span className="text-[11px] font-semibold text-[var(--color-neutral-700)] dark:text-slate-200">
                        O bilhete é para outra pessoa
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-[var(--color-neutral-500)] transition-transform ${holderIsOther ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {holderIsOther && (
                      <div className="space-y-2.5">
                        <label className="block text-[11px] font-semibold text-[var(--color-neutral-700)] dark:text-slate-200">
                          Nome de quem vai usar
                          <input
                            type="text"
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            placeholder="Nome do titular do bilhete"
                            aria-label="Nome de quem vai usar o bilhete"
                            className="mt-1 w-full rounded-xl border border-[var(--color-neutral-300)] dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium text-[var(--color-neutral-900)] dark:text-white outline-none focus:border-[var(--color-green-600)]"
                          />
                        </label>
                        <label className="block text-[11px] font-semibold text-[var(--color-neutral-700)] dark:text-slate-200">
                          Telemóvel de quem vai usar
                          <input
                            type="tel"
                            value={holderPhone}
                            onChange={(e) => setHolderPhone(e.target.value)}
                            placeholder="+245 966 000 000"
                            aria-label="Telemóvel de quem vai usar o bilhete"
                            className="mt-1 w-full rounded-xl border border-[var(--color-neutral-300)] dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium text-[var(--color-neutral-900)] dark:text-white outline-none focus:border-[var(--color-green-600)]"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Pagamento */}
                  <div className="space-y-2 border-t border-[var(--color-neutral-200)] dark:border-slate-700 pt-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-neutral-500)] dark:text-white">
                      Pagamento
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('orange')}
                        aria-pressed={paymentMethod === 'orange'}
                        className={`rounded-xl border px-2.5 py-2.5 text-center transition ${ paymentMethod === 'orange' ? 'border-[var(--color-gold-500)] bg-[var(--color-gold-50)] text-[var(--color-gold-800)] dark:border-amber-400 dark:bg-slate-800 dark:text-white' : 'border-[var(--color-neutral-200)] dark:border-slate-600 text-[var(--color-neutral-600)] dark:text-slate-300 hover:border-[var(--color-neutral-300)]' }`}
                      >
                        <span className="block text-[11px] font-black">Orange Money</span>
                        <span className="block text-[10px] opacity-80">Bissau</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('telecel')}
                        aria-pressed={paymentMethod === 'telecel'}
                        className={`rounded-xl border px-2.5 py-2.5 text-center transition ${ paymentMethod === 'telecel' ? 'border-[var(--color-blue-400)] bg-[var(--color-blue-50)] text-[var(--color-blue-700)] dark:border-sky-400 dark:bg-slate-800 dark:text-white' : 'border-[var(--color-neutral-200)] dark:border-slate-600 text-[var(--color-neutral-600)] dark:text-slate-300 hover:border-[var(--color-neutral-300)]' }`}
                      >
                        <span className="block text-[11px] font-black">Telecel</span>
                        <span className="block text-[10px] opacity-80">Bissau</span>
                      </button>
                    </div>
                  </div>

                  {/* Totais */}
                  <div className="space-y-1 border-t border-[var(--color-neutral-200)] dark:border-slate-700 pt-3 text-xs">
                    <div className="flex items-center justify-between text-[var(--color-neutral-500)] dark:text-slate-400">
                      <span>
                        {safeQuantity} x {selectedType?.name || 'Bilhete'} ({money(selectedType?.priceXOF || 0, currentLang)})
                      </span>
                      <span>{money(feeBreakdown.grossTicketValue, currentLang)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 text-sm font-black text-[var(--color-neutral-900)] dark:text-white">
                      <span>Total a pagar</span>
                      <span>{subtotalLabel(total, currentLang)}</span>
                    </div>
                  </div>

                  {/* Politica de bilhetica */}
                  <label className="flex items-start gap-2 rounded-xl border border-[var(--color-neutral-200)] dark:border-slate-700 bg-[var(--color-neutral-50)] dark:bg-slate-950 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => setPolicyAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--color-neutral-300)] text-[var(--color-green-700)]"
                    />
                    <span className="text-[10px] leading-relaxed text-[var(--color-neutral-600)] dark:text-slate-300">
                      Li e aceito a política de bilhética da Guigui.com (v{POLICY_VERSION}): a compra é
                      definitiva após confirmação do pagamento, sem cancelamento voluntário.
                    </span>
                  </label>

                  {validationError && (
                    <p
                      role="alert"
                      className="rounded-xl border border-[var(--color-red-500)]/40 bg-[var(--color-red-500)]/10 px-3 py-2 text-[11px] font-semibold text-[var(--color-red-500)]"
                    >
                      {validationError}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={!selectedType || available === 0 || isSubmitting}
                    aria-busy={isSubmitting}
                    onClick={handleSubmit}
                    className="w-full rounded-xl bg-[var(--color-coral-500)] px-4 py-3 text-sm font-black text-white transition hover:bg-[var(--color-coral-600)] disabled:cursor-not-allowed disabled:bg-[var(--color-neutral-300)] dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                  >
                    {available === 0 ? 'Esgotado' : isSubmitting ? 'A processar...' : `Comprar bilhete · ${subtotalLabel(total, currentLang)}`}
                  </button>

                  <p className="text-center text-[11px] text-[var(--color-neutral-500)] dark:text-slate-400">
                    Recebes um bilhete com QR Code único na tua carteira. O organizador recebe a venda
                    no painel de bilhetes vendidos.
                  </p>
                  <p className="text-center text-[10px] text-[var(--color-neutral-400)]">
                    {fromPrice !== null ? `Bilhetes desde ${fromPrice.toLocaleString('pt-PT')} XOF. ` : ''}
                    Taxas calculadas no pagamento.
                  </p>
                </>
              ) : (
                <div className="space-y-2 rounded-xl border border-dashed border-[var(--color-neutral-300)] dark:border-slate-700 p-3 text-center">
                  <p className="text-[11px] font-semibold text-[var(--color-neutral-600)] dark:text-slate-300">
                    Inicie sessão para comprar bilhetes. Sem conta pode apenas consultar a agenda.
                  </p>
                  <button
                    type="button"
                    onClick={() => onRequireLogin?.('Inicie sessão ou crie uma conta para comprar bilhetes.')}
                    className="w-full rounded-xl bg-[var(--color-green-700)] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[var(--color-green-800)]"
                  >
                    Iniciar sessão
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

function subtotalLabel(total: number, lang: Language) {
  return total > 0 ? money(total, lang) : '—';
}
