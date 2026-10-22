export type PlatformSessionRole = 'user' | 'business' | 'admin';

export interface ScopedTransaction {
  businessId?: unknown;
  useCase?: unknown;
}

export interface TransactionAccessResult {
  allowed: boolean;
  businessId?: string;
  reason?: 'ACCOUNT_WITHOUT_BUSINESS' | 'TRANSACTIONS_NOT_ALLOWED';
}

/**
 * Payment visibility is platform-wide for administrators and company-scoped
 * for business accounts. A business without a resolved company must never
 * receive another tenant's transactions.
 */
export function resolveTransactionAccess(
  role: PlatformSessionRole,
  requestedBusinessId: unknown,
  sessionBusinessId: unknown,
): TransactionAccessResult {
  if (role === 'admin') return { allowed: true };
  if (role !== 'business') return { allowed: false, reason: 'TRANSACTIONS_NOT_ALLOWED' };
  if (typeof sessionBusinessId !== 'string' || !sessionBusinessId.trim()) {
    return { allowed: false, reason: 'ACCOUNT_WITHOUT_BUSINESS' };
  }

  const businessId = sessionBusinessId.trim();
  if (typeof requestedBusinessId === 'string' && requestedBusinessId.trim() && requestedBusinessId.trim() !== businessId) {
    return { allowed: false, reason: 'TRANSACTIONS_NOT_ALLOWED' };
  }
  return { allowed: true, businessId };
}

export function canViewTransaction(
  transaction: ScopedTransaction,
  role: PlatformSessionRole,
  businessId?: string,
): boolean {
  if (transaction.useCase === 'event_tickets' || transaction.useCase === 'event_refund') return false;
  if (role === 'admin') return true;
  return role === 'business' && Boolean(businessId) && transaction.businessId === businessId;
}
