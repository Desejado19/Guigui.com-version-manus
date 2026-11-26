import { toPublicIdentity } from '../domain/identityTypes';
import type {
  BusinessTeamPermissions,
  BusinessTeamRole,
  CreateIdentityAccount,
  PublicIdentity,
} from '../domain/identityTypes';
import type {
  BusinessInvitationAccess,
  IdentityAccountRepository,
  IdentityTeamInvitationRepository,
} from './identityAccessPorts';

export interface CreateTeamInvitationInput {
  inviterUserId: string;
  email: string;
  name: string;
  businessId: string;
  businessName: string;
  role: BusinessTeamRole;
  permissions: BusinessTeamPermissions;
  token: string;
}

export interface AcceptTeamInvitationInput {
  token: string;
  password: string;
  phone?: string;
  neighborhood?: string;
}

export interface TeamInvitationDependencies {
  accounts: IdentityAccountRepository;
  invitations: IdentityTeamInvitationRepository;
  businessAccess: BusinessInvitationAccess;
}

export type CreateTeamInvitationResult = { kind: 'created' } | { kind: 'forbidden' };
export type AcceptTeamInvitationResult =
  | { kind: 'accepted'; user: PublicIdentity }
  | { kind: 'unavailable' }
  | { kind: 'association_failed' };

function samePermissions(left: BusinessTeamPermissions, right: BusinessTeamPermissions): boolean {
  return left.profile === right.profile
    && left.content === right.content
    && left.events === right.events
    && left.tickets === right.tickets
    && left.billing === right.billing;
}

async function compensateAccount(
  email: string,
  dependencies: TeamInvitationDependencies,
): Promise<void> {
  if (!await dependencies.accounts.delete(email)) {
    throw new Error('Team invitation account compensation failed.');
  }
}

export async function createTeamInvitation(
  input: CreateTeamInvitationInput,
  dependencies: TeamInvitationDependencies,
): Promise<CreateTeamInvitationResult> {
  const businessId = input.businessId.trim();
  const authorization = await dependencies.businessAccess.validate({
    inviterUserId: input.inviterUserId,
    businessId,
    role: input.role,
    permissions: input.permissions,
  });
  if (
    !authorization
    || authorization.role !== input.role
    || !samePermissions(authorization.permissions, input.permissions)
  ) {
    return { kind: 'forbidden' };
  }

  await dependencies.invitations.create({
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    businessId,
    businessName: input.businessName.trim(),
    role: authorization.role,
    permissions: authorization.permissions,
  }, input.token);
  return { kind: 'created' };
}

export function inspectTeamInvitation(
  token: string,
  dependencies: TeamInvitationDependencies,
) {
  return dependencies.invitations.inspect(token);
}

export async function acceptTeamInvitation(
  input: AcceptTeamInvitationInput,
  dependencies: TeamInvitationDependencies,
): Promise<AcceptTeamInvitationResult> {
  const invitation = await dependencies.invitations.inspect(input.token);
  if (!invitation) return { kind: 'unavailable' };

  const email = invitation.email.trim().toLowerCase();
  if (await dependencies.accounts.findByEmail(email)) return { kind: 'unavailable' };

  const accountInput: CreateIdentityAccount = {
    name: invitation.name,
    email,
    password: input.password,
    phone: input.phone ?? '',
    neighborhood: input.neighborhood ?? 'Bissau',
    role: 'business',
    businessId: invitation.businessId,
    businessName: invitation.businessName,
    teamRole: invitation.role,
    teamPermissions: invitation.permissions,
  };
  const account = await dependencies.accounts.create(accountInput);
  if (!account) return { kind: 'unavailable' };

  try {
    const memberAdded = await dependencies.businessAccess.addMember({
      userId: account.id,
      businessId: invitation.businessId,
      role: invitation.role,
      permissions: invitation.permissions,
    });
    if (!memberAdded) {
      await compensateAccount(email, dependencies);
      return { kind: 'association_failed' };
    }

    if (!await dependencies.invitations.consume(input.token)) {
      await compensateAccount(email, dependencies);
      return { kind: 'unavailable' };
    }
  } catch (error) {
    try {
      await compensateAccount(email, dependencies);
    } catch (compensationError) {
      throw new Error(
        `Team invitation failed (${error instanceof Error ? error.message : String(error)}); account compensation failed (${compensationError instanceof Error ? compensationError.message : String(compensationError)}).`,
      );
    }
    throw error;
  }

  const user = toPublicIdentity(account);
  if (!user) return { kind: 'unavailable' };
  return { kind: 'accepted', user };
}
