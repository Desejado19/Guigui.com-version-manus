import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import type { PaymentProvider } from './integrations/ports';

export type GuiguiRole = 'citizen' | 'business' | 'scanner' | 'admin';
export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'expired' | 'pending';
export type PaymentMethod = PaymentProvider;

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  issues: ValidationIssue[];
}

export interface UserIdentityInput {
  name?: unknown;
  phone?: unknown;
  role?: unknown;
}

export interface NormalizedIdentity {
  name: string;
  phone: string;
  role: GuiguiRole;
}

export interface PurchaseInput {
  eventId?: unknown;
  ticketTypeId?: unknown;
  quantity?: unknown;
  businessId?: unknown;
  eventTitle?: unknown;
  ticketTypeName?: unknown;
  priceXOF?: unknown;
  buyerName?: unknown;
  buyerPhone?: unknown;
  holderName?: unknown;
  holderPhone?: unknown;
  paymentMethod?: unknown;
  policyAccepted?: unknown;
  policyVersion?: unknown;
  policyAcceptedAt?: unknown;
}

export interface NormalizedPurchase {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  businessId?: string;
  eventTitle: string;
  ticketTypeName: string;
  priceXOF: number;
  buyerName: string;
  buyerPhone: string;
  holderName?: string;
  holderPhone?: string;
  paymentMethod: PaymentMethod;
  policyAccepted: boolean;
  policyVersion: string;
  policyAcceptedAt: string;
}

export interface TicketForValidation {
  id: string;
  ticketTypeId?: string;
  buyerUserId?: string;
  businessId?: string;
  ticketCode: string;
  qrToken: string;
  pinCode?: string;
  eventId?: string;
  eventTitle?: string;
  /** Data do evento no formato AAAA-MM-DD (usada para agrupar em "Meus bilhetes"). */
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  ticketTypeName?: string;
  priceXOF: number;
  buyerName: string;
  buyerPhone: string;
  holderName?: string;
  holderPhone?: string;
  status: TicketStatus;
  purchasedAt?: string;
  validatedAt?: string;
  expiresAt?: string;
  /** Regra 4.7: prazo da reserva temporária enquanto o pagamento não confirma. */
  reservedUntil?: string;
  signature?: string;
  paymentMethod?: PaymentMethod;
  /** Cancelamento operacional — preenchido pelo /api/tickets/cancel. */
  cancelledAt?: string;
  cancelReason?: string;
  cancelledBy?: string;
}

export interface TicketValidationContext {
  production: boolean;
  signingSecret?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  actorRole?: GuiguiRole | 'system';
  actorName?: string;
  /** ID do utilizador autenticado responsável pela ação, quando aplicável. */
  actorId?: string;
  requestId: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ROLE_SET = new Set<GuiguiRole>(['citizen', 'business', 'scanner', 'admin']);
const PAYMENT_SET = new Set<PaymentMethod>(['orange_money', 'telecel']);
const PHONE_PATTERN = /^\+?[0-9][0-9\s()\-]{6,19}$/;
const MAX_TICKET_PRICE_XOF = 100_000_000;

function issue(code: string, message: string, field?: string): ValidationIssue {
  return { code, message, ...(field ? { field } : {}) };
}

function text(value: unknown, field: string, maxLength: number, required = false): ValidationResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, issues: [issue('invalid_type', `${field} deve ser texto.`, field)] };
  }
  const normalized = value.trim();
  if (required && !normalized) {
    return { ok: false, issues: [issue('required', `${field} é obrigatório.`, field)] };
  }
  if (normalized.length > maxLength) {
    return { ok: false, issues: [issue('too_long', `${field} excede o limite permitido.`, field)] };
  }
  return { ok: true, value: normalized, issues: [] };
}

export function normalizePhone(value: unknown): ValidationResult<string> {
  const result = text(value, 'Telemóvel', 24, true);
  if (!result.ok || !result.value) return result;
  const phone = result.value.replace(/\s+/g, ' ');
  if (!PHONE_PATTERN.test(phone)) {
    return { ok: false, issues: [issue('invalid_phone', 'O número de telemóvel não tem um formato válido.', 'buyerPhone')] };
  }
  return { ok: true, value: phone, issues: [] };
}

export function validateUserIdentity(input: UserIdentityInput): ValidationResult<NormalizedIdentity> {
  const name = text(input.name, 'Nome', 120, true);
  const phone = normalizePhone(input.phone);
  const role = input.role;
  const issues = [...name.issues, ...phone.issues];
  if (typeof role !== 'string' || !ROLE_SET.has(role as GuiguiRole)) {
    issues.push(issue('invalid_role', 'A função do utilizador não é válida.', 'role'));
  }
  if (issues.length > 0 || !name.value || !phone.value || typeof role !== 'string') {
    return { ok: false, issues };
  }
  return { ok: true, value: { name: name.value, phone: phone.value, role: role as GuiguiRole }, issues: [] };
}

