import {
  AppNotification,
  NotificationCategory,
  NotificationChannel,
  NotificationEventType,
  NotificationPreferences,
  NotificationPreferencesStore,
  NotificationPriority,
  NotificationRecipientType,
  NotificationTargetRole,
  UserRole,
  Language,
} from '../types';

export interface NotificationContext {
  role: UserRole;
  userId?: string;
  businessId?: string;
}

export interface NotificationEventInput {
  eventType: NotificationEventType;
  userId?: string;
  userName?: string;
  requesterName?: string;
  businessId?: string;
  businessName?: string;
  eventId?: string;
  eventTitle?: string;
  ticketId?: string;
  paymentId?: string;
  entityId?: string;
  entityType?: AppNotification['entityType'];
  message?: string;
  /** Preferred language of the recipient (user language takes precedence over request language). */
  language?: Language;
  userLanguage?: Language;
  metadata?: Record<string, unknown>;
}

type NotificationCopy = { title: string; message: string };
const NOTIFICATION_COPY: Record<Language, Partial<Record<NotificationEventType, NotificationCopy>>> = {
  pt: {
    WELCOME: { title: 'Bem-vindo ao Guigui.com', message: 'A sua conta está pronta. Explore empresas, promoções e eventos em Bissau.' },
    EVENT_REMINDER: { title: 'O seu evento começa amanhã', message: '{event} começa em breve. Consulte horário e local antes de sair.' },
    PASSWORD_CHANGED: { title: 'Palavra-passe alterada', message: 'A palavra-passe da sua conta foi alterada com sucesso.' },
    TICKET_PURCHASED: { title: 'O seu bilhete está disponível', message: 'A compra para {event} foi registada. O código e o QR Code estão disponíveis em Área pessoal > Meus bilhetes.' },
    EVENT_CANCELLED: { title: 'O evento foi cancelado', message: '{event} foi cancelado. Consulte as instruções de reembolso, quando aplicável.' },
    EVENT_CHANGED: { title: 'O evento foi alterado', message: '{event} teve uma alteração importante. Consulte os novos detalhes.' },
    PAYMENT_CONFIRMED: { title: 'Pagamento confirmado', message: 'O pagamento relacionado com {event} foi confirmado.' },
    PAYMENT_FAILED: { title: 'Pagamento falhou', message: 'Não foi possível confirmar o pagamento relacionado com {event}.' },
  },
  en: {
    WELCOME: { title: 'Welcome to Guigui.com', message: 'Your account is ready. Explore businesses, promotions and events in Bissau.' },
    EVENT_REMINDER: { title: 'Your event starts tomorrow', message: '{event} is coming soon. Check the time and location before you leave.' },
    PASSWORD_CHANGED: { title: 'Password changed', message: 'Your account password was changed successfully.' },
    TICKET_PURCHASED: { title: 'Your ticket is available', message: 'Your purchase for {event} was recorded. The code and QR code are available under My area > My tickets.' },
    EVENT_CANCELLED: { title: 'Event cancelled', message: '{event} was cancelled. See the refund instructions where applicable.' },
    EVENT_CHANGED: { title: 'Event changed', message: '{event} has an important change. Check the new details.' },
    PAYMENT_CONFIRMED: { title: 'Payment confirmed', message: 'The payment related to {event} was confirmed.' },
    PAYMENT_FAILED: { title: 'Payment failed', message: 'The payment related to {event} could not be confirmed.' },
  },
  fr: {
    WELCOME: { title: 'Bienvenue sur Guigui.com', message: 'Votre compte est prêt. Découvrez les entreprises, promotions et événements à Bissau.' },
    EVENT_REMINDER: { title: 'Votre événement commence demain', message: '{event} arrive bientôt. Vérifiez l’heure et le lieu avant de partir.' },
    PASSWORD_CHANGED: { title: 'Mot de passe modifié', message: 'Le mot de passe de votre compte a été modifié avec succès.' },
    TICKET_PURCHASED: { title: 'Votre billet est disponible', message: 'Votre achat pour {event} a été enregistré. Le code et le QR code sont disponibles dans Mon espace > Mes billets.' },
    EVENT_CANCELLED: { title: 'Événement annulé', message: '{event} a été annulé. Consultez les instructions de remboursement le cas échéant.' },
    EVENT_CHANGED: { title: 'Événement modifié', message: '{event} a été modifié. Consultez les nouveaux détails.' },
    PAYMENT_CONFIRMED: { title: 'Paiement confirmé', message: 'Le paiement lié à {event} a été confirmé.' },
    PAYMENT_FAILED: { title: 'Échec du paiement', message: 'Le paiement lié à {event} n’a pas pu être confirmé.' },
  },
  es: {
    WELCOME: { title: 'Bienvenido a Guigui.com', message: 'Su cuenta está lista. Explore empresas, promociones y eventos en Bissau.' },
    EVENT_REMINDER: { title: 'Su evento comienza mañana', message: '{event} comienza pronto. Consulte la hora y el lugar antes de salir.' },
    PASSWORD_CHANGED: { title: 'Contraseña cambiada', message: 'La contraseña de su cuenta se cambió correctamente.' },
    TICKET_PURCHASED: { title: 'Su entrada está disponible', message: 'Su compra para {event} ha sido registrada. El código y el código QR están disponibles en Mi área > Mis entradas.' },
    EVENT_CANCELLED: { title: 'Evento cancelado', message: '{event} ha sido cancelado. Consulte las instrucciones de reembolso cuando corresponda.' },
    EVENT_CHANGED: { title: 'Evento modificado', message: '{event} ha sufrido un cambio importante. Consulte los nuevos detalles.' },
    PAYMENT_CONFIRMED: { title: 'Pago confirmado', message: 'Se confirmó el pago relacionado con {event}.' },
    PAYMENT_FAILED: { title: 'Pago fallido', message: 'No se pudo confirmar el pago relacionado con {event}.' },
  },
};

