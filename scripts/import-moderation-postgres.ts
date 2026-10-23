import { readSnapshot, runImport, type ImportPool } from './importRunner';

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

async function importModeration(log: ModerationLog, pool: ImportPool): Promise<void> {
  await pool.query(
    `INSERT INTO moderation_items (id,content_type,content_id,status,decision_reason,created_at,reviewed_at)
     VALUES ($1,$2,$1,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, decision_reason=EXCLUDED.decision_reason, reviewed_at=EXCLUDED.reviewed_at`,
    [log.id, log.type, statusMap[log.status] || 'pending', log.result?.reason || null, log.createdAt, log.reviewedAt || null],
  );
}

await runImport({
  label: 'moderação',
  records: logs,
  importRecord: (log, pool) => importModeration(log, pool),
  summary: (_pool, records) => `postgres-moderation-import: ${records.length} item(ns) importado(s)`,
});
