import express, { Router, type Request, type RequestHandler, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { SessionContext, SessionRole } from './modules/identity-access/application/resolveSessionContext';
import { databasePool } from './db';
import {
  StoryError,
  answerStoryQuestion,
  createHighlight,
  createStory,
  deleteHighlight,
  getGlobalStoryStats,
  getPublicStoryByToken,
  getStory,
  getStoryStats,
  listHighlights,
  listModerationStories,
  listMyStories,
  listPublicStories,
  listStoryReports,
  markStoryViewed,
  moderateStory,
  removeStory,
  removeStoryFromHighlight,
  replyToStory,
  reportStory,
  resolveStoryReport,
  setStoryLike,
  setStoryReaction,
  updateHighlight,
  updateStory,
  voteStoryPoll,
  addStoryToHighlight,
  type StoryActor,
} from './storyService';

const ASSET_DIRECTORY = path.join(process.cwd(), 'public', 'uploads', 'stories');

type MediaRule = { kind: 'image' | 'video'; extension: string; maxBytes: number };

const MEDIA_TYPES: Record<string, MediaRule> = {
  'image/jpeg': { kind: 'image', extension: 'jpg', maxBytes: 10 * 1024 * 1024 },
  'image/png': { kind: 'image', extension: 'png', maxBytes: 10 * 1024 * 1024 },
  'image/webp': { kind: 'image', extension: 'webp', maxBytes: 10 * 1024 * 1024 },
  'image/gif': { kind: 'image', extension: 'gif', maxBytes: 10 * 1024 * 1024 },
  'video/mp4': { kind: 'video', extension: 'mp4', maxBytes: 48 * 1024 * 1024 },
  'video/quicktime': { kind: 'video', extension: 'mov', maxBytes: 48 * 1024 * 1024 },
  'video/webm': { kind: 'video', extension: 'webm', maxBytes: 48 * 1024 * 1024 },
};

export interface StoryRouteDependencies {
  sessionContext(request: Request): Promise<SessionContext | null>;
  requireSession: RequestHandler;
  requireRole(...roles: SessionRole[]): RequestHandler;
  logger: Pick<Console, 'error' | 'warn'>;
}

function hasMagicBytes(contentType: string, buffer: Buffer): boolean {
  const startsWith = (bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  switch (contentType) {
    case 'image/jpeg': return startsWith([0xff, 0xd8, 0xff]);
    case 'image/png': return startsWith([0x89, 0x50, 0x4e, 0x47]);
    case 'image/gif': return buffer.subarray(0, 3).toString('ascii') === 'GIF';
    case 'image/webp':
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'video/webm': return startsWith([0x1a, 0x45, 0xdf, 0xa3]);
    case 'video/mp4':
    case 'video/quicktime':
      return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    default: return false;
  }
}

async function resolveActor(context: SessionContext): Promise<StoryActor> {
  if (!databasePool) throw new StoryError(503, 'DATABASE_UNAVAILABLE', 'Base de dados indisponível.');
  const user = await databasePool.query('SELECT id,name,avatar_url FROM users WHERE id=$1', [context.userId]);
  if (!user.rowCount) throw new StoryError(401, 'SESSION_INVALID', 'Sessão inválida. Inicie sessão novamente.');
  const row = user.rows[0] as { id: string; name: string; avatar_url: string | null };
  const actor: StoryActor = {
    userId: row.id,
    role: context.role,
    name: row.name || '',
    avatarUrl: row.avatar_url || undefined,
  };
  if (context.role === 'business') {
    const membership = await databasePool.query(
      `SELECT c.id, c.name, c.data, cm.permissions
         FROM company_members cm
         JOIN companies c ON c.id = cm.company_id
        WHERE cm.user_id=$1
        ORDER BY cm.accepted_at DESC NULLS LAST
        LIMIT 1`,
      [context.userId],
    );
    const company = membership.rows[0] as { id: string; name: string; data: Record<string, any> | null; permissions: Record<string, unknown> | null } | undefined;
    if (!company) throw new StoryError(403, 'STORY_BUSINESS_REQUIRED', 'A conta não está associada a nenhuma empresa.');
    actor.businessId = company.id;
    actor.businessName = company.name;
    const logo = typeof company.data?.logoUrl === 'string' ? company.data.logoUrl : typeof company.data?.logo === 'string' ? company.data.logo : '';
    if (logo) actor.avatarUrl = logo;
    if (company.permissions && typeof company.permissions.content === 'boolean') {
      actor.teamPermissions = { content: company.permissions.content };
    }
  }
  return actor;
}

export function createStoryRouter(dependencies: StoryRouteDependencies): Router {
  const router = Router();
  const { sessionContext, requireSession, requireRole, logger } = dependencies;

  const handle = (operation: (request: Request, response: Response) => Promise<void>): RequestHandler =>
    async (request, response) => {
      try {
        await operation(request, response);
      } catch (error) {
        if (error instanceof StoryError) {
          response.status(error.status).json({ error: error.message, code: error.code });
          return;
        }
        logger.error('[Guigui.com] stories request failed:', error);
        response.status(500).json({
          error: 'Não foi possível concluir a operação de Stories.',
          code: 'STORY_OPERATION_FAILED',
        });
      }
    };

  const actorFrom = async (request: Request): Promise<StoryActor> => {
    const context = await sessionContext(request);
    if (!context) throw new StoryError(401, 'AUTHENTICATION_REQUIRED', 'Sessão autenticada necessária.');
    return resolveActor(context);
  };

  const optionalViewerId = async (request: Request): Promise<string | undefined> => {
    const context = await sessionContext(request);
    return context?.userId;
  };

  const text = (value: unknown): string => (typeof value === 'string' ? value : '');

  router.post(
    '/stories/assets',
    requireSession,
    express.raw({ type: Object.keys(MEDIA_TYPES), limit: '48mb' }),
    handle(async (request, response) => {
      const contentType = (request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const rule = MEDIA_TYPES[contentType];
      if (!rule) {
        throw new StoryError(415, 'STORY_ASSET_TYPE_UNSUPPORTED', 'Formato não suportado. Usa JPEG, PNG, WebP, GIF, MP4, MOV ou WebM.');
      }
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      if (!body.length) throw new StoryError(400, 'STORY_ASSET_EMPTY', 'Nenhum ficheiro recebido.');
      if (body.length > rule.maxBytes) {
        throw new StoryError(
          413,
          'STORY_ASSET_TOO_LARGE',
          rule.kind === 'image' ? 'A fotografia não pode exceder 10 MB.' : 'O vídeo não pode exceder 48 MB.',
        );
      }
      if (!hasMagicBytes(contentType, body)) {
        throw new StoryError(415, 'STORY_ASSET_INVALID', 'O ficheiro enviado não corresponde a uma fotografia ou vídeo válido.');
      }
      if (!existsSync(ASSET_DIRECTORY)) mkdirSync(ASSET_DIRECTORY, { recursive: true });
      const filename = `${randomUUID()}.${rule.extension}`;
      writeFileSync(path.join(ASSET_DIRECTORY, filename), body);
      response.status(201).json({ url: `/uploads/stories/${filename}`, kind: rule.kind });
    }),
  );

  router.get('/stories', handle(async (request, response) => {
    response.json({ stories: await listPublicStories(await optionalViewerId(request)) });
  }));

  router.get('/stories/mine', requireSession, handle(async (request, response) => {
    const scope = ['all', 'active', 'archive', 'drafts'].includes(text(request.query.scope))
      ? (text(request.query.scope) as 'all' | 'active' | 'archive' | 'drafts')
      : 'all';
    response.json({ stories: await listMyStories(await actorFrom(request), scope) });
  }));

  router.get('/stories/share/:token', handle(async (request, response) => {
    const story = await getPublicStoryByToken(text(request.params.token));
    if (!story) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
    response.json({ story });
  }));

  router.get('/stories/:id', handle(async (request, response) => {
    const story = await getStory(text(request.params.id), await optionalViewerId(request));
    if (!story) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
    response.json({ story });
  }));

  router.post('/stories', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    const story = await createStory(await actorFrom(request), { ...request.body, publish: request.body?.publish !== false });
    response.status(201).json({ story });
  }));

  router.patch('/stories/:id', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    const story = await updateStory(await actorFrom(request), text(request.params.id), request.body || {});
    response.json({ story });
  }));

  router.delete('/stories/:id', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    await removeStory(await actorFrom(request), text(request.params.id));
    response.json({ success: true });
  }));

  router.post('/stories/:id/view', requireSession, handle(async (request, response) => {
    response.json(await markStoryViewed(await actorFrom(request), text(request.params.id)));
  }));

  router.post('/stories/:id/like', requireSession, handle(async (request, response) => {
    response.json(await setStoryLike(await actorFrom(request), text(request.params.id), request.body?.liked !== false));
  }));

  router.post('/stories/:id/reaction', requireSession, handle(async (request, response) => {
    response.json(await setStoryReaction(await actorFrom(request), text(request.params.id), text(request.body?.emoji)));
  }));

  router.post('/stories/:id/reply', requireSession, handle(async (request, response) => {
    response.json(await replyToStory(await actorFrom(request), text(request.params.id), text(request.body?.text)));
  }));

  router.post('/stories/:id/poll-vote', requireSession, handle(async (request, response) => {
    response.json(await voteStoryPoll(
      await actorFrom(request),
      text(request.params.id),
      text(request.body?.elementId),
      Number(request.body?.optionIndex),
    ));
  }));

  router.post('/stories/:id/question-answer', requireSession, handle(async (request, response) => {
    response.json(await answerStoryQuestion(
      await actorFrom(request),
      text(request.params.id),
      text(request.body?.elementId),
      text(request.body?.response),
    ));
  }));

  router.post('/stories/:id/report', requireSession, handle(async (request, response) => {
    response.json(await reportStory(
      await actorFrom(request),
      text(request.params.id),
      text(request.body?.reason),
      typeof request.body?.details === 'string' ? request.body.details : undefined,
    ));
  }));

  router.get('/stories/:id/stats', requireSession, handle(async (request, response) => {
    response.json(await getStoryStats(await actorFrom(request), text(request.params.id)));
  }));

  router.get('/story-highlights', handle(async (request, response) => {
    const businessId = text(request.query.businessId) || undefined;
    response.json({ highlights: await listHighlights(businessId) });
  }));

  router.post('/story-highlights', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    const highlight = await createHighlight(await actorFrom(request), request.body || {});
    response.status(201).json({ highlight });
  }));

  router.patch('/story-highlights/:id', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    await updateHighlight(await actorFrom(request), text(request.params.id), request.body || {});
    response.json({ success: true });
  }));

  router.delete('/story-highlights/:id', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    await deleteHighlight(await actorFrom(request), text(request.params.id));
    response.json({ success: true });
  }));

  router.post('/story-highlights/:id/items', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    await addStoryToHighlight(await actorFrom(request), text(request.params.id), text(request.body?.storyId));
    response.json({ success: true });
  }));

  router.delete('/story-highlights/:id/items/:storyId', requireSession, requireRole('business', 'admin'), handle(async (request, response) => {
    await removeStoryFromHighlight(await actorFrom(request), text(request.params.id), text(request.params.storyId));
    response.json({ success: true });
  }));

  router.get('/admin/stories', requireRole('admin'), handle(async (request, response) => {
    const context = await sessionContext(request);
    if (!context) throw new StoryError(401, 'AUTHENTICATION_REQUIRED', 'Sessão autenticada necessária.');
    response.json({
      stories: await listModerationStories(context.userId, {
        status: text(request.query.status) || undefined,
        query: text(request.query.q) || undefined,
      }),
    });
  }));

  router.get('/admin/story-reports', requireRole('admin'), handle(async (request, response) => {
    const context = await sessionContext(request);
    if (!context) throw new StoryError(401, 'AUTHENTICATION_REQUIRED', 'Sessão autenticada necessária.');
    response.json({ reports: await listStoryReports(context.userId, text(request.query.status) || 'all') });
  }));

  router.post('/admin/story-reports/:id/resolve', requireRole('admin'), handle(async (request, response) => {
    const context = await sessionContext(request);
    if (!context) throw new StoryError(401, 'AUTHENTICATION_REQUIRED', 'Sessão autenticada necessária.');
    await resolveStoryReport(context.userId, text(request.params.id), text(request.body?.status), text(request.body?.resolution) || undefined);
    response.json({ success: true });
  }));

  router.post('/admin/stories/:id/moderate', requireRole('admin'), handle(async (request, response) => {
    const context = await sessionContext(request);
    if (!context) throw new StoryError(401, 'AUTHENTICATION_REQUIRED', 'Sessão autenticada necessária.');
    const story = await moderateStory(context.userId, text(request.params.id), text(request.body?.action), text(request.body?.reason) || undefined);
    response.json({ story });
  }));

  router.get('/admin/story-stats', requireRole('admin'), handle(async (request, response) => {
    const context = await sessionContext(request);
    if (!context) throw new StoryError(401, 'AUTHENTICATION_REQUIRED', 'Sessão autenticada necessária.');
    response.json(await getGlobalStoryStats(context.userId));
  }));

  return router;
}
