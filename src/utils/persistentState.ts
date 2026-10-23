import { useEffect, useRef, useState } from 'react';

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
]);

export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStoredValue(key, fallback));
  const eventName = `guigui:persistent-state:${key}`;
  const isInitialRemoteFetch = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Sincronização inicial com o Banco de Dados (quando a chave for sincronizável)
  useEffect(() => {
    if (!SYNCABLE_STATE_KEYS.has(key)) return;

    let isMounted = true;
    const fetchRemoteState = async () => {
      try {
        const response = await fetch(`/api/app-state/${encodeURIComponent(key)}`);
        if (!response.ok) return;
        const result = await response.json() as { key: string; value: T | null };
        if (isMounted && result.value !== null && typeof result.value !== 'undefined') {
          setValue((current) => {
            try {
              return JSON.stringify(current) === JSON.stringify(result.value) ? current : (result.value as T);
            } catch {
              return result.value as T;
            }
          });
        }
      } catch {
        // Fallback gracioso para localStorage
      } finally {
        isInitialRemoteFetch.current = false;
      }
    };

    fetchRemoteState();

    // Sincronização periódica em background para atualizar automaticamente com o banco
    const interval = window.setInterval(fetchRemoteState, 15_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [key]);

  // 2. Eventos locais entre abas/componentes
  useEffect(() => {
    const handleLocalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: T }>).detail;
      if (!detail || typeof detail.value === 'undefined') return;
      setValue((current) => {
        try {
          return JSON.stringify(current) === JSON.stringify(detail.value) ? current : detail.value;
        } catch {
          return detail.value as T;
        }
      });
    };
    window.addEventListener(eventName, handleLocalUpdate);
    return () => window.removeEventListener(eventName, handleLocalUpdate);
  }, [eventName]);

  // 3. Persistência local e disparo de gravação remota no PostgreSQL
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent(eventName, { detail: { value } }));
    } catch {
      // A aplicação continua funcional mesmo quando o armazenamento do browser não está disponível.
    }

    // Persiste no banco de dados automaticamente caso a chave faça parte dos dados compartilhados
    if (SYNCABLE_STATE_KEYS.has(key)) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const saved = await fetch(`/api/app-state/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          });

          // Sem sessão activa (401/403) ou com quota esgotada (429) não sincroniza
          // itens: cada chamada seria rejeitada e só desperdiça a quota da API,
          // bloqueando depois pedidos legítimos como o login com "Demasiados pedidos".
          if (!saved.ok) return;
        } catch {
          // Erro de rede não interrompe o uso local
        }
      }, 500);
    }
  }, [eventName, key, value]);

  // 4. Listener do storage de outras janelas
  useEffect(() => {
    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue) as T;
        setValue((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      } catch {
        // Ignore malformed external storage values.
      }
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [key]);

  return [value, setValue] as const;
}
