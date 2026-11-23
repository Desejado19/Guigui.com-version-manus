import React from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { AdminPagination } from '../AdminPagination';
import { MANAGEMENT_PAGE_SIZES, type SortDirection } from './managementState';

export interface ManagementKpi {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

const KPI_TONES: Record<NonNullable<ManagementKpi['tone']>, string> = {
  neutral: 'border-[var(--color-border-default)] bg-white text-slate-900',
  success: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]',
  warning: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]',
  danger: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]',
  info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
};

export const ManagementKpiGrid: React.FC<{ items: ManagementKpi[]; className?: string }> = ({ items, className = '' }) => (
  <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5 ${className}`}>
    {items.map((item) => (
      <div key={item.label} className={`rounded-2xl border p-3.5 shadow-sm ${KPI_TONES[item.tone || 'neutral']}`}>
        <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-70">{item.label}</div>
        <div className="mt-1.5 text-2xl font-black leading-none tabular-nums">{item.value}</div>
        {item.hint && <div className="mt-1 text-[10px] font-medium opacity-70">{item.hint}</div>}
      </div>
    ))}
  </div>
);

export interface ModuleNavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number | string | null;
}

/**
 * Navegação compacta de submódulos: cada botão abre directamente a
 * funcionalidade correspondente, sem cartões explicativos nem passos extra.
 */
export const ModuleNav: React.FC<{
  items: ModuleNavItem[];
  onSelect: (key: string) => void;
  ariaLabel?: string;
  className?: string;
}> = ({ items, onSelect, ariaLabel = 'Submódulos', className = '' }) => (
  <nav aria-label={ariaLabel} className={`grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
    {items.map((item) => (
      <button
        key={item.key}
        type="button"
        onClick={() => onSelect(item.key)}
        className="group flex min-h-[46px] items-center gap-2.5 rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-left transition hover:border-[var(--color-green-700)] hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123e3b]/20"
      >
        {item.icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-green-800)]">{item.icon}</span>
        )}
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-black text-slate-800">{item.label}</span>
        {item.count !== undefined && item.count !== null && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-black tabular-nums text-slate-600">{item.count}</span>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--color-green-800)]" />
      </button>
    ))}
  </nav>
);

interface ManagementPageProps {
  title: string;
  description: string;
  moduleLabel: string;
  onBack?: () => void;
  breadcrumbTail?: string;
  actions?: React.ReactNode;
  kpis?: ManagementKpi[];
  children: React.ReactNode;
}

export const ManagementPage: React.FC<ManagementPageProps> = ({
  title,
  description,
  moduleLabel,
  onBack,
  breadcrumbTail = 'Gestão',
  actions,
  kpis,
  children,
}) => (
  <div className="space-y-4 p-3.5 sm:p-4">
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-white px-2.5 py-1.5 text-[10px] font-black text-[var(--color-green-800)] transition hover:border-[var(--color-green-700)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar ao módulo
        </button>
      ) : null}
      <span>Administração</span>
      <span>/</span>
      <span className="text-slate-700">{moduleLabel}</span>
      <span>/</span>
      <span className="text-slate-900">{breadcrumbTail}</span>
    </div>

    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>

    {kpis && kpis.length > 0 && <ManagementKpiGrid items={kpis} />}

    {children}
  </div>
);

interface ManagementToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  totalLabel: React.ReactNode;
  children?: React.ReactNode;
  onReset?: () => void;
}

export const ManagementToolbar: React.FC<ManagementToolbarProps> = ({
  query,
  onQueryChange,
  placeholder = 'Pesquisar…',
  totalLabel,
  children,
  onReset,
}) => (
  <div className="space-y-2.5 rounded-2xl border border-[var(--color-border-default)] bg-white p-3.5 shadow-sm">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-xl border border-[var(--color-border-default)] bg-slate-50 py-2 pl-8 pr-3 text-[11px] font-medium text-slate-700 outline-none transition focus:border-[var(--color-focus-ring)] focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-ring)]/25"
        />
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 transition hover:border-[var(--color-green-700)] hover:text-[var(--color-green-800)]"
        >
          Limpar
        </button>
      )}
    </div>
    {children && <div className="flex flex-wrap items-end gap-2">{children}</div>}
    <div className="text-[10px] font-bold text-slate-500">{totalLabel}</div>
  </div>
);

export const ManagementFilter: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}> = ({ label, value, onChange, options, className = '' }) => (
  <label className={`flex min-w-[130px] flex-col gap-1 ${className}`}>
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-2.5 py-2 text-[11px] font-bold text-slate-800 outline-none transition focus:border-[var(--color-focus-ring)] focus:bg-white"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export interface ManagementColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface ManagementTableProps<T> {
  columns: Array<ManagementColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
}

export function ManagementTable<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDirection = 'asc',
  onSort,
  emptyMessage = 'Nenhum registo encontrado com os filtros atuais.',
  rowClassName,
}: ManagementTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-white shadow-sm">
      <div className="max-h-[calc(100vh-330px)] overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-[var(--color-bg-subtle)]">
            <tr>
              {columns.map((column) => {
                const isSorted = sortKey === column.key;
                return (
                  <th key={column.key} scope="col" className={`border-b border-[var(--color-border-default)] px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 ${column.className || ''}`}>
                    {column.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(column.key)}
                        className="inline-flex items-center gap-1 text-inherit transition hover:text-[var(--color-green-800)]"
                        title={`Ordenar por ${column.label}`}
                      >
                        {column.label}
                        {isSorted ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <span className="inline-block h-3 w-3 opacity-0">↕</span>
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[11px] font-medium text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className={`border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-bg-subtle)] ${rowClassName?.(row) || ''}`}>
                  {columns.map((column) => (
                    <td key={column.key} className={`px-3 py-2.5 align-middle text-slate-700 ${column.className || ''}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const ManagementPagination: React.FC<{
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}> = ({ page, pageSize, totalItems, onPageChange, onPageSizeChange }) => (
  <AdminPagination
    currentPage={page}
    pageSize={pageSize}
    totalItems={totalItems}
    onPageChange={onPageChange}
    onPageSizeChange={onPageSizeChange}
    pageSizeOptions={MANAGEMENT_PAGE_SIZES}
  />
);

export const ManagementRowActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-center justify-end gap-1">{children}</div>
);

export const ManagementActionButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'warning' }
> = ({ tone = 'neutral', className = '', children, ...rest }) => {
  const tones: Record<string, string> = {
    neutral: 'border-[var(--color-border-default)] bg-white text-slate-700 hover:border-[var(--color-green-700)]',
    primary: 'border-[var(--color-green-700)] bg-[var(--color-green-800)] text-white hover:bg-[#0c2f2c]',
    success: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)] hover:bg-[var(--tone-success-bg)]',
    danger: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)] hover:bg-[var(--tone-danger-bg)]',
    warning: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)] hover:bg-[var(--tone-warning-bg)]',
  };
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
};

export const ManagementCard: React.FC<{ title?: string; description?: string; children: React.ReactNode; className?: string }> = ({
  title,
  description,
  children,
  className = '',
}) => (
  <section className={`space-y-3 rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm ${className}`}>
    {title && (
      <div>
        <h3 className="text-[13px] font-black text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">{description}</p>}
      </div>
    )}
    {children}
  </section>
);

export const ManagementChevron = ChevronRight;
