import { describe, expect, it } from 'vitest';
import {
  assertSyntheticSeedValid,
  createSyntheticSeedSql,
  SYNTHETIC_SEED_10000_MANIFEST,
  SYNTHETIC_SEED_MANIFEST,
} from '../../scripts/generate-postgres-synthetic-seed';

describe('synthetic PostgreSQL seed manifest', () => {
  it('builds the exact 1,000-row dataset across the approved domains', () => {
    const total = Object.values(SYNTHETIC_SEED_MANIFEST).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(1000);
    assertSyntheticSeedValid(SYNTHETIC_SEED_MANIFEST);
  });

  it('builds a guarded 10,000-row dataset with expanded relational records', () => {
    const total = Object.values(SYNTHETIC_SEED_10000_MANIFEST).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(10000);

    const sql = createSyntheticSeedSql(SYNTHETIC_SEED_10000_MANIFEST);

    expect(sql).toContain("'guigui.synthetic_seed.10000'");
    expect(sql).toContain("'domain_rows', 10000");
    expect(sql).toContain('expected exactly 10000 rows');
    expect(sql).toContain('synthetic_user_500');
    expect(sql).toContain('synthetic_company_300');
    expect(sql).toContain('synthetic_conversation_300');
    const conversationInsert = /INSERT INTO conversations \([^)]+\) VALUES ([\s\S]*?) ON CONFLICT/.exec(sql);
    expect(conversationInsert?.[1]).toBeDefined();
    if (!conversationInsert) throw new Error('Generated SQL is missing conversations.');
    const conversationPairs = Array.from(
      conversationInsert[1].matchAll(/'synthetic_user_(\d+)', 'synthetic_company_(\d+)'/g),
      ([, userId, companyId]) => `${userId}:${companyId}`,
    );
    expect(conversationPairs).toHaveLength(300);
    expect(new Set(conversationPairs).size).toBe(300);
    expect(sql).toContain("current_database() <> 'guigui_pg18_synthetic_target'");
    expect(sql).not.toContain('TRUNCATE');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain('DELETE FROM');
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
