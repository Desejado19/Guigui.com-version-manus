import { randomUUID } from 'node:crypto';
import { databasePool, acquireClient, releaseClient } from './db';
import { foldedLikePattern, foldedSql } from './sqlSearch';
import { createPostgresConversation, persistPostgresNotification } from './postgresCommunicationService';

export type StoryRole = 'user' | 'business' | 'admin';

export type StoryActor = {
  userId: string;
  role: StoryRole;
  name: string;
  businessId?: string;
  businessName?: string;
  avatarUrl?: string;
  teamPermissions?: { content?: boolean } | null;
};

export type StoryElementType =
  | 'text' | 'emoji' | 'sticker' | 'poll' | 'question' | 'quiz' | 'countdown'
  | 'link' | 'mention' | 'hashtag' | 'location' | 'music' | 'cta';

export type StoryElementInput = {
  type: StoryElementType;
  content?: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
  scale?: number;
  rotation?: number;
  zIndex?: number;
};

export type StoryInput = {
  storyType: 'image' | 'video' | 'text';
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
  durationMs?: number;
  backgroundColor?: string;
  visibility?: 'public' | 'limited';
  locationId?: string | null;
  locationName?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  elements?: StoryElementInput[];
  publish?: boolean;
};

export type StoryViewer = {
  viewed: boolean;
  liked: boolean;
  reaction?: string | null;
  pollVotes: Record<string, number>;
};

export type StoryElementDto = {
  id: string;
  type: StoryElementType;
  content: Record<string, unknown>;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  zIndex: number;
  pollCounts?: number[];
  viewerOptionIndex?: number | null;
  responseCount?: number;
};

export type StoryCounts = {
  views: number;
  uniqueViews: number;
  likes: number;
  reactions: number;
  replies: number;
  pollVotes: number;
  questionResponses: number;
  shares: number;
  engagementRate: number;
};

export type StoryDto = {
  id: string;
  ownerUserId: string;
  ownerRole: 'business' | 'admin';
  businessId: string;
  businessName: string;
  businessLogo: string;
  storyType: 'image' | 'video' | 'text';
  imageUrl?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  durationMs: number;
  backgroundColor: string;
  visibility: 'public' | 'limited';
  status: 'draft' | 'active' | 'expired' | 'removed' | 'suspended';
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationReason?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  shareToken: string;
  elements: StoryElementDto[];
  createdAt: string;
  publishedAt?: string | null;
  expiresAt?: string | null;
  archivedAt?: string | null;
  isUnread?: boolean;
  counts: StoryCounts;
  viewer?: StoryViewer;
  comments?: Array<{ id: string; userId: string; userName: string; text: string; createdAt: string }>;
};

export class StoryError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'StoryError';
    this.status = status;
    this.code = code;
  }
}

const MAX_ACTIVE_PER_HOUR = 12;
const MAX_ELEMENTS = 24;
const ALLOWED_REACTIONS = new Set(['❤️', '😂', '😮', '😢', '👏', '🔥']);
const ALLOWED_REASONS = new Set(['improper', 'false_information', 'fraud', 'spam', 'harassment', 'rights', 'other']);
const ALLOWED_ELEMENT_TYPES = new Set<StoryElementType>([
  'text', 'emoji', 'sticker', 'poll', 'question', 'quiz', 'countdown',
  'link', 'mention', 'hashtag', 'location', 'music', 'cta',
]);

