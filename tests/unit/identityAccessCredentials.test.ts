import { describe, expect, it, vi } from 'vitest';
import type { IdentityAccountRepository, IdentityCredentialRepository, IdentityMfaRepository } from '../../server/modules/identity-access/application/identityAccessPorts';
import {
  beginIdentityMfaSetup,
  changePassword,
  enableIdentityMfa,
  requestPasswordReset,
  resetPassword,
} from '../../server/modules/identity-access/application/credentials';

function credentialDependencies(overrides: {
  changePassword?: boolean;
  changeDemoPassword?: boolean;
  resetToken?: string | null;
  resetPassword?: boolean;
  beginMfaSetup?: { secret: string; otpauthUrl: string };
  enableMfa?: boolean;
} = {}) {
  const accounts: IdentityAccountRepository = {
    findByEmail: async () => null,
    findById: async () => null,
    findByGoogleSubject: async () => null,
    linkGoogleSubject: async () => false,
    create: async () => null,
    changePassword: vi.fn(async () => overrides.changePassword ?? false),
    deactivate: async () => false,
    delete: async () => false,
  };
  const credentials: IdentityCredentialRepository = {
    changeDemoPassword: vi.fn(async () => overrides.changeDemoPassword ?? false),
    createPasswordReset: vi.fn(async () => overrides.resetToken ?? null),
    resetPassword: vi.fn(async () => overrides.resetPassword ?? false),
  };
  const mfa: IdentityMfaRepository = {
    hasEnabledMfa: async () => false,
    beginMfaSetup: vi.fn(async () => overrides.beginMfaSetup ?? { secret: 'secret', otpauthUrl: 'otpauth://test' }),
    enableMfa: vi.fn(async () => overrides.enableMfa ?? false),
    verifyUserMfa: async () => false,
  };
  return { accounts, credentials, mfa };
}

describe('identity credential use cases', () => {
  it('normalizes account identity when changing a password', async () => {
    const dependencies = credentialDependencies({ changePassword: true });

    await expect(changePassword({
      email: ' USER@GUIGUI.COM ',
      currentPassword: 'current-password',
      newPassword: 'new-password',
    }, dependencies)).resolves.toBe(true);

    expect(dependencies.accounts.changePassword).toHaveBeenCalledWith(
      'user@guigui.com',
      'current-password',
      'new-password',
    );
    expect(dependencies.credentials.changeDemoPassword).not.toHaveBeenCalled();
  });

  it('falls back to demo credentials only when account password change fails', async () => {
    const dependencies = credentialDependencies({ changeDemoPassword: true });

    await expect(changePassword({
      email: 'demo@guigui.com',
      currentPassword: '123456',
      newPassword: 'new-password',
    }, dependencies)).resolves.toBe(true);

    expect(dependencies.credentials.changeDemoPassword).toHaveBeenCalledWith(
      'demo@guigui.com',
      '123456',
      'new-password',
    );
  });

  it('returns no reset token for an unknown email', async () => {
    const dependencies = credentialDependencies();

    await expect(requestPasswordReset(' UNKNOWN@GUIGUI.COM ', dependencies)).resolves.toBeNull();

    expect(dependencies.credentials.createPasswordReset).toHaveBeenCalledWith('unknown@guigui.com');
  });

  it('returns a reset token from the credential store for a known email', async () => {
    const dependencies = credentialDependencies({ resetToken: 'opaque-reset-token' });

    await expect(requestPasswordReset('user@guigui.com', dependencies)).resolves.toBe('opaque-reset-token');
  });

  it('returns false when a reset token is invalid or expired', async () => {
    const dependencies = credentialDependencies();

    await expect(resetPassword('expired-token', 'new-password', dependencies)).resolves.toBe(false);
  });

  it('consumes a valid reset token through the credential store', async () => {
    const dependencies = credentialDependencies({ resetPassword: true });

    await expect(resetPassword('valid-token', 'new-password', dependencies)).resolves.toBe(true);

    expect(dependencies.credentials.resetPassword).toHaveBeenCalledWith('valid-token', 'new-password');
  });

  it('propagates MFA setup configuration errors', async () => {
    const dependencies = credentialDependencies();
    vi.mocked(dependencies.mfa.beginMfaSetup).mockRejectedValue(new Error('MFA requer PostgreSQL configurado.'));

    await expect(beginIdentityMfaSetup('admin-1', 'admin@guigui.com', dependencies.mfa))
      .rejects.toThrow('MFA requer PostgreSQL configurado.');
  });

  it('returns false when the MFA repository rejects the setup code', async () => {
    const dependencies = credentialDependencies({ enableMfa: false });

    await expect(enableIdentityMfa('admin-1', '000000', dependencies.mfa)).resolves.toBe(false);
  });

  it('enables MFA when the repository accepts the setup code', async () => {
    const dependencies = credentialDependencies({ enableMfa: true });

    await expect(enableIdentityMfa('admin-1', '123456', dependencies.mfa)).resolves.toBe(true);
  });
});
