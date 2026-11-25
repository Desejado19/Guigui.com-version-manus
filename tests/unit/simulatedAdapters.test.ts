import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSimulatedEmailAdapter, createSimulatedSmsAdapter } from '../../server/integrations/simulatedAdapters';
import { describeSmsGateway } from '../../server/smsGatewayService';

describe('simulated communication adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns deterministic simulated references without initializing or calling external transports', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.test');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'operator@example.test');
    vi.stubEnv('SMTP_PASSWORD', 'test-secret');
    vi.stubEnv('EMAIL_FROM', 'tickets@example.test');
    vi.stubEnv('GUIGUI_SMS_GATEWAY_URL', 'https://sms.example.test/send');
    vi.stubEnv('GUIGUI_SMS_GATEWAY_KEY', 'test-api-key');
    vi.stubEnv('GUIGUI_SMS_SENDER', 'GUIGUI');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const createTransportSpy = vi.spyOn(nodemailer, 'createTransport');

    const email = createSimulatedEmailAdapter();
    const sms = createSimulatedSmsAdapter();
    const ticketDelivery = await email.sendTicketPurchase({
      transactionId: 'txn-42',
      recipientEmail: 'buyer@example.com',
      recipientName: 'Buyer Name',
      eventTitle: 'Private Event',
      totalAmountXOF: 25000,
      tickets: [{
        id: 'ticket-42',
        ticketCode: 'GUI-42',
        qrToken: 'qr-secret',
        pinCode: '1234',
        eventId: 'event-42',
        eventTitle: 'Private Event',
        ticketTypeName: 'VIP',
        priceXOF: 25000,
        buyerName: 'Buyer Name',
        buyerPhone: '+245955000001',
        status: 'valid',
      }],
    });
    const invitation = await email.sendTeamInvitation({
      invitationId: 'invite-42',
      recipientEmail: 'invitee@example.com',
      recipientName: 'Invitee Name',
      businessName: 'Business',
      roleLabel: 'Editor',
      invitationUrl: 'https://example.test/invite/secret-token',
    });
    const passwordReset = await email.sendPasswordReset({
      recipientEmail: 'owner@example.com',
      recipientName: 'Owner Name',
      token: 'b'.repeat(64),
    });
    const smsDelivery = await sms.send({
      to: '+245955000001',
      text: 'Ticket GUI-42 PIN 1234',
      reference: 'txn-42-1-1',
    });

    expect(ticketDelivery).toEqual({
      mode: 'simulated',
      state: 'simulated',
      reference: 'SIM-EMAIL-TICKET-txn-42',
    });
    expect(invitation).toEqual({
      mode: 'simulated',
      state: 'simulated',
      reference: 'SIM-EMAIL-INVITATION-invite-42',
    });
    expect(passwordReset).toMatchObject({
      mode: 'simulated',
      state: 'simulated',
      reference: expect.stringMatching(/^SIM-EMAIL-PASSWORD-RESET-[0-9a-f]{24}$/),
    });
    expect(smsDelivery).toEqual({
      mode: 'simulated',
      state: 'simulated',
      reference: 'SIM-SMS-txn-42-1-1',
    });
    expect(describeSmsGateway()).toMatchObject({
      mode: 'simulated',
      configured: false,
      endpoint: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createTransportSpy).not.toHaveBeenCalled();
    const result = JSON.stringify({ ticketDelivery, invitation, smsDelivery });
    for (const privateValue of ['buyer@example.com', 'invitee@example.com', '+245955000001', '1234', 'secret-token']) {
      expect(result).not.toContain(privateValue);
    }
  });
});
