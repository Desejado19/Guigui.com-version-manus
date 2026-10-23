
const PRESET_IMAGES = [
  { label: 'Coqueiros', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80' },
  { label: 'Peixe grelhado', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80' },
  { label: 'Farmácia', url: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=800&q=80' },
  { label: 'Clínica', url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80' },
];

const PRESET_VIDEOS = [
  { label: 'Eventos', thumbnail: 'https://images.unsplash.com/photo-1517849845537-4d2574be8cfc?auto=format&fit=crop&w=800&q=80', url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { label: 'Protocolo', thumbnail: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=800&q=80', url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { label: 'Rota', thumbnail: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { label: 'Cultura', thumbnail: 'https://images.unsplash.com/photo-1517849845537-4d2574be8cfc?auto=format&fit=crop&w=800&q=80', url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
];

import React, { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Story, Business, UserRole, UserProfile, Language } from '../types';
import { StoryModal } from './StoryModal';
import { filterActiveStories, groupStoriesByBusiness } from '../utils/stories';

export interface StoriesBarProps {
  stories: Story[];
  businesses: Business[];
  onTabChange: (tab: unknown) => void;
  currentUser?: UserProfile | null;
  currentRole?: UserRole;
  onAddStory?: (story: Story) => void;
  onRequireLogin?: (notice?: string) => void;
  onStoryComment?: (payload: {
    story: Story;
    text: string;
    businessId: string;
    businessName: string;
    authorName: string;
    authorId: string;
  }) => void;
  /** Marca a story como vista pelo utilizador actual (anel passa a cinzento). */
  onStoryViewed?: (story: Story) => void;
  currentLang: Language;
}

const StoryPreview = ({
  story,
  seen,
  storyCount = 1,
  currentLang,
  onClick,
}: {
  story: Story;
  /** `true` quando o utilizador actual já viu todas as stories do grupo. */
  seen: boolean;
  storyCount?: number;
  currentLang: Language;
  onClick: () => void;
}) => {
  const caption = story.caption || '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-36 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-sm transition hover:border-emerald-400 hover:shadow-md sm:h-40 sm:w-28"
    >
      {story.storyType === 'video' && story.mediaUrl ? (
        <video
          src={story.mediaUrl}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
      ) : story.imageUrl || story.mediaUrl ? (
        <img
          src={story.imageUrl || story.mediaUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-300"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-2 text-center text-xs font-bold text-white">
          {caption || 'Story'}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
      <div className="relative z-10 flex h-full flex-col justify-between p-2.5">
        <div className="relative">
          <div
            data-testid="story-ring"
            data-seen={seen ? 'true' : 'false'}
            className={`rounded-full p-[2px] ${seen ? 'bg-slate-300 dark:bg-slate-600' : 'bg-gradient-to-br from-amber-400 via-rose-500 to-violet-500'}`}
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white">
          {story.businessLogo ? (
            <img
              src={story.businessLogo}
              alt=""
              className="block h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="block h-full w-full align-middle text-center text-[10px] font-black uppercase text-slate-600">
              {story.businessName?.charAt(0)}
            </span>
          )}
            </div>
          </div>
          {storyCount > 1 && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/85 px-1.5 py-px text-[9px] font-black text-white">
              {storyCount}
            </span>
          )}
        </div>
        <span className="relative z-10 text-xs font-bold leading-tight text-white drop-shadow-md truncate">
          {story.businessName || 'Empresa'}
        </span>
      </div>
    </button>
  );
};

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories,
  businesses,
  currentUser,
  onAddStory,
  onRequireLogin,
  onStoryComment,
  onStoryViewed,
  currentLang,
}) => {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const visibleStories = useMemo(() => filterActiveStories(stories), [stories]);
  const groups = useMemo(
    () => groupStoriesByBusiness(visibleStories, currentUser?.id),
    [visibleStories, currentUser?.id],
  );
  const activeGroup = activeGroupId ? groups.find((group) => group.key === activeGroupId) ?? null : null;
  const [showCreator, setShowCreator] = useState(false);
  const [creativeMode, setCreativeMode] = useState<'image' | 'video' | 'text'>('image');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [creatorNotice, setCreatorNotice] = useState<string | null>(null);

  const activeBusiness = currentUser?.role === 'business' && currentUser.businessId
    ? businesses.find((business) => business.id === currentUser.businessId) || null
    : null;

  const subscriptionActive = (user: UserProfile | null, business?: Business | null): boolean => {
    if (user?.role === 'admin') return true;
    if (user?.role === 'business') {
      if (!business) return false;
      if (business.status === 'suspended' || business.subscriptionStatus === 'suspended') return false;
      const renew = new Date(business.subscriptionRenewDate || '').getTime();
      return renew > Date.now() && business.subscriptionStatus === 'active';
    }
    if (user?.subscriptionStatus === 'active') {
      const renew = new Date(user.subscriptionRenewDate || '').getTime();
      return renew > Date.now() || !user.subscriptionRenewDate;
    }
    return false;
  };

  const canCreateStory = !!currentUser && subscriptionActive(currentUser, activeBusiness);

  const resetCreativeState = () => {
    setCreativeMode('image');
    setImageUrl(null);
    setVideoUrl(null);
    setCustomUrl('');
    setCaption('');
    setCreatorNotice(null);
  };

  const closeCreator = () => {
    resetCreativeState();
    setShowCreator(false);
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2.5 overflow-hidden py-1 px-1">
        {canCreateStory && (
          <button
            type="button"
            onClick={() => {
              resetCreativeState();
              setShowCreator(true);
            }}
            className="group relative flex h-36 w-24 shrink-0 flex-col items-center justify-between overflow-hidden rounded-2xl border border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-2.5 shadow-sm transition hover:border-emerald-500 hover:shadow-md sm:h-40 sm:w-28"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <Plus className="h-5 w-5" />
            </div>
            <div className="text-center">
              <div className="text-xs font-black text-slate-900">Criar Story</div>
              <div className="mt-1 text-[10px] text-slate-500">Foto, vídeo ou texto</div>
            </div>
          </button>
        )}

        {groups.map((group) => (
          <StoryPreview
            key={group.key}
            story={group.latestStory}
            seen={!group.hasUnseen}
            storyCount={group.stories.length}
            currentLang={currentLang}
            onClick={() => setActiveGroupId(group.key)}
          />
        ))}
      </div>

      {activeGroup && (
        <StoryModal
          stories={activeGroup.stories}
          initialStoryIndex={0}
          onClose={() => setActiveGroupId(null)}
          currentUser={currentUser}
          onRequireLogin={onRequireLogin}
          onStoryComment={onStoryComment}
          onStoryViewed={onStoryViewed}
        />
      )}

      {showCreator && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {canCreateStory ? (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Criar Story</h2>
              <button
                type="button"
                onClick={closeCreator}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                aria-label="Fechar criador de stories"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              Só pode publicar stories com uma conta paga, empresa ou administração.
            </p>
          )}

          {creatorNotice && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {creatorNotice}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 mt-3">
            {(['image', 'video', 'text'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCreativeMode(mode)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition capitalize ${
                  creativeMode === mode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {mode === 'image' ? 'Foto' : mode === 'video' ? 'Vídeo' : 'Texto'}
              </button>
            ))}
          </div>
          {creativeMode === 'image' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Imagem de destaque</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_IMAGES.map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setImageUrl(img.url)}
                    className={`rounded-xl border overflow-hidden transition ${
                      imageUrl === img.url ? 'border-emerald-500 ring-2 ring-emerald-500' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <img src={img.url} alt={img.label} className="h-20 w-full object-cover" />
                  </button>
                ))}
              </div>
              <input
                value={customUrl}
                onChange={(event) => setCustomUrl(event.target.value)}
                placeholder="Ou insere a URL de uma imagem..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}
          {creativeMode === 'video' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Vídeo de destaque</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_VIDEOS.map((vid, index) => (
                  <button
                    key={`${vid.label}-${index}`}
                    type="button"
                    onClick={() => setVideoUrl(vid.url)}
                    className={`rounded-xl border overflow-hidden transition ${
                      videoUrl === vid.url ? 'border-emerald-500 ring-2 ring-emerald-500' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <img src={vid.thumbnail} alt={vid.label} className="h-20 w-full object-cover" />
                  </button>
                ))}
              </div>
              <input
                value={customUrl}
                onChange={(event) => setCustomUrl(event.target.value)}
                placeholder="Ou insere a URL de um vídeo..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          {creativeMode === 'text' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Texto para a story</p>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={4}
                placeholder="O que queres partilhar?"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={closeCreator}
              className="rounded-xl px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!currentUser || !subscriptionActive(currentUser, activeBusiness)) {
                  onRequireLogin?.('Publicar uma story requer sessão e um plano de pagamento ativo (cidadão pago, empresa ou admin).');
                  return;
                }
                setPosting(true);
                const trimmedCustomUrl = customUrl.trim();
                const resolvedImageUrl =
                  creativeMode === 'image'
                    ? trimmedCustomUrl || imageUrl
                    : null;
                const resolvedVideoUrl =
                  creativeMode === 'video'
                    ? trimmedCustomUrl || videoUrl
                    : null;
                if (creativeMode !== 'text' && !resolvedImageUrl && !resolvedVideoUrl) {
                  setPosting(false);
                  setCreatorNotice('Escolhe uma imagem ou vídeo de destaque, ou insere uma URL válida.');
                  return;
                }
                const payload: Story = {
                  id: `story-${Date.now()}`,
                  businessId: currentUser.businessId || '',
                  businessName: currentUser.businessName || currentUser.name,
                  businessLogo: currentUser.avatarUrl || '',
                  storyType: resolvedVideoUrl ? 'video' : resolvedImageUrl ? 'image' : 'text',
                  imageUrl: resolvedImageUrl || undefined,
                  mediaUrl: resolvedVideoUrl || undefined,
                  caption: caption.trim() || undefined,
                  createdAt: new Date().toISOString(),
                  isUnread: true,
                };
                onAddStory?.(payload);
                closeCreator();
                setPosting(false);
              }}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={posting}
            >
              {posting ? 'A publicar...' : 'Publicar Story'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesBar;