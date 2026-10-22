import { describe, expect, it } from 'vitest';
import * as emailService from '../../server/emailService';

describe('ticket purchase email', () => {
  it('builds one message with an inline QR and credentials for every issued ticket', async () => {
    const buildMessage = Reflect.get(emailService, 'buildTicketPurchaseEmailMessage') as
      | ((input: {
          recipientEmail: string;
          recipientName: string;
          eventTitle: string;
          totalAmountXOF: number;
          tickets: Array<{
            id: string;
            ticketCode: string;
            qrToken: string;
            pinCode: string;
            eventTitle: string;
            ticketTypeName: string;
            priceXOF: number;
            buyerName: string;
            buyerPhone: string;
            status: 'valid';
          }>;
        }) => Promise<{ to: string; subject: string; text: string; html: string; attachments: Array<{ cid?: string; content: Buffer }> }>)
      | undefined;

    expect(buildMessage).toBeTypeOf('function');
    if (!buildMessage) return;

    const message = await buildMessage({
      recipientEmail: 'buyer@example.com',
      recipientName: 'Comprador <Teste>',
      eventTitle: 'Festival <script>alert(1)</script>',
      totalAmountXOF: 24000,
      tickets: [
        { id: 'ticket-1', ticketCode: 'GUI-1', qrToken: 'QR-1', pinCode: '1234', eventTitle: 'Festival', ticketTypeName: 'VIP', priceXOF: 12000, buyerName: 'Comprador', buyerPhone: '+245955000001', status: 'valid' },
        { id: 'ticket-2', ticketCode: 'GUI-2', qrToken: 'QR-2', pinCode: '5678', eventTitle: 'Festival', ticketTypeName: 'VIP', priceXOF: 12000, buyerName: 'Comprador', buyerPhone: '+245955000001', status: 'valid' },
      ],
    });

    expect(message.to).toBe('buyer@example.com');
    expect(message.text).toContain('GUI-1');
    expect(message.text).toContain('GUI-2');
    expect(message.text).toContain('PIN: 1234');
    expect(message.text).toContain('PIN: 5678');
    expect(message.text.replace(/\s/g, '')).toContain('24000XOF');
    expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(message.html).not.toContain('<script>');
    expect(message.attachments).toHaveLength(2);
    expect(message.attachments.map(({ cid }) => cid)).toEqual(['ticket-qr-1', 'ticket-qr-2']);
    expect(message.attachments.every(({ content }) => content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))).toBe(true);
  });
});
