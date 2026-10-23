import { Language, QualitativeScore, Review } from '../types';
import { getTranslation } from './i18n';

export const QUALITATIVE_SCORE_WEIGHTS: Record<QualitativeScore, number> = {
  nao_gostei: 1,
  gostei: 2,
  gostei_muito: 3,
  muito_bom: 4,
};

/** Secção 8: escala pública tem exactamente 4 níveis qualitativos (nunca estrelas). */
export const QUALITATIVE_SCORES: readonly QualitativeScore[] = [
  'nao_gostei',
  'gostei',
  'gostei_muito',
  'muito_bom',
] as const;

export const REVIEW_COMMENT_MAX_LENGTH = 200;
/** Secção 8 do escopo: "com possibilidade de reavaliação a cada 90 dias". */
export const REVIEW_REPEAT_WINDOW_DAYS = 90;
export const REVIEW_REPEAT_WINDOW_MS = REVIEW_REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function isQualitativeScore(value: unknown): value is QualitativeScore {
  return typeof value === 'string' && (QUALITATIVE_SCORES as readonly string[]).includes(value);
}

/**
 * Rótulos qualitativos traduzidos. O texto público tem de seguir o idioma escolhido
 * pelo utilizador, pelo que o rótulo nunca pode ficar fixo em português.
 */
export function getQualitativeScoreLabel(lang: Language, score: QualitativeScore): string {
  return getTranslation(lang, isQualitativeScore(score) ? score : 'gostei');
}

export function getRatingLabelKey(score: QualitativeScore): string {
  if (score === 'nao_gostei') return 'nao_gostei';
  if (score === 'gostei_muito') return 'gostei_muito';
  if (score === 'muito_bom') return 'muito_bom';
  return 'gostei';
}

