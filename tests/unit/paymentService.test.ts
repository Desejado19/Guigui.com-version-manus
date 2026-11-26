import { describe, it, expect } from 'vitest';
import {
  createPaymentAdapters,
  signPaymentWebhook,
  type PaymentIntentInput,
} from '../../server/paymentService';

const baseInput: PaymentIntentInput = {
  transactionId: 'TX-1001',
  amountXOF: 5000,
  payerName: 'Awa Diop',
  payerPhone: '+221770000',
  description: 'Bilhete de evento',
  provider: 'orange_money',
};

describe('createPaymentAdapters - intent creation', () => {
  it('creates an auto-confirmed Orange Money simulation intent by default', async () => {
    const adapters = createPaymentAdapters({ webhookSecret: 'secret' });
    const result = await adapters.orange_money.createIntent(baseInput);

    expect(result.providerRef).toBe('OM-SIM-TX-1001');
    expect(result.state).toBe('confirmed');
    expect(result.mode).toBe('simulated');
    expect(adapters.orange_money.mode).toBe('simulated');
    expect(result.instructions).toContain('Orange Money');
    expect(result.instructions).toContain('simula');
  });

  it('creates a pending Telecel simulation intent when autoConfirmSandbox is disabled', async () => {
    const adapters = createPaymentAdapters({ webhookSecret: 'secret', autoConfirmSandbox: false });
    const result = await adapters.telecel.createIntent({ ...baseInput, provider: 'telecel' });

    expect(result.providerRef).toBe('TEL-SIM-TX-1001');
    expect(result.state).toBe('pending');
    expect(result.mode).toBe('simulated');
    expect(adapters.telecel.mode).toBe('simulated');
    expect(result.instructions).toContain('Telecel');
  });

  it('exposes only the supported simulated providers', () => {
    const adapters = createPaymentAdapters({ webhookSecret: 'secret' });
    expect(Object.keys(adapters).sort()).toEqual(['orange_money', 'telecel']);
    expect(Object.values(adapters).every((adapter) => adapter.mode === 'simulated')).toBe(true);
  });
});

describe('webhook signature verification', () => {
  const secret = 'webhook-secret';
  const payload = { providerRef: 'OM-SIM-TX-1001', status: 'paid', amountXOF: 5000 };

  it('accepts a signature produced by signPaymentWebhook', () => {
    const adapters = createPaymentAdapters({ webhookSecret: secret });
    const signature = signPaymentWebhook(payload, secret);
    expect(adapters.orange_money.verifyWebhook(payload, signature)).toBe(true);
  });

  it('accepts a raw hex signature without the sha256= prefix', () => {
    const adapters = createPaymentAdapters({ webhookSecret: secret });
    const signature = signPaymentWebhook(payload, secret).slice('sha256='.length);
    expect(adapters.orange_money.verifyWebhook(payload, signature)).toBe(true);
  });

  it('rejects a missing signature', () => {
    const adapters = createPaymentAdapters({ webhookSecret: secret });
    expect(adapters.orange_money.verifyWebhook(payload, undefined)).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const adapters = createPaymentAdapters({ webhookSecret: secret });
    const signature = signPaymentWebhook(payload, secret);
    const tampered = { ...payload, amountXOF: 999 };
    expect(adapters.orange_money.verifyWebhook(tampered, signature)).toBe(false);
  });

  it('rejects a signature computed with a different secret', () => {
    const adapters = createPaymentAdapters({ webhookSecret: secret });
    const signature = signPaymentWebhook(payload, 'another-secret');
    expect(adapters.orange_money.verifyWebhook(payload, signature)).toBe(false);
  });

  it('rejects a wrong-length signature without throwing', () => {
    const adapters = createPaymentAdapters({ webhookSecret: secret });
    expect(adapters.telecel.verifyWebhook(payload, 'sha256=deadbeef')).toBe(false);
  });
});

describe('webhook parsing', () => {
  const adapters = createPaymentAdapters({ webhookSecret: 'secret' });

  it('maps confirmation statuses to confirmed', () => {
    for (const status of ['paid', 'CONFIRMED', 'success', 'Succeeded']) {
      const event = adapters.orange_money.parseWebhook({ providerRef: 'OM-1', status });
      expect(event?.state).toBe('confirmed');
    }
  });

  it('maps failure statuses to failed', () => {
    for (const status of ['failed', 'cancelled', 'canceled', 'EXPIRED']) {
      const event = adapters.orange_money.parseWebhook({ providerRef: 'OM-1', status });
      expect(event?.state).toBe('failed');
    }
  });

  it('maps unknown statuses to pending', () => {
    const event = adapters.orange_money.parseWebhook({ providerRef: 'OM-1', status: 'processing' });
    expect(event?.state).toBe('pending');
    expect(event?.rawStatus).toBe('processing');
  });

  it('carries through optional amount and transactionId', () => {
    const event = adapters.telecel.parseWebhook({
      providerRef: 'TEL-1',
      status: 'paid',
      amountXOF: 2500,
      transactionId: 'TX-9',
    });
    expect(event).toEqual({ providerRef: 'TEL-1', state: 'confirmed', amountXOF: 2500, transactionId: 'TX-9', rawStatus: 'paid' });
  });

  it('returns null for malformed payloads', () => {
    expect(adapters.orange_money.parseWebhook(null)).toBeNull();
    expect(adapters.orange_money.parseWebhook('nope')).toBeNull();
    expect(adapters.orange_money.parseWebhook({ status: 'paid' })).toBeNull();
    expect(adapters.orange_money.parseWebhook({ providerRef: '   ' })).toBeNull();
  });
});

describe('signPaymentWebhook', () => {
  it('produces a deterministic sha256-prefixed signature', () => {
    const payload = { providerRef: 'OM-1', status: 'paid' };
    expect(signPaymentWebhook(payload, 'secret')).toBe(signPaymentWebhook(payload, 'secret'));
    expect(signPaymentWebhook(payload, 'secret')).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
});
