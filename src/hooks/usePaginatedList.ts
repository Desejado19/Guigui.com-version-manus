import { useEffect, useMemo, useState } from 'react';
import { readStoredValue } from '../utils/persistentState';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

const GLOBAL_PAGE_SIZE_KEY = 'guigui_pagination_page_size';

function writeStoredValue(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferencia de UI: falha de storage nao deve quebrar a listagem.
  }
}

function normalisePageSize(value: number, options: readonly number[]): number {
  return options.includes(value) ? value : DEFAULT_PAGE_SIZE;
}

export interface UsePaginatedListOptions {
  /** Preferencia inicial quando ainda nao existe valor guardado. */
  initialPageSize?: number;
  /** Opcoes aceites pelo seletor. */
  pageSizeOptions?: readonly number[];
  /**
   * Qualquer valor que represente pesquisa/filtros activos.
   * Quando muda, a lista volta automaticamente a primeira pagina.
   */
  resetKey?: string | number;
  /** Chave de persistencia. Por omissao usa a chave global do utilizador. */
  persistKey?: string;
  /** Desliga a leitura/escrita da preferencia no localStorage. */
  persist?: boolean;
}

export interface PaginatedList<T> {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  pageSizeOptions: readonly number[];
  totalItems: number;
  totalPages: number;
  pageItems: T[];
  /** Indice 1-based do primeiro registo visivel (0 quando a lista esta vazia). */
  rangeStart: number;
  /** Indice 1-based do ultimo registo visivel. */
  rangeEnd: number;
  isEmpty: boolean;
}

/**
 * Paginacao de listas no cliente, com preferencia de quantidade de registos
 * persistida entre visitas e reposicao automatica da primeira pagina quando os
 * filtros mudam. E o unico utilitario de paginacao usado pelos modulos: evita
 * que cada ecra invente o seu proprio comportamento.
 */
export function usePaginatedList<T>(items: readonly T[], options: UsePaginatedListOptions = {}): PaginatedList<T> {
  const {
    initialPageSize = DEFAULT_PAGE_SIZE,
    pageSizeOptions = PAGE_SIZE_OPTIONS,
    resetKey,
    persistKey = GLOBAL_PAGE_SIZE_KEY,
    persist = true,
  } = options;

  const [pageSize, setPageSizeState] = useState<number>(() => {
    if (!persist) return normalisePageSize(initialPageSize, pageSizeOptions);
    return normalisePageSize(readStoredValue<number>(persistKey, initialPageSize), pageSizeOptions);
  });

  const [page, setPage] = useState(1);

  // Pesquisa/filtros mudam -> voltar a primeira pagina.
  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const from = (safePage - 1) * pageSize;
    return items.slice(from, from + pageSize);
  }, [items, safePage, pageSize]);

  const setPageSize = (size: number) => {
    const next = normalisePageSize(size, pageSizeOptions);
    setPageSizeState(next);
    if (persist) writeStoredValue(persistKey, next);
  };

  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
    totalItems,
    totalPages,
    pageItems,
    rangeStart,
    rangeEnd,
    isEmpty: totalItems === 0,
  };
}
