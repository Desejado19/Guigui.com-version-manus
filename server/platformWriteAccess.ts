// Chaves de estado de conta de utilizador: lidas e escritas apenas pelo proprio utilizador.
export const USER_ACCOUNT_STATE_KEYS: ReadonlySet<string> = new Set([
  'guigui_followed_businesses',
  'guigui_followed_business_notifications_muted',
  'guigui_notification_preferences',
  'guigui_system_notifications',
]);

// Chaves visiveis a todos os utilizadores autenticados (não são filtradas por dono).
export const SYSTEM_VISIBILITY_STATE_KEYS: ReadonlySet<string> = new Set([
  'guigui_system_notifications',
]);

// Prefixos de chave por empresa: o servidor filtra por businessId.
export const BUSINESS_SCOPED_KEY_PREFIXES: ReadonlyArray<string> = [
  'guigui_payout_requests_',
  'guigui_marketing_campaigns_',
  'guigui_marketing_segments_',
  'guigui_business_team_',
  'guigui_business_team_audit_',
];

// Chaves de admin exclusivo: só admin pode ler/escrever. O modelo de negócio
// (comissões/tarifas de bilhética) é configuração administrativa: um cidadão
// ou uma empresa que o leia sem sessão ficaria a conhecer as margens da
// plataforma. Os preços visíveis ao público continuam em
// `guigui_monetization_catalog` e `guigui_subscription_plans`.
export const ADMIN_ONLY_STATE_KEYS: ReadonlySet<string> = new Set([
  'guigui_admin_business_model_config',
  'guigui_admin_category_groups',
  'guigui_subscription_features',
  'guigui_feature_catalog',
  'guigui_monetization_ledger',
  'guigui_admin_price_audit_logs',
]);

export const PLATFORM_STATE_KEYS: ReadonlySet<string> = new Set([
  'guigui_businesses',
  'guigui_events',
  'guigui_user_posts',
  'guigui_promotions',
  'guigui_stories',
  'guigui_subscription_plans',
  'guigui_admin_business_model_config',
  'guigui_monetization_catalog',
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
  'guigui_purchase_orders',
  ...USER_ACCOUNT_STATE_KEYS,
  ...ADMIN_ONLY_STATE_KEYS,
]);

/**
 * Chaves que qualquer visitante pode ler: sao catalogo e conteudo publico.
 * Tudo o resto (mensagens, suporte, encomendas) exige sessao e e filtrado
 * pelo dono do registo.
 */
export const PUBLIC_STATE_KEYS: ReadonlySet<string> = new Set([
  'guigui_businesses',
  'guigui_events',
  'guigui_promotions',
  'guigui_stories',
  'guigui_user_posts',
  'guigui_subscription_plans',
  'guigui_monetization_catalog',
  'guigui_plans_content',
  'guigui_about_content',
  'guigui_faq_content',
  'guigui_terms_content',
  'guigui_plans_content',
  'guigui_about_content',
  'guigui_faq_content',
  'guigui_terms_content',
]);

type SessionRole = 'user' | 'business' | 'admin';

// Conteúdo que um cidadão pode publicar. As stories pertencem às empresas e à
// administração (vitrine comercial): o cidadão apenas as vê, mesmo com plano
// pago. Sem esta restrição, enviar a colecção inteira permitia-lhe reescrever
// ou apagar stories de empresas.
const USER_WRITABLE_KEYS: ReadonlySet<string> = new Set([
  'guigui_user_posts',
]);

// Colecções que só empresas e administração podem publicar.
const BUSINESS_PUBLISH_KEYS: ReadonlySet<string> = new Set([
  'guigui_stories',
]);

const BUSINESS_FORBIDDEN_VALUE_KEYS: ReadonlySet<string> = new Set([
  'guigui_monetization_catalog',
  'guigui_subscription_plans',
  'guigui_admin_business_model_config',
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
  'guigui_about_content',
]);

/**
 * Coleccoes onde uma empresa so pode substituir os registos que lhe pertencem.
 * Sem isto, enviar a coleccao inteira permitia apagar conteudo de outros.
 */
const PER_TENANT_COLLECTION_KEYS: ReadonlySet<string> = new Set([
  'guigui_businesses',
  'guigui_events',
  'guigui_user_posts',
  'guigui_stories',
  'guigui_purchase_orders',
]);

const USER_LANGUAGE_PREFIX = 'user_language_';

export type AppStateWriteDecision =
  | { allowed: true }
  | { allowed: false; status: number; code: string };

export type AppStateValueDecision =
  | { allowed: true; value?: unknown }
  | { allowed: false; code: string };

export type AppStateReadDecision =
  | { allowed: true; value: unknown }
  | { allowed: false; status: number; code: string };

