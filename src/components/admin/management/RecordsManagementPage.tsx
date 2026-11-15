import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { matchesSearch, paginateItems, useManagementListState } from './managementState';
import {
  ManagementActionButton,
  ManagementFilter,
  ManagementPage,
  ManagementPagination,
  ManagementTable,
  ManagementToolbar,
  type ManagementColumn,
  type ManagementKpi,
} from './ManagementUi';
import { exportManagementCsv, exportManagementExcel, exportManagementPdf, type ManagementExportCell } from './managementExports';

export interface RecordsFilterConfig {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface RecordsManagementPageProps<Row> {
  title: string;
  description: string;
  moduleLabel: string;
  storageKey: string;
  onBack: () => void;
  rows: Row[];
  rowKey: (row: Row) => string;
  searchPlaceholder: string;
  searchFields: (row: Row) => Array<unknown>;
  filters: RecordsFilterConfig[];
  matchesFilters: (row: Row, filters: Record<string, string>) => boolean;
  sortValue?: (row: Row, key: string) => string | number;
  defaultSortKey: string;
  defaultSortDirection?: 'asc' | 'desc';
  columns: Array<ManagementColumn<Row>>;
  kpis?: ManagementKpi[];
  actions?: React.ReactNode;
  exportSpec: {
    filename: string;
    sheet: string;
    title: string;
    description: string;
    headers: string[];
    row: (row: Row) => ManagementExportCell[];
    pdfKpis?: ManagementKpi[];
  };
  detail?: (row: Row) => React.ReactNode;
  detailLabel?: (row: Row) => string;
  emptyMessage?: string;
  notice?: React.ReactNode;
  rowActions?: (row: Row) => React.ReactNode;
}

const initialFilterRecord = (filters: RecordsFilterConfig[]) =>
  Object.fromEntries(filters.map((filter) => [filter.key, 'all'])) as Record<string, string>;

export function RecordsManagementPage<Row>({
  title,
  description,
  moduleLabel,
  storageKey,
  onBack,
  rows,
  rowKey,
  searchPlaceholder,
  searchFields,
  filters,
  matchesFilters,
  sortValue,
  defaultSortKey,
  defaultSortDirection = 'desc',
  columns,
  kpis,
  actions,
  exportSpec,
  detail,
  detailLabel,
  emptyMessage,
  notice,
  rowActions,
}: RecordsManagementPageProps<Row>) {
  const list = useManagementListState<string>(storageKey, initialFilterRecord(filters), defaultSortKey, defaultSortDirection);
  const { state, setQuery, setFilter } = list;
  const [detailRow, setDetailRow] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    const filteredRows = rows.filter((row) => matchesSearch(state.query, searchFields(row)) && matchesFilters(row, state.filters));
    if (!sortValue) return filteredRows;
    const direction = state.sortDirection === 'asc' ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = sortValue(left, state.sortKey);
      const rightValue = sortValue(right, state.sortKey);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') return (leftValue - rightValue) * direction;
      return String(leftValue).localeCompare(String(rightValue), 'pt') * direction;
    });
  }, [matchesFilters, rows, searchFields, sortValue, state.filters, state.query, state.sortDirection, state.sortKey]);

  const page = paginateItems(filtered, state.page, state.pageSize);

  const runExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    const exportRows = filtered.map(exportSpec.row);
    if (format === 'csv') {
      exportManagementCsv(`${exportSpec.filename}.csv`, exportSpec.headers, exportRows);
      return;
    }
    if (format === 'xlsx') {
      exportManagementExcel(`${exportSpec.filename}.xlsx`, exportSpec.sheet, exportSpec.headers, exportRows);
      return;
    }
    exportManagementPdf({
      title: exportSpec.title,
      description: exportSpec.description,
      kpis: (exportSpec.pdfKpis || []).map((kpi) => ({ label: kpi.label, value: String(kpi.value) })),
      headers: exportSpec.headers,
      rows: exportRows,
    });
  };

  const columnsWithDetail: Array<ManagementColumn<Row>> = [
    ...columns,
    ...(rowActions
      ? [{
          key: 'actions',
          label: 'Ações',
          className: 'text-right',
          render: (row: Row) => <div className="flex justify-end">{rowActions(row)}</div>,
        }]
      : []),
    ...(detail
      ? [{
          key: 'detail',
          label: 'Detalhe',
          className: 'text-right',
          render: (row: Row) => (
            <ManagementActionButton onClick={() => setDetailRow(row)}>
              Ver detalhe
            </ManagementActionButton>
          ),
        }]
      : []),
  ];

  return (
    <ManagementPage
      title={title}
      description={description}
      moduleLabel={moduleLabel}
      onBack={onBack}
      kpis={kpis}
      actions={
        <>
          {actions}
          <ManagementActionButton onClick={() => runExport('csv')}><Download className="h-3.5 w-3.5" /> CSV</ManagementActionButton>
          <ManagementActionButton onClick={() => runExport('xlsx')}><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</ManagementActionButton>
          <ManagementActionButton onClick={() => runExport('pdf')}><FileText className="h-3.5 w-3.5" /> PDF</ManagementActionButton>
        </>
      }
    >
      {notice}

      <ManagementToolbar
        query={state.query}
        onQueryChange={setQuery}
        placeholder={searchPlaceholder}
        totalLabel={`${filtered.length} registo(s) · página ${page.page} de ${page.totalPages}`}
        onReset={list.reset}
      >
        {filters.map((filter) => (
          <ManagementFilter
            key={filter.key}
            label={filter.label}
            value={state.filters[filter.key] || 'all'}
            onChange={(value) => setFilter(filter.key, value)}
            options={filter.options}
          />
        ))}
      </ManagementToolbar>

      <ManagementTable
        columns={columnsWithDetail}
        rows={page.items}
        rowKey={rowKey}
        sortKey={state.sortKey}
        sortDirection={state.sortDirection}
        onSort={sortValue ? list.setSort : undefined}
        emptyMessage={emptyMessage}
      />

      <ManagementPagination
        page={page.page}
        pageSize={state.pageSize}
        totalItems={page.totalItems}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
      />

      {detailRow && detail && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4" role="dialog" aria-modal="true" aria-label={detailLabel?.(detailRow) || 'Detalhe do registo'}>
          <div className="my-6 w-full max-w-3xl rounded-2xl border border-[#e6dac8] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
              <h3 className="text-sm font-black text-slate-900">{detailLabel?.(detailRow) || 'Detalhe do registo'}</h3>
              <button type="button" onClick={() => setDetailRow(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fechar detalhe">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">{detail(detailRow)}</div>
          </div>
        </div>
      )}
    </ManagementPage>
  );
}
