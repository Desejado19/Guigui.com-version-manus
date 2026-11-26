import type {
  IdentityAccountRepository,
  IdentityCredentialRepository,
  IdentityMfaRepository,
} from './identityAccessPorts';

export interface ChangePasswordInput {
  email: string;
  currentPassword: string;
  newPassword: string;
}

export interface CredentialDependencies {
  accounts: IdentityAccountRepository;
  credentials: IdentityCredentialRepository;
}

export async function changePassword(
  input: ChangePasswordInput,
  dependencies: CredentialDependencies,
): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  if (await dependencies.accounts.changePassword(email, input.currentPassword, input.newPassword)) return true;
  return dependencies.credentials.changeDemoPassword
    ? dependencies.credentials.changeDemoPassword(email, input.currentPassword, input.newPassword)
    : false;
}

export function requestPasswordReset(
  email: string,
  dependencies: CredentialDependencies,
): Promise<string | null> {
  return dependencies.credentials.createPasswordReset(email.trim().toLowerCase());
}

export function resetPassword(
  token: string,
  newPassword: string,
  dependencies: CredentialDependencies,
): Promise<boolean> {
  return dependencies.credentials.resetPassword(token, newPassword);
}

export function beginIdentityMfaSetup(
  userId: string,
  email: string,
  repository: IdentityMfaRepository,
): Promise<{ secret: string; otpauthUrl: string }> {
  return repository.beginMfaSetup(userId, email);
}

export function enableIdentityMfa(
  userId: string,
  code: string,
  repository: IdentityMfaRepository,
): Promise<boolean> {
  return repository.enableMfa(userId, code);
}