function requireDb() {
  if (!databasePool) throw new StoryError(503, 'DATABASE_UNAVAILABLE', 'Base de dados indisponível.');
  return databasePool;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function safeStoryUrl(value: unknown): string | null {
  const raw = text(value, 2048);
  if (!raw) return null;
  if (raw.startsWith('/uploads/stories/') || raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normaliseElement(input: StoryElementInput, index: number): { type: StoryElementType; content: Record<string, unknown>; positionX: number; positionY: number; scale: number; rotation: number; zIndex: number } {
  if (!ALLOWED_ELEMENT_TYPES.has(input.type)) {
    throw new StoryError(400, 'STORY_ELEMENT_INVALID', 'Tipo de elemento de story inválido.');
  }
  const source = input.content && typeof input.content === 'object' ? input.content : {};
  const content: Record<string, unknown> = {};
  if (input.type === 'poll' || input.type === 'quiz') {
    const question = text(source.question, 180);
    const options = Array.isArray(source.options)
      ? source.options.map((option) => text(option, 120)).filter((option): option is string => Boolean(option)).slice(0, 4)
      : [];
    if (!question || options.length < 2) {
      throw new StoryError(400, 'STORY_POLL_INVALID', 'A sondagem precisa de uma pergunta e pelo menos duas opções.');
    }
    content.question = question;
    content.options = options;
    if (input.type === 'quiz') content.correctIndex = Math.min(options.length - 1, Math.max(0, Number(source.correctIndex) || 0));
  } else if (input.type === 'question') {
    const question = text(source.question, 180);
    if (!question) throw new StoryError(400, 'STORY_QUESTION_INVALID', 'A caixa de perguntas precisa de um enunciado.');
    content.question = question;
  } else if (input.type === 'text' || input.type === 'sticker' || input.type === 'emoji') {
    const value = text(source.text, 300);
    if (!value) throw new StoryError(400, 'STORY_TEXT_INVALID', 'O texto não pode estar vazio.');
    content.text = value;
    if (typeof source.color === 'string') content.color = source.color.slice(0, 32);
    if (typeof source.background === 'string') content.background = source.background.slice(0, 32);
    if (typeof source.align === 'string' && ['left', 'center', 'right'].includes(source.align)) content.align = source.align;
    if (typeof source.fontSize === 'number') content.fontSize = clamp(source.fontSize, 12, 72, 24);
  } else if (input.type === 'link' || input.type === 'cta') {
    const label = text(source.label, 80) || 'Ver mais';
    const url = safeStoryUrl(source.url);
    if (!url) throw new StoryError(400, 'STORY_LINK_INVALID', 'O link da story é inválido.');
    content.label = label;
    content.url = url;
  } else if (input.type === 'mention' || input.type === 'hashtag') {
    const value = text(source.value, 100);
    if (!value) throw new StoryError(400, 'STORY_MENTION_INVALID', 'A menção ou hashtag é inválida.');
    content.value = value;
    if (typeof source.businessId === 'string') content.businessId = source.businessId.slice(0, 120);
  } else if (input.type === 'location') {
    const name = text(source.name, 140);
    if (!name) throw new StoryError(400, 'STORY_LOCATION_INVALID', 'A localização é inválida.');
    content.name = name;
  } else if (input.type === 'countdown') {
    const label = text(source.label, 100) || 'Contagem decrescente';
    const targetAt = text(source.targetAt, 40);
    if (!targetAt || !Number.isFinite(Date.parse(targetAt))) {
      throw new StoryError(400, 'STORY_COUNTDOWN_INVALID', 'A data da contagem decrescente é inválida.');
    }
    content.label = label;
    content.targetAt = new Date(targetAt).toISOString();
  } else if (input.type === 'music') {
    const title = text(source.title, 140);
    if (!title) throw new StoryError(400, 'STORY_MUSIC_INVALID', 'O título da música é inválido.');
    content.title = title;
    if (typeof source.artist === 'string') content.artist = source.artist.slice(0, 140);
  }
  return {
    type: input.type,
    content,
    positionX: clamp(input.positionX, 0, 100, 50),
    positionY: clamp(input.positionY, 0, 100, 50 + index * 4),
    scale: clamp(input.scale, 0.4, 3, 1),
    rotation: clamp(input.rotation, -180, 180, 0),
    zIndex: Math.round(clamp(input.zIndex, 1, 100, index + 1)),
  };
}

function normaliseStoryInput(input: StoryInput): StoryInput & { elements: ReturnType<typeof normaliseElement>[] } {
  const storyType = input.storyType;
  if (!['image', 'video', 'text'].includes(storyType)) {
    throw new StoryError(400, 'STORY_TYPE_INVALID', 'Tipo de story inválido.');
  }
  const mediaUrl = safeStoryUrl(input.mediaUrl);
  if (storyType !== 'text' && !mediaUrl) {
    throw new StoryError(400, 'STORY_MEDIA_REQUIRED', 'Seleciona uma fotografia ou um vídeo para publicar.');
  }
  if (mediaUrl && !mediaUrl.startsWith('/uploads/stories/') && !/^https?:\/\//i.test(mediaUrl)) {
    throw new StoryError(400, 'STORY_MEDIA_INVALID', 'O endereço do ficheiro é inválido.');
  }
  const elements = Array.isArray(input.elements) ? input.elements.slice(0, MAX_ELEMENTS) : [];
  const actionUrl = safeStoryUrl(input.actionUrl);
  return {
    ...input,
    storyType,
    mediaUrl,
    thumbnailUrl: safeStoryUrl(input.thumbnailUrl),
    caption: text(input.caption, 2200),
    durationMs: Math.round(clamp(input.durationMs, 1000, 60000, 5000)),
    backgroundColor: typeof input.backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(input.backgroundColor) ? input.backgroundColor : '#0f172a',
    visibility: input.visibility === 'limited' ? 'limited' : 'public',
    locationName: text(input.locationName, 140),
    actionLabel: text(input.actionLabel, 80),
    actionUrl,
    elements: elements.map(normaliseElement),
  };
}

function assertPublisher(actor: StoryActor): 'business' | 'admin' {
  if (actor.role === 'admin') return 'admin';
  if (actor.role === 'business' && actor.businessId) {
    if (actor.teamPermissions && actor.teamPermissions.content === false) {
      throw new StoryError(403, 'STORY_PUBLISH_FORBIDDEN', 'O seu perfil de equipa não permite gerir conteúdos.');
    }
    return 'business';
  }
  throw new StoryError(403, 'STORY_PUBLISH_FORBIDDEN', 'Apenas empresas e administração podem publicar stories.');
}

async function assertModerator(userId: string): Promise<void> {
  const db = requireDb();
  const result = await db.query(
    `SELECT 1
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = $1 AND u.role = 'admin' AND p.name = 'story_moderation'
      LIMIT 1`,
    [userId],
  );
  if (!result.rowCount) {
    throw new StoryError(403, 'STORY_MODERATION_FORBIDDEN', 'Não possui a permissão de moderação de Stories.');
  }
}

export async function isStoryModerator(userId: string): Promise<boolean> {
  try {
    await assertModerator(userId);
    return true;
  } catch {
    return false;
  }
}

export async function expireStories(): Promise<number> {
  const db = requireDb();
  const result = await db.query(
    `UPDATE stories SET status='expired', archived_at=NOW(), updated_at=NOW()
      WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= NOW()`,
  );
  return result.rowCount || 0;
}

type Row = Record<string, any>;

function mapCounts(row: Row): StoryCounts {
  const views = Number(row.view_count || 0);
  const engagement = Number(row.like_count || 0)
    + Number(row.reaction_count || 0)
    + Number(row.reply_count || 0)
    + Number(row.poll_vote_count || 0)
    + Number(row.question_response_count || 0);
  return {
    views,
    uniqueViews: views,
    likes: Number(row.like_count || 0),
    reactions: Number(row.reaction_count || 0),
    replies: Number(row.reply_count || 0),
    pollVotes: Number(row.poll_vote_count || 0),
    questionResponses: Number(row.question_response_count || 0),
    shares: Number(row.share_count || 0),
    engagementRate: views > 0 ? Math.round((engagement / views) * 1000) / 10 : 0,
  };
}

function mapElement(row: Row): StoryElementDto {
  return {
    id: row.id,
    type: row.element_type,
    content: row.content || {},
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    scale: Number(row.scale),
    rotation: Number(row.rotation),
    zIndex: Number(row.z_index),
    pollCounts: Array.isArray(row.poll_counts) ? row.poll_counts.map(Number) : undefined,
    viewerOptionIndex: row.viewer_option_index == null ? null : Number(row.viewer_option_index),
    responseCount: Number(row.response_count || 0),
  };
}

function mapStory(row: Row, elements: StoryElementDto[], viewer?: StoryViewer | null): StoryDto {
  const media = row.media_url || undefined;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerRole: row.owner_role,
    businessId: row.business_id || '',
    businessName: row.business_name,
    businessLogo: row.business_logo || '',
    storyType: row.story_type,
    imageUrl: row.story_type === 'video' ? undefined : media,
    mediaUrl: media,
    thumbnailUrl: row.thumbnail_url || undefined,
    caption: row.caption || undefined,
    durationMs: Number(row.duration_ms || 5000),
    backgroundColor: row.background_color || '#0f172a',
    visibility: row.visibility,
    status: row.status,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason,
    locationId: row.location_id || null,
    locationName: row.location_name || null,
    actionLabel: row.action_label || null,
    actionUrl: row.action_url || null,
    shareToken: row.share_token,
    elements,
    createdAt: iso(row.created_at) || new Date().toISOString(),
    publishedAt: iso(row.published_at),
    expiresAt: iso(row.expires_at),
    archivedAt: iso(row.archived_at),
    isUnread: viewer ? !viewer.viewed : true,
    counts: mapCounts(row),
    viewer: viewer || undefined,
    comments: [],
  };
}

async function loadElements(storyIds: string[], viewerId?: string): Promise<Map<string, StoryElementDto[]>> {
  const db = requireDb();
  const output = new Map<string, StoryElementDto[]>();
  if (!storyIds.length) return output;
  const elementResult = await db.query(
    `SELECT * FROM story_elements WHERE story_id = ANY($1::text[]) ORDER BY story_id, z_index, created_at`,
    [storyIds],
  );
  const elementIds = elementResult.rows.map((row: Row) => row.id);
  const pollCounts = new Map<string, number[]>();
  const questionCounts = new Map<string, number>();
  const viewerVotes = new Map<string, number>();
  if (elementIds.length) {
    const polls = await db.query(
      `SELECT element_id, option_index, COUNT(*)::int AS total
         FROM story_poll_votes WHERE element_id = ANY($1::text[]) GROUP BY element_id, option_index`,
      [elementIds],
    );
    for (const row of polls.rows as Row[]) {
      const counts = pollCounts.get(row.element_id) || [];
      counts[Number(row.option_index)] = Number(row.total);
      pollCounts.set(row.element_id, counts);
    }
    const questions = await db.query(
      `SELECT element_id, COUNT(*)::int AS total FROM story_question_responses
        WHERE element_id = ANY($1::text[]) GROUP BY element_id`,
      [elementIds],
    );
    for (const row of questions.rows as Row[]) questionCounts.set(row.element_id, Number(row.total));
    if (viewerId) {
      const votes = await db.query(
        `SELECT element_id, option_index FROM story_poll_votes
          WHERE story_id = ANY($1::text[]) AND user_id = $2`,
        [storyIds, viewerId],
      );
      for (const row of votes.rows as Row[]) viewerVotes.set(row.element_id, Number(row.option_index));
    }
  }
  for (const row of elementResult.rows as Row[]) {
    const element = mapElement({
      ...row,
      poll_counts: pollCounts.get(row.id),
      response_count: questionCounts.get(row.id) || 0,
      viewer_option_index: viewerVotes.get(row.id),
    });
    const list = output.get(row.story_id) || [];
    list.push(element);
    output.set(row.story_id, list);
  }
  return output;
}

const STORY_SELECT = `
  SELECT s.*,
    u.avatar_url AS owner_avatar,
    (SELECT COUNT(*)::int FROM story_views v WHERE v.story_id=s.id) AS view_count,
    (SELECT COUNT(*)::int FROM story_likes l WHERE l.story_id=s.id) AS like_count,
    (SELECT COUNT(*)::int FROM story_reactions r WHERE r.story_id=s.id) AS reaction_count,
    (SELECT COUNT(*)::int FROM story_replies r WHERE r.story_id=s.id) AS reply_count,
    (SELECT COUNT(*)::int FROM story_poll_votes p WHERE p.story_id=s.id) AS poll_vote_count,
    (SELECT COUNT(*)::int FROM story_question_responses q WHERE q.story_id=s.id) AS question_response_count
  FROM stories s
  LEFT JOIN users u ON u.id=s.owner_user_id
`;

async function viewerFor(storyId: string, viewerId?: string): Promise<StoryViewer | null> {
  if (!viewerId) return null;
  const db = requireDb();
  const [view, like, reaction, votes] = await Promise.all([
    db.query(`SELECT 1 FROM story_views WHERE story_id=$1 AND user_id=$2`, [storyId, viewerId]),
    db.query(`SELECT 1 FROM story_likes WHERE story_id=$1 AND user_id=$2`, [storyId, viewerId]),
    db.query(`SELECT emoji FROM story_reactions WHERE story_id=$1 AND user_id=$2`, [storyId, viewerId]),
    db.query(`SELECT element_id, option_index FROM story_poll_votes WHERE story_id=$1 AND user_id=$2`, [storyId, viewerId]),
  ]);
  const pollVotes: Record<string, number> = {};
  for (const row of votes.rows as Row[]) pollVotes[row.element_id] = Number(row.option_index);
  return {
    viewed: Boolean(view.rowCount),
    liked: Boolean(like.rowCount),
    reaction: reaction.rows[0]?.emoji || null,
    pollVotes,
  };
}

function storyIds(rows: Row[]): string[] {
  return rows.map((row) => String(row.id));
}

async function hydrateStories(rows: Row[], viewerId?: string): Promise<StoryDto[]> {
  const elements = await loadElements(storyIds(rows), viewerId);
  const viewerEntries = viewerId
    ? await Promise.all(rows.map(async (row) => [row.id, await viewerFor(row.id, viewerId)] as const))
    : [];
  const viewers = new Map(viewerEntries);
  return rows.map((row) => mapStory(row, elements.get(row.id) || [], viewers.get(row.id) || null));
}

export async function listPublicStories(viewerId?: string): Promise<StoryDto[]> {
  await expireStories();
  const db = requireDb();
  const result = await db.query(
    `${STORY_SELECT}
      WHERE s.status='active' AND s.moderation_status='approved'
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
        AND (s.visibility='public' OR $1::text <> '')
      ORDER BY s.published_at ASC, s.created_at ASC`,
    [viewerId || ''],
  );
  return hydrateStories(result.rows as Row[], viewerId);
}

export async function getStory(storyId: string, viewerId?: string): Promise<StoryDto | null> {
  const db = requireDb();
  const result = await db.query(`${STORY_SELECT} WHERE s.id=$1`, [storyId]);
  if (!result.rowCount) return null;
  const rows = await hydrateStories(result.rows as Row[], viewerId);
  return rows[0] || null;
}

export async function listMyStories(actor: StoryActor, scope: 'all' | 'active' | 'archive' | 'drafts' = 'all'): Promise<StoryDto[]> {
  await expireStories();
  const db = requireDb();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (actor.role === 'business' && actor.businessId) {
    params.push(actor.businessId);
    conditions.push(`s.business_id = $${params.length}`);
  } else if (actor.role === 'admin') {
    if (await isStoryModerator(actor.userId)) {
      conditions.push('TRUE');
    } else {
      params.push(actor.userId);
      conditions.push(`s.owner_user_id = $${params.length}`);
    }
  } else {
    params.push(actor.userId);
    conditions.push(`s.owner_user_id = $${params.length}`);
  }
  if (scope === 'active') conditions.push(`s.status='active'`);
  if (scope === 'archive') conditions.push(`s.status IN ('expired','removed','suspended')`);
  if (scope === 'drafts') conditions.push(`s.status='draft'`);
  const result = await db.query(
    `${STORY_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY s.created_at DESC LIMIT 300`,
    params,
  );
  return hydrateStories(result.rows as Row[], actor.userId);
}

async function insertElements(client: any, storyId: string, elements: ReturnType<typeof normaliseElement>[]): Promise<void> {
  for (const element of elements) {
    await client.query(
      `INSERT INTO story_elements (id,story_id,element_type,content,position_x,position_y,scale,rotation,z_index)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
      [randomUUID(), storyId, element.type, JSON.stringify(element.content), element.positionX, element.positionY, element.scale, element.rotation, element.zIndex],
    );
  }
}

async function audit(client: any, storyId: string, actorId: string | null, action: string, reason?: string | null, metadata?: unknown): Promise<void> {
  await client.query(
    `INSERT INTO story_audit (id,story_id,actor_user_id,action,reason,metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), storyId, actorId, action, reason || null, JSON.stringify(metadata || {})],
  );
}

export async function createStory(actor: StoryActor, input: StoryInput): Promise<StoryDto> {
  const role = assertPublisher(actor);
  const normalised = normaliseStoryInput(input);
  const db = requireDb();
  if (normalised.publish) {
    const recent = await db.query(
      `SELECT COUNT(*)::int AS total FROM stories
        WHERE owner_user_id=$1 AND published_at IS NOT NULL AND published_at > NOW() - INTERVAL '1 hour'`,
      [actor.userId],
    );
    if (Number(recent.rows[0]?.total || 0) >= MAX_ACTIVE_PER_HOUR) {
      throw new StoryError(429, 'STORY_RATE_LIMITED', 'Publicaste demasiadas stories na última hora. Tenta novamente mais tarde.');
    }
  }
  const id = `story-${randomUUID()}`;
  const shareToken = randomUUID().replace(/-/g, '');
  const status = normalised.publish ? 'active' : 'draft';
  const now = new Date();
  const expiresAt = normalised.publish ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
  const client = await acquireClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO stories
        (id,owner_user_id,owner_role,business_id,business_name,business_logo,story_type,media_url,thumbnail_url,
         caption,duration_ms,background_color,visibility,status,moderation_status,location_id,location_name,
         action_label,action_url,share_token,published_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'approved',$15,$16,$17,$18,$19,$20,$21)`,
      [
        id, actor.userId, role, role === 'business' ? actor.businessId || null : null,
        actor.businessName || actor.name, actor.avatarUrl || null, normalised.storyType,
        normalised.mediaUrl || null, normalised.thumbnailUrl || null, normalised.caption || null,
        normalised.durationMs, normalised.backgroundColor, normalised.visibility, status,
        normalised.locationId || null, normalised.locationName || null,
        normalised.actionLabel || null, normalised.actionUrl || null, shareToken,
        normalised.publish ? now.toISOString() : null, expiresAt,
      ],
    );
    await insertElements(client, id, normalised.elements);
    await audit(client, id, actor.userId, normalised.publish ? 'published' : 'draft_saved');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await releaseClient(client);
  }
  const story = await getStory(id, actor.userId);
  if (!story) throw new StoryError(500, 'STORY_CREATE_FAILED', 'Não foi possível carregar a story criada.');
  return story;
}

async function canManageStory(actor: StoryActor, row: Row): Promise<boolean> {
  if (actor.role === 'admin') return true;
  if (row.owner_user_id === actor.userId) return true;
  return actor.role === 'business' && Boolean(actor.businessId) && row.business_id === actor.businessId;
}

export async function updateStory(actor: StoryActor, storyId: string, input: StoryInput): Promise<StoryDto> {
  assertPublisher(actor);
  const db = requireDb();
  const found = await db.query('SELECT * FROM stories WHERE id=$1', [storyId]);
  if (!found.rowCount) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  if (!(await canManageStory(actor, found.rows[0] as Row))) {
    throw new StoryError(403, 'STORY_SCOPE_REQUIRED', 'Não pode alterar stories de outra empresa.');
  }
  const current = found.rows[0] as Row;
  if (['removed', 'suspended'].includes(current.status)) {
    throw new StoryError(409, 'STORY_NOT_EDITABLE', 'Esta story já não pode ser editada.');
  }
  const normalised = normaliseStoryInput({
    ...input,
    mediaUrl: input.mediaUrl ?? current.media_url,
    storyType: input.storyType || current.story_type,
    durationMs: input.durationMs ?? current.duration_ms,
  });
  const publishNow = Boolean(input.publish) || current.status === 'active';
  const client = await acquireClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE stories SET story_type=$1,media_url=$2,thumbnail_url=$3,caption=$4,duration_ms=$5,
         background_color=$6,visibility=$7,location_id=$8,location_name=$9,action_label=$10,action_url=$11,
         status=$12,published_at=CASE WHEN $12='active' AND published_at IS NULL THEN NOW() ELSE published_at END,
         expires_at=CASE WHEN $12='active' AND $13=TRUE THEN NOW() + INTERVAL '24 hours' ELSE expires_at END,
         updated_at=NOW()
       WHERE id=$14`,
      [
        normalised.storyType, normalised.mediaUrl || null, normalised.thumbnailUrl || null,
        normalised.caption || null, normalised.durationMs, normalised.backgroundColor, normalised.visibility,
        normalised.locationId || null, normalised.locationName || null, normalised.actionLabel || null,
        normalised.actionUrl || null, publishNow ? 'active' : 'draft', publishNow && current.status === 'draft', storyId,
      ],
    );
    if (Array.isArray(input.elements)) {
      await client.query('DELETE FROM story_elements WHERE story_id=$1', [storyId]);
      await insertElements(client, storyId, normalised.elements);
    }
    await audit(client, storyId, actor.userId, publishNow ? 'published' : 'updated');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await releaseClient(client);
  }
  const story = await getStory(storyId, actor.userId);
  if (!story) throw new StoryError(500, 'STORY_UPDATE_FAILED', 'Não foi possível carregar a story actualizada.');
  return story;
}

