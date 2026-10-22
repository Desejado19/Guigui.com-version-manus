import type { Request, RequestHandler } from 'express';
import type {
  SessionContext,
  SessionRole,
} from '../application/resolveSessionContext';

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

export function createSessionAccessMiddleware(dependencies: SessionAccessDependencies): {
  sessionContext(request: Request): Promise<SessionContext | null>;
  requireSession: RequestHandler;
  requireRole(...roles: SessionRole[]): RequestHandler;
} {
  const sessionContext = (request: Request) => dependencies.resolveContext(request);

  const requireSession: RequestHandler = (req, res, next) => {
    void sessionContext(req).then((context) => {
      if (!context) {
        res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
        return;
      }
      next();
    }).catch(next);
  };

  const requireRole = (...roles: SessionRole[]): RequestHandler => (req, res, next) => {
    void sessionContext(req).then((context) => {
      if (!context) {
        res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
        return;
      }
      if (!roles.includes(context.role)) {
        dependencies.onAuthorizationDenied({
          resource: req.path,
          actorRole: context.role === 'user' ? 'citizen' : context.role,
          requestId: dependencies.requestIdFrom(req),
          requiredRoles: roles,
        });
        res.status(403).json({ error: 'Não possui permissão para esta operação.', code: 'PERMISSION_DENIED' });
        return;
      }
      next();
    }).catch(next);
  };

  return { sessionContext, requireSession, requireRole };
}
