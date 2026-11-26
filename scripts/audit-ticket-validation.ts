import assert from 'node:assert/strict';
import { validatePurchaseInput, validateTicketForEntry, type TicketForValidation } from '../server/validationService';

const base: TicketForValidation = {
  id: 'audit-ticket',
  ticketCode: 'GUI-AUDIT',
  qrToken: 'QR-AUDIT',
  buyerName: 'Teste',
  buyerPhone: '+245 955 123 456',
  priceXOF: 5000,
  status: 'valid',
};

const expired = validateTicketForEntry({ ...base, expiresAt: '2020-01-01T00:00:00.000Z' }, { production: false });
assert.equal(expired.ok, false);
assert.ok(expired.issues.some((item) => item.code === 'expired_ticket'));

const malformedDate = validateTicketForEntry({ ...base, expiresAt: 'data-invalida' }, { production: false });
assert.equal(malformedDate.ok, false);
assert.ok(malformedDate.issues.some((item) => item.code === 'expired_ticket'));

const explicitExpired = validateTicketForEntry({ ...base, status: 'expired' }, { production: false });
assert.equal(explicitExpired.ok, false);

const used = validateTicketForEntry({ ...base, status: 'used', validatedAt: new Date().toISOString() }, { production: false });
assert.equal(used.ok, false);
assert.ok(used.issues.some((item) => item.code === 'already_used'));

const holderPurchase = validatePurchaseInput({ eventId: 'evt-1', ticketTypeId: 'ticket-type-1', quantity: 1, businessId: 'biz-1', eventTitle: 'Evento Teste', ticketTypeName: 'VIP', priceXOF: 5000, buyerName: 'Comprador', buyerPhone: '+245 955 123 456', holderName: 'Titular', holderPhone: '+245 966 654 321', paymentMethod: 'orange_money', policyAccepted: true, policyVersion: '1.0', policyAcceptedAt: '2026-01-01T00:00:00.000Z' });
assert.equal(holderPurchase.ok, true);
assert.equal(holderPurchase.value?.holderName, 'Titular');
assert.equal(holderPurchase.value?.holderPhone, '+245 966 654 321');
const incompleteHolder = validatePurchaseInput({ eventId: 'evt-1', ticketTypeId: 'ticket-type-1', quantity: 1, eventTitle: 'Evento Teste', ticketTypeName: 'VIP', priceXOF: 5000, buyerName: 'Comprador', buyerPhone: '+245 955 123 456', holderName: 'Titular', paymentMethod: 'orange_money', policyAccepted: true, policyVersion: '1.0', policyAcceptedAt: '2026-01-01T00:00:00.000Z' });
assert.equal(incompleteHolder.ok, false);
assert.ok(incompleteHolder.issues.some((item) => item.code === 'holder_pair_required'));

console.log('ticket-validation-audit: ok — validade, estados e titular validado');