export async function removeStory(actor: StoryActor, storyId: string): Promise<void> {
  const db = requireDb();
  const found = await db.query('SELECT * FROM stories WHERE id=$1', [storyId]);
  if (!found.rowCount) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  if (!(await canManageStory(actor, found.rows[0] as Row))) {
    throw new StoryError(403, 'STORY_SCOPE_REQUIRED', 'Não pode eliminar stories de outra empresa.');
  }
  const client = await acquireClient();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE stories SET status='removed', archived_at=NOW(), updated_at=NOW() WHERE id=$1`, [storyId]);
    await audit(client, storyId, actor.userId, 'removed');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await releaseClient(client);
  }
}

export async function markStoryViewed(actor: StoryActor, storyId: string): Promise<{ views: number }> {
  const story = await getStory(storyId, actor.userId);
  if (!story) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  const db = requireDb();
  await db.query(
    `INSERT INTO story_views (story_id,user_id) VALUES ($1,$2) ON CONFLICT (story_id,user_id) DO NOTHING`,
    [storyId, actor.userId],
  );
  const count = await db.query('SELECT COUNT(*)::int AS total FROM story_views WHERE story_id=$1', [storyId]);
  return { views: Number(count.rows[0]?.total || 0) };
}

export async function setStoryLike(actor: StoryActor, storyId: string, liked: boolean): Promise<{ liked: boolean; likes: number }> {
  const story = await getStory(storyId, actor.userId);
  if (!story) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  const db = requireDb();
  if (liked) {
    await db.query(`INSERT INTO story_likes (story_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [storyId, actor.userId]);
  } else {
    await db.query(`DELETE FROM story_likes WHERE story_id=$1 AND user_id=$2`, [storyId, actor.userId]);
  }
  const count = await db.query('SELECT COUNT(*)::int AS total FROM story_likes WHERE story_id=$1', [storyId]);
  return { liked, likes: Number(count.rows[0]?.total || 0) };
}

