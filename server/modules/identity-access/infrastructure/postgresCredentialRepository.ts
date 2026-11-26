import { randomBytes, scryptSync } from 'node:crypto';
import { databasePool } from '../../../db';
import { hashPassword } from './jsonIdentityRepository';
import type { IdentityCredentialRepository } from '../application/identityAccessPorts';

/**
 * Reset de palavra-passe persistido em PostgreSQL.
 *
 * O token em claro só existe em memória até ser entregue ao adaptador de
 * email. A base de dados guarda apenas o hash (scrypt) e a expiração; uma
 * leitura da tabela não permite reconstruir nem reutilizar o token.
 */

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function requirePool() {
  if (!databasePool) throw new Error('PostgreSQL não está configurado.');
  return databasePool;
}

export function hashPasswordResetToken(token: string): string {
  return scryptSync(token, 'guigui-password-reset', 32).toString('hex');
}

export async function createPostgresPasswordReset(email: string): Promise<string | null> {
  const pool = requirePool();
  const normalizedEmail = email.trim().toLowerCase();
  const user = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND account_status = $2 LIMIT 1',
    [normalizedEmail, 'active'],
  );
  const userId = user.rows[0]?.id ? String(user.rows[0].id) : null;
  if (!userId) return null;

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  // Um novo pedido invalida os anteriores: só o último email pode ser usado.
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  await pool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [`prt-${randomBytes(12).toString('hex')}`, userId, tokenHash, expiresAt],
  );
  return token;
}

export async function resetPostgresPassword(token: string, newPassword: string): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed || newPassword.length < 8) return false;
  const pool = requirePool();
  const tokenHash = hashPasswordResetToken(trimmed);
  // Consome o token e altera a palavra-passe na mesma instrução. O DELETE
  // condicional garante que um token expirado, usado ou desconhecido não
  // produz qualquer alteração (rowCount fica a 0).
  const result = await pool.query(
    `WITH consumed AS (
       DELETE FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING user_id
     )
     UPDATE users
        SET password_hash = $2, updated_at = NOW()
       FROM consumed
      WHERE users.id = consumed.user_id
      RETURNING users.id`,
    [tokenHash, hashPassword(newPassword)],
  );
  return (result.rowCount ?? 0) === 1;
}

export function createPostgresCredentialRepository(changeDemoPassword: IdentityCredentialRepository['changeDemoPassword']): IdentityCredentialRepository {
  return {
    changeDemoPassword,
    createPasswordReset: createPostgresPasswordReset,
    resetPassword: resetPostgresPassword,
  };
}
