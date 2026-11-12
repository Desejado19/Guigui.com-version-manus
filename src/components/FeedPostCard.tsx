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
  Crown,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { BusinessPost, ReactionType, Business, Language, UserProfile } from '../types';
import { useTranslatedText } from '../utils/contentTranslation';
import { getTranslation } from '../utils/i18n';

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
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<ReactionType | null>(post.userReaction || null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsList, setCommentsList] = useState(post.comments || []);
  const [newCommentText, setNewCommentText] = useState('');
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

  // Compute total reactions
  const baseLikes = post.likesCount || 12;
  const currentTotalLikes = baseLikes + (selectedReaction ? 1 : 0);

  const reactionsList: { type: ReactionType; emoji: string; label: string; color: string }[] = [
    { type: 'like', emoji: '👍', label: 'Gostar', color: 'text-[#1877F2]' },
    { type: 'love', emoji: '❤️', label: 'Amei', color: 'text-red-500' },
    { type: 'haha', emoji: '😂', label: 'Riso', color: 'text-amber-500' },
    { type: 'wow', emoji: '😮', label: 'Uau', color: 'text-amber-500' },
    { type: 'sad', emoji: '😢', label: 'Triste', color: 'text-amber-500' },
    { type: 'angry', emoji: '😡', label: 'Bravo', color: 'text-orange-600' },
  ];

  const handleSelectReaction = (type: ReactionType) => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta (Cidadão ou Empresa) para curtir publicações.');
      return;
    }

    if (selectedReaction === type) {
      setSelectedReaction(null);
    } else {
      setSelectedReaction(type);
    }
    setShowReactionPicker(false);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta (Cidadão ou Empresa) para comentar publicações.');
      return;
    }

    if (!newCommentText.trim()) return;

    const newComment = {
      id: 'c-' + Date.now(),
      postId: post.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatarUrl,
      content: newCommentText,
      createdAt: 'Agora mesmo',
      likesCount: 0,
    };

    setCommentsList([...commentsList, newComment]);
    setNewCommentText('');
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
  };

  return (
    <article ref={articleRef} className={`bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-slate-800 space-y-3 transition hover:border-slate-300 ${isHighlighted ? 'ring-4 ring-emerald-400 ring-offset-4 ring-offset-slate-50' : ''}`}>
      {/* Post Author Header */}
      <div className="p-4 sm:p-5 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            onClick={() => business && onSelectBusiness?.(business)}
            className="w-11 h-11 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer flex-shrink-0"
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
                className="font-extrabold text-xs sm:text-sm text-slate-900 hover:underline cursor-pointer"
              >
                {post.businessName}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-600 text-white shrink-0" />

              {/* Verified Plan Subscriber Badge */}
              {(post.isPlanSubscriberPost || post.planBadge || business?.tier) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-2xs">
                  <Crown className="w-3 h-3 text-amber-100" />
                  <span>{post.planBadge || business?.tier?.toUpperCase() || 'VIP'}</span>
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>📍 {post.neighborhood || business?.neighborhood || t("business.Todos")}</span>
              <span>•</span>
              <span>{post.mediaType === 'video' ? `🎬 ${t('business.VideoComercial')}` : post.mediaType === 'gallery' ? `📸 ${t('business.Galeria')}` : t('business.Publicacao')}</span>
            </div>
          </div>
        </div>

        <button type="button" aria-label="Mais opções da publicação" className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-[var(--color-bg-surface)] dark:hover:bg-[var(--color-bg-surface-dark)]">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Post Text Content */}
      <div className="px-4 sm:px-5 space-y-1.5 text-xs sm:text-sm text-slate-800 leading-relaxed">
        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">{translatedTitle}</h3>
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
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/20">
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
          <div className="w-full bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] rounded-2xl overflow-hidden max-h-[400px] border border-slate-200">
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
              <span className="text-[10px] font-bold text-slate-400 pl-1 shrink-0">
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
            <span className="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[9px]">👍</span>
            <span className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px]">❤️</span>
          </div>
          <span className="font-bold text-slate-700 ml-1">{currentTotalLikes}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <button type="button" onClick={() => setCommentsOpen(!commentsOpen)} className="hover:underline">
            {commentsList.length} Comentários
          </button>
          <span>•</span>
          <span>{sharesCount} Partilhas</span>
        </div>
      </div>

      {/* Facebook Action Bar (Like, Comment, Share WhatsApp, Ver Ficha) */}
      <div className="px-2 sm:px-4 relative flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-100 pb-1">
        {/* Reaction Hover Picker Box */}
        {showReactionPicker && (
          <div className="absolute -top-12 left-2 z-30 bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-slate-200 rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2 animate-in zoom-in-95 duration-150">
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
              ? reactionsList.find((r) => r.type === selectedReaction)?.color || 'text-[#1877F2]'
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
          onClick={() => setCommentsOpen(!commentsOpen)}
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
            className="flex-1 py-2 rounded-xl hover:bg-[#F0F2F5] transition flex items-center justify-center gap-1.5 text-[#1877F2]"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Ver Ficha</span>
          </button>
        )}
      </div>

      {/* Inline Comments Section */}
      {commentsOpen && (
        <div className="p-3.5 sm:p-4 bg-slate-50/80 space-y-3 text-xs">
          {/* Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
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
              className="flex-1 bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-slate-200 rounded-full px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:bg-blue-700 transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Comments List */}
          <div className="space-y-2.5 pt-2">
            {commentsList.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <img
                  src={c.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0"
                />

                <div className="bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-surface-dark)] border border-slate-200 p-2.5 rounded-2xl flex-1 shadow-2xs">
                  <div className="font-extrabold text-slate-900 text-xs">{c.authorName}</div>
                  <p className="text-slate-700 mt-0.5 text-xs">{c.content}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-1">
                    <button type="button" className="hover:underline text-[#1877F2]">Gostar</button>
                    <span>•</span>
                    <span>{c.createdAt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};
