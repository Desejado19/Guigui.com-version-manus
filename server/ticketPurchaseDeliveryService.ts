import type {
  EmailDeliveryPort,
  SmsDeliveryPort,
} from './integrations/ports';
import { persistPostgresNotification } from './postgresCommunicationService';
import { normaliseMsisdn } from './smsGatewayService';
import type { TicketForValidation } from './validationService';

type TicketSmsGroup = {
  phone: string;
  tickets: TicketForValidation[];
};

export type TicketPurchaseDeliveryResult = {
  email: {
    state: 'simulated' | 'accepted' | 'rejected' | 'failed' | 'unavailable';
    reference?: string;
  };
  notification: { state: 'created' | 'failed' | 'unavailable' };
  sms: {
    state: 'simulated' | 'failed';
    mode: 'simulated';
    references: string[];
  };
};

function groupTicketsByHolder(tickets: TicketForValidation[]): TicketSmsGroup[] {
  const groups = new Map<string, TicketSmsGroup>();
  for (const ticket of tickets) {
    const phone = normaliseMsisdn(ticket.holderPhone || ticket.buyerPhone);
    const group = groups.get(phone) || { phone, tickets: [] };
    group.tickets.push(ticket);
    groups.set(phone, group);
  }
  return Array.from(groups.values());
}

function buildHolderMessages(eventTitle: string, tickets: TicketForValidation[]) {
  const safeEventTitle = eventTitle.replace(/[\r\n]+/g, ' ').trim();
  const message1 = `[Guigui.com] Compra confirmada para ${safeEventTitle}. Códigos: ${tickets.map((ticket) => ticket.ticketCode).join(', ')}.`;
  const message2 = `[Guigui.com] PINs individuais de validação: ${tickets.map((ticket) => `${ticket.ticketCode}: ${ticket.pinCode || 'N/D'}`).join('; ')}. Não partilhe com terceiros.`;
  return [message1, message2];
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function logDeliveryFailure(event: string, transactionId: string, reference: string, error: unknown): void {
  console.error(event, { transactionId, reference, errorName: errorName(error) });
}

export async function deliverConfirmedTicketPurchase(
  input: {
    transactionId: string;
    accountUserId?: string;
    accountEmail?: string;
    accountName?: string;
    eventId: string;
    eventTitle: string;
    totalAmountXOF: number;
    tickets: TicketForValidation[];
  },
  ports: { email: EmailDeliveryPort; sms: SmsDeliveryPort },
): Promise<TicketPurchaseDeliveryResult> {
  let email: TicketPurchaseDeliveryResult['email'] = { state: 'unavailable' };
  if (input.accountUserId && input.accountEmail) {
    try {
      const receipt = await ports.email.sendTicketPurchase({
        transactionId: input.transactionId,
        recipientEmail: input.accountEmail,
        recipientName: input.accountName || input.tickets[0]?.buyerName || 'Cliente Guigui',
        eventTitle: input.eventTitle,
        totalAmountXOF: input.totalAmountXOF,
        tickets: input.tickets,
      });
      email = { state: receipt.state, reference: receipt.reference };
    } catch (error) {
      email = { state: 'failed' };
      logDeliveryFailure('ticket-purchase-email-failed', input.transactionId, input.transactionId, error);
    }
  }

  let notificationState: TicketPurchaseDeliveryResult['notification']['state'] = 'unavailable';
  if (input.accountUserId) {
    try {
      await persistPostgresNotification({
        id: `notif-ticket-${input.transactionId}`,
        userId: input.accountUserId,
        category: 'order_redemption',
        title: 'O seu bilhete está disponível',
        message: `A compra para ${input.eventTitle} foi confirmada. ${input.tickets.length} bilhete(s) estão disponíveis em Área pessoal > Meus bilhetes.`,
        metadata: {
          transactionId: input.transactionId,
          ticketId: input.tickets[0]?.id,
          ticketIds: input.tickets.map((ticket) => ticket.id),
          ticketCodes: input.tickets.map((ticket) => ticket.ticketCode),
          eventId: input.eventId,
          ticketDestination: 'my-tickets',
        },
        createdAt: new Date().toISOString(),
      });
      notificationState = 'created';
    } catch (error) {
      notificationState = 'failed';
      console.error('ticket-purchase-notification-failed', {
        transactionId: input.transactionId,
        errorName: errorName(error),
      });
    }
  }

  const groups = groupTicketsByHolder(input.tickets);
  const smsDeliveries = await Promise.all(groups.flatMap((group, groupIndex) => {
    const messages = buildHolderMessages(input.eventTitle, group.tickets);
    return messages.map(async (text, messageIndex) => {
      const reference = `${input.transactionId}-${groupIndex + 1}-${messageIndex + 1}`;
      try {
        return await ports.sms.send({ to: group.phone, text, reference });
      } catch (error) {
        logDeliveryFailure('ticket-purchase-sms-failed', input.transactionId, reference, error);
        return { mode: 'simulated', state: 'failed', reference } as const;
      }
    });
  }));
  const failedDelivery = smsDeliveries.some((delivery) => delivery.state === 'failed');
  const smsState: TicketPurchaseDeliveryResult['sms']['state'] = failedDelivery ? 'failed' : 'simulated';

  return {
    email,
    notification: { state: notificationState },
    sms: {
      state: smsState,
      mode: 'simulated',
      references: smsDeliveries.filter((delivery) => delivery.state !== 'failed').map((delivery) => delivery.reference),
    },
  };
}
