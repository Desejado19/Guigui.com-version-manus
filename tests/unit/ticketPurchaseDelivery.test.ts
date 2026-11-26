import { beforeEach, describe, expect, it, vi } from 'vitest';

const deliveryMocks = vi.hoisted(() => ({
  legacySmsSend: vi.fn(),
  emailSendTicketPurchase: vi.fn(),
  emailSendTeamInvitation: vi.fn(),
  smsSend: vi.fn(),
  persistPostgresNotification: vi.fn(),
}));

vi.mock('../../server/smsGatewayService', () => ({
  sendSms: deliveryMocks.legacySmsSend,
  normaliseMsisdn: (phone: string) => `+245${phone.replace(/\D/g, '').slice(-9)}`,
}));
vi.mock('../../server/postgresCommunicationService', () => ({
  persistPostgresNotification: deliveryMocks.persistPostgresNotification,
}));

const tickets = [
  { id: 'ticket-1', ticketCode: 'GUI-1', qrToken: 'QR-1', pinCode: '1234', eventId: 'event-1', eventTitle: 'Festival', ticketTypeName: 'VIP', priceXOF: 12000, buyerName: 'Account Owner', buyerPhone: '+245955000001', holderName: 'Ticket Holder', holderPhone: '+245955000002', status: 'valid' as const },
  { id: 'ticket-2', ticketCode: 'GUI-2', qrToken: 'QR-2', pinCode: '5678', eventId: 'event-1', eventTitle: 'Festival', ticketTypeName: 'VIP', priceXOF: 12000, buyerName: 'Account Owner', buyerPhone: '+245955000001', holderName: 'Ticket Holder', holderPhone: '+245955000002', status: 'valid' as const },
  { id: 'ticket-3', ticketCode: 'GUI-3', qrToken: 'QR-3', pinCode: '9012', eventId: 'event-1', eventTitle: 'Festival', ticketTypeName: 'Normal', priceXOF: 5000, buyerName: 'Account Owner', buyerPhone: '+245955000001', status: 'valid' as const },
];

const input = {
  transactionId: 'txn-1',
  accountUserId: 'user-1',
  accountEmail: 'account@example.com',
  accountName: 'Account Owner',
  eventId: 'event-1',
  eventTitle: 'Festival',
  totalAmountXOF: 29000,
  tickets,
};

function createPorts() {
  deliveryMocks.emailSendTicketPurchase.mockResolvedValue({
    mode: 'simulated',
    state: 'simulated',
    reference: 'SIM-EMAIL-TICKET-txn-1',
  });
  deliveryMocks.emailSendTeamInvitation.mockResolvedValue({
    mode: 'simulated',
    state: 'simulated',
    reference: 'SIM-EMAIL-INVITATION-invite-1',
  });
  deliveryMocks.smsSend.mockImplementation(async ({ reference }: { reference: string }) => ({
    mode: 'simulated',
    state: 'simulated',
    reference: `SIM-SMS-${reference}`,
  }));
  return {
    email: {
      sendTicketPurchase: deliveryMocks.emailSendTicketPurchase,
      sendTeamInvitation: deliveryMocks.emailSendTeamInvitation,
      sendPasswordReset: deliveryMocks.emailSendTeamInvitation,
    },
    sms: { send: deliveryMocks.smsSend },
  };
}

