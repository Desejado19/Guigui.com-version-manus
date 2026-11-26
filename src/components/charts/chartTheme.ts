export const chartColors = {
  primary: 'var(--color-green-600)',
  primaryStrong: 'var(--color-green-800)',
  info: 'var(--color-blue-600)',
  accent: 'var(--color-gold-500)',
  accentStrong: 'var(--color-gold-600)',
  warm: 'var(--color-coral-500)',
  danger: 'var(--color-red-600)',
  neutral: 'var(--color-neutral-500)',
  grid: 'var(--color-neutral-200)',
  axis: 'var(--color-neutral-500)',
  surface: 'var(--color-bg-surface)',
} as const;

export const chartSeriesColors = [
  chartColors.primary,
  chartColors.info,
  chartColors.accent,
  chartColors.warm,
  chartColors.primaryStrong,
] as const;

export function formatChartNumber(value: number | string, unit?: string): string {
  if (typeof value === 'string' && value.trim() && !/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(value.trim())) {
    return unit ? `${value} ${unit}` : value;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const formatted = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(numeric);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatCompactNumber(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (Math.abs(numeric) >= 1_000_000) return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(numeric / 1_000_000)}M`;
  if (Math.abs(numeric) >= 1_000) return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(numeric / 1_000)}k`;
  return formatChartNumber(numeric);
}
