import express, { type Express } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateTicketFees, DEFAULT_MONETIZATION_CATALOG } from '../../src/data/monetizationCatalog';
import type { PublicUser } from '../../server/authService';
import type { TicketPurchaseResult, TicketPurchaseTransaction } from '../../server/modules/ticketing/application/purchaseTicket';
import { createTicketPurchaseHandler, type TicketPurchaseHandlerDependencies } from '../../server/modules/ticketing/adapters/http/ticketPurchaseHandler';
import type { TicketForValidation } from '../../server/validationService';
import { validatePurchaseInput } from '../../server/validationService';

const account: PublicUser = {
  id: 'user-1',
  name: 'Buyer',
  email: 'buyer@example.test',
  role: 'user',
  phone: '+245955000001',
  neighborhood: 'Bissau',
  avatarUrl: '',
};

const offer = {
  eventId: 'event-1',
  businessId: 'business-1',
  eventTitle: 'Festival',
  ticketTypeId: 'vip-1',
  ticketTypeName: 'VIP',
  unitPriceXOF: 10000,
  availableQuantity: 10,
  soldQuantity: 1,
  salesOpen: true,
};

const ticket: TicketForValidation = {
  id: 'ticket-1',
  ticketCode: 'GUI-1',
  qrToken: 'QR-1',
  priceXOF: 10000,
  buyerName: 'Buyer',
  buyerPhone: '+245955000001',
  status: 'valid',
};

const transaction: TicketPurchaseTransaction = {
  id: 'txn-1',
  providerRef: 'provider-1',
  providerMode: 'simulated',
  isApiIntegrationReady: false,
  amountXOF: 10000,
  status: 'confirmed_api',
  useCase: 'event_tickets',
  useCaseLabel: 'Bilhete VIP - Festival',
  businessName: 'Festival',
  payerName: 'Buyer',
  payerPhone: '+245955000001',
  ticketBaseAmountXOF: 10000,
  platformFeeXOF: 0,
  provider: 'orange_money',
  productId: 'product-ticket-fee',
  productCode: 'TICKET_FEE',
  quantity: 1,
  ticketId: 'ticket-1',
  ticketIds: ['ticket-1'],
  ticketCode: 'GUI-1',
  ticketCodes: ['GUI-1'],
  qrToken: 'QR-1',
  qrTokens: ['QR-1'],
  createdAt: '2026-10-22 03:00',
};

const feeBreakdown = calculateTicketFees(DEFAULT_MONETIZATION_CATALOG, 10000, 1);
const confirmedResult: TicketPurchaseResult = {
  status: 'confirmed',
  transaction,
  quote: { unitPriceXOF: 10000, quantity: 1, feeBreakdown, buyerTotalXOF: 10000 },
  tickets: [ticket],
  delivery: {
    email: { state: 'simulated', reference: 'email-1' },
    notification: { state: 'created' },
    sms: { state: 'simulated', mode: 'simulated', references: ['sms-1'] },
  },
};

const pendingResult: TicketPurchaseResult = {
  status: 'pending',
  transaction: { ...transaction, status: 'pending_provider' },
  reservationExpiresAt: '2026-10-22T03:15:00.000Z',
};

const validBody = {
  eventId: 'event-1',
  ticketTypeId: 'vip-1',
  ticketTypeName: 'VIP',
  quantity: 1,
  priceXOF: 10000,
  pricePerTicketXOF: 10000,
  chargedAmountXOF: 10000,
  paymentMethod: 'orange_money',
  policyAccepted: true,
  policyVersion: '1.0',
  policyAcceptedAt: '2026-10-22T02:00:00.000Z',
};

