import React from 'react';
import { Slot } from '@radix-ui/react-slot';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

interface AsButtonProps extends ButtonBaseProps {
  asChild?: false;
}

interface AsAnchorProps extends ButtonBaseProps {
  asChild: true;
  href?: string;
}

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> &
  AsButtonProps & {
    asChild?: false;
  } & React.RefAttributes<HTMLButtonElement> |
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> &
    AsAnchorProps & {
      asChild: true;
    } & React.RefAttributes<HTMLAnchorElement>;

const base =
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
    'bg-[var(--color-bg-brand)] text-[var(--color-text-on-brand)] shadow-[0_1px_0_var(--color-border-strong)] hover:brightness(96) active:shadow-[0_1px_0_0_var(--color-bg-brand)]',
  secondary:
    'bg-[var(--color-bg-surface)] text-[var(--color-text-strong)] shadow-[0_1px_0_var(--color-border-subtle)] hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg-strong)]',
  outline:
    'border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-strong)] hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg-strong)]',
  ghost: 'bg-transparent text-[var(--color-text-strong)] hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg-strong)]',
  link: 'bg-transparent text-[var(--color-text-link)] hover:bg-[var(--color-bg-brand-soft)]',
  destructive:
    'bg-[var(--color-red-600)] text-white shadow-[0_1px_0_0_var(--color-border-strong)] hover:brightness(96) active:shadow-[0_1px_0_0_var(--color-red-500)]',
  success:
    'bg-[var(--color-green-600)] text-white shadow-[0_1px_0_0_var(--color-border-strong)] hover:brightness(96) active:shadow-[0_1px_0_0_var(--color-green-500)]',
};

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      className = '',
      asChild = false,
      children,
      type = 'button',
      href,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild && href ? 'a' : asChild ? Slot : 'button';
    const classNames = [
      base,
      sizeClasses[size],
      variantClasses[variant],
      loading && 'pointer-events-none',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    if (asChild) {
      const anchor = Comp as keyof JSX.IntrinsicElements;
      return (
        <Comp
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classNames}
          href={href}
          {...props}
        >
          {icon}
          {loading ? <Spinner className="hidden md:inline-flex" /> : iconRight ? null : null}
          {children}
          {!iconRight ? null : iconRight}
        </Comp>
      );
    }

    return (
      <Comp
        ref={ref as React.Ref<HTMLButtonElement>}
        type={anchor === 'button' ? type : undefined}
        className={classNames}
        aria-busy={loading || undefined}
        aria-disabled={loading || props.disabled ? true : undefined}
        {...props}
      >
        {icon}
        {loading ? <Spinner /> : iconRight ? null : null}
        {children}
        {!loading && iconRight}
      </Comp>
    );
  },
);

Button.displayName = 'Button';

export const Spinner = ({ className = '' }: { className?: string }) => (
  <svg
    className={`animate-spin pointer-events-none h-4 w-4 text-[var(--color-text-on-brand)] ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);
