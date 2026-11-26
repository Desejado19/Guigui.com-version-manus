import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type SetStateAction } from 'react';
import {
  COLLECTION_CACHE_TTL_MS,
  isLargeStateKey,
  readOrMigrateCachedValue,
  writeCachedValue,
} from './browserStorage';
import { reportStorageIssue } from './storageMonitor';

export function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Chaves do sistema que devem ser sincronizadas com o banco de dados PostgreSQL
const SYNCABLE_STATE_KEYS = new Set([
  'guigui_user_posts',
  'guigui_promotions',
  'guigui_stories',
  'guigui_subscription_plans',
  'guigui_admin_business_model_config',
  'guigui_monetization_catalog',
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
  'guigui_plans_content',
  'guigui_about_content',
  'guigui_faq_content',
  'guigui_terms_content',
]);

// Dados privados/de conta: o cache local tem de ser separado por perfil, senão
// o cidadão, a empresa e o admin vêem no browser os dados uns dos outros.
const ACCOUNT_SCOPED_STATE_KEYS = new Set([
  'guigui_user_posts',
  'guigui_promotions',
  'guigui_stories',
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
]);

// O servidor só deixa o cidadão gravar estas chaves (`USER_WRITABLE_KEYS`).
// Tentar gravar colecções filtradas por perfil (mensagens, suporte) devolveria
// 403 — e, se passasse, apagaria registos de outros utilizadores. As stories
// são publicadas por empresas e administração; o cidadão só as vê.
const CITIZEN_WRITABLE_STATE_KEYS = new Set([
  'guigui_user_posts',
]);

// Chaves que uma empresa não pode substituir por inteiro (`BUSINESS_FORBIDDEN_VALUE_KEYS`).
const BUSINESS_FORBIDDEN_STATE_KEYS = new Set([
  'guigui_monetization_catalog',
  'guigui_subscription_plans',
  'guigui_admin_business_model_config',
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
]);

// Chaves privadas que exigem sessão: sem sessão o servidor devolve 401.
// A configuração do modelo de negócio é administrativa: leitores anónimos
// usam os valores por omissão compilados no cliente.
const SESSION_REQUIRED_STATE_KEYS = new Set([
  'guigui_conversations',
  'guigui_conversation_messages',
  'guigui_support_requests',
  'guigui_admin_business_model_config',
]);

/** O perfil atual pode gravar esta chave no servidor? */
function canWriteKeyForScope(key: string, scope: string): boolean {
  if (scope.startsWith('user:')) return CITIZEN_WRITABLE_STATE_KEYS.has(key);
  if (scope.startsWith('business:')) return !BUSINESS_FORBIDDEN_STATE_KEYS.has(key);
  // Sem sessão não há escrita possível.
  return false;
}

/** Vale a pena pedir esta chave ao servidor com o perfil atual? */
function canReadKeyForScope(key: string, scope: string): boolean {
  if (scope === 'anon') return !SESSION_REQUIRED_STATE_KEYS.has(key);
  return true;
}

const CACHE_PREFIX = 'guigui:state:';
const SCOPE_EVENT = 'guigui:persistent-state-scope';

let currentScope = 'anon';

export function getPersistentStateScope(): string {
  return currentScope;
}

/** Muda o dono lógico do cache local (ao entrar/sair ou trocar de conta). */
export function setPersistentStateScope(scope: string | null): void {
  const next = scope && scope.trim() ? scope.trim() : 'anon';
  if (next === currentScope) return;
  currentScope = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCOPE_EVENT, { detail: { scope: next } }));
  }
}

function subscribeScope(callback: () => void): () => void {
  window.addEventListener(SCOPE_EVENT, callback);
  return () => window.removeEventListener(SCOPE_EVENT, callback);
}

function cacheKeyFor(key: string, scope: string): string {
  return ACCOUNT_SCOPED_STATE_KEYS.has(key) ? `${CACHE_PREFIX}${scope}:${key}` : key;
}

interface ScopedValue<T> {
  scope: string;
  value: T;
}

