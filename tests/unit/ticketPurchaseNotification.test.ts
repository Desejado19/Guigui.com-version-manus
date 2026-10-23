import { describe, expect, it } from 'vitest';
import { buildNotificationsForEvent } from '../../src/services/notificationService';

describe('ticket purchase notifications', () => {
  it('uses the transaction id so the immediate notification merges with the server copy', () => {
    const [notification] = buildNotificationsForEvent({
      eventType: 'TICKET_PURCHASED',
      userId: 'buyer-1',
      eventId: 'event-1',
      eventTitle: 'Festival de Teste',
      ticketId: 'ticket-1',
      metadata: { transactionId: 'txn-1' },
    });

    expect(notification.id).toBe('notif-ticket-txn-1');
    expect(notification.recipientId).toBe('buyer-1');
    expect(notification.metadata?.transactionId).toBe('txn-1');
    expect(notification.metadata?.ticketDestination).toBe('my-tickets');
    expect(notification.linkTab).toBe('client');
    expect(notification.actionLabel).toBe('Meus bilhetes');
  });

});
