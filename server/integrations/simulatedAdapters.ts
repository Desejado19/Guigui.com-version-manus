import type {
  EmailDeliveryPort,
  IntegrationDeliveryResult,
  SmsDeliveryPort,
} from './ports';

function safeReference(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'unknown';
}

function simulatedReceipt(reference: string): IntegrationDeliveryResult {
  return { mode: 'simulated', state: 'simulated', reference };
}

export function createSimulatedEmailAdapter(): EmailDeliveryPort {
  return {
    async sendTicketPurchase({ transactionId }) {
      return simulatedReceipt(`SIM-EMAIL-TICKET-${safeReference(transactionId)}`);
    },
    async sendTeamInvitation({ invitationId }) {
      return simulatedReceipt(`SIM-EMAIL-INVITATION-${safeReference(invitationId)}`);
    },
  };
}

export function createSimulatedSmsAdapter(): SmsDeliveryPort {
  return {
    async send({ reference }) {
      return simulatedReceipt(`SIM-SMS-${safeReference(reference)}`);
    },
  };
}
