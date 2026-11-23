import type { Pool } from 'pg';
import { databasePool } from '../db';
import type {
  EmailDeliveryRecord,
  EmailDeliveryStatus,
  EmailKind,
  EmailLocale,
  EmailProviderMode,
  EmailProviderName,
} from './types';

/**
 * Repositório do histórico de entregas.
 *
 * O dispatcher grava uma linha por email antes de contactar o fornecedor
 * (`queued`) e actualiza-a no fim. `dedupe_key` é único: o mesmo email nunca é
 * enviado duas vezes por retry, webhook repetido ou pedido duplicado.
 *
 * Sem `DATABASE_URL`, mantém-se em memória, como nos restantes serviços do
 * projecto — suficiente para desenvolvimento e testes, nunca para produção.
 */

export interface NewEmailDeliveryInput {
  id: string;
  kind: EmailKind;
  locale: EmailLocale;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  provider: EmailProviderName;
  mode: EmailProviderMode;
  status: 'queued' | 'rejected';
  dedupeKey?: string;
  relatedUserId?: string;
  metadata?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface EmailDeliveryFinishInput {
  status: Exclude<EmailDeliveryStatus, 'queued'>;
  attempts: number;
  providerMessageId?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  acceptedAt?: Date;
  at: Date;
}

export interface EmailDeliveryRepository {
  create(input: NewEmailDeliveryInput): Promise<{
    record: EmailDeliveryRecord;
    duplicate: boolean;
  }>;
  finish(id: string, input: EmailDeliveryFinishInput): Promise<EmailDeliveryRecord>;
  get(id: string): Promise<EmailDeliveryRecord | null>;
  listRecent(options?: {
    limit?: number;
    status?: EmailDeliveryStatus;
  }): Promise<EmailDeliveryRecord[]>;
}

const SELECT_COLUMNS = `
  id, kind, locale,
  recipient_email AS "recipientEmail",
  recipient_name AS "recipientName",
  subject, status, provider,
  provider_mode AS "mode",
  provider_message_id AS "providerMessageId",
  dedupe_key AS "dedupeKey",
  attempts,
  last_error_code AS "lastErrorCode",
  last_error_message AS "lastErrorMessage",
  related_user_id AS "relatedUserId",
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  accepted_at AS "acceptedAt",
  delivered_at AS "deliveredAt",
  finalized_at AS "finalizedAt"
`;

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return null;
}

function mapRow(row: Record<string, unknown>): EmailDeliveryRecord {
  return {
    id: String(row.id),
    kind: row.kind as EmailKind,
    locale: row.locale as EmailLocale,
    recipientEmail: String(row.recipientEmail ?? ''),
    recipientName: (row.recipientName as string | null) ?? null,
    subject: String(row.subject ?? ''),
    status: row.status as EmailDeliveryStatus,
    provider: row.provider as EmailProviderName,
    mode: row.mode as EmailProviderMode,
    providerMessageId: (row.providerMessageId as string | null) ?? null,
    dedupeKey: (row.dedupeKey as string | null) ?? null,
    attempts: Number(row.attempts ?? 0),
    lastErrorCode: (row.lastErrorCode as string | null) ?? null,
    lastErrorMessage: (row.lastErrorMessage as string | null) ?? null,
    relatedUserId: (row.relatedUserId as string | null) ?? null,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
    acceptedAt: toIso(row.acceptedAt),
    deliveredAt: toIso(row.deliveredAt),
    finalizedAt: toIso(row.finalizedAt),
  };
}

