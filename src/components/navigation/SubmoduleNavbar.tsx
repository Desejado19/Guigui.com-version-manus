import React, { useRef } from 'react';
import type { Language } from '../../types';

/**
 * Barra horizontal de submodulos — a unica do site.
 *
 * Cada botao representa uma seccao independente: ao selecionar, o modulo deve
 * renderizar exclusivamente o conteudo desse submodulo (ver AdminDashboard,
 * CitizenDashboard, EventsView e SoldTicketsPanel).
 *
 * Regras aplicadas aqui: pills lado a lado, destaque visual no activo, scroll
 * horizontal em ecras estreitos (sem sobreposicao), navegacao por teclado
 * (setas / Home / End) e semantica de tabs.
 */
interface SubmoduleNavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  tabs: string[];
  tabLabels: Record<string, string>;
  className?: string;
  showCounts?: boolean;
  counts?: Record<string, number>;
  /** Permite que os separadores ocupem várias linhas em ecrãs estreitos. */
  wrap?: boolean;
  /** Compatibilidade com chamadas antigas. */
  setTab?: (tab: string) => void;
  currentLang?: Language;
  ariaLabel?: string;
}

export const SubmoduleNavbar: React.FC<SubmoduleNavbarProps> = ({
  currentTab,
  onTabChange,
  setTab,
  tabs,
  tabLabels,
  className = '',
  showCounts = false,
  counts,
  wrap = false,
  ariaLabel,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const select = (tab: string) => (setTab ? setTab(tab) : onTabChange(tab));

  const moveFocus = (direction: 1 | -1, index: number) => {
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    select(nextTab);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
    buttons?.[nextIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className={`-mx-1 mb-4 ${className}`}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        className={`no-scrollbar flex items-center gap-2 px-1 py-1 ${wrap ? 'flex-wrap' : 'overflow-x-auto'}`}
      >
        {tabs.map((tab, index) => {
          const label = tabLabels[tab] || tab;
          const isActive = currentTab === tab;
          const count = showCounts && counts ? counts[tab] : undefined;

          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`submodule-panel-${tab}`}
              id={`submodule-tab-${tab}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(tab)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  moveFocus(1, index);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  moveFocus(-1, index);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  moveFocus(1, tabs.length - 1);
                } else if (event.key === 'End') {
                  event.preventDefault();
                  moveFocus(-1, 0);
                }
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-green-600)] ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:border-indigo-300 hover:text-slate-800'
              }`}
            >
              {label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
