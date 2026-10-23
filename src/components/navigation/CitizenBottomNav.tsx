import React from 'react';
import type { NavigationBadgeCounts } from '../../utils/navigationTypes';
import { CITIZEN_PRIMARY_NAVIGATION, type CitizenPrimaryModule } from '../../config/navigation';
import { Badge } from '../ui';

interface CitizenBottomNavProps {
  activeId: CitizenPrimaryModule;
  onSelect: (id: CitizenPrimaryModule) => void;
  badges?: NavigationBadgeCounts;
}

export const CitizenBottomNav: React.FC<CitizenBottomNavProps> = ({ activeId, onSelect, badges = {} }) => (
  <nav
    className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.5)] backdrop-blur md:hidden"
    aria-label="Navegação principal"
  >
    {CITIZEN_PRIMARY_NAVIGATION.map((item) => {
      const Icon = item.icon;
      const badgeValue = item.badgeKey ? badges[item.badgeKey] : undefined;
      const isActive = item.id === activeId;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
            isActive ? 'text-blue-700' : 'text-slate-500'
          }`}
          aria-current={isActive ? 'page' : undefined}
        >
          <Icon className="h-5 w-5" />
          <span>{item.label}</span>
          {badgeValue !== undefined && badgeValue > 0 && (
            <Badge variant="danger" className="absolute right-1/4 top-1 px-1.5 py-0.5 text-[8px]">{badgeValue}</Badge>
          )}
        </button>
      );
    })}
  </nav>
);
