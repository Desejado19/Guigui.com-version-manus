import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import type { Business, Language, Story, UserProfile } from '../types';
import { StoryModal } from './StoryModal';
import { StoryComposer } from './StoryComposer';
import { StoriesManagementHub } from './StoriesManagementHub';
import { filterActiveStories, groupStoriesByBusiness } from '../utils/stories';
import { storyApi, type StoryHighlightApi } from '../services/storyApi';

export interface StoriesBarProps {
  stories: Story[];
  businesses: Business[];
  onTabChange: (tab: unknown) => void;
  currentUser?: UserProfile | null;
  currentRole?: 'user' | 'business' | 'admin';
  onAddStory?: (story: Story) => void;
  onRequireLogin?: (notice?: string) => void;
  onStoryComment?: (payload: {
    story: Story; text: string; businessId: string; businessName: string;
    authorName: string; authorId: string;
  }) => void;
  onStoryViewed?: (story: Story) => void;
  onManageStories?: () => void;
  onStoriesChanged?: () => void;
  currentLang: Language;
}

function StoryCircle({ story, seen, count, admin, label, onClick }: {
  story: Story; seen: boolean; count: number; admin?: boolean; label?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="story-ring"
      data-seen={seen ? 'true' : 'false'}
      className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center"
      aria-label={`Ver story de ${label || story.businessName}`}
    >
      <span className={`relative rounded-full p-[2.5px] transition ${admin ? 'bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-700' : seen ? 'bg-slate-300 dark:bg-slate-600' : 'bg-gradient-to-br from-amber-400 via-rose-500 to-violet-600'}`}>
        <span className="flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-white dark:border-slate-900 dark:bg-slate-800">
          {story.businessLogo ? <img src={story.businessLogo} alt="" className="h-full w-full object-cover" /> : <span className="text-lg font-black text-slate-600 dark:text-slate-200">{story.businessName.charAt(0)}</span>}
        </span>
        {count > 1 && <span className="absolute -bottom-0.5 -right-0.5 min-w-[18px] rounded-full bg-slate-900 px-1 py-0.5 text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900">{count}</span>}
        {!seen && <span role="img" className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" aria-label="Story nova" />}
      </span>
      <span className="line-clamp-2 max-w-[76px] text-[10px] font-bold leading-tight text-slate-700 dark:text-slate-200">{label || story.businessName}</span>
    </button>
  );
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories, currentUser, onAddStory, onRequireLogin, onStoryViewed,
  onManageStories, onStoriesChanged,
}) => {
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [highlights, setHighlights] = useState<StoryHighlightApi[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<StoryHighlightApi | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharedStory, setSharedStory] = useState<Story | null>(null);
  const canCreateStory = currentUser?.role === 'business' || currentUser?.role === 'admin';
  const visibleStories = useMemo(() => filterActiveStories(stories), [stories]);
  const groups = useMemo(() => groupStoriesByBusiness(visibleStories, currentUser?.id), [visibleStories, currentUser?.id]);

  useEffect(() => {
    let cancelled = false;
    storyApi.highlights(currentUser?.role === 'business' ? currentUser.businessId : undefined)
      .then((result) => { if (!cancelled) setHighlights(result.highlights || []); })
      .catch(() => { if (!cancelled) setHighlights([]); });
    return () => { cancelled = true; };
  }, [currentUser?.businessId, currentUser?.role, stories.length]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('story');
    if (!token) return;
    let cancelled = false;
    storyApi.share(token)
      .then((result) => { if (!cancelled) setSharedStory(result.story as unknown as Story); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const openGroup = (index: number) => { setActiveGroupIndex(index); };

  const activeGroup = activeGroupIndex == null ? null : groups[activeGroupIndex] || null;
  const highlightPlaying = activeHighlight?.stories?.length ? activeHighlight : null;

  return (
    <section className="w-full rounded-2xl border border-[var(--color-border-subtle)] bg-white px-2 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Stories">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">Stories</h2>
          <p className="text-[10px] font-medium text-slate-500">Empresas e administração · 24 horas</p>
        </div>
        <div className="flex items-center gap-1.5">
          {canCreateStory && (
            <button type="button" onClick={() => setComposerOpen(true)} className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" /> Criar story
            </button>
          )}
          {canCreateStory && (
            <button type="button" onClick={() => onManageStories ? onManageStories() : setManagerOpen(true)} className="flex items-center gap-1 rounded-full border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[10px] font-black text-slate-600 dark:border-slate-700 dark:text-slate-300" aria-label="Gerir stories">
              <Settings2 className="h-3.5 w-3.5" /> Gerir
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-nowrap items-start gap-3 overflow-x-auto px-1 pb-1">
        {canCreateStory && (
          <button type="button" onClick={() => setComposerOpen(true)} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5">
            <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-dashed border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Plus className="h-6 w-6" /></span>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">O seu story</span>
          </button>
        )}

        {highlights.map((highlight) => highlight.cover && (
          <StoryCircle
            key={highlight.id}
            story={highlight.cover as unknown as Story}
            seen={false}
            count={highlight.itemCount}
            admin={highlight.cover.ownerRole === 'admin'}
            label={highlight.title}
            onClick={() => setActiveHighlight(highlight)}
          />
        ))}

        {groups.map((group, index) => (
          <StoryCircle
            key={group.key}
            story={group.latestStory}
            seen={!group.hasUnseen}
            count={group.stories.length}
            admin={group.latestStory.ownerRole === 'admin'}
            onClick={() => openGroup(index)}
          />
        ))}

        {groups.length === 0 && highlights.length === 0 && (
          <p className="px-2 py-4 text-[11px] font-medium text-slate-500">Ainda não há stories ativas. As empresas podem publicar a partir da sua área.</p>
        )}
      </div>

      {notice && <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      {activeGroup && (
        <StoryModal
          key={activeGroup.key}
          stories={activeGroup.stories}
          initialStoryIndex={0}
          currentUser={currentUser}
          onRequireLogin={onRequireLogin}
          onStoryViewed={onStoryViewed}
          onClose={() => setActiveGroupIndex(null)}
          onNextProfile={() => {
            if (activeGroupIndex == null) return;
            if (activeGroupIndex < groups.length - 1) setActiveGroupIndex(activeGroupIndex + 1);
            else setActiveGroupIndex(null);
          }}
          onPrevProfile={() => {
            if (activeGroupIndex == null) return;
            if (activeGroupIndex > 0) setActiveGroupIndex(activeGroupIndex - 1);
          }}
        />
      )}

      {highlightPlaying && (
        <StoryModal
          key={highlightPlaying.id}
          stories={highlightPlaying.stories as unknown as Story[]}
          initialStoryIndex={0}
          currentUser={currentUser}
          onRequireLogin={onRequireLogin}
          onStoryViewed={onStoryViewed}
          onClose={() => setActiveHighlight(null)}
        />
      )}

      {sharedStory && (
        <StoryModal
          stories={[sharedStory]}
          initialStoryIndex={0}
          currentUser={currentUser}
          onRequireLogin={onRequireLogin}
          onStoryViewed={onStoryViewed}
          onClose={() => {
            setSharedStory(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('story');
            window.history.replaceState({}, '', url.pathname + url.search);
          }}
        />
      )}

      {managerOpen && currentUser && (
        <StoriesManagementHub
          currentUser={currentUser}
          onClose={() => setManagerOpen(false)}
          onStoryPublished={onAddStory}
        />
      )}

      {composerOpen && currentUser && (
        <StoryComposer
          open={composerOpen}
          currentUser={currentUser}
          onClose={() => setComposerOpen(false)}
          onNotice={(message) => setNotice(message)}
          onPublished={(story) => {
            onAddStory?.(story);
            setNotice('Story publicada. Já está visível na faixa.');
            onStoriesChanged?.();
          }}
        />
      )}
    </section>
  );
};

export default StoriesBar;
