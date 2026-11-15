import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Indicadores compactos mostrados a direita do titulo. */
  metrics?: Array<{ label: string; value: string | number }>;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
  actionsClassName?: string;
  actionsStyle?: React.CSSProperties;
}

/**
 * Cabecalho de submodulo: titulo + descricao contextual + indicadores + acoes.
 * Cada submodulo tem o seu proprio cabecalho, para que a seccao se apresente
 * como uma pagina independente e nao como uma variacao da anterior.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  metrics,
  icon: Icon,
  actions,
  className = '',
  actionsClassName = '',
  actionsStyle,
}) => (
  <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
    <div className="min-w-0 space-y-0.5">
      <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900 sm:text-[15px]">
        {Icon && <Icon className="h-4 w-4 text-indigo-600" />}
        <span className="truncate">{title}</span>
      </h2>
      {description && <p className="max-w-2xl text-[11px] leading-relaxed text-slate-500">{description}</p>}
    </div>

    {(metrics?.length || actions) && (
      <div className={`flex flex-wrap items-center gap-2 ${actionsClassName}`} style={actionsStyle}>
        {metrics?.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-1 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">{metric.label}</div>
            <div className="text-[11px] font-black tabular-nums text-slate-800">{metric.value}</div>
          </div>
        ))}
        {actions}
      </div>
    )}
  </header>
);