export type ScopedWriteDecision =
  | { allowed: true }
  | { allowed: false; status: number; code: string };

export interface ReaderIdentity {
  userId: string;
  businessId?: string;
  phone?: string;
}

function isSessionRole(value: unknown): value is SessionRole {
  return value === 'user' || value === 'business' || value === 'admin';
}

function ownsBusinessRecord(businessId: string, record: unknown): boolean {
  if (record === null || typeof record !== 'object') return false;
  const candidate = record as Record<string, unknown>;
  return candidate.id === businessId || candidate.businessId === businessId;
}

/** Chave publica? Sem sessao, so estas podem ser lidas. */
export function isPublicAppStateKey(key: string): boolean {
  return PUBLIC_STATE_KEYS.has(key)
    || key === 'guigui_businesses'
    || key === 'guigui_plans_content'
    || key === 'guigui_about_content'
    || key === 'guigui_faq_content'
    || key === 'guigui_terms_content';
}

function asArray(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object');
}

function belongsToReader(record: Record<string, unknown>, role: SessionRole, identity: ReaderIdentity): boolean {
  if (role === 'admin') return true;
  if (role === 'business') {
    return Boolean(identity.businessId) && record.businessId === identity.businessId;
  }
  return record.userId === identity.userId;
}

/** Conversas visiveis: admin tudo, empresa as suas, cidadao as dele. */
export function filterConversations(value: unknown, role: SessionRole, identity: ReaderIdentity): unknown {
  const rows = asArray(value);
  if (!rows) return value;
  return rows.filter((row) => belongsToReader(row, role, identity));
}

export function visibleConversationIds(value: unknown, role: SessionRole, identity: ReaderIdentity): Set<string> {
  return new Set(
    (filterConversations(value, role, identity) as Record<string, unknown>[])
      .map((row) => String(row.id ?? ''))
      .filter(Boolean),
  );
}

/** Mensagens so das conversas autorizadas. */
export function filterConversationMessages(value: unknown, conversationIds: Set<string>): unknown {
  const rows = asArray(value);
  if (!rows) return value;
  return rows.filter((row) => conversationIds.has(String(row.conversationId ?? '')));
}

/** Pedidos de suporte: dono do pedido ou empresa destinataria; admin tudo. */
export function filterSupportRequests(value: unknown, role: SessionRole, identity: ReaderIdentity): unknown {
  const rows = asArray(value);
  if (!rows) return value;
  if (role === 'admin') return rows;
  return rows.filter((row) => {
    if (role === 'business') {
      return (identity.businessId && row.businessId === identity.businessId)
        || row.requesterId === identity.userId
        || row.userId === identity.userId;
    }
    return row.requesterId === identity.userId || row.userId === identity.userId;
  });
}

/**
 * Encomendas: admin tudo, empresa as suas, cidadao as que comprou.
 * O telefone serve de recurso para encomendas antigas criadas antes do `buyerId`.
 */
export function filterPurchaseOrders(value: unknown, role: SessionRole, identity: ReaderIdentity): unknown {
  const rows = asArray(value);
  if (!rows) return value;
  if (role === 'admin') return rows;
  if (role === 'business') {
    return rows.filter((row) => Boolean(identity.businessId) && row.businessId === identity.businessId);
  }
  return rows.filter((row) => row.buyerId === identity.userId
    || (Boolean(identity.phone) && row.customerPhone === identity.phone));
}

/**
 * Chaves que o servidor trata como escopo por empresa (prefixo + businessId).
 */
export function isBusinessScopedKey(
  key: string,
  businessId: string | undefined,
  role: unknown,
): boolean {
  if (role !== 'business') return false;
  if (!businessId) return false;
  for (const prefix of BUSINESS_SCOPED_KEY_PREFIXES) {
    if (key === prefix + businessId) return true;
  }
  return false;
}

/** Chaves que só o admin pode ler. */
export function isAdminOnlyKey(key: string): boolean {
  return ADMIN_ONLY_STATE_KEYS.has(key);
}

/**
 * Filtra um mapa `{ [userId]: T }` para que cada utilizador veja apenas o seu
 * registo. Admin vê tudo.
 */
export function filterUserScopedMap(
  value: unknown,
  role: SessionRole,
  identity: ReaderIdentity,
  indexKey: keyof ReaderIdentity & string,
): unknown {
  const rows = asArray(value);
  if (!rows) return value;
  if (role === 'admin') return rows;
  const id = identity[indexKey];
  if (!id) return rows.filter(() => false);
  const filtered = rows.filter((row) => {
    const recordId = String(row[indexKey] ?? '');
    return recordId === id;
  });
  return filtered.length ? filtered : value;
}

/**
 * Notificacoes de sistema: visiveis a todos os utilizadores autenticados.
 * Admin vê tudo; cidadão e empresa veem a colecão completa.
 */
