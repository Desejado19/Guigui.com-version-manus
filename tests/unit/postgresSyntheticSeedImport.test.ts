import { describe, expect, it } from 'vitest';
import { createSyntheticSeedSql } from '../../scripts/generate-postgres-synthetic-seed';
import { validateSyntheticSeedTarget } from '../../scripts/validate-postgres-synthetic-seed';

describe('synthetic PostgreSQL import contract', () => {
  it('rejects a non-PG18 database target', () => {
    expect(() =>
      validateSyntheticSeedTarget({
        databaseName: 'guigui_local_dev',
        serverVersionNum: 170000,
        rowCounts: {},
      }),
    ).toThrow(/PostgreSQL 18/i);
  });

  it('rejects a populated target database', () => {
    expect(() =>
      validateSyntheticSeedTarget({
        databaseName: 'guigui_pg18_synthetic_target',
        serverVersionNum: 180000,
        rowCounts: { users: 12, companies: 4 },
      }),
    ).toThrow(/empty before import/i);
  });

  it('accepts only the dedicated target name and exact PostgreSQL major version', () => {
    expect(() =>
      validateSyntheticSeedTarget({
        databaseName: 'guigui_local_dev',
        serverVersionNum: 180006,
      }),
    ).toThrow(/guigui_pg18_synthetic_target/);

    expect(() =>
      validateSyntheticSeedTarget({
        databaseName: 'guigui_pg18_synthetic_target',
        serverVersionNum: 190000,
      }),
    ).toThrow(/PostgreSQL 18/);

    expect(() =>
      validateSyntheticSeedTarget({
        databaseName: 'guigui_pg18_synthetic_target',
        serverVersionNum: 180006,
        rowCounts: {},
      }),
    ).not.toThrow();
  });

  it('contains the target guard and rejects destructive SQL patterns', () => {
    const sql = createSyntheticSeedSql();

    expect(sql).toContain('current_database() <>');
    expect(sql).toContain('Synthetic seed target must be empty before first import');
    expect(sql).not.toContain('TRUNCATE');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain('DELETE FROM');
    expect(sql).toContain('UNION ALL');
  });
});
