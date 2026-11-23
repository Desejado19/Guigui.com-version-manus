import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Language, LocaleCode } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePaginatedList';

interface AdminPaginationProps {
  currentLang?: Language;
  localeCode?: LocaleCode;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
}

/**
 * Paginacao unica do site. Nenhum modulo deve implementar a sua propria:
 * usa `usePaginatedList` para o estado e este componente para a UI, para que
 * "Mostrando X–Y de Z", o seletor 10/20/50/100 e os botoes se comportem
 * sempre da mesma forma.
 */
export const AdminPagination: React.FC<AdminPaginationProps> = ({
  currentLang = 'pt',
  localeCode,
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className = '',
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const locale = localeCode ?? (currentLang === 'pt' ? 'pt-PT' : currentLang);
  const formatNumber = (value: number) => {
    try {
      return value.toLocaleString(locale);
    } catch {
      return value.toLocaleString('pt-PT');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Se a pagina corrente ficar fora do intervalo (ex.: filtros reduziram a
  // lista), corrige automaticamente em vez de mostrar uma pagina vazia.
  useEffect(() => {
    if (currentPage !== safePage) onPageChange(safePage);
  }, [currentPage, safePage, onPageChange]);

  const pages: Array<number | 'ellipsis'> = [];
  const radius = 1;
  const start = Math.max(1, safePage - radius);
  const end = Math.min(totalPages, safePage + radius);

  if (start > 1) pages.push(1);
  if (start > 2) pages.push('ellipsis');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push('ellipsis');
  if (end < totalPages) pages.push(totalPages);

  const navButton =
    'inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[var(--color-border-default)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav
      aria-label={t('pagination.label')}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-default)] dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase text-slate-500">{t('pagination.pageSize')}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border-default)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-800"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} {t('pagination.perPage')}
              </option>
            ))}
          </select>
        </label>

        <span className="text-[10px] font-bold text-slate-500">
          {totalItems === 0
            ? t('pagination.empty')
            : `${t('pagination.showing')} ${formatNumber(startItem)}–${formatNumber(endItem)} ${t('pagination.of')} ${formatNumber(totalItems)} ${t('pagination.records')}`}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className={navButton}
          title={t('pagination.first')}
          aria-label={t('pagination.first')}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('pagination.first')}</span>
        </button>

        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className={navButton}
          title={t('pagination.previous')}
          aria-label={t('pagination.previous')}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {pages.map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="select-none px-2 font-bold text-slate-400">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={page === safePage ? 'page' : undefined}
              style={{ minWidth: 34, minHeight: 34 }}
              className={`inline-flex min-h-[34px] min-w-9 items-center justify-center rounded-lg border text-[11px] font-bold transition ${
                page === safePage
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-[var(--color-border-default)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          className={navButton}
          title={t('pagination.next')}
          aria-label={t('pagination.next')}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className={navButton}
          title={t('pagination.last')}
          aria-label={t('pagination.last')}
        >
          <span className="hidden sm:inline">{t('pagination.last')}</span>
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
};
