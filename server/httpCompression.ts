import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';

/**
 * Compressão de respostas JSON (gzip/brotli) sem dependências externas, com uma
 * cache curta do corpo já comprimido.
 *
 * O Guigui.com servia `application/json` sem compressão: `/api/sync/bootstrap`
 * saía com 3,6 MB e `/api/businesses` com 3,0 MB por pedido. Comprimir 3,6 MB
 * custa ~100 ms de CPU (gzip) por resposta, e sob carga isso notava-se. Como
 * estas leituras públicas devolvem o mesmo corpo a todos os visitantes durante
 * alguns segundos, o resultado comprimido fica em memória e é reutilizado.
 *
 * Regras de segurança da cache:
 * - só respostas `200` de pedidos **sem** `Cookie`/`Authorization` e **sem**
 *   `Set-Cookie` (nada de dados por utilizador);
 * - a chave inclui método, URL completa (com query) e `Accept-Language`, porque
 *   o payload é localizado;
 * - TTL curto (5 s por omissão) e limite de memória com despejo FIFO.
 *
 * SSE (`text/event-stream`) e ficheiros em streaming continuam a passar intactos.
 */

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

const COMPRESSIBLE = /^(?:application\/(?:json|[a-z0-9.+-]*\+json)|text\/(?:plain|css|javascript|xml)|image\/svg\+xml)\b/i;

type Encoding = 'br' | 'gzip';

type CacheEntry = {
  expiresAt: number;
  bodies: Map<Encoding, Buffer>;
  bytes: number;
};

function pickEncoding(header: string | string[] | undefined): Encoding | null {
  const value = Array.isArray(header) ? header.join(',') : String(header || '');
  if (!value) return null;
  const accepted = value
    .split(',')
    .map((part) => part.trim().toLowerCase().split(';')[0])
    .filter((part) => part && part !== 'identity');
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip') || accepted.includes('*')) return 'gzip';
  return null;
}

function appendVary(current: unknown, value: string): string {
  const existing = typeof current === 'string' ? current : '';
  if (!existing) return value;
  const parts = existing.split(',').map((part) => part.trim().toLowerCase());
  return parts.includes(value.toLowerCase()) ? existing : `${existing}, ${value}`;
}

async function compress(body: Buffer, encoding: Encoding): Promise<Buffer> {
  if (encoding === 'br') {
    // Qualidade 2: nos payloads reais (muito base64) o brotli já reduz 3,6 MB
    // para 2,1 MB em ~22 ms; subir a qualidade só acrescenta CPU.
    return brotliAsync(body, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 2,
        [zlibConstants.BROTLI_PARAM_SIZE_HINT]: body.length,
      },
    });
  }
  // Nível 1: estes payloads são sobretudo base64 e o rácio não melhora com
  // níveis altos (2 499 776 B no nível 1 vs 2 493 651 B no nível 6), mas o
  // custo de CPU duplica. Para clientes sem brotli é o melhor compromisso.
  return gzipAsync(body, { level: 1 });
}

export type HttpCompressionOptions = {
  /** Corpos menores do que isto não compensam o custo de compressão. */
  minBytes?: number;
  /** Tempo de vida de cada entrada comprimida em cache. */
  cacheTtlMs?: number;
  /** Memória máxima ocupada pelos corpos comprimidos em cache. */
  cacheMaxBytes?: number;
  /** Corpos maiores do que isto nunca entram em cache. */
  cacheMaxBodyBytes?: number;
};