function localizedCopy(input: NotificationEventInput, title: string, message: string): NotificationCopy {
  let storedLanguage: Language | undefined;
  try {
    const value = localStorage.getItem('guigui_lang');
    if (value === 'en' || value === 'fr' || value === 'es') storedLanguage = value;
  } catch {
    // Storage is unavailable during server-side rendering.
  }
  const language = input.userLanguage || input.language || (input.metadata?.language as Language) || storedLanguage || 'pt';
  const copy = NOTIFICATION_COPY[language]?.[input.eventType];
  if (!copy) return { title, message };
  if (input.message) return { title: copy.title, message: input.message };
  const event = input.eventTitle || 'the event';
  return { title: copy.title, message: copy.message.replace('{event}', event) };
}

const ALL_CATEGORIES: NotificationCategory[] = [
  'system',
  'account',
  'business_approval',
  'moderation',
  'order_redemption',
  'billing',
  'event_reminder',
  'event',
  'review',
  'followed_business',
  'promotion',
  'messages',
  'support',
  'stats',
  'security',
  'admin_alert',
];

const MANDATORY_EVENT_TYPES: NotificationEventType[] = [
  'PASSWORD_CHANGED',
  'LOGIN_SUSPICIOUS',
  'MULTIPLE_LOGIN_ATTEMPTS',
  'PAYMENT_CONFIRMED',
  'PAYMENT_FAILED',
  'PAYMENT_REFUNDED',
  'EVENT_CANCELLED',
  'BUSINESS_REJECTED',
  'BACKUP_FAILED',
  'SMS_UNAVAILABLE',
  'API_ERRORS',
  'ANOMALOUS_REFUNDS',
];

const ROLE_RECIPIENT_TYPE: Record<UserRole, NotificationRecipientType> = {
  user: 'USER',
  business: 'BUSINESS',
  admin: 'ADMIN',
};

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<UserRole, NotificationPreferences> = {
  user: {
    categories: {
      account: true,
      event: true,
      event_reminder: true,
      followed_business: true,
      promotion: true,
      order_redemption: true,
      billing: true,
      review: true,
      support: true,
      security: true,
      system: true,
    },
    channels: { in_app: true, push: true, email: true, sms: false },
  },
  business: {
    categories: {
      account: true,
      business_approval: true,
      moderation: true,
      order_redemption: true,
      billing: true,
      event: true,
      review: true,
      support: true,
      stats: true,
      security: true,
      system: true,
    },
    channels: { in_app: true, push: true, email: true, sms: false },
  },
  admin: {
    categories: Object.fromEntries(ALL_CATEGORIES.map((category) => [category, true])),
    channels: { in_app: true, push: true, email: true, sms: true },
  },
};

export function getDefaultPreferences(role: UserRole): NotificationPreferences {
  const defaults = DEFAULT_NOTIFICATION_PREFERENCES[role];
  return { categories: { ...defaults.categories }, channels: { ...defaults.channels } };
}

