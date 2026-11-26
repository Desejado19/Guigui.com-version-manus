import type { TicketForValidation } from './validationService';
import type { TicketOffer } from './ticketPurchaseDomain';

export interface TicketCatalogPort {
  getOffer(eventId: string, ticketTypeId: string): Promise<TicketOffer | null>;
}

export interface TicketInventoryPort {
  reserve(input: {
    offer: TicketOffer;
    quantity: number;
    reservationId: string;
    expiresAt: string;
  }): Promise<'reserved' | 'unavailable'>;
  confirm(reservationId: string): Promise<void>;
  release(reservationId: string): Promise<void>;
}

export interface TicketRepositoryPort {
  issue(reservationId: string, tickets: TicketForValidation[], buyerUserId: string): Promise<TicketForValidation[]>;
}

export interface TicketPurchaseIdempotencyPort<T> {
  get(key: string): Promise<T | null>;
  store(key: string, result: T): Promise<void>;
}