export function filterSystemNotifications(
  value: unknown,
  role: SessionRole,
  _identity: ReaderIdentity,
): unknown {
  if (role === 'admin') return value;
  const rows = asArray(value);
  return rows ?? value;
}

/**
 * Registos com chave dinâmica por empresa: o servidor devolve apenas o registo
 * do business da sessão (ou todos para admin).
 */
export function filterBusinessScopedRecord(
  value: unknown,
  role: SessionRole,
  identity: ReaderIdentity,
): unknown {
  if (role === 'admin') return value;
  const rows = asArray(value);
  if (!rows) return value;
  return rows.filter((row) => {
    if (!identity.businessId) return false;
    return ownsBusinessRecord(identity.businessId, row);
  });
}

/**
 * Unico ponto de decisao de leitura de estado. Mantem o endpoint simples e
 * garante que nenhuma chave privada sai sem sessao e sem filtro de dono.
 */
export function readAppStateForSession(
  key: string,
  role: unknown,
  identity: ReaderIdentity,
  value: unknown,
  conversationIds?: Set<string>,
): AppStateReadDecision {
  if (isPublicAppStateKey(key)) return { allowed: true, value };

  if (key.startsWith(USER_LANGUAGE_PREFIX)) {
    const ownerId = key.slice(USER_LANGUAGE_PREFIX.length);
    if (ownerId !== identity.userId) {
      return { allowed: false, status: 403, code: 'APP_STATE_NOT_OWNER' };
    }
    return { allowed: true, value };
  }

  if (!isSessionRole(role)) {
    return { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' };
  }

  switch (key) {
    case 'guigui_conversations':
      return { allowed: true, value: filterConversations(value, role, identity) };
    case 'guigui_conversation_messages':
      return { allowed: true, value: filterConversationMessages(value, conversationIds ?? new Set()) };
    case 'guigui_support_requests':
      return { allowed: true, value: filterSupportRequests(value, role, identity) };
    case 'guigui_purchase_orders':
      return { allowed: true, value: filterPurchaseOrders(value, role, identity) };
    case 'guigui_followed_businesses':
      return { allowed: true, value: filterUserScopedMap(value, role, identity, 'userId') };
    case 'guigui_followed_business_notifications_muted':
      return { allowed: true, value: filterUserScopedMap(value, role, identity, 'userId') };
    case 'guigui_notification_preferences':
      return { allowed: true, value: filterUserScopedMap(value, role, identity, 'userId') };
    case 'guigui_system_notifications':
      return { allowed: true, value: filterSystemNotifications(value, role, identity) };
    default:
      if (isBusinessScopedKey(key, identity.businessId, role)) {
        return { allowed: true, value: filterBusinessScopedRecord(value, role, identity) };
      }
      if (isAdminOnlyKey(key)) {
        if (role === 'admin') return { allowed: true, value };
        return { allowed: false, status: 403, code: 'APP_STATE_READ_FORBIDDEN' };
      }
      return { allowed: false, status: 403, code: 'APP_STATE_READ_FORBIDDEN' };
  }
}

export function resolveAppStateWrite(
  contextRole: unknown,
  key: string,
  userId?: string,
): AppStateWriteDecision {
  if (!isSessionRole(contextRole)) {
    return { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' };
  }

  // A preferência de idioma pertence a um utilizador concreto.
  if (key.startsWith(USER_LANGUAGE_PREFIX)) {
    const ownerId = key.slice(USER_LANGUAGE_PREFIX.length);
    if (!userId || ownerId !== userId) {
      return { allowed: false, status: 403, code: 'APP_STATE_NOT_OWNER' };
    }
    return { allowed: true };
  }

  if (!PLATFORM_STATE_KEYS.has(key)) {
    return { allowed: false, status: 400, code: 'APP_STATE_KEY_NOT_ALLOWED' };
  }

  if (contextRole === 'admin') {
    return { allowed: true };
  }

  // Empresa escreve chaves da plataforma (salvo as proibidas).
  if (contextRole === 'business') {
    if (BUSINESS_FORBIDDEN_VALUE_KEYS.has(key)) {
      return { allowed: false, status: 403, code: 'APP_STATE_WRITE_FORBIDDEN' };
    }
    return { allowed: true };
  }

  // Cidadão escreve apenas as suas chaves de conta.
  if (USER_ACCOUNT_STATE_KEYS.has(key)) {
    if (!userId) return { allowed: false, status: 403, code: 'APP_STATE_NOT_OWNER' };
    return { allowed: true };
  }

  if (BUSINESS_PUBLISH_KEYS.has(key)) {
    return { allowed: false, status: 403, code: 'STORY_PUBLISH_FORBIDDEN' };
  }

  if (USER_WRITABLE_KEYS.has(key)) {
    return { allowed: true };
  }

  return { allowed: false, status: 403, code: 'APP_STATE_WRITE_FORBIDDEN' };
}

/**
 * Uma empresa envia a colecção inteira: o servidor repõe tudo o que não lhe
 * pertence, para que não possa apagar concorrentes nem reescrever catálogos.
 * A administração grava exactamente o valor recebido.
 */
export function resolveAppStateValue(
  contextRole: unknown,
  key: string,
  businessId: string | undefined,
  incoming: unknown,
  stored: unknown,
): AppStateValueDecision {
  if (contextRole === 'admin') {
    return { allowed: true, value: incoming };
  }

  if (contextRole !== 'business') {
    return { allowed: false, code: 'APP_STATE_WRITE_FORBIDDEN' };
  }

  if (!businessId || !businessId.trim()) {
    return { allowed: false, code: 'BUSINESS_ACCOUNT_REQUIRED' };
  }

  if (BUSINESS_FORBIDDEN_VALUE_KEYS.has(key)) {
    return { allowed: false, code: 'APP_STATE_WRITE_FORBIDDEN' };
  }

  if (!PER_TENANT_COLLECTION_KEYS.has(key)) {
    return { allowed: true, value: incoming };
  }

  if (!Array.isArray(incoming) || !Array.isArray(stored)) {
    return { allowed: false, code: 'APP_STATE_VALUE_INVALID' };
  }

  const incomingById = new Map<string, Record<string, unknown>>();
  for (const item of incoming) {
    if (item === null || typeof item !== 'object') {
      return { allowed: false, code: 'APP_STATE_VALUE_INVALID' };
    }
    const record = item as Record<string, unknown>;
    incomingById.set(String(record.id), record);
  }

  const storedIds = new Set<string>();
  const merged: Record<string, unknown>[] = stored.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const id = String(record.id);
    storedIds.add(id);
    const replacement = incomingById.get(id);
    if (replacement && ownsBusinessRecord(businessId, replacement)) {
      return replacement;
    }
    return record;
  });

  // Registos novos só entram se pertencerem à empresa da sessão.
  for (const [id, record] of incomingById) {
    if (storedIds.has(id)) continue;
    if (!ownsBusinessRecord(businessId, record)) continue;
    merged.push(record);
  }

  return { allowed: true, value: merged };
}

