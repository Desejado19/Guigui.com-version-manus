import type { Pool } from 'pg';
import type { OperationsMaintenanceRepository } from '../application/runOperationsMaintenance';

type OperationsMaintenanceQueryPort = Pick<Pool, 'query'>;

function deletedCount(rowCount: number | null, table: string): number {
  if (rowCount === null) {
    throw new Error(`PostgreSQL did not return a deletion count for ${table}.`);
  }
  return rowCount;
}

export function createPostgresOperationsMaintenanceRepository(
  queryPort: OperationsMaintenanceQueryPort,
): OperationsMaintenanceRepository {
  return {
    async deleteExpiredRateLimitBuckets() {
      const result = await queryPort.query(
        'DELETE FROM rate_limit_buckets WHERE expires_at <= NOW()',
      );
      return deletedCount(result.rowCount, 'rate_limit_buckets');
    },

    async deleteCompletedJobs(cutoff) {
      const result = await queryPort.query(
        `DELETE FROM async_jobs
         WHERE status = 'completed' AND completed_at <= $1`,
        [cutoff],
      );
      return deletedCount(result.rowCount, 'completed async_jobs');
    },

    async deleteDeadLetterJobs(cutoff) {
      const result = await queryPort.query(
        `DELETE FROM async_jobs
         WHERE status = 'dead_letter' AND dead_lettered_at <= $1`,
        [cutoff],
      );
      return deletedCount(result.rowCount, 'dead-letter async_jobs');
    },

    async deleteExpiredProductEvents(cutoff) {
      const result = await queryPort.query(
        'DELETE FROM product_events WHERE occurred_at <= $1',
        [cutoff],
      );
      return deletedCount(result.rowCount, 'product_events');
    },
  };
}
