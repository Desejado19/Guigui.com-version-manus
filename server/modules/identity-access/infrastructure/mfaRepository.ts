import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { databasePool } from '../../../db';
import type { IdentityMfaRepository } from '../application/identityAccessPorts';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const mfaSecret = process.env.MFA_SECRET || process.env.SESSION_COOKIE_SECRET;
if (!mfaSecret && process.env.NODE_ENV === 'production') throw new Error('MFA_SECRET ou SESSION_COOKIE_SECRET é obrigatório.');

function base32Encode(value: Buffer): string {
  let bits = '';
  for (const byte of value) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let index = 0; index < bits.length; index += 5) result += base32Alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  return result;
}

function base32Decode(value: string): Buffer {
  const bits = value.toUpperCase().replace(/=+$/, '').split('').map((char) => base32Alphabet.indexOf(char).toString(2).padStart(5, '0')).join('');
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function protectSecret(secret: string): string {
  if (!mfaSecret) return secret;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(mfaSecret).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

function revealSecret(value: string): string {
  if (!mfaSecret) return value;
  const [ivValue, tagValue, encryptedValue] = value.split(':');
  if (!ivValue || !tagValue || !encryptedValue) return value;
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(mfaSecret).digest(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  const normalized = code.replace(/\D/g, '');
  if (normalized.length !== 6) return null;
  const step = Math.floor(now / 30_000);
  for (const offset of [-1, 0, 1]) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step + offset));
    const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
    const binary = (digest[digest.length - 1] || 0) & 0x0f;
    const value = (digest.readUInt32BE(binary) & 0x7fffffff) % 1_000_000;
    const expected = String(value).padStart(6, '0');
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) return step + offset;
  }
  return null;
}

export async function hasEnabledMfa(userId: string): Promise<boolean> {
  if (!databasePool) return false;
  const result = await databasePool.query(`SELECT 1 FROM mfa_factors WHERE user_id=$1 AND method='totp' AND enabled_at IS NOT NULL`, [userId]);
  return result.rowCount === 1;
}

export async function beginMfaSetup(userId: string, email: string): Promise<{ secret: string; otpauthUrl: string }> {
  if (!databasePool) throw new Error('MFA requer PostgreSQL configurado.');
  const secret = generateTotpSecret();
  await databasePool.query(
    `INSERT INTO mfa_factors (id,user_id,method,secret_encrypted) VALUES ($1,$2,'totp',$3)
     ON CONFLICT (user_id,method) DO UPDATE SET secret_encrypted=EXCLUDED.secret_encrypted,enabled_at=NULL`,
    [`mfa-${randomBytes(12).toString('hex')}`, userId, protectSecret(secret)],
  );
  return { secret, otpauthUrl: `otpauth://totp/Guigui.com:${encodeURIComponent(email)}?secret=${secret}&issuer=Guigui.com` };
}

export async function enableMfa(userId: string, code: string): Promise<boolean> {
  if (!databasePool) return false;
  const result = await databasePool.query(`SELECT secret_encrypted FROM mfa_factors WHERE user_id=$1 AND method='totp'`, [userId]);
  const secret = result.rows[0] ? revealSecret(result.rows[0].secret_encrypted) : '';
  const step = secret ? verifyTotp(secret, code) : null;
  if (step === null) return false;
  await databasePool.query(`UPDATE mfa_factors SET enabled_at=NOW(),last_used_step=$2 WHERE user_id=$1 AND method='totp'`, [userId, step]);
  return true;
}

export async function verifyUserMfa(userId: string, code: string): Promise<boolean> {
  if (!databasePool) return false;
  const result = await databasePool.query(`SELECT secret_encrypted,last_used_step FROM mfa_factors WHERE user_id=$1 AND method='totp' AND enabled_at IS NOT NULL`, [userId]);
  const row = result.rows[0];
  if (!row) return true;
  const step = verifyTotp(revealSecret(row.secret_encrypted), code);
  if (step === null || (row.last_used_step !== null && Number(row.last_used_step) >= step)) return false;
  await databasePool.query(`UPDATE mfa_factors SET last_used_step=$2 WHERE user_id=$1 AND method='totp'`, [userId, step]);
  return true;
}

export function createMfaRepository(): IdentityMfaRepository {
  return { hasEnabledMfa, beginMfaSetup, enableMfa, verifyUserMfa };
}
