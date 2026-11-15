import React from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * Barra de navegação inferior flutuante com efeito de vidro (glassmorphism).
 *
 * Componente puramente visual: recebe os itens e o item ativo de quem o usa e
 * devolve apenas o evento de seleção. Nenhuma rota, permissão ou módulo é
 * alterado aqui.
 */
export interface GlassBottomNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<LucideProps>;
  badge?: number;
}

interface GlassBottomNavProps {
  items: GlassBottomNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  /** Só para testes/analytics: prefixo do atributo data-*. */
  testId?: string;
}

export const GlassBottomNav: React.FC<GlassBottomNavProps> = ({
  items,
  activeId,
  onSelect,
  ariaLabel,
  testId,
}) => {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      data-testid={testId}
      className="guigui-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="guigui-bottom-nav__surface pointer-events-auto flex w-full max-w-[min(100%,32rem)] items-center gap-0.5 px-1.5 py-1.5 sm:gap-1 sm:px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[9px] font-bold transition-[color,background-color,transform] duration-300 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:py-2 sm:text-[10px] ${
                isActive
                  ? 'guigui-bottom-nav__item--active text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -top-px h-[3px] w-6 rounded-full bg-emerald-500 transition-all duration-300 ease-out ${
                  isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                }`}
              />
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-out sm:h-5 sm:w-5 ${
                  isActive ? '-translate-y-0.5 scale-110' : 'group-hover:-translate-y-0.5'
                }`}
                aria-hidden="true"
              />
              <span className="max-w-full truncate leading-none">{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute right-[18%] top-0.5 min-w-4 rounded-full bg-rose-500 px-1 py-px text-[8px] font-black leading-tight text-white shadow-sm">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
