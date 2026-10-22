import React from 'react';
import type { TooltipContentProps } from 'recharts';
import { chartColors, formatChartNumber } from './chartTheme';

type ChartTooltipProps = Omit<Partial<TooltipContentProps<number | string, string>>, 'formatter'> & {
  valueFormatter?: (value: number | string) => string;
  formatter?: (value: number | string, name?: string | number) => [string, string] | string;
  unit?: string;
};

export const ChartTooltip = ({ active, label, payload, valueFormatter, formatter, unit }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[168px] rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/95 p-3.5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
      <div className="mb-2.5 flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-2.5">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {label ?? 'Período'}
        </span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chartColors.primary }} />
      </div>
      <div className="space-y-2">
        {payload.map((entry, index) => {
          const rawValue = entry.value as number | string;
          const formatted = formatter ? formatter(rawValue, String(entry.name || entry.dataKey || '')) : null;
          const displayValue = Array.isArray(formatted)
            ? formatted[0]
            : formatted || (valueFormatter ? valueFormatter(rawValue) : formatChartNumber(rawValue, unit));
          const displayName = Array.isArray(formatted) ? formatted[1] : String(entry.name || 'Valor');
          return (
            <div key={`${entry.dataKey ?? entry.name ?? 'series'}-${index}`} className="flex items-center justify-between gap-5 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--color-text-default)]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--color-bg-surface)]"
                  style={{ backgroundColor: entry.color || chartColors.primary }}
                />
                <span className="truncate">{displayName}</span>
              </span>
              <strong className="shrink-0 font-mono font-black text-[var(--color-text-strong)]">{displayValue}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};
