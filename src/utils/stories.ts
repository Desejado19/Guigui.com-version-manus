/**
 * Utilitários das stories no estilo Instagram: agrupamento por empresa,
 * estado visto/não visto por utilizador, carimbos temporais robustos e
 * expiração de 24 horas (aplicada apenas a datas ISO parseáveis, para não
 * destruir as seeds com texto relativo tipo "Há 1 hora").
 */
import type { Story } from '../types';

export const STORY_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const STORY_DEFAULT_DURATION_MS = 5_000;

const RELATIVE_STORY_PATTERN = /^h[áa]\s+(\d+)\s*(minuto|minutos|hora|horas|dia|dias)/i;

/** Converte `createdAt` (ISO ou texto relativo) para epoch ms; `null` se desconhecido. */
export function parseStoryTimestamp(createdAt: string | undefined): number | null {
  const text = (createdAt || '').trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return parsed;
  const relative = text.match(RELATIVE_STORY_PATTERN);
  if (relative) {
    const value = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const ms = unit.startsWith('min') ? 60_000 : unit.startsWith('hora') ? 3_600_000 : STORY_EXPIRY_MS;
    return Date.now() - value * ms;
  }
  return null;
}

/** Rótulo curto do cabeçalho da story: "Há 12 h", "Há 3 min", "Agora"… */
export function storyTimestampLabel(createdAt: string | undefined): string {
  const text = (createdAt || '').trim();
  if (!text) return 'Agora';
  if (RELATIVE_STORY_PATTERN.test(text)) return text;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return text;
  const minutes = Math.floor(Math.max(0, Date.now() - ms) / 60_000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  return `Há ${Math.floor(hours / 24)} d`;
}

/** Uma story conta como vista se o utilizador a viu (`seenBy`); sem sessão, usa `isUnread`. */
export function isStorySeen(story: Story, userId?: string | null): boolean {
  if (userId && Array.isArray(story.seenBy)) return story.seenBy.includes(userId);
  return story.isUnread === false;
}

/** Remove stories com mais de 24 h quando a data é parseável (seeds relativas ficam visíveis). */
export function filterActiveStories(stories: Story[], now = Date.now()): Story[] {
  return stories.filter((story) => {
    const time = parseStoryTimestamp(story.createdAt);
    if (time === null) return true;
    return now - time < STORY_EXPIRY_MS;
  });
}

export interface StoryGroup {
  /** Identificador estável do grupo (empresa); não muda quando a ordem muda. */
  key: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  /** Stories em ordem cronológica (a mais antiga primeiro, como no Instagram). */
  stories: Story[];
  /** Story mais recente, usada como miniatura da faixa. */
  latestStory: Story;
  hasUnseen: boolean;
  latestAt: number;
}

/** Agrupa stories por empresa: não vistas primeiro, depois por recência; dentro do grupo, por ordem cronológica. */
export function groupStoriesByBusiness(stories: Story[], userId?: string | null): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  for (const story of stories) {
    const key = story.businessId || story.businessName || 'unknown';
    const time = parseStoryTimestamp(story.createdAt) ?? 0;
    const existing = groups.get(key);
    if (existing) {
      existing.stories.push(story);
      existing.latestAt = Math.max(existing.latestAt, time);
      if (!isStorySeen(story, userId)) existing.hasUnseen = true;
      if (time >= (parseStoryTimestamp(existing.latestStory.createdAt) ?? 0)) existing.latestStory = story;
    } else {
      groups.set(key, {
        key,
        businessId: story.businessId,
        businessName: story.businessName,
        businessLogo: story.businessLogo,
        stories: [story],
        latestStory: story,
        hasUnseen: !isStorySeen(story, userId),
        latestAt: time,
      });
    }
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      stories: [...group.stories].sort(
        (left, right) => (parseStoryTimestamp(left.createdAt) ?? 0) - (parseStoryTimestamp(right.createdAt) ?? 0),
      ),
    }))
    .sort((left, right) => Number(right.hasUnseen) - Number(left.hasUnseen) || right.latestAt - left.latestAt);
}