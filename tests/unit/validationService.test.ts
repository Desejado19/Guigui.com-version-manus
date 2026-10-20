import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  validateUserIdentity,
  validatePurchaseInput,
  validatePaymentInput,
  signTicket,
  hasValidTicketSignature,
  validateTicketForEntry,
  createAuditEntry,
  firstIssueMessage,
  type TicketForValidation,
  type ValidationIssue,
} from '../../server/validationService';

const codes = (issues: ValidationIssue[]) => issues.map((i) => i.code);

describe('normalizePhone', () => {
  it('accepts valid international-ish formats and trims them', () => {
    const result = normalizePhone('  +221 77 000 00 00 ');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('+221 77 000 00 00');
  });

  it('rejects non-string, empty and malformed numbers', () => {
    expect(codes(normalizePhone(12345).issues)).toContain('invalid_type');
    expect(codes(normalizePhone('   ').issues)).toContain('required');
    expect(codes(normalizePhone('abcdefgh').issues)).toContain('invalid_phone');
    expect(codes(normalizePhone('123').issues)).toContain('invalid_phone');
  });

  it('rejects numbers longer than the 24 character limit', () => {
    expect(codes(normalizePhone('+' + '9'.repeat(40)).issues)).toEqual(
      expect.arrayContaining(['too_long']),
    );
  });
});

