import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeStoreMocks = vi.hoisted(() => ({
  loadJson: vi.fn(),
  saveJson: vi.fn(),
}));

vi.mock('../../server/db', () => ({ databasePool: null }));
vi.mock('../../server/runtimeStore', () => ({
  loadJson: runtimeStoreMocks.loadJson,
  saveJson: runtimeStoreMocks.saveJson,
}));

describe('local notification persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    runtimeStoreMocks.loadJson.mockReset().mockReturnValue([]);
    runtimeStoreMocks.saveJson.mockReset();
  });

  it('persists transaction-keyed notifications and scopes read/list operations to the recipient', async () => {
    const service = await import('../../server/postgresCommunicationService');
    const notification = {
      id: 'notif-ticket-txn-1',
      userId: 'buyer-1',
      category: 'order_redemption',
      title: 'O seu bilhete está disponível',
      message: 'Consulte os seus bilhetes.',
      metadata: { transactionId: 'txn-1', ticketDestination: 'my-tickets' },
      createdAt: '2026-10-21T10:00:00.000Z',
    };

    await service.persistPostgresNotification(notification);

    expect(runtimeStoreMocks.saveJson).toHaveBeenCalledWith('notifications.json', [
      expect.objectContaining({ ...notification, read: false }),
    ]);
    await expect(service.listPostgresNotifications('buyer-1')).resolves.toEqual([
      expect.objectContaining({ id: notification.id, userId: 'buyer-1', metadata: notification.metadata, read: false }),
    ]);
    await expect(service.listPostgresNotifications('buyer-2')).resolves.toEqual([]);
    await expect(service.markPostgresNotificationRead('buyer-2', notification.id)).resolves.toBe(false);
    await expect(service.markPostgresNotificationRead('buyer-1', notification.id)).resolves.toBe(true);
    await expect(service.listPostgresNotifications('buyer-1')).resolves.toEqual([
      expect.objectContaining({ id: notification.id, read: true }),
    ]);
  });
});
