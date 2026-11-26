import { describe, expect, it } from 'vitest';
import type { EmailConfig, EmailDispatchOutcome, EmailDispatcher, OutgoingEmail } from '../../server/email';
import {
  createEmailDeliveryAdapter,
  type EmailDeliveryComposition,
} from '../../server/integrations/emailDeliveryAdapter';

const tickets = [
  {
    id: 'ticket-1',
    ticketCode: 'GUI-1',
    qrToken: 'qr-token-1',
    pinCode: '1234',
    eventId: 'event-1',
    eventTitle: 'Festival',
    ticketTypeName: 'VIP',
    priceXOF: 12000,
    buyerName: 'Comprador',
    buyerPhone: '+245955000001',
    status: 'valid' as const,
  },
];

function emailConfig(overrides: Partial<EmailConfig> = {}): EmailConfig {
  return {
    provider: 'smtp',
    mode: 'development',
    from: { email: 'no-reply@guigui.com', name: 'Guigui.com' },
    appUrl: 'https://guigui.com',
    maxAttempts: 3,
    retryBaseDelayMs: 0,
    smtp: { host: '127.0.0.1', port: 1025, secure: false },
    localMailbox: true,
    warnings: [],
    ...overrides,
  };
}

function fakeDispatcher(overrides: Partial<EmailDispatchOutcome> = {}) {
  const dispatched: OutgoingEmail[] = [];
  const dispatcher: EmailDispatcher = {
    async dispatch(email) {
      dispatched.push(email);
      return {
        deliveryId: 'email-1',
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
  const composition: EmailDeliveryComposition = { dispatcher, config: emailConfig() };
  return { dispatched, composition };
}

const ticketInput = {
  transactionId: 'txn-1',
  recipientEmail: 'buyer@example.com',
  recipientName: 'Comprador',
  eventTitle: 'Festival',
  totalAmountXOF: 12000,
  tickets,
};

const invitationInput = {
  invitationId: 'invite-1',
  recipientEmail: 'invitee@example.com',
  recipientName: 'João Moderação',
  businessName: 'Empresa Exemplo',
  roleLabel: 'Moderador',
  invitationUrl: 'https://guigui.com/ativar-convite?token=secret-token',
  modules: ['Moderação'],
  isAdminScope: false,
};

describe('email delivery adapter', () => {
  it('stays simulated without a configured provider and keeps the manual link contract', async () => {
    const adapter = createEmailDeliveryAdapter({ env: {} });

    const ticketDelivery = await adapter.sendTicketPurchase(ticketInput);
    const invitationDelivery = await adapter.sendTeamInvitation(invitationInput);

    expect(ticketDelivery).toEqual({
      mode: 'simulated',
      state: 'simulated',
      reference: 'SIM-EMAIL-TICKET-txn-1',
    });
    expect(invitationDelivery).toEqual({
      mode: 'simulated',
      state: 'simulated',
      reference: 'SIM-EMAIL-INVITATION-invite-1',
    });
  });

  it('dispatches the rendered ticket email once, keyed by transaction', async () => {
    const { dispatched, composition } = fakeDispatcher();
    const adapter = createEmailDeliveryAdapter({ compose: () => composition });

    const delivery = await adapter.sendTicketPurchase(ticketInput);

    expect(delivery).toEqual({ mode: 'development', state: 'accepted', reference: 'email-1' });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      kind: 'ticket_delivery',
      locale: 'pt',
      to: { email: 'buyer@example.com', name: 'Comprador' },
      dedupeKey: 'ticket-purchase:txn-1',
    });
    expect(dispatched[0].html).toContain('GUI-1');
    expect(dispatched[0].html).toContain('PIN');
    expect(dispatched[0].attachments).toHaveLength(1);
    expect(dispatched[0].attachments?.[0].filename).toBe('GUI-1-qr.png');
  });

  it('keys invitation dispatches by invitation and link, so resends still send', async () => {
    const { dispatched, composition } = fakeDispatcher();
    const adapter = createEmailDeliveryAdapter({ compose: () => composition });

    await adapter.sendTeamInvitation(invitationInput);
    await adapter.sendTeamInvitation({
      ...invitationInput,
      invitationUrl: 'https://guigui.com/ativar-convite?token=new-token',
    });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].kind).toBe('team_invitation');
    expect(dispatched[0].dedupeKey).toMatch(/^team-invitation:invite-1:[0-9a-f]{24}$/);
    expect(dispatched[0].dedupeKey).not.toBe(dispatched[1].dedupeKey);
    expect(dispatched[0].dedupeKey).not.toContain('secret-token');
    expect(dispatched[0].html).toContain('Moderação');
    expect(dispatched[0].html).toContain('Empresa Exemplo');
  });

  it('reports provider failures without pretending the message was sent', async () => {
    const failed = fakeDispatcher({ state: 'failed', errorCode: 'smtp_network_error' });
    const rejected = fakeDispatcher({ state: 'rejected', errorCode: 'recipient_invalid' });

    const failedDelivery = await createEmailDeliveryAdapter({ compose: () => failed.composition })
      .sendTicketPurchase(ticketInput);
    const rejectedDelivery = await createEmailDeliveryAdapter({ compose: () => rejected.composition })
      .sendTeamInvitation(invitationInput);

    expect(failedDelivery).toMatchObject({ mode: 'development', state: 'failed' });
    expect(rejectedDelivery).toMatchObject({ mode: 'development', state: 'rejected' });
  });

  it('sends the password reset code without putting the token in the dedupe key', async () => {
    const { dispatched, composition } = fakeDispatcher();
    const adapter = createEmailDeliveryAdapter({ compose: () => composition });
    const token = 'a'.repeat(64);

    const delivery = await adapter.sendPasswordReset({
      recipientEmail: 'owner@example.com',
      recipientName: 'Owner',
      token,
      expiresInMinutes: 15,
    });

    expect(delivery).toEqual({ mode: 'development', state: 'accepted', reference: 'email-1' });
    expect(dispatched[0]).toMatchObject({ kind: 'password_reset', to: { email: 'owner@example.com' } });
    expect(dispatched[0].html).toContain(token);
    expect(dispatched[0].dedupeKey).toMatch(/^password-reset:[0-9a-f]{24}$/);
    expect(dispatched[0].dedupeKey).not.toContain(token);
  });

  it('maps an already delivered outcome to accepted (the port never claims delivery)', async () => {
    const delivered = fakeDispatcher({ state: 'delivered' });
    const adapter = createEmailDeliveryAdapter({ compose: () => delivered.composition });

    expect(await adapter.sendTicketPurchase(ticketInput)).toMatchObject({ state: 'accepted' });
  });
});
