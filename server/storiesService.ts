import { randomUUID } from 'node:crypto';
import { rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface StoredStory {
  id: string;
  businessId: string;
  businessName: string;
  businessLogo: string;
  imageUrl?: string;
  mediaUrl?: string;
  storyType?: 'image' | 'video' | 'text';
  caption?: string;
  createdAt: string;
  isUnread?: boolean;
  seenBy?: string[];
  comments?: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
  }>;
}

const STORIES_FILE = join(process.cwd(), 'public', 'uploads', 'stories.json');

function readStories(): StoredStory[] {
  try {
    const raw = readFileSync(STORIES_FILE, 'utf8');
    return JSON.parse(raw) as StoredStory[];
  } catch {
    return [];
  }
}

function writeStories(stories: StoredStory[]): void {
  const dir = join(process.cwd(), 'public', 'uploads');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2), 'utf8');
}

export async function createStory(story: Omit<StoredStory, 'id'>): Promise<StoredStory> {
  const stored: StoredStory = {
    ...story,
    id: 'story-' + randomUUID(),
  };
  const current = readStories();
  writeStories([stored, ...current.filter((s) => s.id !== stored.id)]);
  return stored;
}

export async function listStories(businessId?: string): Promise<StoredStory[]> {
  const current = readStories();
  if (!businessId) return current;
  return current.filter((s) => s.businessId === businessId);
}

export async function appendComment(
  storyId: string,
  comment: StoredStory['comments'][0],
): Promise<StoredStory | null> {
  const current = readStories();
  const idx = current.findIndex((s) => s.id === storyId);
  if (idx < 0) return null;
  const next = Object.assign({}, current[idx]);
  next.comments = Array.from(new Set([...(next.comments || []), comment]));
  current[idx] = next;
  writeStories(current);
  return next;
}

export async function markSeen(storyId: string, userId: string): Promise<StoredStory | null> {
  const current = readStories();
  const idx = current.findIndex((s) => s.id === storyId);
  if (idx < 0) return null;
  const next = Object.assign({}, current[idx]);
  next.seenBy = Array.from(new Set([...(next.seenBy || []), userId]));
  next.isUnread = false;
  current[idx] = next;
  writeStories(current);
  return next;
}

export function resolveStoryAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return url;
  if (existsSync(join(process.cwd(), 'public', 'uploads', url))) {
    return '/uploads/' + url;
  }
  return url;
}
