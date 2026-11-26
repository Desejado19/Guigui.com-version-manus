import { describe, expect, it } from 'vitest';
import { createInMemoryEmailDeliveryRepository } from '../../server/email/deliveryRepository';
import type { NewEmailDeliveryInput } from '../../server/email/deliveryRepository';

function input(overrides: Partial<NewEmailDeliveryInput> = {}): NewEmailDeliveryInput {
  return {
    id: `email-${Math.random().toString(36).slice(2)}`,
    kind: 'team_invitation',
    locale: 'pt',
    recipientEmail: 'ana@example.com',
    recipientName: 'Ana',
    subject: 'Convite',
    provider: 'smtp',
    mode: 'development',
    status: 'queued',
    createdAt: new Date('2026-01-02T10:00:00.000Z'),
    ...overrides,
  };
}

describe('in-memory email delivery repository', () => {
  it('creates and reads a queued delivery', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    const created = await repository.create(input({ id: 'email-1', dedupeKey: 'invite:1' }));

    expect(created.duplicate).toBe(false);
    expect(created.record.status).toBe('queued');
    expect(created.record.attempts).toBe(0);
    expect(await repository.get('email-1')).toMatchObject({
      id: 'email-1',
      recipientEmail: 'ana@example.com',
      status: 'queued',
    });
  });

  it('returns the existing delivery for a repeated dedupe key', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    const first = await repository.create(input({ id: 'email-1', dedupeKey: 'invite:1' }));
    const second = await repository.create(input({ id: 'email-2', dedupeKey: 'invite:1' }));

    expect(second.duplicate).toBe(true);
    expect(second.record.id).toBe(first.record.id);
    expect(await repository.listRecent()).toHaveLength(1);
  });

  it('allows several deliveries without a dedupe key', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    await repository.create(input({ id: 'email-1' }));
    await repository.create(input({ id: 'email-2' }));
    expect(await repository.listRecent()).toHaveLength(2);
  });

  it('records accepted without marking the message as delivered', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    await repository.create(input({ id: 'email-1' }));

    const record = await repository.finish('email-1', {
      status: 'accepted',
      attempts: 2,
      providerMessageId: '<msg@guigui>',
      acceptedAt: new Date('2026-01-02T10:00:05.000Z'),
      at: new Date('2026-01-02T10:00:06.000Z'),
    });

    expect(record.status).toBe('accepted');
    expect(record.attempts).toBe(2);
    expect(record.providerMessageId).toBe('<msg@guigui>');
    expect(record.acceptedAt).toBe('2026-01-02T10:00:05.000Z');
    expect(record.deliveredAt).toBeNull();
    expect(record.finalizedAt).toBe('2026-01-02T10:00:06.000Z');
  });

  it('records a failure with its reason and never a delivery date', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    await repository.create(input({ id: 'email-1' }));

    const record = await repository.finish('email-1', {
      status: 'failed',
      attempts: 3,
      errorCode: 'smtp_network_error',
      errorMessage: 'Não foi possível concluir o envio por SMTP.',
      at: new Date('2026-01-02T10:00:09.000Z'),
    });

    expect(record.status).toBe('failed');
    expect(record.lastErrorCode).toBe('smtp_network_error');
    expect(record.lastErrorMessage).toBe('Não foi possível concluir o envio por SMTP.');
    expect(record.acceptedAt).toBeNull();
    expect(record.deliveredAt).toBeNull();
  });

  it('records the delivered timestamp only when the provider confirms it', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    await repository.create(input({ id: 'email-1' }));

    const record = await repository.finish('email-1', {
      status: 'delivered',
      attempts: 1,
      providerMessageId: '<msg@guigui>',
      at: new Date('2026-01-02T10:05:00.000Z'),
    });

    expect(record.status).toBe('delivered');
    expect(record.deliveredAt).toBe('2026-01-02T10:05:00.000Z');
  });

  it('filters and limits the recent list', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    await repository.create(input({ id: 'email-1', createdAt: new Date('2026-01-02T10:00:00.000Z') }));
    await repository.create(input({ id: 'email-2', createdAt: new Date('2026-01-02T11:00:00.000Z') }));
    await repository.finish('email-2', {
      status: 'failed',
      attempts: 1,
      errorCode: 'smtp_network_error',
      at: new Date('2026-01-02T11:01:00.000Z'),
    });

    const failed = await repository.listRecent({ status: 'failed' });
    expect(failed.map((record) => record.id)).toEqual(['email-2']);

    const limited = await repository.listRecent({ limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0].id).toBe('email-2');
  });

  it('throws when finishing a delivery that does not exist', async () => {
    const repository = createInMemoryEmailDeliveryRepository();
    await expect(
      repository.finish('missing', {
        status: 'accepted',
        attempts: 1,
        at: new Date(),
      }),
    ).rejects.toThrow(/não encontrado/);
  });
});
