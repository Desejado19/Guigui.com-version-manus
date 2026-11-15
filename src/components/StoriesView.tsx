import React, { useEffect, useRef, useState } from 'react';
import { Heart, Send, Share2 } from 'lucide-react';
import { Story, UserProfile } from '../types';
import { StoryInteractionCounts, useStoryInteractionCounts } from '../hooks/useStoryInteractionCounts';
import { canViewStories, getRequireLoginMessage } from '../utils/businessPermissions';

interface StoriesViewProps {
  stories: Story[];
  currentUser?: UserProfile | null;
  openStory: (story: Story) => void;
}

const AUTOPLAY_HZ = 1 / 5; /* 5 s por story, igual ao StoryModal */

/** Obtém mensagem de login requerida baseada no role */
const getStoryRequireLoginMessage = (currentUser?: UserProfile | null, currentRole?: string | null): string => {
  if (currentRole === 'admin' || currentRole === 'business') {
    return 'Apenas contas de empresa e de administração publicam stories. Pode continuar a ver as stories das empresas.';
  }
  // Cidadão - pode ver stories
  return 'Acesse sua conta para interagir com stories.';
};

export const StoriesView: React.FC<StoriesViewProps> = ({
  stories,
  currentUser,
  openStory,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [continueOnClick, setContinueOnClick] = useState(false);
  const counts = useStoryInteractionCounts();
  const story = stories[currentIndex] ?? stories[0] ?? null;
  const storyId = story?.id;
  const interactionCounts = counts.counts[storyId] ?? { likes: 0, comments: 0, shares: 0 };
  const currentRole = currentUser?.role;

  const toggleLiked = (next: boolean) => {
    if (!storyId) return;
    setLiked(next);
    counts.setLikeDelta(storyId, next ? 1 : -1);
  };

  const setCommentCount = (delta: number) => {
    if (!storyId) return;
    counts.setCommentDelta(storyId, delta);
  };

  const setShareCount = (delta: number) => {
    if (!storyId) return;
    counts.setShareDelta(storyId, delta);
  };

  const submitComment = () => {
    const text = commentText.trim();
    if (!text || !currentUser || !storyId) return;
    
    // Verificação de permissão - cidadão pode comentar, business/admin também
    if (currentUser) {
      // Permitir comentários para business, admin e citizen
      setCommentCount(1);
    }
    setCommentText('');
    setIsTyping(false);
    setContinueOnClick(false);
  };

  const handleShare = () => {
    if (!storyId) return;
    setShareCount(1);
  };

  const handlePauseToggle = () => {
    setContinueOnClick((prev) => !prev);
  };

  useEffect(() => {
    if (!story) return;
    counts.setLikeDelta(storyId ?? '', 0);
  }, [storyId]);

  useEffect(() => {
    if (!story) return;
    counts.setLikeDelta(storyId ?? '', interactionCounts.likes - (counts.counts[storyId ?? '']?.likes ?? 0));
    counts.setCommentDelta(storyId ?? '', interactionCounts.comments - (counts.counts[storyId ?? '']?.comments ?? 0));
    counts.setShareDelta(storyId ?? '', interactionCounts.shares - (counts.counts[storyId ?? '']?.shares ?? 0));
  }, [interactionCounts, storyId]);

  useEffect(() => {
    setLiked(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!story) return;
    openStory(story);
  }, [currentIndex, story, openStory]);

  useEffect(() => {
    if (!story) return;
    const storyEl = document.getElementById('stories-autoplay-root');
    if (!storyEl) return;
    if (isTyping || continueOnClick) {
      storyEl.classList.add('stories-paused');
      storyEl.classList.remove('stories-running');
    } else {
      storyEl.classList.remove('stories-paused');
      storyEl.classList.add('stories-running');
    }
  }, [isTyping, continueOnClick]);

  const increaseLike = () => {
    const next = !liked;
    toggleLiked(next);
  };

  return (
    <div className="stories-view stack gap-2 mt-2 mb-2">
      {stories.map((s) => (
        <div
          key={s.id}
          onClick={() => {
            setCurrentIndex(stories.indexOf(s));
          }}
        >
          {s.businessName}
          {s.imageUrl ? (
            <img src={s.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
              {s.businessName.charAt(0)}
            </div>
          )}
        </div>
      ))}
      {story && (
        <div
          id="stories-autoplay-root"
          className="border border-slate-700 rounded-xl w-full max-w-sm mx-auto mt-2 p-3 bg-slate-900 text-white shadow-inner relative stories-paused"
        >
          {story.imageUrl && (
            <img src={story.imageUrl} alt="" className="w-full h-44 object-cover rounded-lg" />
          )}
          {story.caption && <p className="text-sm mt-2">{story.caption}</p>}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              {/* Like button - visible to all roles */}
              {storyId && (
                <button
                  type="button"
                  onClick={increaseLike}
                  aria-pressed={liked}
                  className={`btn ${liked ? 'btn-active' : 'btn-opaque'}`}
                >
                  <Heart className={liked ? 'fill-red-500' : ''} text-lg />{' '}
                  {interactionCounts.likes}
                </button>
              )}
              
              {/* Share button - visible to all roles */}
              <button type="button" onClick={handleShare} className="btn btn-opaque">
                <Share2 className="text-lg" /> {interactionCounts.shares}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-md">
              {/* Comment input - visible to all roles with proper labeling */}
              {storyId && (
                <input
                  value={commentText}
                  onChange={(e) => {
                    setCommentText(e.target.value);
                    if (e.target.value) {
                      setIsTyping(true);
                    } else {
                      setIsTyping(false);
                    }
                  }}
                  placeholder="Comentario..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/60 outline-none"
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                />
              )}
              
              {/* Submit comment button */}
              <button
                type="button"
                onClick={submitComment}
                className="btn btn-primary text-sm px-3 whitespace-nowrap"
              >
                Enviar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePauseToggle}
            className="mt-3 w-full border border-dashed border-white/20 text-white/60 text-left text-xs px-3 py-2 rounded-lg hover:bg-white/5"
          >
            {continueOnClick ? 'Continuar stories' : 'Pausar stories'}
          </button>

          <button
            type="button"
            className="mt-3 w-full border border-dashed border-white/20 text-white/60 text-left text-xs px-3 py-2 rounded-lg hover:bg-white/5"
          >
            Ver todos os {interactionCounts.comments + (story.comments?.length ?? 0)} comentarios
          </button>
        </div>
      )}
    </div>
  );
};
