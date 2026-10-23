import { databasePool } from './db';
import type { AuditEntry } from './validationService';

export async function persistPostgresAudit(entry: AuditEntry): Promise<void> {
  if (!databasePool) return;
  await databasePool.query(
    `INSERT INTO audit_logs
      (id,action,resource,resource_id,result,reason,request_id,after_data,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO NOTHING`,
    [
      entry.id,
      entry.action,
      entry.resource,
      entry.resourceId || null,
      entry.success ? 'success' : 'failure',
      typeof entry.metadata?.reason === 'string' ? entry.metadata.reason : null,
      entry.requestId,
      JSON.stringify({ ...(entry.metadata || {}), actorRole: entry.actorRole, actorName: entry.actorName }),
      entry.createdAt,
    ],
  );
}