export function createHttpCompressionMiddleware(options: HttpCompressionOptions = {}) {
  const minBytes = options.minBytes ?? 1024;
  const cacheTtlMs = options.cacheTtlMs ?? 5000;
  const cacheMaxBytes = options.cacheMaxBytes ?? 64 * 1024 * 1024;
  const cacheMaxBodyBytes = options.cacheMaxBodyBytes ?? 8 * 1024 * 1024;

  const cache = new Map<string, CacheEntry>();
  const pending = new Map<string, Promise<Buffer>>();
  let cachedBytes = 0;

  function readEntry(key: string, encoding: Encoding): Buffer | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      cachedBytes -= entry.bytes;
      cache.delete(key);
      return null;
    }
    const body = entry.bodies.get(encoding);
    if (!body) return null;
    // Reinsere para a ordem FIFO reflectir o último uso.
    cache.delete(key);
    cache.set(key, entry);
    return body;
  }

  function storeEntry(key: string, encoding: Encoding, body: Buffer): void {
    if (body.length > cacheMaxBodyBytes) return;
    const existing = cache.get(key);
    if (existing) {
      cachedBytes -= existing.bytes;
      cache.delete(key);
    }
    const entry: CacheEntry = {
      expiresAt: Date.now() + cacheTtlMs,
      bodies: new Map([[encoding, body]]),
      bytes: body.length,
    };
    cache.set(key, entry);
    cachedBytes += entry.bytes;

    while ((cachedBytes > cacheMaxBytes || cache.size > 500) && cache.size > 0) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = cache.get(oldestKey);
      if (oldest) cachedBytes -= oldest.bytes;
      cache.delete(oldestKey);
    }
  }

  function cacheKeyFor(req: Request, encoding: Encoding): string {
    return `${req.method} ${req.originalUrl} ${encoding} ${String(req.headers['accept-language'] || '')}`;
  }

  return function httpCompression(req: Request, res: Response, next: NextFunction): void {
    const encoding = pickEncoding(req.headers['accept-encoding']);
    if (!encoding || req.method === 'HEAD') return next();

    const originalEnd = res.end.bind(res) as (
      chunk?: unknown,
      encodingOrCallback?: unknown,
      callback?: unknown,
    ) => Response;

    res.end = function compressionEnd(chunk?: unknown, encodingOrCallback?: unknown, callback?: unknown): Response {
      const done = typeof encodingOrCallback === 'function'
        ? (encodingOrCallback as () => void)
        : typeof callback === 'function'
          ? (callback as () => void)
          : undefined;

      // Já há headers enviados (streaming) ou corpo que não é texto: passa intacto.
      const contentType = String(res.getHeader('Content-Type') || '');
      if (res.headersSent || !chunk || !COMPRESSIBLE.test(contentType) || res.getHeader('Content-Encoding')) {
        return originalEnd(chunk, encodingOrCallback, callback);
      }

      const body = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(String(chunk), typeof encodingOrCallback === 'string' ? (encodingOrCallback as BufferEncoding) : 'utf8');
      if (body.length < minBytes) return originalEnd(chunk, encodingOrCallback, callback);

      // Só respostas públicas e idênticas para todos entram em cache: qualquer
      // cookie de sessão desactiva a cache desta resposta.
      const cacheable = res.statusCode === 200
        && !req.headers.cookie
        && !req.headers.authorization
        && !res.getHeader('Set-Cookie');
      const key = cacheable ? cacheKeyFor(req, encoding) : null;

      if (key) {
        const hit = readEntry(key, encoding);
        if (hit) {
          res.setHeader('Content-Encoding', encoding);
          res.setHeader('Vary', appendVary(res.getHeader('Vary'), 'Accept-Encoding'));
          res.setHeader('X-Compression-Cache', 'hit');
          res.removeHeader('Content-Length');
          originalEnd(hit);
          done?.();
          return res;
        }
      }

      const finish = (payload: Buffer, compressed: boolean) => {
        if (compressed) {
          res.setHeader('Content-Encoding', encoding);
          res.setHeader('Vary', appendVary(res.getHeader('Vary'), 'Accept-Encoding'));
          if (key) res.setHeader('X-Compression-Cache', 'miss');
          res.removeHeader('Content-Length');
        }
        originalEnd(payload);
        done?.();
      };

      // Duas VUs a pedir o mesmo URL ao mesmo tempo partilham a compressão.
      const pendingKey = key ? `${key} ${body.length}` : null;
      const inFlight = pendingKey ? pending.get(pendingKey) : null;
      if (inFlight) {
        inFlight.then((payload) => finish(payload, true)).catch(() => finish(body, false));
        return res;
      }

      const task = compress(body, encoding);
      if (pendingKey) {
        pending.set(pendingKey, task);
        task.finally(() => pending.delete(pendingKey)).catch(() => {});
      }
      task
        .then((payload) => {
          if (key) storeEntry(key, encoding, payload);
          finish(payload, true);
        })
        .catch(() => finish(body, false));
      return res;
    } as Response['end'];

    next();
  };
}
