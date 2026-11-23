import React from 'react';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Densidade do conteúdo: `compact` (padrão, p-4 sm:p-5) ou `default` (p-5 sm:p-6). */
  padding?: 'compact' | 'default';
}

/**
 * Casca de painel dos dashboards: superfície, raio, borda e sombra via tokens
 * semânticos — o tema claro/escuro funciona sem classes `dark:` adicionais.
 */
export const Panel: React.FC<PanelProps> = ({ padding = 'compact', className = '', children, ...props }) => (
  <div
    className={`rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-xs)] ${padding === 'compact' ? 'p-4 sm:p-5' : 'p-5 sm:p-6'} ${className}`}
    {...props}
  >
    {children}
  </div>
);