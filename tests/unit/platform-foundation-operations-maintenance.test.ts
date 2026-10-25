import { describe, expect, it, vi } from 'vitest';
import {
  runOperationsMaintenance,
  type OperationsMaintenanceRepository,
} from '../../server/modules/platform-foundation/maintenance/application/runOperationsMaintenance';
import { createPostgresOperationsMaintenanceRepository } from '../../server/modules/platform-foundation/maintenance/adapters/postgresOperationsMaintenanceRepository';

function createRepository(
  overrides: Partial<OperationsMaintenanceRepository> = {},
): OperationsMaintenanceRepository {
  return {
    deleteExpiredRateLimitBuckets: vi.fn().mockResolvedValue(2),
    deleteCompletedJobs: vi.fn().mockResolvedValue(3),
    deleteDeadLetterJobs: vi.fn().mockResolvedValue(4),
    deleteExpiredProductEvents: vi.fn().mockResolvedValue(5),
    ...overrides,
  };
}

describe('platform-foundation operations maintenance', () => {
  const now = new Date('2026-10-25T13:00:00.000Z');

  it('purges completed jobs at the 30-day terminal-time boundary', async () => {
    const repository = createRepository();

    await runOperationsMaintenance(repository, now);

    expect(repository.deleteCompletedJobs).toHaveBeenCalledWith(
      new Date('2026-09-25T13:00:00.000Z'),
    );
  });

  it('purges dead-letter jobs at the 30-day terminal-time boundary', async () => {
    const repository = createRepository();

    await runOperationsMaintenance(repository, now);

    expect(repository.deleteDeadLetterJobs).toHaveBeenCalledWith(
      new Date('2026-09-25T13:00:00.000Z'),
    );
  });

  it('purges product events at the 365-day occurrence-time boundary', async () => {
    const repository = createRepository();

    await runOperationsMaintenance(repository, now);

    expect(repository.deleteExpiredProductEvents).toHaveBeenCalledWith(
      new Date('2025-10-25T13:00:00.000Z'),
    );
  });

  it('purges rate-limit buckets using the PostgreSQL clock', async () => {
    const repository = createRepository();

    const summary = await runOperationsMaintenance(repository, now);

    expect(repository.deleteExpiredRateLimitBuckets).toHaveBeenCalledWith();
    expect(summary).toEqual({
      expiredRateLimitBuckets: 2,
      completedJobs: 3,
      deadLetterJobs: 4,
      expiredProductEvents: 5,
    });
  });

  it('keeps pending and processing jobs outside terminal-state deletion queries', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const repository = createPostgresOperationsMaintenanceRepository({ query });

    await repository.deleteCompletedJobs(now);
    await repository.deleteDeadLetterJobs(now);

    expect(query.mock.calls[0][0]).toContain("status = 'completed'");
    expect(query.mock.calls[0][0]).toContain('completed_at <= $1');
    expect(query.mock.calls[0][1]).toEqual([now]);
    expect(query.mock.calls[1][0]).toContain("status = 'dead_letter'");
    expect(query.mock.calls[1][0]).toContain('dead_lettered_at <= $1');
    expect(query.mock.calls[1][1]).toEqual([now]);
    expect(query.mock.calls.map(([sql]) => sql).join('\n')).not.toMatch(
      /status\s*=\s*'(?:pending|processing)'/i,
    );
  });

  it('does not delete persistent HTTP metrics during maintenance', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const repository = createPostgresOperationsMaintenanceRepository({ query });

    await repository.deleteExpiredRateLimitBuckets();
    await repository.deleteCompletedJobs(now);
    await repository.deleteDeadLetterJobs(now);
    await repository.deleteExpiredProductEvents(now);

    expect(query.mock.calls[0][0]).toContain('expires_at <= NOW()');
    expect(query.mock.calls[0][1]).toBeUndefined();
    expect(query.mock.calls.map(([sql]) => sql).join('\n')).not.toMatch(/request_metrics/i);
  });

  it('propagates maintenance failures without reporting a successful summary', async () => {
    const failure = new Error('retention database unavailable');
    const repository = createRepository({
      deleteExpiredRateLimitBuckets: vi.fn().mockRejectedValue(failure),
    });

    await expect(runOperationsMaintenance(repository, now)).rejects.toBe(failure);
    expect(repository.deleteCompletedJobs).not.toHaveBeenCalled();
  });
});
