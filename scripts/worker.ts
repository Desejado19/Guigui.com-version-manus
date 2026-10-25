import { claimJob, completeJob, failJob, JOB_TYPES } from '../server/jobQueueService';

const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  notification: async () => {},
  webhook: async () => {},
  export: async () => {},
  backup: async () => {},
  reconciliation: async () => {},
};

const job = await claimJob(JOB_TYPES);
if (!job) {
  console.log('worker: no pending jobs');
  process.exit(0);
}

const handler = handlers[job.type];
if (!handler) throw new Error(`worker: unsupported job type ${job.type}`);

try {
  await handler(job.payload);
  const completed = await completeJob(job.id, job.leaseToken);
  if (!completed) {
    console.error(`worker: lease lost before completion ${job.id}`);
    process.exitCode = 1;
  } else {
    console.log(`worker: completed ${job.id}`);
  }
} catch (error) {
  const result = await failJob(
    job.id,
    job.leaseToken,
    error instanceof Error ? error : new Error(String(error)),
  );
  console.error(`worker: ${result} ${job.id}`);
  process.exitCode = 1;
}
