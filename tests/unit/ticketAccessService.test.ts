import { describe, expect, it } from 'vitest';
import { canValidateTicket, listOwnedTickets } from '../../server/ticketAccessService';

/**
 * Regra 6.3 do Regulamento de Bilhética: o sistema NÃO dispõe de
 * cancelamento nem reembolso de bilhete pelo comprador — a compra é
 * definitiva. Por isso este módulo só expõe a autorização de entrada
 * (Regra 10): apenas um bilhete no estado 'valid' autoriza a passagem.
 */
const validTicket = { id: 'TKT-1', status: 'valid', businessId: 'biz-1', buyerUserId: 'usr-1', buyerPhone: '+245 966 000 001' };

describe('validação de entrada de bilhete (Regra 10)', () => {
  it('autoriza a entrada de um bilhete válido', () => {
    expect(canValidateTicket(validTicket)).toBe(true);
  });

  it('recusa um bilhete pendente (reserva sem pagamento confirmado — Regra 11)', () => {
    expect(canValidateTicket({ ...validTicket, status: 'pending' })).toBe(false);
  });

  it('recusa um bilhete já utilizado (entrada única — Regra 10.5)', () => {
    expect(canValidateTicket({ ...validTicket, status: 'used' })).toBe(false);
  });

  it('recusa bilhetes cancelados ou expirados (Regra 10.6)', () => {
    expect(canValidateTicket({ ...validTicket, status: 'cancelled' })).toBe(false);
    expect(canValidateTicket({ ...validTicket, status: 'expired' })).toBe(false);
  });

  it('não reconhece estados desconhecidos como entrada autorizada', () => {
    expect(canValidateTicket({ ...validTicket, status: 'qualquer-coisa' })).toBe(false);
  });

  it('returns only the buyer tickets and deduplicates local map aliases', () => {
    const owned = { ...validTicket, buyerUserId: 'buyer-1' };
    const otherBuyer = { ...validTicket, id: 'TKT-2', buyerUserId: 'buyer-2' };

    expect(listOwnedTickets([owned, owned, otherBuyer], 'buyer-1')).toEqual([owned]);
  });
});
