export { resolveEmailConfig, type EmailConfig, type EmailConfigResolution } from './config';
export {
  createConfiguredEmailDispatcher,
  type ConfiguredEmailDispatcher,
} from './configured';
export {
  createEmailDeliveryRepository,
  createInMemoryEmailDeliveryRepository,
  createPostgresEmailDeliveryRepository,
  type EmailDeliveryFinishInput,
  type EmailDeliveryRepository,
  type NewEmailDeliveryInput,
} from './deliveryRepository';
export {
  createEmailDispatcher,
  type EmailDispatchOutcome,
  type EmailDispatcher,
  type EmailDispatcherDependencies,
  type EmailDispatcherLogger,
} from './dispatcher';
export { renderEmailLayout, escapeHtml } from './layout';
export type { EmailLayoutInput, EmailSection, RenderedEmailLayout } from './layout';
export { createEmailProvider } from './providers';
export { createBrevoEmailProvider } from './providers/brevo';
export { createSmtpEmailProvider } from './providers/smtp';
export {
  createExternalEmailSender,
  EXTERNAL_EMAIL_MAX_MESSAGE,
  EXTERNAL_EMAIL_MAX_SUBJECT,
  ExternalEmailValidationError,
  renderExternalEmail,
  type CreateExternalEmailSenderOptions,
  type ExternalEmailComposition,
  type ExternalEmailInput,
  type ExternalEmailSender,
  type ExternalEmailSenderPort,
} from './outboundService';
export {
  renderTeamInvitationEmail,
  renderTicketPurchaseEmail,
  type RenderedTeamInvitationEmail,
  type RenderedTicketPurchaseEmail,
  type TeamInvitationEmailData,
  type TicketPurchaseEmailData,
} from './templates';
export {
  normaliseEmailAddress,
  validateEmailContent,
  formatEmailAddress,
  sanitiseDisplayName,
  MAX_SUBJECT_LENGTH,
  MAX_HTML_BYTES,
  MAX_TEXT_BYTES,
  type EmailValidationResult,
} from './validation';
export {
  EmailConfigurationError,
  EmailProviderError,
  type EmailAddress,
  type EmailAttachment,
  type EmailContent,
  type EmailDeliveryRecord,
  type EmailDeliveryStatus,
  type EmailKind,
  type EmailLocale,
  type EmailProvider,
  type EmailProviderMessage,
  type EmailProviderMode,
  type EmailProviderName,
  type EmailProviderReceipt,
  type OutgoingEmail,
} from './types';
