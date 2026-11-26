import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PostComment, ReactionType } from '../types';

/**
 * Estado partilhado das interações das publicações.
 *
 * O feed, a ficha da empresa e a administração leem o MESMO mapa vindo do
 * servidor (`/api/posts/engagements`), por isso o número de curtidas,
 * comentários e partilhas de um post é igual em qualquer lugar da aplicação.
 * Cada curtida/ comentário/ partilha é gravada no servidor e a resposta já
 * traz o resumo atualizado, que substitui o valor em memória.
 *
 * O servidor avisa todos os clientes por SSE (`/api/posts/engagements/stream`)
 * quando uma interação é gravada, por isso a alteração feita por outro
 * utilizador aparece de imediato, sem recarregar a página.
 */

export interface PostEngagement {
  likes: number;
  shares: number;
  comments: PostComment[];
  myReaction: ReactionType | null;
}

interface PostEngagementContextValue {
  engagements: Record<string, PostEngagement>;
  loading: boolean;
  refresh: () => Promise<void>;
  react: (postId: string, reaction: ReactionType | null) => Promise<void>;
  comment: (postId: string, text: string) => Promise<PostComment | null>;
  reply: (postId: string, parentId: string, text: string) => Promise<PostComment | null>;
  share: (postId: string) => Promise<void>;
}

const PostEngagementContext = createContext<PostEngagementContextValue | null>(null);

interface RawEngagement {
  likes?: unknown;
  shares?: unknown;
  comments?: unknown;
  myReaction?: unknown;
}

function toComment(postId: string, raw: Record<string, unknown>): PostComment {
  const replies = Array.isArray(raw.replies)
    ? raw.replies
      .filter((reply): reply is Record<string, unknown> => Boolean(reply) && typeof reply === 'object')
      .map((reply) => toComment(postId, reply))
    : [];
  return {
    id: String(raw.id ?? ''),
    postId: typeof raw.postId === 'string' ? raw.postId : postId,
    authorName: String(raw.authorName ?? 'Utilizador'),
    ...(typeof raw.authorAvatar === 'string' && raw.authorAvatar ? { authorAvatar: raw.authorAvatar } : {}),
    content: String(raw.content ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    ...(typeof raw.parentId === 'string' && raw.parentId ? { parentId: raw.parentId } : {}),
    ...(replies.length > 0 ? { replies } : {}),
  };
}

export function normaliseEngagement(postId: string, raw: RawEngagement | null | undefined): PostEngagement {
  if (!raw || typeof raw !== 'object') {
    return { likes: 0, shares: 0, comments: [], myReaction: null };
  }
  const comments = Array.isArray(raw.comments)
    ? raw.comments
      .filter((comment): comment is Record<string, unknown> => Boolean(comment) && typeof comment === 'object')
      .map((comment) => toComment(postId, comment))
    : [];
  return {
    likes: Number.isFinite(Number(raw.likes)) ? Math.max(0, Number(raw.likes)) : 0,
    shares: Number.isFinite(Number(raw.shares)) ? Math.max(0, Number(raw.shares)) : 0,
    comments,
    myReaction: typeof raw.myReaction === 'string' ? raw.myReaction as ReactionType : null,
  };
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  return payload.error || fallback;
}

export const PostEngagementProvider: React.FC<{
  currentUserId?: string | null;
  children: React.ReactNode;
}> = ({ currentUserId, children }) => {
  const [engagements, setEngagements] = useState<Record<string, PostEngagement>>({});
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const apply = useCallback((postId: string, raw: RawEngagement | null | undefined) => {
    if (!mounted.current) return;
    setEngagements((previous) => ({ ...previous, [postId]: normaliseEngagement(postId, raw) }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/posts/engagements', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as { engagements?: Record<string, RawEngagement> };
      if (!mounted.current || !payload.engagements) return;
      const next: Record<string, PostEngagement> = {};
      for (const [postId, raw] of Object.entries(payload.engagements)) {
        next[postId] = normaliseEngagement(postId, raw);
      }
      setEngagements(next);
    } catch {
      // Sem rede mantém-se o último mapa conhecido.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, currentUserId]);

  // Outros utilizadores também interagem: o servidor avisa por SSE e o mapa é
  // recarregado de imediato, sem polling periódico. Se a ligação cair, a
  // reconexão automática do EventSource faz um refresh para recuperar o atraso.
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let source: EventSource | null = null;
    let hadError = false;

    const schedule = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), 120);
    };

    const connect = () => {
      source = new EventSource('/api/posts/engagements/stream');
      source.addEventListener('engagements', schedule);
      source.addEventListener('ready', () => {
        if (hadError) {
          hadError = false;
          schedule();
        }
      });
      source.addEventListener('error', () => { hadError = true; });
    };

    connect();
    return () => {
      if (debounce) clearTimeout(debounce);
      source?.close();
    };
  }, [refresh]);

  const react = useCallback(async (postId: string, reaction: ReactionType | null) => {
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/reaction`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Não foi possível registar a reação.'));
    const payload = await response.json() as { engagement?: RawEngagement };
    apply(postId, payload.engagement);
  }, [apply]);

  const comment = useCallback(async (postId: string, text: string): Promise<PostComment | null> => {
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Não foi possível guardar o comentário.'));
    const payload = await response.json() as { comment?: Record<string, unknown>; engagement?: RawEngagement };
    apply(postId, payload.engagement);
    return payload.comment ? toComment(postId, payload.comment) : null;
  }, [apply]);

  const reply = useCallback(async (postId: string, parentId: string, text: string): Promise<PostComment | null> => {
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments/reply`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parentId }),
    });
    if (!response.ok) throw new Error(await readError(response, 'Não foi possível guardar a resposta.'));
    const payload = await response.json() as { comment?: Record<string, unknown>; engagement?: RawEngagement };
    apply(postId, payload.engagement);
    return payload.comment ? toComment(postId, payload.comment) : null;
  }, [apply]);

  const share = useCallback(async (postId: string) => {
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/share`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(await readError(response, 'Não foi possível registar a partilha.'));
    const payload = await response.json() as { engagement?: RawEngagement };
    apply(postId, payload.engagement);
  }, [apply]);

  const value = useMemo(
    () => ({ engagements, loading, refresh, react, comment, reply, share }),
    [engagements, loading, refresh, react, comment, reply, share],
  );

  return <PostEngagementContext.Provider value={value}>{children}</PostEngagementContext.Provider>;
};

export function usePostEngagementContext(): PostEngagementContextValue | null {
  return useContext(PostEngagementContext);
}

/** Interações de um post; `null` quando o componente corre fora do provider. */
export function usePostEngagement(postId: string | null | undefined): PostEngagement | null {
  const context = usePostEngagementContext();
  if (!context || !postId) return null;
  return context.engagements[postId] ?? null;
}
