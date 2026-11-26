import React from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, required, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold text-[var(--color-text-strong)]">
      {label}{required && <span className="ml-1 text-[var(--color-state-danger)]" aria-hidden="true">*</span>}
    </label>
    {children}
    {error ? (
      <p className="text-xs font-medium text-[var(--color-text-danger)]" role="alert">{error}</p>
    ) : hint ? (
      <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
    ) : null}
  </div>
);

export const fieldClassName = 'min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-input)] bg-[var(--color-bg-surface)] placeholder:text-[var(--color-text-muted)] px-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-border-strong)] focus:ring-4 focus:ring-[var(--color-focus-ring)]';
