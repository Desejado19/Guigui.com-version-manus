import express, { type ErrorRequestHandler, type Express } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import type { SessionContext } from '../../server/modules/identity-access/application/resolveSessionContext';
import {
  createSessionAccessMiddleware,
  type SessionAccessDependencies,
} from '../../server/modules/identity-access/http/sessionAccessMiddleware';

async function withServer(app: Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function dependencies(
  context: SessionContext | null,
  onAuthorizationDenied: SessionAccessDependencies['onAuthorizationDenied'] = vi.fn(),
): SessionAccessDependencies {
  return {
    resolveContext: vi.fn().mockResolvedValue(context),
    requestIdFrom: vi.fn().mockReturnValue('request-123'),
    onAuthorizationDenied,
  };
}

describe('createSessionAccessMiddleware', () => {
  it('returns the resolved context for a valid request', async () => {
    const access = createSessionAccessMiddleware(dependencies({ userId: 'user-1', role: 'business' }));
    const app = express();
    app.get('/context', (req, res, next) => {
      void access.sessionContext(req).then((context) => res.json(context)).catch(next);
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/context`);
      await expect(response.json()).resolves.toEqual({ userId: 'user-1', role: 'business' });
    });
  });

  it('requires a session and returns the established 401 response', async () => {
    const access = createSessionAccessMiddleware(dependencies(null));
    const app = express();
    app.get('/protected', access.requireSession, (_req, res) => res.sendStatus(204));

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/protected`);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: 'Sessão autenticada necessária.',
        code: 'AUTHENTICATION_REQUIRED',
      });
    });
  });

  it('allows a request when its session has a required role', async () => {
    const access = createSessionAccessMiddleware(dependencies({ userId: 'admin-1', role: 'admin' }));
    const app = express();
    app.get('/protected', access.requireRole('admin'), (_req, res) => res.sendStatus(204));

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/protected`);
      expect(response.status).toBe(204);
    });
  });

  it('denies a valid session with the established 403 response', async () => {
    const access = createSessionAccessMiddleware(dependencies({ userId: 'user-1', role: 'user' }));
    const app = express();
    app.get('/admin', access.requireRole('admin'), (_req, res) => res.sendStatus(204));

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/admin`);
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: 'Não possui permissão para esta operação.',
        code: 'PERMISSION_DENIED',
      });
    });
  });

  it('records the current authorization-denial audit fields', async () => {
    const onAuthorizationDenied = vi.fn();
    const access = createSessionAccessMiddleware(
      dependencies({ userId: 'user-1', role: 'user' }, onAuthorizationDenied),
    );
    const app = express();
    app.get('/admin', access.requireRole('admin'), (_req, res) => res.sendStatus(204));

    await withServer(app, async (baseUrl) => {
      await fetch(`${baseUrl}/admin`);
    });

    expect(onAuthorizationDenied).toHaveBeenCalledWith({
      resource: '/admin',
      actorRole: 'citizen',
      requestId: 'request-123',
      requiredRoles: ['admin'],
    });
  });

  it('forwards a session-reader failure to next', async () => {
    const error = new Error('session store unavailable');
    const app = express();
    const access = createSessionAccessMiddleware({
      ...dependencies(null),
      resolveContext: vi.fn().mockRejectedValue(error),
    });
    let forwardedError: unknown;
    const errorHandler: ErrorRequestHandler = (receivedError, _req, res, _next) => {
      forwardedError = receivedError;
      res.sendStatus(500);
    };
    app.get('/protected', access.requireSession, (_req, res) => res.sendStatus(204));
    app.use(errorHandler);

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/protected`);
      expect(response.status).toBe(500);
    });

    expect(forwardedError).toBe(error);
  });
});
