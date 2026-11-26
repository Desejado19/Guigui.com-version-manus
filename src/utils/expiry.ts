import type { EventItem, Promotion } from '../types';

/**
 * Regras unicas de expiracao para eventos e descontos.
 *
 * Um evento ou promocao que ja passou deixa de ser apresentado ao publico
 * automaticamente, sem depender de alguem o desactivar a mao. Os registos
 * mantem-se no estado para relatorios, bilhetes vendidos e auditoria.
 */

/** Uma promocao expira quando a data de validade chega ao fim. */
export function isPromotionExpired(promotion: Promotion, now: Date = new Date()): boolean {
  if (promotion.status === 'expired') return true;
  const validUntil = Date.parse(promotion.validUntil);
  if (Number.isNaN(validUntil)) return false;
  return validUntil <= now.getTime();
}

/** Promocao visivel publicamente: activa e ainda dentro da validade. */
export function isPromotionLive(promotion: Promotion, now: Date = new Date()): boolean {
  if (!promotion.isActive) return false;
  if (promotion.status && ['expired', 'cancelled', 'failed'].includes(promotion.status)) return false;
  if (promotion.startsAt) {
    const startsAt = Date.parse(promotion.startsAt);
    if (!Number.isNaN(startsAt) && startsAt > now.getTime()) return false;
  }
  return !isPromotionExpired(promotion, now);
}

/** Momento em que o evento termina (data + hora; sem hora assume o fim do dia). */
export function getEventEndsAt(event: Pick<EventItem, 'date' | 'time'>): Date | null {
  if (!event.date) return null;
  const time = event.time && /^\d{1,2}:\d{2}/.test(event.time) ? event.time : '23:59';
  const endsAt = new Date(`${event.date}T${time}`);
  return Number.isNaN(endsAt.getTime()) ? null : endsAt;
}

/**
 * Um evento termina quando a data e hora marcadas passam.
 * Datas invalidas nunca sao tratadas como passadas, para nao esconder conteudo
 * por causa de um erro de formato.
 */
export function isEventPast(event: EventItem, now: Date = new Date()): boolean {
  if (event.status === 'ended') return true;
  const endsAt = getEventEndsAt(event);
  if (!endsAt) return false;
  return endsAt.getTime() < now.getTime();
}

/** Evento publico: activo e ainda nao terminou. */
export function isEventUpcoming(event: EventItem, now: Date = new Date()): boolean {
  return event.status === 'active' && !isEventPast(event, now);
}

export function filterLivePromotions(promotions: readonly Promotion[], now: Date = new Date()): Promotion[] {
  return promotions.filter((promotion) => isPromotionLive(promotion, now));
}

export function filterUpcomingEvents(events: readonly EventItem[], now: Date = new Date()): EventItem[] {
  return events.filter((event) => isEventUpcoming(event, now));
}
