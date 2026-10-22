/**
 * Visualizador de stories no formato Instagram: ecrã inteiro vertical,
 * barras de progresso segmentadas com auto-avanço (5 s em imagem/texto,
 * duração real no vídeo), zonas de toque (esquerda/anterior, direita/seguinte),
 * pausa ao premir e segurar, navegação por teclado (←/→/Esc/Espaço), swipe
 * tátil, marcação de story como vista e resposta directa para a conversa.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, Heart, Send, Volume2, VolumeX } from 'lucide-react';
import { Story, UserProfile } from '../types';
import { STORY_DEFAULT_DURATION_MS, storyTimestampLabel } from '../utils/stories';

interface StoryModalProps {
  /** Stories de um único grupo (empresa), em ordem cronológica. */
  stories: Story[];
  initialStoryIndex: number;
  onClose: () => void;
  currentUser?: UserProfile | null;
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
  /** Duração de imagem/texto em ms (por omissão 5 s, como no Instagram). */
  storyDurationMs?: number;
}

const TICK_MS = 50;
/** Toques com mais tempo que isto são pausa, não navegação. */
const HOLD_SUPPRESS_MS = 300;
const SWIPE_THRESHOLD_PX = 48;
const MAX_VIDEO_DURATION_MS = 60_000;

export const StoryModal: React.FC<StoryModalProps> = ({
  stories,
  initialStoryIndex,
  onClose,
  currentUser,
  onRequireLogin,
  onStoryComment,
  onStoryViewed,
  storyDurationMs = STORY_DEFAULT_DURATION_MS,
}) => {
  const safeInitialIndex = Math.min(Math.max(initialStoryIndex, 0), Math.max(stories.length - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [progress, setProgress] = useState(0);
  const [stickyPaused, setStickyPaused] = useState(false);
  const [heldPaused, setHeldPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoDurationMs, setVideoDurationMs] = useState(storyDurationMs);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdStartedAtRef = useRef(0);
  const suppressTapUntilRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const viewedCallbackRef = useRef(onStoryViewed);
  const storiesRef = useRef(stories);

  useEffect(() => {
    viewedCallbackRef.current = onStoryViewed;
    storiesRef.current = stories;
  });

  const currentStory = stories[currentIndex];
  const currentStoryId = currentStory?.id;
  const isVideo = Boolean(
    currentStory
    && currentStory.storyType === 'video'
    && !videoFailed
    && (currentStory.mediaUrl || currentStory.imageUrl),
  );
  const isText = Boolean(
    currentStory && (currentStory.storyType === 'text' || (!currentStory.imageUrl && !currentStory.mediaUrl)),
  );
  const showTextBackdrop = (isText || videoFailed) && Boolean(currentStory);
  const mediaSource = currentStory?.storyType === 'video'
    ? currentStory.mediaUrl || currentStory.imageUrl
    : currentStory?.imageUrl || currentStory?.mediaUrl;
  const paused = stickyPaused || heldPaused;
  const useTimer = !isVideo;

  /** Navega para um índice e repõe o estado visual da story. */
  const goTo = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setProgress(0);
    setIsLiked(false);
    setVideoDurationMs(storyDurationMs);
    setVideoFailed(false);
    setStickyPaused(false);
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) goTo(currentIndex + 1);
    else onClose();
  };

  const handlePrev = () => {
    if (currentIndex > 0) goTo(currentIndex - 1);
    else setProgress(0);
  };

  const handleZoneClick = (direction: 'prev' | 'next') => {
    const heldFor = holdStartedAtRef.current > 0 ? Date.now() - holdStartedAtRef.current : 0;
    holdStartedAtRef.current = 0;
    if (heldFor >= HOLD_SUPPRESS_MS) return; // pausa longa não navega
    if (Date.now() < suppressTapUntilRef.current) return; // swipe acabou de acontecer
    if (direction === 'next') handleNext();
    else handlePrev();
  };

  const startHold = () => {
    holdStartedAtRef.current = Date.now();
    setHeldPaused(true);
  };

  const handleCommentSubmit = () => {
    const text = commentText.trim();
    if (!text) return;
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão para responder às stories.');
      return;
    }
    if (!currentStory) return;
    onStoryComment?.({
      story: currentStory,
      text,
      businessId: currentStory.businessId,
      businessName: currentStory.businessName,
      authorName: currentUser.name,
      authorId: currentUser.id,
    });
    setCommentText('');
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    setProgress(Math.min(1, video.currentTime / video.duration));
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    setVideoDurationMs(Math.min(MAX_VIDEO_DURATION_MS, Math.round(video.duration * 1000)));
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
    suppressTapUntilRef.current = Date.now() + 400;
    if (dx < 0) handleNext();
    else handlePrev();
  };

  // Bloqueia o scroll do fundo enquanto o visualizador está aberto.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('modal-open');
    };
  }, []);

  // Marca a story actual como vista (sem depender da identidade do array: o
  // App recria o array ao gravar o estado, o que re-renderizaria o modal).
  useEffect(() => {
    if (!currentStoryId) return;
    const story = storiesRef.current.find((candidate) => candidate.id === currentStoryId);
    if (story) viewedCallbackRef.current?.(story);
  }, [currentIndex, currentStoryId]);

  // Relógio de progresso para imagem/texto (o vídeo usa `timeupdate`).
  useEffect(() => {
    if (!useTimer || paused || !currentStoryId) return;
    const timer = window.setInterval(() => {
      setProgress((previous) => Math.min(1, previous + TICK_MS / Math.max(1, storyDurationMs)));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [useTimer, paused, currentStoryId, storyDurationMs, currentIndex]);

  // Auto-avanço: o único caminho de avanço por tempo (imagem e vídeo).
  useEffect(() => {
    if (progress < 1) return;
    if (currentIndex < stories.length - 1) goTo(currentIndex + 1);
    else onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, currentIndex, stories.length]);

  // Vídeo: reproduz/pausa conforme o estado; guardado para jsdom sem media.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;
    if (paused) {
      try {
        video.pause();
      } catch {
        /* jsdom não implementa media */
      }
      return;
    }
    try {
      const result = video.play();
      if (result && typeof result.catch === 'function') result.catch(() => undefined);
    } catch {
      /* jsdom não implementa media */
    }
  }, [paused, isVideo, currentIndex]);

  // Soltar o rato/finger fora da zona termina a pausa por pressão.
  useEffect(() => {
    const release = () => setHeldPaused(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);

  // Teclado: Esc fecha, ←/→ navegam, Espaço pausa/retoma (fora dos campos de texto).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'));
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (typing) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrev();
      } else if (event.key === ' ') {
        event.preventDefault();
        setStickyPaused((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, stories.length, onClose]);

  if (!currentStory) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-0 sm:p-4 overscroll-contain"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-slate-950 sm:h-[92vh] sm:rounded-3xl sm:border sm:border-slate-800 sm:shadow-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Camada de media (imagem, vídeo ou fundo de texto) */}
        <div className="absolute inset-0">
          {showTextBackdrop ? (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-8 text-center">
              <p className="text-2xl font-black leading-snug text-white drop-shadow-lg">
                {currentStory.caption || currentStory.businessName}
              </p>
            </div>
          ) : isVideo ? (
            <video
              ref={videoRef}
              src={mediaSource}
              className="h-full w-full object-cover"
              muted={videoMuted}
              playsInline
              autoPlay
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onError={() => setVideoFailed(true)}
            />
          ) : (
            <img src={mediaSource} alt="" className="h-full w-full object-cover" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>

        {/* Zonas de toque: esquerda = anterior (1/3), direita = seguinte (2/3) */}
        <button
          type="button"
          aria-label="Story anterior"
          onPointerDown={startHold}
          onClick={() => handleZoneClick('prev')}
          className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-pointer"
        />
        <button
          type="button"
          aria-label="Seguinte story"
          onPointerDown={startHold}
          onClick={() => handleZoneClick('next')}
          className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-pointer"
        />

        {/* Barras de progresso segmentadas (uma por story do grupo) */}
        <div className="absolute left-3 right-3 top-3 z-30 flex gap-1">
          {stories.map((story, index) => (
            <div key={story.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: index < currentIndex ? '100%' : index === currentIndex ? `${Math.round(progress * 100)}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Cabeçalho: avatar, empresa, timestamp, som e fechar */}
        <div className="relative z-30 mt-6 flex items-center gap-2 px-3 pt-1">
          <div className="rounded-full bg-gradient-to-br from-amber-400 via-rose-500 to-violet-500 p-[2px]">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white">
              {currentStory.businessLogo ? (
                <img src={currentStory.businessLogo} alt="" className="block h-full w-full rounded-full object-cover" />
              ) : (
                <span className="block h-full w-full text-center align-middle text-[10px] font-black uppercase text-slate-600">
                  {currentStory.businessName?.charAt(0)}
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white drop-shadow">{currentStory.businessName}</p>
            <p className="text-[10px] font-bold text-white/70">{storyTimestampLabel(currentStory.createdAt)}</p>
          </div>
          {isVideo && (
            <button
              type="button"
              onClick={() => setVideoMuted((value) => !value)}
              aria-label={videoMuted ? 'Ativar som' : 'Desativar som'}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar story"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Rodapé: legenda, comentários, gosto e resposta directa */}
        <div className="relative z-20 mt-auto space-y-3 p-4 pb-5">
          {currentStory.caption && !isText && !videoFailed && (
            <p className="pointer-events-none rounded-2xl bg-black/40 p-3 text-sm font-semibold text-white drop-shadow backdrop-blur-sm">
              {currentStory.caption}
            </p>
          )}

          {(currentStory.comments || []).length > 0 && (
            <div className="max-h-24 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-2 text-xs text-white/90 backdrop-blur-sm">
              {currentStory.comments?.slice(0, 3).map((comment) => (
                <div key={comment.id} className="mb-2 last:mb-0 rounded-xl bg-white/5 p-2">
                  <div className="font-bold text-emerald-300">{comment.userName}</div>
                  <div>{comment.text}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLiked((value) => !value)}
              aria-label="Gostar da story"
              aria-pressed={isLiked}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                isLiked ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? 'fill-white' : ''}`} />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 backdrop-blur-sm">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Enviar mensagem…"
                aria-label="Enviar mensagem à story"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/60 outline-none"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCommentSubmit();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleCommentSubmit}
                aria-label="Enviar mensagem"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-400"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