export async function setStoryReaction(actor: StoryActor, storyId: string, emoji: string): Promise<{ reaction: string; reactions: number }> {
  if (!ALLOWED_REACTIONS.has(emoji)) throw new StoryError(400, 'STORY_REACTION_INVALID', 'Reação inválida.');
  const story = await getStory(storyId, actor.userId);
  if (!story) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  const db = requireDb();
  await db.query(
    `INSERT INTO story_reactions (story_id,user_id,emoji) VALUES ($1,$2,$3)
     ON CONFLICT (story_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji, updated_at=NOW()`,
    [storyId, actor.userId, emoji],
  );
  const count = await db.query('SELECT COUNT(*)::int AS total FROM story_reactions WHERE story_id=$1', [storyId]);
  return { reaction: emoji, reactions: Number(count.rows[0]?.total || 0) };
}

export async function replyToStory(actor: StoryActor, storyId: string, message: string): Promise<{ replyId: string; conversationId?: string }> {
  const body = text(message, 1000);
  if (!body) throw new StoryError(400, 'STORY_REPLY_EMPTY', 'Escreve uma resposta antes de enviar.');
  const db = requireDb();
  const result = await db.query(`${STORY_SELECT} WHERE s.id=$1`, [storyId]);
  if (!result.rowCount) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  const story = result.rows[0] as Row;
  let conversationId: string | undefined;
  if (story.business_id && actor.role === 'user') {
    try {
      conversationId = await createPostgresConversation({
        id: `conversation-${randomUUID()}`,
        userId: actor.userId,
        businessId: story.business_id,
        subject: `Resposta ao Story de ${story.business_name}`,
        text: body,
        senderId: actor.userId,
        senderRole: 'user',
      });
    } catch (error) {
      console.error('[Guigui.com] story reply conversation failed:', error instanceof Error ? error.message : error);
    }
  }
  const replyId = `story-reply-${randomUUID()}`;
  await db.query(
    `INSERT INTO story_replies (id,story_id,user_id,text,conversation_id) VALUES ($1,$2,$3,$4,$5)`,
    [replyId, storyId, actor.userId, body, conversationId || null],
  );
  if (story.owner_user_id && story.owner_user_id !== actor.userId) {
    try {
      await persistPostgresNotification({
        id: `notification-${randomUUID()}`,
        userId: story.owner_user_id,
        category: 'story_interaction',
        title: `Nova resposta ao Story de ${story.business_name}`,
        message: body,
        metadata: { storyId, conversationId, actorId: actor.userId, eventType: 'STORY_REPLY' },
      });
    } catch (error) {
      console.error('[Guigui.com] story reply notification failed:', error instanceof Error ? error.message : error);
    }
  }
  return { replyId, conversationId };
}

