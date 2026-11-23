import { describe, expect, it, vi } from 'vitest';
import type { IdentityAccount, TeamInvitation } from '../../server/modules/identity-access/domain/identityTypes';
import type {
  BusinessInvitationAccess,
  IdentityAccountRepository,
  IdentityTeamInvitationRepository,
} from '../../server/modules/identity-access/application/identityAccessPorts';
import {
  acceptTeamInvitation,
  createTeamInvitation,
  inspectTeamInvitation,
} from '../../server/modules/identity-access/application/teamInvitations';

const invitation: TeamInvitation = {
  email: 'member@guigui.com',
  name: 'Team Member',
  businessId: 'biz-1',
  businessName: 'Business One',
  role: 'editor',
  permissions: { profile: true, content: true, events: true, tickets: false, billing: false },
  tokenHash: 'token-hash',
  expiresAt: Date.now() + 60_000,
};

const account: IdentityAccount = {
  id: 'member-1',
  name: 'Team Member',
  email: invitation.email,
  role: 'business',
  phone: '+245955000001',
  neighborhood: 'Bissau',
  avatarUrl: '',
  businessId: invitation.businessId,
  businessName: invitation.businessName,
  teamRole: invitation.role,
  teamPermissions: invitation.permissions,
  passwordHash: 'hashed-password',
  createdAt: '2026-10-23T00:00:00.000Z',
};

function invitationDependencies(overrides: {
  inspected?: TeamInvitation | null;
  existingAccount?: IdentityAccount | null;
  createdAccount?: IdentityAccount | null;
  authorized?: { role: TeamInvitation['role']; permissions: TeamInvitation['permissions'] } | null;
  memberAdded?: boolean;
  tokenConsumed?: boolean;
} = {}) {
  const accounts: IdentityAccountRepository = {
    findByEmail: vi.fn(async () => overrides.existingAccount ?? null),
    findById: async () => null,
    findByGoogleSubject: async () => null,
    linkGoogleSubject: async () => true,
    create: vi.fn(async () => overrides.createdAccount ?? account),
    changePassword: async () => false,
    deactivate: async () => false,
    delete: vi.fn(async () => true),
  };
  const invitations: IdentityTeamInvitationRepository = {
    create: vi.fn(async () => undefined),
    inspect: vi.fn(async () => {
      const inspected = overrides.inspected === undefined ? invitation : overrides.inspected;
      if (!inspected) return null;
      const { tokenHash: _tokenHash, usedAt: _usedAt, ...details } = inspected;
      return details;
    }),
    consume: vi.fn(async () => overrides.tokenConsumed ?? true),
  };
  const businessAccess: BusinessInvitationAccess = {
    validate: vi.fn(async () => overrides.authorized === undefined
      ? { role: invitation.role, permissions: invitation.permissions }
      : overrides.authorized),
    addMember: vi.fn(async () => overrides.memberAdded ?? true),
  };
  return { accounts, invitations, businessAccess };
}

