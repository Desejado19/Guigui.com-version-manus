import { describe, expect, it } from 'vitest';
import { EmailConfigurationError, type EmailDispatchOutcome, type EmailDispatcher, type OutgoingEmail } from '../../server/email';
import {
  createExternalEmailSender,
  EXTERNAL_EMAIL_MAX_MESSAGE,
  EXTERNAL_EMAIL_MAX_SUBJECT,
  ExternalEmailValidationError,
  renderExternalEmail,
} from '../../server/email/outboundService';

const sender = {
  userId: 'usr-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
};

const input = {
  sender,
  to: 'parceiro@fora.example',
  subject: 'Proposta de parceria',
  message: 'Olá,\n\nGostaria de falar sobre a parceria.\n\nObrigada.',
};

function fakeDispatcher(overrides: Partial<EmailDispatchOutcome> = {}) {
  const dispatched: OutgoingEmail[] = [];
  const dispatcher: EmailDispatcher = {
    async dispatch(email) {
      dispatched.push(email);
      return {
        deliveryId: 'email-external-1',
        state: 'accepted',
        attempts: 1,
        providerMessageId: '<msg@guigui>',
        errorCode: null,
        errorMessage: null,
        deduplicated: false,
        ...overrides,
      };
    },
  };
  return { dispatcher, dispatched };
}

function createSender(dispatcher: EmailDispatcher) {
  return createExternalEmailSender({ compose: () => ({ dispatcher }) });
}

async function expectValidationError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ExternalEmailValidationError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('external email rendering', () => {
  it('renders the user message, escapes markup and identifies the sender', () => {
    const rendered = renderExternalEmail({
      sender,
      subject: 'Parceria <b>2026</b>',
      message: 'Primeira linha <script>alert(1)</script>\n\nSegundo parágrafo.',
      appUrl: 'https://guigui.com',
    });

    expect(rendered.subject).toBe('Parceria <b>2026</b>');
    expect(rendered.html).toContain('&lt;b&gt;2026&lt;/b&gt;');
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('Primeira linha');
    expect(rendered.html).toContain('Segundo parágrafo.');
    expect(rendered.html).toContain('Ana Silva');
    expect(rendered.text).toContain('— Ana Silva');
    expect(rendered.text).toContain('Responda a este email');
  });
});

describe('createExternalEmailSender', () => {
  it('sends from the platform with Reply-To the user and no simulation', async () => {
    const { dispatcher, dispatched } = fakeDispatcher();

    const outcome = await createSender(dispatcher).send({ ...input, requestId: 'req-1' });

    expect(outcome.state).toBe('accepted');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      kind: 'external_message',
      to: { email: 'parceiro@fora.example' },
      replyTo: { email: 'ana@example.com', name: 'Ana Silva' },
      relatedUserId: 'usr-1',
      dedupeKey: 'external:usr-1:req-1',
    });
    expect(dispatched[0].subject).toBe('Proposta de parceria');
    expect(dispatched[0].attachments).toBeUndefined();
  });

  it('omits the dedupe key when the client does not send an idempotency key', async () => {
    const { dispatcher, dispatched } = fakeDispatcher();
    await createSender(dispatcher).send(input);
    expect(dispatched[0].dedupeKey).toBeUndefined();
  });

  it('refuses to send without a configured provider instead of pretending success', async () => {
    await expect(createExternalEmailSender({ env: {} }).send(input)).rejects.toBeInstanceOf(
      EmailConfigurationError,
    );
  });

  it('composes the provider once and reuses it across messages', async () => {
    const { dispatcher, dispatched } = fakeDispatcher();
    let compositions = 0;
    const senderPort = createExternalEmailSender({
      compose: () => {
        compositions += 1;
        return { dispatcher };
      },
    });

    await senderPort.send(input);
    await senderPort.send({ ...input, to: 'outro@fora.example' });

    expect(compositions).toBe(1);
    expect(dispatched).toHaveLength(2);
  });

  it('retries the composition after a configuration failure instead of caching it', async () => {
    const { dispatcher, dispatched } = fakeDispatcher();
    let compositions = 0;
    const senderPort = createExternalEmailSender({
      compose: () => {
        compositions += 1;
        if (compositions === 1) {
          throw new EmailConfigurationError('Nenhum fornecedor de email real está configurado.', []);
        }
        return { dispatcher };
      },
    });

    await expect(senderPort.send(input)).rejects.toBeInstanceOf(EmailConfigurationError);

    const outcome = await senderPort.send(input);

    expect(outcome.state).toBe('accepted');
    expect(compositions).toBe(2);
    expect(dispatched).toHaveLength(1);
  });

  it('rejects an invalid external recipient', async () => {
    const { dispatcher } = fakeDispatcher();
    await expectValidationError(
      createSender(dispatcher).send({ ...input, to: 'parceiro at fora' }),
      'recipient_invalid',
    );
  });

  it('rejects sending to the sender own address', async () => {
    const { dispatcher } = fakeDispatcher();
    await expectValidationError(
      createSender(dispatcher).send({ ...input, to: sender.email }),
      'recipient_is_sender',
    );
  });

  it('enforces subject and message limits', async () => {
    const { dispatcher } = fakeDispatcher();
    const senderPort = createSender(dispatcher);

    await expectValidationError(
      senderPort.send({ ...input, subject: '   ' }),
      'subject_missing',
    );
    await expectValidationError(
      senderPort.send({ ...input, subject: 'a'.repeat(EXTERNAL_EMAIL_MAX_SUBJECT + 1) }),
      'subject_too_long',
    );
    await expectValidationError(
      senderPort.send({ ...input, message: '  ' }),
      'message_missing',
    );
    await expectValidationError(
      senderPort.send({ ...input, message: 'a'.repeat(EXTERNAL_EMAIL_MAX_MESSAGE + 1) }),
      'message_too_long',
    );
  });
});
