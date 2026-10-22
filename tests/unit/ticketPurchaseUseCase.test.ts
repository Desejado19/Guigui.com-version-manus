import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateTicketFees, DEFAULT_MONETIZATION_CATALOG } from '../../src/data/monetizationCatalog';
import type { PaymentIntentState } from '../../server/integrations/ports';
import type { TicketPurchaseResult } from '../../server/modules/ticketing/application/purchaseTicket';

const testState = vi.hoisted(() => ({
  events: [] as string[],
  savedResults: new Map<string, unknown>(),
  paymentState: 'confirmed' as PaymentIntentState,
  available: 'reserved' as 'reserved' | 'unavailable',
  deliveryFails: false,
}));

const offer = {
  eventId: 'event-1',
  businessId: 'business-1',
  eventTitle: 'Festival de Teste',
  eventDate: '2027-01-01',
  eventTime: '18:00',
  ticketTypeId: 'vip-1',
  ticketTypeName: 'VIP',
  unitPriceXOF: 10000,
  availableQuantity: 20,
  soldQuantity: 2,
  salesOpen: true,
};
const ticket = {
  id: 'ticket-1',
  ticketCode: 'GUI-1',
  qrToken: 'QR-1',
  pinCode: '123456',
  eventId: 'event-1',
  eventTitle: 'Festival de Teste',
  ticketTypeId: 'vip-1',
  ticketTypeName: 'VIP',
  priceXOF: 10000,
  buyerUserId: 'buyer-1',
  buyerName: 'Comprador',
  buyerPhone: '+245955000001',
  holderName: 'Titular',
  holderPhone: '+245966000002',
  status: 'valid' as const,
};

function createPorts() {
  testState.events.length = 0;
  testState.savedResults.clear();
  testState.paymentState = 'confirmed';
  testState.available = 'reserved';
  testState.deliveryFails = false;
  return {
    catalog: {
      getOffer: vi.fn(async () => { testState.events.push('catalog'); return offer; }),
    },
    inventory: {
      reserve: vi.fn(async () => { testState.events.push('reserve'); return testState.available; }),
      confirm: vi.fn(async () => { testState.events.push('confirm'); }),
      release: vi.fn(async () => { testState.events.push('release'); }),
    },
    tickets: {
      issue: vi.fn(async () => { testState.events.push('issue'); return [ticket]; }),
    },
    idempotency: {
      get: vi.fn(async (key: string) => (testState.savedResults.get(key) as TicketPurchaseResult | undefined) || null),
      store: vi.fn(async (key: string, result: unknown) => { testState.savedResults.set(key, result); }),
    },
    payments: {
      orange_money: {
        provider: 'orange_money' as const,
        mode: 'simulated' as const,
        createIntent: vi.fn(async () => {
          testState.events.push('payment');
          return { providerRef: 'OM-SIM-1', state: testState.paymentState, mode: 'simulated' as const };
        }),
        verifyWebhook: () => false,
        parseWebhook: () => null,
      },
      telecel: {
        provider: 'telecel' as const,
        mode: 'simulated' as const,
        createIntent: vi.fn(async () => ({ providerRef: 'TEL-SIM-1', state: testState.paymentState, mode: 'simulated' as const })),
        verifyWebhook: () => false,
        parseWebhook: () => null,
      },
    },
    ticketFactory: vi.fn(() => { testState.events.push('factory'); return [ticket]; }),
    transactions: {
      persist: vi.fn(async () => { testState.events.push('persist'); }),
      recordFulfillment: vi.fn(async () => { testState.events.push('fulfillment'); }),
    },
    delivery: vi.fn(async () => {
      testState.events.push('delivery');
      if (testState.deliveryFails) throw new Error('simulated notification delivery failure');
      return {
        email: { state: 'simulated' as const, reference: 'email-1' },
        notification: { state: 'created' as const },
        sms: { state: 'simulated' as const, mode: 'simulated' as const, references: ['sms-1'] },
      };
    }),
    feePolicy: {
      calculate: ({ unitPriceXOF, quantity }: { unitPriceXOF: number; quantity: number }) => (
        calculateTicketFees(DEFAULT_MONETIZATION_CATALOG, unitPriceXOF, quantity)
      ),
    },
    createTransactionId: () => 'txn-1',
    reservationTtlMs: 15 * 60_000,
    now: () => new Date('2026-10-21T10:00:00.000Z'),
  };
}

const command = {
  buyer: { userId: 'buyer-1', name: 'Comprador', phone: '+245955000001', email: 'buyer@example.test' },
  eventId: 'event-1',
  ticketTypeId: 'vip-1',
  quantity: 1,
  holderName: 'Titular',
  holderPhone: '+245966000002',
  paymentMethod: 'orange_money' as const,
  policyAccepted: true,
  policyVersion: '1.0',
  policyAcceptedAt: '2026-10-21T09:00:00.000Z',
  idempotencyKey: 'buyer-1:checkout-1',
};