export function validatePurchaseInput(input: PurchaseInput): ValidationResult<NormalizedPurchase> {
  const eventId = text(input.eventId ?? 'evt-1', 'Identificador do evento', 120, true);
  const ticketTypeId = text(input.ticketTypeId, 'Identificador do tipo de bilhete', 120, true);
  const businessId = input.businessId === undefined ? { ok: true as const, issues: [] as ValidationIssue[] } : text(input.businessId, 'Identificador da empresa', 120, true);
  const eventTitle = text(input.eventTitle ?? 'Evento Cultural Guigui', 'Evento', 200, true);
  const ticketTypeName = text(input.ticketTypeName ?? 'Entrada Geral', 'Categoria do bilhete', 120, true);
  const buyerName = text(input.buyerName, 'Nome do titular', 120, true);
  const buyerPhone = normalizePhone(input.buyerPhone);
  const paymentMethod = input.paymentMethod ?? 'orange_money';
  const hasHolderName = input.holderName !== undefined && input.holderName !== null && String(input.holderName).trim() !== '';
  const hasHolderPhone = input.holderPhone !== undefined && input.holderPhone !== null && String(input.holderPhone).trim() !== '';
  const holderName = hasHolderName ? text(input.holderName, 'Nome do titular', 120, true) : { ok: true as const, issues: [] as ValidationIssue[] };
  const holderPhone = hasHolderPhone ? normalizePhone(input.holderPhone) : { ok: true as const, issues: [] as ValidationIssue[] };
  const issues = [...eventId.issues, ...ticketTypeId.issues, ...businessId.issues, ...eventTitle.issues, ...ticketTypeName.issues, ...buyerName.issues, ...buyerPhone.issues, ...holderName.issues, ...holderPhone.issues];
  if (hasHolderName !== hasHolderPhone) issues.push(issue('holder_pair_required', 'Nome e telemóvel do titular devem ser fornecidos em conjunto.', 'holder'));

  const quantity = typeof input.quantity === 'number' || typeof input.quantity === 'string' ? Number(input.quantity) : NaN;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
    issues.push(issue('invalid_quantity', 'A quantidade deve ser um número inteiro entre 1 e 100.', 'quantity'));
  }

  const amount = typeof input.priceXOF === 'number' || typeof input.priceXOF === 'string' ? Number(input.priceXOF) : NaN;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_TICKET_PRICE_XOF) {
    issues.push(issue('invalid_amount', 'O valor do bilhete deve ser um número inteiro positivo em XOF.', 'priceXOF'));
  }
  if (typeof paymentMethod !== 'string' || !PAYMENT_SET.has(paymentMethod as PaymentMethod)) {
    issues.push(issue('invalid_payment_method', 'O método de pagamento não é suportado.', 'paymentMethod'));
  }

  // Regra 3.4-3.5: aceitação expressa da política de bilhética
  const policyAccepted = typeof input.policyAccepted === 'boolean' ? input.policyAccepted : false;
  const policyVersion = typeof input.policyVersion === 'string' ? input.policyVersion.trim() : '';
  const policyAcceptedAt = typeof input.policyAcceptedAt === 'string' ? input.policyAcceptedAt.trim() : '';

  if (!policyAccepted) {
    issues.push(issue('policy_not_accepted', 'É obrigatório aceitar a política de bilhética antes de pagar.', 'policyAccepted'));
  }
  if (!policyVersion) {
    issues.push(issue('policy_version_missing', 'A versão da política é obrigatória.', 'policyVersion'));
  }
  if (!policyAcceptedAt) {
    issues.push(issue('policy_accepted_at_missing', 'A data/hora de aceitação da política é obrigatória.', 'policyAcceptedAt'));
  }

  if (issues.length > 0 || !eventId.value || !ticketTypeId.value || !eventTitle.value || !ticketTypeName.value || !buyerName.value || !buyerPhone.value || !Number.isSafeInteger(quantity) || !Number.isSafeInteger(amount) || typeof paymentMethod !== 'string') {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      eventId: eventId.value,
      ticketTypeId: ticketTypeId.value,
      quantity,
      ...(businessId.value ? { businessId: businessId.value } : {}),
      eventTitle: eventTitle.value,
      ticketTypeName: ticketTypeName.value,
      priceXOF: amount,
      buyerName: buyerName.value,
      buyerPhone: buyerPhone.value,
      ...(holderName.value && holderPhone.value ? { holderName: holderName.value, holderPhone: holderPhone.value } : {}),
      paymentMethod: paymentMethod as PaymentMethod,
      policyAccepted,
      policyVersion,
      policyAcceptedAt,
    },
    issues: [],
  };
}

