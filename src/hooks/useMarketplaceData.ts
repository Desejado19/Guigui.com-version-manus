import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { CATEGORY_GROUPS, MAIN_CATEGORIES } from '../data/categoryCatalog';
import type { Business, BusinessCategory, CategoryGroupSummary, EventItem } from '../types';
import { mergeStoredBusinessProfile } from '../utils/businessProfile';
import { readStoredValue } from '../utils/persistentState';

type PersistedBusinessProfile = Partial<Omit<Business, 'email'>> & Pick<Business, 'id' | 'name'> & {
  createdAt?: string;
};

type MarketplaceStatus = 'loading' | 'ready' | 'error';
type MarketplaceSource = 'postgres' | 'local' | null;

interface MarketplaceData {
  status: MarketplaceStatus;
  source: MarketplaceSource;
  groups: CategoryGroupSummary[];
  categories: BusinessCategory[];
  businesses: Business[];
  events: EventItem[];
  setBusinesses: Dispatch<SetStateAction<Business[]>>;
  setEvents: Dispatch<SetStateAction<EventItem[]>>;
  error: string | null;
}

const BUSINESS_STORAGE_KEY = 'guigui_businesses';
const EVENT_STORAGE_KEY = 'guigui_events';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayFromPayload<T>(payload: unknown, key: string, endpoint: string): T[] {
  if (!isRecord(payload) || !Array.isArray(payload[key])) {
    throw new Error(`A resposta de ${endpoint} não contém uma lista válida.`);
  }
  return payload[key] as T[];
}

function businessFromRecord(record: PersistedBusinessProfile): Business {
  const defaults: Business = {
    id: record.id,
    name: record.name,
    slug: record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    logo: '',
    coverImage: '',
    gallery: [],
    description: '',
    categoryId: record.categoryId || '',
    subcategoryId: '',
    groupGroupId: 'corporativo_financeiro',
    tier: 'basic',
    neighborhood: '',
    address: '',
    phone: '',
    whatsapp: '',
    openingHours: '',
    isOpenNow: false,
    priceRange: '$$',
    status: record.status || 'active',
    verified: false,
    featured: false,
    ratingLabel: '',
    reviewsCount: 0,
    reviews: [],
    posts: [],
    promotions: [],
    metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 },
    subscriptionRenewDate: record.subscriptionRenewDate || '',
    postsQuotaRemaining: 3,
  };

  return { ...defaults, ...mergeStoredBusinessProfile(defaults, record) };
}

// Registos de eventos vindos da base de dados (ou do localStorage antigo) podem
// trazer campos em falta: 57 dos 79 eventos semeados não têm `category`, e outros
// não têm `ticketTypes`. Sem esta normalização o EventsView rebenta em
// `event.category.toUpperCase()` e a tabela de eventos deixa de carregar.
const KNOWN_EVENT_STATUSES: EventItem['status'][] = ['active', 'draft', 'cancelled', 'ended'];

function eventFromRecord(record: EventItem): EventItem {
  const ticketTypes = Array.isArray(record.ticketTypes) ? record.ticketTypes : [];
  // A base de dados grava `published`, mas o contrato do cliente só conhece
  // active|draft|cancelled|ended: sem este mapeamento a pesquisa de eventos
  // (`status !== 'active'`) fica vazia e o painel de admin rebenta em
  // `statusStyle[ev.status].label`.
  const status: EventItem['status'] = KNOWN_EVENT_STATUSES.includes(record.status)
    ? record.status
    : 'active';
  return {
    ...record,
    status,
    title: record.title || 'Sem título',
    organizerName: record.organizerName || '',
    category: record.category || 'outros',
    date: record.date || '',
    time: record.time || '',
    location: record.location || '',
    neighborhood: record.neighborhood || '',
    coverImage: record.coverImage || '',
    description: record.description || '',
    mediaType: record.mediaType === 'video' ? 'video' : 'image',
    ticketTypes,
    totalTicketsSold: Number(record.totalTicketsSold) || 0,
    totalRevenueXOF: Number(record.totalRevenueXOF) || 0,
    scannerDoorCode: record.scannerDoorCode || '',
  };
}