describe('ticket purchase application use case', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('quotes, reserves, confirms payment, issues tickets, and delivers in order', async () => {
    const ports = createPorts();
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const result = await executeTicketPurchase(command, ports);

    expect(result).toMatchObject({
      status: 'confirmed',
      transaction: { id: 'txn-1', providerRef: 'OM-SIM-1', providerMode: 'simulated', status: 'confirmed_api' },
      tickets: [ticket],
    });
    expect(testState.events).toEqual([
      'catalog', 'reserve', 'payment', 'persist', 'fulfillment', 'factory', 'issue', 'confirm', 'persist', 'delivery',
    ]);
    expect(ports.idempotency.store).toHaveBeenCalledWith(command.idempotencyKey, result);
  });

  it('keeps pending payments reserved without issuing tickets or attempting delivery', async () => {
    const ports = createPorts();
    testState.paymentState = 'pending';
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const result = await executeTicketPurchase(command, ports);

    expect(result).toMatchObject({ status: 'pending', transaction: { status: 'pending_provider' } });
    expect(ports.inventory.confirm).not.toHaveBeenCalled();
    expect(ports.tickets.issue).not.toHaveBeenCalled();
    expect(ports.delivery).not.toHaveBeenCalled();
    expect(ports.inventory.release).not.toHaveBeenCalled();
  });

  it('releases the reservation when payment fails and returns an explicit rejection', async () => {
    const ports = createPorts();
    testState.paymentState = 'failed';
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const result = await executeTicketPurchase(command, ports);

    expect(result).toMatchObject({ status: 'rejected', reason: 'payment_failed' });
    expect(ports.inventory.release).toHaveBeenCalledWith('txn-1');
    expect(ports.tickets.issue).not.toHaveBeenCalled();
    expect(ports.delivery).not.toHaveBeenCalled();
  });

  it('does not create a payment intent when inventory is unavailable', async () => {
    const ports = createPorts();
    testState.available = 'unavailable';
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const result = await executeTicketPurchase(command, ports);

    expect(result).toMatchObject({ status: 'rejected', reason: 'inventory_unavailable' });
    expect(ports.payments.orange_money.createIntent).not.toHaveBeenCalled();
  });

  it('keeps issued tickets confirmed when post-purchase delivery throws', async () => {
    const ports = createPorts();
    testState.deliveryFails = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const result = await executeTicketPurchase(command, ports);

    expect(result).toMatchObject({
      status: 'confirmed',
      tickets: [ticket],
      delivery: {
        email: { state: 'failed' },
        notification: { state: 'failed' },
        sms: { state: 'failed', mode: 'simulated' },
      },
    });
    expect(ports.inventory.release).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('ticket-purchase-delivery-failed', {
      transactionId: 'txn-1',
      errorName: 'Error',
    });
  });

  it.each([
    ['ticket category', { ...offer, ticketTypeName: 'Regular' }, 'ticket_type_mismatch'],
    ['unit price', { ...offer, unitPriceXOF: 12000 }, 'ticket_price_mismatch'],
  ])('rejects a changed %s before reserving or creating payment', async (_label, currentOffer, reason) => {
    const ports = createPorts();
    ports.catalog.getOffer = vi.fn(async () => currentOffer);
    const expectedCheckout = {
      ticketTypeName: offer.ticketTypeName,
      unitPriceXOF: offer.unitPriceXOF,
      buyerTotalXOF: calculateTicketFees(DEFAULT_MONETIZATION_CATALOG, offer.unitPriceXOF, command.quantity).buyerTotal,
    };
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const result = await executeTicketPurchase({ ...command, expectedCheckout }, ports);

    expect(result).toMatchObject({ status: 'rejected', reason });
    expect(ports.inventory.reserve).not.toHaveBeenCalled();
    expect(ports.payments.orange_money.createIntent).not.toHaveBeenCalled();
    expect(ports.transactions.persist).not.toHaveBeenCalled();
  });

  it('rejects a changed checkout total when the fee policy changes before payment', async () => {
    const ports = createPorts();
    const calculate = ports.feePolicy.calculate;
    let calculationCount = 0;
    ports.feePolicy.calculate = (input) => {
      const breakdown = calculate(input);
      calculationCount += 1;
      return calculationCount === 1 ? breakdown : { ...breakdown, buyerTotal: breakdown.buyerTotal + 1 };
    };
    const expectedCheckout = {
      ticketTypeName: offer.ticketTypeName,
      unitPriceXOF: offer.unitPriceXOF,
      buyerTotalXOF: ports.feePolicy.calculate({ unitPriceXOF: offer.unitPriceXOF, quantity: command.quantity }).buyerTotal,
    };
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const result = await executeTicketPurchase({ ...command, expectedCheckout }, ports);

    expect(result).toMatchObject({ status: 'rejected', reason: 'ticket_total_mismatch' });
    expect(ports.inventory.reserve).not.toHaveBeenCalled();
    expect(ports.payments.orange_money.createIntent).not.toHaveBeenCalled();
    expect(ports.transactions.persist).not.toHaveBeenCalled();
  });

  it('returns the stored result for an idempotency key without repeating payment or issuance', async () => {
    const ports = createPorts();
    const { executeTicketPurchase } = await import('../../server/modules/ticketing/application/purchaseTicket');

    const firstResult = await executeTicketPurchase(command, ports);
    testState.events.length = 0;
    vi.clearAllMocks();
    const result = await executeTicketPurchase(command, ports);

    expect(result).toBe(firstResult);
    expect(testState.events).toEqual([]);
    expect(ports.catalog.getOffer).not.toHaveBeenCalled();
    expect(ports.payments.orange_money.createIntent).not.toHaveBeenCalled();
    expect(ports.tickets.issue).not.toHaveBeenCalled();
  });
});
