import { describe, expect, it, vi } from 'vitest';
import {
  parseQaDatabaseName,
  seedAdminFixture,
  type FixtureDatabase,
} from '../../scripts/qa/seed-admin-fixture';
import { randomBytes } from 'node:crypto';
import { verifyPassword } from '../../server/modules/identity-access/infrastructure/passwordHash';

const fixturePassword = randomBytes(32).toString('hex');
const qaDatabaseUrl = 'postgresql://qa_user:qa_test_only@127.0.0.1:5432/guigui_pg18_synthetic_target';

function createDatabase(): FixtureDatabase & { query: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'qa-admin-fixture' }] })
      .mockResolvedValueOnce({ rows: [{ fixture_count: '1' }] }),
  };
}

describe('seedAdminFixture', () => {
  it('creates only the synthetic admin and stores a project-generated password hash', async () => {
    const database = createDatabase();

    await seedAdminFixture(database, 'guigui_pg18_synthetic_target', fixturePassword);

    const [insertSql, insertValues] = database.query.mock.calls[0] as [string, unknown[]];
    expect(insertSql).toMatch(/INSERT INTO users/i);
    expect(insertSql).toMatch(/'admin', 'active'/i);
    expect(insertValues).toEqual([
      'qa-admin-fixture',
      'Admin QA Sintetico',
      'admin.teste@guigui.com',
      '+245900000001',
      'Bissau',
      null,
      expect.any(String),
    ]);
    const passwordHash = insertValues[6] as string;
    expect(passwordHash).not.toBe(fixturePassword);
    expect(verifyPassword(fixturePassword, passwordHash)).toBe(true);
    expect(database.query.mock.calls[1]?.[0]).toMatch(/COUNT\(\*\)/i);
  });

  it('refuses any database other than the reserved synthetic QA target before querying', async () => {
    const database = createDatabase();

    await expect(seedAdminFixture(database, 'production', fixturePassword))
      .rejects.toThrow(/guigui_pg18_synthetic_target/i);

    expect(database.query).not.toHaveBeenCalled();
  });

  it('accepts only a loopback PostgreSQL URL naming the reserved QA database', () => {
    expect(parseQaDatabaseName(qaDatabaseUrl)).toBe('guigui_pg18_synthetic_target');
    expect(() => parseQaDatabaseName(
      'postgresql://qa_user:qa_test_only@example.invalid:5432/guigui_pg18_synthetic_target',
    )).toThrow(/loopback/i);
    expect(() => parseQaDatabaseName(
      'postgresql://qa_user:qa_test_only@127.0.0.1:5432/another_database',
    )).toThrow(/guigui_pg18_synthetic_target/i);
  });

  it('rejects empty fixture passwords without writing to the database', async () => {
    const database = createDatabase();

    await expect(seedAdminFixture(database, 'guigui_pg18_synthetic_target', '  '))
      .rejects.toThrow(/password/i);

    expect(database.query).not.toHaveBeenCalled();
  });
});
