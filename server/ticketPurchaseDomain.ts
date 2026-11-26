import { calculateTicketFees } from '../src/data/monetizationCatalog';
import type { MonetizationCatalog, TicketFeeSnapshot } from '../src/types';

export interface TicketOffer {
  eventId: string;
  businessId?: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  ticketTypeId: string;
  ticketTypeName: string;
  unitPriceXOF: number;
  availableQuantity: number;
  soldQuantity: number;
  reservedQuantity?: number;
  salesOpen: boolean;
}

export interface TicketPurchaseQuote {
  unitPriceXOF: number;
  quantity: number;
  feeBreakdown: ReturnType<typeof calculateTicketFees>;
  buyerTotalXOF: number;
}

export type TicketPurchaseQuoteResult =
  | { valid: true; quote: TicketPurchaseQuote }
  | {
      valid: false;
      reason: 'invalid_quantity' | 'sales_closed' | 'sold_out' | 'insufficient_inventory';
    };

export function quoteTicketPurchase(input: {
  offer: TicketOffer;
  quantity: number;
  catalog: MonetizationCatalog;
}): TicketPurchaseQuoteResult {
  const { offer, quantity, catalog } = input;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
    return { valid: false, reason: 'invalid_quantity' };
  }
  if (!offer.salesOpen) {
    return { valid: false, reason: 'sales_closed' };
  }

  const remaining = offer.availableQuantity - offer.soldQuantity - (offer.reservedQuantity || 0);
  if (remaining <= 0) {
    return { valid: false, reason: 'sold_out' };
  }
  if (quantity > remaining) {
    return { valid: false, reason: 'insufficient_inventory' };
  }

  const feeBreakdown = calculateTicketFees(catalog, offer.unitPriceXOF, quantity);
  return {
    valid: true,
    quote: {
      unitPriceXOF: offer.unitPriceXOF,
      quantity,
      feeBreakdown,
      buyerTotalXOF: feeBreakdown.buyerTotal,
    },
  };
}

/** Fotografia da política de taxas aplicada numa compra, para gravação na ordem. */
export function buildTicketFeeSnapshot(
  catalog: MonetizationCatalog,
  feeBreakdown: ReturnType<typeof calculateTicketFees>,
  calculatedAt: Date,
): TicketFeeSnapshot {
  const policy = catalog.ticketFeePolicy;
  return {
    calculatedAt: calculatedAt.toISOString(),
    commissionPercentage: policy.commissionPercentage,
    fixedFeeXOF: policy.fixedFee,
    billingModel: policy.billingModel,
    feePayer: feeBreakdown.feePayer,
    currency: policy.currency,
    grossTicketValueXOF: feeBreakdown.grossTicketValue,
    percentageFeeXOF: feeBreakdown.percentageFee,
    fixedFeeAmountXOF: feeBreakdown.fixedFee,
    platformFeeXOF: feeBreakdown.platformRevenue,
    buyerShareXOF: feeBreakdown.buyerShare,
    organizerShareXOF: feeBreakdown.organizerShare,
    buyerTotalXOF: feeBreakdown.buyerTotal,
    organizerNetXOF: feeBreakdown.organizerNet,
  };
}

/**
 * Cada bilhete é uma ordem própria, por isso a fotografia da compra é dividida
 * pelo número de unidades. A divisão preserva o total exacto calculado no checkout.
 */
export function ticketFeeSnapshotForUnit(snapshot: TicketFeeSnapshot, index: number, quantity: number): TicketFeeSnapshot {
  if (quantity <= 1) return snapshot;
  const share = (total: number) => Math.floor(total / quantity) + (index < total % quantity ? 1 : 0);
  return {
    ...snapshot,
    grossTicketValueXOF: share(snapshot.grossTicketValueXOF),
    percentageFeeXOF: share(snapshot.percentageFeeXOF),
    fixedFeeAmountXOF: share(snapshot.fixedFeeAmountXOF),
    platformFeeXOF: share(snapshot.platformFeeXOF),
    buyerShareXOF: share(snapshot.buyerShareXOF),
    organizerShareXOF: share(snapshot.organizerShareXOF),
    buyerTotalXOF: share(snapshot.buyerTotalXOF),
    organizerNetXOF: share(snapshot.organizerNetXOF),
  };
}
