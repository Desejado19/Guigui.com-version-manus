import { describe, expect, it } from 'vitest';
import { canViewTransaction, resolveTransactionAccess } from '../../server/paymentAccessService';

describe('payment transaction visibility helpers', () => {
  it('uses the session company as authority and rejects a mismatched query', () => {
    expect(resolveTransactionAccess('business', undefined, 'biz-1')).toEqual({ allowed: true, businessId: 'biz-1' });
    expect(resolveTransactionAccess('business', 'biz-2', 'biz-1')).toEqual({ allowed: false, reason: 'TRANSACTIONS_NOT_ALLOWED' });
    expect(resolveTransactionAccess('business', undefined, undefined)).toEqual({ allowed: false, reason: 'ACCOUNT_WITHOUT_BUSINESS' });
    expect(resolveTransactionAccess('admin', undefined, undefined)).toEqual({ allowed: true });
  });

  it('never exposes ticket operations to a company transaction feed', () => {
    expect(canViewTransaction({ businessId: 'biz-1', useCase: 'event_tickets' }, 'admin')).toBe(false);
    expect(canViewTransaction({ businessId: 'biz-1', useCase: 'extra_posts' }, 'admin')).toBe(true);
    expect(canViewTransaction({ businessId: 'biz-1', useCase: 'extra_posts' }, 'business', 'biz-1')).toBe(true);
    expect(canViewTransaction({ businessId: 'biz-2', useCase: 'extra_posts' }, 'business', 'biz-1')).toBe(false);
  });
});
