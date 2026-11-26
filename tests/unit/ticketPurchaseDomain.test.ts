import { describe, expect, it } from 'vitest';
import { calculateTicketFees, DEFAULT_MONETIZATION_CATALOG } from '../../src/data/monetizationCatalog';
import { quoteTicketPurchase, type TicketOffer } from '../../server/ticketPurchaseDomain';

const offer: TicketOffer = {
  eventId: 'event-1',
  eventTitle: 'Festival',
  ticketTypeId: 'vip',
  ticketTypeName: 'VIP',
  unitPriceXOF: 12000,
  availableQuantity: 8,
  soldQuantity: 2,
  reservedQuantity: 0,
  salesOpen: true,
};

const buyerFeeCatalog = {
  ...DEFAULT_MONETIZATION_CATALOG,
  ticketFeePolicy: {
    ...DEFAULT_MONETIZATION_CATALOG.ticketFeePolicy,
    feePayer: 'buyer' as const,
  },
};

describe('quoteTicketPurchase', () => {
  it('calculates the quote from the server-owned offer and fee policy', () => {
    const result = quoteTicketPurchase({ offer, quantity: 2, catalog: buyerFeeCatalog });

    expect(result).toMatchObject({
      valid: true,
      quote: {
        unitPriceXOF: 12000,
        quantity: 2,
        feeBreakdown: calculateTicketFees(buyerFeeCatalog, 12000, 2),
        buyerTotalXOF: calculateTicketFees(buyerFeeCatalog, 12000, 2).buyerTotal,
      },
    });
  });

  it.each([0, -1, 1.5, 101])('rejects invalid quantity %s', (quantity) => {
    expect(quoteTicketPurchase({ offer, quantity, catalog: buyerFeeCatalog })).toMatchObject({
      valid: false,
      reason: 'invalid_quantity',
    });
  });

  it('rejects an offer whose sales are closed', () => {
    expect(quoteTicketPurchase({
      offer: { ...offer, salesOpen: false },
      quantity: 1,
      catalog: buyerFeeCatalog,
    })).toMatchObject({ valid: false, reason: 'sales_closed' });
  });

  it('rejects a sold-out offer', () => {
    expect(quoteTicketPurchase({
      offer: { ...offer, availableQuantity: 2, soldQuantity: 2 },
      quantity: 1,
      catalog: buyerFeeCatalog,
    })).toMatchObject({ valid: false, reason: 'sold_out' });
  });

  it('rejects a quantity above remaining inventory', () => {
    expect(quoteTicketPurchase({
      offer: { ...offer, availableQuantity: 3, soldQuantity: 2 },
      quantity: 2,
      catalog: buyerFeeCatalog,
    })).toMatchObject({ valid: false, reason: 'insufficient_inventory' });
  });

  it('includes active reservations when checking remaining inventory', () => {
    expect(quoteTicketPurchase({
      offer: { ...offer, availableQuantity: 3, soldQuantity: 1, reservedQuantity: 1 },
      quantity: 2,
      catalog: buyerFeeCatalog,
    })).toMatchObject({ valid: false, reason: 'insufficient_inventory' });
  });
});
