import type { AppNotification, Conversation, ConversationMessage, PurchaseOrder, SupportReply, SupportRequest, UserRole } from '../types';
export const syncPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  const response = await fetch('/api/orders');
  if (!response.ok) throw new Error(`Não foi possível sincronizar pedidos (${response.status}).`);
  const payload = await response.json() as Array<Record<string, unknown>>;
  return payload.map((item) => ({
    id: String(item.id), orderCode: String(item.orderCode || ''), qrToken: String(item.qrToken || ''),
    businessId: String(item.businessId || 'biz-1'), businessName: String(item.businessName || ''),
    buyerId: item.buyerId ? String(item.buyerId) : undefined, eventId: item.eventId ? String(item.eventId) : undefined,
    ticketPin: item.ticketPin ? String(item.ticketPin) : '', itemType: String(item.itemType || 'ticket') as PurchaseOrder['itemType'],
    itemTitle: String(item.itemTitle || ''), quantity: Number(item.quantity || 1), totalPriceXOF: Number(item.totalPriceXOF || 0),
    paymentMethod: String(item.paymentMethod || 'orange_money'), purchasedAt: String(item.purchasedAt || new Date().toISOString()),
    status: String(item.status || 'pending') as PurchaseOrder['status'],
    redeemedAt: item.redeemedAt ? String(item.redeemedAt) : undefined,
    redeemedBy: item.redeemedBy ? String(item.redeemedBy) : undefined,
    customerName: String(item.customerName || ''), customerPhone: String(item.customerPhone || ''),
  }));
};

export type NotificationSyncResult =
  | { kind: 'unauthorized' }
  | { kind: 'updated'; notifications: AppNotification[] };

export type CommunicationSyncResult =
  | { kind: 'unauthorized' }
  | { kind: 'updated'; conversations: Conversation[]; messages: ConversationMessage[]; supportRequests: SupportRequest[] };

const RECIPIENT_TYPE_BY_ROLE: Record<UserRole, NonNullable<AppNotification['recipientType']>> = {
  user: 'USER',
  business: 'BUSINESS',
  admin: 'ADMIN',
};

export async function syncUserNotifications(userId: string, role: UserRole = 'user'): Promise<NotificationSyncResult> {
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
      // Compra de bilhete: o destino "Meus bilhetes" é explícito no metadata e
      // sobrevive a qualquer recarregamento do centro de notificações.
      const isTicketPurchase = metadata.ticketDestination === 'my-tickets';
      const declaredEntityType = typeof metadata.entityType === 'string' ? metadata.entityType : undefined;
      const declaredEntityId = typeof metadata.entityId === 'string' ? metadata.entityId : undefined;
      const ticketEntityId = typeof metadata.ticketId === 'string'
        ? metadata.ticketId
        : typeof metadata.transactionId === 'string' ? metadata.transactionId : declaredEntityId;
      return {
        id: String(notification.id), title: String(notification.title || ''), message: String(notification.message || ''),
        category: String(notification.category || 'system') as AppNotification['category'],
        targetRole: role,
        targetUserId: role === 'user' ? userId : undefined,
        targetBusinessId: role === 'business' && typeof metadata.businessId === 'string' ? metadata.businessId : undefined,
        recipientId: userId, recipientType: RECIPIENT_TYPE_BY_ROLE[role],
        // O tipo de entidade vem do servidor quando existe; forçar 'ticket' fazia
        // com que respostas de suporte e mensagens abrissem os bilhetes.
        entityType: ((isTicketPurchase ? 'ticket' : declaredEntityType) as AppNotification['entityType']),
        entityId: isTicketPurchase ? ticketEntityId : declaredEntityId,
        eventType: (typeof metadata.eventType === 'string' ? metadata.eventType : undefined) as AppNotification['eventType'],
        priority: (typeof metadata.priority === 'string' ? metadata.priority : undefined) as AppNotification['priority'],
        read: notification.read === true || Boolean(notification.readAt), createdAt: String(notification.createdAt || new Date().toISOString()),
        linkTab: typeof metadata.linkTab === 'string' ? metadata.linkTab : isTicketPurchase ? 'client' : undefined,
        actionLabel: typeof metadata.actionLabel === 'string'
          ? metadata.actionLabel
          : isTicketPurchase ? 'Meus bilhetes' : undefined,
        metadata,
      };
    }),
  };
}

export async function syncCommunicationData(role: UserRole): Promise<CommunicationSyncResult> {
  // Todos os perfis, incluindo a administração, pedem os dados reais: antes o
  // admin recebia listas vazias fixas e por isso nunca via os pedidos de suporte
  // dos cidadãos nem as conversas da plataforma.
  let conversationResponse: Response;
  try {
    conversationResponse = await fetch('/api/conversations');
  } catch (error) {
    const next = (error as { status?: number })?.status;
    if (next === 401 || next === 403) return { kind: 'unauthorized' };
    // Preservar a causa: quem faz polling precisa da mensagem original
    // (ex.: 'network offline') para decidir se volta a tentar.
    throw new Error(`Não foi possível sincronizar a comunicação: ${(error as Error)?.message ?? String(error)}`);
  }
  let supportResponse: Response;
  try {
    supportResponse = await fetch('/api/support/tickets/mine');
  } catch (error) {
    const next = (error as { status?: number })?.status;
    if (next === 401 || next === 403) return { kind: 'unauthorized' };
    // Preservar a causa: quem faz polling precisa da mensagem original
    // (ex.: 'network offline') para decidir se volta a tentar.
    throw new Error(`Não foi possível sincronizar a comunicação: ${(error as Error)?.message ?? String(error)}`);
  }
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
      clientMessageId: item.client_message_id ? String(item.client_message_id) : undefined,
      senderRole: String(item.sender_role) as ConversationMessage['senderRole'], text: String(item.text), createdAt: String(item.created_at),
      readByUser: Boolean(item.read_by_user), readByBusiness: Boolean(item.read_by_business),
      type: item.message_type ? String(item.message_type) as ConversationMessage['type'] : undefined,
      status: item.delivery_status ? String(item.delivery_status) as ConversationMessage['status'] : undefined,
      replyToId: item.reply_to_message_id ? String(item.reply_to_message_id) : undefined,
      attachmentName: item.attachment_name ? String(item.attachment_name) : undefined,
      attachmentUrl: item.attachment_url ? String(item.attachment_url) : undefined,
    })),
    supportRequests: (supportPayload.tickets || []).map((item) => ({
      ...item, requesterId: String(item.requester_user_id || item.requesterUserId || item.requesterId || ''),
      // Quem lê pode ser a administração: o papel do requerente vem do pedido
      // (empresa quando tem `business_id`), nunca do perfil de quem consulta.
      requesterRole: String(
        item.requester_role
        || item.requesterRole
        || (item.business_id || item.businessId ? 'business' : 'user'),
      ) as SupportRequest['requesterRole'],
      businessId: item.business_id ? String(item.business_id) : item.businessId ? String(item.businessId) : undefined,
      createdAt: String(item.created_at || item.createdAt), updatedAt: String(item.updated_at || item.updatedAt),
      status: String(item.status) as SupportRequest['status'], replies: (item.replies || []) as SupportReply[],
    })) as SupportRequest[],
  };
}
