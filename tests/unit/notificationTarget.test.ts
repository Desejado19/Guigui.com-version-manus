import { describe, expect, it } from 'vitest';
import type { AppNotification } from '../../src/types';
import { focusKeyForTarget, resolveNotificationTarget } from '../../src/utils/notificationTarget';

function notification(partial: Partial<AppNotification>): AppNotification {
  return {
    id: 'notif-1',
    title: 'Aviso',
    message: 'Mensagem',
    targetRole: 'user',
    category: 'system',
    read: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('resolveNotificationTarget', () => {
  it('abre o bilhete/compra correspondente', () => {
    const target = resolveNotificationTarget(notification({
      category: 'order_redemption',
      metadata: { ticketDestination: 'my-tickets', orderId: 'ORD-1', ticketId: 'TCK-1' },
    }), 'user');
    expect(target).toMatchObject({ tab: 'client', clientSection: 'tickets', entity: { kind: 'order', id: 'ORD-1' } });
    expect(focusKeyForTarget(target)).toBe('order');
  });

  it('abre o pedido de suporte, não a página inicial', () => {
    const target = resolveNotificationTarget(notification({
      category: 'support',
      metadata: { supportId: 'SUP-123' },
    }), 'user');
    expect(target.tab).toBe('support');
    expect(target.entity).toEqual({ kind: 'support', id: 'SUP-123' });
  });

  it('abre a conversa de mensagens', () => {
    const target = resolveNotificationTarget(notification({
      category: 'messages',
      metadata: { conversationId: 'CON-9' },
    }), 'user');
    expect(target.tab).toBe('messages');
    expect(focusKeyForTarget(target)).toBe('conversation');
  });

  it('abre o evento quando a notificação é de alteração de evento', () => {
    const target = resolveNotificationTarget(notification({
      category: 'event',
      entityType: 'event',
      entityId: 'EVT-7',
    }), 'user');
    expect(target.tab).toBe('events');
    expect(target.entity).toEqual({ kind: 'event', id: 'EVT-7' });
  });

  it('distingue o painel de empresa e o administrativo', () => {
    const base = notification({ category: 'support', metadata: { supportId: 'SUP-1' } });
    expect(resolveNotificationTarget(base, 'business')).toMatchObject({ tab: 'client', clientSection: 'support' });
    expect(resolveNotificationTarget(base, 'admin')).toMatchObject({ tab: 'admin', adminTab: 'support' });
  });

  it('aceita chaves alternativas usadas pelo servidor', () => {
    const target = resolveNotificationTarget(notification({
      metadata: { conversation_id: 'CON-ALT', eventType: 'NEW_MESSAGE' },
    }), 'user');
    expect(target.entity.id).toBe('CON-ALT');
  });

  it('cai numa secção temática quando não há registo concreto', () => {
    const target = resolveNotificationTarget(notification({ category: 'security' }), 'user');
    expect(target.tab).toBe('client');
    expect(target.entity.kind).toBe('none');
  });
});
