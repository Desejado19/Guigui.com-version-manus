import type { Business, SubscriptionTier } from '../types';

export type SubscriptionInterval = 'monthly' | 'annual';
export type SubscriptionAccessState = 'active' | 'expired' | 'suspended';
export type SubscriptionAlertCode = '15d' | '10d' | '5d' | '24h';

export const DEMO_NOW = '2026-08-28T12:00:00.000Z';
export const SUBSCRIPTION_ALERT_CODES: SubscriptionAlertCode[] = ['15d', '10d', '5d', '24h'];

export function addSubscriptionPeriod(start: Date | string, interval: SubscriptionInterval): Date {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return new Date(NaN);
  const result = new Date(date);
  if (interval === 'annual') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

export function getSubscriptionRemainingMs(renewAt?: string, now = new Date()): number | null {
  if (!renewAt) return null;
  const end = Date.parse(renewAt);
  if (!Number.isFinite(end)) return null;
  return end - now.getTime();
}

export function getSubscriptionAccessState(business: Pick<Business, 'status' | 'subscriptionStatus' | 'subscriptionRenewDate'>, now = new Date()): SubscriptionAccessState {
  if (business.status === 'suspended' || business.subscriptionStatus === 'suspended') return 'suspended';
  const remaining = getSubscriptionRemainingMs(business.subscriptionRenewDate, now);
  if (remaining !== null && remaining <= 0) return 'expired';
  return 'active';
}

export function getSubscriptionAlertCode(renewAt?: string, now = new Date()): SubscriptionAlertCode | null {
  const remaining = getSubscriptionRemainingMs(renewAt, now);
  if (remaining === null || remaining <= 0) return null;
  const days = remaining / (24 * 60 * 60 * 1000);
  if (remaining <= 24 * 60 * 60 * 1000) return '24h';
  if (days <= 5) return '5d';
  if (days <= 10) return '10d';
  if (days <= 15) return '15d';
  return null;
}

export function getSubscriptionAlertMessage(code: SubscriptionAlertCode, renewAt: string): string {
  const date = new Date(renewAt).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
  if (code === '24h') return `O seu plano termina nas próximas 24 horas (${date}). Renove agora para manter as funcionalidades activas.`;
  return `Faltam ${code.replace('d', '')} dias para renovar o seu plano (${date}). Renove com antecedência para evitar bloqueios.`;
}

export function getSubscriptionTierLabel(tier: SubscriptionTier): string {
  return ({ basic: 'Básico', professional: 'Profissional', premium: 'Premium', enterprise: 'Enterprise' })[tier];
}

export function shouldBlockBusinessMutation(business: Pick<Business, 'status' | 'subscriptionStatus' | 'subscriptionRenewDate'>, now = new Date()): boolean {
  return getSubscriptionAccessState(business, now) !== 'active';
}
