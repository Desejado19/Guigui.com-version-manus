import type { PaymentProvider, PaymentProviderAdapter } from '../../../integrations/ports';
import type { TicketForValidation } from '../../../validationService';
import {
  quoteTicketPurchase,
  type TicketFeePolicyPort,
  type TicketOffer,
  type TicketPurchaseQuote,
} from '../domain/ticketPurchaseDomain';
import type {
  TicketCatalogPort,
  TicketInventoryPort,
  TicketPurchaseIdempotencyPort,
  TicketRepositoryPort,
} from './ticketPurchasePorts';
import type { TicketPurchaseDeliveryResult } from '../../../ticketPurchaseDeliveryService';

export interface TicketPurchaseTransaction {
  id: string;
  providerRef: string;
  providerMode: PaymentProviderAdapter['mode'];
  isApiIntegrationReady: boolean;
  amountXOF: number;
  status: 'confirmed_api' | 'pending_provider' | 'failed';
  useCase: 'event_tickets';
  useCaseLabel: string;
  businessId?: string;
  businessName: string;
  payerName: string;
  payerPhone: string;
  ticketBaseAmountXOF: number;
  platformFeeXOF: number;
  provider: PaymentProvider;
  productId: 'product-ticket-fee';
  productCode: 'TICKET_FEE';
  quantity: number;
  checkoutUrl?: string;
  paymentInstructions?: string;
  ticketId?: string;
  ticketIds: string[];
  ticketCode?: string;
  ticketCodes: string[];
  qrToken?: string;
  qrTokens: string[];
  ticketDraft?: {
    eventId: string;
    eventTitle: string;
    ticketTypeId: string;
    ticketTypeName: string;
    unitPriceXOF: number;
    buyerUserId: string;
    eventDate?: string;
    eventTime?: string;
    quantity: number;
  };
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
}

export type TicketPurchaseResult =
  | {
      status: 'confirmed';
      transaction: TicketPurchaseTransaction;
      quote: TicketPurchaseQuote;
      tickets: TicketForValidation[];
      delivery: TicketPurchaseDeliveryResult;
    }
  | {
      status: 'pending';
      transaction: TicketPurchaseTransaction;
      reservationExpiresAt: string;
    }
  | {
      status: 'rejected';
      reason: 'invalid_offer' | 'invalid_policy' | 'inventory_unavailable' | 'payment_failed' | 'invalid_quantity' | 'sales_closed';
      message: string;
      transaction?: TicketPurchaseTransaction;
    };

export interface TicketPurchaseCommand {
  buyer: { userId: string; name: string; phone: string; email?: string };
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  holderName?: string;
  holderPhone?: string;
  paymentMethod: PaymentProvider;
  policyAccepted: boolean;
  policyVersion: string;
  policyAcceptedAt: string;
  idempotencyKey?: string;
}

export interface TicketFactoryInput {
  offer: TicketOffer;
  buyer: TicketPurchaseCommand['buyer'];
  quantity: number;
  holderName?: string;
  holderPhone?: string;
  paymentMethod: PaymentProvider;
  purchasedAt: string;
}

export interface TicketPurchaseUseCasePorts {
  catalog: TicketCatalogPort;
  inventory: TicketInventoryPort;
  tickets: TicketRepositoryPort;
  idempotency: TicketPurchaseIdempotencyPort<TicketPurchaseResult>;
  payments: Record<PaymentProvider, PaymentProviderAdapter>;
  ticketFactory: (input: TicketFactoryInput) => TicketForValidation[];
  transactions: {
    persist(transaction: TicketPurchaseTransaction): Promise<void>;
    recordFulfillment(transaction: TicketPurchaseTransaction): Promise<void>;
  };
  delivery(input: {
    transactionId: string;
    accountUserId: string;
    accountEmail?: string;
    accountName: string;
    eventId: string;
    eventTitle: string;
    totalAmountXOF: number;
    tickets: TicketForValidation[];
  }): Promise<TicketPurchaseDeliveryResult>;
  feePolicy: TicketFeePolicyPort;
  createTransactionId(): string;
  reservationTtlMs: number;
  now(): Date;
}

function rejection(
  reason: Extract<TicketPurchaseResult, { status: 'rejected' }>['reason'],
  message: string,
): TicketPurchaseResult {
  return { status: 'rejected', reason, message };
}