describe('identity team invitation use cases', () => {
  it('stores an invitation with the business port canonical role and permissions', async () => {
    const dependencies = invitationDependencies();

    await expect(createTeamInvitation({
      inviterUserId: 'owner-1',
      email: ' MEMBER@GUIGUI.COM ',
      name: 'Team Member',
      businessId: 'biz-1',
      businessName: 'Business One',
      role: 'editor',
      permissions: invitation.permissions,
      token: 'opaque-invitation-token',
    }, dependencies)).resolves.toEqual({ kind: 'created' });

    expect(dependencies.businessAccess.validate).toHaveBeenCalledWith({
      inviterUserId: 'owner-1',
      businessId: 'biz-1',
      role: 'editor',
      permissions: invitation.permissions,
    });
    expect(dependencies.invitations.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'member@guigui.com',
      role: 'editor',
      permissions: invitation.permissions,
    }), 'opaque-invitation-token');
  });

  it('blocks invitation creation when the business port cannot validate access', async () => {
    const dependencies = invitationDependencies({ authorized: null });

    await expect(createTeamInvitation({
      inviterUserId: 'other-owner',
      email: invitation.email,
      name: invitation.name,
      businessId: invitation.businessId,
      businessName: invitation.businessName,
      role: invitation.role,
      permissions: invitation.permissions,
      token: 'opaque-invitation-token',
    }, dependencies)).resolves.toEqual({ kind: 'forbidden' });
    expect(dependencies.invitations.create).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied permissions that differ from the canonical role', async () => {
    const dependencies = invitationDependencies({
      authorized: { role: 'editor', permissions: invitation.permissions },
    });

    await expect(createTeamInvitation({
      inviterUserId: 'owner-1',
      email: invitation.email,
      name: invitation.name,
      businessId: invitation.businessId,
      businessName: invitation.businessName,
      role: 'editor',
      permissions: { ...invitation.permissions, billing: true },
      token: 'opaque-invitation-token',
    }, dependencies)).resolves.toEqual({ kind: 'forbidden' });
    expect(dependencies.invitations.create).not.toHaveBeenCalled();
  });

  it('returns invitation details only for a valid token', async () => {
    const dependencies = invitationDependencies();

    await expect(inspectTeamInvitation('valid-token', dependencies)).resolves.toEqual({
      email: invitation.email,
      name: invitation.name,
      businessId: invitation.businessId,
      businessName: invitation.businessName,
      role: invitation.role,
      permissions: invitation.permissions,
      expiresAt: invitation.expiresAt,
    });
    await expect(inspectTeamInvitation('wrong-token', invitationDependencies({ inspected: null }))).resolves.toBeNull();
  });

  it('rejects unknown, expired, or already-used tokens without creating an account', async () => {
    const dependencies = invitationDependencies({ inspected: null });

    await expect(acceptTeamInvitation({
      token: 'invalid-token',
      password: 'new-password',
      phone: '+245955000001',
      neighborhood: 'Bissau',
    }, dependencies)).resolves.toEqual({ kind: 'unavailable' });
    expect(dependencies.accounts.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate invitation emails without consuming the token', async () => {
    const dependencies = invitationDependencies({ existingAccount: account });

    await expect(acceptTeamInvitation({
      token: 'valid-token',
      password: 'new-password',
      phone: '+245955000001',
      neighborhood: 'Bissau',
    }, dependencies)).resolves.toEqual({ kind: 'unavailable' });
    expect(dependencies.invitations.consume).not.toHaveBeenCalled();
  });

  it('creates and associates the invited identity before consuming the token', async () => {
    const dependencies = invitationDependencies();

    await expect(acceptTeamInvitation({
      token: 'valid-token',
      password: 'new-password',
      phone: '+245955000001',
      neighborhood: 'Bissau',
    }, dependencies)).resolves.toEqual({
      kind: 'accepted',
      user: expect.objectContaining({ id: account.id, businessId: invitation.businessId }),
    });
    expect(dependencies.accounts.create).toHaveBeenCalledWith(expect.objectContaining({
      role: 'business',
      businessId: invitation.businessId,
      teamRole: invitation.role,
      teamPermissions: invitation.permissions,
    }));
    expect(dependencies.businessAccess.addMember).toHaveBeenCalledWith({
      userId: account.id,
      businessId: invitation.businessId,
      role: invitation.role,
      permissions: invitation.permissions,
    });
    expect(dependencies.invitations.consume).toHaveBeenCalledWith('valid-token');
  });

  it('removes the new account and leaves the invite available when association is rejected', async () => {
    const dependencies = invitationDependencies({ memberAdded: false });

    await expect(acceptTeamInvitation({
      token: 'valid-token',
      password: 'new-password',
      phone: '+245955000001',
      neighborhood: 'Bissau',
    }, dependencies)).resolves.toEqual({ kind: 'association_failed' });
    expect(dependencies.accounts.delete).toHaveBeenCalledWith(invitation.email);
    expect(dependencies.invitations.consume).not.toHaveBeenCalled();
  });
});
