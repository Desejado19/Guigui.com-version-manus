export type StoryElementType =
  | 'text' | 'emoji' | 'sticker' | 'poll' | 'question' | 'quiz' | 'countdown'
  | 'link' | 'mention' | 'hashtag' | 'location' | 'music' | 'cta';

export interface StoryElementApi {
  id: string;
  type: StoryElementType;
  content: Record<string, any>;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  zIndex: number;
  pollCounts?: number[];
  viewerOptionIndex?: number | null;
  responseCount?: number;
}

export interface StoryApi {
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
  elements: StoryElementApi[];
  createdAt: string;
  publishedAt?: string | null;
  expiresAt?: string | null;
  archivedAt?: string | null;
  isUnread?: boolean;
  counts: {
    views: number; uniqueViews: number; likes: number; reactions: number; replies: number;
    pollVotes: number; questionResponses: number; shares: number; engagementRate: number;
  };
  viewer?: {
    viewed: boolean;
    liked: boolean;
    reaction?: string | null;
    pollVotes: Record<string, number>;
  };
}

export interface StoryHighlightApi {
  id: string;
  businessId?: string | null;
  title: string;
  coverStoryId?: string | null;
  position: number;
  itemCount: number;
  cover?: StoryApi | null;
  stories: StoryApi[];
}

export interface StoryInputApi {
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
  elements?: Array<{
    type: StoryElementType;
    content?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
    scale?: number;
    rotation?: number;
    zIndex?: number;
  }>;
  publish?: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Não foi possível concluir a operação de Stories.');
  }
  return payload as T;
}

export const storyApi = {
  list: () => request<{ stories: StoryApi[] }>('/api/stories'),
  mine: (scope: 'all' | 'active' | 'archive' | 'drafts' = 'all') =>
    request<{ stories: StoryApi[] }>(`/api/stories/mine?scope=${scope}`),
  get: (id: string) => request<{ story: StoryApi }>(`/api/stories/${encodeURIComponent(id)}`),
  share: (token: string) => request<{ story: StoryApi }>(`/api/stories/share/${encodeURIComponent(token)}`),
  create: (input: StoryInputApi) => request<{ story: StoryApi }>('/api/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }),
  update: (id: string, input: StoryInputApi) => request<{ story: StoryApi }>(`/api/stories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }),
  remove: (id: string) => request<{ success: boolean }>(`/api/stories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  view: (id: string) => request<{ views: number }>(`/api/stories/${encodeURIComponent(id)}/view`, { method: 'POST' }),
  like: (id: string, liked: boolean) => request<{ liked: boolean; likes: number }>(`/api/stories/${encodeURIComponent(id)}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ liked }),
  }),
  react: (id: string, emoji: string) => request<{ reaction: string; reactions: number }>(`/api/stories/${encodeURIComponent(id)}/reaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji }),
  }),
  reply: (id: string, text: string) => request<{ replyId: string }>(`/api/stories/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }),
  recordShare: (id: string) => request<{ shares: number }>(`/api/stories/${encodeURIComponent(id)}/share`, { method: 'POST' }),
  vote: (id: string, elementId: string, optionIndex: number) => request<{ counts: number[]; optionIndex: number }>(`/api/stories/${encodeURIComponent(id)}/poll-vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elementId, optionIndex }),
  }),
  answer: (id: string, elementId: string, response: string) => request<{ responseId: string }>(`/api/stories/${encodeURIComponent(id)}/question-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elementId, response }),
  }),
  report: (id: string, reason: string, details?: string) => request<{ reportId: string }>(`/api/stories/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, details }),
  }),
  stats: (id: string) => request<Record<string, any>>(`/api/stories/${encodeURIComponent(id)}/stats`),
  highlights: (businessId?: string) => request<{ highlights: StoryHighlightApi[] }>(
    `/api/story-highlights${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ''}`,
  ),
  createHighlight: (input: { title: string; coverStoryId?: string; storyIds?: string[] }) =>
    request<{ highlight: StoryHighlightApi }>('/api/story-highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  updateHighlight: (id: string, input: { title?: string; coverStoryId?: string | null }) =>
    request<{ success: boolean }>(`/api/story-highlights/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  deleteHighlight: (id: string) => request<{ success: boolean }>(`/api/story-highlights/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addHighlightItem: (id: string, storyId: string) =>
    request<{ success: boolean }>(`/api/story-highlights/${encodeURIComponent(id)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId }),
    }),
  removeHighlightItem: (id: string, storyId: string) =>
    request<{ success: boolean }>(`/api/story-highlights/${encodeURIComponent(id)}/items/${encodeURIComponent(storyId)}`, { method: 'DELETE' }),
  adminList: (filters: { status?: string; query?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.query) params.set('q', filters.query);
    return request<{ stories: StoryApi[] }>(`/api/admin/stories?${params.toString()}`);
  },
  adminReports: (status = 'all') => request<{ reports: any[] }>(`/api/admin/story-reports?status=${encodeURIComponent(status)}`),
  adminResolveReport: (id: string, status: string, resolution?: string) =>
    request<{ success: boolean }>(`/api/admin/story-reports/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution }),
    }),
  adminModerate: (id: string, action: string, reason?: string) =>
    request<{ story: StoryApi }>(`/api/admin/stories/${encodeURIComponent(id)}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    }),
  adminStats: () => request<Record<string, any>>('/api/admin/story-stats'),
};

export async function uploadStoryAsset(file: File): Promise<{ url: string; kind: 'image' | 'video' }> {
  const response = await fetch('/api/stories/assets', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar o ficheiro.');
  return payload;
}
