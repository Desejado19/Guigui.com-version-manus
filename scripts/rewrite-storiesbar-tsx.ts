import fs from 'node:fs';

const storiesBarContent = `import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Story, Business, UserRole, UserProfile, Language } from '../types';

export interface StoriesBarProps {
  stories: Story[];
  businesses: Business[];
  onTabChange: (tab: unknown) => void;
  currentUser?: UserProfile | null;
  currentRole?: UserRole;
  onAddStory?: (story: Story) => void;
  onRequireLogin?: () => void;
  onStoryComment?: (payload: {
    story: Story;
    text: string;
    businessId: string;
    businessName: string;
    authorName: string;
    authorId: string;
  }) => void;
  currentLang: Language;
}

const StoryPreview = ({
  story,
  currentLang,
  onClick,
}: {
  story: Story;
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
        <div
          className={\`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 bg-white \${story.isUnread ? 'border-emerald-500 ring-2 ring-emerald-400' : 'border-slate-300'}\`}
        >
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
        <span className="relative z-10 text-xs font-bold leading-tight text-white drop-shadow-md truncate">
          {story.businessName || 'Empresa'}
        </span>
      </div>
    </button>
  );
};

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories,
  currentUser,
  currentRole,
  onAddStory,
  onRequireLogin,
}) => {
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const canCreateStory =
    !!currentUser && ['business', 'admin'].includes(currentRole ?? '');

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2.5 overflow-hidden py-1 px-1">
        {canCreateStory && (
          <button
            type="button"
            onClick={onAddStory}
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

        {stories.map((story, idx) => (
          <StoryPreview
            key={\`\${story.id}-preview\`}
            story={story}
            currentLang={currentRole ?? 'pt'}
            onClick={() => setSelectedStoryIndex(idx)}
          />
        ))}
      </div>

      {selectedStoryIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-[28px] bg-white p-2 shadow-2xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setSelectedStoryIndex(null)}
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 transition hover:bg-white dark:bg-slate-800 dark:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
            <StoryPreview
              story={stories[selectedStoryIndex]}
              currentLang={currentRole ?? 'pt'}
              onClick={() => {}}
            />
            <div className="mt-3 text-center text-xs text-slate-600 dark:text-slate-300">
              {stories[selectedStoryIndex]?.businessName && (
                <strong>{stories[selectedStoryIndex].businessName}</strong>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesBar;
`;

fs.writeFileSync(
  'src/components/StoriesBar.tsx',
  storiesBarContent,
  'utf8'
);

console.log('StoriesBar.tsx rewritten successfully');
