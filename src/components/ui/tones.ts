/**
 * Tons semânticos partilhados (StatCard, PanelHeader). As cores usam tokens
 * canónicos via `var()`, imunes aos overrides `!important` do index.css.
 */
export type StatTone = 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'accent' | 'neutral';

export const accentVar: Record<StatTone, string> = {
  primary: 'var(--color-green-600)',
  success: 'var(--color-green-600)',
  warning: 'var(--color-gold-500)',
  info: 'var(--color-blue-700)',
  danger: 'var(--color-red-700)',
  accent: 'var(--color-gold-500)',
  neutral: 'var(--color-border-strong)',
};