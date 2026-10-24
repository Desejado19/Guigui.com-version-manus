import { describe, expect, it } from 'vitest';
import { assertSyntheticSeedValid, createSyntheticSeedSql, SYNTHETIC_SEED_MANIFEST } from '../../scripts/generate-postgres-synthetic-seed';

describe('synthetic PostgreSQL seed manifest', () => {
  it('builds the exact 1,000-row dataset across the approved domains', () => {
    const total = Object.values(SYNTHETIC_SEED_MANIFEST).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(1000);
    assertSyntheticSeedValid(SYNTHETIC_SEED_MANIFEST);
  });

  it('does not generate live user credentials or real email addresses', () => {
    const sql = createSyntheticSeedSql();

    expect(sql).toContain('synthetic_user_001');
    expect(sql).toContain("'deactivated'");
    expect(sql).toContain('@example.test');
    expect(sql).not.toContain('@gmail.com');
    expect(sql).not.toContain('@hotmail.com');
    expect(sql).not.toContain('admin@');
    expect(sql).not.toContain('secret123');
    expect(sql).toContain('synthetic_password_hash_');
  });

  it('emits pgAdmin-safe import SQL with guards and safe upsert semantics', () => {
    const sql = createSyntheticSeedSql();

    expect(sql).toContain("current_setting('server_version_num')::integer / 10000 <> 18");
    expect(sql).toContain("current_database() <> 'guigui_pg18_synthetic_target'");
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(sql).toContain('ON CONFLICT (company_id, user_id) DO NOTHING');
    expect(sql).toContain('ON CONFLICT (user_id, business_id) DO NOTHING');
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('guigui.synthetic_seed.1000');
    expect(sql).toContain('A different synthetic seed version is already recorded');
    expect(sql).toContain('expected exactly 1000 rows');
    expect(sql).not.toContain('TRUNCATE');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain('DELETE FROM');
  });
});
