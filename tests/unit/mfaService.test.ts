import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

// Provide a fixed MFA secret so secret protection/encryption is deterministic.
process.env.MFA_SECRET = 'unit-test-mfa-secret';

// Control the databasePool per-test; the MFA service reads it via ./db.
let pool: unknown = null;
const queryMock = vi.fn();

vi.mock('../../server/db', () => ({
  get databasePool() {
    return pool;
  },
  databaseConfigured: true,
}));

type MfaModule = typeof import('../../server/mfaService');
let mfa: MfaModule;

beforeEach(async () => {
  queryMock.mockReset();
  pool = null;
  vi.resetModules();
  mfa = await import('../../server/mfaService');
});

afterEach(() => {
  vi.resetModules();
});

// base32 helper mirroring the service so we can build secrets and TOTP codes.
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(value: string): Buffer {
  const bits = value.toUpperCase().replace(/=+$/, '').split('').map((c) => base32Alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpFor(secret: string, now: number): string {
  const step = Math.floor(now / 30_000);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const binary = (digest[digest.length - 1] || 0) & 0x0f;
  const value = (digest.readUInt32BE(binary) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

const FIXED_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const FIXED_NOW = 1_700_000_000_000;

describe('generateTotpSecret', () => {
  it('returns a base32 secret of the expected shape', () => {
    const secret = mfa.generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    // 20 bytes => 32 base32 characters.
    expect(secret).toHaveLength(32);
  });

  it('generates a different secret each time', () => {
    expect(mfa.generateTotpSecret()).not.toBe(mfa.generateTotpSecret());
  });
});

describe('verifyTotp', () => {
  it('accepts the current step code and returns that step', () => {
    const code = totpFor(FIXED_SECRET, FIXED_NOW);
    const step = mfa.verifyTotp(FIXED_SECRET, code, FIXED_NOW);
    expect(step).toBe(Math.floor(FIXED_NOW / 30_000));
  });

  it('accepts the previous and next step codes (clock skew)', () => {
    const before = mfa.verifyTotp(FIXED_SECRET, totpFor(FIXED_SECRET, FIXED_NOW - 30_000), FIXED_NOW);
    const after = mfa.verifyTotp(FIXED_SECRET, totpFor(FIXED_SECRET, FIXED_NOW + 30_000), FIXED_NOW);
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
  });

  it('rejects a code from far outside the window', () => {
    const stale = totpFor(FIXED_SECRET, FIXED_NOW - 5 * 60_000);
    expect(mfa.verifyTotp(FIXED_SECRET, stale, FIXED_NOW)).toBeNull();
  });

  it('rejects codes with the wrong length', () => {
    expect(mfa.verifyTotp(FIXED_SECRET, '12345', FIXED_NOW)).toBeNull();
    expect(mfa.verifyTotp(FIXED_SECRET, '1234567', FIXED_NOW)).toBeNull();
  });

  it('strips non-digit characters before checking', () => {
    const code = totpFor(FIXED_SECRET, FIXED_NOW);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(mfa.verifyTotp(FIXED_SECRET, spaced, FIXED_NOW)).not.toBeNull();
  });

  it('rejects a wrong code', () => {
    const code = totpFor(FIXED_SECRET, FIXED_NOW);
    const wrong = code === '000' ? '000001' : '000';
    expect(mfa.verifyTotp(FIXED_SECRET, wrong, FIXED_NOW)).toBeNull();
  });
});

describe('hasEnabledMfa', () => {
  it('returns false when no database is configured', async () => {
    pool = null;
    expect(await mfa.hasEnabledMfa('u1')).toBe(false);
  });

  it('returns true only when exactly one enabled factor exists', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rowCount: 1 });
    expect(await mfa.hasEnabledMfa('u1')).toBe(true);

    queryMock.mockResolvedValue({ rowCount: 0 });
    expect(await mfa.hasEnabledMfa('u1')).toBe(false);
  });
});

describe('beginMfaSetup', () => {
  it('throws when no database is configured', async () => {
    pool = null;
    await expect(mfa.beginMfaSetup('u1', 'admin@guigui.com')).rejects.toThrow(/PostgreSQL/);
  });

  it('stores an encrypted secret and returns an otpauth URL', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rowCount: 1 });

    const result = await mfa.beginMfaSetup('u1', 'admin@guigui.com');
    expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(result.otpauthUrl).toContain('otpauth://totp/Guigui.com:admin%40guigui.com');
    expect(result.otpauthUrl).toContain(`secret=${result.secret}`);

    // The value written to the DB must be encrypted, not the raw secret.
    const insertedParams = queryMock.mock.calls[0][1];
    const storedSecret = insertedParams[2];
    expect(storedSecret).not.toBe(result.secret);
    expect(storedSecret.split(':')).toHaveLength(3);
  });
});

