import type { Request, RequestHandler } from 'express';
import type { PublicUser } from '../../../../authService';
import type { SessionContext } from '../../../identity-access/application/resolveSessionContext';
import { firstIssueMessage } from '../../../../validationService';
import type {
  AuditEntry,
  NormalizedPurchase,
  PurchaseInput,
  ValidationResult,
} from '../../../../validationService';
import type { TicketPurchaseCommand, TicketPurchaseResult } from '../../application/purchaseTicket';
import type { TicketCatalogPort } from '../../application/ticketPurchasePorts';
import { quoteTicketPurchase, type TicketFeePolicyPort } from '../../domain/ticketPurchaseDomain';

export interface TicketPurchaseHandlerDependencies {
  validatePurchaseInput(input: PurchaseInput): ValidationResult<NormalizedPurchase>;
  resolveSession(request: Request): Promise<SessionContext | null>;
  findAccount(userId: string): Promise<PublicUser | null>;
  isProduction: boolean;
  ticketSigningSecretConfigured: boolean;
  catalog: TicketCatalogPort;
  feePolicy: TicketFeePolicyPort;
  idempotency: {
    cleanup(): void;
    get(key: string): Promise<TicketPurchaseResult | null>;
    acquire(key: string): Promise<() => void>;
  };
  executePurchase(command: TicketPurchaseCommand): Promise<TicketPurchaseResult>;
  requestIdFrom(request: Request): string;
  recordAudit(event: Omit<AuditEntry, 'id' | 'requestId' | 'createdAt'> & { requestId?: string }): void;
}

function mapTicketPurchaseHttpResponse(
  result: TicketPurchaseResult,
  requestId: string,
): { status: number; body: Record<string, unknown> } {
  if (result.status === 'confirmed') {
    return {
      status: 200,
      body: {
        success: true,
        ticket: result.tickets[0],
        tickets: result.tickets,
        feeBreakdown: result.quote.feeBreakdown,
        quote: result.quote,
        transaction: result.transaction,
        sms: { mode: result.delivery.sms.mode, state: result.delivery.sms.state },
        delivery: {
          email: result.delivery.email,
          notification: result.delivery.notification,
          sms: { state: result.delivery.sms.state, mode: result.delivery.sms.mode },
        },
      },
    };
  }
  if (result.status === 'pending') {
    return {
      status: 202,
      body: {
        success: false,
        paymentPending: true,
        transaction: result.transaction,
        reservationExpiresAt: result.reservationExpiresAt,
        message: result.transaction.paymentInstructions || 'Pagamento pendente. Os bilhetes ficam reservados até à confirmação da operadora.',
        requestId,
      },
    };
  }

  const rejectionStatus: Record<typeof result.reason, number> = {
    invalid_offer: 404,
    invalid_policy: 400,
    invalid_quantity: 400,
    sales_closed: 400,
    inventory_unavailable: 409,
    payment_failed: 502,
  };
  const rejectionCode: Record<typeof result.reason, string> = {
    invalid_offer: 'TICKET_OFFER_NOT_FOUND',
    invalid_policy: 'VALIDATION_ERROR',
    invalid_quantity: 'INVALID_TICKET_QUANTITY',
    sales_closed: 'TICKET_INVENTORY_UNAVAILABLE',
    inventory_unavailable: 'TICKET_INVENTORY_UNAVAILABLE',
    payment_failed: 'TICKET_PAYMENT_FAILED',
  };
  return {
    status: rejectionStatus[result.reason],
    body: {
      success: false,
      error: result.message,
      code: rejectionCode[result.reason],
      ...(result.transaction ? { transaction: result.transaction } : {}),
      requestId,
    },
  };
}

