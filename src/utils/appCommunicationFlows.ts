import type { AppNotification, Conversation, ConversationMessage, PurchaseOrder, SupportRequest, UserProfile } from '../types';
import { normalizeNotification } from '../services/notificationService';
export const mergeConversations = (
  previous: Conversation[],
  incoming: Conversation[],
): Conversation[] => {
  const byId = new Map(previous.map((conversation) => [conversation.id, conversation]));
  incoming.forEach((conversation) => byId.set(conversation.id, conversation));
  return Array.from(byId.values())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 250);
};
export const mergeConversationMessages = (
  previous: ConversationMessage[],
  incoming: ConversationMessage[],
): ConversationMessage[] => {
  const byId = new Map(previous.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 1000);
};
export const mergeSupportRequests = (
  previous: SupportRequest[],
  incoming: SupportRequest[],
): SupportRequest[] => {
  const byId = new Map(previous.map((request) => [request.id, request]));
  incoming.forEach((request) => byId.set(request.id, request));
  return Array.from(byId.values())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 250);
};

export const mergeSyncedNotifications = (
  previous: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] => {
  const byId = new Map<string, AppNotification>();
  previous.forEach((notification) => {
    const normalized = normalizeNotification(notification);
    byId.set(normalized.id, normalized);
  });
  incoming.forEach((notification) => {
    const normalized = normalizeNotification(notification);
    byId.set(normalized.id, { ...byId.get(normalized.id), ...normalized });
  });
  return Array.from(byId.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 250);
};
export const canSendConversationMessage = (
  user: UserProfile | null,
  conversation: Conversation | undefined,
): boolean => {
  if (!user || !conversation || (user.role !== 'user' && user.role !== 'business')) return false;
  return (user.role === 'user' && conversation.userId === user.id)
    || (user.role === 'business' && conversation.businessId === user.businessId);
};
export const markOptimisticMessageStatus = (
  messages: ConversationMessage[],
  clientMessageId: string,
  status: ConversationMessage['status'],
): ConversationMessage[] => messages.map((message) => (
  message.clientMessageId === clientMessageId ? { ...message, status } : message
));
export const getRoleLandingTab = (role: UserProfile['role'] | null): 'feed' | 'client' | 'admin' => {
  if (role === 'business') return 'client';
  if (role === 'admin') return 'admin';
  return 'feed';
};
export const mergePurchaseOrders = (
  previous: PurchaseOrder[],
  incoming: PurchaseOrder[],
): PurchaseOrder[] => {
  const byId = new Map(previous.map((order) => [order.id, order]));
  incoming.forEach((order) => byId.set(order.id, order));
  return Array.from(byId.values())
    .sort((left, right) => right.purchasedAt.localeCompare(left.purchasedAt))
    .slice(0, 250);
};