async function storyElement(storyId: string, elementId: string): Promise<Row> {
  const db = requireDb();
  const result = await db.query('SELECT * FROM story_elements WHERE id=$1 AND story_id=$2', [elementId, storyId]);
  if (!result.rowCount) throw new StoryError(404, 'STORY_ELEMENT_NOT_FOUND', 'Elemento da story não encontrado.');
  return result.rows[0] as Row;
}

export async function voteStoryPoll(actor: StoryActor, storyId: string, elementId: string, optionIndex: number): Promise<{ counts: number[]; optionIndex: number }> {
  const element = await storyElement(storyId, elementId);
  if (element.element_type !== 'poll' && element.element_type !== 'quiz') {
    throw new StoryError(400, 'STORY_POLL_INVALID', 'Este elemento não é uma sondagem.');
  }
  const options = Array.isArray(element.content?.options) ? element.content.options : [];
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
    throw new StoryError(400, 'STORY_POLL_OPTION_INVALID', 'Opção de sondagem inválida.');
  }
  const db = requireDb();
  await db.query(
    `INSERT INTO story_poll_votes (story_id,user_id,element_id,option_index) VALUES ($1,$2,$3,$4)
     ON CONFLICT (story_id,user_id,element_id) DO UPDATE SET option_index=EXCLUDED.option_index, created_at=NOW()`,
    [storyId, actor.userId, elementId, optionIndex],
  );
  const totals = await db.query(
    `SELECT option_index, COUNT(*)::int AS total FROM story_poll_votes WHERE element_id=$1 GROUP BY option_index`,
    [elementId],
  );
  const counts = options.map((_: unknown, index: number) => Number((totals.rows as Row[]).find((row) => Number(row.option_index) === index)?.total || 0));
  return { counts, optionIndex };
}

