import React, { useMemo, useState } from 'react';
import {
  MapPin,
  Calendar,
  ChevronDown,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import type { EventItem, EventTicketType, Language, UserProfile } from '../types';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees, normaliseMonetizationCatalog } from '../data/monetizationCatalog';
const POLICY_VERSION = '1.0';
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,23}$/;
interface TicketPurchaseModalProps {
  isOpen: boolean;
  event?: EventItem | null;
  ticketTypes?: EventTicketType[];
  currentUser?: UserProfile | null;
  currentLang?: Language;
  monetizationCatalog?: Parameters<typeof normaliseMonetizationCatalog>[0];
  isSubmitting?: boolean;
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
  onClose,
  onConfirm,
}) => {
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
        className="ticket-purchase-modal ticket-surface relative w-full max-w-lg mx-2 transform rounded-[var(--radius-2xl)] bg-white shadow-[var(--shadow-lg)] flex flex-col animate-in fade-in zoom-in duration-300 max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        {/* Header - Dark Green */}
        <div className="ticket-purchase-header relative overflow-hidden rounded-t-[var(--radius-2xl)] bg-gradient-to-b from-[var(--color-bg-surface)] to-[var(--color-green-950)] px-4 py-3 text-white">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full border border-[var(--color-green-700)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] flex items-center justify-center hover:border-[var(--color-green-500)] hover:bg-[var(--color-green-950)] hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-green-500)]" />
            <span className="text-[10px] font-semibold text-[var(--color-green-500)] uppercase tracking-wider">
              Compra de Bilhete
            </span>
          </div>

          <h1 className="text-xl font-bold leading-tight mb-1">
            {event?.title || 'Compra de bilhete'}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            {event?.organizerName || 'Organizador do evento'}
          </p>

          {/* Info row */}
          <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[var(--color-green-500)]" />
              <span>{event ? `${event.location}${event.neighborhood ? `, ${event.neighborhood}` : ''}` : 'Bissau'}</span>
            </div>
            <div className="w-px h-3 bg-[var(--color-green-900)] mx-1" />
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[var(--color-green-500)]" />
              <span>{event ? `${event.date}, ${event.time}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Steps Content */}
        <div className="p-4 space-y-4 bg-white">
          {/* Step 1: Categoria */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-green-500)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--color-green-500)] border border-[var(--color-green-500)]/30">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-strong)]">Categoria</h3>
              <div className="ticket-category-list mt-2 space-y-2">
                {categories.length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">Este evento ainda não tem categorias de bilhete disponíveis.</p>
                )}
                {categories.map((type) => {
                  const available = Math.max(0, type.availableQuantity - type.soldQuantity);
                  const isSelected = selectedTicketType?.id === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setSelectedTicketTypeId(type.id);
                        setQuantity(1);
                        setValidationError(null);
                      }}
                      disabled={available <= 0}
                      aria-pressed={isSelected}
                      className={`ticket-category-option w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors ${isSelected ? 'border-[var(--color-green-500)] bg-[var(--color-green-500)]/10' : 'border-[var(--color-green-900)] bg-[var(--color-bg-surface)]/5 hover:border-[var(--color-green-500)] hover:bg-[var(--color-green-950)]/30'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-text-default)]">{type.name}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {available > 0 ? `Disponíveis: ${available} bilhete${available === 1 ? '' : 's'}` : 'Esgotado'}
                        </span>
                      </div>
                      <span className="text-base font-bold text-[var(--color-green-500)]">{type.priceXOF.toLocaleString('pt-PT')} XOF</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2: Quantidade */}
          <div className="flex items-start gap-3 pt-2 border-t border-[var(--color-green-900)]/20">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-green-500)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--color-green-500)] border border-[var(--color-green-500)]/30 mt-0.5">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-strong)]">Quantidade</h3>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">Número de bilhetes</span>
                <div className="flex items-center gap-1 rounded-xl border border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-green-500)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold text-[var(--color-text-strong)]">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    disabled={quantity >= maxQuantity}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-green-500)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Dados do comprador */}
          <div className="flex items-start gap-3 pt-2 border-t border-[var(--color-green-900)]/20">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-green-500)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--color-green-500)] border border-[var(--color-green-500)]/30 mt-0.5">
              3
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-strong)]">Dados do comprador</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="ticket-buyer-fields">
                  <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Nome completo</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
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
                  className={`flex flex-col items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                    paymentMethod === 'orange'
                      ? 'border-[var(--color-gold-500)] bg-[var(--color-gold-900)]/50 text-[var(--color-gold-500)]'
                      : 'border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-green-500)]'
                  }`}
                >
                  <span className="text-[10px]">📱</span>
                  <span className="text-[10px] font-medium">Orange Money Bissau</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('telecel')}
                  className={`flex flex-col items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                    paymentMethod === 'telecel'
                      ? 'border-[var(--color-blue-400)] bg-[var(--color-blue-900)]/50 text-[var(--color-blue-400)]'
                      : 'border-[var(--color-green-900)]/30 bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-green-500)]'
                  }`}
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
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
              <span>
                {feeBreakdown.buyerShare > 0
                  ? 'Taxas da plataforma (pagas pelo comprador)'
                  : 'Taxas da plataforma (retidas da empresa)'}
              </span>
              <span>{feeBreakdown.platformRevenue.toLocaleString('pt-PT')} XOF</span>
            </div>
            <div className="ticket-receipt-line mb-3">
              <div className="flex justify-between text-sm font-bold text-[var(--color-text-strong)]">
                <span>Total a pagar</span>
                <span className="text-[var(--color-green-500)]">{total.toLocaleString('pt-PT')} XOF</span>
              </div>
            </div>
          </div>

          {/* Política de bilhética - Regra 3.4 e 6.4 */}
          <div className="mb-4 p-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
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
                className="h-4 w-4 mt-0.5 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-green-600)] focus:ring-2 focus:ring-[var(--color-green-600)]"
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
