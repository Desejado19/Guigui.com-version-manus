import type { AppNotification, UserRole } from '../types';

/**
 * Resolvedor único de destino das notificações (deep linking).
 *
 * A mesma função serve cidadão, empresa e administração. Antes desta camada,
 * cada sítio (sino, centro de notificações, painel do cidadão) decidia o
 * destino à sua maneira e as notificações carregadas da base de dados — que só
 * transportam `metadata` — caíam sempre na área genérica. Aqui a decisão é
 * tomada uma única vez, a partir da notificação completa.
 */

export type NotificationTab =
  | 'feed'
  | 'directory'
  | 'map'
  | 'promotions'
  | 'events'
  | 'scanner'
  | 'client'
  | 'messages'
  | 'support'
  | 'admin'
  | 'institutional';

export type NotificationClientSection = 'overview' | 'support' | 'tickets';

export type NotificationEntityKind =
  | 'order'
  | 'ticket'
  | 'payment'
  | 'refund'
  | 'event'
  | 'post'
  | 'conversation'
  | 'support'
  | 'none';

export interface NotificationTarget {
  /** Ecrã principal a abrir. */
  tab: NotificationTab;
  /** Secção interna do painel do cidadão, quando aplicável. */
  clientSection: NotificationClientSection;
  /** Ecrã interno do painel administrativo, quando aplicável. */
  adminTab?: 'support' | 'notifications' | 'overview';
  /** Registo concreto que originou a notificação. */
  entity: {
    kind: NotificationEntityKind;
    id: string | null;
  };
}

const EMPTY: NotificationTarget['entity'] = { kind: 'none', id: null };

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function firstText(metadata: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = text(metadata[key]);
    if (candidate) return candidate;
  }
  return undefined;
}

/**
 * Chaves de `metadata` onde o identificador de cada entidade pode aparecer.
 * Os produtores de notificações no servidor usam nomes diferentes; aceitá-los
 * todos evita notificações sem destino por causa de uma chave alternativa.
 */
const ENTITY_KEYS: Record<Exclude<NotificationEntityKind, 'none'>, string[]> = {
  order: ['orderId', 'order_id', 'purchaseId', 'transactionId'],
  ticket: ['ticketId', 'ticket_id', 'ticketCode', 'transactionId'],
  payment: ['paymentId', 'payment_id', 'transactionId'],
  refund: ['refundId', 'refund_id', 'refundRequestId'],
  event: ['eventId', 'event_id'],
  post: ['postId', 'post_id'],
  conversation: ['conversationId', 'conversation_id', 'threadId'],
  support: ['supportId', 'support_id', 'ticketRef', 'reference'],
};

/** `entityType` do bilhete de notificação → tipo de destino. */
function kindFromEntityType(entityType: AppNotification['entityType']): NotificationEntityKind {
  switch (entityType) {
    case 'event':
      return 'event';
    case 'post':
      return 'post';
    case 'conversation':
      return 'conversation';
    case 'support':
      return 'support';
    case 'ticket':
      return 'ticket';
    case 'payment':
      return 'payment';
    case 'order':
      return 'order';
    case 'business':
      return 'order';
    default:
      return 'none';
  }
}

/**
 * Categorias que só fazem sentido na área pessoal, mesmo quando a notificação
 * não traz identificador nenhum (segurança, conta, faturação).
 */
const CATEGORY_TAB: Partial<Record<AppNotification['category'], NotificationTarget>> = {
  security: { tab: 'client', clientSection: 'overview', entity: EMPTY },
  account: { tab: 'client', clientSection: 'overview', entity: EMPTY },
  billing: { tab: 'client', clientSection: 'tickets', entity: EMPTY },
  order_redemption: { tab: 'client', clientSection: 'tickets', entity: EMPTY },
  event_reminder: { tab: 'events', clientSection: 'overview', entity: EMPTY },
  event: { tab: 'events', clientSection: 'overview', entity: EMPTY },
  promotion: { tab: 'promotions', clientSection: 'overview', entity: EMPTY },
  review: { tab: 'feed', clientSection: 'overview', entity: EMPTY },
  moderation: { tab: 'client', clientSection: 'overview', entity: EMPTY },
  business_approval: { tab: 'client', clientSection: 'overview', entity: EMPTY },
  stats: { tab: 'client', clientSection: 'overview', entity: EMPTY },
  system: { tab: 'client', clientSection: 'overview', entity: EMPTY },
  admin_alert: { tab: 'admin', clientSection: 'overview', entity: EMPTY },
};

function tabFromLinkTab(linkTab: string | undefined): NotificationTab | undefined {
  switch (linkTab) {
    case 'feed':
    case 'directory':
    case 'map':
    case 'promotions':
    case 'events':
    case 'scanner':
    case 'client':
    case 'messages':
    case 'support':
    case 'admin':
    case 'institutional':
      return linkTab;
    default:
      return undefined;
  }
}

/**
 * Resolve o destino de uma notificação.
 *
 * A ordem importa: primeiro o registo concreto (é o que o utilizador espera ao
 * clicar), depois a área temática, e só no fim o `linkTab`/categoria genéricos.
 */
