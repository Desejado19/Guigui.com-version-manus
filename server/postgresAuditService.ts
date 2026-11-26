import { databasePool, withDbIdentity } from './db';
import type { AuditEntry } from './validationService';

export async function persistPostgresAudit(entry: AuditEntry): Promise<void> {
  if (!databasePool) return;
  // O registo de auditoria é uma trilha acrescentada pela aplicação, não uma
  // operação do pedido: escreve sempre como sistema. Sob RLS, `ON CONFLICT`
  // exige que a linha satisfaça também a política de SELECT (só administração),
  // por isso um cidadão/empresa nunca conseguiria gravar a trilha.
  await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
    databasePool.query(
      `INSERT INTO audit_logs
        (id,actor_user_id,action,resource,resource_id,result,reason,request_id,after_data,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        entry.id,
        entry.actorId || null,
        entry.action,
        entry.resource,
        entry.resourceId || null,
        entry.success ? 'success' : 'failure',
        typeof entry.metadata?.reason === 'string' ? entry.metadata.reason : null,
        entry.requestId,
        JSON.stringify({ ...(entry.metadata || {}), actorRole: entry.actorRole, actorName: entry.actorName }),
        entry.createdAt,
      ],
    ),
  );
}
