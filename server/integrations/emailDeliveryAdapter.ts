import { createHash } from 'node:crypto';
import {
  EmailConfigurationError,
  createConfiguredEmailDispatcher,
  type EmailConfig,
  type EmailDeliveryRepository,
  type EmailDispatchOutcome,
  type EmailDispatcher,
  type EmailProviderMode,
} from '../email';
import { renderTeamInvitationEmail } from '../email/templates/teamInvitation';
import { renderTicketPurchaseEmail } from '../email/templates/ticketPurchase';
import type {
  EmailDeliveryPort,
  IntegrationDeliveryResult,
  TeamInvitationEmailInput,
  TicketPurchaseEmailInput,
} from './ports';
import { createSimulatedEmailAdapter } from './simulatedAdapters';

/**
 * Porta de email dos fluxos de negócio (bilhetes e convites).
 *
 * Com um fornecedor configurado, renderiza o template, passa pelo dispatcher
 * (validação, dedupe, retry, histórico em `email_deliveries`) e devolve o
 * estado real. Sem fornecedor, delega no adapter simulado: o chamador recebe
 * `mode: 'simulated'` e o link de ativação, exactamente como antes.
 */

export interface EmailDeliveryComposition {
  dispatcher: EmailDispatcher;
  config: EmailConfig;
}

export interface EmailDeliveryAdapterOptions {
  env?: NodeJS.ProcessEnv;
  repository?: EmailDeliveryRepository;
  /** Substituível em testes para não contactar fornecedores reais. */
  compose?: () => EmailDeliveryComposition;
  simulated?: EmailDeliveryPort;
}

function deliveryState(
  state: EmailDispatchOutcome['state'],
): IntegrationDeliveryResult['state'] {
  switch (state) {
    case 'accepted':
    case 'delivered':
      return 'accepted';
    case 'rejected':
    case 'bounced':
    case 'complained':
      return 'rejected';
    default:
      return 'failed';
  }
}

function receipt(outcome: EmailDispatchOutcome, mode: EmailProviderMode): IntegrationDeliveryResult {
  return {
    mode,
    state: deliveryState(outcome.state),
    reference: outcome.deliveryId,
  };
}

export function createEmailDeliveryAdapter(
  options: EmailDeliveryAdapterOptions = {},
): EmailDeliveryPort {
  const simulated = options.simulated ?? createSimulatedEmailAdapter();
  let composition: EmailDeliveryComposition | null | undefined;

  // Resolvido uma única vez: a configuração só muda com um reinício, e assim
  // não se cria um transporte por email.
  function resolveComposition(): EmailDeliveryComposition | null {
    if (composition !== undefined) return composition;
    const compose =
      options.compose ??
      (() =>
        createConfiguredEmailDispatcher({
          repository: options.repository,
          env: options.env,
        }));
    try {
      composition = compose();
    } catch (error) {
      // Sem fornecedor configurado o fluxo degrada para simulado; uma falha de
      // configuração real sobe e é registada pelo chamador.
      if (!(error instanceof EmailConfigurationError)) throw error;
      composition = null;
    }
    return composition;
  }

  return {
    async sendTicketPurchase(input: TicketPurchaseEmailInput) {
      const active = resolveComposition();
      if (!active) return simulated.sendTicketPurchase(input);

      const rendered = await renderTicketPurchaseEmail({
        recipientName: input.recipientName,
        eventTitle: input.eventTitle,
        totalAmountXOF: input.totalAmountXOF,
        tickets: input.tickets,
        appUrl: active.config.appUrl,
      });
      const outcome = await active.dispatcher.dispatch({
        to: { email: input.recipientEmail, name: input.recipientName },
        kind: 'ticket_delivery',
        locale: 'pt',
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: rendered.attachments,
        dedupeKey: `ticket-purchase:${input.transactionId}`,
      });
      return receipt(outcome, active.config.mode);
    },

    async sendTeamInvitation(input: TeamInvitationEmailInput) {
      const active = resolveComposition();
      if (!active) return simulated.sendTeamInvitation(input);

      const rendered = renderTeamInvitationEmail({
        recipientName: input.recipientName,
        organizationName: input.organizationName ?? input.businessName,
        roleLabel: input.roleLabel,
        modules: input.modules ?? [],
        invitationUrl: input.invitationUrl,
        isAdminScope: input.isAdminScope ?? false,
        appUrl: active.config.appUrl,
      });
      // O token muda em cada reenvio: a impressão digital do link distingue-os
      // sem guardar o token em claro.
      const linkFingerprint = createHash('sha256')
        .update(input.invitationUrl)
        .digest('hex')
        .slice(0, 24);
      const outcome = await active.dispatcher.dispatch({
        to: { email: input.recipientEmail, name: input.recipientName },
        kind: 'team_invitation',
        locale: 'pt',
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: rendered.attachments,
        dedupeKey: `team-invitation:${input.invitationId}:${linkFingerprint}`,
      });
      return receipt(outcome, active.config.mode);
    },
  };
}
