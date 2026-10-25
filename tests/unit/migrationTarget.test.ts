import { describe, expect, it } from 'vitest';
import {
  assertMigrationTarget,
  resolveMigrationTarget,
} from '../../scripts/migrationTarget';

describe('resolveMigrationTarget', () => {
  it('requires DB_MIGRATION_URL instead of inheriting DATABASE_URL', () => {
    expect(() => resolveMigrationTarget({
      DATABASE_URL: 'postgres://synthetic@127.0.0.1/application',
    }, ['--confirm-target', 'guigui_synthetic_test']))
      .toThrow(/DB_MIGRATION_URL/i);
  });

  it('requires explicit confirmation of the intended database name', () => {
    expect(() => resolveMigrationTarget({
      DB_MIGRATION_URL: 'postgres://synthetic@127.0.0.1/guigui_synthetic_test',
    }, []))
      .toThrow(/--confirm-target/i);
  });

  it('accepts only the explicitly supplied migration target', () => {
    expect(resolveMigrationTarget({
      DB_MIGRATION_URL: 'postgres://synthetic@127.0.0.1/guigui_synthetic_test',
    }, ['--confirm-target', 'guigui_synthetic_test'])).toEqual({
      connectionString: 'postgres://synthetic@127.0.0.1/guigui_synthetic_test',
      confirmTarget: 'guigui_synthetic_test',
    });
  });
});

describe('assertMigrationTarget', () => {
  it('rejects a confirmation that differs from the connected database', () => {
    expect(() => assertMigrationTarget('production', 'guigui_synthetic_test'))
      .toThrow(/does not match/i);
  });
});