describe('validateUserIdentity', () => {
  it('accepts a valid identity', () => {
    const result = validateUserIdentity({ name: 'Fatou', phone: '+221770000', role: 'citizen' });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ name: 'Fatou', phone: '+221770000', role: 'citizen' });
  });

  it('rejects an unknown role', () => {
    const result = validateUserIdentity({ name: 'Fatou', phone: '+221770000', role: 'hacker' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('invalid_role');
  });

  it('rejects a missing name', () => {
    const result = validateUserIdentity({ phone: '+221770000', role: 'admin' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('invalid_type');
  });

  it('rejects a blank name', () => {
    const result = validateUserIdentity({ name: '   ', phone: '+221770000', role: 'admin' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('required');
  });
});

describe('validatePurchaseInput', () => {
  const valid = {
    eventId: 'evt-1',
    eventTitle: 'Concerto',
    ticketTypeName: 'Geral',
    priceXOF: 5000,
    buyerName: 'Fatou',
    buyerPhone: '+221770000',
    paymentMethod: 'orange_money',
    // Regra 3.4-3.5: aceitação expressa da política de bilhética.
    policyAccepted: true,
    policyVersion: '1.0',
    policyAcceptedAt: '2026-10-19T00:00:00.000Z',
  };

  it('accepts a fully valid purchase', () => {
    const result = validatePurchaseInput(valid);
    expect(result.ok).toBe(true);
    expect(result.value?.priceXOF).toBe(5000);
    expect(result.value?.paymentMethod).toBe('orange_money');
  });

  it('requires holder name and phone to be provided together', () => {
    const result = validatePurchaseInput({ ...valid, holderName: 'Ali' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('holder_pair_required');
  });

  it('accepts holder details when both are supplied', () => {
    const result = validatePurchaseInput({ ...valid, holderName: 'Ali', holderPhone: '+221771111' });
    expect(result.ok).toBe(true);
    expect(result.value?.holderName).toBe('Ali');
    expect(result.value?.holderPhone).toBe('+221771111');
  });

  it('rejects invalid ticket amounts', () => {
    for (const priceXOF of [0, -10, 1.5, 100_000_001, 'abc', undefined]) {
      const result = validatePurchaseInput({ ...valid, priceXOF });
      expect(result.ok).toBe(false);
      expect(codes(result.issues)).toContain('invalid_amount');
    }
  });

  it('rejects unsupported payment methods', () => {
    const result = validatePurchaseInput({ ...valid, paymentMethod: 'bitcoin' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('invalid_payment_method');
  });

  it('rejects manual transfer as a new ticket purchase method', () => {
    const result = validatePurchaseInput({ ...valid, paymentMethod: 'manual_transfer' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('invalid_payment_method');
  });

  it('accepts a numeric string price via coercion', () => {
    const result = validatePurchaseInput({ ...valid, priceXOF: '7500' });
    expect(result.ok).toBe(true);
    expect(result.value?.priceXOF).toBe(7500);
  });

  it('rejects a purchase without policy acceptance (Regra 3.4-3.5)', () => {
    const withoutPolicy = { ...valid, policyAccepted: false };
    const result = validatePurchaseInput(withoutPolicy);
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('policy_not_accepted');
  });

  it('requires policy version and acceptance timestamp (Regra 3.5)', () => {
    const noVersion = validatePurchaseInput({ ...valid, policyVersion: '' });
    expect(noVersion.ok).toBe(false);
    expect(codes(noVersion.issues)).toContain('policy_version_missing');
    const noTimestamp = validatePurchaseInput({ ...valid, policyAcceptedAt: '' });
    expect(noTimestamp.ok).toBe(false);
    expect(codes(noTimestamp.issues)).toContain('policy_accepted_at_missing');
  });

  it('records policy acceptance in the normalized purchase', () => {
    const result = validatePurchaseInput(valid);
    expect(result.ok).toBe(true);
    expect(result.value?.policyAccepted).toBe(true);
    expect(result.value?.policyVersion).toBe('1.0');
    expect(result.value?.policyAcceptedAt).toBe('2026-10-19T00:00:00.000Z');
  });
});

describe('validatePaymentInput', () => {
  const valid = { payerName: 'Fatou', payerPhone: '+221770000', amountXOF: 3000, provider: 'telecel' };

  it('accepts a valid payment', () => {
    expect(validatePaymentInput(valid).ok).toBe(true);
  });

  it('rejects invalid amounts', () => {
    for (const amountXOF of [0, -1, 2.5, 100_000_001, 'oops']) {
      const result = validatePaymentInput({ ...valid, amountXOF });
      expect(result.ok).toBe(false);
      expect(codes(result.issues)).toContain('invalid_amount');
    }
  });

  it('rejects an unsupported provider', () => {
    const result = validatePaymentInput({ ...valid, provider: 'paypal' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('invalid_payment_method');
  });

  it('rejects manual transfer as a new payment provider', () => {
    const result = validatePaymentInput({ ...valid, provider: 'manual_transfer' });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('invalid_payment_method');
  });
});

describe('ticket signing and entry validation', () => {
  const secret = 'ticket-secret';
  const baseTicket: TicketForValidation = {
    id: 'tkt-1',
    ticketCode: 'ABC123',
    qrToken: 'qr-token-1',
    priceXOF: 5000,
    buyerName: 'Fatou',
    buyerPhone: '+221770000',
    status: 'valid',
  };

  it('verifies a ticket signed with the same secret', () => {
    const ticket = { ...baseTicket, signature: signTicket(baseTicket, secret) };
    expect(hasValidTicketSignature(ticket, secret)).toBe(true);
    expect(hasValidTicketSignature(ticket, 'wrong-secret')).toBe(false);
  });

  it('rejects an unsigned ticket in production', () => {
    const result = validateTicketForEntry(baseTicket, { production: true, signingSecret: secret });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toContain('unsigned_ticket');
  });

  it('rejects production validation without a signing secret', () => {
    const result = validateTicketForEntry(
      { ...baseTicket, signature: signTicket(baseTicket, secret) },
      { production: true },
    );
    expect(codes(result.issues)).toContain('missing_ticket_secret');
  });

  it('rejects a tampered signature', () => {
    const ticket = { ...baseTicket, signature: signTicket({ ...baseTicket, priceXOF: 1 }, secret) };
    const result = validateTicketForEntry(ticket, { production: false, signingSecret: secret });
    expect(codes(result.issues)).toContain('invalid_signature');
  });

  it('rejects expired, used and cancelled tickets', () => {
    expect(codes(validateTicketForEntry({ ...baseTicket, status: 'used' }, { production: false }).issues)).toContain('already_used');
    expect(codes(validateTicketForEntry({ ...baseTicket, status: 'cancelled' }, { production: false }).issues)).toContain('cancelled_ticket');
    expect(codes(validateTicketForEntry({ ...baseTicket, expiresAt: '2000-01-01T00:00:00Z' }, { production: false }).issues)).toContain('expired_ticket');
  });

  it('rejects a pending ticket without confirmed payment (Regra 11)', () => {
    expect(codes(validateTicketForEntry({ ...baseTicket, status: 'pending' }, { production: false }).issues)).toContain('pending_ticket');
  });

  it('accepts a valid ticket in non-production', () => {
    const result = validateTicketForEntry(baseTicket, { production: false });
    expect(result.ok).toBe(true);
  });
});

describe('audit helpers', () => {
  it('creates an audit entry with generated id and requestId', () => {
    const entry = createAuditEntry({ action: 'login', resource: 'session', success: true });
    expect(entry.id).toMatch(/^AUD-\d+-[0-9a-f]{8}$/);
    expect(entry.requestId).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();
  });

  it('honours a provided requestId', () => {
    const entry = createAuditEntry({ action: 'login', resource: 'session', success: true, requestId: 'req-1' });
    expect(entry.requestId).toBe('req-1');
  });

  it('returns the first issue message or the fallback', () => {
    expect(firstIssueMessage([{ code: 'x', message: 'first' }, { code: 'y', message: 'second' }], 'fb')).toBe('first');
    expect(firstIssueMessage([], 'fb')).toBe('fb');
  });
});
