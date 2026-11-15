import { describe, expect, it } from 'vitest';
import {
  isTicketArchived,
  TICKET_ACTIVE_WINDOW_DAYS,
  ticketArchiveMoment,
  ticketEventMoment,
} from '../../server/ticketRetention';

const DAY = 24 * 60 * 60 * 1000;

describe('retenção de bilhetes (7 dias após o evento)', () => {
  it('interpreta a data do evento como fim do dia quando não há hora', () => {
    const moment = ticketEventMoment({ eventDate: '2026-11-08' });
    expect(moment?.toISOString()).toBe('2026-11-08T23:59:59.000Z');
  });

  it('usa a hora do evento quando existe', () => {
    const moment = ticketEventMoment({ eventDate: '2026-11-08', eventTime: '21:30' });
    expect(moment?.toISOString()).toBe('2026-11-08T21:30:00.000Z');
  });

  it('mantém o bilhete ativo durante os 7 dias seguintes', () => {
    const event = { eventDate: '2026-11-01', eventTime: '20:00' };
    const archiveAt = ticketArchiveMoment(event);
    expect(archiveAt?.toISOString()).toBe('2026-11-08T20:00:00.000Z');
    expect(isTicketArchived(event, new Date(archiveAt!.getTime() - 1000))).toBe(false);
    expect(isTicketArchived(event, new Date(archiveAt!.getTime()))).toBe(true);
  });

  it('arquiva apenas depois da janela completa', () => {
    const event = { eventDate: '2026-11-01', eventTime: '20:00' };
    const justAfter = new Date(Date.parse('2026-11-08T20:00:01Z'));
    expect(isTicketArchived(event, justAfter)).toBe(true);
    expect(isTicketArchived(event, new Date(justAfter.getTime() - TICKET_ACTIVE_WINDOW_DAYS * DAY))).toBe(false);
  });

  it('nunca arquiva bilhetes de eventos sem data (evento adiado ou por marcar)', () => {
    expect(isTicketArchived({}, new Date('2030-01-01T00:00:00Z'))).toBe(false);
    expect(isTicketArchived({ eventDate: 'data-a-confirmar' }, new Date('2030-01-01T00:00:00Z'))).toBe(false);
    expect(ticketArchiveMoment({})).toBeNull();
  });

  it('trata a data efetiva atual do evento, não a data da compra', () => {
    // Evento adiado para dezembro: os bilhetes continuam ativos em novembro.
    const postponed = { eventDate: '2026-12-20', eventTime: '19:00' };
    expect(isTicketArchived(postponed, new Date('2026-11-10T00:00:00Z'))).toBe(false);
  });

  it('mantém ativo um bilhete comprado agora para um evento já realizado', () => {
    // Venda tardia: evento de outubro, compra em novembro. Antes da correção o
    // bilhete nascia arquivado e nunca aparecia em "Meus bilhetes".
    const ticket = {
      eventDate: '2026-10-02',
      eventTime: '23:00',
      purchasedAt: '2026-11-09T15:47:00.000Z',
    };
    expect(isTicketArchived(ticket, new Date('2026-11-09T16:00:00Z'))).toBe(false);
    expect(isTicketArchived(ticket, new Date('2026-11-16T15:00:00Z'))).toBe(false);
    expect(ticketArchiveMoment(ticket)?.toISOString()).toBe('2026-11-16T15:47:00.000Z');
    expect(isTicketArchived(ticket, new Date('2026-11-16T15:48:00Z'))).toBe(true);
  });

  it('continua a arquivar 7 dias depois do evento quando a compra é anterior', () => {
    const ticket = { eventDate: '2026-10-02', eventTime: '23:00', purchasedAt: '2026-09-01T10:00:00.000Z' };
    expect(ticketArchiveMoment(ticket)?.toISOString()).toBe('2026-10-09T23:00:00.000Z');
  });
});