export async function answerStoryQuestion(actor: StoryActor, storyId: string, elementId: string, response: string): Promise<{ responseId: string }> {
  const element = await storyElement(storyId, elementId);
  if (element.element_type !== 'question') throw new StoryError(400, 'STORY_QUESTION_INVALID', 'Este elemento não é uma caixa de perguntas.');
  const body = text(response, 1000);
  if (!body) throw new StoryError(400, 'STORY_ANSWER_EMPTY', 'Escreve uma resposta antes de enviar.');
  const db = requireDb();
  const id = `story-answer-${randomUUID()}`;
  await db.query(
    `INSERT INTO story_question_responses (id,story_id,element_id,user_id,response) VALUES ($1,$2,$3,$4,$5)`,
    [id, storyId, elementId, actor.userId, body],
  );
  const owner = await db.query('SELECT owner_user_id,business_name FROM stories WHERE id=$1', [storyId]);
  if (owner.rows[0]?.owner_user_id) {
    try {
      await persistPostgresNotification({
        id: `notification-${randomUUID()}`,
        userId: owner.rows[0].owner_user_id,
        category: 'story_interaction',
        title: `Nova resposta a pergunta de ${owner.rows[0].business_name}`,
        message: body,
        metadata: { storyId, elementId, eventType: 'STORY_QUESTION_ANSWER' },
      });
    } catch {
      // A resposta já está guardada; a notificação é uma melhoria não bloqueante.
    }
  }
  return { responseId: id };
}

export async function reportStory(actor: StoryActor, storyId: string, reason: string, details?: string): Promise<{ reportId: string }> {
  if (!ALLOWED_REASONS.has(reason)) throw new StoryError(400, 'STORY_REPORT_REASON_INVALID', 'Motivo de denúncia inválido.');
  const db = requireDb();
  const story = await db.query('SELECT id FROM stories WHERE id=$1', [storyId]);
  if (!story.rowCount) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  const reportId = `story-report-${randomUUID()}`;
  await db.query(
    `INSERT INTO story_reports (id,story_id,reporter_user_id,reason,details) VALUES ($1,$2,$3,$4,$5)`,
    [reportId, storyId, actor.userId, reason, text(details, 1200)],
  );
  const moderators = await db.query(
    `SELECT DISTINCT u.id FROM users u
       JOIN user_roles ur ON ur.user_id=u.id
       JOIN role_permissions rp ON rp.role_id=ur.role_id
       JOIN permissions p ON p.id=rp.permission_id
      WHERE u.role='admin' AND p.name='story_moderation'`,
  );
  for (const row of moderators.rows as Row[]) {
    await persistPostgresNotification({
      id: `notification-${randomUUID()}`,
      userId: row.id,
      category: 'moderation',
      title: 'Nova denúncia de Story',
      message: `Motivo: ${reason}`,
      metadata: { storyId, reportId, eventType: 'STORY_REPORTED' },
    }).catch(() => undefined);
  }
  return { reportId };
}

export async function getStoryStats(actor: StoryActor, storyId: string): Promise<Record<string, unknown>> {
  const db = requireDb();
  const result = await db.query(`${STORY_SELECT} WHERE s.id=$1`, [storyId]);
  if (!result.rowCount) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  const row = result.rows[0] as Row;
  if (!(await canManageStory(actor, row)) && !(actor.role === 'admin' && await isStoryModerator(actor.userId))) {
    throw new StoryError(403, 'STORY_SCOPE_REQUIRED', 'Não pode consultar estatísticas desta story.');
  }
  const [viewers, likes, reactions, replies, polls, questions, byElement] = await Promise.all([
    db.query(
      `SELECT v.user_id AS "userId", u.name, u.avatar_url AS "avatarUrl", v.viewed_at AS "viewedAt"
         FROM story_views v JOIN users u ON u.id=v.user_id WHERE v.story_id=$1 ORDER BY v.viewed_at DESC LIMIT 500`,
      [storyId],
    ),
    db.query(`SELECT user_id AS "userId", created_at AS "createdAt" FROM story_likes WHERE story_id=$1 ORDER BY created_at DESC`, [storyId]),
    db.query(`SELECT user_id AS "userId", emoji, updated_at AS "createdAt" FROM story_reactions WHERE story_id=$1 ORDER BY updated_at DESC`, [storyId]),
    db.query(`SELECT id, user_id AS "userId", text, created_at AS "createdAt" FROM story_replies WHERE story_id=$1 ORDER BY created_at DESC`, [storyId]),
    db.query(
      `SELECT e.id, e.content, p.option_index, COUNT(*)::int AS total
         FROM story_poll_votes p JOIN story_elements e ON e.id=p.element_id
        WHERE p.story_id=$1 GROUP BY e.id, e.content, p.option_index`,
      [storyId],
    ),
    db.query(
      `SELECT q.id, q.user_id AS "userId", q.element_id AS "elementId", q.response, q.created_at AS "createdAt"
         FROM story_question_responses q WHERE q.story_id=$1 ORDER BY q.created_at DESC`,
      [storyId],
    ),
    db.query(
      `SELECT element_id, COUNT(*)::int AS total FROM (
         SELECT element_id FROM story_poll_votes WHERE story_id=$1
         UNION ALL SELECT element_id FROM story_question_responses WHERE story_id=$1
       ) interactions GROUP BY element_id`,
      [storyId],
    ),
  ]);
  return {
    story: mapStory(row, (await loadElements([storyId], actor.userId)).get(storyId) || [], await viewerFor(storyId, actor.userId)),
    counts: mapCounts(row),
    viewers: viewers.rows,
    likes: likes.rows,
    reactions: reactions.rows,
    replies: replies.rows,
    pollVotes: polls.rows,
    questionResponses: questions.rows,
    interactionsByElement: byElement.rows,
  };
}

