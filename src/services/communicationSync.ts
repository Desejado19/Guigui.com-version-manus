import type { AppNotification, Conversation, ConversationMessage, SupportReply, SupportRequest, UserRole } from '../types';

export type NotificationSyncResult =
  | { kind: 'unauthorized' }
  | { kind: 'updated'; notifications: AppNotification[] };

export type CommunicationSyncResult =
  | { kind: 'unauthorized' }
  | { kind: 'updated'; conversations: Conversation[]; messages: ConversationMessage[]; supportRequests: SupportRequest[] };

export async function syncUserNotifications(userId: string): Promise<NotificationSyncResult> {
  const response = await fetch('/api/notifications');
  if (response.status === 401) return { kind: 'unauthorized' };
  if (!response.ok) throw new Error(`Não foi possível sincronizar notificações (${response.status}).`);
  const payload = await response.json() as Array<Record<string, unknown>>;
  if (!Array.isArray(payload)) return { kind: 'updated', notifications: [] };
  return {
    kind: 'updated',
    notifications: payload.map((notification) => {
      const metadata = typeof notification.metadata === 'object' && notification.metadata
        ? notification.metadata as Record<string, unknown>
        : {};
      const isTicketPurchase = metadata.ticketDestination === 'my-tickets';
      return {
        id: String(notification.id), title: String(notification.title || ''), message: String(notification.message || ''),
        category: String(notification.category || 'system') as AppNotification['category'], targetRole: 'user', targetUserId: userId,
        recipientId: userId, recipientType: 'USER', entityType: 'ticket' as AppNotification['entityType'],
        entityId: typeof metadata.ticketId === 'string' ? metadata.ticketId : undefined,
        eventType: 'TICKET_PURCHASED', read: notification.read === true || Boolean(notification.readAt), createdAt: String(notification.createdAt || new Date().toISOString()),
        linkTab: isTicketPurchase ? 'client' as const : undefined,
        actionLabel: isTicketPurchase ? 'Meus bilhetes' : undefined,
        metadata,
      };
    }),
  };
}

export async function syncCommunicationData(role: UserRole): Promise<CommunicationSyncResult> {
  const conversationFetch = role === 'admin' 
    ? Promise.resolve({ ok: true, status: 200, json: async () => ({ conversations: [], messages: [] }) })
    : fetch('/api/conversations');
  const [conversationResponse, supportResponse] = await Promise.all([conversationFetch, fetch('/api/support/tickets/mine')]);
  if (conversationResponse.status === 401 || supportResponse.status === 401) return { kind: 'unauthorized' };
  if (!conversationResponse.ok || !supportResponse.ok) throw new Error('Não foi possível sincronizar a comunicação.');
  const conversationPayload = await conversationResponse.json() as { conversations?: Array<Record<string, unknown>>; messages?: Array<Record<string, unknown>> };
  const supportPayload = await supportResponse.json() as { tickets?: Array<Record<string, unknown>> };
  return {
    kind: 'updated',
    conversations: (conversationPayload.conversations || []).map((item) => ({
      id: String(item.id), userId: String(item.user_id), userName: String(item.user_name || ''), businessId: String(item.business_id),
      subject: String(item.subject), lastMessage: String(item.last_message || ''), createdAt: String(item.created_at), updatedAt: String(item.updated_at),
      unreadForUser: Boolean(item.unread_for_user), unreadForBusiness: Boolean(item.unread_for_business),
    })),
    messages: (conversationPayload.messages || []).map((item) => ({
      id: String(item.id), conversationId: String(item.conversation_id), senderId: String(item.sender_id),
      senderRole: String(item.sender_role) as ConversationMessage['senderRole'], text: String(item.text), createdAt: String(item.created_at),
      readByUser: Boolean(item.read_by_user), readByBusiness: Boolean(item.read_by_business),
    })),
    supportRequests: (supportPayload.tickets || []).map((item) => ({
      ...item, requesterId: String(item.requester_user_id || item.requesterUserId || item.requesterId || ''),
      requesterRole: String(item.requester_role || item.requesterRole || role) as SupportRequest['requesterRole'],
      businessId: item.business_id ? String(item.business_id) : item.businessId ? String(item.businessId) : undefined,
      createdAt: String(item.created_at || item.createdAt), updatedAt: String(item.updated_at || item.updatedAt),
      status: String(item.status) as SupportRequest['status'], replies: (item.replies || []) as SupportReply[],
    })) as SupportRequest[],
  };
}
