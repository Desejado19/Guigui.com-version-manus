/**
 * Política de retenção dos bilhetes na listagem ativa.
 *
 * Um bilhete deixa de aparecer na lista principal 7 dias depois da data de
 * realização do evento ou da data da compra, o que for mais recente — assim um
 * bilhete comprado hoje aparece sempre em "Meus bilhetes", mesmo que o evento
 * já tenha acontecido. Nada é apagado: a compra, o pagamento, o QR Code e o
 * registo de auditoria continuam na base de dados e acessíveis nas áreas
 * históricas (`archivedOnly`).
 *
 * Nada aqui altera estados nem remove linhas — é apenas um critério de leitura.
 */

export const TICKET_ACTIVE_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TicketEventLike {
  eventDate?: string;
  eventTime?: string;
  /** Data da compra: um bilhete acabado de comprar nunca é arquivado de imediato. */
  purchasedAt?: string;
}

/**
 * Instante de realização do evento.
 *
 * Bissau não tem horário de verão e está em UTC±0, por isso a data/hora do
 * evento é interpretada como UTC: uma data de calendário sem hora conta como o
 * fim desse dia, para que o evento nunca seja arquivado antes de terminar.
 */
export function ticketEventMoment(ticket: TicketEventLike): Date | null {
  if (!ticket.eventDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ticket.eventDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const time = /(\d{1,2}):(\d{2})/.exec(ticket.eventTime || '');
  const hours = time ? Math.min(23, Number(time[1])) : 23;
  const minutes = time ? Math.min(59, Number(time[2])) : 59;

  const moment = Date.UTC(year, month - 1, day, hours, minutes, time ? 0 : 59);
  return Number.isNaN(moment) ? null : new Date(moment);
}

/**
 * Instante a partir do qual o bilhete sai da listagem ativa.
 *
 * Conta a referência mais recente entre o fim do evento e a compra. Sem isto,
 * comprar hoje um bilhete para um evento já realizado (venda tardia, data
 * corrigida, evento de teste no passado) colocava o bilhete directamente em
 * "Arquivados" e o comprador não o via em "Meus bilhetes" logo após pagar.
 */
export function ticketArchiveMoment(ticket: TicketEventLike): Date | null {
  const eventMoment = ticketEventMoment(ticket);
  // Evento sem data (adiado/por marcar): nunca arquivar por tempo.
  if (!eventMoment) return null;
  const purchasedMoment = ticket.purchasedAt ? new Date(ticket.purchasedAt) : null;
  const purchasedTime = purchasedMoment && !Number.isNaN(purchasedMoment.getTime())
    ? purchasedMoment.getTime()
    : 0;
  const reference = Math.max(eventMoment.getTime(), purchasedTime);
  return new Date(reference + TICKET_ACTIVE_WINDOW_DAYS * DAY_MS);
}

/**
 * `true` quando o bilhete já deve estar fora da listagem ativa.
 * Eventos sem data (ou com data ilegível) nunca são arquivados: adiar um evento
 * não pode fazer desaparecer os bilhetes que as pessoas compraram.
 */
export function isTicketArchived(ticket: TicketEventLike, now: Date = new Date()): boolean {
  const archiveAt = ticketArchiveMoment(ticket);
  if (!archiveAt) return false;
  return now.getTime() >= archiveAt.getTime();
}

/** Data-limite: eventos realizados depois deste instante continuam ativos. */
export function ticketRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TICKET_ACTIVE_WINDOW_DAYS * DAY_MS);
}
