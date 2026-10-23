import React from 'react';
import { StatTone, accentVar } from './tones';

export type { StatTone };

interface StatCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'className'> {
  value: React.ReactNode;
  label: string;
  icon?: React.ElementType;
  tone?: StatTone;
  /** Variação opcional (ex.: «+12% este mês»). */
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  /** Quando presente, o cartão é interactivo (botão com aria-pressed). */
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

const deltaColor: Record<'up' | 'down' | 'flat', string> = {
  up: 'var(--color-green-700)',
  down: 'var(--color-red-700)',
  flat: 'var(--color-text-muted)',
};

const deltaArrow: Record<'up' | 'down' | 'flat', string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

/**
 * Cartão de estatística (KPI) com acabamento moderno: barra de acento no topo,
 * tile de ícone sólido na cor do tom, valor em tabular-nums e delta com seta.
 * Suporta estado activo para grelhas de métricas clicáveis (overview admin).
 */
export const StatCard: React.FC<StatCardProps> = ({ value, label, icon: Icon, tone = 'primary', delta, onClick, active = false, className = '', ...rest }) => {
  const interactive = Boolean(onClick);
  const accent = accentVar[tone];
  const shell = `group relative w-full overflow-hidden rounded-[var(--radius-xl)] border ${active ? 'border-[var(--color-border-strong)]' : 'border-[var(--color-border-subtle)]'} bg-[var(--color-bg-surface)] shadow-[var(--shadow-xs)] ${interactive ? 'cursor-pointer text-left transition-[transform,box-shadow,border-color] duration-[var(--duration-normal)] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]' : ''} ${className}`;

  const content = (
    <>
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} aria-hidden="true" />
      <div className="p-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
          {Icon && (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--shadow-xs)]"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>
        <p className="mt-2 text-2xl font-black tabular-nums text-[var(--color-text-strong)]">{value}</p>
        {delta && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-bold" style={{ color: deltaColor[delta.direction] }}>
            <span aria-hidden="true">{deltaArrow[delta.direction]}</span>
            <span>{delta.value}</span>
          </p>
        )}
      </div>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={shell} {...rest}>
        {content}
      </button>
    );
  }

  return <div className={shell} {...rest}>{content}</div>;
};