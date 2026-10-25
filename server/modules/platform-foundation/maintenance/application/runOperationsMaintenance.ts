const JOB_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRODUCT_EVENT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export type OperationsMaintenanceSummary = {
  expiredRateLimitBuckets: number;
  completedJobs: number;
  deadLetterJobs: number;
  expiredProductEvents: number;
};

export interface OperationsMaintenanceRepository {
  deleteExpiredRateLimitBuckets(now: Date): Promise<number>;
  deleteCompletedJobs(cutoff: Date): Promise<number>;
  deleteDeadLetterJobs(cutoff: Date): Promise<number>;
  deleteExpiredProductEvents(cutoff: Date): Promise<number>;
}

export async function runOperationsMaintenance(
  repository: OperationsMaintenanceRepository,
  now: Date,
): Promise<OperationsMaintenanceSummary> {
  const expiredRateLimitBuckets = await repository.deleteExpiredRateLimitBuckets(now);
  const jobCutoff = new Date(now.getTime() - JOB_RETENTION_MS);
  const completedJobs = await repository.deleteCompletedJobs(jobCutoff);
  const deadLetterJobs = await repository.deleteDeadLetterJobs(jobCutoff);
  const eventCutoff = new Date(now.getTime() - PRODUCT_EVENT_RETENTION_MS);
  const expiredProductEvents = await repository.deleteExpiredProductEvents(eventCutoff);

  return {
    expiredRateLimitBuckets,
    completedJobs,
    deadLetterJobs,
    expiredProductEvents,
  };
}
