import type { Pool, PoolClient } from 'pg';
import {
  ENTITY_KINDS,
  ENTITY_SPECS,
  INSTITUTIONAL_SLUG,
  PROFILE_FIELDS,
  PURPOSE_FIELDS,
  SECTION_FIELDS,
  SECTION_KEYS,
  SEO_FIELDS,
  type EntityKind,
  type EntityRow,
  type InstitutionalDocument,
  type InstitutionalSnapshot,
} from './model';

type DbRow = Record<string, unknown>;

function camelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function mapInstitutionalRow(row: DbRow): EntityRow {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'id' || key === 'position') mapped[key] = Number(value);
    else if (key === 'is_visible') mapped.isVisible = value !== false;
    else if (key === 'updated_at') {
      mapped.updatedAt = value ? new Date(String(value)).toISOString() : null;
    } else mapped[camelCase(key)] = value;
  }
  return mapped as EntityRow;
}

function asString(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function entityColumns(kind: EntityKind): string[] {
  return Object.keys(ENTITY_SPECS[kind].fields);
}

export interface ReleaseMeta {
  id: number;
  publishedAt: string;
  publishedBy: string | null;
  note: string;
}

export interface ReleaseSnapshot extends ReleaseMeta {
  snapshot: InstitutionalSnapshot;
}

export interface AuditEntry {
  id: number;
  entity: string;
  entityId: string | null;
  action: string;
  changedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InstitutionalRepository {
  readDocument(): Promise<InstitutionalDocument>;
  saveProfile(fields: Record<string, string>, updatedBy: string | null): Promise<void>;
  savePurpose(fields: Record<string, string>, updatedBy: string | null): Promise<void>;
  saveSeo(fields: Record<string, string | boolean>): Promise<void>;
  saveSection(
    key: string,
    fields: { title: string; body: string; imageUrl: string; isVisible: boolean },
  ): Promise<void>;
  createEntity(kind: EntityKind, fields: Record<string, string>, isVisible: boolean): Promise<EntityRow>;
  updateEntity(
    kind: EntityKind,
    id: number,
    fields: Record<string, string>,
    isVisible: boolean,
  ): Promise<EntityRow | null>;
  deleteEntity(kind: EntityKind, id: number): Promise<boolean>;
  reorderEntities(kind: EntityKind, ids: number[]): Promise<void>;
  publish(snapshot: InstitutionalSnapshot, publishedBy: string | null): Promise<ReleaseSnapshot>;
  latestRelease(): Promise<ReleaseSnapshot | null>;
  unpublish(withdrawnBy: string | null): Promise<ReleaseSnapshot | null>;
  isPublished(): Promise<boolean>;
  listReleases(limit?: number): Promise<ReleaseMeta[]>;
  getRelease(id: number): Promise<ReleaseSnapshot | null>;
  listAudit(filters?: { entity?: string; action?: string; limit?: number }): Promise<AuditEntry[]>;
  recordDocumentVersion(
    documentId: number,
    fields: { version?: unknown; content?: unknown; status?: unknown },
    changedBy: string | null,
  ): Promise<void>;
  listDocumentVersions(documentId: number): Promise<Array<{
    id: number;
    version: string;
    content: string;
    status: string;
    changedBy: string | null;
    createdAt: string;
  }>>;
  restoreDocumentVersion(
    documentId: number,
    versionId: number,
    changedBy: string | null,
  ): Promise<{ item: EntityRow; restoredFrom: { id: number; version: string } } | null>;
  restoreRelease(snapshot: InstitutionalSnapshot, changedBy: string | null): Promise<void>;
  audit(entry: {
    entity: string;
    entityId?: string | number | null;
    action: string;
    changedBy: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

function mapRelease(row: DbRow): ReleaseSnapshot {
  return {
    id: Number(row.id),
    publishedAt: new Date(String(row.published_at)).toISOString(),
    publishedBy: row.published_by ? String(row.published_by) : null,
    note: asString(row.note),
    snapshot: row.snapshot as InstitutionalSnapshot,
  };
}

export function createInstitutionalRepository(pool: Pool): InstitutionalRepository {
  const repo: InstitutionalRepository = {
    async readDocument() {
      const [profileRow, purposeRow, seoRow, sectionRows, ...entityResults] = await Promise.all([
        pool.query<DbRow>(`SELECT * FROM institutional_profiles WHERE slug = $1`, [INSTITUTIONAL_SLUG]),
        pool.query<DbRow>(`SELECT * FROM institutional_purpose WHERE id = 1`),
        pool.query<DbRow>(`SELECT * FROM institutional_seo WHERE id = 1`),
        pool.query<DbRow>(
          `SELECT * FROM institutional_about_sections ORDER BY position ASC, id ASC`,
        ),
        ...ENTITY_KINDS.map((kind) =>
          pool.query<DbRow>(
            `SELECT * FROM ${ENTITY_SPECS[kind].table} ORDER BY position ASC, id ASC`,
          ),
        ),
      ]);

      const profile = profileRow.rows[0] ?? {};
      const purpose = purposeRow.rows[0] ?? {};
      const seo = seoRow.rows[0] ?? {};

      const profileFields: Record<string, string> = {};
      for (const key of Object.keys(PROFILE_FIELDS)) profileFields[key] = asString(profile[key]);

      const purposeFields: Record<string, string> = {};
      for (const key of Object.keys(PURPOSE_FIELDS)) purposeFields[key] = asString(purpose[key]);

      const seoFields: Record<string, string | boolean> = {};
      for (const key of Object.keys(SEO_FIELDS)) {
        seoFields[key] = key === 'no_index' ? seo.no_index === true : asString(seo[key]);
      }

      const sections = sectionRows.rows.map((row) => {
        const mapped = mapInstitutionalRow(row);
        return { ...mapped, sectionKey: asString(mapped.sectionKey) };
      });

      const entities = {} as Record<EntityKind, EntityRow[]>;
      ENTITY_KINDS.forEach((kind, index) => {
        entities[kind] = (entityResults[index]?.rows ?? []).map(mapInstitutionalRow);
      });

      return { profile: profileFields, purpose: purposeFields, seo: seoFields, sections, entities };
    },

    async saveProfile(fields, updatedBy) {
      const keys = Object.keys(PROFILE_FIELDS);
      const assignments = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      await pool.query(
        `UPDATE institutional_profiles
            SET ${assignments}, updated_by = $${keys.length + 1}, updated_at = now()
          WHERE slug = $${keys.length + 2}`,
        [...keys.map((key) => fields[key] ?? ''), updatedBy, INSTITUTIONAL_SLUG],
      );
    },

    async savePurpose(fields, updatedBy) {
      const keys = Object.keys(PURPOSE_FIELDS);
      const assignments = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      await pool.query(
        `UPDATE institutional_purpose
            SET ${assignments}, updated_by = $${keys.length + 1}, updated_at = now()
          WHERE id = 1`,
        [...keys.map((key) => fields[key] ?? ''), updatedBy],
      );
    },

    async saveSeo(fields) {
      const textKeys = Object.keys(SEO_FIELDS).filter((key) => key !== 'no_index');
      const assignments = textKeys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      await pool.query(
        `UPDATE institutional_seo
            SET ${assignments}, no_index = $${textKeys.length + 1}, updated_at = now()
          WHERE id = 1`,
        [...textKeys.map((key) => asString(fields[key])), fields.no_index === true],
      );
    },

    async saveSection(key, fields) {
      await pool.query(
        `INSERT INTO institutional_about_sections (section_key, title, body, image_url, is_visible, position)
         VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(position) + 1 FROM institutional_about_sections), 1))
         ON CONFLICT (section_key) DO UPDATE SET
           title = EXCLUDED.title,
           body = EXCLUDED.body,
           image_url = EXCLUDED.image_url,
           is_visible = EXCLUDED.is_visible,
           updated_at = now()`,
        [key, fields.title, fields.body, fields.imageUrl, fields.isVisible],
      );
    },

    async createEntity(kind, fields, isVisible) {
      const columns = entityColumns(kind);
      const values = columns.map((column) => fields[column] ?? '');
      const placeholders = values.map((_value, index) => `$${index + 1}`);
      const result = await pool.query<DbRow>(
        `INSERT INTO ${ENTITY_SPECS[kind].table} (${columns.join(', ')}, is_visible, position)
         VALUES (${placeholders.join(', ')}, $${values.length + 1},
                 COALESCE((SELECT MAX(position) + 1 FROM ${ENTITY_SPECS[kind].table}), 1))
         RETURNING *`,
        [...values, isVisible],
      );
      return mapInstitutionalRow(result.rows[0] ?? {});
    },

    async updateEntity(kind, id, fields, isVisible) {
      const columns = entityColumns(kind);
      const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
      const values = columns.map((column) => fields[column] ?? '');
      const result = await pool.query<DbRow>(
        `UPDATE ${ENTITY_SPECS[kind].table}
            SET ${assignments.join(', ')}, is_visible = $${columns.length + 1}, updated_at = now()
          WHERE id = $${columns.length + 2}
          RETURNING *`,
        [...values, isVisible, id],
      );
      return result.rows[0] ? mapInstitutionalRow(result.rows[0]) : null;
    },

    async deleteEntity(kind, id) {
      const result = await pool.query(
        `DELETE FROM ${ENTITY_SPECS[kind].table} WHERE id = $1`,
        [id],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async reorderEntities(kind, ids) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (let index = 0; index < ids.length; index += 1) {
          await client.query(
            `UPDATE ${ENTITY_SPECS[kind].table} SET position = $1 WHERE id = $2`,
            [index + 1, ids[index]],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async publish(snapshot, publishedBy) {
      // Uma nova publicação substitui a anterior: só existe uma release ativa,
      // para que despublicar não faça reaparecer uma versão antiga.
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query<DbRow>(
          `INSERT INTO institutional_releases (snapshot, published_by)
           VALUES ($1::jsonb, $2)
           RETURNING id, snapshot, published_at, published_by, note`,
          [JSON.stringify(snapshot), publishedBy],
        );
        const release = mapRelease(result.rows[0] ?? {});
        await client.query(
          `UPDATE institutional_releases
              SET withdrawn_at = now(), withdrawn_by = $2
            WHERE withdrawn_at IS NULL AND id <> $1`,
          [release.id, publishedBy],
        );
        await client.query('COMMIT');
        return release;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async latestRelease() {
      const result = await pool.query<DbRow>(
        `SELECT id, snapshot, published_at, published_by, note
           FROM institutional_releases
          WHERE withdrawn_at IS NULL
          ORDER BY published_at DESC, id DESC LIMIT 1`,
      );
      return result.rows[0] ? mapRelease(result.rows[0]) : null;
    },

    // Despublicar não apaga a release: apenas a retira do site.
    async unpublish(withdrawnBy) {
      const result = await pool.query<DbRow>(
        `UPDATE institutional_releases
            SET withdrawn_at = now(), withdrawn_by = $1
          WHERE id = (SELECT id FROM institutional_releases
                       WHERE withdrawn_at IS NULL
                       ORDER BY published_at DESC, id DESC LIMIT 1)
          RETURNING id, snapshot, published_at, published_by, note`,
        [withdrawnBy],
      );
      return result.rows[0] ? mapRelease(result.rows[0]) : null;
    },

    async isPublished() {
      const result = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM institutional_releases WHERE withdrawn_at IS NULL) AS exists`,
      );
      return result.rows[0]?.exists === true;
    },

    async listReleases(limit = 10) {
      const result = await pool.query<DbRow>(
        `SELECT id, published_at, published_by, note
           FROM institutional_releases ORDER BY published_at DESC, id DESC LIMIT $1`,
        [Math.min(Math.max(limit, 1), 50)],
      );
      return result.rows.map((row) => ({
        id: Number(row.id),
        publishedAt: new Date(String(row.published_at)).toISOString(),
        publishedBy: row.published_by ? String(row.published_by) : null,
        note: asString(row.note),
      }));
    },

    async getRelease(id) {
      const result = await pool.query<DbRow>(
        `SELECT id, snapshot, published_at, published_by, note FROM institutional_releases WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapRelease(result.rows[0]) : null;
    },

    async restoreRelease(snapshot, changedBy) {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');

        const profileKeys = Object.keys(PROFILE_FIELDS);
        await client.query(
          `UPDATE institutional_profiles SET ${profileKeys
            .map((key, index) => `${key} = $${index + 1}`)
            .join(', ')}, updated_by = $${profileKeys.length + 1}, updated_at = now()
           WHERE slug = $${profileKeys.length + 2}`,
          [...profileKeys.map((key) => snapshot.profile?.[key] ?? ''), changedBy, INSTITUTIONAL_SLUG],
        );

        const purposeKeys = Object.keys(PURPOSE_FIELDS);
        await client.query(
          `UPDATE institutional_purpose SET ${purposeKeys
            .map((key, index) => `${key} = $${index + 1}`)
            .join(', ')}, updated_by = $${purposeKeys.length + 1}, updated_at = now()
           WHERE id = 1`,
          [...purposeKeys.map((key) => snapshot.purpose?.[key] ?? ''), changedBy],
        );

        const seoTextKeys = Object.keys(SEO_FIELDS).filter((key) => key !== 'no_index');
        await client.query(
          `UPDATE institutional_seo SET ${seoTextKeys
            .map((key, index) => `${key} = $${index + 1}`)
            .join(', ')}, no_index = $${seoTextKeys.length + 1}, updated_at = now()
           WHERE id = 1`,
          [...seoTextKeys.map((key) => asString(snapshot.seo?.[key])), snapshot.seo?.no_index === true],
        );

        for (const key of SECTION_KEYS) {
          const section = snapshot.sections?.find((item) => item.sectionKey === key);
          await client.query(
            `UPDATE institutional_about_sections
                SET title = $1, body = $2, image_url = $3, is_visible = $4, position = $5, updated_at = now()
              WHERE section_key = $6`,
            [
              asString(section?.title),
              asString(section?.body),
              asString(section?.imageUrl),
              section?.isVisible !== false,
              Number(section?.position ?? 0) || 0,
              key,
            ],
          );
        }

        for (const kind of ENTITY_KINDS) {
          await client.query(`DELETE FROM ${ENTITY_SPECS[kind].table}`);
          const columns = entityColumns(kind);
          for (const row of snapshot.entities?.[kind] ?? []) {
            const values = columns.map((column) => asString(row[column]));
            await client.query(
              `INSERT INTO ${ENTITY_SPECS[kind].table} (${columns.join(', ')}, is_visible, position)
               VALUES (${columns.map((_column, index) => `$${index + 1}`).join(', ')}, $${columns.length + 1}, $${columns.length + 2})`,
              [...values, row.isVisible !== false, Number(row.position ?? 0) || 0],
            );
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async listAudit(filters = {}) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (filters.entity) {
        params.push(filters.entity);
        conditions.push(`entity = $${params.length}`);
      }
      if (filters.action) {
        params.push(filters.action);
        conditions.push(`action = $${params.length}`);
      }
      const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
      params.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query<DbRow>(
        `SELECT id, entity, entity_id, action, changed_by, metadata, created_at
           FROM institutional_audit ${where}
          ORDER BY id DESC LIMIT $${params.length}`,
        params,
      );
      return result.rows.map((row) => ({
        id: Number(row.id),
        entity: String(row.entity ?? ''),
        entityId: row.entity_id === null || row.entity_id === undefined ? null : String(row.entity_id),
        action: String(row.action ?? ''),
        changedBy: row.changed_by === null || row.changed_by === undefined ? null : String(row.changed_by),
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: new Date(String(row.created_at)).toISOString(),
      }));
    },

    async recordDocumentVersion(documentId, fields, changedBy) {
      await pool.query(
        `INSERT INTO institutional_document_versions (document_id, version, content, status, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          documentId,
          asString(fields.version) || '1.0',
          asString(fields.content),
          asString(fields.status) || 'draft',
          changedBy,
        ],
      );
    },

    async listDocumentVersions(documentId) {
      const result = await pool.query<DbRow>(
        `SELECT id, version, content, status, changed_by, created_at
           FROM institutional_document_versions
          WHERE document_id = $1
          ORDER BY id DESC LIMIT 50`,
        [documentId],
      );
      return result.rows.map((row) => ({
        id: Number(row.id),
        version: String(row.version ?? ''),
        content: String(row.content ?? ''),
        status: String(row.status ?? ''),
        changedBy: row.changed_by === null || row.changed_by === undefined ? null : String(row.changed_by),
        createdAt: new Date(String(row.created_at)).toISOString(),
      }));
    },

    // Restaura uma versão guardada: o conteúdo/versão/estado voltam ao registo
    // actual e a própria restauração fica registada no histórico de versões.
    async restoreDocumentVersion(documentId, versionId, changedBy) {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const versionResult = await client.query<DbRow>(
          `SELECT id, version, content, status
             FROM institutional_document_versions
            WHERE id = $1 AND document_id = $2
            LIMIT 1`,
          [versionId, documentId],
        );
        const versionRow = versionResult.rows[0];
        if (!versionRow) {
          await client.query('ROLLBACK');
          return null;
        }
        const version = String(versionRow.version ?? '1.0');
        const content = String(versionRow.content ?? '');
        const status = String(versionRow.status ?? 'draft');
        const updateResult = await client.query<DbRow>(
          `UPDATE institutional_documents
              SET version = $1, content = $2, status = $3, updated_at = now()
            WHERE id = $4
            RETURNING *`,
          [version, content, status, documentId],
        );
        const item = updateResult.rows[0];
        if (!item) {
          await client.query('ROLLBACK');
          return null;
        }
        await client.query(
          `INSERT INTO institutional_document_versions (document_id, version, content, status, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [documentId, version, content, status, changedBy],
        );
        await client.query('COMMIT');
        return {
          item: mapInstitutionalRow(item),
          restoredFrom: { id: Number(versionRow.id), version },
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async audit(entry) {
      await pool.query(
        `INSERT INTO institutional_audit (entity, entity_id, action, changed_by, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          entry.entity,
          entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
          entry.action,
          entry.changedBy,
          JSON.stringify(entry.metadata ?? {}),
        ],
      );
    },
  };

  return repo;
}
