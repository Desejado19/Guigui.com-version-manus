import { describe, expect, it } from 'vitest';
import { createLocalTicketInventory } from '../../server/ticketInventoryService';
import type { TicketOffer } from '../../server/ticketPurchaseDomain';

const offer: TicketOffer = {
  eventId: 'event-1',
  eventTitle: 'Festival',
  ticketTypeId: 'vip',
  ticketTypeName: 'VIP',
  unitPriceXOF: 12000,
  availableQuantity: 2,
  soldQuantity: 1,
  salesOpen: true,
};

describe('local ticket inventory reservations', () => {
  it('atomically prevents concurrent reservations from overselling remaining stock', async () => {
    const inventory = createLocalTicketInventory({ initialReservations: [] });
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const results = await Promise.all([
      inventory.reserve({ offer, quantity: 1, reservationId: 'reservation-1', expiresAt }),
      inventory.reserve({ offer, quantity: 1, reservationId: 'reservation-2', expiresAt }),
    ]);

    expect(results.sort()).toEqual(['reserved', 'unavailable']);
  });

  it('releases a failed reservation so the inventory can be reserved again', async () => {
    const inventory = createLocalTicketInventory({ initialReservations: [] });
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    await expect(inventory.reserve({ offer, quantity: 1, reservationId: 'reservation-1', expiresAt }))
      .resolves.toBe('reserved');
    await inventory.release('reservation-1');
    await expect(inventory.reserve({ offer, quantity: 1, reservationId: 'reservation-2', expiresAt }))
      .resolves.toBe('reserved');
  });

  it('counts confirmed reservations when a concurrent checkout has a stale offer', async () => {
    const inventory = createLocalTicketInventory({ initialReservations: [] });
    const singleTicketOffer = { ...offer, availableQuantity: 1, soldQuantity: 0 };
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    await expect(inventory.reserve({
      offer: singleTicketOffer,
      quantity: 1,
      reservationId: 'reservation-confirmed',
      expiresAt,
    })).resolves.toBe('reserved');
    await inventory.confirm('reservation-confirmed');

    await expect(inventory.reserve({
      offer: singleTicketOffer,
      quantity: 1,
      reservationId: 'reservation-stale-offer',
      expiresAt,
    })).resolves.toBe('unavailable');
  });
});
