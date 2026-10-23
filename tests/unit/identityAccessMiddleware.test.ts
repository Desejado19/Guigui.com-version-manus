import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  createSessionAccessMiddleware,
  type SessionAccessDependencies,
} from '../../server/modules/identity-access/http/sessionAccessMiddleware';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return { path: '/api/x', ...overrides } as unknown as Request;
}

function makeResponse() {
  const res: Record<string, unknown> = {};
  const status = vi.fn().mockReturnValue(res);
  const json = vi.fn().mockReturnValue(res);
  res.status = status;
  res.json = json;
  return { res: res as unknown as Response, status, json };
}

describe('createSessionAccessMiddleware', () => {
  const baseDeps: SessionAccessDependencies = {
    resolveContext: vi.fn().mockResolvedValue(null),
    requestIdFrom: () => 'rid-1',
    onAuthorizationDenied: vi.fn(),
  };

  it('sessionContext delegates to resolveContext', async () => {
    const resolveContext = vi.fn().mockResolvedValue({ userId: 'u1', role: 'business' });
    const { sessionContext } = createSessionAccessMiddleware({
      resolveContext,
      requestIdFrom: () => 'rid',
      onAuthorizationDenied: vi.fn(),
    });
    const req = makeRequest();
    await expect(sessionContext(req)).resolves.toEqual({ userId: 'u1', role: 'business' });
    expect(resolveContext).toHaveBeenCalledWith(req);
  });

  it('requireSession returns 401 when there is no session', async () => {
    const { requireSession } = createSessionAccessMiddleware(baseDeps);
    const { res, status, json } = makeResponse();
    const next = vi.fn();
    await requireSession(makeRequest(), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: 'Sessão autenticada necessária.',
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireSession calls next when there is a session', async () => {
    const deps = { ...baseDeps, resolveContext: vi.fn().mockResolvedValue({ userId: 'u1', role: 'user' }) };
    const { requireSession } = createSessionAccessMiddleware(deps);
    const { res, status, json } = makeResponse();
    const next = vi.fn();
    await requireSession(makeRequest(), res, next);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('forwards session-reader failures from requireSession to next', async () => {
    const failure = new Error('session store unavailable');
    const deps = { ...baseDeps, resolveContext: vi.fn().mockRejectedValue(failure) };
    const { requireSession } = createSessionAccessMiddleware(deps);
    const { res } = makeResponse();
    const next = vi.fn();

    await requireSession(makeRequest(), res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });

  it('requireRole returns 401 when there is no session', async () => {
    const { requireRole } = createSessionAccessMiddleware(baseDeps);
    const { res, status, json } = makeResponse();
    const next = vi.fn();
    await requireRole('admin')(makeRequest(), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole audits and returns 403 when role is missing', async () => {
    const onAuthorizationDenied = vi.fn();
    const deps: SessionAccessDependencies = {
      ...baseDeps,
      resolveContext: vi.fn().mockResolvedValue({ userId: 'u1', role: 'user' }),
      requestIdFrom: () => 'rid-1',
      onAuthorizationDenied,
    };
    const { requireRole } = createSessionAccessMiddleware(deps);
    const { res, status, json } = makeResponse();
    const next = vi.fn();
    await requireRole('admin')(makeRequest(), res, next);
    expect(onAuthorizationDenied).toHaveBeenCalledWith({
      resource: '/api/x',
      actorRole: 'citizen',
      requestId: 'rid-1',
      requiredRoles: ['admin'],
    });
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: 'Não possui permissão para esta operação.',
      code: 'PERMISSION_DENIED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole calls next when role matches any allowed role', async () => {
    const deps = { ...baseDeps, resolveContext: vi.fn().mockResolvedValue({ userId: 'u1', role: 'admin' }) };
    const { requireRole } = createSessionAccessMiddleware(deps);
    const { res, status, json } = makeResponse();
    const next = vi.fn();
    await requireRole('admin', 'business')(makeRequest(), res, next);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('forwards session-reader failures from requireRole to next', async () => {
    const failure = new Error('session store unavailable');
    const deps = { ...baseDeps, resolveContext: vi.fn().mockRejectedValue(failure) };
    const { requireRole } = createSessionAccessMiddleware(deps);
    const { res } = makeResponse();
    const next = vi.fn();

    await requireRole('admin')(makeRequest(), res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