function createTransaction(input: {
  id: string;
  providerRef: string;
  providerMode: PaymentProviderAdapter['mode'];
  status: TicketPurchaseTransaction['status'];
  amountXOF: number;
  offer: TicketOffer;
  buyer: TicketPurchaseCommand['buyer'];
  paymentMethod: PaymentProvider;
  quote: TicketPurchaseQuote;
  quantity: number;
  createdAt: string;
  checkoutUrl?: string;
  paymentInstructions?: string;
}): TicketPurchaseTransaction {
  return {
    id: input.id,
    providerRef: input.providerRef,
    providerMode: input.providerMode,
    isApiIntegrationReady: input.providerMode === 'live',
    amountXOF: input.amountXOF,
    status: input.status,
    useCase: 'event_tickets',
    useCaseLabel: `Bilhete ${input.offer.ticketTypeName} - ${input.offer.eventTitle}`,
    businessId: input.offer.businessId,
    businessName: input.offer.eventTitle,
    payerName: input.buyer.name,
    payerPhone: input.buyer.phone,
    ticketBaseAmountXOF: input.offer.unitPriceXOF * input.quantity,
    platformFeeXOF: input.quote.feeBreakdown.platformRevenue,
    provider: input.paymentMethod,
    productId: 'product-ticket-fee',
    productCode: 'TICKET_FEE',
    quantity: input.quantity,
    checkoutUrl: input.checkoutUrl,
    paymentInstructions: input.paymentInstructions,
    ticketIds: [],
    ticketCodes: [],
    qrTokens: [],
    createdAt: input.createdAt.replace('T', ' ').substring(0, 16),
    ...(input.status === 'confirmed_api'
      ? { confirmedAt: input.createdAt.replace('T', ' ').substring(0, 16), confirmedBy: `${input.paymentMethod} (${input.providerMode})` }
      : {}),
  };
}

async function storeResult(
  key: string | undefined,
  result: TicketPurchaseResult,
  idempotency: TicketPurchaseIdempotencyPort<TicketPurchaseResult>,
): Promise<TicketPurchaseResult> {
  if (key) await idempotency.store(key, result);
  return result;
}

