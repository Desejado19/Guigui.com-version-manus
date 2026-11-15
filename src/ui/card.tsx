import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, padded = true, className = '', children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[
        'rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-26px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.02] dark:ring-white/[0.03]',
        padded ? 'p-3.5 sm:p-4' : '',
        interactive
          ? 'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_18px_40px_-28px_rgba(15,23,42,0.4)] cursor-pointer'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className = '', children, ...props }, ref) {
    return (
      <div ref={ref} className={['flex items-start justify-between gap-3 pb-2.5 border-b border-[var(--color-border-subtle)]', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </div>
    );
  },
);

CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className = '', children, ...props }, ref) {
    return (
      <h3 ref={ref} className={['text-sm font-bold tracking-tight text-[var(--color-text-strong)]', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </h3>
    );
  },
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className = '', children, ...props }, ref) {
    return (
      <p ref={ref} className={['text-[11px] leading-relaxed text-[var(--color-text-muted)] mt-0.5', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </p>
    );
  },
);

CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className = '', children, ...props }, ref) {
    return (
      <div ref={ref} className={['text-sm text-[var(--color-text-default)]', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </div>
    );
  },
);

CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className = '', children, ...props }, ref) {
    return (
      <div ref={ref} className={['flex items-center gap-2 pt-3 border-t border-[var(--color-border-subtle)]', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </div>
    );
  },
);

CardFooter.displayName = 'CardFooter';
