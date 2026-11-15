import { databasePool } from './db';
import { randomUUID } from 'node:crypto';
import { loadJson, saveJson } from './runtimeStore';

type NotificationRecord = {
  id: string;
  userId?: string;
  category: string;
  title: string;
  message: string;
  read?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

type SupportRecord = {
  id: string;
  requesterUserId: string;
  businessId?: string;
  assignedUserId?: string;
  category: string;
  subject: string;
  description: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MemoryConversation = {
  id: string;
  user_id: string;
  business_id: string;
  subject: string;
  last_message: string;
  user_name?: string;
  created_at: string;
  updated_at: string;
  unread_for_user: boolean;
  unread_for_business: boolean;
};

type MemoryMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'user' | 'business';
  text: string;
  created_at: string;
  read_by_user: boolean;
  read_by_business: boolean;
  client_message_id?: string;
  reply_to_message_id?: string;
  message_type?: string;
  delivery_status?: string;
  attachment_name?: string;
  attachment_url?: string;
  deleted_at?: string | null;
};

type MemorySupportTicket = SupportRecord & {
  replies: Array<{ id: string; senderId: string; senderRole: string; text: string; createdAt: string }>;
};

const persistedConversations = loadJson<MemoryConversation[]>('conversations.json', []);
const persistedMessages = loadJson<MemoryMessage[]>('conversation-messages.json', []);
const persistedSupportTickets = loadJson<MemorySupportTicket[]>('support-tickets.json', []);
const persistedNotifications = loadJson<NotificationRecord[]>('notifications.json', []);

const memoryConversations = new Map<string, MemoryConversation>(
  persistedConversations.map((c) => [c.id, c])
);
const memoryMessages: MemoryMessage[] = [...persistedMessages];
const memorySupportTickets = new Map<string, MemorySupportTicket>(
  persistedSupportTickets.map((t) => [t.id, t])
);
const memoryNotifications = new Map<string, NotificationRecord>(
  persistedNotifications.map((notification) => [notification.id, notification]),
);

const persistLocalConversations = () => {
  saveJson('conversations.json', Array.from(memoryConversations.values()));
};
const persistLocalMessages = () => {
  saveJson('conversation-messages.json', memoryMessages);
};
const persistLocalSupportTickets = () => {
  saveJson('support-tickets.json', Array.from(memorySupportTickets.values()));
};
const persistLocalNotifications = () => {
  saveJson('notifications.json', Array.from(memoryNotifications.values()));
};

export async function createPostgresConversation(input: { id: string; userId: string; businessId: string; subject: string; text: string; senderId: string; senderRole: 'user' | 'business' }) {
  if (!databasePool) {
    const now = new Date().toISOString();
    const existing = Array.from(memoryConversations.values()).find((conversation) => conversation.user_id === input.userId && conversation.business_id === input.businessId);
    const conversation: MemoryConversation = existing || {
      id: input.id,
      user_id: input.userId,
      business_id: input.businessId,
      subject: input.subject,
      last_message: input.text,
      created_at: now,
      updated_at: now,
      unread_for_user: false,
      unread_for_business: true,
    };
    Object.assign(conversation, { subject: input.subject, last_message: input.text, updated_at: now, unread_for_business: true });
    memoryConversations.set(conversation.id, conversation);
    memoryMessages.push({ id: `message-${randomUUID()}`, conversation_id: conversation.id, sender_id: input.senderId, sender_role: input.senderRole, text: input.text, created_at: now, read_by_user: true, read_by_business: false });
    persistLocalConversations();
    persistLocalMessages();
    return conversation.id;
  }
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const conversation = await client.query(
      `INSERT INTO conversations (id,user_id,business_id,subject,last_message,unread_for_user,unread_for_business)
       VALUES ($1,$2,$3,$4,$5,FALSE,TRUE)
       ON CONFLICT (user_id,business_id) DO UPDATE SET subject=EXCLUDED.subject,last_message=EXCLUDED.last_message,unread_for_business=TRUE,updated_at=NOW()
       RETURNING *`,
      [input.id, input.userId, input.businessId, input.subject, input.text],
    );
    const conversationId = conversation.rows[0].id;
    await client.query(
      `INSERT INTO conversation_messages (id,conversation_id,sender_id,sender_role,text,read_by_user,read_by_business)
       VALUES ($1,$2,$3,$4,$5,TRUE,FALSE)`,
      [`message-${randomUUID()}`, conversationId, input.senderId, input.senderRole, input.text],
    );
    await client.query('COMMIT');
    return conversationId as string;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPostgresConversations(userId: string, role: 'user' | 'business' | 'admin', businessId?: string) {
  if (!databasePool) {
    const conversations = Array.from(memoryConversations.values())
      .filter((conversation) => role === 'admin' || (role === 'business' ? conversation.business_id === businessId : conversation.user_id === userId))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const ids = new Set(conversations.map((conversation) => conversation.id));
    return { conversations, messages: memoryMessages.filter((message) => ids.has(message.conversation_id)).sort((a, b) => a.created_at.localeCompare(b.created_at)) };
  }
  const condition = role === 'admin' ? 'TRUE' : role === 'business' ? 'c.business_id=$1' : 'c.user_id=$1';
  const params = role === 'business' ? [businessId || ''] : role === 'admin' ? [] : [userId];
  const conversations = await databasePool.query(
    `SELECT c.*, u.name AS user_name FROM conversations c JOIN users u ON u.id=c.user_id WHERE ${condition} ORDER BY c.updated_at DESC LIMIT 200`,
    params,
  );
  const messages = await databasePool.query(
    `SELECT m.* FROM conversation_messages m JOIN conversations c ON c.id=m.conversation_id WHERE ${role === 'admin' ? 'TRUE' : role === 'business' ? 'c.business_id=$1' : 'c.user_id=$1'} ORDER BY m.created_at ASC LIMIT 1000`,
    params,
  );
  return { conversations: conversations.rows, messages: messages.rows };
}

export async function markPostgresConversationRead(input: { conversationId: string; userId: string; role: 'user' | 'business'; businessId?: string }) {
  if (!databasePool) {
    const conversation = memoryConversations.get(input.conversationId);
    if (!conversation || (input.role === 'user' && conversation.user_id !== input.userId) || (input.role === 'business' && conversation.business_id !== input.businessId)) return false;
    if (input.role === 'user') conversation.unread_for_user = false;
    else conversation.unread_for_business = false;
    memoryMessages.filter((message) => message.conversation_id === input.conversationId).forEach((message) => {
      if (input.role === 'user') message.read_by_user = true;
      else message.read_by_business = true;
    });
    persistLocalConversations();
    persistLocalMessages();
    return true;
  }
  const field = input.role === 'user' ? 'unread_for_user' : 'unread_for_business';
  const readField = input.role === 'user' ? 'read_by_user' : 'read_by_business';
  // Cidadão e empresa usam $1 e $2: um marcador sem utilização ($2 na versão
  // antiga do ramo empresarial) fazia o Postgres abortar com 42P18.
  const access = input.role === 'user' ? 'user_id=$2' : 'business_id=$2';
  const params = input.role === 'user'
    ? [input.conversationId, input.userId]
    : [input.conversationId, input.businessId || ''];
  const result = await databasePool.query(`UPDATE conversations SET ${field}=FALSE WHERE id=$1 AND ${access} RETURNING id`, params);
  if (!result.rowCount) return false;
  await databasePool.query(`UPDATE conversation_messages SET ${readField}=TRUE WHERE conversation_id=$1`, [input.conversationId]);
  return true;
}

export async function createPostgresConversationMessage(input: { id: string; conversationId: string; senderId: string; senderRole: 'user' | 'business'; businessId?: string; text: string; clientMessageId?: string; replyToId?: string; messageType?: string; attachmentName?: string; attachmentUrl?: string }) {
  if (!databasePool) {
    const conversation = memoryConversations.get(input.conversationId);
    if (!conversation || (input.senderRole === 'user' && conversation.user_id !== input.senderId) || (input.senderRole === 'business' && conversation.business_id !== input.businessId)) throw new Error('CONVERSATION_ACCESS_DENIED');
    const now = new Date().toISOString();
    if (input.clientMessageId && memoryMessages.some((message) => message.conversation_id === input.conversationId && message.client_message_id === input.clientMessageId)) return;
    memoryMessages.push({ id: input.id, conversation_id: input.conversationId, sender_id: input.senderId, sender_role: input.senderRole, text: input.text, created_at: now, read_by_user: input.senderRole === 'user', read_by_business: input.senderRole === 'business', client_message_id: input.clientMessageId, reply_to_message_id: input.replyToId, message_type: input.messageType || 'text', delivery_status: 'delivered', attachment_name: input.attachmentName, attachment_url: input.attachmentUrl });
    Object.assign(conversation, { last_message: input.text, updated_at: now, unread_for_user: input.senderRole === 'business', unread_for_business: input.senderRole === 'user' });
    persistLocalConversations();
    persistLocalMessages();
    return;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM conversations WHERE id=$1 AND ($2='user' AND user_id=$3 OR $2='business' AND business_id=$4)`,
    [input.conversationId, input.senderRole, input.senderId, input.businessId || ''],
  );
  if (!access.rowCount) throw new Error('CONVERSATION_ACCESS_DENIED');
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO conversation_messages (id,conversation_id,sender_id,sender_role,text,read_by_user,read_by_business,client_message_id,reply_to_message_id,message_type,delivery_status,attachment_name,attachment_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (conversation_id,client_message_id) WHERE client_message_id IS NOT NULL DO NOTHING`,
      [input.id, input.conversationId, input.senderId, input.senderRole, input.text, input.senderRole === 'user', input.senderRole === 'business', input.clientMessageId || null, input.replyToId || null, input.messageType || 'text', 'delivered', input.attachmentName || null, input.attachmentUrl || null],
    );
    await client.query(
      `UPDATE conversations SET last_message=$1,updated_at=NOW(),unread_for_user=$2,unread_for_business=$3 WHERE id=$4`,
      [input.text, input.senderRole === 'business', input.senderRole === 'user', input.conversationId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function persistPostgresNotification(notification: NotificationRecord): Promise<void> {
  if (!databasePool) {
    const existing = memoryNotifications.get(notification.id);
    memoryNotifications.set(notification.id, {
      ...existing,
      ...notification,
      read: existing?.read || notification.read || false,
    });
    persistLocalNotifications();
    return;
  }
  await databasePool.query(
    `INSERT INTO notifications (id,user_id,category,title,message,read_at,metadata,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,message=EXCLUDED.message,read_at=EXCLUDED.read_at,metadata=EXCLUDED.metadata`,
    [notification.id, notification.userId, notification.category, notification.title, notification.message, notification.read ? new Date().toISOString() : null, JSON.stringify(notification.metadata || {}), notification.createdAt || new Date().toISOString()],
  );
}

export async function persistPostgresSupportTicket(ticket: SupportRecord): Promise<void> {
  if (!databasePool) {
    const now = ticket.createdAt || new Date().toISOString();
    const existing = memorySupportTickets.get(ticket.id);
    memorySupportTickets.set(ticket.id, {
      ...ticket,
      createdAt: now,
      updatedAt: ticket.updatedAt || now,
      replies: existing ? existing.replies : [],
    });
    persistLocalSupportTickets();
    return;
  }
  await databasePool.query(
    `INSERT INTO support_tickets (id,requester_user_id,assigned_user_id,business_id,category,subject,description,status,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET assigned_user_id=EXCLUDED.assigned_user_id,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
    [ticket.id, ticket.requesterUserId, ticket.assignedUserId || null, ticket.businessId || null, ticket.category, ticket.subject, ticket.description, ticket.status || 'open', ticket.createdAt || new Date().toISOString(), ticket.updatedAt || new Date().toISOString()],
  );
}

export async function listPostgresSupportTickets(userId: string, role: 'user' | 'business' | 'admin', businessId?: string) {
  if (!databasePool) {
    return Array.from(memorySupportTickets.values())
      .filter((ticket) => role === 'admin' || (role === 'business' ? ticket.businessId === businessId : ticket.requesterUserId === userId))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  const where = role === 'admin' ? 'TRUE' : role === 'business' ? 's.business_id=$1' : 's.requester_user_id=$1';
  const params = role === 'business' ? [businessId || ''] : role === 'admin' ? [] : [userId];
  const result = await databasePool.query(
    `SELECT s.*, COALESCE(json_agg(json_build_object('id',r.id,'senderId',r.sender_user_id,'senderRole',r.sender_role,'text',r.text,'createdAt',r.created_at) ORDER BY r.created_at) FILTER (WHERE r.id IS NOT NULL),'[]') AS replies
     FROM support_tickets s LEFT JOIN support_replies r ON r.support_ticket_id=s.id
     WHERE ${where} GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 200`,
    params,
  );
  return result.rows;
}

/**
 * Verifica, no servidor, se a sessão pode responder ao pedido de suporte.
 * É chamado antes de validar o corpo para que a recusa seja sempre 403.
 */
export async function canAccessSupportTicket(ticketId: string, senderId: string, senderRole: 'user' | 'business' | 'admin', businessId?: string): Promise<boolean> {
  if (!databasePool) {
    const ticket = memorySupportTickets.get(ticketId);
    if (!ticket) return false;
    if (senderRole === 'admin') return true;
    if (senderRole === 'user') return ticket.requesterUserId === senderId;
    return Boolean(businessId) && ticket.businessId === businessId;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM support_tickets WHERE id=$1 AND ($2='admin' OR ($2='user' AND requester_user_id=$3) OR ($2='business' AND business_id=$4))`,
    [ticketId, senderRole, senderId, businessId || ''],
  );
  return Boolean(access.rowCount);
}

export async function createPostgresSupportReply(input: { id: string; ticketId: string; senderId: string; senderRole: 'user' | 'business' | 'admin'; businessId?: string; text: string; status?: string }) {
  if (!databasePool) {
    const ticket = memorySupportTickets.get(input.ticketId);
    if (!ticket || (input.senderRole === 'user' && ticket.requesterUserId !== input.senderId) || (input.senderRole === 'business' && ticket.businessId !== input.businessId)) throw new Error('SUPPORT_ACCESS_DENIED');
    const now = new Date().toISOString();
    ticket.replies.push({ id: input.id, senderId: input.senderId, senderRole: input.senderRole, text: input.text, createdAt: now });
    ticket.updatedAt = now;
    if (input.status) ticket.status = input.status;
    persistLocalSupportTickets();
    return;
  }
  const access = await databasePool.query(
    `SELECT 1 FROM support_tickets WHERE id=$1 AND ($2='admin' OR ($2='user' AND requester_user_id=$3) OR ($2='business' AND business_id=$4))`,
    [input.ticketId, input.senderRole, input.senderId, input.businessId || ''],
  );
  if (!access.rowCount) throw new Error('SUPPORT_ACCESS_DENIED');
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO support_replies (id,support_ticket_id,sender_user_id,sender_role,text)
       VALUES ($1,$2,$3,$4,$5)`,
      [input.id, input.ticketId, input.senderId, input.senderRole, input.text],
    );
    await client.query(
      `UPDATE support_tickets SET status=COALESCE($1,status),updated_at=NOW() WHERE id=$2`,
      [input.status || null, input.ticketId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePostgresSupportStatus(ticketId: string, status: string): Promise<boolean> {
  if (!databasePool) {
    const ticket = memorySupportTickets.get(ticketId);
    if (!ticket) return false;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    persistLocalSupportTickets();
    return true;
  }
  const result = await databasePool.query(
    `UPDATE support_tickets SET status=$1, updated_at=NOW() WHERE id=$2`,
    [status, ticketId]
  );
  return (result.rowCount ?? 0) > 0;
}

export type CommunicationParticipants = { userId: string | null; businessId: string | null };

/**
 * Participantes reais de uma conversa: quem pode receber sinais de tempo real
 * sobre ela. Devolve `null` quando a conversa não existe.
 */
export async function getConversationParticipants(conversationId: string): Promise<CommunicationParticipants | null> {
  if (!databasePool) {
    const conversation = memoryConversations.get(conversationId);
    return conversation ? { userId: conversation.user_id, businessId: conversation.business_id || null } : null;
  }
  const result = await databasePool.query('SELECT user_id, business_id FROM conversations WHERE id=$1', [conversationId]);
  const row = result.rows[0];
  return row ? { userId: row.user_id as string, businessId: (row.business_id as string) || null } : null;
}

/** Participantes reais de um pedido de suporte. */
export async function getSupportTicketParticipants(ticketId: string): Promise<CommunicationParticipants | null> {
  if (!databasePool) {
    const ticket = memorySupportTickets.get(ticketId);
    return ticket ? { userId: ticket.requesterUserId, businessId: ticket.businessId || null } : null;
  }
  const result = await databasePool.query('SELECT requester_user_id, business_id FROM support_tickets WHERE id=$1', [ticketId]);
  const row = result.rows[0];
  return row ? { userId: row.requester_user_id as string, businessId: (row.business_id as string) || null } : null;
}

export async function listPostgresNotifications(userId: string): Promise<unknown[]> {
  if (!databasePool) {
    return Array.from(memoryNotifications.values())
      .filter((notification) => notification.userId === userId)
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
      .slice(0, 100);
  }
  const result = await databasePool.query(
    `SELECT id,category,title,message,read_at AS "readAt",metadata,created_at AS "createdAt"
     FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [userId],
  );
  return result.rows;
}

export async function markPostgresNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  if (!databasePool) {
    const notification = memoryNotifications.get(notificationId);
    if (!notification || notification.userId !== userId) return false;
    memoryNotifications.set(notificationId, { ...notification, read: true });
    persistLocalNotifications();
    return true;
  }
  const result = await databasePool.query(
    `UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2`,
    [notificationId, userId],
  );
  return result.rowCount === 1;
}