export function usePersistentState<T>(key: string, fallback: T) {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const accountScoped = ACCOUNT_SCOPED_STATE_KEYS.has(key);
  const largeState = isLargeStateKey(key);
  const scope = useSyncExternalStore(subscribeScope, () => currentScope, () => 'anon');
  const storageKey = cacheKeyFor(key, scope);
  const [state, setState] = useState<ScopedValue<T>>(() => ({
    scope: currentScope,
    // Uma chave grande pode ter um valor legado no localStorage: é lido uma
    // única vez e migrado para IndexedDB pelo efeito de hidratação.
    value: accountScoped
      ? readStoredValue(cacheKeyFor(key, currentScope), fallbackRef.current)
      : readStoredValue(key, fallbackRef.current),
  }));
  const value = state.value;

  const eventName = `guigui:persistent-state:${key}`;
  const valueRef = useRef(value);
  valueRef.current = value;
  const hydratedRef = useRef(!largeState);
  const [hydratedTick, setHydratedTick] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const retryAttemptRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const remoteAppliedRef = useRef(false);

  // Estado da sincronização: só se grava depois da leitura inicial, e uma
  // resposta antiga nunca substitui uma alteração local ainda por confirmar.
  const remoteReadyRef = useRef(false);
  const [remoteReadyTick, setRemoteReadyTick] = useState(0);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const lastServerUpdatedAtRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const setValue = useCallback((action: SetStateAction<T>) => {
    revisionRef.current += 1;
    dirtyRef.current = true;
    const activeScope = getPersistentStateScope();
    setState((current) => ({
      scope: activeScope,
      value: typeof action === 'function' ? (action as (previous: T) => T)(current.value) : action,
    }));
  }, []);

  // Troca de conta: recarrega apenas o cache do novo perfil. O valor anterior
  // continua marcado com o escopo antigo, pelo que não é gravado no novo.
  useEffect(() => {
    if (state.scope === scope) return;
    remoteReadyRef.current = false;
    dirtyRef.current = false;
    revisionRef.current = 0;
    lastServerUpdatedAtRef.current = null;
    setState({
      scope,
      value: largeState
        ? fallbackRef.current
        : accountScoped
          ? readStoredValue(cacheKeyFor(key, scope), fallbackRef.current)
          : readStoredValue(key, fallbackRef.current),
    });
    remoteAppliedRef.current = false;
  }, [accountScoped, key, largeState, scope, state.scope]);

  // Hidratação das colecções a partir de IndexedDB. Migra uma vez o valor
  // legado do localStorage e só remove a chave antiga após a escrita ter êxito.
  useEffect(() => {
    if (!largeState) {
      hydratedRef.current = true;
      return;
    }
    let cancelled = false;
    hydratedRef.current = false;
    void readOrMigrateCachedValue<T>(storageKey)
      .then((result) => {
        if (cancelled) return;
        if (result.found && !remoteAppliedRef.current && !dirtyRef.current) {
          setState({ scope, value: result.value as T });
        }
        // Carrega o valor pendente e mantém a alteração local marcada para
        // reenvio assim que houver rede (mesmo depois de reiniciar o browser).
        if (result.found && result.pending) dirtyRef.current = true;
        if (!result.found) {
          void writeCachedValue(storageKey, valueRef.current, { ttlMs: COLLECTION_CACHE_TTL_MS });
        }
      })
      .catch((error: unknown) => {
        reportStorageIssue('read_failed', storageKey, error);
      })
      .finally(() => {
        if (cancelled) return;
        hydratedRef.current = true;
        setHydratedTick((tick) => tick + 1);
      });
    return () => { cancelled = true; };
  }, [largeState, scope, storageKey]);

  // Leitura inicial + polling. Só aplica valores remotos mais recentes e nunca
  // atropela alterações locais pendentes.
  useEffect(() => {
    if (!SYNCABLE_STATE_KEYS.has(key)) return;
    if (!canReadKeyForScope(key, scope)) return;
    // Em chaves grandes espera pela cache IndexedDB: se houver uma alteração
    // pendente, a resposta inicial do servidor não a pode atropelar.
    if (largeState && hydratedTick === 0) return;

    let cancelled = false;
    const fetchScope = scope;

    const fetchRemoteState = async (initial: boolean) => {
      try {
        const response = await fetch(`/api/app-state/${encodeURIComponent(key)}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const result = await response.json() as { key: string; value: T | null; updatedAt?: string | null };
        if (cancelled || getPersistentStateScope() !== fetchScope) return;
        if (initial) remoteReadyRef.current = true;
        if (result.value === null || typeof result.value === 'undefined') return;
        if (dirtyRef.current) return;

        const incomingAt = result.updatedAt || null;
        const lastKnown = lastServerUpdatedAtRef.current;
        if (!initial) {
          if (!incomingAt || (lastKnown && incomingAt <= lastKnown)) return;
        }

        let sameValue = false;
        try {
          sameValue = JSON.stringify(valueRef.current) === JSON.stringify(result.value);
        } catch {
          sameValue = false;
        }
        lastServerUpdatedAtRef.current = incomingAt;
        if (sameValue) return;
        // Valor veio do servidor: não deve ser reenviado como alteração local.
        dirtyRef.current = false;
        remoteAppliedRef.current = true;
        setState({ scope: fetchScope, value: result.value as T });
      } catch {
        // Fallback gracioso para o cache local.
      } finally {
        if (initial && !cancelled) {
          remoteReadyRef.current = true;
          // Reexecuta o efeito de gravação: se o utilizador editou durante a
          // leitura inicial, essa alteração fica pendente e tem de ser enviada.
          setRemoteReadyTick((tick) => tick + 1);
        }
      }
    };

    void fetchRemoteState(true);
    const interval = window.setInterval(() => void fetchRemoteState(false), 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hydratedTick, key, largeState, scope]);

  // Eventos locais entre componentes que usam a mesma chave.
  useEffect(() => {
    const handleLocalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: T }>).detail;
      if (!detail || typeof detail.value === 'undefined') return;
      const activeScope = getPersistentStateScope();
      setState((current) => {
        if (current.scope !== activeScope) return current;
        try {
          return JSON.stringify(current.value) === JSON.stringify(detail.value)
            ? current
            : { scope: activeScope, value: detail.value as T };
        } catch {
          return { scope: activeScope, value: detail.value as T };
        }
      });
    };
    window.addEventListener(eventName, handleLocalUpdate);
    return () => window.removeEventListener(eventName, handleLocalUpdate);
  }, [eventName]);

  // Cache local + gravação remota. O valor só pertence ao escopo atual quando
  // `state.scope === scope`; caso contrário é um snapshot do perfil anterior.
  useEffect(() => {
    if (state.scope !== scope) return;

    try {
      if (largeState) {
        if (hydratedRef.current) {
          void writeCachedValue(storageKey, state.value, {
            ttlMs: COLLECTION_CACHE_TTL_MS,
            ...(dirtyRef.current && SYNCABLE_STATE_KEYS.has(key) ? { pending: true } : {}),
          });
        }
      } else {
        window.localStorage.setItem(cacheKeyFor(key, scope), JSON.stringify(state.value));
      }
      window.dispatchEvent(new CustomEvent(eventName, { detail: { value: state.value } }));
    } catch (error) {
      // Uma preferência pequena pode continuar apenas em memória; uma colecção
      // grande nunca depende do localStorage.
      reportStorageIssue('quota_exceeded', largeState ? storageKey : cacheKeyFor(key, scope), error);
    }

    if (!SYNCABLE_STATE_KEYS.has(key)) return;
    if (!remoteReadyRef.current) return;
    if (!dirtyRef.current) return;
    // O servidor recusaria esta escrita (403): o cache local fica como fonte de
    // verdade e evitamos pedidos e registos de auditoria inúteis.
    if (!canWriteKeyForScope(key, scope)) {
      dirtyRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    const scopeAtSave = scope;
    const revisionAtSave = revisionRef.current;

    saveTimeoutRef.current = window.setTimeout(async () => {
      // Se a conta mudou entretanto, esta gravação pertence ao perfil anterior.
      if (getPersistentStateScope() !== scopeAtSave) return;
      try {
        const saved = await fetch(`/api/app-state/${encodeURIComponent(key)}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: valueRef.current }),
        });
        if (!saved.ok) return;
        const result = await saved.json().catch(() => ({})) as { value?: T; updatedAt?: string | null };
        if (revisionRef.current !== revisionAtSave) return;

        dirtyRef.current = false;
        retryAttemptRef.current = 0;
        if (retryTimeoutRef.current) {
          window.clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        lastServerUpdatedAtRef.current = result.updatedAt || null;
        if (largeState) {
          // A cache deixa de estar pendente; não é uma nova alteração local.
          void writeCachedValue(storageKey, result.value ?? valueRef.current, { ttlMs: COLLECTION_CACHE_TTL_MS });
        }

        // O servidor pode devolver o valor já filtrado/merged; essa é a versão
        // autoritativa e deve substituir o snapshot local.
        if (result.value !== undefined && result.value !== null) {
          let sameValue = false;
          try {
            sameValue = JSON.stringify(result.value) === JSON.stringify(valueRef.current);
          } catch {
            sameValue = false;
          }
          if (!sameValue) setState({ scope: scopeAtSave, value: result.value });
        }
      } catch {
        // Erro de rede: mantém a alteração pendente e tenta de novo com
        // backoff exponencial (1s, 2s, 4s... até 60s), sem perder dados.
        retryAttemptRef.current += 1;
        const delay = Math.min(60_000, 1_000 * 2 ** Math.min(6, retryAttemptRef.current));
        if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = window.setTimeout(() => setRetryTick((tick) => tick + 1), delay);
      }
    }, 400);
  }, [eventName, hydratedTick, key, largeState, remoteReadyTick, retryTick, scope, state, storageKey]);

  useEffect(() => () => {
    if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
  }, []);

  // Listener do storage de outras janelas (chave já isolada por conta).
  useEffect(() => {
    const storageKey = cacheKeyFor(key, scope);
    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue) as T;
        setState((current) => {
          try {
            return JSON.stringify(current.value) === JSON.stringify(next)
              ? current
              : { scope, value: next };
          } catch {
            return { scope, value: next };
          }
        });
      } catch {
        // Ignore malformed external storage values.
      }
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [key, scope]);

  return [value, setValue] as const;
}