function mergeLocalBusinesses(
  localBusinesses: Business[],
  storedBusinesses: PersistedBusinessProfile[],
): Business[] {
  const localIds = new Set(localBusinesses.map(({ id }) => id));
  const storedById = new Map(storedBusinesses.map((business) => [business.id, business]));
  const updatedLocalBusinesses = localBusinesses.map((business) => {
    const stored = storedById.get(business.id);
    return stored ? { ...business, ...mergeStoredBusinessProfile(business, stored) } : business;
  });
  const businessesFromStorage = storedBusinesses
    .filter(({ id }) => id && !localIds.has(id))
    .map(businessFromRecord);

  return [...businessesFromStorage, ...updatedLocalBusinesses];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro ao carregar os dados do marketplace.';
}

function arraysAreEqual<T>(left: T[], right: T[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useMarketplaceData(): MarketplaceData {
  const [status, setStatus] = useState<MarketplaceStatus>('loading');
  const [source, setSource] = useState<MarketplaceSource>(null);
  const [groups, setGroups] = useState<CategoryGroupSummary[]>([]);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);
  const lastLoadedBusinesses = useRef<Business[] | null>(null);
  const lastLoadedEvents = useRef<EventItem[] | null>(null);
  const pendingWrites = useRef(new Set<string>());
  const persistenceErrors = useRef(new Map<string, string>());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMarketplace = async () => {
      let resolvedSource: 'postgres' | 'local' | null = null;
      try {
        const healthResponse = await fetch('/api/health');
        if (!healthResponse.ok) throw new Error(`A verificação do servidor falhou (${healthResponse.status}).`);
        const health = await healthResponse.json() as unknown;
        const databaseHealth = isRecord(health) && isRecord(health.database) ? health.database : null;
        if (!databaseHealth || typeof databaseHealth.configured !== 'boolean') {
          throw new Error('A resposta de saúde não informa se o PostgreSQL está configurado.');
        }

        if (databaseHealth.configured) {
          resolvedSource = 'postgres';
          setSource('postgres');
          const [categoryResponse, businessResponse, eventResponse] = await Promise.all([
            fetch('/api/categories'),
            fetch('/api/businesses'),
            fetch('/api/events'),
          ]);
          if (!categoryResponse.ok) throw new Error(`O catálogo de categorias falhou (${categoryResponse.status}).`);
          if (!businessResponse.ok) throw new Error(`A lista de empresas falhou (${businessResponse.status}).`);
          if (!eventResponse.ok) throw new Error(`A lista de eventos falhou (${eventResponse.status}).`);

          const [categoryPayload, businessPayload, eventPayload] = await Promise.all([
            categoryResponse.json(),
            businessResponse.json(),
            eventResponse.json(),
          ]);
          const loadedGroups = arrayFromPayload<CategoryGroupSummary>(categoryPayload, 'groups', '/api/categories');
          const loadedCategories = arrayFromPayload<BusinessCategory>(categoryPayload, 'categories', '/api/categories');
          const loadedBusinesses = arrayFromPayload<PersistedBusinessProfile>(businessPayload, 'businesses', '/api/businesses')
            .map(businessFromRecord);
          const loadedEvents = arrayFromPayload<EventItem>(eventPayload, 'events', '/api/events')
            .map(eventFromRecord);

          if (cancelled) return;
          lastLoadedBusinesses.current = loadedBusinesses;
          lastLoadedEvents.current = loadedEvents;
          setGroups(loadedGroups);
          setCategories(loadedCategories);
          setBusinesses(loadedBusinesses);
          setEvents(loadedEvents);
        } else {
          resolvedSource = 'local';
          setSource('local');
          const localBusinesses = readStoredValue<Business[]>(BUSINESS_STORAGE_KEY, []);
          const localEvents = readStoredValue<EventItem[]>(EVENT_STORAGE_KEY, []).map(eventFromRecord);
          setGroups(CATEGORY_GROUPS.map(({ id, name, description }) => ({ id, name, description })));
          setCategories(MAIN_CATEGORIES);

          const businessResponse = await fetch('/api/businesses');
          if (!businessResponse.ok) throw new Error(`A lista local de empresas falhou (${businessResponse.status}).`);
          const businessPayload = await businessResponse.json();
          const storedBusinesses = arrayFromPayload<PersistedBusinessProfile>(businessPayload, 'businesses', '/api/businesses');
          const loadedBusinesses = mergeLocalBusinesses(localBusinesses, storedBusinesses);

          if (cancelled) return;
          lastLoadedBusinesses.current = loadedBusinesses;
          lastLoadedEvents.current = localEvents;
          setBusinesses(loadedBusinesses);
          setEvents(localEvents);
        }

        if (cancelled) return;
        setError(null);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        const message = errorMessage(loadError);
        setError(message);
        if (resolvedSource === 'postgres') {
          lastLoadedBusinesses.current = [];
          lastLoadedEvents.current = [];
          setGroups([]);
          setCategories([]);
          setBusinesses([]);
          setEvents([]);
        } else if (resolvedSource === 'local') {
          const localBusinesses = readStoredValue<Business[]>(BUSINESS_STORAGE_KEY, []);
          const localEvents = readStoredValue<EventItem[]>(EVENT_STORAGE_KEY, []).map(eventFromRecord);
          lastLoadedBusinesses.current = localBusinesses;
          lastLoadedEvents.current = localEvents;
          setSource('local');
          setGroups(CATEGORY_GROUPS.map(({ id, name, description }) => ({ id, name, description })));
          setCategories(MAIN_CATEGORIES);
          setBusinesses(localBusinesses);
          setEvents(localEvents);
        } else {
          lastLoadedBusinesses.current = [];
          lastLoadedEvents.current = [];
          setGroups([]);
          setCategories([]);
          setBusinesses([]);
          setEvents([]);
        }
        setStatus('error');
      }
    };

    void loadMarketplace();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready' && !(source === 'local' && status === 'error')) return;

    const persistLocal = <T,>(key: string, value: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent(`guigui:persistent-state:${key}`, { detail: { value } }));
      } catch (storageError) {
        setError(`Não foi possível guardar ${key} no armazenamento local: ${errorMessage(storageError)}`);
      }
    };

    persistLocal(BUSINESS_STORAGE_KEY, businesses);
    persistLocal(EVENT_STORAGE_KEY, events);
  }, [businesses, events, source, status]);

  useEffect(() => {
    if (status !== 'ready' || !lastLoadedBusinesses.current || !lastLoadedEvents.current) return;

    const persistChanges = <T extends { id: string }>(
      endpoint: string,
      records: T[],
      baseline: MutableRefObject<T[] | null>,
    ) => {
      const loadedRecords = baseline.current;
      if (!loadedRecords) return;

      for (const record of records) {
        const previous = loadedRecords.find(({ id }) => id === record.id);
        if (previous && arraysAreEqual([previous], [record])) continue;

        const writeKey = `${endpoint}:${record.id}`;
        if (pendingWrites.current.has(writeKey)) continue;
        pendingWrites.current.add(writeKey);

        void (async () => {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(record),
            });
            if (!response.ok) {
              // 401/403 sao recusas permanentes: um cidadao ou visitante nao pode
              // gravar o catalogo partilhado. Assumir o registo como sincronizado
              // evita repetir o pedido a cada render (o que bloqueava o browser)
              // e evita transformar uma recusa esperada num erro de sincronizacao.
              if (response.status === 401 || response.status === 403) {
                const currentBaseline = baseline.current ?? [];
                baseline.current = [...currentBaseline.filter(({ id }) => id !== record.id), record];
                return;
              }
              throw new Error(`${endpoint} rejeitou a alteração (${response.status}).`);
            }

            const currentBaseline = baseline.current ?? [];
            baseline.current = [...currentBaseline.filter(({ id }) => id !== record.id), record];
            persistenceErrors.current.delete(writeKey);
            if (mounted.current) {
              setError((currentError) => (
                currentError?.startsWith('Não foi possível guardar os dados em ')
                  ? persistenceErrors.current.values().next().value ?? null
                  : currentError
              ));
              setSyncRevision((revision) => revision + 1);
            }
          } catch (persistenceError) {
            if (mounted.current) {
              const message = `Não foi possível guardar os dados em ${endpoint}: ${errorMessage(persistenceError)}`;
              persistenceErrors.current.set(writeKey, message);
              setError(persistenceErrors.current.values().next().value ?? message);
            }
          } finally {
            pendingWrites.current.delete(writeKey);
          }
        })();
      }
    };

    persistChanges('/api/businesses', businesses, lastLoadedBusinesses);
    persistChanges('/api/events', events, lastLoadedEvents);
  }, [businesses, events, status, syncRevision]);

  return {
    status,
    source,
    groups,
    categories,
    businesses,
    events,
    setBusinesses,
    setEvents,
    error,
  };
}
