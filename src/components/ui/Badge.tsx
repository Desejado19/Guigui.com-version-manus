import React from 'react';

export type BadgeVariant = 'neutral' | 'verified' | 'success' | 'warning' | 'danger' | 'info' | 'premium';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// Nota: o tamanho usa o prefixo explícito `length:` — sem ele o Tailwind não
// consegue distinguir `text-[var(--text-xs)]` de uma cor e emite também
// `color: var(--text-xs)`, que é inválido e anula a cor da variante (o texto
// fica com a cor herdada do fundo e perde contraste no tema escuro).
const classes: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-default)] border-[var(--color-border-default)] dark:border-[var(--color-border-subtle)]',
  verified: 'bg-[var(--color-bg-brand)] text-white border-transparent',
  success: 'bg-[var(--color-green-50)] text-[var(--color-green-800)] border-[var(--color-green-100)] dark:bg-[var(--color-green-950)] dark:text-[var(--color-green-200)] dark:border-[var(--color-green-900)]',
  warning: 'bg-[var(--color-yellow-100)] text-[var(--color-yellow-700)] border-transparent dark:bg-[var(--color-yellow-900)] dark:text-[var(--color-yellow-200)]',
  danger: 'bg-[var(--color-red-100)] text-[var(--color-red-700)] border-transparent dark:bg-[var(--color-red-900)] dark:text-[var(--color-red-200)]',
  info: 'bg-[var(--color-blue-100)] text-[var(--color-blue-700)] border-transparent dark:bg-[var(--color-blue-900)] dark:text-[var(--color-blue-200)]',
  premium: 'bg-[var(--color-gold-100)] text-[var(--color-gold-700)] border-transparent dark:bg-[var(--color-gold-950)] dark:text-[var(--color-gold-200)]',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', className = '', children, ...props }) => (
  <span className={`inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-1 text-[length:var(--text-xs)] font-bold leading-none transition-[transform,box-shadow,opacity] duration-[var(--duration-fast)] hover:-translate-y-px ${classes[variant]} ${className}`} {...props}>
    {children}
  </span>
);
