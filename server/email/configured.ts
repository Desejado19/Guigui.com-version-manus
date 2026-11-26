import { resolveEmailConfig, type EmailConfig } from './config';
import {
  createEmailDeliveryRepository,
  type EmailDeliveryRepository,
} from './deliveryRepository';
import { createEmailDispatcher, type EmailDispatcher } from './dispatcher';
import { createEmailProvider } from './providers';
import { EmailConfigurationError } from './types';

export interface ConfiguredEmailDispatcher {
  dispatcher: EmailDispatcher;
  config: EmailConfig;
}

/**
 * Compõe o dispatcher a partir do ambiente.
 *
 * Falha explicitamente quando não há fornecedor real configurado: nenhum fluxo
 * deve cair silenciosamente para um modo simulado.
 */
export function createConfiguredEmailDispatcher(
  options: {
    repository?: EmailDeliveryRepository;
    env?: NodeJS.ProcessEnv;
  } = {},
): ConfiguredEmailDispatcher {
  const resolution = resolveEmailConfig(options.env);
  if (!resolution.ready || !resolution.config) {
    throw new EmailConfigurationError(
      resolution.reason ?? 'A configuração de email está incompleta.',
      resolution.issues,
    );
  }

  const config = resolution.config;
  const provider = createEmailProvider(config);
  const dispatcher = createEmailDispatcher({
    provider,
    repository: options.repository ?? createEmailDeliveryRepository(),
    from: config.from,
    replyTo: config.replyTo,
    maxAttempts: config.maxAttempts,
    retryBaseDelayMs: config.retryBaseDelayMs,
    allowLocalDomain: config.localMailbox,
  });

  return { dispatcher, config };
}
