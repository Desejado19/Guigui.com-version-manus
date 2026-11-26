import React from 'react';
import type { NavigationBadgeCounts, NavigationGroup } from '../../utils/navigationTypes';
import { Badge, IconButton } from '../ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ProfileSidebarProps<T extends string> {
  groups: NavigationGroup<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  badges?: NavigationBadgeCounts;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  title: string;
  subtitle: string;
  className?: string;
}

const getBadgeValue = (key: NavigationGroup<string>['items'][number]['badgeKey'], badges: NavigationBadgeCounts) => {
  if (!key) return undefined;
  return badges[key];
};

export function ProfileSidebar<T extends string>({
  groups,
  activeId,
  onSelect,
  badges = {},
  collapsed = false,
  onCollapsedChange,
  mobileOpen = false,
  onMobileOpenChange,
  title,
  subtitle,
  className = '',
}: ProfileSidebarProps<T>) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/35 md:hidden"
          onClick={() => onMobileOpenChange?.(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`guigui-panel-sidebar ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-0 z-50 flex h-full max-w-[calc(100vw-16px)] flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xl transition-transform duration-300 ease-out md:static md:z-auto md:h-auto md:min-h-full md:translate-x-0 md:shadow-none ${className}`}
        style={{ width: collapsed ? 72 : 248 }}
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-2 py-3">
          {!collapsed && (
            <div className="min-w-0 px-1">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{subtitle}</div>
              <div className="truncate text-base font-black text-slate-900">{title}</div>
            </div>
          )}
          <div className={`flex items-center gap-1 ${collapsed ? 'w-full justify-center' : ''}`}>
            <IconButton
              label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              variant="secondary"
              size="sm"
              className="h-8 w-8 rounded-full"
              onClick={() => onCollapsedChange?.(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </IconButton>
            <IconButton
              label="Fechar menu lateral"
              variant="secondary"
              size="sm"
              className="h-8 w-8 rounded-full md:hidden"
              onClick={() => onMobileOpenChange?.(false)}
            >
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              {!collapsed && <div className="px-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{group.label}</div>}
              {group.items.filter((item) => item.enabled !== false).map((item) => {
                const isActive = activeId === item.id;
                const badgeValue = getBadgeValue(item.badgeKey, badges);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      onMobileOpenChange?.(false);
                    }}
                    className={`group relative flex min-h-11 w-full items-center rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                      collapsed ? 'justify-center border-transparent p-2.5' : 'gap-2 border-[var(--color-border-subtle)] px-2 py-1.5'
                    } ${isActive ? 'border-blue-600 bg-blue-600 text-white' : 'text-slate-700 hover:border-[var(--color-border-default)] hover:bg-slate-50'}`}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="min-w-0 flex-1 truncate text-[10px] font-black">{item.label}</span>}
                    {!collapsed && badgeValue !== undefined && badgeValue > 0 && (
                      <Badge variant={isActive ? 'verified' : 'danger'} className="border-0 px-1.5 py-0.5 text-[9px]">{badgeValue}</Badge>
                    )}
                    {collapsed && badgeValue !== undefined && badgeValue > 0 && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" aria-label={`${badgeValue} não lidos`} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
