import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  IdentityAccountRepository,
  IdentityCredentialRepository,
  IdentityTeamInvitationRepository,
} from '../application/identityAccessPorts';
import type {
  CreateIdentityAccount,
  IdentityAccount,
  IdentityRole,
  PublicIdentity,
  TeamInvitation as IdentityTeamInvitation,
} from '../domain/identityTypes';

export type AuthRole = IdentityRole;
export type PublicUser = PublicIdentity;
export type StoredUser = IdentityAccount;
export type TeamInvitation = IdentityTeamInvitation;

interface AuthStore {
  users: StoredUser[];
}

const dataDirectory = process.env.GUIGUI_DATA_DIR || path.resolve(process.cwd(), 'data');
const storePath = path.join(dataDirectory, 'auth.json');
const demoPasswordStorePath = path.join(dataDirectory, 'demo-passwords.json');
const resetTokenStorePath = path.join(dataDirectory, 'password-reset-tokens.json');
const teamInvitationStorePath = path.join(dataDirectory, 'team-invitations.json');
const resetTokens: Record<string, { email: string; tokenHash: string; expiresAt: number }> = loadResetTokens();
const teamInvitations: Record<string, TeamInvitation> = loadTeamInvitations();

function loadTeamInvitations(): Record<string, TeamInvitation> {
  let contents: string;
  try {
    contents = fs.readFileSync(teamInvitationStorePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }

  const parsed: unknown = JSON.parse(contents);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, TeamInvitation>;
  }
  throw new Error(`Invalid team invitation store format: ${teamInvitationStorePath}`);
}
function persistTeamInvitations() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(teamInvitationStorePath, JSON.stringify(teamInvitations, null, 2), 'utf8');
}
function invitationHash(token: string) {
  return scryptSync(token, 'guigui-team-invitation', 32).toString('hex');
}
function validInvitation(entry: TeamInvitation | undefined, token: string) {
  if (!entry || entry.usedAt || entry.expiresAt <= Date.now()) return false;
  const expected = Buffer.from(entry.tokenHash, 'hex');
  const actual = Buffer.from(invitationHash(token), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createTeamInvitation(input: Omit<TeamInvitation, 'tokenHash' | 'expiresAt' | 'usedAt'>, token: string) {
  const key = randomBytes(16).toString('hex');
  teamInvitations[key] = { ...input, email: input.email.trim().toLowerCase(), tokenHash: invitationHash(token), expiresAt: Date.now() + 48 * 60 * 60 * 1000 };
  persistTeamInvitations();
  return key;
}
export function inspectTeamInvitation(token: string) {
  const entry = Object.values(teamInvitations).find((candidate) => validInvitation(candidate, token));
  if (!entry) return null;
  return { email: entry.email, name: entry.name, businessId: entry.businessId, businessName: entry.businessName, role: entry.role, permissions: entry.permissions, expiresAt: entry.expiresAt };
}

export function consumeTeamInvitation(token: string): boolean {
  const key = Object.keys(teamInvitations).find((candidate) => validInvitation(teamInvitations[candidate], token));
  if (!key) return false;
  teamInvitations[key].usedAt = new Date().toISOString();
  persistTeamInvitations();
  return true;
}

export function acceptTeamInvitation(token: string, password: string, phone = '', neighborhood = 'Bissau') {
  const key = Object.keys(teamInvitations).find((candidate) => validInvitation(teamInvitations[candidate], token));
  if (!key) return null;
  const invitation = teamInvitations[key];
  const user = createUser({ name: invitation.name, email: invitation.email, password, phone, neighborhood, role: 'business', businessId: invitation.businessId, businessName: invitation.businessName, teamRole: invitation.role, teamPermissions: invitation.permissions });
  if (!user) return null;
  invitation.usedAt = new Date().toISOString();
  persistTeamInvitations();
  return user;
}

function loadResetTokens(): Record<string, { email: string; tokenHash: string; expiresAt: number }> {
  let contents: string;
  try {
    contents = fs.readFileSync(resetTokenStorePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw new Error(`Não foi possível ler ${path.basename(resetTokenStorePath)}: ${error instanceof Error ? error.message : String(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Ficheiro ${path.basename(resetTokenStorePath)} inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Ficheiro ${path.basename(resetTokenStorePath)} inválido: esperado um objeto de tokens.`);
  }

  const normalized: Record<string, { email: string; tokenHash: string; expiresAt: number }> = {};
  let migrated = false;
  for (const [storedKey, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Ficheiro ${path.basename(resetTokenStorePath)} inválido: registo de token malformado.`);
    }
    const record = value as { email?: unknown; tokenHash?: unknown; expiresAt?: unknown };
    if (
      typeof record.email !== 'string'
      || typeof record.tokenHash !== 'string'
      || !/^[0-9a-f]{64}$/i.test(record.tokenHash)
      || typeof record.expiresAt !== 'number'
      || !Number.isFinite(record.expiresAt)
    ) {
      throw new Error(`Ficheiro ${path.basename(resetTokenStorePath)} inválido: registo de token malformado.`);
    }
    if (storedKey !== record.tokenHash && tokenHash(storedKey) !== record.tokenHash) {
      throw new Error(`Ficheiro ${path.basename(resetTokenStorePath)} inválido: chave de token incompatível.`);
    }
    if (storedKey !== record.tokenHash) migrated = true;
    normalized[record.tokenHash] = {
      email: record.email,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
    };
  }

  if (migrated) {
    fs.writeFileSync(resetTokenStorePath, JSON.stringify(normalized, null, 2), 'utf8');
  }
  return normalized;
}

function persistResetTokens() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(resetTokenStorePath, JSON.stringify(resetTokens, null, 2), 'utf8');
}

function tokenHash(token: string) {
  return scryptSync(token, 'guigui-password-reset', 32).toString('hex');
}

function loadStore(): AuthStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as AuthStore;
    if (parsed && Array.isArray(parsed.users)) return parsed;
  } catch {
    // A fresh development store is created below.
  }
  return { users: [] };
}

const store = loadStore();

function loadDemoPasswordStore(): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(demoPasswordStorePath, 'utf8')) as Record<string, string>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Demo overrides are optional and created only after a password change.
  }
  return {};
}

const demoPasswordStore = loadDemoPasswordStore();

function persistStore() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [salt, expectedHex] = encoded.split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function findUserByEmail(email: string) {
  return store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string) {
  return store.users.find((user) => user.id === id);
}

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _passwordHash, createdAt: _createdAt, ...publicUser } = user;
  return publicUser;
}

export function changeUserPassword(email: string, currentPassword: string, newPassword: string) {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) return false;
  user.passwordHash = hashPassword(newPassword);
  persistStore();
  return true;
}

export function deactivateUserAccount(email: string) {
  const user = findUserByEmail(email);
  if (!user) return false;
  user.accountStatus = 'deactivated';
  persistStore();
  return true;
}

export function deleteUserAccount(email: string) {
  const index = store.users.findIndex((user) => user.email.toLowerCase() === email.trim().toLowerCase());
  if (index < 0) return false;
  store.users.splice(index, 1);
  persistStore();
  return true;
}

export function verifyDemoPassword(email: string, password: string, fallbackPassword: string) {
  const overrideHash = demoPasswordStore[email.toLowerCase()];
  return overrideHash ? verifyPassword(password, overrideHash) : password === fallbackPassword;
}

export function changeDemoPassword(email: string, currentPassword: string, newPassword: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const overrideHash = demoPasswordStore[normalizedEmail];
  const currentIsValid = overrideHash
    ? verifyPassword(currentPassword, overrideHash)
    : currentPassword === '123456';
  if (!currentIsValid) return false;
  demoPasswordStore[normalizedEmail] = hashPassword(newPassword);
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(demoPasswordStorePath, JSON.stringify(demoPasswordStore, null, 2), 'utf8');
  return true;
}

export function createPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const known = Boolean(findUserByEmail(normalizedEmail) || ['cidadao@guigui.com', 'empresa@guigui.com', 'admin@guigui.com'].includes(normalizedEmail));
  if (!known) return null;
  const token = randomBytes(32).toString('hex');
  const hash = tokenHash(token);
  resetTokens[hash] = { email: normalizedEmail, tokenHash: hash, expiresAt: Date.now() + 15 * 60 * 1000 };
  persistResetTokens();
  return token;
}

export function resetPassword(token: string, newPassword: string) {
  const hash = tokenHash(token);
  const entry = resetTokens[hash];
  if (!entry || entry.expiresAt <= Date.now() || !timingSafeEqual(Buffer.from(entry.tokenHash, 'hex'), Buffer.from(tokenHash(token), 'hex'))) return false;
  const user = findUserByEmail(entry.email);
  if (user) {
    user.passwordHash = hashPassword(newPassword);
    persistStore();
  } else if (!changeDemoPasswordWithReset(entry.email, newPassword)) {
    return false;
  }
  delete resetTokens[hash];
  persistResetTokens();
  return true;
}

function changeDemoPasswordWithReset(email: string, newPassword: string) {
  demoPasswordStore[email] = hashPassword(newPassword);
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(demoPasswordStorePath, JSON.stringify(demoPasswordStore, null, 2), 'utf8');
  return true;
}

export function createUser(input: CreateIdentityAccount) {
  const email = input.email.trim().toLowerCase();
  if (findUserByEmail(email)) return null;
  const user: StoredUser = {
    id: `usr-${Date.now()}-${randomBytes(3).toString('hex')}`,
    name: input.name.trim(),
    email,
    role: input.role,
    phone: input.phone.trim(),
    neighborhood: input.neighborhood.trim() || 'Bissau',
    avatarUrl: input.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    businessId: input.businessId,
    businessName: input.businessName,
    teamRole: input.teamRole,
    teamPermissions: input.teamPermissions,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  store.users.unshift(user);
  try {
    persistStore();
  } catch (error) {
    store.users.splice(store.users.indexOf(user), 1);
    throw error;
  }
  return user;
}

export function createJsonIdentityRepository(): IdentityAccountRepository {
  return {
    findByEmail: async (email) => findUserByEmail(email) ?? null,
    findById: async (id) => findUserById(id) ?? null,
    create: async (input) => createUser(input),
    changePassword: async (email, currentPassword, newPassword) => changeUserPassword(email, currentPassword, newPassword),
    deactivate: async (email) => deactivateUserAccount(email),
    delete: async (email) => deleteUserAccount(email),
  };
}

export function createJsonCredentialRepository(): IdentityCredentialRepository {
  return {
    changeDemoPassword: async (email, currentPassword, newPassword) => changeDemoPassword(email, currentPassword, newPassword),
    createPasswordReset: async (email) => createPasswordReset(email),
    resetPassword: async (token, newPassword) => resetPassword(token, newPassword),
  };
}

export function createJsonTeamInvitationRepository(): IdentityTeamInvitationRepository {
  return {
    create: async (input, token) => { createTeamInvitation(input, token); },
    inspect: async (token) => inspectTeamInvitation(token),
    consume: async (token) => consumeTeamInvitation(token),
  };
}
