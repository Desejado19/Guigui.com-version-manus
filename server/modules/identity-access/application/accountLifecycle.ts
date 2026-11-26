import type { IdentityRole } from '../domain/identityTypes';
import type { IdentityAccountRepository, IdentitySessionRepository } from './identityAccessPorts';

export interface AccountLifecycleInput {
  userId: string;
  currentPassword: string;
  email?: string;
  actorRole: IdentityRole;
  requestId?: string;
}

export interface AccountLifecycleAuditEvent {
  action: 'account_deactivation_denied' | 'account_deletion_denied' | 'account_deactivated' | 'account_deleted';
  resource: 'user';
  resourceId: string;
  actorRole: 'citizen' | 'business' | 'admin';
  actorName?: string;
  requestId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface AccountLifecycleDependencies {
  accounts: IdentityAccountRepository;
  sessions: IdentitySessionRepository;
  verifyPassword(password: string, encoded: string): boolean;
  audit(event: AccountLifecycleAuditEvent): void;
}

export type AccountLifecycleResult =
  | { kind: 'success'; revoked: number }
  | { kind: 'account_not_found' }
  | { kind: 'identity_mismatch' }
  | { kind: 'invalid_password' }
  | { kind: 'operation_failed' };

type AccountLifecycleOperation = 'deactivate' | 'delete';

function auditRole(role: IdentityRole): AccountLifecycleAuditEvent['actorRole'] {
  return role === 'user' ? 'citizen' : role;
}

async function applyAccountLifecycleOperation(
  operation: AccountLifecycleOperation,
  input: AccountLifecycleInput,
  dependencies: AccountLifecycleDependencies,
): Promise<AccountLifecycleResult> {
  const account = await dependencies.accounts.findById(input.userId);
  if (!account) return { kind: 'account_not_found' };

  const requestedEmail = input.email?.trim().toLowerCase();
  if (requestedEmail && requestedEmail !== account.email.toLowerCase()) {
    dependencies.audit({
      action: operation === 'deactivate' ? 'account_deactivation_denied' : 'account_deletion_denied',
      resource: 'user',
      resourceId: input.userId,
      actorRole: auditRole(input.actorRole),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      success: false,
      metadata: { reason: 'session_account_mismatch' },
    });
    return { kind: 'identity_mismatch' };
  }

  if (!dependencies.verifyPassword(input.currentPassword, account.passwordHash)) {
    return { kind: 'invalid_password' };
  }

  const changed = operation === 'deactivate'
    ? await dependencies.accounts.deactivate(account.email)
    : await dependencies.accounts.delete(account.email);
  if (!changed) return { kind: 'operation_failed' };

  const revoked = await dependencies.sessions.revokeAllUserSessions(input.userId);
  dependencies.audit({
    action: operation === 'deactivate' ? 'account_deactivated' : 'account_deleted',
    resource: 'user',
    resourceId: input.userId,
    actorRole: auditRole(input.actorRole),
    actorName: `user:${input.userId}`,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    success: true,
    metadata: { revoked },
  });
  return { kind: 'success', revoked };
}

export function deactivateAccount(
  input: AccountLifecycleInput,
  dependencies: AccountLifecycleDependencies,
): Promise<AccountLifecycleResult> {
  return applyAccountLifecycleOperation('deactivate', input, dependencies);
}

export function deleteAccount(
  input: AccountLifecycleInput,
  dependencies: AccountLifecycleDependencies,
): Promise<AccountLifecycleResult> {
  return applyAccountLifecycleOperation('delete', input, dependencies);
}
