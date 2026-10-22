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

export interface TicketFeeBreakdown {
  grossTicketValue: number;
  percentageFee: number;
  fixedFee: number;
  platformRevenue: number;
  buyerShare: number;
  organizerShare: number;
  buyerTotal: number;
  organizerNet: number;
  feePayer: 'buyer' | 'organizer' | 'split';
  currency: string;
}

export interface TicketFeePolicyPort {
  calculate(input: { unitPriceXOF: number; quantity: number }): TicketFeeBreakdown;
}

export interface TicketPurchaseQuote {
  unitPriceXOF: number;
  quantity: number;
  feeBreakdown: TicketFeeBreakdown;
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
  feePolicy: TicketFeePolicyPort;
}): TicketPurchaseQuoteResult {
  const { offer, quantity, feePolicy } = input;
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

  const feeBreakdown = feePolicy.calculate({ unitPriceXOF: offer.unitPriceXOF, quantity });
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
