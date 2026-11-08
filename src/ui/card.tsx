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
        'rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-xs)]',
        padded ? 'p-4 sm:p-5' : '',
        interactive
          ? 'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] cursor-pointer'
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
      <div ref={ref} className={['flex items-start justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </div>
    );
  },
);

CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className = '', children, ...props }, ref) {
    return (
      <h3 ref={ref} className={['text-base font-semibold text-[var(--color-text-strong)]', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </h3>
    );
  },
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className = '', children, ...props }, ref) {
    return (
      <p ref={ref} className={['text-xs text-[var(--color-text-muted)] mt-0.5', className].filter(Boolean).join(' ')} {...props}>
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