export function getPreferencesForContext(
  store: NotificationPreferencesStore,
  context: NotificationContext
): NotificationPreferences {
  const key = context.userId || context.businessId || context.role;
  const saved = store[key];
  const defaults = getDefaultPreferences(context.role);
  return {
    categories: { ...defaults.categories, ...(saved?.categories || {}) },
    channels: { ...defaults.channels, ...(saved?.channels || {}) },
  };
}

function getRecipient(role: UserRole, input: NotificationEventInput) {
  if (role === 'user' && !input.userId) return {};
  if (role === 'business' && !input.businessId) return {};
  return {
    recipientId: role === 'user' ? input.userId : role === 'business' ? input.businessId : 'admin',
    recipientType: ROLE_RECIPIENT_TYPE[role],
    targetUserId: role === 'user' ? input.userId : undefined,
    targetBusinessId: role === 'business' ? input.businessId : undefined,
  };
}

function toTargetRole(role: UserRole): NotificationTargetRole {
  return role;
}

function buildAdminAnnouncement(input: NotificationEventInput): AppNotification | null {
  const metadata = input.metadata || {};
  const rawTargetRole = String(metadata.targetRole || 'admin');
  const targetRole: NotificationTargetRole = ['all', 'user', 'business', 'admin'].includes(rawTargetRole)
    ? rawTargetRole as NotificationTargetRole
    : 'admin';
  const targetUserId = typeof metadata.targetUserId === 'string' ? metadata.targetUserId : undefined;
  const targetBusinessId = typeof metadata.targetBusinessId === 'string' ? metadata.targetBusinessId : undefined;
  if (targetRole === 'user' && !targetUserId) return null;
  if (targetRole === 'business' && !targetBusinessId) return null;

  const validCategories: NotificationCategory[] = ['system', 'account', 'business_approval', 'moderation', 'order_redemption', 'billing', 'event_reminder', 'event', 'review', 'followed_business', 'promotion', 'messages', 'support', 'stats', 'security', 'admin_alert'];
  const category = validCategories.includes(String(metadata.category) as NotificationCategory)
    ? String(metadata.category) as NotificationCategory
    : 'system';
  const validPriorities: NotificationPriority[] = ['info', 'success', 'attention', 'critical', 'low', 'normal', 'high', 'urgent'];
  const priority = validPriorities.includes(String(metadata.priority) as NotificationPriority)
    ? String(metadata.priority) as NotificationPriority
    : 'info';
  const validChannels: NotificationChannel[] = ['in_app', 'push', 'email', 'sms'];
  const requestedChannels = Array.isArray(metadata.channels)
    ? metadata.channels.filter((channel): channel is NotificationChannel => validChannels.includes(channel as NotificationChannel))
    : [];
  const channels = Array.from(new Set<NotificationChannel>(['in_app', ...requestedChannels]));
  const recipientType = targetRole === 'user' ? 'USER' : targetRole === 'business' ? 'BUSINESS' : targetRole === 'admin' ? 'ADMIN' : undefined;
  const recipientId = targetRole === 'user' ? targetUserId : targetRole === 'business' ? targetBusinessId : targetRole === 'admin' ? 'admin' : undefined;
  const createdAt = new Date().toISOString();
  return {
    id: `notif-admin-announcement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: typeof metadata.title === 'string' && metadata.title.trim() ? metadata.title : 'Aviso da administração',
    message: input.message || 'Existe um novo aviso da administração do Guigui.com.',
    targetRole,
    targetUserId,
    targetBusinessId,
    recipientId,
    recipientType,
    category,
    priority,
    channel: 'in_app',
    channels,
    read: false,
    createdAt,
    timeAgo: timeAgo(createdAt),
    eventType: input.eventType,
    entityType: 'system',
    linkTab: targetRole === 'business' ? 'client' : targetRole === 'admin' ? 'admin' : 'feed',
    actionLabel: typeof metadata.actionLabel === 'string' ? metadata.actionLabel : 'Ver aviso',
    expiresAt: typeof metadata.expiresAt === 'string' ? metadata.expiresAt : undefined,
    metadata: { ...metadata, sentByAdmin: true },
  };
}

function timeAgo(createdAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 1000));
  if (seconds < 60) return 'Agora';
  if (seconds < 3600) return `Há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Há ${Math.floor(seconds / 3600)} h`;
  return `Há ${Math.floor(seconds / 86400)} d`;
}

function makeNotification(
  input: NotificationEventInput,
  role: UserRole,
  category: NotificationCategory,
  priority: NotificationPriority,
  title: string,
  message: string,
  linkTab?: string,
  actionLabel?: string,
  channels: NotificationChannel[] = ['in_app']
): AppNotification | null {
  const createdAt = new Date().toISOString();
  const recipient = getRecipient(role, input);
  if (role === 'user' && !input.userId) return null;
  if (role === 'business' && !input.businessId) return null;

  const copy = localizedCopy(input, title, message);
  const transactionId = role === 'user' && input.eventType === 'TICKET_PURCHASED' && typeof input.metadata?.transactionId === 'string'
    ? input.metadata.transactionId
    : undefined;
  return {
    id: transactionId ? `notif-ticket-${transactionId}` : `notif-${input.eventType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: copy.title,
    message: copy.message,
    targetRole: toTargetRole(role),
    category,
    priority,
    channel: channels[0],
    channels,
    read: false,
    createdAt,
    timeAgo: timeAgo(createdAt),
    eventType: input.eventType,
    entityType: input.entityType || 'system',
    entityId: input.entityId || input.eventId || input.ticketId || input.paymentId,
    linkTab,
    actionLabel,
    metadata: input.metadata,
    ...recipient,
  };
}

export function buildNotificationsForEvent(input: NotificationEventInput): AppNotification[] {
  const result: Array<AppNotification | null> = [];
  const businessLabel = input.businessName || 'A empresa';
  const eventLabel = input.eventTitle || 'O evento';

  switch (input.eventType) {
    case 'WELCOME':
      result.push(makeNotification(input, 'user', 'account', 'normal', 'Bem-vindo ao Guigui.com', 'A sua conta está pronta. Explore empresas, promoções e eventos em Bissau.', 'feed', 'Explorar'));
      break;
    case 'BUSINESS_REPORTED':
      result.push(makeNotification(input, 'business', 'admin_alert', 'high', 'Empresa denunciada', `${businessLabel} recebeu uma denúncia que requer revisão.`, 'client', 'Ver denúncia'));
      result.push(makeNotification(input, 'admin', 'admin_alert', 'urgent', 'Empresa denunciada', `Foi recebida uma denúncia relacionada com ${businessLabel}.`, 'admin', 'Analisar denúncia'));
      break;
    case 'DOCUMENTS_SUBMITTED':
      result.push(makeNotification(input, 'admin', 'business_approval', 'high', 'Nova documentação enviada', `${businessLabel} enviou documentação para validação.`, 'admin', 'Rever documentos'));
      break;
    case 'BUSINESS_CREATED':
      result.push(makeNotification(input, 'business', 'business_approval', 'normal', 'Registo recebido', `${businessLabel} foi criado e aguarda validação da equipa Guigui.`, 'client', 'Abrir painel'));
      result.push(makeNotification(input, 'admin', 'business_approval', 'high', 'Nova empresa aguardando aprovação', `${businessLabel} submeteu um registo para validação.`, 'admin', 'Validar empresa'));
      break;
    case 'BUSINESS_APPROVED':
      result.push(makeNotification(input, 'business', 'business_approval', 'high', 'A sua empresa foi aprovada', `${businessLabel} foi aprovada no Guigui.com e já pode publicar.`, 'client', 'Abrir empresa'));
      break;
    case 'BUSINESS_REJECTED':
      result.push(makeNotification(input, 'business', 'business_approval', 'urgent', 'Pedido de verificação rejeitado', `${businessLabel} precisa de rever os dados e documentos submetidos.`, 'client', 'Ver pendências', ['in_app', 'email']));
      break;
    case 'DOCUMENTS_REQUIRED':
      result.push(makeNotification(input, 'business', 'business_approval', 'high', 'Precisamos de documentos adicionais', 'A equipa Guigui pediu documentos adicionais para concluir a verificação da empresa.', 'client', 'Enviar documentos'));
      break;
    case 'POST_SUBMITTED':
      result.push(makeNotification(input, 'business', 'moderation', 'normal', 'Publicação enviada', 'A sua publicação foi recebida e aguarda a validação da moderação.', 'client', 'Ver publicação'));
      result.push(makeNotification(input, 'admin', 'moderation', 'high', 'Nova publicação aguardando moderação', `${businessLabel} submeteu uma publicação para revisão.`, 'admin', 'Moderar publicação'));
      break;
    case 'POST_APPROVED':
      result.push(makeNotification(input, 'business', 'moderation', 'normal', 'Publicação aprovada', 'A sua publicação foi aprovada e já está visível no feed.', 'client', 'Ver publicação'));
      break;
    case 'POST_REJECTED':
      result.push(makeNotification(input, 'business', 'moderation', 'high', 'Publicação rejeitada', 'A sua publicação não foi aprovada. Consulte o motivo e faça as alterações necessárias.', 'client', 'Ver publicação'));
      break;
    case 'POST_NEEDS_CHANGES':
      result.push(makeNotification(input, 'business', 'moderation', 'high', 'A publicação precisa de alterações', 'A moderação pediu alterações antes de publicar este conteúdo.', 'client', 'Rever publicação'));
      break;
    case 'FOLLOWED_BUSINESS_POST':
      result.push(makeNotification(input, 'user', 'followed_business', 'info', `${businessLabel} publicou uma novidade`, `Há uma nova publicação de ${businessLabel} para si.`, 'feed', 'Ver publicação'));
      break;
    case 'FAVORITE_PROMOTION':
      result.push(makeNotification(input, 'user', 'promotion', 'success' as NotificationPriority, `${businessLabel} tem uma nova promoção`, `${businessLabel} publicou uma promoção disponível para si.`, 'promotions', 'Ver promoção'));
      break;
    case 'FOLLOWED_BUSINESS_EVENT':
      result.push(makeNotification(input, 'user', 'event', 'info', `Novo evento publicado por ${businessLabel}`, `${eventLabel} foi publicado por uma empresa que segue.`, 'events', 'Ver evento'));
      break;
    case 'EVENT_SUBMITTED':
      result.push(makeNotification(input, 'business', 'event', 'normal', 'Evento enviado para aprovação', `${eventLabel} ficou pendente de validação da equipa Guigui.`, 'client', 'Ver evento'));
      result.push(makeNotification(input, 'admin', 'event', 'high', 'Novo evento aguardando aprovação', `${businessLabel} submeteu ${eventLabel} para moderação.`, 'admin', 'Rever evento'));
      break;
    case 'EVENT_APPROVED':
      result.push(makeNotification(input, 'business', 'event', 'success' as NotificationPriority, 'Evento aprovado', `${eventLabel} foi aprovado e já pode receber bilhetes.`, 'client', 'Abrir evento'));
      break;
    case 'EVENT_REJECTED':
      result.push(makeNotification(input, 'business', 'event', 'high', 'Evento rejeitado', `${eventLabel} não foi aprovado. Consulte os detalhes e submeta uma nova versão.`, 'client', 'Ver evento'));
      break;
    case 'EVENT_REPORTED':
      result.push(makeNotification(input, 'business', 'event', 'high', 'Evento denunciado', `${eventLabel} recebeu uma denúncia e pode precisar de revisão.`, 'client', 'Ver evento'));
      result.push(makeNotification(input, 'admin', 'admin_alert', 'urgent', 'Nova denúncia de evento', `${businessLabel} tem uma denúncia pendente relacionada com ${eventLabel}.`, 'admin', 'Analisar denúncia'));
      break;
    case 'REVIEW_REPORTED':
      result.push(makeNotification(input, 'business', 'moderation', 'high', 'Avaliação denunciada', 'Uma avaliação da sua empresa foi sinalizada e requer revisão.', 'client', 'Rever avaliação'));
      result.push(makeNotification(input, 'admin', 'admin_alert', 'urgent', 'Nova denúncia recebida', `Foi sinalizada uma avaliação relacionada com ${businessLabel}.`, 'admin', 'Analisar denúncia'));
      break;
    case 'EVENT_REMINDER':
      result.push(makeNotification(input, 'user', 'event_reminder', 'high', 'O seu evento começa amanhã', `${eventLabel} começa em breve. Consulte horário e local antes de sair.`, 'events', 'Ver evento', ['in_app', 'push']));
      break;
    case 'EVENT_CHANGED':
      result.push(makeNotification(input, 'user', 'event', 'high', 'O evento foi alterado', `${eventLabel} teve uma alteração importante. Consulte os novos detalhes.`, 'events', 'Ver evento', ['in_app', 'email']));
      result.push(makeNotification(input, 'business', 'event', 'normal', 'Evento actualizado', `${eventLabel} foi actualizado no portal.`, 'client', 'Ver evento'));
      break;
    case 'EVENT_VIEWS_MILESTONE':
      result.push(makeNotification(input, 'business', 'stats', 'success' as NotificationPriority, 'O seu evento atingiu um marco', `${eventLabel} atingiu ${String(input.metadata?.views || 500)} visualizações.`, 'client', 'Ver estatísticas'));
      break;
    case 'EVENT_CANCELLED':
      result.push(makeNotification(input, 'user', 'event', 'urgent', 'O evento foi cancelado', `${eventLabel} foi cancelado. Consulte as instruções de reembolso, quando aplicável.`, 'events', 'Ver evento', ['in_app', 'email', 'sms']));
      result.push(makeNotification(input, 'business', 'event', 'urgent', 'Evento cancelado', `${eventLabel} foi marcado como cancelado no portal.`, 'client', 'Ver evento'));
      break;
    case 'TICKET_PURCHASED':
      result.push(makeNotification({
        ...input,
        metadata: { ...input.metadata, ticketDestination: 'my-tickets' },
      }, 'user', 'order_redemption', 'success' as NotificationPriority, 'O seu bilhete está disponível', `A compra para ${eventLabel} foi registada. O código e o QR Code estão disponíveis em Área pessoal > Meus bilhetes.`, 'client', 'Meus bilhetes', ['in_app', 'email']));
      result.push(makeNotification(input, 'business', 'order_redemption', 'high', 'Novo bilhete vendido', `Foi registada uma nova compra para ${eventLabel}. Consulte a bilheteira da sua empresa para validar a entrada.`, 'client', 'Ver bilhetes'));
      break;
    case 'PAYMENT_CONFIRMED':
      result.push(makeNotification(input, 'user', 'billing', 'success' as NotificationPriority, 'Pagamento confirmado', `O pagamento relacionado com ${input.message || eventLabel} foi confirmado.`, 'client', 'Ver pagamento', ['in_app', 'email']));
      if (input.businessId) result.push(makeNotification(input, 'business', 'billing', 'success' as NotificationPriority, 'Novo pagamento recebido', `Foi confirmado um pagamento relacionado com ${input.message || eventLabel}.`, 'client', 'Ver financeiro'));
      if (input.metadata?.useCase !== 'event_tickets') result.push(makeNotification(input, 'admin', 'billing', 'normal', 'Novo pagamento recebido', `Foi confirmado um pagamento relacionado com ${businessLabel}.`, 'admin', 'Ver financeiro'));
      break;
    case 'PAYMENT_FAILED':
      result.push(makeNotification(input, 'user', 'billing', 'urgent', 'Pagamento falhou', `Não foi possível confirmar o pagamento relacionado com ${input.message || eventLabel}.`, 'events', 'Tentar novamente', ['in_app', 'email']));
      if (input.businessId) result.push(makeNotification(input, 'business', 'billing', 'high', 'Pagamento da subscrição falhou', `Foi detectada uma falha no pagamento relacionado com a sua conta empresarial.`, 'client', 'Ver financeiro'));
      result.push(makeNotification(input, 'admin', 'security', 'urgent', 'Falha no sistema de pagamentos', `Foi detectada uma falha de pagamento relacionada com ${businessLabel}.`, 'admin', 'Investigar'));
      break;
    case 'PAYMENT_REFUNDED':
      result.push(makeNotification(input, 'user', 'billing', 'high', 'Reembolso processado', `O reembolso relacionado com ${input.message || eventLabel} foi processado.`, 'client', 'Ver reembolso', ['in_app', 'email']));
      break;
    case 'SUBSCRIPTION_RENEWED':
      result.push(makeNotification(input, 'business', 'billing', 'success' as NotificationPriority, 'Subscrição renovada', 'A subscrição da sua empresa foi renovada com sucesso.', 'client', 'Ver subscrição', ['in_app', 'email']));
      break;
    case 'SUBSCRIPTION_EXPIRING': {
      const alertCode = String(input.metadata?.alertCode || 'renovação');
      result.push(makeNotification(input, 'business', 'billing', alertCode === '24h' ? 'urgent' : 'high', `Renovação do plano — ${alertCode}`, input.message || 'A subscrição da sua empresa está próxima da data de renovação.', 'client', 'Gerir subscrição', ['in_app', 'email']));
      break;
    }
    case 'SUBSCRIPTION_EXPIRED':
      result.push(makeNotification(input, 'business', 'billing', 'urgent', 'Plano expirado', input.message || 'O plano da sua empresa terminou. Pode consultar a conta, mas as acções comerciais ficam bloqueadas até à renovação.', 'client', 'Renovar plano', ['in_app', 'email']));
      break;
    case 'SUBSCRIPTION_SUSPENDED':
      result.push(makeNotification(input, 'business', 'billing', 'critical', 'Empresa suspensa', input.message || 'A conta empresarial foi suspensa. Consulte o motivo e contacte o suporte da Administração.', 'client', 'Ver conta', ['in_app', 'email']));
      break;
    case 'NEW_REVIEW':
      result.push(makeNotification(input, 'business', 'review', 'normal', 'Nova avaliação recebida', `A sua empresa recebeu uma nova avaliação de um cliente.`, 'client', 'Responder'));
      break;
    case 'NEW_CONTACT':
      result.push(makeNotification(input, 'business', 'support', 'normal', 'Novo contacto recebido', 'Um utilizador iniciou um contacto através do Guigui.com.', 'client', 'Ver contactos'));
      break;
    case 'NEW_SUPPORT_REQUEST':
      result.push(makeNotification(input, 'admin', 'support', 'high', 'Novo ticket de suporte', `${input.requesterName || input.userName || input.businessName || 'Um participante'} abriu um ticket de suporte.`, 'admin', 'Atender suporte'));
      break;
    case 'NEW_MESSAGE': {
      const metadata = input.metadata || {};
      const recipientUserId = typeof metadata.recipientUserId === 'string' ? metadata.recipientUserId : undefined;
      const recipientBusinessId = typeof metadata.recipientBusinessId === 'string' ? metadata.recipientBusinessId : undefined;
      if (recipientUserId) result.push(makeNotification({ ...input, userId: recipientUserId }, 'user', 'messages', 'normal', 'Nova mensagem de uma empresa', input.message || 'Recebeu uma nova mensagem de uma empresa.', 'client', 'Abrir conversa'));
      if (recipientBusinessId) result.push(makeNotification({ ...input, businessId: recipientBusinessId }, 'business', 'messages', 'normal', 'Nova mensagem de um cliente', input.message || 'Recebeu uma nova mensagem de um cliente.', 'client', 'Abrir conversa'));
      break;
    }
    case 'SUPPORT_REPLY': {
      const metadata = input.metadata || {};
      const recipientUserId = typeof metadata.recipientUserId === 'string' ? metadata.recipientUserId : undefined;
      const recipientBusinessId = typeof metadata.recipientBusinessId === 'string' ? metadata.recipientBusinessId : undefined;
      if (recipientUserId) result.push(makeNotification({ ...input, userId: recipientUserId }, 'user', 'support', 'normal', 'Resposta no pedido de suporte', input.message || 'Existe uma nova resposta no seu pedido de suporte.', 'client', 'Ver suporte'));
      if (recipientBusinessId) result.push(makeNotification({ ...input, businessId: recipientBusinessId }, 'business', 'support', 'normal', 'Resposta no pedido de suporte', input.message || 'Existe uma nova resposta no seu pedido de suporte.', 'client', 'Ver suporte'));
      break;
    }
    case 'MULTIPLE_LOGIN_ATTEMPTS':
      result.push(makeNotification(input, 'user', 'security', 'critical', 'Múltiplas tentativas de login', 'Foram detectadas várias tentativas de acesso à sua conta.', 'client', 'Rever segurança', ['in_app', 'email', 'sms']));
      result.push(makeNotification(input, 'admin', 'security', 'critical', 'Múltiplas tentativas de login', `Foram detectadas várias tentativas de acesso relacionadas com ${input.userName || 'um utilizador'}.`, 'admin', 'Ver segurança', ['in_app', 'email']));
      break;
    case 'LOGIN_SUSPICIOUS':
      result.push(makeNotification(input, 'user', 'security', 'urgent', 'Novo login suspeito', 'Foi detectada uma tentativa de acesso que merece a sua atenção.', 'client', 'Rever segurança', ['in_app', 'email', 'sms']));
      result.push(makeNotification(input, 'admin', 'security', 'urgent', 'Tentativa de acesso suspeita', `Foi detectada uma tentativa de acesso suspeita relacionada com ${input.userName || 'um utilizador'}.`, 'admin', 'Ver segurança'));
      break;
    case 'PASSWORD_CHANGED':
      result.push(makeNotification(input, 'user', 'security', 'high', 'Palavra-passe alterada', 'A palavra-passe da sua conta foi alterada com sucesso.', 'client', 'Ver segurança', ['in_app', 'email']));
      break;
    case 'API_ERRORS':
      result.push(makeNotification(input, 'admin', 'security', 'urgent', 'A API apresentou erros', input.message || 'Foram detectados erros na API da plataforma.', 'admin', 'Investigar API', ['in_app', 'email']));
      break;
    case 'ANOMALOUS_REFUNDS':
      result.push(makeNotification(input, 'admin', 'billing', 'critical', 'Aumento anormal de reembolsos', input.message || 'Foi detectado um aumento anormal de reembolsos.', 'admin', 'Investigar reembolsos', ['in_app', 'email', 'sms']));
      break;
    case 'BACKUP_COMPLETED':
      result.push(makeNotification(input, 'admin', 'system', 'normal', 'Backup concluído', 'O backup de dados da plataforma foi concluído com sucesso.', 'admin', 'Ver sistema'));
      break;
    case 'BACKUP_FAILED':
      result.push(makeNotification(input, 'admin', 'security', 'urgent', 'Backup falhou', 'O último backup da plataforma não foi concluído e requer atenção imediata.', 'admin', 'Investigar backup', ['in_app', 'email', 'sms']));
      break;
    case 'SMS_UNAVAILABLE':
      result.push(makeNotification(input, 'admin', 'security', 'urgent', 'Serviço de SMS indisponível', 'O serviço de SMS está indisponível. Verifique o estado dos operadores.', 'admin', 'Ver operadores', ['in_app', 'email', 'sms']));
      break;
    case 'ADMIN_ANNOUNCEMENT':
      result.push(buildAdminAnnouncement(input));
      break;
    case 'SYSTEM_FEATURE':
      // Anúncios de produto são opt-in e devem vir com um público explícito.
      if (input.userId) result.push(makeNotification(input, 'user', 'system', 'low', 'Nova funcionalidade disponível', input.message || 'Existe uma nova funcionalidade disponível no Guigui.com.', 'feed', 'Explorar'));
      if (input.businessId) result.push(makeNotification(input, 'business', 'system', 'low', 'Nova funcionalidade disponível', input.message || 'Existe uma nova funcionalidade disponível no Guigui.com.', 'client', 'Explorar'));
      if (input.metadata?.notifyAdmins) result.push(makeNotification(input, 'admin', 'system', 'low', 'Nova funcionalidade disponível', input.message || 'Existe uma nova funcionalidade disponível no Guigui.com.', 'admin', 'Explorar'));
      break;
  }

  return result.filter((notification): notification is AppNotification => Boolean(notification));
}

export function isNotificationVisibleToContext(notification: AppNotification, context: NotificationContext) {
  if (notification.expiresAt && Date.parse(notification.expiresAt) <= Date.now()) return false;
  if (notification.targetRole !== 'all' && notification.targetRole !== context.role) return false;
  if (notification.targetUserId && notification.targetUserId !== context.userId) return false;
  if (notification.targetBusinessId && notification.targetBusinessId !== context.businessId) return false;
  if (notification.recipientType === 'USER' && notification.recipientId && notification.recipientId !== context.userId) return false;
  if (notification.recipientType === 'BUSINESS' && notification.recipientId && notification.recipientId !== context.businessId) return false;
  if (notification.recipientType === 'ADMIN' && context.role !== 'admin') return false;
  return true;
}

export function filterNotificationsForContext(
  notifications: AppNotification[],
  context: NotificationContext,
  preferencesStore: NotificationPreferencesStore = {}
) {
  const preferences = getPreferencesForContext(preferencesStore, context);
  return notifications
    .filter((notification) => isNotificationVisibleToContext(notification, context))
    .filter((notification) => {
      const mandatory = notification.eventType && MANDATORY_EVENT_TYPES.includes(notification.eventType as NotificationEventType);
      return mandatory || preferences.categories[notification.category] !== false;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function isChannelEnabled(
  notification: AppNotification,
  channel: NotificationChannel,
  preferences: NotificationPreferences
) {
  const mandatory = notification.eventType && MANDATORY_EVENT_TYPES.includes(notification.eventType as NotificationEventType);
  return Boolean(notification.channels?.includes(channel) && (mandatory || preferences.channels[channel] !== false));
}

export function refreshNotificationTimes(notifications: AppNotification[]) {
  return notifications.map((notification) => ({ ...notification, timeAgo: timeAgo(notification.createdAt) }));
}
