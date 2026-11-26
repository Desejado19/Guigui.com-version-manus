import { describe, expect, it } from 'vitest';
import { renderTeamInvitationEmail } from '../../server/email/templates/teamInvitation';
import { renderTicketPurchaseEmail } from '../../server/email/templates/ticketPurchase';

const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const tickets = [
  {
    id: 'ticket-1',
    ticketCode: 'GUI-1',
    qrToken: 'qr-token-1',
    pinCode: '1234',
    eventId: 'event-1',
    eventTitle: 'Festival <script>alert(1)</script>',
    ticketTypeName: 'VIP',
    priceXOF: 12000,
    buyerName: 'Comprador',
    buyerPhone: '+245955000001',
    status: 'valid' as const,
  },
  {
    id: 'ticket-2',
    ticketCode: 'GUI-2',
    qrToken: 'qr-token-2',
    pinCode: '5678',
    eventId: 'event-1',
    eventTitle: 'Festival <script>alert(1)</script>',
    ticketTypeName: 'VIP',
    priceXOF: 12000,
    buyerName: 'Comprador',
    buyerPhone: '+245955000001',
    status: 'valid' as const,
  },
];

describe('ticket purchase email template', () => {
  it('includes every ticket, its credentials and a QR file per ticket', async () => {
    const message = await renderTicketPurchaseEmail({
      recipientName: 'Comprador <Teste>',
      eventTitle: 'Festival <script>alert(1)</script>',
      totalAmountXOF: 24000,
      tickets,
      appUrl: 'https://guigui.com',
    });

    expect(message.subject).toBe('Bilhetes para Festival <script>alert(1)</script>');
    expect(message.text).toContain('GUI-1');
    expect(message.text).toContain('GUI-2');
    expect(message.text).toContain('PIN: 1234');
    expect(message.text).toContain('PIN: 5678');
    expect(message.text.replace(/\s/g, '')).toContain('24000XOF');
    expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(message.html).not.toContain('<script>');

    expect(message.attachments).toHaveLength(2);
    expect(message.attachments.map((attachment) => attachment.filename)).toEqual([
      'GUI-1-qr.png',
      'GUI-2-qr.png',
    ]);
    expect(message.attachments.every((attachment) => attachment.contentType === 'image/png')).toBe(true);
    expect(message.attachments.every((attachment) => attachment.content.subarray(0, 8).equals(PNG_MAGIC))).toBe(
      true,
    );
    // Sem `cid:`: a Brevo não suporta imagens embutidas e o QR vai em anexo.
    expect(message.html).not.toContain('cid:');
    expect(message.html).toContain('GUI-1-qr.png');
  });

  it('keeps the subject on a single line', async () => {
    const message = await renderTicketPurchaseEmail({
      recipientName: 'Comprador',
      eventTitle: 'Festival\r\nBcc: evil@example.com',
      totalAmountXOF: 12000,
      tickets: [tickets[0]],
    });

    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.subject).toBe('Bilhetes para Festival Bcc: evil@example.com');
  });
});

describe('team invitation email template', () => {
  it('renders organization, role, modules and the activation link', () => {
    const message = renderTeamInvitationEmail({
      recipientName: 'João Moderação',
      organizationName: 'Administração Guigui.com',
      roleLabel: 'Moderador',
      modules: ['Moderação', 'Empresas e Negócios'],
      invitationUrl: 'https://guigui.com/ativar-convite?token=abc123',
      isAdminScope: true,
      appUrl: 'https://guigui.com',
    });

    expect(message.subject).toBe('Convite para integrar a equipa do Guigui.com');
    expect(message.html).toContain('Administração Guigui.com');
    expect(message.html).toContain('Moderador');
    expect(message.html).toContain('Moderação');
    expect(message.html).toContain('Empresas e Negócios');
    expect(message.html).toContain('href="https://guigui.com/ativar-convite?token=abc123"');
    expect(message.html).toContain('Aceitar convite e ativar conta');
    expect(message.text).toContain('Organização: Administração Guigui.com');
    expect(message.text).toContain('- Moderação');
    expect(message.attachments).toEqual([]);
  });

  it('escapes the invitee name and does not render an empty module list', () => {
    const message = renderTeamInvitationEmail({
      recipientName: '<b>João</b>',
      organizationName: 'Empresa & Filhos',
      roleLabel: 'Editor',
      modules: [],
      invitationUrl: 'https://guigui.com/ativar-convite?token=abc123',
      isAdminScope: false,
    });

    expect(message.html).toContain('&lt;b&gt;João&lt;/b&gt;');
    expect(message.html).toContain('Empresa &amp; Filhos');
    expect(message.html).not.toContain('Módulos atribuídos');
    expect(message.text).toContain('Âmbito: Empresa');
  });
});
