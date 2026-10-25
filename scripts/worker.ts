import {
  checkDatabaseConnection,
  databasePool,
} from '../server/db';
import {
  claimJob,
  completeJob,
  failJob,
  renewJobLease,
} from '../server/jobQueueService';
import {
  assertWorkerDatabaseReady,
  runJobWorker,
  type JobHandlerRegistry,
  type JobQueueOperations,
} from '../server/modules/platform-foundation/jobs/application/runJobWorker';
import { createPostgresOperationsMaintenanceRepository } from '../server/modules/platform-foundation/maintenance/adapters/postgresOperationsMaintenanceRepository';
import { runOperationsMaintenance } from '../server/modules/platform-foundation/maintenance/application/runOperationsMaintenance';
import { sanitizeDiagnostic } from '../server/modules/platform-foundation/diagnostics/sanitizeDiagnostic';

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}

const controller = new AbortController();
const stopWorker = () => controller.abort();
process.on('SIGINT', stopWorker);
process.on('SIGTERM', stopWorker);

async function startWorker(): Promise<void> {
  try {
    const pool = databasePool;
    if (!pool) {
      assertWorkerDatabaseReady({ configured: false, connected: false });
      return;
    }

    assertWorkerDatabaseReady(await checkDatabaseConnection());
    const queue: JobQueueOperations = {
      claimJob,
      renewJobLease,
      completeJob,
      failJob,
    };
    const maintenanceRepository = createPostgresOperationsMaintenanceRepository(pool);
    const handlers: JobHandlerRegistry = {};

    await runJobWorker({
      queue,
      handlers,
      runMaintenance: (now) => runOperationsMaintenance(maintenanceRepository, now),
      signal: controller.signal,
      now: () => new Date(),
      sleep,
      logger: console,
    });
  } finally {
    process.off('SIGINT', stopWorker);
    process.off('SIGTERM', stopWorker);
    await databasePool?.end();
  }
}

void startWorker().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: 'worker_start_failed',
    message: sanitizeDiagnostic(error),
  }));
  process.exitCode = 1;
});