export async function listHighlights(businessId?: string): Promise<Array<Record<string, unknown>>> {
  const db = requireDb();
  const params: unknown[] = [];
  let where = 'TRUE';
  if (businessId) {
    params.push(businessId);
    where = `h.business_id=$1`;
  }
  const highlights = await db.query(
    `SELECT h.*, (SELECT COUNT(*)::int FROM story_highlight_items i WHERE i.highlight_id=h.id) AS item_count
       FROM story_highlights h WHERE ${where} ORDER BY h.position ASC, h.created_at DESC`,
    params,
  );
  const output: Array<Record<string, unknown>> = [];
  for (const row of highlights.rows as Row[]) {
    const items = await db.query(
      `SELECT s.* FROM story_highlight_items i JOIN stories s ON s.id=i.story_id
        WHERE i.highlight_id=$1 AND s.status IN ('active','expired') ORDER BY i.position ASC, i.added_at ASC`,
      [row.id],
    );
    const stories = await hydrateStories(items.rows as Row[]);
    output.push({
      id: row.id,
      businessId: row.business_id,
      title: row.title,
      coverStoryId: row.cover_story_id,
      position: Number(row.position),
      itemCount: stories.length,
      cover: stories.find((story) => story.id === row.cover_story_id) || stories[0] || null,
      stories,
    });
  }
  return output;
}

export async function createHighlight(actor: StoryActor, input: { title: string; coverStoryId?: string; storyIds?: string[] }): Promise<Record<string, unknown>> {
  assertPublisher(actor);
  const title = text(input.title, 80);
  if (!title) throw new StoryError(400, 'HIGHLIGHT_TITLE_REQUIRED', 'Dá um nome ao destaque.');
  const db = requireDb();
  const id = `highlight-${randomUUID()}`;
  await db.query(
    `INSERT INTO story_highlights (id,owner_user_id,business_id,title,cover_story_id,position)
     VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(position),0)+1 FROM story_highlights WHERE business_id=$3))`,
    [id, actor.userId, actor.businessId || null, title, input.coverStoryId || null],
  );
  if (Array.isArray(input.storyIds)) {
    for (const [index, storyId] of input.storyIds.slice(0, 50).entries()) {
      await addStoryToHighlight(actor, id, storyId, index);
    }
    if (input.coverStoryId) await db.query('UPDATE story_highlights SET cover_story_id=$1 WHERE id=$2', [input.coverStoryId, id]);
  }
  const all = await listHighlights(actor.businessId);
  return all.find((entry) => entry.id === id) || { id, title };
}

async function findHighlight(actor: StoryActor, highlightId: string): Promise<Row> {
  const db = requireDb();
  const result = await db.query('SELECT * FROM story_highlights WHERE id=$1', [highlightId]);
  if (!result.rowCount) throw new StoryError(404, 'HIGHLIGHT_NOT_FOUND', 'Destaque não encontrado.');
  const row = result.rows[0] as Row;
  if (actor.role !== 'admin' && row.owner_user_id !== actor.userId && (!actor.businessId || row.business_id !== actor.businessId)) {
    throw new StoryError(403, 'HIGHLIGHT_SCOPE_REQUIRED', 'Não pode alterar este destaque.');
  }
  return row;
}

export async function updateHighlight(actor: StoryActor, highlightId: string, input: { title?: string; coverStoryId?: string | null; position?: number }): Promise<void> {
  await findHighlight(actor, highlightId);
  const title = input.title === undefined ? undefined : text(input.title, 80);
  if (title === '') throw new StoryError(400, 'HIGHLIGHT_TITLE_REQUIRED', 'Dá um nome ao destaque.');
  const db = requireDb();
  await db.query(
    `UPDATE story_highlights SET title=COALESCE($1,title), cover_story_id=$2, position=COALESCE($3,position), updated_at=NOW() WHERE id=$4`,
    [title || null, input.coverStoryId || null, Number.isFinite(input.position) ? Math.max(0, Number(input.position)) : null, highlightId],
  );
}

