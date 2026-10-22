/**
 * Autorização do ciclo de vida de um bilhete (Secção 7 / GUI-3.4.10 e 3.4.11).
 *
 * Regras (Regra 6 do Regulamento de Bilhética):
 * - Após a confirmação do pagamento, a compra é definitiva.
 * - O comprador NÃO pode cancelar voluntariamente nem solicitar reembolso por
 *   motivos pessoais (Regra 6.2 e 6.3).
 * - Cancelamento e reembolso de bilhete são descartados: apenas o cancelamento
 *   de evento pelo organizador (Regra 7) invalida bilhetes, através do
 *   procedimento administrativo da plataforma.
 */

export type TicketRole = 'user' | 'business' | 'admin';

export type TicketSubject = {
  id: string;
  status: string;
  businessId?: string;
  companyId?: string;
  buyerUserId?: string;
  holderPhone?: string;
  buyerPhone?: string;
};

export type TicketAccessDecision =
  | { allowed: true }
  | { allowed: false; status: number; code: string };

/**
 * Verifica se um bilhete pode ser validado na entrada do evento (Regra 10).
 * Apenas bilhetes com status 'valid' podem ser usados — pendentes (reserva
 * sem pagamento), utilizados, cancelados ou expirados são recusados.
 */
export function canValidateTicket(subject: TicketSubject): boolean {
  return subject.status === 'valid';
}

export function listOwnedTickets<T extends TicketSubject>(
  tickets: Iterable<T>,
  buyerUserId: string,
): T[] {
  const ownedTickets = new Map<string, T>();
  for (const ticket of tickets) {
    if (ticket.buyerUserId === buyerUserId && !ownedTickets.has(ticket.id)) {
      ownedTickets.set(ticket.id, ticket);
    }
  }
  return Array.from(ownedTickets.values());
}
