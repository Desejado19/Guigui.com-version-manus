import { readSnapshot, runImport, type ImportPool } from './importRunner';

type LegacyAudit = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  actorRole?: string;
  actorName?: string;
  requestId: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const audits = readSnapshot<LegacyAudit[]>('audit-logs.json');

async function importAudit(entry: LegacyAudit, pool: ImportPool): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (id,action,resource,resource_id,result,reason,request_id,after_data,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
    [entry.id, entry.action, entry.resource, entry.resourceId || null, entry.success ? 'success' : 'failure', typeof entry.metadata?.reason === 'string' ? entry.metadata.reason : null, entry.requestId, JSON.stringify({ ...(entry.metadata || {}), actorRole: entry.actorRole, actorName: entry.actorName }), entry.createdAt],
  );
}

await runImport({
  label: 'auditoria',
  records: audits,
  importRecord: (entry, pool) => importAudit(entry, pool),
  summary: (_pool, records) => `postgres-audit-import: ${records.length} evento(s) importado(s)`,
});