export async function addStoryToHighlight(actor: StoryActor, highlightId: string, storyId: string, position?: number): Promise<void> {
  await findHighlight(actor, highlightId);
  const db = requireDb();
  const story = await db.query('SELECT business_id,status FROM stories WHERE id=$1', [storyId]);
  if (!story.rowCount) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  if (actor.role !== 'admin' && story.rows[0].business_id !== actor.businessId) {
    throw new StoryError(403, 'STORY_SCOPE_REQUIRED', 'Só pode adicionar stories da sua empresa.');
  }
  await db.query(
    `INSERT INTO story_highlight_items (highlight_id,story_id,position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [highlightId, storyId, position ?? 0],
  );
}

export async function removeStoryFromHighlight(actor: StoryActor, highlightId: string, storyId: string): Promise<void> {
  await findHighlight(actor, highlightId);
  const db = requireDb();
  await db.query('DELETE FROM story_highlight_items WHERE highlight_id=$1 AND story_id=$2', [highlightId, storyId]);
}

export async function deleteHighlight(actor: StoryActor, highlightId: string): Promise<void> {
  await findHighlight(actor, highlightId);
  const db = requireDb();
  await db.query('DELETE FROM story_highlights WHERE id=$1', [highlightId]);
}

export async function listModerationStories(userId: string, filters: { status?: string; query?: string } = {}): Promise<StoryDto[]> {
  await assertModerator(userId);
  await expireStories();
  const db = requireDb();
  const params: unknown[] = [];
  const where: string[] = ['TRUE'];
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    where.push(`s.status=$${params.length}`);
  }
  if (filters.query?.trim()) {
    params.push(foldedLikePattern(filters.query.trim()));
    where.push(`(${foldedSql('s.business_name')} LIKE $${params.length} OR ${foldedSql('s.caption')} LIKE $${params.length})`);
  }
  const result = await db.query(`${STORY_SELECT} WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC LIMIT 300`, params);
  return hydrateStories(result.rows as Row[], userId);
}

export async function listStoryReports(userId: string, status = 'all'): Promise<Array<Record<string, unknown>>> {
  await assertModerator(userId);
  const db = requireDb();
  const params: unknown[] = [];
  let where = 'TRUE';
  if (status !== 'all') {
    params.push(status);
    where = 'r.status=$1';
  }
  const result = await db.query(
    `SELECT r.*, s.business_name, s.caption, s.status AS story_status, u.name AS reporter_name
       FROM story_reports r
       JOIN stories s ON s.id=r.story_id
       JOIN users u ON u.id=r.reporter_user_id
      WHERE ${where} ORDER BY r.created_at DESC LIMIT 300`,
    params,
  );
  return result.rows;
}

export async function moderateStory(userId: string, storyId: string, action: string, reason?: string): Promise<StoryDto> {
  await assertModerator(userId);
  if (!['approve', 'reject', 'remove', 'suspend', 'restore'].includes(action)) {
    throw new StoryError(400, 'STORY_MODERATION_ACTION_INVALID', 'Ação de moderação inválida.');
  }
  const db = requireDb();
  const current = await db.query('SELECT * FROM stories WHERE id=$1', [storyId]);
  if (!current.rowCount) throw new StoryError(404, 'STORY_NOT_FOUND', 'Story não encontrada.');
  const status = action === 'approve' || action === 'restore' ? 'active' : action === 'reject' ? 'removed' : 'suspended';
  const moderation = action === 'reject' ? 'rejected' : action === 'suspend' ? 'pending' : 'approved';
  const client = await acquireClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE stories SET status=$1, moderation_status=$2, moderation_reason=$3, moderated_by=$4,
         moderated_at=NOW(), archived_at=CASE WHEN $1='removed' THEN NOW() ELSE archived_at END,
         expires_at=CASE WHEN $5='restore' AND (expires_at IS NULL OR expires_at <= NOW()) THEN NOW() + INTERVAL '24 hours' ELSE expires_at END,
         updated_at=NOW()
       WHERE id=$6`,
      [status, moderation, text(reason, 1000), userId, action, storyId],
    );
    await audit(client, storyId, userId, `moderation_${action}`, reason || null);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await releaseClient(client);
  }
  const owner = current.rows[0] as Row;
  if (owner.owner_user_id) {
    await persistPostgresNotification({
      id: `notification-${randomUUID()}`,
      userId: owner.owner_user_id,
      category: 'moderation',
      title: `Story ${action === 'remove' || action === 'reject' ? 'removida' : action === 'suspend' ? 'suspensa' : 'actualizada'} pela moderação`,
      message: text(reason, 1000) || 'Decisão de moderação do Guigui.com.',
      metadata: { storyId, action, eventType: 'STORY_MODERATED' },
    }).catch(() => undefined);
  }
  const story = await getStory(storyId, userId);
  if (!story) throw new StoryError(500, 'STORY_MODERATION_FAILED', 'Não foi possível carregar a story moderada.');
  return story;
}

export async function resolveStoryReport(userId: string, reportId: string, status: string, resolution?: string): Promise<void> {
  await assertModerator(userId);
  if (!['reviewed', 'dismissed', 'actioned'].includes(status)) {
    throw new StoryError(400, 'STORY_REPORT_STATUS_INVALID', 'Estado de denúncia inválido.');
  }
  const db = requireDb();
  const result = await db.query(
    `UPDATE story_reports SET status=$1, reviewed_by=$2, reviewed_at=NOW(), resolution=$3 WHERE id=$4 RETURNING story_id`,
    [status, userId, text(resolution, 1200), reportId],
  );
  if (!result.rowCount) throw new StoryError(404, 'STORY_REPORT_NOT_FOUND', 'Denúncia não encontrada.');
  const client = await acquireClient();
  try {
    await audit(client, result.rows[0].story_id, userId, 'report_resolved', resolution || status, { reportId, status });
  } finally {
    await releaseClient(client);
  }
}

export async function getGlobalStoryStats(userId: string): Promise<Record<string, unknown>> {
  await assertModerator(userId);
  const db = requireDb();
  const [totals, top] = await Promise.all([
    db.query(
      `SELECT
        (SELECT COUNT(*)::int FROM stories) AS total,
        (SELECT COUNT(*)::int FROM stories WHERE status='active') AS active,
        (SELECT COUNT(*)::int FROM stories WHERE status='expired') AS archived,
        (SELECT COUNT(*)::int FROM story_views) AS views,
        (SELECT COUNT(*)::int FROM story_likes) AS likes,
        (SELECT COUNT(*)::int FROM story_replies) AS replies,
        (SELECT COUNT(*)::int FROM story_reports WHERE status='pending') AS pending_reports`,
    ),
    db.query(
      `SELECT s.id,s.business_name,s.caption,s.media_url,s.story_type,
              (SELECT COUNT(*)::int FROM story_views v WHERE v.story_id=s.id) AS views,
              (SELECT COUNT(*)::int FROM story_likes l WHERE l.story_id=s.id) AS likes
         FROM stories s WHERE s.status='active'
        ORDER BY views DESC, likes DESC LIMIT 10`,
    ),
  ]);
  return { ...totals.rows[0], topStories: top.rows };
}

export async function getPublicStoryByToken(token: string): Promise<StoryDto | null> {
  const db = requireDb();
  const result = await db.query(`${STORY_SELECT} WHERE s.share_token=$1 AND s.status='active'`, [token]);
  if (!result.rowCount) return null;
  const rows = await hydrateStories(result.rows as Row[]);
  return rows[0] || null;
}
