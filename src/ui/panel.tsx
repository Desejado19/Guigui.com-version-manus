import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  flush?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { padded = true, flush = false, className = '', children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[
        'rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-26px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.02] dark:ring-white/[0.03]',
        flush ? '' : 'p-3.5 sm:p-4',
        padded && flush ? 'p-3.5 sm:p-4' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {flush && <div className="px-3.5 sm:px-4">{children}</div>}
      {!flush && children}
    </div>
  );
});

Panel.displayName = 'Panel';

export interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Aceita um elemento (`<Bell />`) ou o próprio componente (`Bell`). */
  icon?: React.ReactNode | React.ElementType;
  actions?: React.ReactNode;
}

/**
 * Os ícones do `lucide-react` são objectos `forwardRef` em React 19: se forem
 * passados como componente e renderizados directamente como filho, o React
 * lança "Objects are not valid as a React child" e a árvore desaparece.
 * Normalizar aqui aceita as duas formas em todos os painéis.
 */
function renderPanelIcon(icon: React.ReactNode | React.ElementType): React.ReactNode {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'function' || typeof icon === 'object') {
    const IconComponent = icon as React.ElementType<{ className?: string }>;
    return <IconComponent className="h-5 w-5" />;
  }
  return icon;
}

export const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(function PanelHeader(
  { eyebrow, title, description, icon, actions, className = '', ...props },
  ref,
) {
  const eyebrowEl = eyebrow ? (
    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{eyebrow}</p>
  ) : null;

  return (
          <div ref={ref} className={['flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-2.5', className].filter(Boolean).join(' ')} {...props}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white shadow-[0_2px_6px_-2px_rgba(15,23,42,0.35)]" style={{ backgroundColor: 'var(--color-bg-brand)' }} aria-hidden>
            {renderPanelIcon(icon)}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrowEl}
          <h2 className="text-sm font-black tracking-tight text-[var(--color-text-strong)] sm:text-[15px]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
});

PanelHeader.displayName = 'PanelHeader';

export const PanelTitleRegion = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function PanelTitleRegion({ className = '', children, ...props }, ref) {
    return (
      <div ref={ref} className={className} role="region" aria-label="Título do painel" {...props}>
        {children}
      </div>
    );
  },
);

PanelTitleRegion.displayName = 'PanelTitleRegion';
