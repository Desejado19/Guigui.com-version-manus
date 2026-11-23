import {
  EmailProviderError,
  type EmailProvider,
  type EmailProviderMessage,
  type EmailProviderMode,
} from '../types';

/**
 * Adapter da API transaccional da Brevo (v3).
 *
 * Um 2xx significa apenas que a Brevo aceitou a mensagem; a entrega real é
 * confirmada depois pelo webhook. Por isso o resultado é sempre `accepted`,
 * nunca `delivered`.
 */

const BREVO_TIMEOUT_MS = 15_000;

export type BrevoFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
}>;

export interface BrevoProviderInput {
  apiKey: string;
  baseUrl?: string;
  mode: EmailProviderMode;
  timeoutMs?: number;
  fetchImpl?: BrevoFetch;
}

interface BrevoErrorDetail {
  code?: string;
  message?: string;
}

function parseBody(raw: string): unknown {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readMessageId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as { messageId?: unknown; messageIds?: unknown }).messageId;
  if (typeof value === 'string' && value.trim()) return value.trim();
  const ids = (body as { messageIds?: unknown }).messageIds;
  if (Array.isArray(ids)) {
    const first = ids.find((id) => typeof id === 'string' && id.trim());
    if (typeof first === 'string') return first.trim();
  }
  return null;
}

function readErrorDetail(body: unknown): BrevoErrorDetail {
  if (!body || typeof body !== 'object') return {};
  const record = body as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
}

function classifyBrevoFailure(status: number, detail: BrevoErrorDetail): EmailProviderError {
  const providerMessage = [detail.code, detail.message].filter(Boolean).join(': ') || `HTTP ${status}`;
  const base = { providerMessage, httpStatus: status };

  if (status === 429) {
    return new EmailProviderError({
      ...base,
      code: 'brevo_rate_limited',
      message: 'A Brevo limitou temporariamente o envio de email.',
      retriable: true,
      outcome: 'failed',
    });
  }
  if (status >= 500) {
    return new EmailProviderError({
      ...base,
      code: 'brevo_server_error',
      message: 'A Brevo devolveu um erro interno ao aceitar a mensagem.',
      retriable: true,
      outcome: 'failed',
    });
  }
  if (status === 401 || status === 403) {
    return new EmailProviderError({
      ...base,
      code: 'brevo_auth_failed',
      message: 'A chave de API da Brevo foi recusada.',
      retriable: false,
      outcome: 'failed',
    });
  }
  if (status === 400 || status === 422) {
    const message = (detail.message || '').toLowerCase();
    const recipientProblem =
      message.includes('invalid') ||
      message.includes('not valid') ||
      message.includes('blacklist') ||
      message.includes('blocked');
    return new EmailProviderError({
      ...base,
      code: recipientProblem ? 'brevo_recipient_rejected' : 'brevo_rejected',
      message: recipientProblem
        ? 'A Brevo recusou o destinatário da mensagem.'
        : 'A Brevo recusou a mensagem por conteúdo inválido.',
      retriable: false,
      outcome: 'rejected',
    });
  }
  return new EmailProviderError({
    ...base,
    code: 'brevo_request_failed',
    message: `A Brevo recusou o envio (HTTP ${status}).`,
    retriable: false,
    outcome: 'failed',
  });
}

export function createBrevoEmailProvider(input: BrevoProviderInput): EmailProvider {
  if (!input.apiKey.trim()) {
    throw new Error('BREVO_API_KEY não está definida.');
  }
  const baseUrl = (input.baseUrl || 'https://api.brevo.com/v3').replace(/\/+$/, '');
  const timeoutMs = input.timeoutMs ?? BREVO_TIMEOUT_MS;
  const doFetch: BrevoFetch = input.fetchImpl ?? ((url, init) => fetch(url, init));

  return {
    name: 'brevo',
    mode: input.mode,
    async send(message: EmailProviderMessage) {
      const payload: Record<string, unknown> = {
        sender: {
          email: message.from.email,
          ...(message.from.name ? { name: message.from.name } : {}),
        },
        to: [
          {
            email: message.to.email,
            ...(message.to.name ? { name: message.to.name } : {}),
          },
        ],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      };
      if (message.replyTo) {
        payload.replyTo = {
          email: message.replyTo.email,
          ...(message.replyTo.name ? { name: message.replyTo.name } : {}),
        };
      }
      if (message.headers && Object.keys(message.headers).length > 0) {
        payload.headers = message.headers;
      }
      if (message.attachments.length > 0) {
        payload.attachment = message.attachments.map((attachment) => ({
          name: attachment.filename,
          content: attachment.content.toString('base64'),
        }));
      }

      let response: Awaited<ReturnType<BrevoFetch>>;
      try {
        response = await doFetch(`${baseUrl}/smtp/email`, {
          method: 'POST',
          headers: {
            'api-key': input.apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new EmailProviderError({
          code: 'brevo_network_error',
          message: 'Não foi possível contactar a API da Brevo.',
          retriable: true,
          outcome: 'failed',
          providerMessage: error instanceof Error ? error.message : String(error),
        });
      }

      const raw = await response.text().catch(() => '');
      if (response.ok) {
        const body = parseBody(raw);
        const messageId =
          readMessageId(body) ||
          response.headers?.get('x-message-id') ||
          `brevo-${Date.now().toString(36)}`;
        return { providerMessageId: messageId, acceptedAt: new Date() };
      }

      throw classifyBrevoFailure(response.status, readErrorDetail(parseBody(raw)));
    },
  };
}
