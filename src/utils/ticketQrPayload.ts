/**
 * Lógica pura do leitor de QR de bilhetes — partilhada entre o componente
 * `TicketScannerView` e os testes (`scripts/audit-ticket-scanner.ts`), para que
 * os testes exercitem exactamente o código que corre em produção.
 */

export const QR_TICKET_PREFIX = 'GUI-TICKET:v1:';

/** Só se processa 1 em cada N frames da câmara (desempenho em mobile). */
export const FRAME_PROCESS_INTERVAL = 3;

export interface ParsedTicketPayload {
  code: string;
  qrToken: string;
  eventMatches: boolean;
}

/** Verifica `eventId` como segmento inteiro, evitando falsos positivos (EVT-1 ⊂ EVT-10). */
function tokenContainsEventId(token: string, eventId: string): boolean {
  if (!token || !eventId) return false;
  const isBoundary = (ch: string | undefined) => !ch || !/[A-Za-z0-9]/.test(ch);
  let index = token.indexOf(eventId);
  while (index !== -1) {
    const before = index > 0 ? token[index - 1] : undefined;
    const after = index + eventId.length < token.length ? token[index + eventId.length] : undefined;
    if (isBoundary(before) && isBoundary(after)) return true;
    index = token.indexOf(eventId, index + 1);
  }
  return false;
}

/**
 * Formato: `GUI-TICKET:v1:<qrToken>:<ticketCode>`
 * - Sem evento seleccionado (`eventId` ausente) aceita qualquer bilhete válido.
 * - Com evento seleccionado, só aceita se o token pertencer a esse evento.
 */
export function parseTicketPayload(raw: string, eventId?: string): ParsedTicketPayload {
  const trimmed = raw.trim();
  if (trimmed.startsWith(QR_TICKET_PREFIX)) {
    const parts = trimmed.split(':');
    if (parts.length >= 3) {
      const qrToken = parts[2];
      const code = parts.slice(3).join(':') || '';
      const eventMatches = !eventId || tokenContainsEventId(qrToken, eventId);
      return { code, qrToken, eventMatches };
    }
  }
  return { code: trimmed, qrToken: '', eventMatches: false };
}

/** Frame skipping: processa apenas 1 em cada `FRAME_PROCESS_INTERVAL` frames. */
export function shouldProcessFrame(frameNumber: number): boolean {
  return frameNumber % FRAME_PROCESS_INTERVAL === 0;
}
