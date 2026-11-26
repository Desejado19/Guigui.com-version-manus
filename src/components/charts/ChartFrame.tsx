import React from 'react';
import { chartColors } from './chartTheme';

interface ChartFrameProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  height?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const heightClasses = {
  sm: 'h-56 sm:h-60',
  md: 'h-64 sm:h-72',
  lg: 'h-72 sm:h-80',
} as const;

export const ChartFrame = ({ title, description, eyebrow, action, height = 'md', className = '', children, ...props }: ChartFrameProps) => (
  <section
    className={`guigui-chart-surface overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-5 shadow-[var(--shadow-sm)] sm:p-6 ${className}`}
    {...props}
  >
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-green-700)] dark:text-[var(--color-green-400)]">{eyebrow}</p>}
        <h3 className="text-sm font-black tracking-[-0.01em] text-[var(--color-text-strong)] sm:text-base">{title}</h3>
        {description && <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[var(--color-text-muted)]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
    <div className={`relative w-full ${heightClasses[height]}`} style={{ '--chart-grid': chartColors.grid } as React.CSSProperties}>
      {children}
    </div>
  </section>
);
