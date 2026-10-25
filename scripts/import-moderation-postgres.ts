import { readSnapshot, runImportFromCli, type ImportPool } from './importRunner';

type ModerationLog = {
  id: string;
  type: string;
  status: string;
  result?: { reason?: string };
  createdAt: string;
  reviewedAt?: string;
};

const statusMap: Record<string, string> = { pending_human: 'pending', approved: 'approved', rejected: 'rejected', appealed: 'appealed' };

const logs = readSnapshot<ModerationLog[]>('moderation-logs.json');

async function importModeration(log: ModerationLog, pool: ImportPool): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO moderation_items (id,content_type,content_id,status,decision_reason,created_at,reviewed_at)
     VALUES ($1,$2,$1,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    [log.id, log.type, statusMap[log.status] || 'pending', log.result?.reason || null, log.createdAt, log.reviewedAt || null],
  );
  return result.rowCount === 1;
}

await runImportFromCli({
  label: 'moderação',
  records: logs,
  recordKey: (log) => log.id,
  validateRecord: (log) => Boolean(
    log
    && typeof log.id === 'string'
    && log.id.trim()
    && typeof log.type === 'string'
    && Object.prototype.hasOwnProperty.call(statusMap, log.status)
    && typeof log.createdAt === 'string',
  ),
  hasConflict: async (log, pool) => (
    await pool.query('SELECT 1 FROM moderation_items WHERE id = $1 LIMIT 1', [log.id])
  ).rows.length > 0,
  importRecord: (log, pool) => importModeration(log, pool),
});
