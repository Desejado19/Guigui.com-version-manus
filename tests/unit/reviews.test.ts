import { describe, expect, it } from 'vitest';
import type { Review } from '../../src/types';
import {
  QUALITATIVE_SCORE_LABELS,
  QUALITATIVE_SCORE_WEIGHTS,
  QUALITATIVE_SCORES,
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_REPEAT_WINDOW_DAYS,
  calculateBusinessRating,
  canReviewAgain,
  getQualitativeScoreLabel,
  isQualitativeScore,
  maskReviewPhone,
  normalizeReviewPhone,
  translateRatingLabel,
  validateReviewInput,
} from '../../src/utils/reviews';

const buildReview = (overrides: Partial<Review> & { id: string }): Review => ({
  businessId: 'business-1',
  authorName: 'Cliente Teste',
  authorPhone: '+245 966 000 001',
  qualitativeScore: 'gostei',
  createdAt: '2026-01-01T00:00:00.000Z',
  verifiedSms: true,
  status: 'approved',
  ...overrides,
});

describe('Secção 8 — escala qualitativa de 4 níveis', () => {
  it('expõe exactamente os 4 níveis exigidos pelo escopo', () => {
    expect(QUALITATIVE_SCORES).toEqual(['nao_gostei', 'gostei', 'gostei_muito', 'muito_bom']);
  });

  it('atribui pesos internos de 1 a 4 sem nunca os expor como média pública', () => {
    expect(QUALITATIVE_SCORE_WEIGHTS).toEqual({ nao_gostei: 1, gostei: 2, gostei_muito: 3, muito_bom: 4 });
  });

  it('rejeita qualquer valor fora da escala de 4 níveis', () => {
    expect(isQualitativeScore('muito_bom')).toBe(true);
    expect(isQualitativeScore('otimo')).toBe(false);
    expect(isQualitativeScore(5)).toBe(false);
    expect(isQualitativeScore(null)).toBe(false);
  });

  it('apresenta o rótulo predominante sem estrelas nem média numérica', () => {
    const summary = calculateBusinessRating([
      buildReview({ id: 'r1', qualitativeScore: 'muito_bom' }),
      buildReview({ id: 'r2', qualitativeScore: 'muito_bom' }),
      buildReview({ id: 'r3', qualitativeScore: 'gostei' }),
    ]);

    // Média interna 3,33 => abaixo do limiar de 3,5, pelo que o rótulo é "Gostei Muito".
    expect(summary.ratingLabelKey).toBe('gostei_muito');
    expect(summary.ratingLabel).toBe(QUALITATIVE_SCORE_LABELS.gostei_muito.label);
    expect(summary.reviewsCount).toBe(3);
    expect(summary.breakdown).toEqual({ nao_gostei: 0, gostei: 1, gostei_muito: 0, muito_bom: 2 });
    expect(summary.ratingLabel).not.toMatch(/[0-9★☆*]/);
  });

  it('classifica como "Muito Bom" quando a média interna atinge 3,5', () => {
    const summary = calculateBusinessRating([
      buildReview({ id: 'r1', qualitativeScore: 'muito_bom' }),
      buildReview({ id: 'r2', qualitativeScore: 'muito_bom' }),
      buildReview({ id: 'r3', qualitativeScore: 'gostei_muito' }),
    ]);

    expect(summary.averageScore).toBeCloseTo(3.67, 2);
    expect(summary.ratingLabelKey).toBe('muito_bom');
  });

  it('ignora avaliações que ainda não foram aprovadas pela moderação', () => {
    const summary = calculateBusinessRating([
      buildReview({ id: 'r1', qualitativeScore: 'muito_bom' }),
      buildReview({ id: 'r2', qualitativeScore: 'nao_gostei', status: 'pending' }),
      buildReview({ id: 'r3', qualitativeScore: 'nao_gostei', status: 'flagged' }),
    ]);

    expect(summary.reviewsCount).toBe(1);
    expect(summary.ratingLabelKey).toBe('muito_bom');
  });

  it('devolve o estado vazio quando ainda não existem avaliações aprovadas', () => {
    const summary = calculateBusinessRating([]);
    expect(summary.reviewsCount).toBe(0);
    expect(summary.ratingLabelKey).toBeNull();
    expect(summary.breakdown).toEqual({ nao_gostei: 0, gostei: 0, gostei_muito: 0, muito_bom: 0 });
  });
});

