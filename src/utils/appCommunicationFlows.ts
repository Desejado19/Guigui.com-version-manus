import type { AppNotification, Conversation, ConversationMessage, UserProfile } from '../types';

export const mergeSyncedNotifications = (
  previous: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] => {
  const byId = new Map(previous.map((notification) => [notification.id, notification]));
  incoming.forEach((notification) => {
    byId.set(notification.id, { ...byId.get(notification.id), ...notification });
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
