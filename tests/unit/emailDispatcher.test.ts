import { describe, expect, it } from 'vitest';
import {
  createEmailDispatcher,
  type EmailDispatchOutcome,
} from '../../server/email/dispatcher';
import { createInMemoryEmailDeliveryRepository } from '../../server/email/deliveryRepository';
import {
  EmailProviderError,
  type EmailProvider,
  type EmailProviderMessage,
  type EmailProviderReceipt,
  type OutgoingEmail,
} from '../../server/email/types';

const baseEmail: OutgoingEmail = {
  to: { email: 'ana@example.com', name: 'Ana' },
  kind: 'team_invitation',
  locale: 'pt',
  subject: 'Redefinir palavra-passe',
  html: '<p>Olá Ana</p>',
  text: 'Olá Ana',
};

function createFakeProvider(
  responses: Array<EmailProviderReceipt | Error>,
): EmailProvider & { calls: EmailProviderMessage[] } {
  const calls: EmailProviderMessage[] = [];
  let index = 0;
  return {
    name: 'smtp',
    mode: 'development',
    calls,
    async send(message) {
      calls.push(message);
      const next = responses[Math.min(index, responses.length - 1)];
      index += 1;
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

function setup(responses: Array<EmailProviderReceipt | Error>, maxAttempts = 3) {
  const provider = createFakeProvider(responses);
  const repository = createInMemoryEmailDeliveryRepository();
  const delays: number[] = [];
  const dispatcher = createEmailDispatcher({
    provider,
    repository,
    from: { email: 'no-reply@guigui.com', name: 'Guigui.com' },
    maxAttempts,
    retryBaseDelayMs: 100,
    delay: async (milliseconds) => {
      delays.push(milliseconds);
    },
    now: () => new Date('2026-01-02T10:00:00.000Z'),
    logger: { warn() {}, error() {} },
  });
  return { provider, repository, dispatcher, delays };
}

function receipt(id = '<msg-1@guigui>'): EmailProviderReceipt {
  return { providerMessageId: id, acceptedAt: new Date('2026-01-02T10:00:01.000Z') };
}

function retriableFailure(): EmailProviderError {
  return new EmailProviderError({
    code: 'brevo_rate_limited',
    message: 'A Brevo limitou temporariamente o envio de email.',
    retriable: true,
    outcome: 'failed',
  });
}

describe('email dispatcher', () => {
  it('records accepted (never delivered) when the provider accepts the message', async () => {
    const { provider, repository, dispatcher } = setup([receipt()]);

    const outcome = await dispatcher.dispatch(baseEmail);

    expect(outcome.state).toBe('accepted');
    expect(outcome.attempts).toBe(1);
    expect(outcome.providerMessageId).toBe('<msg-1@guigui>');
    expect(outcome.deduplicated).toBe(false);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].to.email).toBe('ana@example.com');
    expect(provider.calls[0].headers?.['X-Guigui-Email-Kind']).toBe('team_invitation');

    const stored = await repository.get(outcome.deliveryId);
    expect(stored?.status).toBe('accepted');
    expect(stored?.attempts).toBe(1);
    expect(stored?.acceptedAt).toBe('2026-01-02T10:00:01.000Z');
    expect(stored?.deliveredAt).toBeNull();
  });

  it('retries transient failures with exponential backoff and then succeeds', async () => {
    const { provider, dispatcher, delays } = setup([retriableFailure(), receipt('<msg-2@guigui>')]);

    const outcome = await dispatcher.dispatch(baseEmail);

    expect(outcome.state).toBe('accepted');
    expect(outcome.attempts).toBe(2);
    expect(provider.calls).toHaveLength(2);
    expect(delays).toEqual([100]);
  });

  it('fails after the maximum attempts when the failure keeps being retriable', async () => {
    const { provider, repository, dispatcher, delays } = setup([retriableFailure()]);

    const outcome = await dispatcher.dispatch(baseEmail);

    expect(outcome.state).toBe('failed');
    expect(outcome.attempts).toBe(3);
    expect(outcome.errorCode).toBe('brevo_rate_limited');
    expect(provider.calls).toHaveLength(3);
    expect(delays).toEqual([100, 200]);
    expect((await repository.get(outcome.deliveryId))?.status).toBe('failed');
  });

  it('does not retry a permanent recipient rejection', async () => {
    const { provider, dispatcher } = setup([
      new EmailProviderError({
        code: 'brevo_recipient_rejected',
        message: 'A Brevo recusou o destinatário da mensagem.',
        retriable: false,
        outcome: 'rejected',
      }),
    ]);

    const outcome = await dispatcher.dispatch(baseEmail);

    expect(outcome.state).toBe('rejected');
    expect(outcome.attempts).toBe(1);
    expect(provider.calls).toHaveLength(1);
  });

  it('sends only once when the same dedupeKey is dispatched twice', async () => {
    const { provider, dispatcher } = setup([receipt()]);
    const email = { ...baseEmail, dedupeKey: 'password-reset:usr-1:2026-01-02' };

    const first = await dispatcher.dispatch(email);
    const second = await dispatcher.dispatch(email);

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.deliveryId).toBe(first.deliveryId);
    expect(second.state).toBe('accepted');
    expect(provider.calls).toHaveLength(1);
  });

  it('rejects an invalid recipient without contacting the provider', async () => {
    const { provider, repository, dispatcher } = setup([receipt()]);

    const outcome = await dispatcher.dispatch({
      ...baseEmail,
      to: { email: 'ana at example.com' },
    });

    expect(outcome.state).toBe('rejected');
    expect(outcome.errorCode).toBe('recipient_invalid');
    expect(outcome.attempts).toBe(0);
    expect(provider.calls).toHaveLength(0);
    expect((await repository.get(outcome.deliveryId))?.status).toBe('rejected');
  });

  it('rejects invalid content before sending', async () => {
    const { provider, dispatcher } = setup([receipt()]);

    const outcome = await dispatcher.dispatch({ ...baseEmail, subject: '' });

    expect(outcome.state).toBe('rejected');
    expect(outcome.errorCode).toBe('subject_missing');
    expect(provider.calls).toHaveLength(0);
  });

  it('treats unexpected provider errors as transient and records a failure at the end', async () => {
    const { provider, dispatcher } = setup([new Error('socket hang up')]);

    const outcome: EmailDispatchOutcome = await dispatcher.dispatch(baseEmail);

    expect(outcome.state).toBe('failed');
    expect(outcome.attempts).toBe(3);
    expect(provider.calls).toHaveLength(3);
  });
});
