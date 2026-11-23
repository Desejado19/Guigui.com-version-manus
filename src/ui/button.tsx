import React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'destructive'
  | 'success'
  | 'accent'
  | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
  /** Renderiza um <a> (quando há `href`) ou um elemento customizado. */
  asChild?: boolean;
  href?: string;
}

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps>,
    ButtonOwnProps {}

export type AnchorButtonProps = ButtonProps & React.AnchorHTMLAttributes<HTMLAnchorElement>;
export type AnyButtonProps = ButtonProps;

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      children,
      className = '',
      asChild = false,
      href,
      type,
      disabled,
      ...rest
    },
    ref,
  ) {
    const classes = [
      baseClasses,
      sizeClasses[size],
      variantClasses[variant],
      loading ? 'pointer-events-none' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const content = (
      <>
        {icon}
        {loading ? <Spinner size="sm" /> : null}
        {children}
        {!loading && iconRight}
      </>
    );

    if (asChild && href) {
      return (
        <a
          {...(rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          href={href}
          aria-busy={loading || undefined}
          aria-disabled={loading ? true : undefined}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        {...rest}
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type ?? 'button'}
        disabled={loading || disabled}
        aria-busy={loading || undefined}
        aria-disabled={loading ? true : undefined}
        className={classes}
      >
        {content}
      </button>
    );
  },
);

Button.displayName = 'Button';

const baseClasses =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-shadow outline-none outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2';

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-sm',
  icon: 'h-9 w-9 p-0',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-bg-brand)] text-[var(--color-text-on-brand)] shadow-[0_1px_0_var(--color-border-strong)] hover:bg-[var(--color-green-800)] active:bg-[var(--color-green-950)]',
  secondary:
    'bg-[var(--color-bg-surface)] text-[var(--color-text-strong)] shadow-[0_1px_0_var(--color-border-subtle)] hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg-strong)]',
  outline:
    'border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-strong)] hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg-strong)]',
  ghost: 'bg-transparent text-[var(--color-text-strong)] hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg-strong)]',
  link: 'bg-transparent text-[var(--color-text-link)] hover:bg-[var(--color-bg-brand-soft)]',
  destructive:
    'bg-[var(--color-red-700)] text-white shadow-[0_1px_0_0_var(--color-border-strong)] hover:bg-[var(--color-red-800)] active:bg-[var(--color-red-900)]',
  accent:
    'bg-[var(--color-coral-700)] text-white shadow-[0_1px_0_0_var(--color-border-strong)] hover:bg-[var(--color-coral-800)] active:bg-[var(--color-coral-900)]',
  danger:
    'bg-[var(--color-red-700)] text-white shadow-[0_1px_0_0_var(--color-border-strong)] hover:bg-[var(--color-red-800)] active:bg-[var(--color-red-900)]',
  success:
    'bg-[var(--color-green-700)] text-white shadow-[0_1px_0_0_var(--color-border-strong)] hover:bg-[var(--color-green-800)] active:bg-[var(--color-green-900)]',
};

export const Spinner = ({ size = 'sm', className = '' }: { size?: 'xs' | 'sm' | 'md'; className?: string }) => {
  const sizeMap = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  } as const;

  return (
    <svg
      className={`animate-spin pointer-events-none text-[var(--color-text-on-brand)] ${sizeMap[size]} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

export { Spinner as Loader };
