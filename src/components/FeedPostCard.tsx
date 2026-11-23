import React, { useEffect, useRef, useState } from 'react';
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  ExternalLink,
  Send,
  Building2,
  Heart,
  Smile,
  Zap,
  Play,
  Video,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { BusinessPost, ReactionType, Business, Language, PostComment, UserProfile } from '../types';
import { usePostEngagementContext } from './PostEngagementProvider';
import { PostCommentsSheet } from './feed/PostCommentsSheet';

const formatPostDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
import { useTranslatedText } from '../utils/contentTranslation';
import { getTranslation } from '../utils/i18n';

const MOBILE_QUERY = '(max-width: 767px)';

/** Decide entre o painel inferior (mobile) e a secção inline (desktop). */
const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return isMobile;
};

interface FeedPostCardProps {
  post: BusinessPost;
  business?: Business;
  currentLang: Language;
  onSelectBusiness?: (business: Business) => void;
  currentUser?: UserProfile | null;
  onRequireLogin?: (notice?: string) => void;
  isHighlighted?: boolean;
}

export const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  business,
  currentLang,
  onSelectBusiness,
  currentUser,
  onRequireLogin,
  isHighlighted = false,
}) => {
  const engagementContext = usePostEngagementContext();
  const engagement = engagementContext?.engagements[post.id];
  const isMobileViewport = useIsMobileViewport();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<ReactionType | null>(post.userReaction || null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsList, setCommentsList] = useState(post.comments || []);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sharesCount, setSharesCount] = useState(post.sharesCount || 0);
  const [activeMediaGalleryIndex, setActiveMediaGalleryIndex] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);
  const t = (key: string) => getTranslation(currentLang, key);
  const { translated: translatedTitle } = useTranslatedText(post.title, currentLang, 'title');
  const { translated: translatedContent } = useTranslatedText(post.content, currentLang, 'content');

  useEffect(() => {
    if (!isHighlighted) return;
    articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isHighlighted]);

  // Os números vêm do registo partilhado no servidor: o mesmo post mostra a
  // mesma contagem no feed, na ficha da empresa e no painel de gestão.
  useEffect(() => {
    if (!engagement) return;
    setSelectedReaction(engagement.myReaction ?? null);
    setCommentsList(engagement.comments);
    setSharesCount(engagement.shares);
  }, [engagement]);

  // Helpers to detect embeddable video links
  const getEmbedVideoUrl = (url?: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) {
      const id = url.split('watch?v=')[1]?.split('&')[0];
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (url.includes('vimeo.com/')) {
      const id = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  };

  const isDirectVideo = (url?: string) => {
    if (!url) return false;
    return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov') || url.includes('video');
  };

  // Contagem real de gostos (sem valores simulados).
  const baseLikes = engagement?.likes ?? post.likesCount ?? 0;
  const currentTotalLikes = baseLikes;

  const reactionsList: { type: ReactionType; emoji: string; label: string; color: string }[] = [
    { type: 'like', emoji: '👍', label: 'Gostar', color: 'text-[#0B5ED7] dark:text-[#8AB4FF]' },
    { type: 'love', emoji: '❤️', label: 'Amei', color: 'text-red-500' },
    { type: 'haha', emoji: '😂', label: 'Riso', color: 'text-amber-500' },
    { type: 'wow', emoji: '😮', label: 'Uau', color: 'text-amber-500' },
    { type: 'sad', emoji: '😢', label: 'Triste', color: 'text-amber-500' },
    { type: 'angry', emoji: '😡', label: 'Bravo', color: 'text-orange-600' },
  ];

  const handleSelectReaction = async (type: ReactionType) => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta (Cidadão ou Empresa) para curtir publicações.');
      return;
    }

    const nextReaction = selectedReaction === type ? null : type;
    const previousReaction = selectedReaction;
    setSelectedReaction(nextReaction);
    setShowReactionPicker(false);
    if (!engagementContext) return;
    try {
      await engagementContext.react(post.id, nextReaction);
    } catch (error) {
      setSelectedReaction(previousReaction);
      onRequireLogin?.(error instanceof Error ? error.message : 'Não foi possível registar a reação.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta (Cidadão ou Empresa) para comentar publicações.');
      return;
    }

    const text = newCommentText.trim();
    if (!text || !engagementContext) return;

    setNewCommentText('');
    try {
      await engagementContext.comment(post.id, text);
    } catch (error) {
      setNewCommentText(text);
      onRequireLogin?.(error instanceof Error ? error.message : 'Não foi possível guardar o comentário.');
    }
  };

  const handleAddReply = async (event: React.FormEvent, parentId: string) => {
    event.preventDefault();
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta (Cidadão ou Empresa) para responder a comentários.');
      return;
    }
    const text = (replyDrafts[parentId] ?? '').trim();
    if (!text || !engagementContext) return;
    try {
      await engagementContext.reply(post.id, parentId, text);
      setReplyDrafts((previous) => ({ ...previous, [parentId]: '' }));
      setReplyTarget(null);
    } catch (error) {
      onRequireLogin?.(error instanceof Error ? error.message : 'Não foi possível guardar a resposta.');
    }
  };

  const handleShareWhatsApp = async () => {
    const shareText = `Vi no Guigui.com (${post.businessName}): "${translatedTitle}"\n\n${translatedContent}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: translatedTitle,
          text: shareText,
          url: window.location.href,
        });
        setSharesCount((prev) => prev + 1);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    const text = encodeURIComponent(`${shareText}\n\n${window.location.href}`);
    const shareWindow = window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
    if (shareWindow) setSharesCount((prev) => prev + 1);
    // Regista a partilha no servidor para alimentar as métricas da empresa.
    if (currentUser && engagementContext) {
      engagementContext.share(post.id).catch(() => {});
    }
  };

  const openComments = () => {
    setCommentsOpen(true);
    setReplyTarget(null);
  };

  const closeComments = () => setCommentsOpen(false);

  const renderCommentRow = (comment: PostComment, depth: number) => (
    <div className={`flex items-start gap-2.5 ${depth > 0 ? 'ml-8' : ''}`}>
      <img
        src={comment.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
        alt=""
        className="w-7 h-7 rounded-full object-cover border border-[var(--color-border-subtle)] flex-shrink-0"
      />
      <div className="bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-[var(--color-border-subtle)] p-2.5 rounded-2xl flex-1 shadow-2xs">
        <div className="font-extrabold text-slate-900 dark:text-slate-300 text-xs">{comment.authorName}</div>
        <p className="text-slate-700 mt-0.5 text-xs">{comment.content}</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold mt-1">
          {depth === 0 && (
            <button
              type="button"
              onClick={() => setReplyTarget(replyTarget === comment.id ? null : comment.id)}
              className="hover:underline text-[#1877F2]"
            >
              Responder
            </button>
          )}
          <span>{formatPostDate(comment.createdAt)}</span>
        </div>
      </div>
    </div>
  );
  return (
    <article ref={articleRef} data-post-id={post.id} className={`bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-[var(--color-border-subtle)] rounded-3xl shadow-sm overflow-hidden text-slate-800 dark:text-slate-300 space-y-3 transition hover:border-[var(--color-border-default)] ${isHighlighted ? 'ring-4 ring-emerald-400 ring-offset-4 ring-offset-slate-50' : ''}`}>
      {/* Post Author Header */}
      <div className="p-4 sm:p-5 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            onClick={() => business && onSelectBusiness?.(business)}
            className="w-11 h-11 rounded-2xl overflow-hidden border border-[var(--color-border-subtle)] cursor-pointer flex-shrink-0"
          >
            <img
              src={post.businessLogo || business?.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80'}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                onClick={() => business && onSelectBusiness?.(business)}
                className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white hover:underline cursor-pointer"
              >
                {post.businessName}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-600 text-white shrink-0" />
            </div>

            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>📍 {post.neighborhood || business?.neighborhood || t("business.Todos")}</span>
              <span>•</span>
              <span>{post.mediaType === 'video' ? `🎬 ${t('business.VideoComercial')}` : post.mediaType === 'gallery' ? `📸 ${t('business.Galeria')}` : t('business.Publicacao')}</span>
              {post.createdAt && <>
                <span>•</span>
                <time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time>
              </>}
            </div>
          </div>
        </div>

        <button type="button" aria-label="Mais opções da publicação" className="text-slate-500 hover:text-slate-600 p-1.5 rounded-full hover:bg-[var(--color-bg-surface)] dark:hover:bg-[var(--color-bg-surface-dark)]">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Post Text Content */}
      <div className="px-4 sm:px-5 space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-300 leading-relaxed">
        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">{translatedTitle}</h3>
        <p className="whitespace-pre-line text-slate-700">{translatedContent}</p>
        <div className="text-[11px] text-emerald-700 font-bold pt-1 flex items-center gap-2 flex-wrap">
          <span>#Guigui</span>
          <span>#GuiguiCom</span>
          <span>#{post.businessName.split(' ')[0]}</span>
          {post.isPlanSubscriberPost && (
            <span className="text-amber-600 font-bold flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" /> Conteúdo Patrocinado
            </span>
          )}
        </div>
      </div>

      {/* Video Content Display */}
      {post.videoUrl && (
        <div className="px-3 sm:px-4">
          <div className="w-full bg-black rounded-2xl overflow-hidden shadow-sm relative">
            {getEmbedVideoUrl(post.videoUrl) ? (
              <iframe
                src={getEmbedVideoUrl(post.videoUrl)!}
                title={translatedTitle}
                className="w-full aspect-video border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={post.videoUrl}
                controls
                className="w-full max-h-[420px] object-cover"
                poster={post.imageUrl}
              />
            )}
            <div className="absolute top-3 left-3 bg-black/70 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/20">
              <Video className="w-3 h-3 text-red-400" />
              <span>Vídeo HD • Plano Guigui</span>
            </div>
          </div>
        </div>
      )}

      {/* Photo Gallery Display */}
      {post.mediaGallery && post.mediaGallery.length > 0 && !post.videoUrl && (
        <div className="px-3 sm:px-4 space-y-2">
          {/* Main Selected Image */}
          <div className="w-full bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] rounded-2xl overflow-hidden max-h-[400px] border border-[var(--color-border-subtle)]">
            <img
              src={post.mediaGallery[activeMediaGalleryIndex] || post.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          {/* Thumbnails list */}
          {post.mediaGallery.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {post.mediaGallery.map((imgUrl, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setActiveMediaGalleryIndex(idx)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                    activeMediaGalleryIndex === idx
                      ? 'border-blue-600 scale-105 shadow-xs'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              <span className="text-[10px] font-bold text-slate-500 pl-1 shrink-0">
                {post.mediaGallery.length} fotos
              </span>
            </div>
          )}
        </div>
      )}

      {/* Single Post Image Banner (if not gallery and not video) */}
      {post.imageUrl && !post.videoUrl && (!post.mediaGallery || post.mediaGallery.length <= 1) && (
        <div className="w-full bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] overflow-hidden max-h-[420px] relative cursor-pointer" onClick={() => business && onSelectBusiness?.(business)}>
          <img
            src={post.imageUrl}
            alt=""
            className="w-full h-full object-cover hover:scale-[1.01] transition duration-300"
          />
        </div>
      )}

      {/* Reactions & Comments Count Bar */}
      <div className="px-3.5 sm:px-4 py-2 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <span aria-hidden="true" className="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[9px]">👍</span>
            <span aria-hidden="true" className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px]">❤️</span>
          </div>
          <span className="font-bold text-slate-700 ml-1" data-testid="post-likes">{currentTotalLikes}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <button type="button" onClick={openComments} className="hover:underline" data-testid="post-comments">
            {commentsList.length} Comentários
          </button>
          <span>•</span>
          <span data-testid="post-shares">{sharesCount} Partilhas</span>
        </div>
      </div>

      {/* Facebook Action Bar (Like, Comment, Share WhatsApp, Ver Ficha) */}
      <div className="px-2 sm:px-4 relative flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-100 pb-1">
        {/* Reaction Hover Picker Box */}
        {showReactionPicker && (
          <div className="absolute -top-12 left-2 z-30 bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-[var(--color-border-subtle)] rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2 animate-in zoom-in-95 duration-150">
            {reactionsList.map((r) => (
              <button
                type="button"
                key={r.type}
                onClick={() => handleSelectReaction(r.type)}
                className="text-xl hover:scale-125 transition-transform p-1"
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}

        {/* Like Button */}
        <button
          type="button"
          onMouseEnter={() => setShowReactionPicker(true)}
          onClick={() => handleSelectReaction(selectedReaction ? selectedReaction : 'like')}
          className={`flex-1 py-2 rounded-xl hover:bg-[#F0F2F5] transition flex items-center justify-center gap-1.5 ${
            selectedReaction
              ? reactionsList.find((r) => r.type === selectedReaction)?.color || 'text-[#0B5ED7] dark:text-[#8AB4FF]'
              : 'text-slate-600'
          }`}
        >
          {selectedReaction ? (
            <span className="text-base">{reactionsList.find((r) => r.type === selectedReaction)?.emoji}</span>
          ) : (
            <ThumbsUp className="w-4 h-4" />
          )}
          <span>{selectedReaction ? reactionsList.find((r) => r.type === selectedReaction)?.label : 'Gostar'}</span>
        </button>

        {/* Comment Button */}
        <button
          type="button"
          onClick={openComments}
          data-testid="post-comment-button"
          className="flex-1 py-2 rounded-xl hover:bg-[#F0F2F5] transition flex items-center justify-center gap-1.5 text-slate-600"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Comentar</span>
        </button>

        {/* Share Button (WhatsApp) */}
        <button
          type="button"
          onClick={handleShareWhatsApp}
          className="flex-1 py-2 rounded-xl hover:bg-[#F0F2F5] transition flex items-center justify-center gap-1.5 text-emerald-600"
        >
          <Share2 className="w-4 h-4" />
          <span>Partilhar</span>
        </button>

        {/* Ver Ficha Directório Button */}
        {business && (
          <button
            type="button"
            onClick={() => onSelectBusiness?.(business)}
            className="flex-1 py-2 rounded-xl hover:bg-[#F0F2F5] transition flex items-center justify-center gap-1.5 text-[#0B5ED7] dark:text-[#8AB4FF]"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Ver Ficha</span>
          </button>
        )}
      </div>

      {/* Painel inferior (mobile) — versão Instagram */}
      {isMobileViewport && (
        <PostCommentsSheet
          open={commentsOpen}
          onClose={closeComments}
          title={translatedTitle}
          subtitle={post.businessName}
          comments={commentsList}
          currentUser={currentUser}
          onRequireLogin={onRequireLogin}
          onSubmit={async (text) => {
            if (!engagementContext) return;
            await engagementContext.comment(post.id, text);
          }}
          onReply={async (parentId, text) => {
            if (!engagementContext) return;
            await engagementContext.reply(post.id, parentId, text);
          }}
        />
      )}

      {/* Inline Comments Section (desktop) */}
      {commentsOpen && !isMobileViewport && (
        <div className="p-3.5 sm:p-4 bg-slate-50/80 space-y-3 text-xs">
          {/* Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-[var(--color-border-subtle)] shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={
                currentUser
                  ? `Comentar como ${currentUser.name}...`
                  : 'Escreva um comentário (requer início de sessão)...'
              }
              className="flex-1 bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-[var(--color-border-subtle)] rounded-full px-4 py-2 text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              aria-label="Publicar comentário"
              className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:bg-blue-700 transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Comments List */}
          <div className="space-y-3 pt-2">
            {commentsList.length === 0 && (
              <p className="text-[11px] text-slate-500">Ainda não existem comentários.</p>
            )}
            {commentsList.map((c) => (
              <div key={c.id} className="space-y-2">
                {renderCommentRow(c, 0)}
                {(c.replies ?? []).map((child) => (
                  <div key={child.id}>{renderCommentRow(child, 1)}</div>
                ))}
                {replyTarget === c.id && (
                  <form onSubmit={(event) => handleAddReply(event, c.id)} className="ml-8 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyDrafts[c.id] ?? ''}
                      onChange={(event) => setReplyDrafts((previous) => ({ ...previous, [c.id]: event.target.value }))}
                      placeholder={`Responder a ${c.authorName}...`}
                      aria-label={`Responder a ${c.authorName}`}
                      className="flex-1 bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-[var(--color-border-subtle)] rounded-full px-4 py-2 text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      aria-label="Publicar resposta"
                      className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:bg-blue-700 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};
