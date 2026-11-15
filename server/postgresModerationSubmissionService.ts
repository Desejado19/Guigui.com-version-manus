import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { databasePool } from './db';

export const SUBMISSION_TYPES = [
  'event',
  'business',
  'business_profile',
  'post',
  'promotion',
  'campaign',
  'ticket',
  'other',
] as const;

export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export const SUBMISSION_STATUSES = [
  'draft',
  'pending',
  'in_review',
  'changes_requested',
  'resubmitted',
  'approved',
  'rejected',
  'cancelled',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type SubmissionPriority = 'low' | 'normal' | 'high' | 'urgent';

export type DecisionAction = 'approve' | 'reject' | 'request_changes' | 'in_review';

export interface ModerationSubmissionEvent {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  actorName: string | null;
  notes: string;
  createdAt: string;
}

export interface ModerationSubmission {
  id: string;
  type: SubmissionType;
  title: string;
  summary: string;
  referenceId: string | null;
  companyId: string | null;
  submittedBy: string | null;
  status: SubmissionStatus;
  priority: SubmissionPriority;
  payload: Record<string, unknown>;
  decisionReason: string;
  reviewerId: string | null;
  reviewerName: string | null;
  version: number;
  submittedAt: string;
  decidedAt: string | null;
  updatedAt: string;
  history?: ModerationSubmissionEvent[];
}

export type ModerationStatusCounts = Record<SubmissionStatus, number>;

export interface SubmissionFilters {
  type?: string;
  status?: string;
  companyId?: string;
  ownerUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

export class ModerationSubmissionError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = 'ModerationSubmissionError';
    this.code = code;
    this.status = status;
  }
}

const ACTIVE_STATUSES: SubmissionStatus[] = ['pending', 'in_review', 'changes_requested', 'resubmitted'];

