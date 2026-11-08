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
        'rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-xs)]',
        flush ? '' : 'p-4 sm:p-5',
        padded && flush ? 'p-4 sm:p-5' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {flush && <div className="px-4 sm:px-5">{children}</div>}
      {!flush && children}
    </div>
  );
});

Panel.displayName = 'Panel';

export const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(function PanelHeader(
  { eyebrow, title, description, icon, actions, className = '', ...props },
  ref,
) {
  const eyebrowEl = eyebrow ? (
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{eyebrow}</p>
  ) : null;

  return (
    <div ref={ref} className={['flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3', className].filter(Boolean).join(' ')} {...props}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--shadow-xs)]" style={{ backgroundColor: 'var(--color-bg-brand)' }} aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrowEl}
          <h2 className="font-black text-[var(--color-text-strong)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>
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
