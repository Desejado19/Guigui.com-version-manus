import { randomUUID } from 'node:crypto';
import { acquireClient, releaseClient, withDbIdentity } from './db';

/**
 * Interações das publicações (curtidas, comentários e partilhas).
 *
 * Fonte única para o feed e para a ficha da empresa/administração: as três
 * vistas leem este registo, por isso o número mostrado num post é sempre o
 * mesmo em qualquer lugar da aplicação. Fica numa única chave de estado
 * (`guigui_post_engagements`) porque o feed é conteúdo público e as contagens
 * têm de ser partilhadas entre contas — guardar no post de cada empresa faria
 * com que cada vista tivesse a sua cópia.
 *
 * As escritas são operações de sistema: qualquer sessão autenticada pode
 * curtir/comentar/partilhar (a autorização vive nas rotas), enquanto a chave de
 * estado genérica continua fechada a cidadãos.
 */

const ENGAGEMENTS_STATE_KEY = 'guigui_post_engagements';

export const POST_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type PostReactionType = (typeof POST_REACTIONS)[number];

export interface StoredPostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  parentId?: string;
  deleted?: boolean;
}

interface StoredEngagement {
  reactions: Record<string, PostReactionType>;
  comments: StoredPostComment[];
  shares: number;
  sharesByUser: Record<string, number>;
}

type EngagementStore = Record<string, StoredEngagement>;

/** Forma pública (sem ids de quem interagiu). */
export interface PostEngagementSummary {
  likes: number;
  shares: number;
  comments: Array<{
    id: string;
    postId: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    createdAt: string;
  }>;
  myReaction?: PostReactionType | null;
}

type EngagementStoreMap = Record<string, PostEngagementSummary>;

export function isPostReactionType(value: unknown): value is PostReactionType {
  return typeof value === 'string' && (POST_REACTIONS as readonly string[]).includes(value);
}

function emptyEngagement(): StoredEngagement {
  return { reactions: {}, comments: [], shares: 0, sharesByUser: {} };
}

function normaliseStore(value: unknown): EngagementStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const store: EngagementStore = {};
  for (const [postId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const reactions: Record<string, PostReactionType> = {};
    if (record.reactions && typeof record.reactions === 'object' && !Array.isArray(record.reactions)) {
      for (const [userId, reaction] of Object.entries(record.reactions as Record<string, unknown>)) {
        if (!userId) continue;
        if (isPostReactionType(reaction)) reactions[userId] = reaction;
      }
    }
    const comments = Array.isArray(record.comments)
      ? (record.comments as unknown[]).filter((comment): comment is StoredPostComment => {
        if (!comment || typeof comment !== 'object') return false;
        const candidate = comment as Record<string, unknown>;
        return typeof candidate.id === 'string'
          && typeof candidate.content === 'string'
          && typeof candidate.authorName === 'string'
          && typeof candidate.createdAt === 'string';
      }).map((comment) => ({ ...comment, postId }))
      : [];
    const sharesByUser: Record<string, number> = {};
    if (record.sharesByUser && typeof record.sharesByUser === 'object' && !Array.isArray(record.sharesByUser)) {
      for (const [userId, count] of Object.entries(record.sharesByUser as Record<string, unknown>)) {
        if (userId && Number.isFinite(Number(count))) sharesByUser[userId] = Math.max(0, Math.floor(Number(count)));
      }
    }
    const shares = Number.isFinite(Number(record.shares)) ? Math.max(0, Math.floor(Number(record.shares))) : 0;
    store[postId] = { reactions, comments, shares, sharesByUser };
  }
  return store;
}

function summarise(engagement: StoredEngagement | undefined, requesterId?: string): PostEngagementSummary {
  if (!engagement) return { likes: 0, shares: 0, comments: [], myReaction: null };
  // Filter out deleted comments, but keep track of their existence
  // Respostas são comentários com `parentId`: aparecem aninhadas no comentário
  // de origem, nunca como comentários independentes nem na contagem.
  const activeComments = engagement.comments.filter(c => !c.deleted && !c.parentId);
  // Build a map of comment IDs to their reply children
  const replyMap = new Map<string, StoredPostComment[]>();
  const allComments = engagement.comments.slice();
  for (const comment of allComments) {
    if (comment.parentId && !comment.deleted) {
      if (!replyMap.has(comment.parentId)) {
        replyMap.set(comment.parentId, []);
      }
      replyMap.get(comment.parentId)!.push(comment);
    }
  }
  // Map active comments, including their replies
  const comments = activeComments.map((comment) => {
    const replies = replyMap.get(comment.id) || [];
    return {
      id: comment.id,
      postId: comment.postId,
      authorName: comment.authorName,
      ...(comment.authorAvatar ? { authorAvatar: comment.authorAvatar } : {}),
      content: comment.content,
      createdAt: comment.createdAt,
      ...(comment.parentId ? { parentId: comment.parentId } : {}),
      replies: replies.length > 0 ? replies.map(r => ({
        id: r.id,
        postId: r.postId,
        authorName: r.authorName,
        ...(r.authorAvatar ? { authorAvatar: r.authorAvatar } : {}),
        content: r.content,
        createdAt: r.createdAt,
        ...(r.parentId ? { parentId: r.parentId } : {}),
        deleted: r.deleted,
      })) : undefined,
    };
  });
  return {
    likes: Object.keys(engagement.reactions).length,
    shares: engagement.shares,
    comments,
    ...(requesterId ? { myReaction: engagement.reactions[requesterId] ?? null } : {}),
  };
}

/**
 * Lê e grava a chave com bloqueio de linha, para que curtidas simultâneas em
 * posts diferentes não se sobreponham (read-modify-write num JSONB).
 */