export function createTicketPurchaseHandler(
  dependencies: TicketPurchaseHandlerDependencies,
): RequestHandler {
  return async (req, res) => {
    let idempotencyKey: string | undefined;
    let releaseIdempotencyLock: (() => void) | undefined;
    let purchaseStage = 'request-validation';
    const requestId = dependencies.requestIdFrom(req);
    try {
      const validation = dependencies.validatePurchaseInput({
        ...req.body,
        buyerName: 'Utilizador autenticado',
        buyerPhone: '+24500000000',
        priceXOF: req.body?.priceXOF ?? 5000,
      });
      if (!validation.ok) {
        dependencies.recordAudit({
          action: 'purchase_validation_failed',
          resource: 'purchase',
          actorRole: 'citizen',
          requestId,
          success: false,
          metadata: { issues: validation.issues },
        });
        return res.status(400).json({
          error: firstIssueMessage(validation.issues, 'Dados de compra inválidos.'),
          code: 'VALIDATION_ERROR',
          issues: validation.issues,
          requestId,
        });
      }

      purchaseStage = 'session-lookup';
      const purchaseSession = await dependencies.resolveSession(req);
      if (!purchaseSession || purchaseSession.role !== 'user') {
        return res.status(401).json({ error: 'Inicie sessão para comprar bilhetes.', code: 'AUTHENTICATION_REQUIRED', requestId });
      }
      purchaseStage = 'account-lookup';
      const account = await dependencies.findAccount(purchaseSession.userId);
      if (!account) {
        return res.status(401).json({ error: 'A conta da sessão não está disponível.', code: 'AUTHENTICATION_REQUIRED', requestId });
      }
      purchaseStage = 'buyer-validation';
      const buyerValidation = dependencies.validatePurchaseInput({
        ...req.body,
        buyerName: account.name,
        buyerPhone: account.phone,
        priceXOF: req.body?.priceXOF ?? 5000,
      });
      if (!buyerValidation.ok) {
        return res.status(400).json({
          error: firstIssueMessage(buyerValidation.issues, 'Os dados da conta não permitem concluir a compra.'),
          code: 'VALIDATION_ERROR',
          issues: buyerValidation.issues,
          requestId,
        });
      }

      if (dependencies.isProduction && !dependencies.ticketSigningSecretConfigured) {
        return res.status(503).json({
          error: 'Emissão temporariamente indisponível: TICKET_SIGNING_SECRET não configurado.',
          code: 'TICKET_SECURITY_NOT_CONFIGURED',
          requestId,
        });
      }

      purchaseStage = 'idempotency-lock';
      dependencies.idempotency.cleanup();
      const requestIdempotencyKey = req.header('idempotency-key')?.trim();
      if (requestIdempotencyKey) {
        if (requestIdempotencyKey.length > 160) {
          return res.status(400).json({ error: 'Chave de idempotência inválida.', code: 'INVALID_IDEMPOTENCY_KEY', requestId });
        }
        idempotencyKey = `${purchaseSession.userId}:${requestIdempotencyKey}`;
        releaseIdempotencyLock = await dependencies.idempotency.acquire(idempotencyKey);

        const cached = await dependencies.idempotency.get(idempotencyKey);
        if (cached) {
          const replay = mapTicketPurchaseHttpResponse(cached, requestId);
          return res.status(replay.status).json(replay.body);
        }
      }

      const input = buyerValidation.value!;
      purchaseStage = 'offer-query';
      const offer = await dependencies.catalog.getOffer(input.eventId, input.ticketTypeId);
      if (!offer) {
        return res.status(404).json({ error: 'O evento ou tipo de bilhete já não está disponível.', code: 'TICKET_OFFER_NOT_FOUND', requestId });
      }
      purchaseStage = 'quote-validation';
      const quoteResult = quoteTicketPurchase({
        offer,
        quantity: input.quantity,
        feePolicy: dependencies.feePolicy,
      });
      if (quoteResult.valid === false) {
        const unavailable = quoteResult.reason === 'sold_out'
          || quoteResult.reason === 'insufficient_inventory';
        return res.status(unavailable ? 409 : 400).json({
          error: quoteResult.reason === 'sales_closed'
            ? 'As vendas deste tipo de bilhete estão encerradas.'
            : quoteResult.reason === 'invalid_quantity'
              ? 'A quantidade de bilhetes não é válida.'
              : 'Não há bilhetes suficientes disponíveis.',
          code: quoteResult.reason === 'invalid_quantity' ? 'INVALID_TICKET_QUANTITY' : 'TICKET_INVENTORY_UNAVAILABLE',
          requestId,
        });
      }
      if (req.body?.ticketTypeName !== undefined && req.body.ticketTypeName !== offer.ticketTypeName) {
        return res.status(409).json({ error: 'A categoria selecionada foi alterada. Actualize o checkout.', code: 'TICKET_TYPE_MISMATCH', requestId });
      }
      const submittedPrice = req.body?.pricePerTicketXOF ?? req.body?.priceXOF;
      if (submittedPrice !== undefined
        && (!Number.isSafeInteger(Number(submittedPrice)) || Number(submittedPrice) !== offer.unitPriceXOF)) {
        return res.status(409).json({ error: 'O preço do bilhete foi alterado. Actualize o checkout.', code: 'TICKET_PRICE_MISMATCH', requestId });
      }
      const chargedAmountXOF = quoteResult.quote.buyerTotalXOF;
      if (req.body?.chargedAmountXOF !== undefined && Number(req.body.chargedAmountXOF) !== chargedAmountXOF) {
        return res.status(409).json({ error: 'O total do checkout não corresponde à política de taxas actual.', code: 'TICKET_TOTAL_MISMATCH', expectedAmountXOF: chargedAmountXOF, requestId });
      }

      purchaseStage = 'application-use-case';
      const result = await dependencies.executePurchase({
        buyer: {
          userId: purchaseSession.userId,
          name: account.name,
          phone: account.phone,
          email: account.email,
        },
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        quantity: input.quantity,
        holderName: input.holderName,
        holderPhone: input.holderPhone,
        paymentMethod: input.paymentMethod,
        policyAccepted: input.policyAccepted,
        policyVersion: input.policyVersion,
        policyAcceptedAt: input.policyAcceptedAt,
        idempotencyKey,
      });

      if (result.status === 'pending') {
        dependencies.recordAudit({
          action: 'ticket_payment_pending',
          resource: 'payment',
          resourceId: result.transaction.id,
          actorRole: 'citizen',
          requestId,
          success: true,
          metadata: {
            provider: result.transaction.provider,
            providerRef: result.transaction.providerRef,
            reservedUntil: result.reservationExpiresAt,
          },
        });
      } else if (result.status === 'confirmed') {
        dependencies.recordAudit({
          action: 'ticket_sms_dispatch',
          resource: 'ticket',
          resourceId: result.transaction.id,
          actorRole: 'system',
          requestId,
          success: result.delivery.sms.state !== 'failed',
          metadata: {
            mode: result.delivery.sms.mode,
            state: result.delivery.sms.state,
            referenceCount: result.delivery.sms.references.length,
            emailState: result.delivery.email.state,
            notificationState: result.delivery.notification.state,
          },
        });
        dependencies.recordAudit({
          action: 'ticket_issued',
          resource: 'ticket',
          resourceId: result.transaction.id,
          actorRole: 'citizen',
          requestId,
          success: true,
          metadata: {
            eventId: result.tickets[0]?.eventId,
            paymentMethod: result.tickets[0]?.paymentMethod,
            amountXOF: chargedAmountXOF,
            ticketIds: result.tickets.map((issuedTicket) => issuedTicket.id),
          },
        });
      }

      const response = mapTicketPurchaseHttpResponse(result, requestId);
      return res.status(response.status).json(response.body);
    } catch (error) {
      console.error('ticket-purchase-failed', {
        requestId,
        stage: purchaseStage,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return res.status(500).json({ error: 'Não foi possível concluir a compra do bilhete.', code: 'TICKET_PURCHASE_FAILED', requestId });
    } finally {
      releaseIdempotencyLock?.();
    }
  };
}
