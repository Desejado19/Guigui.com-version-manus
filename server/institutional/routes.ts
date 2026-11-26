import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import type { Pool } from 'pg';
import {
  PROFILE_FIELDS,
  PURPOSE_FIELDS,
  SECTION_FIELDS,
  SEO_FIELDS,
  ENTITY_SPECS,
  buildSnapshot,
  describeValidationErrors,
  findMissingContent,
  isDocumentDirty,
  isEntityKind,
  isSectionKey,
  toPublicSnapshot,
  validateFields,
  type EntityKind,
  type InstitutionalSnapshot,
} from './model';
import { createInstitutionalRepository } from './repository';

export interface InstitutionalRouteDeps {
  getPool: () => Pool | null;
  requireAdmin: RequestHandler;
  userIdFrom: (req: Request) => Promise<string | null>;
}

const UPLOAD_DIRECTORY = path.join('public', 'uploads', 'institutional');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

type UploadKind = 'image' | 'document';

interface UploadFormat {
  extension: string;
  contentType: string;
  magic: Buffer;
  offset?: number;
}

const UPLOAD_FORMATS: Record<UploadKind, UploadFormat[]> = {
  image: [
    { extension: 'png', contentType: 'image/png', magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    { extension: 'jpg', contentType: 'image/jpeg', magic: Buffer.from([0xff, 0xd8, 0xff]) },
    {
      extension: 'webp',
      contentType: 'image/webp',
      magic: Buffer.from('WEBP'),
      offset: 8,
    },
  ],
  document: [{ extension: 'pdf', contentType: 'application/pdf', magic: Buffer.from('%PDF') }],
};

function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
}

function detectFormat(kind: UploadKind, buffer: Buffer): UploadFormat | null {
  return (
    UPLOAD_FORMATS[kind].find((format) => {
      const offset = format.offset ?? 0;
      return buffer.subarray(offset, offset + format.magic.length).equals(format.magic);
    }) ?? null
  );
}

function readVisibleFlag(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return value === true || value === 'true';
}

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  siteName: string;
  type?: 'website' | 'article';
  image?: string;
  noIndex?: boolean;
}

