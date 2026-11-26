import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const sessionCookie = process.env.TEST_SESSION_COOKIE?.trim();
const idempotencyKey = `audit-multi-${Date.now()}`;

// Esta auditoria é de integração: precisa do servidor a responder em `base`.
// Sem esta verificação o erro devolvido é um `fetch failed` (ECONNREFUSED) sem contexto.
async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${base}${path}`, init);
  } catch (error) {
    throw new Error(
      `ticket-flow-audit: ${base}${path} não respondeu. Inicie o servidor (npm run dev) antes desta auditoria ou defina TEST_BASE_URL com o endereço correto. Causa original: ${(error as Error).message}`,
    );
  }
}

if (!sessionCookie) {
  throw new Error('ticket-flow-audit: defina TEST_SESSION_COOKIE com o cookie da sessão autenticada de comprador.');
}

const eventResponse = await request('/api/events');
assert.equal(eventResponse.status, 200);
const eventsPayload = await eventResponse.json();
const event = eventsPayload.events.find((candidate: any) =>
  (!process.env.TEST_EVENT_ID || candidate.id === process.env.TEST_EVENT_ID)
  && (candidate.status === 'active' || candidate.status === 'published')
  && Array.isArray(candidate.ticketTypes)
  && candidate.ticketTypes.some((ticketType: any) => ticketType.availableQuantity - ticketType.soldQuantity >= 2),
);
if (!event) throw new Error('ticket-flow-audit: não foi encontrado um evento publicado com dois bilhetes disponíveis.');
const ticketType = event.ticketTypes.find((candidate: any) =>
  candidate.availableQuantity - candidate.soldQuantity >= 2,
);

const purchaseBody = {
  eventId: event.id,
  ticketTypeId: ticketType.id,
  businessId: event.businessId,
  eventTitle: event.title,
  eventDate: event.date,
  eventTime: event.time,
  ticketTypeName: ticketType.name,
  priceXOF: ticketType.priceXOF,
  pricePerTicketXOF: ticketType.priceXOF,
  quantity: 2,
  buyerName: 'Identidade derivada da sessão',
  buyerPhone: '+245 955 000 111',
  holderName: 'Titular Auditoria',
  holderPhone: '+245 966 000 222',
  paymentMethod: 'orange_money',
  policyAccepted: true,
  policyVersion: '1.0',
  policyAcceptedAt: new Date().toISOString(),
};

const purchase = await request('/api/tickets/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, Cookie: sessionCookie },
  body: JSON.stringify(purchaseBody),
});
const first = await purchase.json();
assert.equal(purchase.status, 200);
assert.equal(first.success, true);
assert.equal(first.tickets.length, 2);
assert.equal(first.transaction.ticketIds.length, 2);
assert.equal(first.tickets[0].holderName, 'Titular Auditoria');
assert.notEqual(first.tickets[0].ticketCode, first.tickets[1].ticketCode);
assert.notEqual(first.tickets[0].pinCode, first.tickets[1].pinCode);
assert.notEqual(first.tickets[0].qrToken, first.tickets[1].qrToken);

const repeat = await request('/api/tickets/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, Cookie: sessionCookie },
  body: JSON.stringify(purchaseBody),
});
const second = await repeat.json();
assert.equal(repeat.status, 200);
assert.deepEqual(second.transaction.ticketIds, first.transaction.ticketIds);
assert.deepEqual(second.tickets.map((ticket: any) => ticket.ticketCode), first.tickets.map((ticket: any) => ticket.ticketCode));

for (const ticket of first.tickets) {
  const lookup = await request('/api/tickets/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+245 966 000 222', code: ticket.ticketCode }) });
  const found = await lookup.json();
  assert.equal(lookup.status, 200);
  assert.equal(found.ticket.ticketCode, ticket.ticketCode);
}

const invalid = await request('/api/tickets/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sessionCookie }, body: JSON.stringify({ ...purchaseBody, holderName: 'Sem telefone', holderPhone: undefined, quantity: 1 }) });
assert.equal(invalid.status, 400);

console.log(`ticket-flow-audit: ok — ${first.tickets.length} tickets individuais, idempotência, holder lookup e validação de par`);
