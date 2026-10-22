import { describe, expect, it, vi } from 'vitest';
import { createTicketCatalogService, type TicketEventSnapshot } from '../../server/ticketCatalogService';
import type { TicketOffer } from '../../server/modules/ticketing/domain/ticketPurchaseDomain';

const event: TicketEventSnapshot = {
  id: 'event-1',
  title: 'Festival',
  status: 'active',
  businessId: 'business-1',
  ticketTypes: [{
    id: 'vip',
    name: 'VIP',
    priceXOF: 12000,
    availableQuantity: 10,
    soldQuantity: 2,
  }],
};

const offer: TicketOffer = {
  eventId: 'event-1',
  businessId: 'business-1',
  eventTitle: 'Festival',
  ticketTypeId: 'vip',
  ticketTypeName: 'VIP',
  unitPriceXOF: 12000,
  availableQuantity: 10,
  soldQuantity: 2,
  reservedQuantity: 0,
  salesOpen: true,
};

describe('ticket catalog', () => {
  it('returns null for unknown event and ticket type', async () => {
    const catalog = createTicketCatalogService({
      databaseConfigured: false,
      loadLocalEvents: async () => [event],
      loadLocalTickets: async () => [],
      loadLocalReservations: async () => [],
      loadPostgresOffer: async () => null,
    });

    await expect(catalog.getTicketOffer('missing', 'vip')).resolves.toBeNull();
    await expect(catalog.getTicketOffer('event-1', 'missing')).resolves.toBeNull();
  });

  it('does not expose unpublished events as purchase offers', async () => {
    const catalog = createTicketCatalogService({
      databaseConfigured: false,
      loadLocalEvents: async () => [{ ...event, status: 'draft' }],
      loadLocalTickets: async () => [],
      loadLocalReservations: async () => [],
      loadPostgresOffer: async () => null,
    });

    await expect(catalog.getTicketOffer('event-1', 'vip')).resolves.toBeNull();
  });

  it('loads a canonical offer from PostgreSQL when configured', async () => {
    const loadPostgresOffer = vi.fn(async () => offer);
    const loadLocalEvents = vi.fn(async () => [event]);
    const catalog = createTicketCatalogService({
      databaseConfigured: true,
      loadLocalEvents,
      loadLocalTickets: async () => [],
      loadLocalReservations: async () => [],
      loadPostgresOffer,
    });

    await expect(catalog.getTicketOffer('event-1', 'vip')).resolves.toEqual(offer);
    expect(loadPostgresOffer).toHaveBeenCalledWith('event-1', 'vip');
    expect(loadLocalEvents).not.toHaveBeenCalled();
  });

  it('loads a canonical offer from server-owned local event snapshots', async () => {
    const catalog = createTicketCatalogService({
      databaseConfigured: false,
      loadLocalEvents: async () => [event],
      loadLocalTickets: async () => [],
      loadLocalReservations: async () => [],
      loadPostgresOffer: async () => null,
    });

    await expect(catalog.getTicketOffer('event-1', 'vip')).resolves.toEqual(offer);
  });

  it('includes active local reservations in the offer availability', async () => {
    const catalog = createTicketCatalogService({
      databaseConfigured: false,
      loadLocalEvents: async () => [event],
      loadLocalTickets: async () => [],
      loadLocalReservations: async () => [{
        eventId: 'event-1',
        ticketTypeId: 'vip',
        quantity: 2,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        status: 'pending',
      }],
      loadPostgresOffer: async () => null,
    });

    await expect(catalog.getTicketOffer('event-1', 'vip')).resolves.toMatchObject({ reservedQuantity: 2 });
  });
});