async function runPurchaseStage<T>(stage: string, transactionId: string | undefined, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('ticket-purchase-stage-failed', {
      stage,
      ...(transactionId ? { transactionId } : {}),
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
}

export async function executeTicketPurchase(
  command: TicketPurchaseCommand,
  ports: TicketPurchaseUseCasePorts,
): Promise<TicketPurchaseResult> {
  if (command.idempotencyKey) {
    const existing = await ports.idempotency.get(command.idempotencyKey);
    if (existing) return existing;
  }

  if (!command.policyAccepted || !command.policyVersion.trim() || !Number.isFinite(Date.parse(command.policyAcceptedAt))) {
    return rejection('invalid_policy', 'A aceitação da política de bilhética é obrigatória.');
  }

  const offer = await runPurchaseStage('catalog', undefined, () => ports.catalog.getOffer(command.eventId, command.ticketTypeId));
  if (!offer) return rejection('invalid_offer', 'O evento ou tipo de bilhete já não está disponível.');

  const quoteResult = quoteTicketPurchase({
    offer,
    quantity: command.quantity,
    feePolicy: ports.feePolicy,
  });
  if (quoteResult.valid === false) {
    if (quoteResult.reason === 'invalid_quantity') return rejection('invalid_quantity', 'A quantidade de bilhetes não é válida.');
    if (quoteResult.reason === 'sales_closed') return rejection('sales_closed', 'As vendas deste tipo de bilhete estão encerradas.');
    return rejection('inventory_unavailable', 'Não há bilhetes suficientes disponíveis.');
  }

  const transactionId = ports.createTransactionId();
  const reservedUntil = new Date(ports.now().getTime() + ports.reservationTtlMs).toISOString();
  const reservation = await runPurchaseStage('inventory-reservation', transactionId, () => ports.inventory.reserve({
    offer,
    quantity: command.quantity,
    reservationId: transactionId,
    expiresAt: reservedUntil,
  }));
  if (reservation !== 'reserved') {
    return storeResult(command.idempotencyKey, rejection('inventory_unavailable', 'Não há bilhetes suficientes disponíveis.'), ports.idempotency);
  }

  const paymentAdapter = ports.payments[command.paymentMethod];
  let paymentIntent;
  try {
    paymentIntent = await paymentAdapter.createIntent({
      transactionId,
      amountXOF: quoteResult.quote.buyerTotalXOF,
      payerName: command.buyer.name,
      payerPhone: command.buyer.phone,
      description: `${offer.ticketTypeName} - ${offer.eventTitle} (${command.quantity} unidade${command.quantity === 1 ? '' : 's'})`,
      provider: command.paymentMethod,
      metadata: { eventId: offer.eventId, businessId: offer.businessId || '', ticketQuantity: String(command.quantity) },
    });
  } catch (error) {
    await ports.inventory.release(transactionId);
    console.error('ticket-payment-intent-failed', {
      transactionId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return storeResult(command.idempotencyKey, rejection('payment_failed', 'Não foi possível iniciar o pagamento simulado.'), ports.idempotency);
  }

  const now = ports.now().toISOString();
  const transaction = createTransaction({
    id: transactionId,
    providerRef: paymentIntent.providerRef,
    providerMode: paymentIntent.mode,
    status: paymentIntent.state === 'confirmed' ? 'confirmed_api' : paymentIntent.state === 'pending' ? 'pending_provider' : 'failed',
    amountXOF: quoteResult.quote.buyerTotalXOF,
    offer,
    buyer: command.buyer,
    paymentMethod: command.paymentMethod,
    quote: quoteResult.quote,
    quantity: command.quantity,
    createdAt: now,
    checkoutUrl: paymentIntent.checkoutUrl,
    paymentInstructions: paymentIntent.instructions,
  });

  if (paymentIntent.state === 'failed') {
    await runPurchaseStage('failed-transaction-persist', transactionId, () => ports.transactions.persist(transaction));
    await runPurchaseStage('failed-reservation-release', transactionId, () => ports.inventory.release(transactionId));
    return storeResult(command.idempotencyKey, {
      ...rejection('payment_failed', 'O pagamento simulado não foi aprovado. A reserva de bilhetes foi libertada.'),
      transaction,
    }, ports.idempotency);
  }

  if (paymentIntent.state === 'pending') {
    transaction.ticketDraft = {
      eventId: offer.eventId,
      eventTitle: offer.eventTitle,
      ticketTypeId: offer.ticketTypeId,
      ticketTypeName: offer.ticketTypeName,
      unitPriceXOF: offer.unitPriceXOF,
      buyerUserId: command.buyer.userId,
      eventDate: offer.eventDate,
      eventTime: offer.eventTime,
      quantity: command.quantity,
    };
    await runPurchaseStage('pending-transaction-persist', transactionId, () => ports.transactions.persist(transaction));
    return storeResult(command.idempotencyKey, { status: 'pending', transaction, reservationExpiresAt: reservedUntil }, ports.idempotency);
  }

  await runPurchaseStage('confirmed-transaction-persist', transactionId, () => ports.transactions.persist(transaction));
  await runPurchaseStage('monetization-fulfillment', transactionId, () => ports.transactions.recordFulfillment(transaction));
  let tickets: TicketForValidation[];
  try {
    tickets = ports.ticketFactory({
      offer,
      buyer: command.buyer,
      quantity: command.quantity,
      holderName: command.holderName,
      holderPhone: command.holderPhone,
      paymentMethod: command.paymentMethod,
      purchasedAt: now,
    });
  } catch (error) {
    console.error('ticket-purchase-stage-failed', {
      stage: 'ticket-factory',
      transactionId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
  const issuedTickets = await runPurchaseStage('ticket-issuance', transactionId, () => ports.tickets.issue(transactionId, tickets, command.buyer.userId));
  await runPurchaseStage('inventory-confirmation', transactionId, () => ports.inventory.confirm(transactionId));
  const primaryTicket = issuedTickets[0];
  transaction.ticketId = primaryTicket?.id;
  transaction.ticketIds = issuedTickets.map((ticket) => ticket.id);
  transaction.ticketCode = primaryTicket?.ticketCode;
  transaction.ticketCodes = issuedTickets.map((ticket) => ticket.ticketCode);
  transaction.qrToken = primaryTicket?.qrToken;
  transaction.qrTokens = issuedTickets.map((ticket) => ticket.qrToken);
  await runPurchaseStage('issued-transaction-persist', transactionId, () => ports.transactions.persist(transaction));

  let delivery: TicketPurchaseDeliveryResult;
  try {
    delivery = await ports.delivery({
      transactionId,
      accountUserId: command.buyer.userId,
      accountEmail: command.buyer.email,
      accountName: command.buyer.name,
      eventId: offer.eventId,
      eventTitle: offer.eventTitle,
      totalAmountXOF: quoteResult.quote.buyerTotalXOF,
      tickets: issuedTickets,
    });
  } catch (error) {
    console.error('ticket-purchase-delivery-failed', {
      transactionId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    delivery = {
      email: { state: 'failed' },
      notification: { state: 'failed' },
      sms: { state: 'failed', mode: 'simulated', references: [] },
    };
  }

  const result: TicketPurchaseResult = {
    status: 'confirmed',
    transaction,
    quote: quoteResult.quote,
    tickets: issuedTickets,
    delivery,
  };
  return storeResult(command.idempotencyKey, result, ports.idempotency);
}
