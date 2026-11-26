import type { ComponentType } from 'react';

export type NavigationProfile = 'citizen' | 'business' | 'admin';

export type NavigationBadgeKey =
  | 'unreadMessages'
  | 'unreadNotifications'
  | 'pendingSupport'
  | 'pendingTickets'
  | 'pendingBusinesses'
  | 'pendingModeration'
  | 'pendingAdminSupport';

export interface NavigationBadgeCounts {
  unreadMessages?: number;
  unreadNotifications?: number;
  pendingSupport?: number;
  pendingTickets?: number;
  pendingBusinesses?: number;
  pendingModeration?: number;
  pendingAdminSupport?: number;
}

export interface NavigationItem<T extends string = string> {
  id: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group?: string;
  badgeKey?: NavigationBadgeKey;
  /** Texto de ajuda curto exibido sob o rótulo (usado no Admin/Business). */
  help?: string;
  /** Aliases de navegação (ex: tickets -> events, logs -> audit_logs). */
  aliases?: string[];
  mobile?: boolean;
  desktop?: boolean;
  enabled?: boolean;
}

export interface NavigationGroup<T extends string = string> {
  id: string;
  label: string;
  items: NavigationItem<T>[];
}

/** Mapa de aliases entre tabs (compatibilidade com links antigos). */
export const NAVIGATION_ALIASES: Record<string, string> = {
  tickets: 'events',
  logs: 'audit_logs',
};