export function resolveBusinessWrite(
  contextRole: unknown,
  businessId: string | undefined,
  targetBusinessId: string,
): ScopedWriteDecision {
  if (!isSessionRole(contextRole)) {
    return { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' };
  }
  if (contextRole === 'admin') {
    return { allowed: true };
  }
  if (contextRole !== 'business') {
    return { allowed: false, status: 403, code: 'BUSINESS_WRITE_FORBIDDEN' };
  }
  if (!businessId || !businessId.trim()) {
    return { allowed: false, status: 403, code: 'BUSINESS_ACCOUNT_REQUIRED' };
  }
  if (businessId !== targetBusinessId) {
    return { allowed: false, status: 403, code: 'BUSINESS_SCOPE_REQUIRED' };
  }
  return { allowed: true };
}

export function resolveEventWrite(
  contextRole: unknown,
  businessId: string | undefined,
  eventBusinessId: string | undefined,
): ScopedWriteDecision {
  if (!isSessionRole(contextRole)) {
    return { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' };
  }
  if (contextRole === 'admin') {
    return { allowed: true };
  }
  if (contextRole !== 'business') {
    return { allowed: false, status: 403, code: 'EVENT_WRITE_FORBIDDEN' };
  }
  if (!businessId || !businessId.trim()) {
    return { allowed: false, status: 403, code: 'BUSINESS_ACCOUNT_REQUIRED' };
  }
  if (!eventBusinessId || eventBusinessId !== businessId) {
    return { allowed: false, status: 403, code: 'BUSINESS_SCOPE_REQUIRED' };
  }
  return { allowed: true };
}

export function resolveBusinessScope(
  contextRole: unknown,
  sessionBusinessId: string | undefined,
  requestedBusinessId: string | undefined,
): ScopedWriteDecision {
  if (!isSessionRole(contextRole)) {
    return { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' };
  }
  if (contextRole === 'admin') {
    return { allowed: true };
  }
  if (contextRole !== 'business') {
    return { allowed: false, status: 403, code: 'BUSINESS_SCOPE_FORBIDDEN' };
  }
  if (!sessionBusinessId || !sessionBusinessId.trim()) {
    return { allowed: false, status: 403, code: 'BUSINESS_ACCOUNT_REQUIRED' };
  }
  if (sessionBusinessId !== requestedBusinessId) {
    return { allowed: false, status: 403, code: 'BUSINESS_SCOPE_REQUIRED' };
  }
  return { allowed: true };
}
