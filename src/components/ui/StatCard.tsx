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
  /** Contexto curto mostrado no rodapé, no mesmo formato dos restantes painéis. */
  hint?: React.ReactNode;
  /** Quando presente, o cartão é interactivo (botão com aria-pressed). */
  onClick?: () => void;
  active?: boolean;
  /** Acção secundária no rodapé, sem tornar todo o cartão num botão. */
  action?: { label: string; onClick: () => void; ariaLabel?: string };
  className?: string;
}

const deltaColor: Record<'up' | 'down' | 'flat', string> = {
  up: 'var(--color-text-positive)',
  down: 'var(--color-text-negative)',
  flat: 'var(--color-text-muted)',
};

const deltaArrow: Record<'up' | 'down' | 'flat', string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

/**
 * Cartão de estatística (KPI) premium: barra de acento fina no topo, tile de
 * ícone com fundo pastel (color-mix) e ícone na cor do tom, valor em
 * tabular-nums e rodapé com delta ou legenda. Suporta estado activo para
 * grelhas de métricas clicáveis (overview admin), onde a borda e o anel
 * refletem a métrica em destaque no gráfico.
 */
export const StatCard: React.FC<StatCardProps> = ({ value, label, icon: Icon, tone = 'primary', delta, hint, action, onClick, active = false, className = '', ...rest }) => {
  const interactive = Boolean(onClick);
  const accent = accentVar[tone];
  const shell = `group relative flex w-full flex-col overflow-hidden rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-26px_rgba(15,23,42,0.35)] transition-[transform,box-shadow,border-color] duration-[var(--duration-normal)] ease-[var(--ease-standard)] ${interactive ? 'hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_18px_40px_-28px_rgba(15,23,42,0.4)]' : ''} ${active ? 'shadow-[var(--shadow-md)]' : ''} ${className}`;
  const borderStyle = active
    ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }
    : undefined;

  const content = (
    <>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent }} aria-hidden="true" />
      <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          {Icon ? (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset ring-white/30"
              style={{ backgroundColor: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : (
            <span className="h-8 w-8 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 break-normal text-right text-[8.5px] font-black uppercase leading-tight tracking-[0.07em] text-[var(--color-text-muted)]">{label}</span>
        </div>
        <div>
          <p className="text-[clamp(1.1rem,1.9vw,1.35rem)] font-black leading-none tabular-nums text-[var(--color-text-strong)] [overflow-wrap:anywhere]">{value}</p>
          {delta ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-bold" style={{ color: deltaColor[delta.direction] }}>
              <span aria-hidden="true">{deltaArrow[delta.direction]}</span>
              <span>{delta.value}</span>
            </p>
          ) : hint ? (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">{hint}</p>
          ) : null}
        </div>
      </div>
    </>
  );

  const actionFooter = action ? (
    <div className="border-t border-[var(--color-border-subtle)] px-4 py-2">
      <button
        type="button"
        onClick={action.onClick}
        aria-label={action.ariaLabel || action.label}
        className="inline-flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.08em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-green-700)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {action.label}
        <span aria-hidden="true">→</span>
      </button>
    </div>
  ) : null;

  if (interactive) {
    return (
      <div style={borderStyle} className={shell} data-dashboard-stat="true">
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          className="flex w-full flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          {...rest}
        >
          {content}
        </button>
        {actionFooter}
      </div>
    );
  }

  return <div style={borderStyle} className={shell} data-dashboard-stat="true" {...rest}>{content}{actionFooter}</div>;
};