function iso(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  return iso(value);
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

type Row = Record<string, unknown>;

function mapSubmission(row: Row): ModerationSubmission {
  return {
    id: String(row.id),
    type: String(row.type) as SubmissionType,
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    referenceId: row.reference_id ? String(row.reference_id) : null,
    companyId: row.company_id ? String(row.company_id) : null,
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    status: String(row.status) as SubmissionStatus,
    priority: String(row.priority ?? 'normal') as SubmissionPriority,
    payload: asObject(row.payload),
    decisionReason: String(row.decision_reason ?? ''),
    reviewerId: row.reviewer_id ? String(row.reviewer_id) : null,
    reviewerName: row.reviewer_name ? String(row.reviewer_name) : null,
    version: Number(row.version ?? 1),
    submittedAt: iso(row.submitted_at),
    decidedAt: isoOrNull(row.decided_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapEvent(row: Row): ModerationSubmissionEvent {
  return {
    id: String(row.id),
    action: String(row.action),
    fromStatus: row.from_status ? String(row.from_status) : null,
    toStatus: String(row.to_status),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorName: row.actor_name ? String(row.actor_name) : null,
    notes: String(row.notes ?? ''),
    createdAt: iso(row.created_at),
  };
}

async function insertHistory(
  client: PoolClient,
  input: {
    submissionId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    actorName: string | null;
    notes?: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO moderation_submission_events
       (id, submission_id, action, from_status, to_status, actor_user_id, actor_name, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      `MSE-${randomUUID()}`,
      input.submissionId,
      input.action,
      input.fromStatus,
      input.toStatus,
      input.actorUserId,
      input.actorName,
      input.notes ?? '',
    ],
  );
}

async function insertNotification(
  client: PoolClient,
  input: { userId: string | null; title: string; message: string; submissionId: string; status: string },
): Promise<void> {
  if (!input.userId) return;
  await client.query(
    `INSERT INTO notifications (id, user_id, category, title, message, metadata)
     VALUES ($1,$2,'moderation',$3,$4,$5::jsonb)`,
    [
      `NTC-${randomUUID()}`,
      input.userId,
      input.title,
      input.message,
      JSON.stringify({ submissionId: input.submissionId, moderationStatus: input.status }),
    ],
  );
}

function notificationContent(status: SubmissionStatus, title: string, reason: string): { title: string; message: string } {
  switch (status) {
    case 'in_review':
      return { title: 'Submissão em análise', message: `A sua submissão "${title}" está em análise pela equipa de moderação.` };
    case 'approved':
      return { title: 'Submissão aprovada', message: `A sua submissão "${title}" foi aprovada e já pode ser publicada.` };
    case 'rejected':
      return {
        title: 'Submissão recusada',
        message: `A sua submissão "${title}" foi recusada. Motivo: ${reason || 'não indicado'}.`,
      };
    case 'changes_requested':
      return {
        title: 'Alterações necessárias',
        message: `São necessárias alterações à submissão "${title}". Observações: ${reason || 'não indicadas'}.`,
      };
    case 'resubmitted':
      return { title: 'Submissão reenviada', message: `A sua submissão "${title}" foi reenviada e aguarda nova análise.` };
    default:
      return { title: 'Submissão registada', message: `A sua submissão "${title}" foi registada para aprovação.` };
  }
}

function buildWhere(filters: SubmissionFilters, includeStatus: boolean) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (includeStatus && filters.status && filters.status !== 'all') {
    conditions.push(`status = ${add(filters.status)}`);
  }
  if (filters.type && filters.type !== 'all') {
    conditions.push(`type = ${add(filters.type)}`);
  }
  if (filters.companyId && filters.ownerUserId) {
    const companyParam = add(filters.companyId);
    const ownerParam = add(filters.ownerUserId);
    conditions.push(`(company_id = ${companyParam} OR submitted_by = ${ownerParam})`);
  } else if (filters.companyId) {
    conditions.push(`company_id = ${add(filters.companyId)}`);
  } else if (filters.ownerUserId) {
    conditions.push(`submitted_by = ${add(filters.ownerUserId)}`);
  }
  if (filters.dateFrom) {
    conditions.push(`submitted_at >= ${add(`${filters.dateFrom}T00:00:00.000Z`)}::timestamptz`);
  }
  if (filters.dateTo) {
    conditions.push(`submitted_at <= ${add(`${filters.dateTo}T23:59:59.999Z`)}::timestamptz`);
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    const param = add(term);
    conditions.push(`(title ILIKE ${param} OR summary ILIKE ${param} OR coalesce(company_id, '') ILIKE ${param})`);
  }

  return { clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export async function listModerationSubmissions(
  filters: SubmissionFilters,
): Promise<{ items: ModerationSubmission[]; counts: ModerationStatusCounts; total: number }> {
  const emptyCounts = SUBMISSION_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as ModerationStatusCounts);
  if (!databasePool) return { items: [], counts: emptyCounts, total: 0 };

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);

  const listWhere = buildWhere(filters, true);
  const countWhere = buildWhere(filters, false);

  const [itemsResult, countsResult] = await Promise.all([
    databasePool.query(
      `SELECT * FROM moderation_submissions
       ${listWhere.clause}
       ORDER BY submitted_at DESC
       LIMIT ${limit}`,
      listWhere.params,
    ),
    databasePool.query(
      `SELECT status, count(*)::int AS n
         FROM moderation_submissions
         ${countWhere.clause}
        GROUP BY status`,
      countWhere.params,
    ),
  ]);

  const counts: ModerationStatusCounts = { ...emptyCounts };
  for (const row of countsResult.rows as Row[]) {
    const status = String(row.status) as SubmissionStatus;
    if (status in counts) counts[status] = Number(row.n ?? 0);
  }

  const items = (itemsResult.rows as Row[]).map(mapSubmission);
  return { items, counts, total: items.length };
}

export async function getModerationSubmission(id: string): Promise<ModerationSubmission | null> {
  if (!databasePool) return null;
  const [result, history] = await Promise.all([
    databasePool.query('SELECT * FROM moderation_submissions WHERE id=$1', [id]),
    databasePool.query(
      'SELECT * FROM moderation_submission_events WHERE submission_id=$1 ORDER BY created_at ASC',
      [id],
    ),
  ]);
  const row = result.rows[0] as Row | undefined;
  if (!row) return null;
  return { ...mapSubmission(row), history: (history.rows as Row[]).map(mapEvent) };
}

export interface CreateSubmissionInput {
  type: SubmissionType;
  title: string;
  summary?: string;
  referenceId?: string | null;
  companyId?: string | null;
  submittedBy?: string | null;
  priority?: SubmissionPriority;
  payload?: Record<string, unknown>;
  actorName?: string | null;
}

export async function createModerationSubmission(
  input: CreateSubmissionInput,
): Promise<{ submission: ModerationSubmission; duplicate: boolean }> {
  if (!databasePool) {
    throw new ModerationSubmissionError('A base de dados PostgreSQL é necessária para guardar submissões.', 'DATABASE_REQUIRED', 503);
  }
  const title = input.title.trim();
  if (!title) {
    throw new ModerationSubmissionError('O título da submissão é obrigatório.', 'SUBMISSION_TITLE_REQUIRED');
  }

  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');

    if (input.referenceId) {
      const existing = await client.query(
        `SELECT * FROM moderation_submissions
          WHERE type=$1 AND reference_id=$2 AND status = ANY($3::text[])
          FOR UPDATE`,
        [input.type, input.referenceId, ACTIVE_STATUSES],
      );
      const row = existing.rows[0] as Row | undefined;
      if (row) {
        const mergedPayload = { ...asObject(row.payload), ...(input.payload ?? {}) };
        const updated = await client.query(
          `UPDATE moderation_submissions
              SET title=$2, summary=$3, payload=$4::jsonb, updated_at=NOW()
            WHERE id=$1
            RETURNING *`,
          [row.id, title, input.summary ?? String(row.summary ?? ''), JSON.stringify(mergedPayload)],
        );
        await insertHistory(client, {
          submissionId: String(row.id),
          action: 'updated',
          fromStatus: String(row.status),
          toStatus: String(row.status),
          actorUserId: input.submittedBy ?? null,
          actorName: input.actorName ?? null,
          notes: 'Dados da submissão atualizados antes da decisão.',
        });
        await client.query('COMMIT');
        return { submission: mapSubmission(updated.rows[0] as Row), duplicate: true };
      }
    }

    const id = `MOD-${randomUUID()}`;
    const inserted = await client.query(
      `INSERT INTO moderation_submissions
         (id, type, title, summary, reference_id, company_id, submitted_by, status, priority, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9::jsonb)
       RETURNING *`,
      [
        id,
        input.type,
        title,
        input.summary ?? '',
        input.referenceId ?? null,
        input.companyId ?? null,
        input.submittedBy ?? null,
        input.priority ?? 'normal',
        JSON.stringify(input.payload ?? {}),
      ],
    );

    await insertHistory(client, {
      submissionId: id,
      action: 'submitted',
      fromStatus: null,
      toStatus: 'pending',
      actorUserId: input.submittedBy ?? null,
      actorName: input.actorName ?? null,
      notes: 'Submissão registada e colocada na fila de moderação.',
    });

    const notification = notificationContent('pending', title, '');
    await insertNotification(client, {
      userId: input.submittedBy ?? null,
      title: notification.title,
      message: notification.message,
      submissionId: id,
      status: 'pending',
    });

    await client.query('COMMIT');
    return { submission: mapSubmission(inserted.rows[0] as Row), duplicate: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export interface DecisionInput {
  id: string;
  action: DecisionAction;
  actorUserId: string;
  actorName: string;
  reason?: string;
}

const DECISION_TARGET: Record<DecisionAction, SubmissionStatus> = {
  approve: 'approved',
  reject: 'rejected',
  request_changes: 'changes_requested',
  in_review: 'in_review',
};

export async function decideModerationSubmission(input: DecisionInput): Promise<ModerationSubmission> {
  if (!databasePool) {
    throw new ModerationSubmissionError('A base de dados PostgreSQL é necessária para decidir submissões.', 'DATABASE_REQUIRED', 503);
  }
  const reason = (input.reason ?? '').trim();
  if ((input.action === 'reject' || input.action === 'request_changes') && reason.length < 5) {
    throw new ModerationSubmissionError(
      'É obrigatório indicar uma justificação com pelo menos 5 caracteres.',
      'DECISION_REASON_REQUIRED',
      422,
    );
  }

  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM moderation_submissions WHERE id=$1 FOR UPDATE', [input.id]);
    const row = found.rows[0] as Row | undefined;
    if (!row) {
      throw new ModerationSubmissionError('Submissão não encontrada.', 'SUBMISSION_NOT_FOUND', 404);
    }

    const currentStatus = String(row.status) as SubmissionStatus;
    const allowedFrom: SubmissionStatus[] = input.action === 'in_review'
      ? ['pending', 'resubmitted']
      : ['pending', 'in_review', 'resubmitted', 'changes_requested'];
    if (!allowedFrom.includes(currentStatus)) {
      throw new ModerationSubmissionError(
        `A submissão está no estado "${currentStatus}" e não pode receber esta ação.`,
        'INVALID_STATUS_TRANSITION',
        409,
      );
    }

    const nextStatus = DECISION_TARGET[input.action];
    const decided = input.action === 'in_review' ? null : new Date().toISOString();

    const updated = await client.query(
      `UPDATE moderation_submissions
          SET status=$2,
              decision_reason=$3,
              reviewer_id=$4,
              reviewer_name=$5,
              decided_at=$6::timestamptz,
              updated_at=NOW()
        WHERE id=$1
        RETURNING *`,
      [input.id, nextStatus, reason || String(row.decision_reason ?? ''), input.actorUserId, input.actorName, decided],
    );

    const referenceId = row.reference_id ? String(row.reference_id) : null;
    const submissionType = String(row.type);
    if (referenceId && input.action !== 'in_review') {
      if (submissionType === 'event') {
        const eventStatus = input.action === 'approve' ? 'published' : input.action === 'reject' ? 'rejected' : null;
        if (eventStatus) {
          await client.query('UPDATE events SET status=$2, updated_at=NOW() WHERE id=$1', [referenceId, eventStatus]);
        }
      } else if (submissionType === 'campaign' || submissionType === 'promotion' || submissionType === 'post' || submissionType === 'ticket') {
        // Conteúdo agendado: a publicação automática só é desbloqueada depois
        // da aprovação, e é bloqueada de novo se a submissão for recusada.
        if (input.action === 'approve' || input.action === 'reject') {
          await client.query(
            `UPDATE marketing_scheduled_items
                SET moderation_status=$2, updated_at=NOW()
              WHERE item_id=$1`,
            [referenceId, input.action === 'approve' ? 'approved' : 'rejected'],
          );
        }
      } else if (submissionType === 'business') {
        if (input.action === 'approve') {
          await client.query(
            `UPDATE companies
                SET status='active', reviewed_by=$2, reviewed_at=NOW(),
                    review_decision='approve', review_reason=$3, updated_at=NOW()
              WHERE id=$1`,
            [referenceId, input.actorUserId, reason],
          );
        } else if (input.action === 'reject') {
          await client.query(
            `UPDATE companies
                SET status='rejected', reviewed_by=$2, reviewed_at=NOW(),
                    review_decision='reject', review_reason=$3, updated_at=NOW()
              WHERE id=$1`,
            [referenceId, input.actorUserId, reason],
          );
        }
      }
    }

    await insertHistory(client, {
      submissionId: input.id,
      action: input.action,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      notes: reason || (input.action === 'in_review' ? 'Análise iniciada.' : ''),
    });

    const notification = notificationContent(nextStatus, String(row.title), reason);
    await insertNotification(client, {
      userId: row.submitted_by ? String(row.submitted_by) : null,
      title: notification.title,
      message: notification.message,
      submissionId: input.id,
      status: nextStatus,
    });

    await client.query('COMMIT');
    return mapSubmission(updated.rows[0] as Row);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export interface ResubmitInput {
  id: string;
  actorUserId: string;
  actorName: string;
  companyId?: string | null;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  changesNote: string;
}

export async function resubmitModerationSubmission(input: ResubmitInput): Promise<ModerationSubmission> {
  if (!databasePool) {
    throw new ModerationSubmissionError('A base de dados PostgreSQL é necessária para reenviar submissões.', 'DATABASE_REQUIRED', 503);
  }
  const note = input.changesNote.trim();

  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM moderation_submissions WHERE id=$1 FOR UPDATE', [input.id]);
    const row = found.rows[0] as Row | undefined;
    if (!row) throw new ModerationSubmissionError('Submissão não encontrada.', 'SUBMISSION_NOT_FOUND', 404);

    // Autoriza antes de validar: quem não tem posse da submissão recebe 403
    // mesmo com nota de alterações inválida.
    const isOwner = row.submitted_by && String(row.submitted_by) === input.actorUserId;
    const isCompany = input.companyId && row.company_id && String(row.company_id) === input.companyId;
    if (!isOwner && !isCompany) {
      throw new ModerationSubmissionError('Não possui permissão para reenviar esta submissão.', 'PERMISSION_DENIED', 403);
    }

    if (note.length < 5) {
      throw new ModerationSubmissionError(
        'Descreva as alterações efetuadas (mínimo 5 caracteres).',
        'CHANGES_NOTE_REQUIRED',
        422,
      );
    }

    const currentStatus = String(row.status);
    if (currentStatus !== 'changes_requested' && currentStatus !== 'rejected') {
      throw new ModerationSubmissionError(
        'Só é possível reenviar submissões com alterações pedidas ou recusadas.',
        'INVALID_STATUS_TRANSITION',
        409,
      );
    }

    const mergedPayload = {
      ...asObject(row.payload),
      ...(input.payload ?? {}),
      lastChangesNote: note,
    };
    const updated = await client.query(
      `UPDATE moderation_submissions
          SET status='resubmitted', title=$2, summary=$3, payload=$4::jsonb,
              version=version+1, decided_at=NULL, updated_at=NOW()
        WHERE id=$1
        RETURNING *`,
      [
        input.id,
        input.title?.trim() || String(row.title),
        input.summary ?? String(row.summary ?? ''),
        JSON.stringify(mergedPayload),
      ],
    );

    await insertHistory(client, {
      submissionId: input.id,
      action: 'resubmitted',
      fromStatus: currentStatus,
      toStatus: 'resubmitted',
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      notes: note,
    });

    const notification = notificationContent('resubmitted', String(row.title), note);
    await insertNotification(client, {
      userId: row.submitted_by ? String(row.submitted_by) : null,
      title: notification.title,
      message: notification.message,
      submissionId: input.id,
      status: 'resubmitted',
    });

    await client.query('COMMIT');
    return mapSubmission(updated.rows[0] as Row);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
