import { databaseConfigured } from './db';
import { loadJson, saveJson } from './runtimeStore';
import {
  confirmPostgresTicketReservation,
  releasePostgresTicketReservation,
  reservePostgresTicketInventory,
} from './postgresTicketService';
import type { TicketInventoryPort } from './ticketPurchasePorts';
import type { TicketOffer } from './ticketPurchaseDomain';

export interface LocalTicketReservation {
  reservationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  expiresAt: string;
  status: 'pending' | 'confirmed' | 'released';
}

export function createLocalTicketInventory(input: {
  initialReservations: LocalTicketReservation[];
  persistReservations?: (reservations: LocalTicketReservation[]) => void;
}): TicketInventoryPort {
  const reservations = new Map(input.initialReservations.map((item) => [item.reservationId, item]));
  const persist = () => input.persistReservations?.(Array.from(reservations.values()));
  const releaseExpired = () => {
    const now = Date.now();
    for (const [id, reservation] of reservations) {
      if (reservation.status === 'pending' && Date.parse(reservation.expiresAt) <= now) {
        reservations.delete(id);
      }
    }
  };

  return {
    async reserve({ offer, quantity, reservationId, expiresAt }) {
      releaseExpired();
      const existing = reservations.get(reservationId);
      if (existing) {
        return existing.status === 'pending'
          && existing.eventId === offer.eventId
          && existing.ticketTypeId === offer.ticketTypeId
          && existing.quantity === quantity
          ? 'reserved'
          : 'unavailable';
      }
      const matchingReservations = Array.from(reservations.values())
        .filter((reservation) => reservation.eventId === offer.eventId
          && reservation.ticketTypeId === offer.ticketTypeId);
      const confirmedQuantity = matchingReservations
        .filter((reservation) => reservation.status === 'confirmed')
        .reduce((sum, reservation) => sum + reservation.quantity, 0);
      const pendingQuantity = matchingReservations
        .filter((reservation) => reservation.status === 'pending')
        .reduce((sum, reservation) => sum + reservation.quantity, 0);
      const soldQuantity = Math.max(offer.soldQuantity, confirmedQuantity);
      const reservedQuantity = Math.max(offer.reservedQuantity || 0, pendingQuantity);
      if (offer.availableQuantity - soldQuantity - reservedQuantity < quantity) return 'unavailable';

      reservations.set(reservationId, {
        reservationId,
        eventId: offer.eventId,
        ticketTypeId: offer.ticketTypeId,
        quantity,
        expiresAt,
        status: 'pending',
      });
      persist();
      return 'reserved';
    },
    async confirm(reservationId) {
      const reservation = reservations.get(reservationId);
      if (!reservation || reservation.status !== 'pending') return;
      reservations.set(reservationId, { ...reservation, status: 'confirmed' });
      persist();
    },
    async release(reservationId) {
      const reservation = reservations.get(reservationId);
      if (!reservation || reservation.status !== 'pending') return;
      reservations.set(reservationId, { ...reservation, status: 'released' });
      persist();
    },
  };
}

const localInventory = createLocalTicketInventory({
  initialReservations: loadJson<LocalTicketReservation[]>('ticket-reservations.json', []),
  persistReservations: (reservations) => saveJson('ticket-reservations.json', reservations),
});

export const ticketInventory: TicketInventoryPort = databaseConfigured
  ? {
      reserve: reservePostgresTicketInventory,
      confirm: confirmPostgresTicketReservation,
      release: releasePostgresTicketReservation,
    }
  : localInventory;
