import { randomUUID } from 'node:crypto';
import { loadJson, saveJson } from './runtimeStore';
import { persistPostgresNotification } from './postgresCommunicationService';
import { databasePool } from './db';
import type { ScheduledItem, ScheduledItemStatus } from '../src/types';

const FILE_NAME = 'scheduled-items.json';
const TIMEZONE = 'Africa/Bissau';

const readItems = () => loadJson<ScheduledItem[]>(FILE_NAME, []);
const writeItems = (items: ScheduledItem[]) => saveJson(FILE_NAME, items);
const notify = async (notification: Parameters<typeof persistPostgresNotification>[0]) => {
  try {
    await persistPostgresNotification(notification);
  } catch (error) {
    console.error('scheduled-item-notification-failed', error instanceof Error ? error.message : String(error));
  }
};

// O schema de marketing_scheduled_items vive em db/migrations/002. Nenhum DDL
// corre em runtime.

function rowToItem(row: Record<string, unknown>): ScheduledItem {
  return {
    id: String(row.id), businessId: String(row.business_id), ownerUserId: row.owner_user_id ? String(row.owner_user_id) : undefined,
    itemType: String(row.item_type), itemId: String(row.item_id), label: row.label ? String(row.label) : undefined,
    description: row.description ? String(row.description) : undefined, scheduledAt: new Date(String(row.scheduled_at)).toISOString(),
    timezone: String(row.timezone), status: row.status as ScheduledItemStatus, attempts: Number(row.attempts),
    lastAttemptAt: row.last_attempt_at ? new Date(String(row.last_attempt_at)).toISOString() : undefined,
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    moderationStatus: row.moderation_status as ScheduledItem['moderationStatus'],
    paymentStatus: row.payment_status as ScheduledItem['paymentStatus'], campaignId: row.campaign_id ? String(row.campaign_id) : undefined,
    endsAt: row.ends_at ? new Date(String(row.ends_at)).toISOString() : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

async function persistItem(item: ScheduledItem) {
  if (!databasePool) return;
  await databasePool.query(`
    INSERT INTO marketing_scheduled_items
      (id,business_id,owner_user_id,item_type,item_id,label,description,scheduled_at,timezone,status,attempts,last_attempt_at,published_at,error_message,moderation_status,payment_status,campaign_id,ends_at,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    ON CONFLICT (id) DO UPDATE SET
      status=EXCLUDED.status, attempts=EXCLUDED.attempts, last_attempt_at=EXCLUDED.last_attempt_at,
      published_at=EXCLUDED.published_at, error_message=EXCLUDED.error_message, scheduled_at=EXCLUDED.scheduled_at,
      ends_at=EXCLUDED.ends_at, updated_at=EXCLUDED.updated_at
  `, [item.id,item.businessId,item.ownerUserId || null,item.itemType,item.itemId,item.label || null,item.description || null,item.scheduledAt,item.timezone,item.status,item.attempts,item.lastAttemptAt || null,item.publishedAt || null,item.errorMessage || null,item.moderationStatus || null,item.paymentStatus || null,item.campaignId || null,item.endsAt || null,item.createdAt,item.updatedAt]);
}

async function updateCampaignPayload(item: ScheduledItem, status: 'active' | 'ended') {
  if (!databasePool || (item.itemType !== 'campaign' && item.itemType !== 'promotion')) return;
  const table = item.itemType === 'campaign' ? 'marketing_campaigns' : 'marketing_promotions';
  const fields = item.itemType === 'promotion'
    ? { status, isActive: status === 'active', ...(status === 'active' ? { activatedAt: new Date().toISOString() } : {}) }
    : { status };
  await databasePool.query(`
    UPDATE ${table}
    SET payload = payload || $2::jsonb || jsonb_build_object('updatedAt', $3::text),
        updated_at = $3::timestamptz
    WHERE id = $1
  `, [item.itemId, JSON.stringify(fields), new Date().toISOString()]);
}

export async function ensureDemoScheduledItems(businessId = 'biz-1'): Promise<void> {
  if (databasePool) {
      const count = await databasePool.query('SELECT COUNT(*)::int AS count FROM marketing_scheduled_items WHERE business_id=$1 AND id LIKE $2', [businessId, 'demo-schedule-%']);
    if (count.rows[0]?.count >= 60) return;
  }
  const items = readItems();
  const existingDemo = items.filter((item) => item.id.startsWith('demo-schedule-') && item.businessId === businessId);
  if (!databasePool && existingDemo.length >= 60) return;

  const types: Array<{ type: ScheduledItem['itemType']; label: string }> = [
    { type: 'post', label: 'Publicação' },
    { type: 'promotion', label: 'Promoção' },
    { type: 'campaign', label: 'Campanha' },
    { type: 'event', label: 'Anúncio de evento' },
    { type: 'reminder', label: 'Lembrete' },
    { type: 'other', label: 'Outro conteúdo' },
  ];
  const now = Date.now();
  const generated: ScheduledItem[] = [];
  types.forEach(({ type, label }) => {
    for (let index = 1; index <= 10; index += 1) {
      const itemId = `demo-${type}-${index}`;
      if (items.some((item) => item.businessId === businessId && item.itemId === itemId)) continue;
      const createdAt = new Date(now).toISOString();
      generated.push({
        id: `demo-schedule-${type}-${index}`,
        businessId,
        itemType: type,
        itemId,
        label: `${label} demonstrativo ${index}`,
        description: `Dados de demonstração para o módulo Marketing (${label.toLowerCase()}).`,
        scheduledAt: new Date(now + (index + types.findIndex((entry) => entry.type === type) * 10) * 60 * 60 * 1000).toISOString(),
        timezone: TIMEZONE,
        status: 'scheduled',
        attempts: 0,
        moderationStatus: 'approved',
        paymentStatus: 'not_required',
        createdAt,
        updatedAt: createdAt,
      });
    }
  });
  if (generated.length > 0) {
    writeItems([...generated, ...items]);
    for (const item of generated) await persistItem(item);
  }
  if (databasePool) {
    for (const item of items.filter((candidate) => candidate.businessId === businessId && candidate.id.startsWith('demo-schedule-'))) {
      await persistItem(item);
    }
  }
}

export async function listScheduledItems(businessId?: string): Promise<ScheduledItem[]> {
  if (databasePool) {
      const result = await databasePool.query<Record<string, unknown>>(
      `SELECT * FROM marketing_scheduled_items ${businessId ? 'WHERE business_id=$1' : ''} ORDER BY scheduled_at`,
      businessId ? [businessId] : [],
    );
    return result.rows.map(rowToItem);
  }
  const items = readItems();
  return businessId ? items.filter((item) => item.businessId === businessId) : items;
}

export async function createScheduledItem(input: Omit<ScheduledItem, 'id' | 'status' | 'attempts' | 'timezone' | 'createdAt' | 'updatedAt'> & { timezone?: string }) {
  const now = new Date().toISOString();
  const item: ScheduledItem = {
    ...input,
    id: `schedule-${randomUUID()}`,
    status: 'scheduled',
    attempts: 0,
    timezone: input.timezone || TIMEZONE,
    createdAt: now,
    updatedAt: now,
  };
  const items = readItems();
  writeItems([item, ...items.filter((existing) => existing.id !== item.id)]);
  await persistItem(item);
  void notify({
    id: `notification-${item.id}-created`,
    userId: item.ownerUserId,
    category: 'marketing',
    title: 'Agendamento criado',
    message: `O item ${item.itemId} foi agendado para ${item.scheduledAt} (${item.timezone}).`,
    metadata: { scheduledItemId: item.id, itemType: item.itemType },
    createdAt: now,
  });
  return item;
}

export async function updateScheduledItem(id: string, patch: Partial<Pick<ScheduledItem, 'scheduledAt' | 'status' | 'errorMessage' | 'endsAt'>>) {
  if (databasePool) {
    const items = await listScheduledItems();
    const existing = items.find((item) => item.id === id);
    if (!existing) throw new Error('SCHEDULE_NOT_FOUND');
    const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await persistItem(next);
    return next;
  }
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('SCHEDULE_NOT_FOUND');
  const next = {
    ...items[index],
    ...(patch.scheduledAt === undefined ? {} : { scheduledAt: patch.scheduledAt }),
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.errorMessage === undefined ? {} : { errorMessage: patch.errorMessage }),
    ...(patch.endsAt === undefined ? {} : { endsAt: patch.endsAt }),
    updatedAt: new Date().toISOString(),
  };
  items[index] = next;
  writeItems(items);
  return next;
}

export async function cancelScheduledItem(id: string) {
  return updateScheduledItem(id, { status: 'cancelled' });
}

export async function processDueScheduledItems(now = new Date()): Promise<number> {
  const items = await listScheduledItems();
  let processed = 0;
  for (const item of items) {
    if (item.status === 'published' && item.endsAt && Date.parse(item.endsAt) <= now.getTime()) {
      item.status = 'expired';
      item.updatedAt = now.toISOString();
      await updateCampaignPayload(item, 'ended');
      await persistItem(item);
      writeItems(items);
      continue;
    }
    if (item.status !== 'scheduled' || Date.parse(item.scheduledAt) > now.getTime()) continue;
    item.status = 'publishing';
    item.attempts += 1;
    item.lastAttemptAt = now.toISOString();
    item.updatedAt = now.toISOString();
    await persistItem(item); writeItems(items);
    try {
      if (item.moderationStatus && item.moderationStatus !== 'approved') {
        throw new Error('MODERATION_REQUIRED');
      }
      if (item.paymentStatus && item.paymentStatus !== 'paid' && item.paymentStatus !== 'not_required') {
        throw new Error('PAYMENT_REQUIRED');
      }
      await updateCampaignPayload(item, 'active');
      item.status = 'published';
      item.publishedAt = new Date().toISOString();
      item.updatedAt = item.publishedAt;
      item.errorMessage = undefined;
      processed += 1;
      await persistItem(item);
      await notify({
        id: `notification-${item.id}-published`,
        userId: item.ownerUserId,
        category: 'marketing',
        title: 'Conteúdo publicado automaticamente',
        message: `O item ${item.itemId} foi publicado no horário agendado.`,
        metadata: { scheduledItemId: item.id, itemType: item.itemType },
        createdAt: item.publishedAt,
      });
    } catch (error) {
      item.status = 'failed';
      item.errorMessage = error instanceof Error ? error.message : String(error);
      item.updatedAt = new Date().toISOString();
      await persistItem(item);
      await notify({
        id: `notification-${item.id}-failed-${item.attempts}`,
        userId: item.ownerUserId,
        category: 'marketing',
        title: 'Falha no conteúdo agendado',
        message: `O item ${item.itemId} não foi publicado: ${item.errorMessage}.`,
        metadata: { scheduledItemId: item.id, itemType: item.itemType },
        createdAt: item.updatedAt,
      });
    }
    writeItems(items);
  }
  return processed;
}

export const SCHEDULING_TIMEZONE = TIMEZONE;
