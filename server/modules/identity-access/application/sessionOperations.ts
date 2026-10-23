import type { IdentitySessionRepository } from './identityAccessPorts';
import type { StoredSession } from '../domain/identityTypes';

export function getIdentitySession(
  token: string | undefined,
  repository: IdentitySessionRepository,
): Promise<StoredSession | null> {
  return repository.getSession(token);
}

export function logoutIdentitySession(
  token: string | undefined,
  repository: IdentitySessionRepository,
): Promise<boolean> {
  return repository.revokeSession(token);
}

export function revokeAllIdentitySessions(
  userId: string,
  repository: IdentitySessionRepository,
): Promise<number> {
  return repository.revokeAllUserSessions(userId);
}
