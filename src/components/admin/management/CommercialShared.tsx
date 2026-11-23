import React from 'react';
import { Loader2, X } from 'lucide-react';
import { ManagementActionButton, ManagementPage, type ManagementKpi } from './ManagementUi';
import { commercialStatusLabel } from './commercialApi';

export const CommercialLoading: React.FC<{ label?: string }> = ({ label = 'A carregar o catálogo comercial…' }) => (
  <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-8 text-[11px] font-bold text-slate-500 shadow-sm">
    <Loader2 className="h-4 w-4 animate-spin" /> {label}
  </div>
);

export const CommercialMessage: React.FC<{ tone: 'success' | 'error'; children: React.ReactNode }> = ({ tone, children }) => (
  <div role="status" className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${tone === 'error' ? 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]' : 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'}`}>
    {children}
  </div>
);

export const CommercialModal: React.FC<{
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
      <div role="dialog" aria-modal="true" aria-label={title} className={`my-2 w-full rounded-2xl border border-[var(--color-border-default)] bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] p-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-default)] text-slate-500 hover:border-[var(--color-green-700)] hover:text-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border-subtle)] p-3">{footer}</div>}
      </div>
    </div>
  );
};

export const CommercialField: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className = '' }) => (
  <label className={`flex flex-col gap-1 ${className}`}>
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
    {children}
    {hint && <span className="text-[9.5px] leading-relaxed text-slate-500">{hint}</span>}
  </label>
);

export const commercialInputClass = 'w-full rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-800 outline-none transition focus:border-[var(--color-focus-ring)] focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-ring)]/25 disabled:opacity-60';

export const CommercialPageShell: React.FC<{
  title: string;
  description: string;
  onBack: () => void;
  breadcrumb: string;
  kpis?: ManagementKpi[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, onBack, breadcrumb, kpis, actions, children }) => (
  <ManagementPage
    title={title}
    description={description}
    moduleLabel="Planos & Assinaturas"
    breadcrumbTail={breadcrumb}
    onBack={onBack}
    kpis={kpis}
    actions={actions}
  >
    {children}
  </ManagementPage>
);

export const CommercialStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone = status === 'active' ? 'bg-[var(--tone-success-bg)] text-[var(--tone-success-text)] border-[var(--tone-success-border)]'
    : status === 'pending' ? 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)] border-[var(--tone-warning-border)]'
      : status === 'suspended' ? 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)] border-[var(--tone-warning-border)]'
        : status === 'cancelled' ? 'bg-slate-100 text-slate-700 border-[var(--color-border-default)]'
          : 'bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)] border-[var(--tone-danger-border)]';
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${tone}`}>{commercialStatusLabel[status] || status}</span>;
};

export const CommercialSaveButton: React.FC<{ busy?: boolean; children?: React.ReactNode; onClick?: () => void }> = ({ busy, children = 'Guardar alterações', onClick }) => (
  <ManagementActionButton type={onClick ? 'button' : 'submit'} tone="primary" disabled={busy} onClick={onClick}>
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
    {busy ? 'A guardar…' : children}
  </ManagementActionButton>
);
