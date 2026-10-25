import { readSnapshot, runImportFromCli, type ImportPool } from './importRunner';

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

async function importAudit(entry: LegacyAudit, pool: ImportPool): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO audit_logs (id,action,resource,resource_id,result,reason,request_id,after_data,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
    [entry.id, entry.action, entry.resource, entry.resourceId || null, entry.success ? 'success' : 'failure', typeof entry.metadata?.reason === 'string' ? entry.metadata.reason : null, entry.requestId, JSON.stringify({ ...(entry.metadata || {}), actorRole: entry.actorRole, actorName: entry.actorName }), entry.createdAt],
  );
  return result.rowCount === 1;
}

await runImportFromCli({
  label: 'auditoria',
  records: audits,
  recordKey: (entry) => entry.id,
  validateRecord: (entry) => Boolean(
    entry
    && typeof entry.id === 'string'
    && entry.id.trim()
    && typeof entry.action === 'string'
    && typeof entry.resource === 'string'
    && typeof entry.requestId === 'string'
    && typeof entry.success === 'boolean'
    && typeof entry.createdAt === 'string'
    && (!entry.metadata || typeof entry.metadata === 'object'),
  ),
  hasConflict: async (entry, pool) => (
    await pool.query('SELECT 1 FROM audit_logs WHERE id = $1 LIMIT 1', [entry.id])
  ).rows.length > 0,
  importRecord: (entry, pool) => importAudit(entry, pool),
});
