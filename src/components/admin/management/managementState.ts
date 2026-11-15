import { useCallback, useEffect, useMemo, useState } from 'react';

export const MANAGEMENT_PAGE_SIZES = [20, 30, 50, 100, 200] as const;
export const MANAGEMENT_DEFAULT_PAGE_SIZE = 20;

export type SortDirection = 'asc' | 'desc';

export interface ManagementListState<F extends string = string> {
  query: string;
  filters: Record<F, string>;
  sortKey: string;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

function readState<F extends string>(
  storageKey: string,
  fallback: ManagementListState<F>,
): ManagementListState<F> {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ManagementListState<F>>;
    return {
      query: typeof parsed.query === 'string' ? parsed.query : fallback.query,
      filters: { ...fallback.filters, ...(parsed.filters || {}) },
      sortKey: typeof parsed.sortKey === 'string' ? parsed.sortKey : fallback.sortKey,
      sortDirection: parsed.sortDirection === 'desc' ? 'desc' : 'asc',
      page: typeof parsed.page === 'number' && parsed.page > 0 ? parsed.page : 1,
      pageSize: MANAGEMENT_PAGE_SIZES.includes((parsed.pageSize ?? 0) as (typeof MANAGEMENT_PAGE_SIZES)[number])
        ? (parsed.pageSize as number)
        : fallback.pageSize,
    };
  } catch {
    return fallback;
  }
}

/**
 * Estado de uma listagem de gestão, guardado em sessionStorage por módulo.
 * Garante que, ao voltar da página de gestão para o módulo e reabrir a lista,
 * a pesquisa, os filtros, a ordenação e a página atual são preservados.
 */
export function useManagementListState<F extends string>(
  storageKey: string,
  initialFilters: Record<F, string>,
  defaultSortKey = '',
  defaultSortDirection: SortDirection = 'asc',
) {
  const fallback = useMemo<ManagementListState<F>>(
    () => ({
      query: '',
      filters: initialFilters,
      sortKey: defaultSortKey,
      sortDirection: defaultSortDirection,
      page: 1,
      pageSize: MANAGEMENT_DEFAULT_PAGE_SIZE,
    }),
    // Os filtros iniciais são constantes por módulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey],
  );

  const [state, setState] = useState<ManagementListState<F>>(() => readState(storageKey, fallback));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Preferência de UI: falha de storage não deve bloquear a gestão.
    }
  }, [storageKey, state]);

  const setQuery = useCallback((query: string) => {
    setState((current) => ({ ...current, query, page: 1 }));
  }, []);

  const setFilter = useCallback((key: F, value: string) => {
    setState((current) => ({ ...current, filters: { ...current.filters, [key]: value }, page: 1 }));
  }, []);

  const setSort = useCallback((sortKey: string) => {
    setState((current) => ({
      ...current,
      sortKey,
      sortDirection: current.sortKey === sortKey && current.sortDirection === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState((current) => ({ ...current, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setState((current) => ({ ...current, pageSize, page: 1 }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...fallback, filters: { ...fallback.filters } });
  }, [fallback]);

  return { state, setQuery, setFilter, setSort, setPage, setPageSize, reset };
}

export function normaliseSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesSearch(query: string, fields: Array<unknown>): boolean {
  const needle = normaliseSearch(query);
  if (!needle) return true;
  return fields.some((field) => normaliseSearch(field).includes(needle));
}

export function paginateItems<T>(items: readonly T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize;
  return {
    totalItems,
    totalPages,
    page: safePage,
    items: items.slice(from, from + pageSize),
    rangeStart: totalItems === 0 ? 0 : from + 1,
    rangeEnd: Math.min(from + pageSize, totalItems),
  };
}

export function formatManagementDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-PT');
}
