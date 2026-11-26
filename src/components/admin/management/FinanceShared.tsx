import React from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import { ManagementActionButton } from './ManagementUi';

export const FinanceLoading: React.FC<{ label?: string }> = ({ label = 'A carregar dados financeiros…' }) => (
  <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-8 text-[11px] font-bold text-slate-500 shadow-sm">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

export const FinanceMessage: React.FC<{ tone: 'error' | 'success'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    role="status"
    className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${
      tone === 'error'
        ? 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'
        : 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
    }`}
  >
    {children}
  </div>
);

export const FinanceExportButtons: React.FC<{ onExport: (format: 'csv' | 'excel' | 'pdf') => void }> = ({ onExport }) => (
  <>
    <ManagementActionButton onClick={() => onExport('csv')} title="Exportar CSV">
      <Download className="h-3.5 w-3.5" /> CSV
    </ManagementActionButton>
    <ManagementActionButton onClick={() => onExport('excel')} title="Exportar Excel">
      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
    </ManagementActionButton>
    <ManagementActionButton onClick={() => onExport('pdf')} title="Exportar PDF">
      <FileText className="h-3.5 w-3.5" /> PDF
    </ManagementActionButton>
  </>
);

export const FinanceModal: React.FC<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ open, title, description, onClose, children, footer, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`my-2 w-full rounded-2xl border border-[var(--color-border-default)] bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] p-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-default)] text-slate-500 transition hover:border-[var(--color-green-700)] hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border-subtle)] p-3">{footer}</div>}
      </div>
    </div>
  );
};

export const FinanceField: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
    {children}
    {hint && <span className="text-[9.5px] font-medium leading-relaxed text-slate-500">{hint}</span>}
  </label>
);

export const financeInputClass = 'w-full rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-800 outline-none transition focus:border-[var(--color-focus-ring)] focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-ring)]/25 disabled:cursor-not-allowed disabled:opacity-60';