describe('Secção 8 — tradução do rótulo para o idioma escolhido', () => {
  it('traduz o rótulo em todos os idiomas oficiais da plataforma', () => {
    expect(getQualitativeScoreLabel('pt', 'muito_bom')).toBe('Muito Bom');
    expect(getQualitativeScoreLabel('en', 'muito_bom')).toBe('Excellent');
    expect(getQualitativeScoreLabel('fr', 'nao_gostei')).toBe('Pas Aimé');
    expect(getQualitativeScoreLabel('es', 'gostei_muito')).toBe('Me Gustó Mucho');
  });

  it('traduz rótulos previamente guardados em português', () => {
    expect(translateRatingLabel('en', 'Muito Bom')).toBe('Excellent');
    expect(translateRatingLabel('en', 'muito_bom')).toBe('Excellent');
    expect(translateRatingLabel('en', 'Não Gostei')).toBe('Did Not Like');
  });
});


describe('Secção 8 — validação e anti-abuso das avaliações', () => {
  it('aceita um nível válido com telemóvel e comentário dentro do limite', () => {
    const result = validateReviewInput({ qualitativeScore: 'gostei_muito', comment: 'Otimo atendimento', authorPhone: '+245 966 123 456' });
    expect(result.ok === false ? result.code : 'ok').toBe('ok');
  });

  it('rejeita niveis fora da escala e comentarios acima de 200 caracteres', () => {
    const invalidScore = validateReviewInput({ qualitativeScore: 'excelente', authorPhone: '+245 966 123 456' });
    expect(invalidScore.ok === false ? invalidScore.code : '').toBe('REVIEW_SCORE_INVALID');

    const longComment = validateReviewInput({
      qualitativeScore: 'gostei',
      comment: 'a'.repeat(REVIEW_COMMENT_MAX_LENGTH + 1),
      authorPhone: '+245 966 123 456',
    });
    expect(longComment.ok === false ? longComment.code : '').toBe('REVIEW_COMMENT_TOO_LONG');
  });

  it('exige um telemovel valido para validar a avaliacao', () => {
    const result = validateReviewInput({ qualitativeScore: 'gostei', authorPhone: '123' });
    expect(result.ok === false ? result.code : '').toBe('REVIEW_PHONE_INVALID');
  });

  it('normaliza e mascara o telemovel do autor na exposicao publica', () => {
    expect(normalizeReviewPhone('+245 966 123 456')).toBe('966123456');
    const masked = maskReviewPhone('+245 966 123 456');
    expect(masked).toBe('+245 966 *** ** 56');
    expect(masked).not.toContain('123');
  });
});


describe('Secção 8 — limite de reavaliação por telemóvel', () => {
  it('bloqueia a reavaliacao do mesmo telemovel antes dos 90 dias', () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    const existing = [{ authorPhone: '+245 966 123 456', createdAt: '2026-05-01T00:00:00.000Z' }];

    expect(canReviewAgain(existing, '+245 966 123 456', 'business-1', now)).toBe(false);
    expect(REVIEW_REPEAT_WINDOW_DAYS).toBe(90);
  });

  it('permite reavaliar o mesmo telemovel depois da janela de 90 dias', () => {
    const now = Date.parse('2026-09-01T00:00:00.000Z');
    const existing = [{ authorPhone: '+245 966 123 456', createdAt: '2026-05-01T00:00:00.000Z' }];

    expect(canReviewAgain(existing, '+245 966 123 456', 'business-1', now)).toBe(true);
  });

  it('permite avaliar outro telemovel dentro da mesma janela', () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    const existing = [{ authorPhone: '+245 966 123 456', createdAt: '2026-05-30T00:00:00.000Z' }];

    expect(canReviewAgain(existing, '+245 977 654 321', 'business-1', now)).toBe(true);
  });
});