async function withServer(app: Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function createHarness(
  result: TicketPurchaseResult = confirmedResult,
  overrides: Partial<TicketPurchaseHandlerDependencies> = {},
) {
  const cache = new Map<string, TicketPurchaseResult>();
  const locks = new Map<string, Promise<void>>();
  const dependencies: TicketPurchaseHandlerDependencies = {
    validatePurchaseInput,
    resolveSession: vi.fn().mockResolvedValue({ userId: account.id, role: 'user' }),
    findAccount: vi.fn().mockResolvedValue(account),
    isProduction: false,
    ticketSigningSecretConfigured: true,
    catalog: { getOffer: vi.fn().mockResolvedValue(offer) },
    feePolicy: {
      calculate: ({ unitPriceXOF, quantity }) => calculateTicketFees(DEFAULT_MONETIZATION_CATALOG, unitPriceXOF, quantity),
    },
    idempotency: {
      cleanup: vi.fn(),
      get: vi.fn(async (key: string) => cache.get(key) || null),
      acquire: vi.fn(async (key: string) => {
        const pending = locks.get(key);
        if (pending) await pending;
        let resolveLock!: () => void;
        const lock = new Promise<void>((resolve) => { resolveLock = resolve; });
        locks.set(key, lock);
        return () => {
          if (locks.get(key) === lock) locks.delete(key);
          resolveLock();
        };
      }),
    },
    executePurchase: vi.fn(async (command) => {
      if (command.idempotencyKey) cache.set(command.idempotencyKey, result);
      return result;
    }),
    requestIdFrom: vi.fn().mockReturnValue('request-123'),
    recordAudit: vi.fn(),
  };
  return { dependencies: { ...dependencies, ...overrides }, cache };
}

function createApp(dependencies: TicketPurchaseHandlerDependencies): Express {
  const app = express();
  app.use(express.json());
  app.post('/api/tickets/purchase', createTicketPurchaseHandler(dependencies));
  return app;
}

async function postPurchase(
  baseUrl: string,
  body: Record<string, unknown> = validBody,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}/api/tickets/purchase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('ticket purchase HTTP adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an unauthenticated purchase with the established response', async () => {
    const harness = createHarness(confirmedResult, {
      resolveSession: vi.fn().mockResolvedValue(null),
    });

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: 'Inicie sessão para comprar bilhetes.',
        code: 'AUTHENTICATION_REQUIRED',
        requestId: 'request-123',
      });
    });
    expect(harness.dependencies.executePurchase).not.toHaveBeenCalled();
  });

  it('rejects a purchase when the authenticated account is unavailable', async () => {
    const harness = createHarness(confirmedResult, {
      findAccount: vi.fn().mockResolvedValue(null),
    });

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: 'A conta da sessão não está disponível.',
        code: 'AUTHENTICATION_REQUIRED',
        requestId: 'request-123',
      });
    });
  });

  it('rejects invalid purchase input before looking up the catalog or executing payment', async () => {
    const harness = createHarness();
    const body = { ...validBody, quantity: 0 };

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl, body);
      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody).toMatchObject({
        code: 'VALIDATION_ERROR',
        requestId: 'request-123',
      });
      expect(responseBody.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_quantity' }),
      ]));
    });
    expect(harness.dependencies.catalog.getOffer).not.toHaveBeenCalled();
    expect(harness.dependencies.executePurchase).not.toHaveBeenCalled();
  });

  it.each([
    ['ticket type', { ticketTypeName: 'Regular' }, 'TICKET_TYPE_MISMATCH'],
    ['unit price', { pricePerTicketXOF: 9000 }, 'TICKET_PRICE_MISMATCH'],
    ['checkout total', { chargedAmountXOF: 11000 }, 'TICKET_TOTAL_MISMATCH'],
  ])('rejects a stale %s with the current conflict code', async (_label, changes, code) => {
    const harness = createHarness();

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl, { ...validBody, ...changes });
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ code, requestId: 'request-123' });
    });
    expect(harness.dependencies.executePurchase).not.toHaveBeenCalled();
  });

  it('passes the validated server quote to the purchase use case', async () => {
    const harness = createHarness();

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl);
      expect(response.status).toBe(200);
    });
    expect(harness.dependencies.executePurchase).toHaveBeenCalledWith(expect.objectContaining({
      expectedCheckout: {
        ticketTypeName: offer.ticketTypeName,
        unitPriceXOF: offer.unitPriceXOF,
        buyerTotalXOF: confirmedResult.quote.buyerTotalXOF,
      },
    }));
  });

  it('returns the established bad request when ticket sales are closed', async () => {
    const harness = createHarness();
    vi.mocked(harness.dependencies.catalog.getOffer).mockResolvedValue({ ...offer, salesOpen: false });

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'As vendas deste tipo de bilhete estão encerradas.',
        code: 'TICKET_INVENTORY_UNAVAILABLE',
        requestId: 'request-123',
      });
    });
    expect(harness.dependencies.executePurchase).not.toHaveBeenCalled();
  });

  it('rejects an overlong idempotency key before acquiring a lock', async () => {
    const harness = createHarness();

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl, validBody, { 'idempotency-key': 'x'.repeat(161) });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Chave de idempotência inválida.',
        code: 'INVALID_IDEMPOTENCY_KEY',
        requestId: 'request-123',
      });
    });
    expect(harness.dependencies.idempotency.acquire).not.toHaveBeenCalled();
  });

  it('returns a cached idempotent result without executing the purchase again', async () => {
    const harness = createHarness();
    harness.cache.set('user-1:checkout-1', confirmedResult);

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl, validBody, { 'idempotency-key': 'checkout-1' });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        transaction: { id: 'txn-1' },
        tickets: [{ id: 'ticket-1' }],
      });
    });
    expect(harness.dependencies.executePurchase).not.toHaveBeenCalled();
  });

  it('waits for a concurrent same-key request and replays the result', async () => {
    const harness = createHarness();
    let signalStarted!: () => void;
    let finishPurchase!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const gate = new Promise<void>((resolve) => { finishPurchase = resolve; });
    harness.dependencies.executePurchase = vi.fn(async (command) => {
      signalStarted();
      await gate;
      if (command.idempotencyKey) harness.cache.set(command.idempotencyKey, confirmedResult);
      return confirmedResult;
    });

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const headers = { 'idempotency-key': 'checkout-concurrent' };
      const firstRequest = postPurchase(baseUrl, validBody, headers);
      await started;
      const secondRequest = postPurchase(baseUrl, validBody, headers);
      finishPurchase();
      const [first, second] = await Promise.all([firstRequest, secondRequest]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
      expect(firstBody).toMatchObject({ transaction: { id: 'txn-1' }, tickets: [{ id: 'ticket-1' }] });
      expect(secondBody).toMatchObject({ transaction: { id: 'txn-1' }, tickets: [{ id: 'ticket-1' }] });
    });
    expect(harness.dependencies.executePurchase).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['confirmed', confirmedResult, 200, { success: true, transaction: { id: 'txn-1' } }],
    ['pending', pendingResult, 202, { success: false, paymentPending: true, transaction: { id: 'txn-1' } }],
    ['invalid offer', { status: 'rejected', reason: 'invalid_offer', message: 'Oferta indisponível.' } as TicketPurchaseResult, 404, { code: 'TICKET_OFFER_NOT_FOUND' }],
    ['invalid policy', { status: 'rejected', reason: 'invalid_policy', message: 'Política inválida.' } as TicketPurchaseResult, 400, { code: 'VALIDATION_ERROR' }],
    ['invalid quantity', { status: 'rejected', reason: 'invalid_quantity', message: 'Quantidade inválida.' } as TicketPurchaseResult, 400, { code: 'INVALID_TICKET_QUANTITY' }],
    ['inventory unavailable', { status: 'rejected', reason: 'inventory_unavailable', message: 'Sem inventário.' } as TicketPurchaseResult, 409, { code: 'TICKET_INVENTORY_UNAVAILABLE' }],
    ['sales closed', { status: 'rejected', reason: 'sales_closed', message: 'Vendas fechadas.' } as TicketPurchaseResult, 400, { code: 'TICKET_INVENTORY_UNAVAILABLE' }],
    ['ticket type changed', { status: 'rejected', reason: 'ticket_type_mismatch', message: 'A categoria selecionada foi alterada. Actualize o checkout.' } as TicketPurchaseResult, 409, { code: 'TICKET_TYPE_MISMATCH' }],
    ['ticket price changed', { status: 'rejected', reason: 'ticket_price_mismatch', message: 'O preço do bilhete foi alterado. Actualize o checkout.' } as TicketPurchaseResult, 409, { code: 'TICKET_PRICE_MISMATCH' }],
    ['checkout total changed', { status: 'rejected', reason: 'ticket_total_mismatch', message: 'O total do checkout não corresponde à política de taxas actual.' } as TicketPurchaseResult, 409, { code: 'TICKET_TOTAL_MISMATCH' }],
    ['payment failed', { status: 'rejected', reason: 'payment_failed', message: 'Pagamento falhou.' } as TicketPurchaseResult, 502, { code: 'TICKET_PAYMENT_FAILED' }],
  ])('maps %s to the current response contract', async (_label, result, status, expectedBody) => {
    const harness = createHarness(result);

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl);
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject(expectedBody);
    });
  });

  it('records the existing pending and confirmed audit actions with the request ID', async () => {
    const pendingHarness = createHarness(pendingResult);
    await withServer(createApp(pendingHarness.dependencies), async (baseUrl) => {
      await postPurchase(baseUrl);
    });
    expect(pendingHarness.dependencies.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ticket_payment_pending',
      requestId: 'request-123',
    }));

    const confirmedHarness = createHarness(confirmedResult);
    await withServer(createApp(confirmedHarness.dependencies), async (baseUrl) => {
      await postPurchase(baseUrl);
    });
    expect(confirmedHarness.dependencies.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ticket_sms_dispatch',
      requestId: 'request-123',
    }));
    expect(confirmedHarness.dependencies.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ticket_issued',
      requestId: 'request-123',
    }));
  });

  it('returns the established operational error and releases the idempotency lock', async () => {
    const harness = createHarness(confirmedResult, {
      executePurchase: vi.fn().mockRejectedValue(new Error('database failure with private details')),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await withServer(createApp(harness.dependencies), async (baseUrl) => {
      const response = await postPurchase(baseUrl, validBody, { 'idempotency-key': 'checkout-error' });
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({
        error: 'Não foi possível concluir a compra do bilhete.',
        code: 'TICKET_PURCHASE_FAILED',
        requestId: 'request-123',
      });
      expect(JSON.stringify(body)).not.toContain('database failure');
    });

    expect(errorSpy).toHaveBeenCalledWith('ticket-purchase-failed', expect.objectContaining({
      requestId: 'request-123',
      stage: 'application-use-case',
      errorName: 'Error',
    }));
    expect(harness.dependencies.idempotency.acquire).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.executePurchase).toHaveBeenCalledTimes(1);
  });
});