export function resolveNotificationTarget(
  notification: AppNotification,
  role: UserRole,
): NotificationTarget {
  const metadata: Record<string, unknown> = notification.metadata ?? {};
  const isAdmin = role === 'admin';
  const adminArea: Pick<NotificationTarget, 'tab' | 'adminTab'> = { tab: 'admin', adminTab: 'overview' };

  const entityIdByKind = (kind: Exclude<NotificationEntityKind, 'none'>): string | null => {
    const fromMetadata = firstText(metadata, ENTITY_KEYS[kind]);
    if (fromMetadata) return fromMetadata;
    const declared = kindFromEntityType(notification.entityType);
    if (declared === kind && text(notification.entityId)) return String(notification.entityId);
    return null;
  };

  // 1. Suporte: resposta da administração, pedido novo, alteração de estado.
  const supportId = entityIdByKind('support');
  if (supportId) {
    if (isAdmin) return { tab: 'admin', adminTab: 'support', clientSection: 'overview', entity: { kind: 'support', id: supportId } };
    if (role === 'business') return { tab: 'client', adminTab: undefined, clientSection: 'support', entity: { kind: 'support', id: supportId } };
    return { tab: 'support', clientSection: 'support', entity: { kind: 'support', id: supportId } };
  }

  // 2. Mensagens: conversa cidadão ↔ empresa.
  const conversationId = entityIdByKind('conversation');
  if (conversationId) {
    if (isAdmin) return { ...adminArea, clientSection: 'overview', entity: { kind: 'conversation', id: conversationId } };
    return {
      tab: role === 'business' ? 'client' : 'messages',
      clientSection: 'overview',
      entity: { kind: 'conversation', id: conversationId },
    };
  }

  // 3. Bilhetes e compras.
  const ticketDestination = metadata.ticketDestination === 'my-tickets';
  const orderId = entityIdByKind('order');
  const ticketId = entityIdByKind('ticket');
  if (ticketDestination || orderId || ticketId) {
    const id = orderId || ticketId;
    if (isAdmin) return { ...adminArea, clientSection: 'overview', entity: { kind: 'order', id } };
    // O foco é a compra (kind `order`): usar o ticket como id procuraria um
    // registo de outro domínio e não abria a compra correspondente.
    return { tab: 'client', clientSection: 'tickets', entity: { kind: 'order', id: orderId || ticketId } };
  }

  // 4. Evento concreto.
  const eventId = entityIdByKind('event');
  if (eventId) {
    return {
      tab: isAdmin ? 'admin' : 'events',
      adminTab: isAdmin ? 'overview' : undefined,
      clientSection: 'overview',
      entity: { kind: 'event', id: eventId },
    };
  }

  // 5. Publicação do feed.
  const postId = entityIdByKind('post');
  if (postId) {
    return {
      tab: 'feed',
      clientSection: 'overview',
      entity: { kind: 'post', id: postId },
    };
  }

  // 6. Pagamento ou reembolso sem pedido associado (financeiro da empresa/admin).
  const paymentId = entityIdByKind('payment');
  const refundId = entityIdByKind('refund');
  if (paymentId || refundId) {
    if (isAdmin) return { ...adminArea, clientSection: 'overview', entity: { kind: paymentId ? 'payment' : 'refund', id: paymentId || refundId } };
    if (role === 'business') return { tab: 'client', clientSection: 'tickets', entity: { kind: paymentId ? 'payment' : 'refund', id: paymentId || refundId } };
    return { tab: 'client', clientSection: 'tickets', entity: { kind: paymentId ? 'payment' : 'refund', id: paymentId || refundId } };
  }

  // 7. Área temática indicada pela própria notificação.
  if (isAdmin) {
    const linkTab = tabFromLinkTab(notification.linkTab);
    return {
      tab: 'admin',
      adminTab: notification.category === 'support' ? 'support' : linkTab === 'admin' ? 'overview' : 'overview',
      clientSection: 'overview',
      entity: EMPTY,
    };
  }

  // Categorias de mensagens/suporte sem identificador: abrir o canal certo.
  if (notification.category === 'messages') {
    return { tab: role === 'business' ? 'client' : 'messages', clientSection: 'overview', entity: EMPTY };
  }
  if (notification.category === 'support') {
    return {
      tab: role === 'business' ? 'client' : 'support',
      clientSection: 'support',
      entity: EMPTY,
    };
  }

  const categoryTarget = CATEGORY_TAB[notification.category];
  if (categoryTarget) {
    if (role === 'business' && categoryTarget.tab === 'events') {
      return { tab: 'client', clientSection: 'overview', entity: EMPTY };
    }
    return { ...categoryTarget, entity: EMPTY };
  }

  const linkTab = tabFromLinkTab(notification.linkTab);
  if (linkTab) {
    return {
      tab: linkTab,
      clientSection: 'overview',
      entity: EMPTY,
    };
  }

  return { tab: role === 'business' ? 'client' : 'feed', clientSection: 'overview', entity: EMPTY };
}

/** Identificador legível para a coleção local que deve conter a entidade. */
export function focusKeyForTarget(target: NotificationTarget): 'order' | 'event' | 'post' | 'conversation' | 'support' | null {
  if (!target.entity.id) return null;
  switch (target.entity.kind) {
    case 'order':
    case 'ticket':
    case 'payment':
    case 'refund':
      return 'order';
    case 'event':
      return 'event';
    case 'post':
      return 'post';
    case 'conversation':
      return 'conversation';
    case 'support':
      return 'support';
    default:
      return null;
  }
}

/**
 * Mensagem apresentada quando o registo da notificação já não existe ou deixou
 * de estar acessível (apagado, arquivado, sem autorização).
 */
export function unavailableEntityMessage(kind: NotificationEntityKind): string {
  switch (kind) {
    case 'order':
    case 'ticket':
    case 'payment':
    case 'refund':
      return 'O bilhete ou compra desta notificação já não está disponível para a sua conta. Consulte o histórico em Meus bilhetes.';
    case 'event':
      return 'O evento desta notificação já não está publicado.';
    case 'post':
      return 'A publicação desta notificação já não está disponível.';
    case 'conversation':
      return 'A conversa desta notificação já não está disponível para a sua conta.';
    case 'support':
      return 'O pedido de suporte desta notificação já não está disponível para a sua conta.';
    default:
      return 'O conteúdo desta notificação já não está disponível.';
  }
}
