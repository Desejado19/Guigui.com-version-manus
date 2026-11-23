import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface ModuleSubnavItem {
  id: string;
  label: string;
  description?: string;
}

interface ModuleSubnavProps {
  panelLabel: string;
  moduleLabel: string;
  items: ModuleSubnavItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Navegação interna de um módulo: breadcrumbs + um botão por submódulo.
 *
 * Só apresentação: quem usa decide o que renderizar para o `activeId`.
 */
export const ModuleSubnav: React.FC<ModuleSubnavProps> = ({
  panelLabel,
  moduleLabel,
  items,
  activeId,
  onChange,
  className = '',
}) => {
  const active = items.find((item) => item.id === activeId);
  return (
    <div className={`space-y-2 ${className}`}>
      <nav aria-label={`Localização em ${moduleLabel}`} className="flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-500">
        <span>{panelLabel}</span>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span>{moduleLabel}</span>
        {active && (
          <>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="text-emerald-700" aria-current="page">{active.label}</span>
          </>
        )}
      </nav>

      <div role="tablist" aria-label={`Submódulos de ${moduleLabel}`} className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              title={item.description}
              data-submodule={item.id}
              className={`rounded-2xl border px-3 py-1.5 text-[11px] font-bold transition ${
                isActive
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
