import assert from 'node:assert/strict';
import { createPaymentAdapters, signPaymentWebhook } from '../server/paymentService';

const secret = 'audit-secret';
const adapters = createPaymentAdapters({ webhookSecret: secret, autoConfirmSandbox: true });
const baseInput = {
  transactionId: 'TXN-AUDIT-001',
  amountXOF: 5000,
  payerName: 'Teste Pagamento',
  payerPhone: '+245 955 12 34 56',
  description: 'Bilhete de auditoria',
};

const orangeIntent = await adapters.orange_money.createIntent({ ...baseInput, provider: 'orange_money' });
assert.equal(orangeIntent.state, 'confirmed');
assert.equal(orangeIntent.mode, 'simulated');
assert.ok(orangeIntent.providerRef.startsWith('OM-SIM-'));
assert.deepEqual(Object.keys(adapters).sort(), ['orange_money', 'telecel']);

const webhook = { providerRef: orangeIntent.providerRef, status: 'paid', amountXOF: 5000 };
const validSignature = signPaymentWebhook(webhook, secret);
assert.equal(adapters.orange_money.verifyWebhook(webhook, validSignature), true);
assert.equal(adapters.orange_money.verifyWebhook(webhook, 'sha256=invalid'), false);
assert.equal(adapters.orange_money.parseWebhook(webhook)?.state, 'confirmed');
assert.equal(adapters.orange_money.parseWebhook({ providerRef: 'OM-1', status: 'failed' })?.state, 'failed');
assert.equal(adapters.orange_money.parseWebhook({ providerRef: 'OM-1', status: 'pending' })?.state, 'pending');

console.log('payment-flow-audit: ok — pagamentos simulados, assinatura e estados de webhook validados');
