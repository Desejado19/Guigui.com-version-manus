import { createHash, randomUUID } from 'node:crypto';
import { databasePool } from './db';
import { loadJson, saveJson } from './runtimeStore';
import {
  QUALITATIVE_SCORE_WEIGHTS,
  REVIEW_REPEAT_WINDOW_MS,
  isReviewStatus,
  maskReviewPhone,
  normaliseReviewComment,
  normalizeReviewPhone,
  type ReviewStatus,
} from '../src/utils/reviews';
import type { QualitativeScore } from '../src/types';

/** Janela de 90 dias em que o mesmo telemóvel não pode repetir a avaliação. */
export const REVIEW_ANTIABUSE_WINDOW_MS = REVIEW_REPEAT_WINDOW_MS;
export const REVIEW_WINDOW_DAYS = Math.round(REVIEW_REPEAT_WINDOW_MS / 86_400_000);

export type ReviewRecord = {
  id: string;
  businessId: string;
  authorUserId?: string;
  authorName: string;
  /** Telemóvel mascarado — é o único valor exposto publicamente. */
  authorPhone: string;
  /** Hash SHA-256 do telemóvel normalizado, usado apenas para anti-abuso. */
  authorPhoneHash?: string;
  qualitativeScore: QualitativeScore;
  comment?: string;
  createdAt: string;
  verifiedSms: boolean;
  ownerReply?: string;
  status: ReviewStatus;
  flagReason?: string;
  moderationReason?: string;
};

/**
 * O telefone nunca é guardado em claro: as chaves públicas nunca recebem o número.
 * Guardamos apenas o hash (anti-abuso) e a versão mascarada para exibição.
 */
const hashPhone = (phone: string): string =>
  createHash('sha256').update(`guigui-review:${normalizeReviewPhone(phone)}`).digest('hex');

/** Bucket de 90 dias usado na chave primária da tabela `review_antiabuse`. */
const windowBucket = (now: number): string => String(Math.floor(now / REVIEW_REPEAT_WINDOW_MS));

const persisted = loadJson<ReviewRecord[]>('reviews.json', []);

const memoryReviews: ReviewRecord[] = persisted.map((review) => ({
  ...review,
  authorPhoneHash: review.authorPhoneHash || hashPhone(review.authorPhone),
  authorPhone: review.authorPhone || maskReviewPhone(review.authorPhone),
}));

const persistLocal = () => {
  saveJson(
    'reviews.json',
    memoryReviews.map((review) => ({
      ...review,
      authorPhone: maskReviewPhone(review.authorPhone),
    })),
  );
};

const mapRow = (row: any): ReviewRecord => ({
  id: row.id,
  businessId: row.business_id,
  authorUserId: row.author_user_id || undefined,
  authorName: row.author_name,
  authorPhone: row.author_phone_masked,
  authorPhoneHash: row.author_phone_hash,
  qualitativeScore: row.qualitative_score as QualitativeScore,
  comment: row.comment || undefined,
  createdAt: new Date(row.created_at).toISOString(),
  verifiedSms: Boolean(row.verified_sms),
  ownerReply: row.owner_reply || undefined,
  status: (isReviewStatus(row.status) ? row.status : 'pending') as ReviewStatus,
  flagReason: row.moderation_reason || undefined,
  moderationReason: row.moderation_reason || undefined,
});

export async function persistPostgresReview(review: ReviewRecord): Promise<void> {
  const phoneHash = review.authorPhoneHash || hashPhone(review.authorPhone);
  const masked = maskReviewPhone(review.authorPhone);
  review.authorPhoneHash = phoneHash;
  review.authorPhone = masked;
  if (databasePool) {
    await databasePool.query(
      `INSERT INTO reviews (id, business_id, author_user_id, author_name, author_phone_hash, author_phone_masked,
                            qualitative_score, score_weight, comment, status, moderation_reason, owner_reply,
                            verified_sms, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO UPDATE SET
         author_name = EXCLUDED.author_name,
         author_phone_hash = EXCLUDED.author_phone_hash,
         author_phone_masked = EXCLUDED.author_phone_masked,
         qualitative_score = EXCLUDED.qualitative_score,
         score_weight = EXCLUDED.score_weight,
         comment = EXCLUDED.comment,
         status = EXCLUDED.status,
         moderation_reason = EXCLUDED.moderation_reason,
         owner_reply = EXCLUDED.owner_reply,
         verified_sms = EXCLUDED.verified_sms,
         updated_at = NOW()`,
      [
        review.id,
        review.businessId,
        review.authorUserId || null,
        review.authorName,
        phoneHash,
        masked,
        review.qualitativeScore,
        QUALITATIVE_SCORE_WEIGHTS[review.qualitativeScore],
        review.comment || null,
        review.status,
        review.moderationReason || null,
        review.ownerReply || null,
        review.verifiedSms,
        review.createdAt,
      ],
    );
    return;
  }
  const existing = memoryReviews.findIndex((item) => item.id === review.id);
  if (existing >= 0) memoryReviews[existing] = { ...memoryReviews[existing], ...review };
  else memoryReviews.push(review);
  persistLocal();
}

