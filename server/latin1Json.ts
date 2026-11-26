// Compatibilidade com clientes e importações que enviam JSON em Latin-1/CP1252.
//
// O `express.json()` só aceita UTF-8 e responde 415 a `charset=iso-8859-1`, o que
// quebra integrações antigas que gravam acentos nessa codificação. Este middleware
// interceta apenas esses pedidos, converte o corpo para UTF-8 e entrega o objeto
// já analisado — o resto do servidor continua a receber texto Unicode normal.
import type { NextFunction, Request, Response } from 'express';

/** Marca o pedido como já analisado, para o parser JSON padrão não repetir. */
export const BODY_PARSED = Symbol.for('guigui.bodyParsed');

const LATIN1_JSON = /^application\/json\s*;\s*charset\s*=\s*"?((iso-?8859-1)|(latin-?1)|(windows-1252)|(cp1252))"?\s*$/i;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const windows1252Decoder = new TextDecoder('windows-1252');

/**
 * Descodifica o corpo uma única vez. Alguns clientes antigos enviam UTF-8 com
 * o cabeçalho `charset=latin1`; nesse caso os bytes continuam a ser UTF-8
 * válido. Só quando não formam UTF-8 válido é que se aplica CP1252/Latin-1.
 */
export function decodeJsonBody(buffer: Buffer): string {
  try {
    return utf8Decoder.decode(buffer);
  } catch {
    return windows1252Decoder.decode(buffer);
  }
}

export function latin1JsonBody(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (!LATIN1_JSON.test(req.headers['content-type'] || '')) return next();

  const chunks: Buffer[] = [];
  let received = 0;
  const limit = 10 * 1024 * 1024;
  let finished = false;

  req.on('data', (chunk: Buffer) => {
    if (finished) return;
    received += chunk.length;
    if (received > limit) {
      finished = true;
      res.status(413).json({ error: 'O corpo do pedido excede o limite permitido.', code: 'PAYLOAD_TOO_LARGE' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (finished) return;
    finished = true;
    const json = decodeJsonBody(Buffer.concat(chunks));
    if (!json.trim()) {
      (req as Request & { body?: unknown }).body = {};
      (req as unknown as Record<symbol, boolean>)[BODY_PARSED] = true;
      return next();
    }
    try {
      (req as Request & { body?: unknown }).body = JSON.parse(json);
      (req as unknown as Record<symbol, boolean>)[BODY_PARSED] = true;
    } catch {
      res.status(400).json({ error: 'O corpo do pedido não é JSON válido.', code: 'INVALID_JSON' });
      return;
    }
    next();
  });

  req.on('error', () => {
    if (finished) return;
    finished = true;
    res.status(400).json({ error: 'Não foi possível ler o corpo do pedido.', code: 'INVALID_BODY' });
  });
}
