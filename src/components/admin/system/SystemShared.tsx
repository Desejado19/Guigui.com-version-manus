import React from 'react';
import { AlertTriangle, CircleCheck, CircleDashed, Info, Loader2 } from 'lucide-react';
import { SYSTEM_STATUS_LABELS } from './systemApi';

export const systemTone: Record<string, string> = {
  operational: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]',
  resolved: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]',
  degraded: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]',
  warning: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]',
  acknowledged: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
  info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
  unavailable: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]',
  critical: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]',
  open: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]',
  not_configured: 'border-[var(--color-border-default)] bg-slate-100 text-slate-600',
  simulated: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
};

export const StatusPill: React.FC<{ status: string; label?: string }> = ({ status, label }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide ${systemTone[status] || systemTone.not_configured}`}>
    {label || SYSTEM_STATUS_LABELS[status] || status}
  </span>
);

export const SystemCard: React.FC<{
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, children, className = '' }) => (
  <section className={`rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm ${className}`}>
    {(title || actions) && (
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {title && <h3 className="text-[13px] font-black text-slate-900">{title}</h3>}
          {description && <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export const SystemMessage: React.FC<{ tone?: 'error' | 'warning' | 'info' | 'success'; children: React.ReactNode }> = ({
  tone = 'info',
  children,
}) => {
  const tones = {
    error: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]',
    warning: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]',
    info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
    success: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]',
  } as const;
  const Icon = tone === 'error' ? AlertTriangle : tone === 'success' ? CircleCheck : tone === 'warning' ? AlertTriangle : Info;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-[11px] font-medium leading-relaxed ${tones[tone]}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export const SystemLoading: React.FC<{ label?: string }> = ({ label = 'A recolher dados reais…' }) => (
  <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-10 text-[11px] font-bold text-slate-500">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

export const SystemEmpty: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-6 text-center text-[11px] font-medium text-slate-500">
    {text}
  </div>
);

export const SystemMetricTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}> = ({ label, value, hint, tone = 'neutral' }) => {
  const tones = {
    neutral: 'border-[var(--color-border-default)] bg-white text-slate-900',
    success: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]',
    warning: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]',
    danger: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]',
    info: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
  } as const;
  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm ${tones[tone]}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.15em] opacity-70">{label}</div>
      <div className="mt-1.5 text-[20px] font-black leading-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[9.5px] font-medium opacity-70">{hint}</div>}
    </div>
  );
};

/** Tabela simples e acessível. Colunas nunca inventam linhas: mostram vazio. */
export const SystemTable: React.FC<{
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
  rowKeys?: string[];
}> = ({ headers, rows, empty, rowKeys }) => (
  <div className="overflow-hidden rounded-xl border border-[var(--color-border-default)]">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[10.5px]">
        <thead className="bg-[var(--color-bg-subtle)]">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="border-b border-[var(--color-border-default)] px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-[11px] font-medium text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKeys?.[index] ?? index} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-bg-subtle)]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-2.5 py-2 align-top text-slate-700">
                    {cell}
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

export const UnavailableMetric: React.FC<{ label: string; reason?: string }> = ({ label, reason }) => (
  <div className="flex items-start gap-2 rounded-xl border border-dashed border-[var(--color-border-default)] bg-slate-50 p-2.5">
    <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
    <div>
      <div className="text-[10.5px] font-black text-slate-600">{label}</div>
      <div className="text-[10px] leading-relaxed text-slate-500">{reason || 'Não monitorizado.'}</div>
    </div>
  </div>
);

export const RefreshButton: React.FC<{ onClick: () => void; busy?: boolean }> = ({ onClick, busy }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--color-green-700)] bg-[var(--color-green-800)] px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-[#0c2f2c] disabled:opacity-50"
  >
    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CircleCheck className="h-3 w-3" />}
    Atualizar dados
  </button>
);