export async function listPostgresReviews(businessId: string): Promise<ReviewRecord[]> {
  if (databasePool) {
    const result = await databasePool.query(
      `SELECT id, business_id, author_user_id, author_name, author_phone_hash, author_phone_masked,
              qualitative_score, comment, status, moderation_reason, owner_reply, verified_sms, created_at
         FROM reviews WHERE business_id = $1 ORDER BY created_at DESC`,
      [businessId],
    );
    return result.rows.map(mapRow);
  }
  return memoryReviews
    .filter((review) => review.businessId === businessId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type ReviewAllowedResult = { allowed: boolean; reason?: string };

/**
 * Anti-abuso (Secção 8): um telemóvel só pode avaliar cada negócio uma vez por janela
 * de 90 dias. A regra é imposta no servidor (fonte de verdade), nunca só no cliente.
 */
export async function isReviewAllowed(
  businessId: string,
  authorPhone: string,
  now: number = Date.now(),
): Promise<ReviewAllowedResult> {
  const phoneHash = hashPhone(authorPhone);
  const bucket = windowBucket(now);
  if (databasePool) {
    const result = await databasePool.query(
      `SELECT 1 FROM review_antiabuse
        WHERE business_id = $1 AND author_phone_hash = $2 AND window_bucket = $3
        LIMIT 1`,
      [businessId, phoneHash, bucket],
    );
    if (result.rowCount) return { allowed: false, reason: 'REVIEW_ALREADY_EXISTS' };
    await databasePool.query(
      `INSERT INTO review_antiabuse (business_id, author_phone_hash, window_bucket)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [businessId, phoneHash, bucket],
    );
    return { allowed: true };
  }
  const blocked = memoryReviews.some((review) => {
    if (review.businessId !== businessId) return false;
    if ((review.authorPhoneHash || hashPhone(review.authorPhone)) !== phoneHash) return false;
    const createdAt = review.createdAt ? new Date(review.createdAt).getTime() : 0;
    return now - createdAt < REVIEW_REPEAT_WINDOW_MS;
  });
  return blocked ? { allowed: false, reason: 'REVIEW_ALREADY_EXISTS' } : { allowed: true };
}

export type CreateReviewInput = {
  businessId: string;
  authorUserId?: string;
  authorName: string;
  authorPhone: string;
  qualitativeScore: QualitativeScore;
  comment?: string;
  verifiedSms?: boolean;
};

export async function createPostgresReview(input: CreateReviewInput): Promise<ReviewRecord> {
  const now = new Date().toISOString();
  const review: ReviewRecord = {
    id: `REV-${randomUUID()}`,
    businessId: input.businessId,
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    authorPhone: maskReviewPhone(input.authorPhone),
    authorPhoneHash: hashPhone(input.authorPhone),
    qualitativeScore: input.qualitativeScore,
    comment: input.comment || undefined,
    createdAt: now,
    verifiedSms: Boolean(input.verifiedSms),
    // O comentário escrito passa pela fila de moderação (Secção 9); o 4 níveis entra de imediato.
    status: input.comment ? 'pending' : 'approved',
  };
  if (databasePool) {
    await persistPostgresReview(review);
  } else {
    memoryReviews.push(review);
    persistLocal();
  }
  return { ...review, authorPhone: maskReviewPhone(review.authorPhone) };
}

export async function flagPostgresReview(reviewId: string, reason: string): Promise<ReviewRecord | null> {
  const cleanReason = normaliseReviewComment(reason);
  const target = memoryReviews.find((item) => item.id === reviewId);
  if (databasePool) {
    const result = await databasePool.query(
      `UPDATE reviews SET status = 'flagged', moderation_reason = $2, updated_at = NOW()
        WHERE id = $1 RETURNING business_id`,
      [reviewId, cleanReason],
    );
    if (!result.rowCount) return null;
    return (await listPostgresReviews(result.rows[0].business_id)).find((item) => item.id === reviewId) || null;
  }
  if (!target) return null;
  target.status = 'flagged';
  target.flagReason = cleanReason;
  target.moderationReason = cleanReason;
  persistLocal();
  return target;
}

export async function replyPostgresReview(reviewId: string, ownerReply: string): Promise<ReviewRecord | null> {
  const reply = String(ownerReply || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const target = memoryReviews.find((item) => item.id === reviewId);
  if (databasePool) {
    const result = await databasePool.query(
      `UPDATE reviews SET owner_reply = $2, updated_at = NOW() WHERE id = $1 RETURNING business_id`,
      [reviewId, reply],
    );
    if (!result.rowCount) return null;
    return (await listPostgresReviews(result.rows[0].business_id)).find((item) => item.id === reviewId) || null;
  }
  if (!target) return null;
  target.ownerReply = reply;
  persistLocal();
  return target;
}

/** Secção 9: decisão humana na fila de moderação (aprovar / rejeitar). */
export async function moderatePostgresReview(
  reviewId: string,
  status: ReviewStatus,
  reason?: string,
): Promise<ReviewRecord | null> {
  const target = memoryReviews.find((item) => item.id === reviewId);
  if (databasePool) {
    const result = await databasePool.query(
      `UPDATE reviews SET status = $2, moderation_reason = COALESCE($3, moderation_reason), updated_at = NOW()
        WHERE id = $1 RETURNING business_id`,
      [reviewId, status, reason || null],
    );
    if (!result.rowCount) return null;
    return (await listPostgresReviews(result.rows[0].business_id)).find((item) => item.id === reviewId) || null;
  }
  if (!target) return null;
  target.status = status;
  if (reason) target.moderationReason = reason;
  persistLocal();
  return target;
}