export const QUALITATIVE_SCORE_STYLES: Record<QualitativeScore, { color: string; badgeBg: string }> = {
  nao_gostei: {
    color: 'text-red-700 border-red-300 bg-red-50',
    badgeBg: 'bg-red-100 text-red-800 border-red-200',
  },
  gostei: {
    color: 'text-blue-700 border-blue-300 bg-blue-50',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  gostei_muito: {
    color: 'text-amber-800 border-amber-300 bg-amber-50',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  muito_bom: {
    color: 'text-emerald-800 border-emerald-300 bg-emerald-50',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
};

/** Compatibilidade: mantém `label` em português para quem não supply um idioma. */
export const QUALITATIVE_SCORE_LABELS: Record<QualitativeScore, { label: string; color: string; badgeBg: string }> = {
  nao_gostei: { label: 'Não Gostei', ...QUALITATIVE_SCORE_STYLES.nao_gostei },
  gostei: { label: 'Gostei', ...QUALITATIVE_SCORE_STYLES.gostei },
  gostei_muito: { label: 'Gostei Muito', ...QUALITATIVE_SCORE_STYLES.gostei_muito },
  muito_bom: { label: 'Muito Bom', ...QUALITATIVE_SCORE_STYLES.muito_bom },
};

export type BusinessRatingSummary = {
  ratingLabel: string;
  ratingLabelKey: QualitativeScore | null;
  reviewsCount: number;
  breakdown: Record<QualitativeScore, number>;
  averageScore: number;
};

const EMPTY_BREAKDOWN = (): Record<QualitativeScore, number> => ({
  nao_gostei: 0,
  gostei: 0,
  gostei_muito: 0,
  muito_bom: 0,
});

/**
 * Traduz o rótulo qualitativo predominante para o idioma escolhido pelo utilizador.
 * Aceita tanto o rótulo guardado (português) como a chave canónica.
 */
export function translateRatingLabel(lang: Language, labelOrKey?: string | null): string {
  if (!labelOrKey) return getTranslation(lang, 'noReviewsYet');
  const direct = QUALITATIVE_SCORES.find(
    (score) => score === labelOrKey || getTranslation('pt', score) === labelOrKey || QUALITATIVE_SCORE_LABELS[score].label === labelOrKey,
  );
  if (direct) return getQualitativeScoreLabel(lang, direct);
  return labelOrKey;
}

/**
 * Calculates the qualitative predominant rating label for a business.
 * Section 8 rule: No numeric averages or stars are ever shown publicly!
 */
export function calculateBusinessRating(reviews: Review[]): BusinessRatingSummary {
  const approvedReviews = reviews.filter((r) => r.status === 'approved');
  const count = approvedReviews.length;
  const breakdown = EMPTY_BREAKDOWN();

  if (count === 0) {
    return {
      ratingLabel: 'Sem avaliações',
      ratingLabelKey: null,
      reviewsCount: 0,
      breakdown,
      averageScore: 0,
    };
  }

  let totalPoints = 0;
  approvedReviews.forEach((r) => {
    const w = QUALITATIVE_SCORE_WEIGHTS[r.qualitativeScore] || 3;
    totalPoints += w;
    breakdown[r.qualitativeScore] = (breakdown[r.qualitativeScore] || 0) + 1;
  });

  const avg = totalPoints / count;

  let ratingLabelKey: QualitativeScore;
  if (avg >= 3.5) {
    ratingLabelKey = 'muito_bom';
  } else if (avg >= 2.5) {
    ratingLabelKey = 'gostei_muito';
  } else if (avg >= 1.5) {
    ratingLabelKey = 'gostei';
  } else {
    ratingLabelKey = 'nao_gostei';
  }

  return {
    ratingLabel: QUALITATIVE_SCORE_LABELS[ratingLabelKey].label,
    ratingLabelKey,
    reviewsCount: count,
    breakdown,
    averageScore: avg,
  };
}

/** Número canónico de um telemóvel, usado para o limite anti-abuso por número. */
export function normalizeReviewPhone(phone: unknown): string {
  return String(phone || '').replace(/\D/g, '').slice(-9);
}

/**
 * Oculta o telemóvel do autor na exposição pública (Secção 8 / protecção de dados).
 * Ex.: '+245 966 *** ** 12'
 */
export function maskReviewPhone(phone: unknown): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '***';
  // O indicativo do país é removido para que a parte visível seja sempre o número nacional
  // (evita mostrar "+245 245" e não filtra um dígito do número do assinante).
  const national = digits.length > 9 && digits.startsWith('245') ? digits.slice(3) : digits;
  const head = national.slice(0, 3);
  const tail = national.slice(-2);
  return `+245 ${head} *** ** ${tail}`;
}

export type ReviewInputValidation =
  | { ok: true; score: QualitativeScore; comment: string; phone: string }
  | { ok: false; code: string; message: string };

/**
 * Validação partilhada entre o frontend e o backend: garante os 4 níveis qualitativos,
 * o limite de 200 caracteres do comentário e a presença de um telemóvel válido.
 */
export function validateReviewInput(input: {
  qualitativeScore?: unknown;
  comment?: unknown;
  authorPhone?: unknown;
}): ReviewInputValidation {
  if (!isQualitativeScore(input.qualitativeScore)) {
    return { ok: false, code: 'REVIEW_SCORE_INVALID', message: 'Escolha um dos 4 níveis qualitativos.' };
  }
  const score = input.qualitativeScore;
  const rawComment = input.comment === undefined || input.comment === null ? '' : String(input.comment);
  if (rawComment.length > REVIEW_COMMENT_MAX_LENGTH) {
    return { ok: false, code: 'REVIEW_COMMENT_TOO_LONG', message: `O comentário não pode exceder ${REVIEW_COMMENT_MAX_LENGTH} caracteres.` };
  }
  const phoneDigits = normalizeReviewPhone(input.authorPhone);
  if (phoneDigits.length < 7) {
    return { ok: false, code: 'REVIEW_PHONE_INVALID', message: 'Indique um telemóvel válido para validar a avaliação.' };
  }
  return { ok: true, score, comment: rawComment.trim(), phone: phoneDigits };
}

/**
 * Anti-abuso (Secção 8): um telemóvel só pode avaliar cada negócio uma vez dentro da janela.
 */
export function canReviewAgain(
  existing: Array<{ authorPhone?: string; createdAt?: string }>,
  authorPhone: string,
  businessId: string,
  now: number = Date.now(),
): boolean {
  const phone = normalizeReviewPhone(authorPhone);
  return !existing.some((review) => {
    if (normalizeReviewPhone(review.authorPhone) !== phone) return false;
    const createdAt = review.createdAt ? new Date(review.createdAt).getTime() : 0;
    return now - createdAt < REVIEW_REPEAT_WINDOW_MS;
  });
}

export function normaliseReviewComment(comment: unknown): string {
  return String(comment || '').replace(/\s+/g, ' ').trim().slice(0, REVIEW_COMMENT_MAX_LENGTH);
}

export const REVIEW_STATUSES = ['approved', 'pending', 'flagged'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === 'string' && (REVIEW_STATUSES as readonly string[]).includes(value);
}
