import type { QualitativeScore, Review } from '../types';

export type ReviewSyncResult =
  | { kind: 'unauthorized' }
  | { kind: 'updated'; reviews: Review[] };

export type ReviewActionResult =
  | { ok: true; review: Review }
  | { ok: false; code: string; message: string };

type ReviewPayload = { review?: Review; reviews?: Review[]; error?: string; code?: string };

const readPayload = async (response: Response): Promise<ReviewPayload> =>
  (await response.json().catch(() => ({}))) as ReviewPayload;

const failure = (response: Response, payload: ReviewPayload, fallback: string): ReviewActionResult => ({
  ok: false,
  code: payload.code || `REVIEW_HTTP_${response.status}`,
  message: payload.error || fallback,
});

/**
 * Secção 8 — Carrega as avaliações públicas e reais de um negócio a partir do servidor.
 * O frontend nunca deve inventar avaliações: a fonte de verdade é a API.
 */
export async function syncBusinessReviews(businessId: string): Promise<ReviewSyncResult> {
  const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/reviews`);
  if (response.status === 401) return { kind: 'unauthorized' };
  if (!response.ok) throw new Error(`Não foi possível sincronizar as avaliações (${response.status}).`);
  const payload = await readPayload(response);
  return { kind: 'updated', reviews: payload.reviews || [] };
}

/** Secção 8 — Submete a avaliação qualitativa. O servidor valida os 4 níveis e o anti-abuso. */
export async function submitBusinessReview(
  businessId: string,
  input: { authorName: string; authorPhone: string; qualitativeScore: QualitativeScore; comment?: string; verifiedSms?: boolean },
): Promise<ReviewActionResult> {
  try {
    const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await readPayload(response);
    if (!response.ok || !payload.review) return failure(response, payload, 'Não foi possível submeter a avaliação.');
    return { ok: true, review: payload.review };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Sem ligação ao servidor. Verifique a rede e tente novamente.' };
  }
}

/** Secção 8 / 9 — Denúncia de uma avaliação para a fila de moderação da equipa Guigui. */
export async function flagBusinessReview(reviewId: string, reason: string): Promise<ReviewActionResult> {
  try {
    const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const payload = await readPayload(response);
    if (!response.ok || !payload.review) return failure(response, payload, 'Não foi possível denunciar a avaliação.');
    return { ok: true, review: payload.review };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Sem ligação ao servidor. A denúncia não foi registada.' };
  }
}

/** Secção 8 — Direito de resposta pública do proprietário do negócio. */
export async function replyBusinessReview(reviewId: string, ownerReply: string): Promise<ReviewActionResult> {
  try {
    const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerReply }),
    });
    const payload = await readPayload(response);
    if (!response.ok || !payload.review) return failure(response, payload, 'Não foi possível publicar a resposta.');
    return { ok: true, review: payload.review };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Sem ligação ao servidor. A resposta não foi guardada.' };
  }
}