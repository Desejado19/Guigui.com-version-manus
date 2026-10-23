import { useEffect } from 'react';
import type { NavigationProfile } from './navigationTypes';

export type NavigationEntryContext = 'login' | 'logout' | 'account-switch' | 'internal';

export const getDefaultEntryTarget = (profile: NavigationProfile) => {
  if (profile === 'business') return { route: 'client' as const, module: 'overview' as const };
  if (profile === 'admin') return { route: 'admin' as const, module: 'overview' as const };
  return { route: 'feed' as const, module: 'feed' as const };
};

export const shouldResetNavigationState = (context: NavigationEntryContext) =>
  context === 'login' || context === 'logout' || context === 'account-switch';

export const getNavigationBadgeTotal = (
  value: number | undefined,
) => (typeof value === 'number' && value > 0 ? value : undefined);

export const scrollToPageTop = () => {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

export const usePageEntryScroll = (entryKey: string | number | null | undefined) => {
  useEffect(() => {
    if (entryKey === null || entryKey === undefined) return;
    const frame = window.requestAnimationFrame(scrollToPageTop);
    return () => window.cancelAnimationFrame(frame);
  }, [entryKey]);
};
