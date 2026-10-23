import React from 'react';

export type BadgeVariant = 'neutral' | 'verified' | 'success' | 'warning' | 'danger' | 'info' | 'premium';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const classes: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-default)] border-[var(--color-border-default)]',
  verified: 'bg-[var(--color-bg-brand)] text-white border-transparent',
  success: 'bg-[var(--color-green-50)] text-[var(--color-green-800)] border-[var(--color-green-100)]',
  warning: 'bg-[var(--color-yellow-100)] text-[var(--color-yellow-700)] border-transparent',
  danger: 'bg-[var(--color-red-100)] text-[var(--color-red-700)] border-transparent',
  info: 'bg-[var(--color-blue-100)] text-[var(--color-blue-700)] border-transparent',
  premium: 'bg-[var(--color-gold-100)] text-[var(--color-gold-700)] border-transparent',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', className = '', children, ...props }) => (
  <span className={`inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-1 text-[var(--text-xs)] font-bold leading-none transition-[transform,box-shadow,opacity] duration-[var(--duration-fast)] hover:-translate-y-px ${classes[variant]} ${className}`} {...props}>
    {children}
  </span>
);
