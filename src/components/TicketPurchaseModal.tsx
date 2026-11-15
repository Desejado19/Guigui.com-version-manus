import React, { useMemo, useState , useEffect } from 'react';
import {
  MapPin,
  Calendar,
  ChevronDown,
  ShieldCheck,
  X,
  Clock,
} from 'lucide-react';
import { Button } from './ui/Button';
import type { EventItem, EventTicketType, Language, UserProfile } from '../types';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees, normaliseMonetizationCatalog } from '../data/monetizationCatalog';
const POLICY_VERSION = '1.0';
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,23}$/;

// A data mostrada na compra estava fixa no codigo ("sexta, 20/11, 22:00"),
// o que exibia uma data errada para todos os eventos. Passa a ser derivada
// do evento (formato ISO `YYYY-MM-DD` + intervalo de horas).
function formatEventSchedule(event?: EventItem | null): string | null {
  const raw = typeof event?.date === 'string' ? event.date : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw ? raw : null;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const weekday = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', timeZone: 'UTC' }).format(parsed);
  const time = typeof event?.time === 'string' && event.time.trim() ? `, ${event.time.trim()}` : '';
  return `${weekday}, ${day}/${month}${time}`;
}
interface TicketPurchaseModalProps {
  isOpen: boolean;
  event?: EventItem | null;
  ticketTypes?: EventTicketType[];
  currentUser?: UserProfile | null;
  currentLang?: Language;
  monetizationCatalog?: Parameters<typeof normaliseMonetizationCatalog>[0];
  isSubmitting?: boolean;
  /** Categoria e quantidade ja escolhidas no detalhe do evento. */
  initialTicketTypeId?: string | null;
  initialQuantity?: number;
  onClose: () => void;
  onConfirm: (data: {
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
  }) => void;
}

