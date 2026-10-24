import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseQaTarget } from '../../scripts/qa/validate-target';
import { provisionQaDatabase } from '../../scripts/qa/provision-database';

const { poolConstructor } = vi.hoisted(() => ({
  poolConstructor: vi.fn(),
}));

vi.mock('pg', () => ({ Pool: poolConstructor }));

const validQaEnvironment = {
  QA_ADMIN_DATABASE_URL: 'postgresql://qa_user:private-value@127.0.0.1:5432/postgres',
  QA_DATABASE_NAME: 'guigui_pg18_synthetic_target',
  QA_PORT: '4313',
};

describe('parseQaTarget', () => {
  it('returns only the validated loopback app target and database name', () => {
    expect(parseQaTarget(validQaEnvironment)).toEqual({
      appHost: '127.0.0.1',
      appPort: 4313,
      databaseName: 'guigui_pg18_synthetic_target',
    });
  });

  it.each([
    ['non-loopback database host', { ...validQaEnvironment, QA_ADMIN_DATABASE_URL: 'postgresql://qa_user:private-value@db.example:5432/postgres' }],
    ['non-PostgreSQL protocol', { ...validQaEnvironment, QA_ADMIN_DATABASE_URL: 'mysql://qa_user:private-value@127.0.0.1:5432/postgres' }],
    ['wrong reserved database name', { ...validQaEnvironment, QA_DATABASE_NAME: 'guigui_qa_random' }],
    ['invalid app port', { ...validQaEnvironment, QA_PORT: 'invalid' }],
    ['port 3000', { ...validQaEnvironment, QA_PORT: '3000' }],
    ['missing admin connection', { ...validQaEnvironment, QA_ADMIN_DATABASE_URL: '' }],
  ])('rejects %s', (_scenario, env) => {
    expect(() => parseQaTarget(env)).toThrow();
  });

  it('does not expose database credentials in validation errors', () => {
    const secretUrl = 'postgresql://qa_user:do-not-leak@remote.example:5432/postgres';
    let caughtError: unknown;
    try {
      parseQaTarget({ ...validQaEnvironment, QA_ADMIN_DATABASE_URL: secretUrl });
    } catch (error) {
      caughtError = error;
    }
    expect(caughtError).toBeInstanceOf(Error);
    if (!(caughtError instanceof Error)) throw new Error('expected target validation to fail');
    expect(caughtError.message).not.toContain('do-not-leak');
    expect(caughtError.message).not.toContain(secretUrl);
  });
});

describe('provisionQaDatabase', () => {
  const target = {
    appHost: '127.0.0.1' as const,
    appPort: 4313 as const,
    databaseName: 'guigui_pg18_synthetic_target',
  } as const;
  const connectionString = 'postgresql://qa_user:private-value@127.0.0.1:5432/postgres';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses to create a database that already exists', async () => {
    const adminPool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ server_version_num: '180002' }] })
        .mockResolvedValueOnce({ rows: [{ exists: true }] }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    poolConstructor.mockImplementation(function () {
      return adminPool;
    });

    await expect(provisionQaDatabase(target, connectionString))
      .rejects.toThrow(/already exists/i);
    expect(adminPool.query).toHaveBeenCalledTimes(2);
    expect(adminPool.query.mock.calls.some(([sql]) => String(sql).startsWith('CREATE DATABASE')))
      .toBe(false);
    expect(adminPool.end).toHaveBeenCalledOnce();
  });

  it('refuses PostgreSQL versions other than 18 before creating a database', async () => {
    const adminPool = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ server_version_num: '170006' }] }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    poolConstructor.mockImplementation(function () {
      return adminPool;
    });

    await expect(provisionQaDatabase(target, connectionString))
      .rejects.toThrow(/PostgreSQL 18/i);
    expect(adminPool.query).toHaveBeenCalledOnce();
    expect(adminPool.end).toHaveBeenCalledOnce();
  });
});
