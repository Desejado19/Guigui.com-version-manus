import type { Request, RequestHandler } from 'express';
import { databasePool, withDbIdentity } from './db';

/**
 * Logs técnicos do módulo Sistema.
 *
 * A fonte é o próprio processo: respostas HTTP com erro ou lentas, e eventos
 * explícitos que outros serviços queiram registar. Não há dados inventados e
 * nenhum corpo de pedido é guardado; chaves sensíveis são removidas antes da
 * persistência. A escrita é best-effort (telemetria nunca derruba um pedido).
 */

export type SystemLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SystemLogInput = {
  level: SystemLogLevel;
  service?: string;
  route?: string | null;
  message: string;
  context?: Record<string, unknown>;
  requestId?: string | null;
  traceId?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
};

const SENSITIVE_KEY = /(password|passwd|token|secret|authorization|cookie|api[-_]?key|credential)/i;
const MAX_DEPTH = 3;

/** Remove chaves sensíveis e limita a profundidade do contexto. */
export function sanitiseLogContext(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[profundidade limitada]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitiseLogContext(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      output[key] = sanitiseLogContext(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

let lastPersistErrorAt = 0;

export async function recordSystemLog(input: SystemLogInput): Promise<void> {
  if (!databasePool) return;
  try {
    await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
      databasePool!.query(
        `INSERT INTO system_logs
           (level, service, route, message, context, request_id, trace_id, status_code, duration_ms)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [
          input.level,
          input.service || 'api',
          input.route ? input.route.slice(0, 255) : null,
          input.message.slice(0, 1000),
          JSON.stringify(sanitiseLogContext(input.context || {})),
          input.requestId || null,
          input.traceId || null,
          input.statusCode ?? null,
          input.durationMs ?? null,
        ],
      ),
    );
  } catch (error) {
    // Não entrar em ciclo de erros: no máximo um aviso por minuto.
    const now = Date.now();
    if (now - lastPersistErrorAt > 60_000) {
      lastPersistErrorAt = now;
      console.error(
        '[Guigui.com] Falha ao persistir log técnico:',
        error instanceof Error ? error.message : 'unknown_error',
      );
    }
  }
}

/** Deriva o serviço a partir da rota, para agrupar os logs sem inventar nomes. */
export function serviceFromRoute(route: string): string {
  const match = /^\/api\/([^/]+)/.exec(route);
  if (!match) return 'web';
  const segment = match[1];
  if (segment === 'admin') {
    const sub = /^\/api\/admin\/([^/]+)/.exec(route);
    return sub ? `admin:${sub[1]}` : 'admin';
  }
  return segment;
}

/**
 * Middleware real: regista respostas com erro (>=400) e respostas lentas
 * (>=1000 ms). Não regista cada pedido bem-sucedido para não transformar a
 * tabela num duplicado do request_metrics.
 */
export function createSystemLogMiddleware(
  requestIdFrom: (request: Request) => string,
): RequestHandler {
  return (request, response, next) => {
    const startedAt = performance.now();
    response.on('finish', () => {
      const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      if (response.statusCode < 400 && durationMs < 1000) return;
      const route = (request.route?.path as string | undefined) || request.path || '/';
      // O middleware de observabilidade já definiu X-Request-Id no início do
      // pedido. Reutilizar o valor do header garante correlação com a resposta
      // entregue ao cliente (nunca um UUID novo por chamada).
      const responseRequestId = response.getHeader('X-Request-Id');
      const requestId = typeof responseRequestId === 'string' && responseRequestId
        ? responseRequestId
        : requestIdFrom(request);
      void recordSystemLog({
        level: response.statusCode >= 500 ? 'error' : 'warn',
        service: serviceFromRoute(route),
        route,
        message: `${request.method} ${route} respondeu ${response.statusCode}`,
        context: {
          method: request.method,
          status: response.statusCode,
          durationMs,
          userAgent: (request.headers['user-agent'] || '').slice(0, 160),
        },
        requestId,
        traceId: requestId,
        statusCode: response.statusCode,
        durationMs,
      });
    });
    next();
  };
}
