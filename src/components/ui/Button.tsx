import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-bg-brand)] text-[var(--color-text-on-brand)] hover:bg-[var(--color-green-800)]',
  secondary: 'border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-strong)] hover:border-[var(--color-border-strong)]',
  accent: 'bg-[var(--color-bg-accent)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-gold-400)]',
  outline: 'border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-link)] hover:bg-[var(--color-bg-brand)] hover:text-[var(--color-text-on-brand)]',
  ghost: 'bg-transparent text-[var(--color-text-default)] hover:bg-[var(--color-bg-brand-soft)] hover:text-[var(--color-text-link)]',
  danger: 'bg-[var(--color-state-danger)] text-white hover:brightness-95',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-sm',
  icon: 'h-11 w-11 p-0 text-sm',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    type={props.type || 'button'}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-[var(--duration-normal)] ease-[var(--ease-standard)] hover:-translate-y-px active:translate-y-0 focus-visible:outline-0 focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-55 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    {...props}
  >
    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
    {children}
  </button>
));

Button.displayName = 'Button';
