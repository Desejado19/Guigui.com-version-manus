/**
 * Autorização de escrita dos recursos partilhados da plataforma.
 *
 * Estas funções são puras e partilhadas entre as rotas de escrita para que a
 * decisão de acesso possa ser testada isoladamente, sem subir um servidor.
 *
 * Referência de escopo: Secção 3.7 (separação de permissões) e Secção 3.10
 * (protecção das APIs) do documento de escopo.
 */

export type PlatformWriteRole = 'user' | 'business' | 'admin';

export type WriteDecision =
  | { allowed: true }
  | { allowed: false; status: number; code: string };

const DENY_NOT_AUTHENTICATED: WriteDecision = { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' };

/**
 * Chaves de estado de plataforma sincronizadas pela aplicação.
 * Tudo o que estiver fora desta lista é rejeitado, para que ninguém
 * invente chaves arbitrárias dentro do espaço de estado do servidor.
 */
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
]);

/**
 * Um cidadão escreve apenas o seu próprio conteúdo, que é depois sujeito à
 * fila de moderação híbrida (Secção 9). Não pode alterar o directório,
 * os planos, o catálogo de preços nem os dados de outras empresas.
 */
const CITIZEN_STATE_KEYS: ReadonlySet<string> = new Set([
  'guigui_user_posts',
  'guigui_stories',
]);

/** Prefixo das preferências de idioma, gravadas por utilizador. */
const USER_LANGUAGE_PREFIX = 'user_language_';

/**
 * Chaves cujo conteúdo é global e não pode ser controlado por uma empresa:
 * planos, catálogo de preços, configuração do modelo de negócio e as caixas de
 * comunicação, que já têm rotas próprias com verificação de dono.
 */
const DENY_FOR_BUSINESS: ReadonlySet<string> = new Set([
  'guigui_subscription_plans',
  'guigui_monetization_catalog',
  'guigui_admin_business_model_config',
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
]);

/**
 * Colecções em que cada empresa só pode mexer nos seus próprios registos.
 * O resto da colecção é reposto a partir do valor já guardado no servidor.
 */
const OWNED_COLLECTIONS: ReadonlySet<string> = new Set([
  'guigui_businesses',
  'guigui_events',
  'guigui_promotions',
  'guigui_stories',
]);

/** As empresas identificam-se por `id`; as restantes colecções, por `businessId`. */
const ownerIdOf = (entry: unknown, key: string): string | undefined => {
  if (!entry || typeof entry !== 'object') return undefined;
  const record = entry as Record<string, unknown>;
  const value = key === 'guigui_businesses' ? record.id : record.businessId;
  return typeof value === 'string' ? value : undefined;
};

export type AppStateValueDecision =
  | { allowed: true; value: unknown }
  | { allowed: false; code: string };

/**
 * Calcula o valor que pode efectivamente ser gravado por uma empresa.
 *
 * O cliente envia a colecção inteira, por isso limitar apenas a permissão não
 * chega: uma empresa poderia apagar concorrentes ou reescrever o catálogo. Aqui
 * os registos que não lhe pertencem são repostos com o valor já guardado.
 */
export function resolveAppStateValue(
  role: PlatformWriteRole,
  key: string,
  sessionBusinessId: string | undefined,
  incoming: unknown,
  stored: unknown,
): AppStateValueDecision {
  // A administração gere a plataforma; o âmbito dela não muda.
  if (role === 'admin') return { allowed: true, value: incoming };

  if (DENY_FOR_BUSINESS.has(key)) {
    return { allowed: false, code: 'APP_STATE_WRITE_FORBIDDEN' };
  }

  if (!OWNED_COLLECTIONS.has(key)) return { allowed: true, value: incoming };

  if (!sessionBusinessId) return { allowed: false, code: 'BUSINESS_ACCOUNT_REQUIRED' };
  if (!Array.isArray(incoming)) return { allowed: false, code: 'APP_STATE_VALUE_INVALID' };

  const storedList = Array.isArray(stored) ? stored : [];
  const mine = incoming.filter((entry) => ownerIdOf(entry, key) === sessionBusinessId);
  const othersKept = storedList.filter((entry) => ownerIdOf(entry, key) !== sessionBusinessId);

  return { allowed: true, value: [...mine, ...othersKept] };
}

/**
 * Decide se a sessão pode gravar a chave de estado indicada.
 * Cada utilizador só pode gravar a sua própria preferência de idioma.
 */
export function resolveAppStateWrite(
  role: PlatformWriteRole | undefined,
  key: string,
  sessionUserId?: string,
): WriteDecision {
  if (!role) return DENY_NOT_AUTHENTICATED;

  if (key.startsWith(USER_LANGUAGE_PREFIX)) {
    const owner = key.slice(USER_LANGUAGE_PREFIX.length);
    if (!sessionUserId || owner !== sessionUserId) {
      return { allowed: false, status: 403, code: 'APP_STATE_NOT_OWNER' };
    }
    return { allowed: true };
  }

  if (!PLATFORM_STATE_KEYS.has(key)) {
    return { allowed: false, status: 400, code: 'APP_STATE_KEY_NOT_ALLOWED' };
  }

  if (role === 'admin' || role === 'business') return { allowed: true };

  if (CITIZEN_STATE_KEYS.has(key)) return { allowed: true };

  return { allowed: false, status: 403, code: 'APP_STATE_WRITE_FORBIDDEN' };
}

/**
 * Uma empresa só pode gravar a sua própria ficha. A administração gere
 * o directório completo.
 */
export function resolveBusinessWrite(
  role: PlatformWriteRole | undefined,
  sessionBusinessId: string | undefined,
  targetBusinessId: string | undefined,
): WriteDecision {
  if (!role) return DENY_NOT_AUTHENTICATED;
  if (role === 'admin') return { allowed: true };
  if (role !== 'business') return { allowed: false, status: 403, code: 'BUSINESS_WRITE_FORBIDDEN' };
  if (!sessionBusinessId) return { allowed: false, status: 403, code: 'BUSINESS_ACCOUNT_REQUIRED' };
  if (!targetBusinessId || targetBusinessId !== sessionBusinessId) {
    return { allowed: false, status: 403, code: 'BUSINESS_SCOPE_REQUIRED' };
  }
  return { allowed: true };
}

/**
 * Um evento pertence sempre à empresa organizadora: quem o cria tem de ser a
 * própria empresa ou a administração. Nunca um cidadão isolado.
 */
export function resolveEventWrite(
  role: PlatformWriteRole | undefined,
  sessionBusinessId: string | undefined,
  targetBusinessId: string | undefined,
): WriteDecision {
  if (!role) return DENY_NOT_AUTHENTICATED;
  if (role === 'admin') return { allowed: true };
  if (role !== 'business') return { allowed: false, status: 403, code: 'EVENT_WRITE_FORBIDDEN' };
  if (!sessionBusinessId) return { allowed: false, status: 403, code: 'BUSINESS_ACCOUNT_REQUIRED' };
  if (!targetBusinessId || targetBusinessId !== sessionBusinessId) {
    return { allowed: false, status: 403, code: 'BUSINESS_SCOPE_REQUIRED' };
  }
  return { allowed: true };
}
