/**
 * Gateway de SMS (Secção 7 / GUI-3.4.06).
 *
 * O sistema já produzia o conteúdo do SMS, mas nunca o entregava: o serviço
 * anterior só guardava a mensagem em `localStorage` e tocava um som. Aqui há
 * uma camada de entrega real, configurada por ambiente, com três modos:
 *
 * - `live`    — envia HTTP ao gateway configurado e regista o estado devolvido.
 * - `sandbox` — o gateway está configurado mas `GUIGUI_SMS_MODE=sandbox`: chama
 *               o gateway sem cobrar, para integração.
 * - `simulated` — sem gateway configurado. A mensagem é registada como
 *               `simulated` e o sistema diz claramente que não foi entregue.
 *
 * O modo nunca é adivinhado: `mode` reflecte a configuração real, e cada
 * entrega guarda o estado devolvido pelo operador.
 */

export type SmsDeliveryState = 'delivered' | 'accepted' | 'queued' | 'failed' | 'simulated';

export type SmsGatewayConfig = {
  endpoint: string;
  apiKey: string;
  sender: string;
  mode: 'live' | 'sandbox' | 'simulated';
};

export type SmsOutbound = {
  to: string;
  text: string;
  reference: string;
};

export type SmsDelivery = {
  state: SmsDeliveryState;
  mode: SmsGatewayConfig['mode'];
  providerRef?: string;
  error?: string;
};

/** Lê a configuração do gateway a cada chamada, para respeitar o runtime. */
export function readSmsGatewayConfig(): SmsGatewayConfig {
  const endpoint = process.env.GUIGUI_SMS_GATEWAY_URL?.trim() || '';
  const apiKey = process.env.GUIGUI_SMS_GATEWAY_KEY?.trim() || '';
  const sender = process.env.GUIGUI_SMS_SENDER?.trim() || 'GUIGUI';
  if (!endpoint || !apiKey) return { endpoint, apiKey, sender, mode: 'simulated' };
  const forced = process.env.GUIGUI_SMS_MODE?.trim().toLowerCase();
  if (forced === 'sandbox') return { endpoint, apiKey, sender, mode: 'sandbox' };
  if (forced === 'live') return { endpoint, apiKey, sender, mode: 'live' };
  // Por omissão, um gateway configurado só é considerado produção em produção.
  return { endpoint, apiKey, sender, mode: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox' };
}

export function normaliseMsisdn(phone: unknown): string {
  const digits = String(phone || '').replace(/\D/g, '');
  // Numeração da Guiné-Bissau em formato E.164: +245XXXXXXXX
  return digits.startsWith('245') ? `+${digits}` : `+245${digits.slice(-9)}`;
}

/** Número de segmentos de SMS, usado para estimar custo. */
export function estimateSegments(text: string): number {
  const length = [...text].length;
  if (length <= 160) return 1;
  return Math.ceil(length / 153);
}

/**
 * Envia um SMS. Nunca lança: uma falha do operador não pode derrubar a compra
 * de um bilhete, e o estado da entrega fica registado para auditoria.
 */
export async function sendSms(outbound: SmsOutbound): Promise<SmsDelivery> {
  const config = readSmsGatewayConfig();
  const to = normaliseMsisdn(outbound.to);

  if (config.mode === 'simulated') {
    return { state: 'simulated', mode: 'simulated' };
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        from: config.sender,
        to,
        text: outbound.text,
        reference: outbound.reference,
        segments: estimateSegments(outbound.text),
        // O gateway usa isto para não entregar em modo de teste.
        sandbox: config.mode === 'sandbox',
      }),
      signal: AbortSignal.timeout(Number(process.env.GUIGUI_SMS_TIMEOUT_MS || 10_000)),
    });

    if (!response.ok) {
      return { state: 'failed', mode: config.mode, error: `Gateway respondeu ${response.status}.` };
    }
    const payload = await response.json().catch(() => ({})) as { ref?: string; id?: string; status?: string; message?: string };
    const status = String(payload.status || '').toLowerCase();
    const state: SmsDeliveryState = status.includes('deliver') ? 'delivered'
      : status.includes('accept') || status.includes('queued') ? 'accepted'
      : status.includes('fail') || status.includes('reject') ? 'failed'
      : 'accepted';
    return {
      state,
      mode: config.mode,
      ...(payload.ref || payload.id ? { providerRef: String(payload.ref || payload.id) } : {}),
      ...(payload.message ? { error: String(payload.message) } : {}),
    };
  } catch (error) {
    return { state: 'failed', mode: config.mode, error: error instanceof Error ? error.message : 'erro desconhecido' };
  }
}

/** O sistema usa apenas simulação até a integração externa ser ativada explicitamente. */
export function describeSmsGateway() {
  return {
    mode: 'simulated' as const,
    configured: false,
    endpoint: null,
    sender: 'GUIGUI',
    note: 'Integração SMS simulada: nenhum SMS é enviado para telemóveis.',
  };
}