export function createPostgresEmailDeliveryRepository(pool: Pool): EmailDeliveryRepository {
  return {
    async create(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          `INSERT INTO email_deliveries (
             id, kind, locale, recipient_email, recipient_name, subject, status,
             provider, provider_mode, dedupe_key, attempts,
             last_error_code, last_error_message, related_user_id, metadata, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
           ON CONFLICT (dedupe_key) DO NOTHING
           RETURNING ${SELECT_COLUMNS}`,
          [
            input.id,
            input.kind,
            input.locale,
            input.recipientEmail,
            input.recipientName ?? null,
            input.subject,
            input.status,
            input.provider,
            input.mode,
            input.dedupeKey ?? null,
            0,
            input.errorCode ?? null,
            input.errorMessage ?? null,
            input.relatedUserId ?? null,
            JSON.stringify(input.metadata ?? {}),
            input.createdAt.toISOString(),
          ],
        );

        if (inserted.rowCount === 0 && input.dedupeKey) {
          await client.query('COMMIT');
          const existing = await pool.query(
            `SELECT ${SELECT_COLUMNS} FROM email_deliveries WHERE dedupe_key = $1`,
            [input.dedupeKey],
          );
          return { record: mapRow(existing.rows[0]), duplicate: true };
        }

        const record = mapRow(inserted.rows[0]);
        await client.query(
          `INSERT INTO email_delivery_events (delivery_id, status, source, detail)
           VALUES ($1,$2,'dispatcher',$3)`,
          [record.id, record.status, input.errorCode ?? 'created'],
        );
        await client.query('COMMIT');
        return { record, duplicate: false };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async finish(id, input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updated = await client.query(
          `UPDATE email_deliveries SET
             status = $2,
             attempts = $3,
             provider_message_id = COALESCE($4, provider_message_id),
             last_error_code = $5,
             last_error_message = $6,
             updated_at = $7,
             finalized_at = $7,
             accepted_at = CASE
               WHEN $2 IN ('accepted','delivered','bounced','complained')
                 THEN COALESCE(accepted_at, $8)
               ELSE accepted_at
             END,
             delivered_at = CASE
               WHEN $2 = 'delivered' THEN COALESCE(delivered_at, $7)
               ELSE delivered_at
             END
           WHERE id = $1
           RETURNING ${SELECT_COLUMNS}`,
          [
            id,
            input.status,
            input.attempts,
            input.providerMessageId ?? null,
            input.errorCode ?? null,
            input.errorMessage ?? null,
            input.at.toISOString(),
            (input.acceptedAt ?? input.at).toISOString(),
          ],
        );
        if (!updated.rowCount) {
          throw new Error(`Registo de email não encontrado: ${id}`);
        }
        const record = mapRow(updated.rows[0]);
        await client.query(
          `INSERT INTO email_delivery_events (delivery_id, status, source, detail)
           VALUES ($1,$2,'dispatcher',$3)`,
          [record.id, record.status, record.lastErrorCode ?? null],
        );
        await client.query('COMMIT');
        return record;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async get(id) {
      const result = await pool.query(`SELECT ${SELECT_COLUMNS} FROM email_deliveries WHERE id = $1`, [
        id,
      ]);
      return result.rowCount ? mapRow(result.rows[0]) : null;
    },

    async listRecent(options = {}) {
      const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
      const params: unknown[] = [];
      let where = '';
      if (options.status) {
        params.push(options.status);
        where = 'WHERE status = $1';
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT ${SELECT_COLUMNS} FROM email_deliveries ${where}
         ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      return result.rows.map(mapRow);
    },
  };
}

export function createInMemoryEmailDeliveryRepository(): EmailDeliveryRepository {
  const records = new Map<string, EmailDeliveryRecord>();
  const dedupeIndex = new Map<string, string>();

  return {
    async create(input) {
      if (input.dedupeKey) {
        const existingId = dedupeIndex.get(input.dedupeKey);
        const existing = existingId ? records.get(existingId) : undefined;
        if (existing) return { record: existing, duplicate: true };
      }

      const timestamp = input.createdAt.toISOString();
      const record: EmailDeliveryRecord = {
        id: input.id,
        kind: input.kind,
        locale: input.locale,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        subject: input.subject,
        status: input.status,
        provider: input.provider,
        mode: input.mode,
        providerMessageId: null,
        dedupeKey: input.dedupeKey ?? null,
        attempts: 0,
        lastErrorCode: input.errorCode ?? null,
        lastErrorMessage: input.errorMessage ?? null,
        relatedUserId: input.relatedUserId ?? null,
        metadata: input.metadata ?? {},
        createdAt: timestamp,
        updatedAt: timestamp,
        acceptedAt: null,
        deliveredAt: null,
        finalizedAt: input.status === 'rejected' ? timestamp : null,
      };
      records.set(record.id, record);
      if (record.dedupeKey) dedupeIndex.set(record.dedupeKey, record.id);
      return { record, duplicate: false };
    },

    async finish(id, input) {
      const existing = records.get(id);
      if (!existing) throw new Error(`Registo de email não encontrado: ${id}`);
      const at = input.at.toISOString();
      const providerAccepted =
        input.status === 'accepted' ||
        input.status === 'delivered' ||
        input.status === 'bounced' ||
        input.status === 'complained';
      const record: EmailDeliveryRecord = {
        ...existing,
        status: input.status,
        attempts: input.attempts,
        providerMessageId: input.providerMessageId ?? existing.providerMessageId,
        lastErrorCode: input.errorCode ?? null,
        lastErrorMessage: input.errorMessage ?? null,
        updatedAt: at,
        finalizedAt: at,
        acceptedAt: providerAccepted
          ? (existing.acceptedAt ?? (input.acceptedAt ?? input.at).toISOString())
          : existing.acceptedAt,
        deliveredAt:
          input.status === 'delivered' ? (existing.deliveredAt ?? at) : existing.deliveredAt,
      };
      records.set(id, record);
      return record;
    },

    async get(id) {
      return records.get(id) ?? null;
    },

    async listRecent(options = {}) {
      const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
      return Array.from(records.values())
        .filter((record) => !options.status || record.status === options.status)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit);
    },
  };
}

export function createEmailDeliveryRepository(): EmailDeliveryRepository {
  return databasePool
    ? createPostgresEmailDeliveryRepository(databasePool)
    : createInMemoryEmailDeliveryRepository();
}
