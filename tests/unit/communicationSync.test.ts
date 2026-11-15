import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncCommunicationData, syncUserNotifications } from '../../src/services/communicationSync';

describe('communication synchronization', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('maps notification payloads and preserves read state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{ id: 'n-1', title: 'Aviso', message: 'Olá', category: 'system', readAt: '2026-01-01', createdAt: '2026-01-02', metadata: {} }] }));
    await expect(syncUserNotifications('user-1')).resolves.toMatchObject({ kind: 'updated', notifications: [{ id: 'n-1', read: true, targetUserId: 'user-1' }] });
  });

  it('restores the My Tickets action when hydrating a purchase notification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{
      id: 'notif-ticket-txn-1',
      title: 'O seu bilhete está disponível',
      message: 'A compra foi confirmada.',
      category: 'order_redemption',
      read: false,
      createdAt: '2026-10-21T10:00:00.000Z',
      metadata: { transactionId: 'txn-1', ticketId: 'ticket-1', ticketDestination: 'my-tickets' },
    }] }));

    await expect(syncUserNotifications('buyer-1')).resolves.toMatchObject({
      kind: 'updated',
      notifications: [{
        id: 'notif-ticket-txn-1',
        linkTab: 'client',
        actionLabel: 'Meus bilhetes',
        metadata: { ticketDestination: 'my-tickets' },
      }],
    });
  });

  it('returns unauthorized when communication endpoints reject the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(syncCommunicationData('user')).resolves.toEqual({ kind: 'unauthorized' });
  });

  it('propagates network failures so the polling owner can handle them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network offline')));
    await expect(syncCommunicationData('business')).rejects.toThrow('network offline');
  });

  it('a administração pede os pedidos de suporte reais em vez de listas vazias', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ conversations: [], messages: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tickets: [{
        id: 'SUP-1',
        requester_user_id: 'u-1',
        category: 'other',
        subject: 'Preciso de ajuda',
        description: 'Pedido enviado por um cidadão.',
        status: 'open',
        created_at: '2026-01-01T10:00:00.000Z',
        updated_at: '2026-01-01T10:00:00.000Z',
        replies: [],
      }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncCommunicationData('admin');

    expect(fetchMock).toHaveBeenCalledWith('/api/conversations');
    expect(fetchMock).toHaveBeenCalledWith('/api/support/tickets/mine');
    expect(result).toMatchObject({
      kind: 'updated',
      supportRequests: [{ id: 'SUP-1', subject: 'Preciso de ajuda', requesterId: 'u-1', requesterRole: 'user' }],
    });
  });

  it('marca o requerente empresa quando o pedido tem empresa associada', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ conversations: [], messages: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tickets: [{
        id: 'SUP-2', requester_user_id: 'u-2', business_id: 'biz-1', category: 'other', subject: 'Conta da empresa',
        status: 'open', created_at: '2026-01-01T10:00:00.000Z', updated_at: '2026-01-01T10:00:00.000Z', replies: [],
      }] }) }));

    const result = await syncCommunicationData('admin');
    expect(result).toMatchObject({ supportRequests: [{ id: 'SUP-2', requesterRole: 'business' }] });
  });

  it('maps conversations, messages, and support tickets', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ conversations: [{ id: 'c-1', user_id: 'u-1', business_id: 'b-1', subject: 'Ajuda', last_message: 'Olá', created_at: '2026-01-01', updated_at: '2026-01-02', unread_for_user: true, unread_for_business: false }], messages: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tickets: [] }) }));
    await expect(syncCommunicationData('user')).resolves.toMatchObject({ kind: 'updated', conversations: [{ id: 'c-1', unreadForUser: true }] });
  });
});
