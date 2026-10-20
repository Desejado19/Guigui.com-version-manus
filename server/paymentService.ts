import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentIntentState,
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentWebhookEvent,
} from './integrations/ports';

export type {
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentIntentState,
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentWebhookEvent,
} from './integrations/ports';

function canonicalPayload(payload: unknown): string {
  return JSON.stringify(payload);
}

function safeSignatureEquals(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function webhookVerifier(secret: string, payload: unknown, signature: string | undefined): boolean {
  if (!signature) return false;
  const normalizedSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expected = createHmac('sha256', secret).update(canonicalPayload(payload)).digest('hex');
  return safeSignatureEquals(expected, normalizedSignature);
}

function webhookParser(payload: unknown): PaymentWebhookEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const providerRef = typeof value.providerRef === 'string' ? value.providerRef.trim() : '';
  const rawStatus = typeof value.status === 'string' ? value.status.toLowerCase() : '';
  if (!providerRef) return null;
  const state: PaymentIntentState = ['paid', 'confirmed', 'success', 'succeeded'].includes(rawStatus)
    ? 'confirmed'
    : ['failed', 'cancelled', 'canceled', 'expired'].includes(rawStatus)
      ? 'failed'
      : 'pending';
  const amountXOF = typeof value.amountXOF === 'number' ? value.amountXOF : undefined;
  const transactionId = typeof value.transactionId === 'string' ? value.transactionId : undefined;
  return { providerRef, state, amountXOF, transactionId, rawStatus };
}

function simulatedAdapter(provider: PaymentProvider, secret: string, autoConfirm: boolean): PaymentProviderAdapter {
  return {
    provider,
    mode: 'simulated',
    async createIntent(input) {
      const prefix = provider === 'orange_money' ? 'OM-SIM' : 'TEL-SIM';
      const providerRef = `${prefix}-${input.transactionId}`;
      return {
        providerRef,
        state: autoConfirm ? 'confirmed' : 'pending',
        mode: 'simulated',
        instructions: autoConfirm
          ? `Pagamento simulado por ${provider === 'orange_money' ? 'Orange Money' : 'Telecel'}; nenhuma operadora foi contactada.`
          : `Simulação de pagamento pendente para ${provider === 'orange_money' ? 'Orange Money' : 'Telecel'}; nenhuma operadora foi contactada.`,
      };
    },
    verifyWebhook(payload, signature) {
      return webhookVerifier(secret, payload, signature);
    },
    parseWebhook: webhookParser,
  };
}

export function createPaymentAdapters(options?: { webhookSecret?: string; autoConfirmSandbox?: boolean }): Record<PaymentProvider, PaymentProviderAdapter> {
  const secret = options?.webhookSecret || 'guigui-payment-webhook-development-secret';
  const autoConfirmSandbox = options?.autoConfirmSandbox ?? true;
  return {
    orange_money: simulatedAdapter('orange_money', secret, autoConfirmSandbox),
    telecel: simulatedAdapter('telecel', secret, autoConfirmSandbox),
  };
}

export function signPaymentWebhook(payload: unknown, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(canonicalPayload(payload)).digest('hex')}`;
}
