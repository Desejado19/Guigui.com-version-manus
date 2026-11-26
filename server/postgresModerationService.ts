import { databasePool } from './db';

type ModerationLog = {
  id: string;
  type: string;
  status: string;
  contentSnippet?: string;
  businessName?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  result?: { status?: string; reason?: string; confidence?: number; suggestedAction?: string };
  [key: string]: unknown;
};

const statusMap: Record<string, string> = {
  pending_human: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  appealed: 'appealed',
};

const statusFromDb: Record<string, string> = {
  pending: 'pending_human',
  approved: 'approved',
  rejected: 'rejected',
  appealed: 'appealed',
};

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  try {
    return new Date(String(value)).toISOString();
  } catch {
    return String(value);
  }
}

export async function persistPostgresModeration(log: ModerationLog): Promise<void> {
  if (!databasePool) return;
  await databasePool.query(
    `INSERT INTO moderation_items
      (id,content_type,content_id,status,decision_reason,created_at,reviewed_at,item_data)
     VALUES ($1,$2,$1,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,
       decision_reason=EXCLUDED.decision_reason, reviewed_at=EXCLUDED.reviewed_at,
       item_data=EXCLUDED.item_data`,
    [
      log.id,
      log.type,
      statusMap[log.status] || 'pending',
      log.result?.reason || null,
      log.createdAt,
      isoOrNull(log.reviewedAt),
      JSON.stringify(log),
    ],
  );
}

export async function persistPostgresModerationReview(log: ModerationLog): Promise<void> {
  await persistPostgresModeration(log);
}

/** Devolve um item de moderação completo a partir do item_data guardado na BD. */
export async function findPostgresModeration(id: string): Promise<ModerationLog | null> {
  if (!databasePool) return null;
  const result = await databasePool.query('SELECT item_data FROM moderation_items WHERE id=$1', [id]);
  const row = result.rows[0];
  if (!row?.item_data || typeof row.item_data !== 'object') return null;
  return row.item_data as ModerationLog;
}

/** Lista os registos de moderação da BD (mais recentes primeiro). */
export async function listPostgresModeration(limit = 500): Promise<ModerationLog[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(
    `SELECT id, content_type, status, decision_reason, created_at, reviewed_at, reviewed_by, item_data
       FROM moderation_items
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row: Record<string, unknown>) => {
    if (row.item_data && typeof row.item_data === 'object') return row.item_data as ModerationLog;
    return {
      id: String(row.id),
      type: String(row.content_type || 'post'),
      status: statusFromDb[String(row.status)] || 'pending_human',
      contentSnippet: '',
      authorName: 'Desconhecido',
      result: {
        status: row.status === 'approved' ? 'verde' : row.status === 'rejected' || row.status === 'appealed' ? 'vermelho' : 'amarelo',
        reason: row.decision_reason ? String(row.decision_reason) : 'Sem motivo de análise registado.',
        confidence: 0,
        suggestedAction: 'flag_for_human_review',
      },
      createdAt: isoOrNull(row.created_at) || new Date().toISOString(),
      reviewedAt: isoOrNull(row.reviewed_at) || undefined,
      reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
      auditTrail: [],
    } as ModerationLog;
  });
}