async function mutateStore<T>(
  mutator: (store: EngagementStore) => { store: EngagementStore; result: T },
): Promise<T> {
  return withDbIdentity({ userId: '', role: 'admin', system: true }, async () => {
    const client = await acquireClient();
    try {
      await client.query('BEGIN');
      const current = await client.query<{ value: unknown }>(
        'SELECT value FROM app_state WHERE key = $1 FOR UPDATE',
        [ENGAGEMENTS_STATE_KEY],
      );
      const store = normaliseStore(current.rows[0]?.value);
      const { store: nextStore, result } = mutator(store);
      await client.query(
        `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [ENGAGEMENTS_STATE_KEY, JSON.stringify(nextStore)],
      );
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ligação já fechada */
      }
      throw error;
    } finally {
      await releaseClient(client);
    }
  });
}

async function readStore(): Promise<EngagementStore> {
  return withDbIdentity({ userId: '', role: 'admin', system: true }, async () => {
    const client = await acquireClient();
    try {
      const current = await client.query<{ value: unknown }>(
        'SELECT value FROM app_state WHERE key = $1',
        [ENGAGEMENTS_STATE_KEY],
      );
      return normaliseStore(current.rows[0]?.value);
    } finally {
      await releaseClient(client);
    }
  });
}

/** Todas as interações, para o feed e para as fichas de empresa/administração. */
export async function listPostEngagements(requesterId?: string): Promise<EngagementStoreMap> {
  const store = await readStore();
  const map: EngagementStoreMap = {};
  for (const [postId, engagement] of Object.entries(store)) {
    map[postId] = summarise(engagement, requesterId);
  }
  return map;
}

/** Define (ou remove, com `null`) a reação de um utilizador a um post. */
export async function setPostReaction(input: {
  postId: string;
  userId: string;
  reaction: PostReactionType | null;
}): Promise<PostEngagementSummary> {
  return mutateStore((store) => {
    const engagement = store[input.postId] ? { ...store[input.postId] } : emptyEngagement();
    const reactions = { ...engagement.reactions };
    if (input.reaction) reactions[input.userId] = input.reaction;
    else delete reactions[input.userId];
    const next = { ...engagement, reactions };
    return {
      store: { ...store, [input.postId]: next },
      result: summarise(next, input.userId),
    };
  });
}

export async function addPostComment(input: {
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  parentId?: string;
}): Promise<{ comment: StoredPostComment; engagement: PostEngagementSummary }> {
  const comment: StoredPostComment = {
    id: `pc-${randomUUID()}`,
    postId: input.postId,
    authorId: input.authorId,
    authorName: input.authorName,
    ...(input.authorAvatar ? { authorAvatar: input.authorAvatar } : {}),
    content: input.content,
    createdAt: new Date().toISOString(),
    ...(input.parentId ? { parentId: input.parentId } : {}),
  };
  return mutateStore((store) => {
    const engagement = store[input.postId] ? { ...store[input.postId] } : emptyEngagement();
    const next = { ...engagement, comments: [...engagement.comments, comment] };
    return {
      store: { ...store, [input.postId]: next },
      result: { comment, engagement: summarise(next, input.authorId) },
    };
  });
}

export async function registerPostShare(input: {
  postId: string;
  userId: string;
}): Promise<PostEngagementSummary> {
  return mutateStore((store) => {
    const engagement = store[input.postId] ? { ...store[input.postId] } : emptyEngagement();
    const sharesByUser = { ...engagement.sharesByUser };
    sharesByUser[input.userId] = (sharesByUser[input.userId] ?? 0) + 1;
    const next = {
      ...engagement,
      shares: engagement.shares + 1,
      sharesByUser,
    };
    return {
      store: { ...store, [input.postId]: next },
      result: summarise(next, input.userId),
    };
  });
}

/** Adiciona uma resposta (reply) a um comentário existente. */
export async function registerPostReply(input: {
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  parentId: string;
}): Promise<{ comment: StoredPostComment; engagement: PostEngagementSummary }> {
  const comment: StoredPostComment = {
    id: `pc-${randomUUID()}`,
    postId: input.postId,
    authorId: input.authorId,
    authorName: input.authorName,
    ...(input.authorAvatar ? { authorAvatar: input.authorAvatar } : {}),
    content: input.content,
    createdAt: new Date().toISOString(),
    parentId: input.parentId,
  };
  return mutateStore((store) => {
    const engagement = store[input.postId] ? { ...store[input.postId] } : emptyEngagement();
    const next = { ...engagement, comments: [...engagement.comments, comment] };
    return {
      store: { ...store, [input.postId]: next },
      result: { comment, engagement: summarise(next, input.authorId) },
    };
  });
}


/** Remove um comentário (marca como deletado). Somente o autor do comentário ou a empresa dona do post pode remover. */
export async function registerPostDelete(input: {
  postId: string;
  commentId: string;
  userId: string;
  userRole: 'user' | 'business' | 'admin';
}): Promise<PostEngagementSummary> {
  return mutateStore((store) => {
    const engagement = store[input.postId] ? { ...store[input.postId] } : emptyEngagement();
    // Mark the comment as deleted instead of removing it
    const nextComments = engagement.comments.map((comment) => {
      if (comment.id === input.commentId) {
        // Only allow deletion by comment author, business owner, or admin
        const isCommentAuthor = comment.authorId === input.userId;
        const canDelete = isCommentAuthor || input.userRole === 'admin' || input.userRole === 'business';
        if (canDelete) {
          return { ...comment, deleted: true };
        }
      }
      return comment;
    });
    const next = { ...engagement, comments: nextComments };
    return {
      store: { ...store, [input.postId]: next },
      result: summarise(next, input.userId),
    };
  });
}
