import type { Request, RequestHandler } from 'express';
import type { SessionContext, SessionRole } from '../application/resolveSessionContext';

export type AuthorizationDeniedAudit = {
  resource: string;
  actorRole: 'citizen' | 'business' | 'admin';
  requestId: string;
  requiredRoles: SessionRole[];
};

export type SessionAccessDependencies = {
  resolveContext(request: Request): Promise<SessionContext | null>;
  requestIdFrom(request: Request): string;
  onAuthorizationDenied(audit: AuthorizationDeniedAudit): void;
};

export function createSessionAccessMiddleware(
  dependencies: SessionAccessDependencies,
): {
  sessionContext(request: Request): Promise<SessionContext | null>;
  requireSession: RequestHandler;
  requireRole(...roles: SessionRole[]): RequestHandler;
} {
  const { resolveContext, requestIdFrom, onAuthorizationDenied } = dependencies;

  async function sessionContext(request: Request): Promise<SessionContext | null> {
    return resolveContext(request);
  }

  const requireSession: RequestHandler = async (req, res, next) => {
    if (!(await sessionContext(req))) {
      return res.status(401).json({
        error: 'Sessão autenticada necessária.',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }
    next();
  };

  function requireRole(...roles: SessionRole[]): RequestHandler {
    return async (req, res, next) => {
      const context = await sessionContext(req);
      if (!context) {
        return res.status(401).json({
          error: 'Sessão autenticada necessária.',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }
      if (!roles.includes(context.role)) {
        onAuthorizationDenied({
          resource: req.path,
          actorRole: context.role === 'user' ? 'citizen' : context.role,
          requestId: requestIdFrom(req),
          requiredRoles: roles,
        });
        return res.status(403).json({
          error: 'Não possui permissão para esta operação.',
          code: 'PERMISSION_DENIED',
        });
      }
      next();
    };
  }

  return { sessionContext, requireSession, requireRole };
}