function escapeMeta(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Substitui título, descrição, canónica e Open Graph do shell da SPA.
 * Os metadados do `index.html` são globais; sem os remover, cada página ficaria
 * com dois títulos e duas descrições no HTML inicial.
 */
function applyPageMeta(html: string, meta: PageMeta): string {
  const tags = [
    `<title>${escapeMeta(meta.title)}</title>`,
    `<meta name="description" content="${escapeMeta(meta.description)}" />`,
    `<link rel="canonical" href="${escapeMeta(meta.canonical)}" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:title" content="${escapeMeta(meta.title)}" />`,
    `<meta property="og:description" content="${escapeMeta(meta.description)}" />`,
    `<meta property="og:url" content="${escapeMeta(meta.canonical)}" />`,
    `<meta property="og:site_name" content="${escapeMeta(meta.siteName)}" />`,
    ...(meta.image ? [`<meta property="og:image" content="${escapeMeta(meta.image)}" />`] : []),
    ...(meta.noIndex ? ['<meta name="robots" content="noindex" />'] : []),
  ].join('\n    ');

  const stripped = html
    .replace(/<meta name="description"[^>]*>\s*/g, '')
    .replace(/<meta name="robots"[^>]*>\s*/g, '')
    .replace(/<link rel="canonical"[^>]*>\s*/g, '')
    .replace(/<meta property="og:[^>]*>\s*/g, '');

  return stripped.replace(/<title>[\s\S]*?<\/title>/, tags);
}

/** Injeta os metadados institucionais no HTML da SPA (rota /sobre-nos). */
export function injectInstitutionalMeta(
  html: string,
  snapshot: InstitutionalSnapshot | null,
  origin: string,
): string {
  if (!snapshot) return html;
  const profile = snapshot.profile ?? {};
  const seo = snapshot.seo ?? {};
  const siteName = String(profile.official_name || 'Guigui.com');

  return applyPageMeta(html, {
    title: String(seo.seo_title || `${siteName} — Sobre Nós`),
    description: String(seo.meta_description || profile.short_description || ''),
    canonical: String(seo.canonical_url || `${origin.replace(/\/+$/, '')}/sobre-nos`),
    image: String(seo.og_image_url || profile.share_image_url || ''),
    siteName,
    noIndex: seo.no_index === true,
  });
}

function summariseDocument(document: Record<string, unknown>): string {
  const description = String(document.description ?? '').trim();
  if (description) return description;
  const content = String(document.content ?? '').replace(/\s+/g, ' ').trim();
  return content.length > 155 ? `${content.slice(0, 152).trimEnd()}…` : content;
}

/**
 * Metadados de `/politicas` e `/politicas/:slug`.
 *
 * Lê sempre a publicação activa e aplica as mesmas regras da API pública
 * (`toPublicSnapshot`): documentos em rascunho ou arquivo nunca produzem
 * metadados próprios nem ficam indexáveis.
 */
export function injectPolicyMeta(
  html: string,
  snapshot: InstitutionalSnapshot | null,
  slug: string | undefined,
  origin: string,
): string {
  const base = origin.replace(/\/+$/, '');
  const visible = snapshot ? toPublicSnapshot(snapshot) : null;
  const profile = visible?.profile ?? {};
  const seo = visible?.seo ?? {};
  const siteName = String(profile.official_name || 'Guigui.com');
  const image = String(seo.og_image_url || profile.share_image_url || '');
  const documents = visible?.entities?.documents ?? [];
  const document = slug
    ? documents.find((item) => (String(item.slug ?? '') === slug) || String(item.id) === slug)
    : undefined;

  if (!document) {
    return applyPageMeta(html, {
      title: `Políticas e documentos legais — ${siteName}`,
      description: slug
        ? 'Este documento não existe ou ainda não foi publicado.'
        : 'Documentos oficiais publicados pelo Guigui.com. Só aparecem versões publicadas.',
      canonical: `${base}/politicas${slug ? `/${encodeURIComponent(slug)}` : ''}`,
      siteName,
      image,
      // Um slug desconhecido não deve competir nos motores de busca com a
      // página publicada correspondente.
      noIndex: Boolean(slug) || seo.no_index === true,
    });
  }

  const name = String(document.name ?? 'Documento');
  const version = String(document.version ?? '').trim();
  return applyPageMeta(html, {
    title: `${name}${version ? ` (v${version})` : ''} — ${siteName}`,
    description: summariseDocument(document) || `Documento oficial publicado pelo ${siteName}.`,
    canonical: `${base}/politicas/${encodeURIComponent(String(document.slug || document.id))}`,
    siteName,
    type: 'article',
    image,
    noIndex: seo.no_index === true,
  });
}

export function registerInstitutionalRoutes(app: Express, deps: InstitutionalRouteDeps): void {
  const admin = deps.requireAdmin;

  const withPool = async (
    res: Response,
    handler: (pool: Pool) => Promise<void>,
  ): Promise<void> => {
    const pool = deps.getPool();
    if (!pool) {
      res.status(503).json({
        error: 'A base de dados PostgreSQL é necessária para o módulo Sobre Nós.',
        code: 'DATABASE_REQUIRED',
      });
      return;
    }
    try {
      await handler(pool);
    } catch (error) {
      console.error('[Guigui.com] institutional request failed:', error);
      res.status(500).json({
        error: 'Não foi possível concluir a operação institucional.',
        code: 'INSTITUTIONAL_REQUEST_FAILED',
      });
    }
  };

  app.get('/api/institutional', async (req, res) => {
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const release = await repository.latestRelease();
      if (!release) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(404).json({
          error: 'A página institucional ainda não foi publicada.',
          code: 'INSTITUTIONAL_NOT_PUBLISHED',
        });
        return;
      }
      const etag = `W/"institutional-${release.id}"`;
      // `no-cache` permite revalidar por ETag: despublicar reflecte-se logo.
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('ETag', etag);
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
      res.json({
        data: toPublicSnapshot(release.snapshot),
        publishedAt: release.publishedAt,
        releaseId: release.id,
      });
    });
  });

  app.get('/api/admin/institutional', admin, async (req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const [document, latest, releases] = await Promise.all([
        repository.readDocument(),
        repository.latestRelease(),
        repository.listReleases(10),
      ]);
      const snapshot = buildSnapshot(document);
      const missing = findMissingContent(document);
      const userId = await deps.userIdFrom(req);
      res.json({
        document,
        snapshot,
        meta: {
          lastPublishedAt: latest?.publishedAt ?? null,
          lastPublishedBy: latest?.publishedBy ?? null,
          lastReleaseId: latest?.id ?? null,
          isDirty: isDocumentDirty(snapshot, latest?.snapshot ?? null),
          missing,
          canPublish: missing.length === 0,
          published: latest !== null,
          releases,
        },
        loadedBy: userId,
      });
    });
  });

  app.get('/api/admin/institutional/preview', admin, async (_req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const document = await repository.readDocument();
      res.json({
        data: toPublicSnapshot(buildSnapshot(document)),
        missing: findMissingContent(document),
        preview: true,
      });
    });
  });

  app.put('/api/admin/institutional/profile', admin, async (req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const { value, errors } = validateFields(PROFILE_FIELDS, req.body ?? {});
      if (Object.keys(errors).length > 0) {
        res.status(400).json({
          error: describeValidationErrors(errors),
          code: 'INVALID_INSTITUTIONAL_FIELD',
          fieldErrors: errors,
        });
        return;
      }
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      await repository.saveProfile(
        Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? '')])),
        userId,
      );
      await repository.audit({ entity: 'profile', action: 'edit', changedBy: userId });
      res.json({ success: true });
    });
  });

  app.put('/api/admin/institutional/purpose', admin, async (req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const { value, errors } = validateFields(PURPOSE_FIELDS, req.body ?? {});
      if (Object.keys(errors).length > 0) {
        res.status(400).json({
          error: describeValidationErrors(errors),
          code: 'INVALID_INSTITUTIONAL_FIELD',
          fieldErrors: errors,
        });
        return;
      }
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      await repository.savePurpose(
        Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? '')])),
        userId,
      );
      await repository.audit({ entity: 'purpose', action: 'edit', changedBy: userId });
      res.json({ success: true });
    });
  });

  app.put('/api/admin/institutional/seo', admin, async (req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { value, errors } = validateFields(SEO_FIELDS, body);
      if (typeof body.no_index === 'boolean') value.no_index = body.no_index;
      if (Object.keys(errors).length > 0) {
        res.status(400).json({
          error: describeValidationErrors(errors),
          code: 'INVALID_INSTITUTIONAL_FIELD',
          fieldErrors: errors,
        });
        return;
      }
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      await repository.saveSeo(value);
      await repository.audit({ entity: 'seo', action: 'edit', changedBy: userId });
      res.json({ success: true });
    });
  });

  app.put('/api/admin/institutional/about/:key', admin, async (req, res) => {
    noStore(res);
    const key = req.params.key;
    if (!isSectionKey(key)) {
      res.status(404).json({ error: 'Secção institucional desconhecida.', code: 'SECTION_NOT_FOUND' });
      return;
    }
    await withPool(res, async (pool) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { value, errors } = validateFields(SECTION_FIELDS, body);
      if (Object.keys(errors).length > 0) {
        res.status(400).json({
          error: describeValidationErrors(errors),
          code: 'INVALID_INSTITUTIONAL_FIELD',
          fieldErrors: errors,
        });
        return;
      }
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      await repository.saveSection(key, {
        title: String(value.title ?? ''),
        body: String(value.body ?? ''),
        imageUrl: String(value.image_url ?? ''),
        isVisible: readVisibleFlag(body.isVisible),
      });
      await repository.audit({ entity: 'about', entityId: key, action: 'edit', changedBy: userId });
      res.json({ success: true });
    });
  });

  const entityKindFrom = (value: string): EntityKind | null => (isEntityKind(value) ? value : null);

  app.post('/api/admin/institutional/entities/:kind', admin, async (req, res) => {
    noStore(res);
    const kind = entityKindFrom(req.params.kind);
    if (!kind) {
      res.status(404).json({ error: 'Submódulo desconhecido.', code: 'ENTITY_NOT_FOUND' });
      return;
    }
    await withPool(res, async (pool) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { value, errors } = validateFields(ENTITY_SPECS[kind].fields, body);
      if (Object.keys(errors).length > 0) {
        res.status(400).json({
          error: describeValidationErrors(errors),
          code: 'INVALID_INSTITUTIONAL_FIELD',
          fieldErrors: errors,
        });
        return;
      }
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      const row = await repository.createEntity(
        kind,
        Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? '')])),
        readVisibleFlag(body.isVisible),
      );
      if (kind === 'documents') {
        await repository.recordDocumentVersion(row.id, value, userId);
      }
      await repository.audit({
        entity: kind,
        entityId: row.id,
        action: 'create',
        changedBy: userId,
      });
      res.status(201).json({ item: row });
    });
  });

  app.put('/api/admin/institutional/entities/:kind/:id', admin, async (req, res) => {
    noStore(res);
    const kind = entityKindFrom(req.params.kind);
    const id = Number(req.params.id);
    if (!kind || !Number.isInteger(id) || id <= 0) {
      res.status(404).json({ error: 'Registo desconhecido.', code: 'ENTITY_NOT_FOUND' });
      return;
    }
    await withPool(res, async (pool) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { value, errors } = validateFields(ENTITY_SPECS[kind].fields, body);
      if (Object.keys(errors).length > 0) {
        res.status(400).json({
          error: describeValidationErrors(errors),
          code: 'INVALID_INSTITUTIONAL_FIELD',
          fieldErrors: errors,
        });
        return;
      }
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      const row = await repository.updateEntity(
        kind,
        id,
        Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? '')])),
        readVisibleFlag(body.isVisible),
      );
      if (!row) {
        res.status(404).json({ error: 'Registo não encontrado.', code: 'ENTITY_NOT_FOUND' });
        return;
      }
      if (kind === 'documents') {
        await repository.recordDocumentVersion(id, value, userId);
      }
      await repository.audit({ entity: kind, entityId: id, action: 'edit', changedBy: userId });
      res.json({ item: row });
    });
  });

  app.delete('/api/admin/institutional/entities/:kind/:id', admin, async (req, res) => {
    noStore(res);
    const kind = entityKindFrom(req.params.kind);
    const id = Number(req.params.id);
    if (!kind || !Number.isInteger(id) || id <= 0) {
      res.status(404).json({ error: 'Registo desconhecido.', code: 'ENTITY_NOT_FOUND' });
      return;
    }
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      const removed = await repository.deleteEntity(kind, id);
      if (!removed) {
        res.status(404).json({ error: 'Registo não encontrado.', code: 'ENTITY_NOT_FOUND' });
        return;
      }
      await repository.audit({ entity: kind, entityId: id, action: 'delete', changedBy: userId });
      res.json({ success: true });
    });
  });

  app.post('/api/admin/institutional/entities/:kind/reorder', admin, async (req, res) => {
    noStore(res);
    const kind = entityKindFrom(req.params.kind);
    if (!kind) {
      res.status(404).json({ error: 'Submódulo desconhecido.', code: 'ENTITY_NOT_FOUND' });
      return;
    }
    const ids = Array.isArray((req.body ?? {}).ids)
      ? ((req.body as { ids: unknown[] }).ids as unknown[])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];
    if (ids.length === 0) {
      res.status(400).json({ error: 'Ordem inválida.', code: 'INVALID_INSTITUTIONAL_ORDER' });
      return;
    }
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      await repository.reorderEntities(kind, ids);
      await repository.audit({ entity: kind, action: 'reorder', changedBy: userId });
      res.json({ success: true });
    });
  });

  app.get('/api/admin/institutional/releases', admin, async (_req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      res.json({ releases: await repository.listReleases(20) });
    });
  });

  app.get('/api/admin/institutional/documents/:id/versions', admin, async (req, res) => {
    noStore(res);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Documento inválido.', code: 'INVALID_INSTITUTIONAL_FIELD' });
      return;
    }
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      res.json({ versions: await repository.listDocumentVersions(id) });
    });
  });

  // Restaura uma versão anterior de um documento legal a partir do histórico.
  app.post(
    '/api/admin/institutional/documents/:id/versions/:versionId/restore',
    admin,
    async (req, res) => {
      noStore(res);
      const id = Number(req.params.id);
      const versionId = Number(req.params.versionId);
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(versionId) || versionId <= 0) {
        res.status(400).json({ error: 'Versão inválida.', code: 'INVALID_INSTITUTIONAL_VERSION' });
        return;
      }
      await withPool(res, async (pool) => {
        const repository = createInstitutionalRepository(pool);
        const userId = await deps.userIdFrom(req);
        const restored = await repository.restoreDocumentVersion(id, versionId, userId);
        if (!restored) {
          res.status(404).json({ error: 'Versão não encontrada para este documento.', code: 'ENTITY_NOT_FOUND' });
          return;
        }
        await repository.audit({
          entity: 'documents',
          entityId: id,
          action: 'restore_version',
          changedBy: userId,
          metadata: { versionId: restored.restoredFrom.id, version: restored.restoredFrom.version },
        });
        res.json({ success: true, item: restored.item, restoredFrom: restored.restoredFrom });
      });
    },
  );

  app.get('/api/admin/institutional/audit', admin, async (req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const entries = await repository.listAudit({
        entity: typeof req.query.entity === 'string' ? req.query.entity : undefined,
        action: typeof req.query.action === 'string' ? req.query.action : undefined,
        limit: Number(req.query.limit) || 100,
      });
      res.json({ entries });
    });
  });

  app.post('/api/admin/institutional/releases/:id/restore', admin, async (req, res) => {
    noStore(res);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Versão inválida.', code: 'INVALID_INSTITUTIONAL_VERSION' });
      return;
    }
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const release = await repository.getRelease(id);
      if (!release) {
        res.status(404).json({ error: 'Versão não encontrada.', code: 'INVALID_INSTITUTIONAL_VERSION' });
        return;
      }
      const userId = await deps.userIdFrom(req);
      await repository.restoreRelease(release.snapshot, userId);
      await repository.audit({
        entity: 'release',
        entityId: id,
        action: 'restore',
        changedBy: userId,
      });
      res.json({ success: true, restoredFrom: id });
    });
  });

  app.post('/api/admin/institutional/publish', admin, async (req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const document = await repository.readDocument();
      const missing = findMissingContent(document);
      if (missing.length > 0) {
        res.status(422).json({
          error: 'Complete o conteúdo obrigatório antes de publicar.',
          code: 'INSTITUTIONAL_INCOMPLETE',
          missing,
        });
        return;
      }
      const userId = await deps.userIdFrom(req);
      const release = await repository.publish(buildSnapshot(document), userId);
      await repository.audit({
        entity: 'release',
        entityId: release.id,
        action: 'publish',
        changedBy: userId,
      });
      res.json({ success: true, releaseId: release.id, publishedAt: release.publishedAt });
    });
  });

  // Despublica o site institucional sem apagar a release: o histórico fica
  // intacto e uma nova publicação volta a expor o conteúdo.
  app.post('/api/admin/institutional/unpublish', admin, async (req, res) => {
    noStore(res);
    await withPool(res, async (pool) => {
      const repository = createInstitutionalRepository(pool);
      const userId = await deps.userIdFrom(req);
      const withdrawn = await repository.unpublish(userId);
      await repository.audit({
        entity: 'release',
        entityId: withdrawn?.id ?? null,
        action: 'unpublish',
        changedBy: userId,
      });
      res.json({ success: true, withdrawnReleaseId: withdrawn?.id ?? null, published: false });
    });
  });

  app.post('/api/admin/institutional/uploads', admin, async (req, res) => {
    noStore(res);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kind: UploadKind = body.kind === 'document' ? 'document' : 'image';
    const data = typeof body.data === 'string' ? body.data.replace(/^data:[^;]+;base64,/, '') : '';
    if (!data) {
      res.status(400).json({ error: 'Ficheiro em falta.', code: 'UPLOAD_EMPTY' });
      return;
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(data, 'base64');
    } catch {
      res.status(400).json({ error: 'Ficheiro inválido.', code: 'UPLOAD_INVALID' });
      return;
    }
    const limit = kind === 'document' ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES;
    if (buffer.length === 0 || buffer.length > limit) {
      res.status(400).json({
        error: `O ficheiro excede o limite de ${Math.round(limit / (1024 * 1024))} MB.`,
        code: 'UPLOAD_TOO_LARGE',
      });
      return;
    }
    const format = detectFormat(kind, buffer);
    if (!format) {
      res.status(400).json({
        error:
          kind === 'document'
            ? 'Só são aceites documentos PDF.'
            : 'Só são aceites imagens PNG, JPEG ou WebP.',
        code: 'UPLOAD_UNSUPPORTED_TYPE',
      });
      return;
    }
    try {
      const directory = path.join(process.cwd(), UPLOAD_DIRECTORY);
      await fs.mkdir(directory, { recursive: true });
      const fileName = `${Date.now().toString(36)}-${randomUUID().replace(/-/g, '')}.${format.extension}`;
      await fs.writeFile(path.join(directory, fileName), buffer);
      res.status(201).json({
        url: `/uploads/institutional/${fileName}`,
        fileName,
        contentType: format.contentType,
        size: buffer.length,
      });
    } catch (error) {
      console.error('[Guigui.com] institutional upload failed:', error);
      res.status(500).json({ error: 'Não foi possível guardar o ficheiro.', code: 'UPLOAD_FAILED' });
    }
  });
}
