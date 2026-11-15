import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ interactive = false, className = '', children, ...props }) => (
  <div
    className={`rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 shadow-[var(--shadow-sm)] ${interactive ? 'transition-[transform,box-shadow,border-color] duration-[var(--duration-normal)] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);
