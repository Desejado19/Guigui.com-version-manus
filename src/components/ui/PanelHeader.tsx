import React from 'react';
import { StatTone, accentVar } from './tones';

export type PanelHeaderTone = StatTone;

interface PanelHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ElementType;
  tone?: PanelHeaderTone;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho de painel com acabamento moderno: barra lateral de acento na cor
 * do tom, tile de ícone sólido, hierarquia eyebrow → título → descrição e
 * acções à direita. Escala única para todos os dashboards.
 */
export const PanelHeader: React.FC<PanelHeaderProps> = ({ eyebrow, title, description, icon: Icon, tone = 'primary', actions, className = '' }) => {
  const accent = accentVar[tone];
  return (
    <div className={`relative flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3 pl-4 ${className}`}>
      <span className="absolute bottom-1 left-0 top-1 w-1 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--shadow-xs)]"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{eyebrow}</p>
          )}
          <h2 className={`font-black text-[var(--color-text-strong)] ${eyebrow ? 'mt-0.5 ' : ''}text-base sm:text-lg`}>{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
};