describe('confirmed ticket purchase delivery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    deliveryMocks.legacySmsSend.mockResolvedValue({ state: 'accepted', mode: 'sandbox' });
    deliveryMocks.persistPostgresNotification.mockResolvedValue(undefined);
  });

  it('uses injected ports for the account email and each distinct ticket-holder SMS group', async () => {
    const { deliverConfirmedTicketPurchase } = await import('../../server/ticketPurchaseDeliveryService');
    const ports = createPorts();

    const result = await deliverConfirmedTicketPurchase(input, ports);

    expect(deliveryMocks.emailSendTicketPurchase).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'txn-1',
      recipientEmail: 'account@example.com',
      recipientName: 'Account Owner',
      tickets,
      totalAmountXOF: 29000,
    }));
    expect(deliveryMocks.persistPostgresNotification).toHaveBeenCalledWith(expect.objectContaining({
      id: 'notif-ticket-txn-1',
      userId: 'user-1',
      category: 'order_redemption',
      metadata: expect.objectContaining({
        transactionId: 'txn-1',
        ticketId: 'ticket-1',
        ticketIds: ['ticket-1', 'ticket-2', 'ticket-3'],
        eventId: 'event-1',
        ticketDestination: 'my-tickets',
      }),
    }));
    expect(deliveryMocks.smsSend).toHaveBeenCalledTimes(4);
    expect(deliveryMocks.smsSend).toHaveBeenNthCalledWith(1, expect.objectContaining({
      to: '+245955000002',
      text: expect.stringContaining('GUI-1, GUI-2'),
    }));
    expect(deliveryMocks.smsSend).toHaveBeenNthCalledWith(3, expect.objectContaining({
      to: '+245955000001',
      text: expect.stringContaining('GUI-3'),
    }));
    expect(deliveryMocks.smsSend.mock.calls[1][0].text).toContain('1234');
    expect(deliveryMocks.legacySmsSend).not.toHaveBeenCalled();
    expect(result).toEqual({
      email: { state: 'simulated', reference: 'SIM-EMAIL-TICKET-txn-1' },
      notification: { state: 'created' },
      sms: {
        state: 'simulated',
        mode: 'simulated',
        references: ['SIM-SMS-txn-1-1-1', 'SIM-SMS-txn-1-1-2', 'SIM-SMS-txn-1-2-1', 'SIM-SMS-txn-1-2-2'],
      },
    });
  });

  it('contains email, SMS, and notification failures without logging recipient or ticket content', async () => {
    const { deliverConfirmedTicketPurchase } = await import('../../server/ticketPurchaseDeliveryService');
    const ports = createPorts();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    deliveryMocks.emailSendTicketPurchase.mockRejectedValue(new Error('SMTP failure account@example.com PIN 4321'));
    deliveryMocks.smsSend.mockRejectedValue(new Error('Gateway failure +245955000001 PIN 4321'));
    deliveryMocks.persistPostgresNotification.mockRejectedValue(new Error('Database failure account@example.com'));
    const failureInput = {
      ...input,
      transactionId: 'txn-private-2',
      tickets: [{
        ...tickets[0],
        pinCode: '4321',
        ticketCode: 'GUI-PRIVATE',
        buyerPhone: '+245955000001',
      }],
    };

    const result = await deliverConfirmedTicketPurchase(failureInput, ports);

    expect(result).toEqual({
      email: { state: 'failed' },
      notification: { state: 'failed' },
      sms: { state: 'failed', mode: 'simulated', references: [] },
    });
    const logOutput = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logOutput).toContain('txn-private-2');
    expect(logOutput).toContain('txn-private-2-1-1');
    expect(logOutput).toContain('txn-private-2-1-2');
    for (const privateValue of ['account@example.com', '+245955000001', '4321', 'GUI-PRIVATE', 'SMTP failure', 'Gateway failure']) {
      expect(logOutput).not.toContain(privateValue);
      expect(JSON.stringify(result)).not.toContain(privateValue);
    }
  });

  it('keeps SMS simulation available without sending email or persisting an account notification for guests', async () => {
    const { deliverConfirmedTicketPurchase } = await import('../../server/ticketPurchaseDeliveryService');
    const ports = createPorts();

    const result = await deliverConfirmedTicketPurchase({
      ...input,
      accountUserId: undefined,
      accountEmail: 'untrusted@example.com',
      tickets: [tickets[0]],
    }, ports);

    expect(deliveryMocks.emailSendTicketPurchase).not.toHaveBeenCalled();
    expect(deliveryMocks.persistPostgresNotification).not.toHaveBeenCalled();
    expect(deliveryMocks.smsSend).toHaveBeenCalledTimes(2);
    expect(result.email).toEqual({ state: 'unavailable' });
    expect(result.notification).toEqual({ state: 'unavailable' });
    expect(result.sms.state).toBe('simulated');
  });
});
