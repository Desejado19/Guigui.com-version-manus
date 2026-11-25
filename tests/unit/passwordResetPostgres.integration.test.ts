import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Corre contra uma base de teste real; sem TEST_DATABASE_URL fica desactivado
// para o `vitest run` normal não tocar na base de desenvolvimento.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;
const describeIfDb = testDatabaseUrl ? describe : describe.skip;

describeIfDb('reset de palavra-passe em PostgreSQL', () => {
  let db: typeof import('../../server/db');
  let repository: typeof import('../../server/modules/identity-access/infrastructure/postgresIdentityRepository');
  let credentials: typeof import('../../server/modules/identity-access/infrastructure/postgresCredentialRepository');
  let passwords: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  const email = `reset-${randomUUID()}@test.guigui`;

  beforeAll(async () => {
    db = await import('../../server/db');
    repository = await import('../../server/modules/identity-access/infrastructure/postgresIdentityRepository');
    credentials = await import('../../server/modules/identity-access/infrastructure/postgresCredentialRepository');
    passwords = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
    const user = await repository.createPostgresUser({
      name: 'Reset Postgres',
      email,
      phone: '+245955009999',
      neighborhood: 'Bissau',
      role: 'user',
      password: 'OriginalHorse42',
    });
    expect(user).toBeTruthy();
  });

  afterAll(async () => {
    if (db?.databasePool) {
      await db.databasePool.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      await db.databasePool.end();
    }
  });

  it('guarda apenas o hash, expira o token e consome-o uma única vez', async () => {
    const pool = db.databasePool!;
    const token = await credentials.createPostgresPasswordReset(email);
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const stored = await pool.query(
      'SELECT token_hash, expires_at, used_at FROM password_reset_tokens WHERE user_id = (SELECT id FROM users WHERE LOWER(email)=LOWER($1))',
      [email],
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].token_hash).not.toBe(token);
    expect(stored.rows[0].token_hash).toBe(credentials.hashPasswordResetToken(token!));
    expect(new Date(stored.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(stored.rows[0].used_at).toBeNull();

    await expect(credentials.resetPostgresPassword(token!, 'UpdatedHorse42')).resolves.toBe(true);
    const updated = await repository.findPostgresUserByEmail(email);
    expect(updated && passwords.verifyPassword('UpdatedHorse42', updated.passwordHash)).toBe(true);
    expect(updated && passwords.verifyPassword('OriginalHorse42', updated.passwordHash)).toBe(false);

    await expect(credentials.resetPostgresPassword(token!, 'AnotherHorse42')).resolves.toBe(false);
  });

  it('rejeita tokens expirados e invalida o pedido anterior quando há um novo', async () => {
    const pool = db.databasePool!;
    const first = await credentials.createPostgresPasswordReset(email);
    const second = await credentials.createPostgresPasswordReset(email);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    await expect(credentials.resetPostgresPassword(first!, 'FirstHorse42')).resolves.toBe(false);
    await expect(credentials.resetPostgresPassword(second!, 'SecondHorse42')).resolves.toBe(true);

    const expired = await credentials.createPostgresPasswordReset(email);
    expect(expired).toBeTruthy();
    await pool.query("UPDATE password_reset_tokens SET expires_at = NOW() - interval '1 minute' WHERE token_hash = $1", [
      credentials.hashPasswordResetToken(expired!),
    ]);
    await expect(credentials.resetPostgresPassword(expired!, 'ExpiredHorse42')).resolves.toBe(false);
  });
});