function signingPayload(ticket: Pick<TicketForValidation, 'qrToken' | 'ticketCode' | 'buyerPhone' | 'priceXOF'>): string {
  return [ticket.qrToken, ticket.ticketCode, ticket.buyerPhone, ticket.priceXOF].join('|');
}

export function signTicket(ticket: Pick<TicketForValidation, 'qrToken' | 'ticketCode' | 'buyerPhone' | 'priceXOF'>, secret: string): string {
  return createHmac('sha256', secret).update(signingPayload(ticket)).digest('hex');
}

export function hasValidTicketSignature(ticket: TicketForValidation, secret?: string): boolean {
  if (!ticket.signature || !secret) return false;
  const expected = Buffer.from(signTicket(ticket, secret), 'utf8');
  const received = Buffer.from(ticket.signature, 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function validateTicketForEntry(ticket: TicketForValidation, context: TicketValidationContext): ValidationResult<TicketForValidation> {
  const issues: ValidationIssue[] = [];
  if (context.production && !context.signingSecret) {
    issues.push(issue('missing_ticket_secret', 'A validação de bilhetes exige TICKET_SIGNING_SECRET em produção.'));
  }
  if (ticket.signature) {
    if (!hasValidTicketSignature(ticket, context.signingSecret)) {
      issues.push(issue('invalid_signature', 'A assinatura do bilhete não é válida.'));
    }
  } else if (context.production) {
    issues.push(issue('unsigned_ticket', 'O bilhete não possui assinatura de segurança.'));
  }
  if (ticket.expiresAt) {
    const expiresAt = Date.parse(ticket.expiresAt);
    if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
      issues.push(issue('expired_ticket', 'O bilhete expirou ou tem uma data de validade inválida.', 'expiresAt'));
    }
  }
  // Regra 11: um bilhete pendente (reserva sem pagamento confirmado) não autoriza entrada.
  if (ticket.status === 'pending') issues.push(issue('pending_ticket', 'Bilhete pendente de pagamento: a reserva ainda não foi confirmada.', 'status'));
  if (ticket.status === 'expired') issues.push(issue('expired_ticket', 'O bilhete expirou.'));
  if (ticket.status === 'used') issues.push(issue('already_used', 'O bilhete já foi utilizado.'));
  if (ticket.status === 'cancelled') issues.push(issue('cancelled_ticket', 'O bilhete foi cancelado ou reembolsado.'));
  if (ticket.status !== 'valid' && ticket.status !== 'used' && ticket.status !== 'cancelled' && ticket.status !== 'expired' && ticket.status !== 'pending') {
    issues.push(issue('invalid_status', 'O estado do bilhete não é reconhecido.', 'status'));
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: ticket, issues: [] };
}

export function createAuditEntry(input: Omit<AuditEntry, 'id' | 'requestId' | 'createdAt'> & { requestId?: string }): AuditEntry {
  return {
    ...input,
    id: `AUD-${Date.now()}-${randomUUID().slice(0, 8)}`,
    requestId: input.requestId || randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export function firstIssueMessage(issues: ValidationIssue[], fallback: string): string {
  return issues[0]?.message || fallback;
}

export interface PaymentInput {
  payerName?: unknown;
  payerPhone?: unknown;
  amountXOF?: unknown;
  provider?: unknown;
}

export interface NormalizedPayment {
  payerName: string;
  payerPhone: string;
  amountXOF: number;
  provider: PaymentMethod;
}

export function validatePaymentInput(input: PaymentInput): ValidationResult<NormalizedPayment> {
  const payerName = text(input.payerName, 'Nome do pagador', 120, true);
  const payerPhone = normalizePhone(input.payerPhone);
  const amountXOF = typeof input.amountXOF === 'number' || typeof input.amountXOF === 'string' ? Number(input.amountXOF) : NaN;
  const provider = input.provider;
  const issues = [...payerName.issues, ...payerPhone.issues];
  if (!Number.isSafeInteger(amountXOF) || amountXOF <= 0 || amountXOF > MAX_TICKET_PRICE_XOF) {
    issues.push(issue('invalid_amount', 'O valor do pagamento deve ser um número inteiro positivo em XOF.', 'amountXOF'));
  }
  if (typeof provider !== 'string' || !PAYMENT_SET.has(provider as PaymentMethod)) {
    issues.push(issue('invalid_payment_method', 'O operador de pagamento não é suportado.', 'provider'));
  }
  if (issues.length > 0 || !payerName.value || !payerPhone.value || !Number.isSafeInteger(amountXOF) || typeof provider !== 'string') {
    return { ok: false, issues };
  }
  return { ok: true, value: { payerName: payerName.value, payerPhone: payerPhone.value, amountXOF, provider: provider as PaymentMethod }, issues: [] };
}
