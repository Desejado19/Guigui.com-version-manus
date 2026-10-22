// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AppNotification, Conversation, ConversationMessage, UserProfile } from '../../src/types';
import { canSendConversationMessage, getRoleLandingTab, markOptimisticMessageStatus, mergeSyncedNotifications } from '../../src/utils/appCommunicationFlows';

const user = (role: UserProfile['role'], overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-1', name: 'Pessoa', role, phone: '+245 955 00 00', avatarUrl: '', ...overrides,
  neighborhood: overrides.neighborhood || 'Bissau',
});

const conversation: Conversation = {
  id: 'conversation-1', userId: 'user-1', userName: 'Pessoa', businessId: 'business-1',
  businessName: 'Empresa', subject: 'Ajuda', lastMessage: 'Olá', createdAt: '2026-01-01',
  updatedAt: '2026-01-01', unreadForUser: false, unreadForBusiness: false,
};

const notification = (id: string, createdAt: string, read = false): AppNotification => ({
  id, title: id, message: id, targetRole: 'user', category: 'system', createdAt, read,
});

const message = (clientMessageId: string, status: ConversationMessage['status']): ConversationMessage => ({
  id: `message-${clientMessageId}`, clientMessageId, conversationId: conversation.id,
  senderId: 'user-1', senderRole: 'user', text: 'Olá', createdAt: '2026-01-01', status,
});

describe('application communication flows', () => {
  it('merges synchronized notifications, preserves local entries, and orders by date', () => {
    const result = mergeSyncedNotifications(
      [notification('local', '2026-01-01T09:00:00.000Z'), notification('same', '2026-01-01T08:00:00.000Z')],
      [{ ...notification('same', '2026-01-01T10:00:00.000Z'), read: true }, notification('remote', '2026-01-01T11:00:00.000Z')],
    );
    expect(result.map((item) => item.id)).toEqual(['remote', 'same', 'local']);
    expect(result.find((item) => item.id === 'same')?.read).toBe(true);
  });

  it('preserves newer remote notification fields over stale local data', () => {
    const local = { ...notification('n-1', '2026-01-01T10:00:00.000Z'), read: false, message: 'local' };
    const remote = { ...notification('n-1', '2026-01-01T09:00:00.000Z'), read: true, message: 'server' };

    const result = mergeSyncedNotifications([local], [remote]);

    expect(result).toEqual([{ ...local, ...remote }]);
  });

  it('keeps notification synchronization bounded and idempotent', () => {
    const local = notification('same', '2026-01-01T09:00:00.000Z');
    const incoming = { ...local, read: true };
    const result = mergeSyncedNotifications([local], [incoming, incoming, notification('new', '2026-01-01T10:00:00.000Z')]);

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.id === 'same')).toMatchObject({ read: true });
    expect(result[0].id).toBe('new');
  });

  it('limits synchronized notifications to the newest 250 entries', () => {
    const notifications = Array.from({ length: 260 }, (_, index) => notification(`n-${index}`, `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`));
    const result = mergeSyncedNotifications([], notifications);

    expect(result).toHaveLength(250);
    expect(new Set(result.map((item) => item.id)).size).toBe(250);
  });

  it('authorizes only conversation participants', () => {
    expect(canSendConversationMessage(user('user'), conversation)).toBe(true);
    expect(canSendConversationMessage(user('user', { id: 'other-user' }), conversation)).toBe(false);
    expect(canSendConversationMessage(user('business', { id: 'owner', businessId: 'business-1' }), conversation)).toBe(true);
    expect(canSendConversationMessage(user('business', { id: 'owner', businessId: 'other-business' }), conversation)).toBe(false);
    expect(canSendConversationMessage(user('business', { id: 'owner' }), conversation)).toBe(false);
    expect(canSendConversationMessage(user('admin'), conversation)).toBe(false);
    expect(canSendConversationMessage(null, conversation)).toBe(false);
    expect(canSendConversationMessage(user('user'), undefined)).toBe(false);
  });

  it('keeps optimistic messages and marks the matching one failed', () => {
    const messages = [message('client-1', 'sending'), message('client-2', 'sent')];
    const result = markOptimisticMessageStatus(messages, 'client-1', 'failed');
    expect(result).toEqual([{ ...messages[0], status: 'failed' }, messages[1]]);
    expect(messages[0].status).toBe('sending');
    expect(markOptimisticMessageStatus(messages, 'missing-client-id', 'failed')).toEqual(messages);
  });

  it('maps role-based landing navigation and keeps unknown access public', () => {
    const landingTabs = {
      user: getRoleLandingTab('user'),
      business: getRoleLandingTab('business'),
      admin: getRoleLandingTab('admin'),
      anonymous: getRoleLandingTab(null),
    };

    expect(landingTabs).toEqual({ user: 'feed', business: 'client', admin: 'admin', anonymous: 'feed' });
  });
});


describe('communication polling cleanup', () => {
  it('clears the interval and closes realtime events on cleanup', async () => {
    const { startCommunicationPolling } = await import('../../src/utils/communicationPolling');
    const refresh = () => undefined;
    const close = vi.fn();
    const addEventListener = vi.fn();
    const source = { addEventListener, close };
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const stop = startCommunicationPolling(refresh, () => source, 10_000);

    expect(addEventListener).toHaveBeenCalledWith('conversation', refresh);
    expect(addEventListener).toHaveBeenCalledWith('support', refresh);
    expect(setIntervalSpy).toHaveBeenCalledWith(refresh, 10_000);

    stop();

    expect(clearIntervalSpy).toHaveBeenCalledWith(setIntervalSpy.mock.results[0]?.value);
    expect(close).toHaveBeenCalledOnce();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('still returns safe cleanup when realtime setup is unavailable', async () => {
    const { startCommunicationPolling } = await import('../../src/utils/communicationPolling');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const stop = startCommunicationPolling(() => undefined, () => { throw new Error('offline'); });

    expect(() => stop()).not.toThrow();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('refreshes from conversation and support realtime events', async () => {
    const { startCommunicationPolling } = await import('../../src/utils/communicationPolling');
    const refresh = vi.fn();
    const listeners = new Map<string, () => void>();
    const source = {
      addEventListener: (event: string, listener: () => void) => listeners.set(event, listener),
      close: vi.fn(),
    };
    const stop = startCommunicationPolling(refresh, () => source);

    listeners.get('conversation')?.();
    listeners.get('support')?.();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(source.close).not.toHaveBeenCalled();
    stop();
    expect(source.close).toHaveBeenCalledOnce();
  });

  it('makes polling cleanup safe to call more than once', async () => {
    const { startCommunicationPolling } = await import('../../src/utils/communicationPolling');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const source = { addEventListener: vi.fn(), close: vi.fn() };
    const stop = startCommunicationPolling(() => undefined, () => source);

    expect(() => {
      stop();
      stop();
    }).not.toThrow();
    expect(source.close).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    clearIntervalSpy.mockRestore();
  });
});