describe('enableMfa', () => {
  it('returns false without a database', async () => {
    pool = null;
    expect(await mfa.enableMfa('u1', '123456')).toBe(false);
  });

  it('enables MFA when a valid code is supplied', async () => {
    pool = { query: queryMock };
    // Round-trip through beginMfaSetup so the stored secret is correctly encrypted,
    // then feed back a real TOTP code for the freshly generated secret.
    let storedEncrypted = '';
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO mfa_factors')) {
        storedEncrypted = (params as string[])[2];
        return { rows: [] };
      }
      if (sql.includes('SELECT secret_encrypted')) return { rows: [{ secret_encrypted: storedEncrypted }] };
      return { rows: [] };
    });

    const setup = await mfa.beginMfaSetup('u1', 'admin@guigui.com');
    const code = totpFor(setup.secret, Date.now());
    expect(await mfa.enableMfa('u1', code)).toBe(true);
  });

  it('rejects enabling with an invalid code', async () => {
    pool = { query: queryMock };
    let storedEncrypted = '';
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO mfa_factors')) {
        storedEncrypted = (params as string[])[2];
        return { rows: [] };
      }
      if (sql.includes('SELECT secret_encrypted')) return { rows: [{ secret_encrypted: storedEncrypted }] };
      return { rows: [] };
    });

    await mfa.beginMfaSetup('u1', 'admin@guigui.com');
    expect(await mfa.enableMfa('u1', '000')).toBe(false);
  });
});

describe('verifyUserMfa (login MFA gate)', () => {
  it('allows login when MFA is not enabled for the user', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [] });
    expect(await mfa.verifyUserMfa('u1', '000')).toBe(true);
  });

  it('returns false without a database', async () => {
    pool = null;
    expect(await mfa.verifyUserMfa('u1', '123456')).toBe(false);
  });

  it('accepts a fresh valid code and rejects replay of the same step', async () => {
    pool = { query: queryMock };
    let storedEncrypted = '';
    let lastUsedStep: number | null = null;
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO mfa_factors')) {
        storedEncrypted = (params as string[])[2];
        return { rows: [] };
      }
      if (sql.includes('UPDATE mfa_factors SET last_used_step')) {
        lastUsedStep = Number((params as number[])[1]);
        return { rows: [] };
      }
      if (sql.includes('SELECT secret_encrypted,last_used_step')) {
        return { rows: [{ secret_encrypted: storedEncrypted, last_used_step: lastUsedStep }] };
      }
      return { rows: [] };
    });

    const setup = await mfa.beginMfaSetup('u1', 'admin@guigui.com');
    const code = totpFor(setup.secret, Date.now());

    expect(await mfa.verifyUserMfa('u1', code)).toBe(true);
    // Replaying the same code (same step) must fail.
    expect(await mfa.verifyUserMfa('u1', code)).toBe(false);
  });

  it('rejects an invalid code', async () => {
    pool = { query: queryMock };
    let storedEncrypted = '';
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO mfa_factors')) {
        storedEncrypted = (params as string[])[2];
        return { rows: [] };
      }
      if (sql.includes('SELECT secret_encrypted,last_used_step')) {
        return { rows: [{ secret_encrypted: storedEncrypted, last_used_step: null }] };
      }
      return { rows: [] };
    });

    await mfa.beginMfaSetup('u1', 'admin@guigui.com');
    expect(await mfa.verifyUserMfa('u1', '000')).toBe(false);
  });
});