export const TicketPurchaseModal: React.FC<TicketPurchaseModalProps> = ({
  isOpen,
  event,
  ticketTypes = [],
  currentUser,
  currentLang = 'pt',
  monetizationCatalog,
  isSubmitting = false,
  initialTicketTypeId = null,
  initialQuantity = 1,
  onClose,
  onConfirm,
}) => {
  const isLoggedIn = Boolean(currentUser);
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState(currentUser?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(currentUser?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState<'orange' | 'telecel'>('orange');
  const [isTitleHolderOther, setIsTitleHolderOther] = useState(false);
  const [holderName, setHolderName] = useState('');
  const [holderPhone, setHolderPhone] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const categories = ticketTypes.length > 0 ? ticketTypes : event?.ticketTypes || [];
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(categories[0]?.id || null);
  // A categoria/quantidade podem vir do detalhe do evento; reaplica a cada abertura.
  useEffect(() => {
    if (!isOpen) return;
    if (initialTicketTypeId) setSelectedTicketTypeId(initialTicketTypeId);
    if (initialQuantity && initialQuantity > 0) setQuantity(initialQuantity);
  }, [isOpen, initialTicketTypeId, initialQuantity]);
  const selectedTicketType = categories.find((type) => type.id === selectedTicketTypeId) || categories[0] || null;
  const category = selectedTicketType?.name || 'Entrada Geral';
  const categoryPrice = selectedTicketType?.priceXOF || 0;
  const feeBreakdown = useMemo(() => calculateTicketFees(
    normaliseMonetizationCatalog(monetizationCatalog, undefined) || DEFAULT_MONETIZATION_CATALOG,
    categoryPrice,
    quantity,
  ), [monetizationCatalog, categoryPrice, quantity]);
  // O comprador só paga a taxa quando a política de bilhética a atribui ao cliente.
  const total = feeBreakdown.buyerTotal;
  const soldOut = Boolean(selectedTicketType && selectedTicketType.availableQuantity - selectedTicketType.soldQuantity <= 0);
  const maxQuantity = selectedTicketType
    ? Math.max(1, Math.min(10, selectedTicketType.availableQuantity - selectedTicketType.soldQuantity))
    : 10;
  const errorMessage = (key: string) => {
    const messages: Record<Language, Record<string, string>> = {
      pt: {
        category: 'Selecione uma categoria de bilhete.',
        name: 'Indique o nome do comprador.',
        phone: 'Indique um número de telefone válido.',
        holder: 'Indique o nome e o telefone do titular do bilhete.',
        soldOut: 'Esta categoria de bilhete está esgotada.',
        policy: 'Aceite a política de bilhética para continuar.',
      },
      en: {
        category: 'Select a ticket category.',
        name: 'Enter the buyer name.',
        phone: 'Enter a valid phone number.',
        holder: 'Enter the ticket holder name and phone.',
        soldOut: 'This ticket category is sold out.',
        policy: 'Accept the ticketing policy to continue.',
      },
      fr: {
        category: 'Sélectionnez une catégorie de billet.',
        name: 'Indiquez le nom de l’acheteur.',
        phone: 'Indiquez un numéro de téléphone valide.',
        holder: 'Indiquez le nom et le téléphone du titulaire.',
        soldOut: 'Cette catégorie de billet est épuisée.',
        policy: 'Acceptez la politique de billetterie pour continuer.',
      },
      es: {
        category: 'Seleccione una categoría de billete.',
        name: 'Indique el nombre del comprador.',
        phone: 'Indique un número de teléfono válido.',
        holder: 'Indique el nombre y el teléfono del titular.',
        soldOut: 'Esta categoría de billete está agotada.',
        policy: 'Acepte la política de billetes para continuar.',
      },
    };
    return messages[currentLang]?.[key] || messages.pt[key] || key;
  };
  if (!isOpen) return null;
  const handleOpenLoginIfNeeded = () => {
    onClose();
  };
  const handleSubmit = () => {
    if (!selectedTicketType) return setValidationError(errorMessage('category'));
    if (soldOut) return setValidationError(errorMessage('soldOut'));
    if (!buyerName.trim()) return setValidationError(errorMessage('name'));
    if (!PHONE_PATTERN.test(buyerPhone.trim())) return setValidationError(errorMessage('phone'));
    if (isTitleHolderOther && (!holderName.trim() || !PHONE_PATTERN.test(holderPhone.trim()))) {
      return setValidationError(errorMessage('holder'));
    }
    if (!policyAccepted) return setValidationError(errorMessage('policy'));
    setValidationError(null);
    onConfirm({
      category,
      quantity,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      paymentMethod,
      policyAccepted,
      policyVersion: POLICY_VERSION,
      policyAcceptedAt: new Date().toISOString(),
      ticketTypeId: selectedTicketType.id,
      categoryPriceXOF: selectedTicketType.priceXOF,
      chargedAmountXOF: total,
      ...(isTitleHolderOther ? { holderName: holderName.trim(), holderPhone: holderPhone.trim() } : {}),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto px-2 py-4 lg:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Compra de bilhete"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="ticket-purchase-modal ticket-surface relative w-full max-w-2xl mx-2 transform rounded-[var(--radius-2xl)] bg-white dark:bg-slate-900 shadow-[var(--shadow-lg)] flex flex-col animate-in fade-in zoom-in duration-300 max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        {/* Banner do evento (foto + metadata escura) */}
        <div className="ticket-purchase-header relative overflow-hidden rounded-t-[var(--radius-2xl)] bg-[var(--color-green-950)]">
          <img
            src={event?.coverImage || 'https://placehold.co/1200x400/0a1f16/ffffff?text=Sem+cobrir'}
            alt={event?.title || 'Banner do evento'}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Fechar */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full border border-white/20 bg-black/40 text-white flex items-center justify-center hover:bg-black/60 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge */}
          <div className="absolute top-4 left-4">
            <div className="inline-flex items-center rounded-full bg-[var(--color-green-900)] px-3 py-1 text-white text-[10px] font-bold uppercase tracking-wider">
              FESTAS
            </div>
          </div>

          <div className="relative z-10 px-5 py-5 text-center">
            <h1 className="text-2xl font-extrabold text-white leading-tight">
              {event?.title || 'Compra de bilhete'}
            </h1>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-white/90">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-brand-accent)]" />
                {formatEventSchedule(event) ?? 'Data a confirmar'}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--color-brand-accent)]" />
                {event?.location ? `${event.location}, ${event.neighborhood ?? 'Todos'}` : 'Local a confirmar'}
              </span>
            </div>
          </div>
        </div>

        {/* Conteúdo: bilhetes + compra */}
        <div className="p-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Coluna esquerda: dados do evento */}
            <div className="lg:col-span-3 space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Sobre o evento</h2>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {event?.description || 'Descrição a confirmar com o organizador.'}
              </p>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-800 text-white flex items-center justify-center text-sm font-extrabold">
                    {event?.organizerName && String(event.organizerName).toUpperCase().slice(0, 2) || 'OE'}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Organizado por</p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">{event?.organizerName || 'Organizador a confirmar'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">Localização</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{event?.location} ({event?.neighborhood || 'Todos'})</p>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event?.location || 'Espaço Manogai, Bissau')}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="inline-block mt-2 text-xs font-bold text-[var(--color-brand-accent)] hover:text-[var(--color-accent-hover)]">
                  Ver no Google Maps
                </a>
              </div>
            </div>

            {/* Coluna direita: bilhetes */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Bilhetes</h2>
                  <p className="text-[10px] font-semibold text-green-700 mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Compra segura
                  </p>
                </div>
              </div>

              {/* Tipo de bilhete seleccionado */}
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{category}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Acesso à festa</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedTicketType ? Math.max(0, selectedTicketType.availableQuantity - selectedTicketType.soldQuantity) : 0} disponíveis
                </p>
              </div>

              {/* Seletor de quantidade */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Quantidade</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Diminuir quantidade"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-extrabold text-slate-900 dark:text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    disabled={quantity >= maxQuantity}
                    className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">—</span>
              </div>

              <Button
                type="button"
                variant="primary"
                className="w-full mt-3 rounded-xl bg-[var(--color-brand-accent-soft)] text-black font-extrabold hover:bg-[var(--color-brand-accent)]"
                onClick={handleOpenLoginIfNeeded}
                disabled={false}
              >
                Entrar para comprar
              </Button>

              <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-400">Recebes um bilhete com QR Code único na tua carteira.</p>
            </div>
          </div>

          {/* Formulário de compra completo (compra efetiva, sessão pré-autenticada) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Dados do comprador</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">Preenche os dados para confirmar a compra.</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="ticket-buyer-fields">
                <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Nome completo</label>
                <input
                  type="text"
                  value={buyerName}onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] px-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-green-500)]"
                placeholder="Nome completo"
              />
            </div>

            <div className="ticket-buyer-fields">
              <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Número de telefone</label>
              <input
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] px-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-green-500)]"
                placeholder="Número de telefone"
              />
            </div>
          </div>
          <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setIsTitleHolderOther((previous) => !previous)}
                  aria-expanded={isTitleHolderOther}
                  className="ticket-buyer-fields w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] cursor-pointer"
              >
                <span className="text-xs text-[var(--color-text-muted)]">Titular do bilhete é outra pessoa</span>
                <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isTitleHolderOther ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {isTitleHolderOther && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="ticket-buyer-fields">
                  <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Nome do titular</label>
                  <input
                    type="text"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] px-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-green-500)]"
                    placeholder="Nome do titular"
                  />
                </div>
                <div className="ticket-buyer-fields">
                  <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Telefone do titular</label>
                  <input
                    type="tel"
                    value={holderPhone}
                    onChange={(e) => setHolderPhone(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] px-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-green-500)]"
                    placeholder="Telefone do titular"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 4: Método de pagamento */}
          <div className="flex items-start gap-3 pt-2 border-t border-[var(--color-green-900)]/20">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-green-500)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--color-green-500)] border border-[var(--color-green-500)]/30 mt-0.5">
              4
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-strong)]">Método de pagamento</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('orange')}
                  className={`flex flex-col items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${ paymentMethod === 'orange' ? 'border-[var(--color-gold-500)] bg-[var(--color-gold-900)]/50 text-[var(--color-gold-500)]' : 'border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-green-500)]' }`}
                >
                  <span className="text-[10px]">📱</span>
                  <span className="text-[10px] font-medium">Orange Money Bissau</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('telecel')}
                  className={`flex flex-col items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${ paymentMethod === 'telecel' ? 'border-[var(--color-blue-400)] bg-[var(--color-blue-900)]/50 text-[var(--color-blue-400)]' : 'border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-green-500)]' }`}
                >
                  <span className="text-[10px]">📱</span>
                  <span className="text-[10px] font-medium">Telecel Bissau</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Summary & Confirm */}
        <div className="p-4 border-t border-[var(--color-green-900)]/20 bg-[var(--color-bg-subtle)]">
          <div className="ticket-payment-summary mb-4">
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
              <span>{quantity} x {category} ({categoryPrice.toLocaleString('pt-PT')} XOF)</span>
              <span>{feeBreakdown.grossTicketValue.toLocaleString('pt-PT')} XOF</span>
            </div>
            <div className="ticket-receipt-line mb-3">
              <div className="flex justify-between text-sm font-bold text-[var(--color-text-strong)]">
                <span>Total a pagar</span>
                <span className="text-[var(--color-green-500)]">{total.toLocaleString('pt-PT')} XOF</span>
              </div>
            </div>
          </div>

          {/* Política de bilhética - Regra 3.4 e 6.4 */}
          <div className="mb-4 p-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Política de Compra de Bilhetes (v{POLICY_VERSION})
            </p>
            <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)] mb-3">
              Ao comprar, confirma que leu e aceita a política de bilhética da Guigui.com.
              A compra é definitiva após confirmação do pagamento. Não há cancelamento
              voluntário nem reembolso por motivos pessoais (Regra 6). Exceções apenas
              por erro de pagamento ou cancelamento de evento pelo organizador.
            </p>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={policyAccepted}
                onChange={(e) => setPolicyAccepted(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 text-[var(--color-green-600)] focus:ring-2 focus:ring-[var(--color-green-600)]"
                required
              />
              <label className="text-[10px] leading-relaxed text-[var(--color-text-strong)] cursor-pointer">
                Li e aceito a política de bilhética da Guigui.com (versão {POLICY_VERSION})
              </label>
            </div>
          </div>

          {validationError && (
            <p role="alert" className="mb-3 rounded-xl border border-[var(--color-red-500)]/40 bg-[var(--color-red-500)]/10 px-3 py-2 text-[11px] font-semibold text-[var(--color-red-500)]">
              {validationError}
            </p>
          )}
          <Button
            variant="primary"
            size="md"
            className="w-full min-h-[44px] rounded-xl bg-[var(--color-green-500)] text-white font-bold hover:bg-[var(--color-green-700)] transition-colors flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={!policyAccepted || !selectedTicketType || soldOut || isSubmitting}
            aria-busy={isSubmitting}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'A processar...' : `Confirmar e Pagar ${total.toLocaleString('pt-PT')} XOF`}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

TicketPurchaseModal.displayName = 'TicketPurchaseModal';
