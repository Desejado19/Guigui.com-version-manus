import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, Check, ChevronLeft, ChevronRight, Flag, Heart, Link2, MoreHorizontal,
  Pause, Play, Send, Share2, Volume2, VolumeX, X,
} from 'lucide-react';
import type { Story, UserProfile } from '../types';
import { storyTimestampLabel } from '../utils/stories';
import { storyApi } from '../services/storyApi';

interface StoryModalProps {
  stories: Story[];
  initialStoryIndex: number;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onRequireLogin?: (notice?: string) => void;
  onStoryComment?: (payload: {
    story: Story; text: string; businessId: string; businessName: string;
    authorName: string; authorId: string;
  }) => void;
  onStoryViewed?: (story: Story) => void;
  onNextProfile?: () => void;
  onPrevProfile?: () => void;
  storyDurationMs?: number;
}

const TICK_MS = 50;
const HOLD_SUPPRESS_MS = 280;
const SWIPE_THRESHOLD_PX = 48;
const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];
const REPORT_REASONS = [
  ['improper', 'Conteúdo impróprio'],
  ['false_information', 'Informação falsa'],
  ['fraud', 'Fraude'],
  ['spam', 'Spam'],
  ['harassment', 'Assédio'],
  ['rights', 'Violação de direitos'],
  ['other', 'Outro motivo'],
] as const;

function positionStyle(element: NonNullable<Story['elements']>[number]): React.CSSProperties {
  return {
    left: `${element.positionX}%`,
    top: `${element.positionY}%`,
    transform: `translate(-50%, -50%) scale(${element.scale}) rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
  };
}

export const StoryModal: React.FC<StoryModalProps> = ({
  stories,
  initialStoryIndex,
  onClose,
  currentUser,
  onRequireLogin,
  onNextProfile,
  onPrevProfile,
  storyDurationMs = 5000,
}) => {
  const safeInitialIndex = Math.min(Math.max(initialStoryIndex, 0), Math.max(stories.length - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const [progress, setProgress] = useState(0);
  const [heldPaused, setHeldPaused] = useState(false);
  const [stickyPaused, setStickyPaused] = useState(false);
  const [writing, setWriting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [questionSent, setQuestionSent] = useState<Record<string, boolean>>({});
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({});
  const [pollCounts, setPollCounts] = useState<Record<string, number[]>>({});
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState(storyDurationMs);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('improper');
  const [reportDetails, setReportDetails] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdStartedAtRef = useRef(0);
  const suppressTapUntilRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const story = stories[currentIndex];
  const storyId = story?.id;
  const isVideo = story?.storyType === 'video' && Boolean(story.mediaUrl) && !videoFailed;
  const paused = heldPaused || stickyPaused || writing;
  const isOwner = Boolean(currentUser && story && (
    story.ownerUserId === currentUser.id || (currentUser.role === 'business' && story.businessId === currentUser.businessId)
  ));
  const elements = useMemo(() => (story?.elements || []).filter((element) => element.type !== 'text' || element.content?.text), [story]);

  const goTo = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setProgress(0);
    setHeldPaused(false);
    setStickyPaused(false);
    setWriting(false);
    setReplyText('');
    setReplySent(false);
    setVideoFailed(false);
    setVideoDurationMs(storyDurationMs);
    setMenuOpen(false);
    setStats(null);
  };

  const finishGroup = () => {
    if (onNextProfile) onNextProfile();
    else onClose();
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) goTo(currentIndex + 1);
    else finishGroup();
  };

  const handlePrev = () => {
    if (currentIndex > 0) goTo(currentIndex - 1);
    else if (onPrevProfile) onPrevProfile();
    else setProgress(0);
  };

  const requireLogin = (message: string): boolean => {
    if (currentUser) return false;
    onRequireLogin?.(message);
    return true;
  };

  // Progresso e autoplay.
  useEffect(() => {
    if (!story || paused) return;
    if (isVideo) return;
    const duration = Math.max(1000, Number(story.durationMs) || storyDurationMs);
    const timer = window.setInterval(() => {
      setProgress((previous) => {
        const next = previous + TICK_MS / duration;
        if (next >= 1) {
          window.clearInterval(timer);
          window.setTimeout(handleNext, 0);
          return 1;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [storyId, paused, isVideo, story?.durationMs, currentIndex, stories.length]);

  // Vídeo: sincroniza pausa e volume.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = videoMuted;
    if (paused) video.pause();
    else void video.play().catch(() => setVideoFailed(true));
  }, [paused, videoMuted, storyId, isVideo]);

  // Registo da visualização.
  useEffect(() => {
    if (!storyId || !currentUser) return;
    setLiked(Boolean(story?.viewer?.liked));
    setLikeCount(Number(story?.counts?.likes || 0));
    setReaction(story?.viewer?.reaction || null);
    setPollVotes(story?.viewer?.pollVotes || {});
    storyApi.view(storyId).catch(() => undefined);
  }, [storyId, currentUser?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (reportOpen) setReportOpen(false);
        else if (stats) setStats(null);
        else onClose();
      }
      if (event.key === 'ArrowRight') handleNext();
      if (event.key === 'ArrowLeft') handlePrev();
      if (event.key === ' ') {
        event.preventDefault();
        setStickyPaused((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [currentIndex, stories.length, reportOpen, stats]);

  if (!story) return null;

  const handleZoneClick = (direction: 'prev' | 'next') => {
    const heldFor = holdStartedAtRef.current > 0 ? Date.now() - holdStartedAtRef.current : 0;
    holdStartedAtRef.current = 0;
    setHeldPaused(false);
    if (heldFor >= HOLD_SUPPRESS_MS) return;
    if (Date.now() < suppressTapUntilRef.current) return;
    if (direction === 'next') handleNext();
    else handlePrev();
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx) && dy > 80) {
      onClose();
      return;
    }
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
    suppressTapUntilRef.current = Date.now() + 350;
    if (dx < 0) handleNext();
    else handlePrev();
  };

  const toggleLike = async () => {
    if (requireLogin('Inicie sessão para reagir às stories.')) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      const result = await storyApi.like(story.id, next);
      setLiked(result.liked);
      setLikeCount(result.likes);
    } catch (error) {
      setLiked(!next);
      setLikeCount((value) => Math.max(0, value + (next ? -1 : 1)));
      setNotice(error instanceof Error ? error.message : 'Não foi possível registar a curtida.');
    }
  };

  const sendReaction = async (emoji: string) => {
    if (requireLogin('Inicie sessão para reagir às stories.')) return;
    setReaction(emoji);
    setShowReactions(false);
    try {
      await storyApi.react(story.id, emoji);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível enviar a reação.');
    }
  };

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    if (requireLogin('Inicie sessão para responder às stories.')) return;
    try {
      await storyApi.reply(story.id, text);
      setReplyText('');
      setReplySent(true);
      setNotice('Resposta enviada.');
      window.setTimeout(() => setReplySent(false), 2500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível enviar a resposta.');
    } finally {
      setWriting(false);
    }
  };

  const vote = async (elementId: string, optionIndex: number) => {
    if (requireLogin('Inicie sessão para participar na sondagem.')) return;
    try {
      const result = await storyApi.vote(story.id, elementId, optionIndex);
      setPollVotes((previous) => ({ ...previous, [elementId]: result.optionIndex }));
      setPollCounts((previous) => ({ ...previous, [elementId]: result.counts }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível registar o voto.');
    }
  };

  const answerQuestion = async (elementId: string) => {
    const answer = (questionAnswers[elementId] || '').trim();
    if (!answer) return;
    if (requireLogin('Inicie sessão para responder à pergunta.')) return;
    try {
      await storyApi.answer(story.id, elementId, answer);
      setQuestionAnswers((previous) => ({ ...previous, [elementId]: '' }));
      setQuestionSent((previous) => ({ ...previous, [elementId]: true }));
      setWriting(false);
      setNotice('Resposta enviada.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível enviar a resposta.');
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/?story=${encodeURIComponent(story.shareToken)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: story.businessName, text: story.caption || 'Story no Guigui.com', url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice('Ligação copiada.');
      }
    } catch {
      setNotice('Não foi possível partilhar a story.');
    }
  };

  const openStats = async () => {
    setLoadingStats(true);
    try {
      setStats(await storyApi.stats(story.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível carregar as estatísticas.');
    } finally {
      setLoadingStats(false);
    }
  };

  const submitReport = async () => {
    try {
      await storyApi.report(story.id, reportReason, reportDetails);
      setReportOpen(false);
      setReportDetails('');
      setNotice('Denúncia enviada para moderação.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível enviar a denúncia.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${story.businessName}`}
    >
      <div
        className="relative h-full w-full max-w-[460px] overflow-hidden bg-slate-950 sm:h-[92vh] sm:rounded-3xl sm:border sm:border-white/15 sm:shadow-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ backgroundColor: story.backgroundColor || '#0f172a' }}
      >
        {isVideo ? (
          <video
            key={story.id}
            ref={videoRef}
            src={story.mediaUrl}
            className="absolute inset-0 h-full w-full object-contain"
            autoPlay
            playsInline
            muted={videoMuted}
            onLoadedMetadata={() => {
              const duration = videoRef.current?.duration;
              if (duration && Number.isFinite(duration)) setVideoDurationMs(Math.min(60000, duration * 1000));
            }}
            onTimeUpdate={() => {
              const video = videoRef.current;
              if (!video?.duration) return;
              setProgress(Math.min(1, video.currentTime / video.duration));
            }}
            onEnded={handleNext}
            onError={() => setVideoFailed(true)}
          />
        ) : story.mediaUrl ? (
          <img src={story.mediaUrl} alt={story.caption || story.businessName} className="absolute inset-0 h-full w-full object-contain" />
        ) : null}

        {!story.mediaUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 p-10 text-center">
            <p className="text-2xl font-black leading-snug text-white">{story.caption || story.businessName}</p>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

        {/* Progresso segmentado */}
        <div className="absolute left-3 right-3 top-3 z-40 flex gap-1">
          {stories.map((item, index) => {
            const value = index < currentIndex ? 1 : index === currentIndex ? progress : 0;
            return (
              <div key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white transition-[width] duration-75" style={{ width: `${value * 100}%` }} />
              </div>
            );
          })}
        </div>

        {/* Cabeçalho */}
        <div className="absolute left-3 right-3 top-7 z-40 flex items-center gap-2.5 pt-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/90 bg-slate-800">
            {story.businessLogo ? <img src={story.businessLogo} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-black text-white">{story.businessName.slice(0, 1)}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-black text-white">{story.businessName}</span>
              {story.ownerRole === 'admin' && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-950">Institucional</span>}
            </div>
            <div className="text-[10px] font-semibold text-white/75">
              {storyTimestampLabel(story.createdAt)} {story.visibility === 'limited' ? '· Audiência limitada' : ''}
            </div>
          </div>
          {isVideo && (
            <button type="button" onClick={() => setVideoMuted((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white" aria-label={videoMuted ? 'Ativar som' : 'Silenciar'}>
              {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          <button type="button" onClick={() => setStickyPaused((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white" aria-label={paused ? 'Continuar story' : 'Pausar story'}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white" aria-label="Opções da story">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white" aria-label="Fechar story">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Zonas de navegação */}
        <button type="button" aria-label="Story anterior" className="absolute bottom-28 left-0 top-20 z-10 w-[42%]" onClick={() => handleZoneClick('prev')} onPointerDown={() => { holdStartedAtRef.current = Date.now(); setHeldPaused(true); }} onPointerUp={() => setHeldPaused(false)} />
        <button type="button" aria-label="Story seguinte" className="absolute bottom-28 right-0 top-20 z-10 w-[42%]" onClick={() => handleZoneClick('next')} onPointerDown={() => { holdStartedAtRef.current = Date.now(); setHeldPaused(true); }} onPointerUp={() => setHeldPaused(false)} />

        <button type="button" onClick={handlePrev} className="absolute left-1 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white sm:flex" aria-label="Anterior"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={handleNext} className="absolute right-1 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white sm:flex" aria-label="Seguinte"><ChevronRight className="h-5 w-5" /></button>

        {/* Elementos interativos */}
        <div className="pointer-events-none absolute inset-0 z-30">
          {elements.map((element) => {
            const content = element.content || {};
            const className = 'pointer-events-auto absolute max-w-[80%] rounded-2xl px-3 py-2 text-white shadow-lg';
            if (element.type === 'poll' || element.type === 'quiz') {
              const options = Array.isArray(content.options) ? content.options as string[] : [];
              const selected = pollVotes[element.id] ?? element.viewerOptionIndex ?? null;
              const counts = pollCounts[element.id] || element.pollCounts || [];
              const total = counts.reduce((sum, value) => sum + value, 0);
              return (
                <div key={element.id} style={positionStyle(element)} className={`${className} w-[78%] bg-slate-950/85 p-3`}>
                  <p className="mb-2 text-center text-xs font-black">{String(content.question || '')}</p>
                  <div className="space-y-1.5">
                    {options.map((option, index) => {
                      const percent = total > 0 ? Math.round(((counts[index] || 0) / total) * 100) : 0;
                      const isCorrect = element.type === 'quiz' && selected != null && Number(content.correctIndex) === index;
                      return (
                        <button key={`${element.id}-${index}`} type="button" disabled={selected != null} onClick={() => void vote(element.id, index)} className={`relative w-full overflow-hidden rounded-xl border px-2 py-2 text-[11px] font-bold ${selected === index ? 'border-white/80' : 'border-white/25'} ${isCorrect ? 'bg-emerald-600/80' : 'bg-white/10'}`}>
                          {selected != null && <span className="absolute inset-y-0 left-0 bg-white/15" style={{ width: `${percent}%` }} />}
                          <span className="relative flex items-center justify-between gap-2"><span>{option}</span>{selected != null && <span>{percent}%</span>}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (element.type === 'question') {
              return (
                <form key={element.id} style={positionStyle(element)} className={`${className} w-[78%] bg-slate-950/85 p-3`} onSubmit={(event) => { event.preventDefault(); void answerQuestion(element.id); }}>
                  <p className="mb-2 text-center text-xs font-black">{String(content.question || 'Pergunta')}</p>
                  {questionSent[element.id] ? <p className="text-center text-[11px] font-bold text-emerald-300">Resposta enviada <Check className="inline h-3 w-3" /></p> : (
                    <div className="flex gap-1.5">
                      <input value={questionAnswers[element.id] || ''} onChange={(event) => setQuestionAnswers((previous) => ({ ...previous, [element.id]: event.target.value }))} onFocus={() => setWriting(true)} placeholder="Escreve a tua resposta..." className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/50" />
                      <button type="submit" className="rounded-full bg-white px-3 text-slate-950" aria-label="Enviar resposta"><Send className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </form>
              );
            }
            if (element.type === 'countdown') {
              const target = Date.parse(String(content.targetAt || ''));
              const remaining = Number.isFinite(target) ? Math.max(0, target - Date.now()) : 0;
              const days = Math.floor(remaining / 86400000);
              const hours = Math.floor((remaining % 86400000) / 3600000);
              return (
                <div key={element.id} style={positionStyle(element)} className={`${className} w-[72%] bg-amber-500/95 text-center text-slate-950`}>
                  <p className="text-[10px] font-black uppercase tracking-wider">{String(content.label || 'Contagem decrescente')}</p>
                  <p className="mt-0.5 text-lg font-black">{days}d {hours}h</p>
                </div>
              );
            }
            if (element.type === 'link' || element.type === 'cta') {
              return (
                <a key={element.id} style={positionStyle(element)} href={String(content.url || '#')} target="_blank" rel="noreferrer" className={`${className} flex items-center gap-1.5 bg-white text-slate-950`}>
                  <Link2 className="h-3.5 w-3.5" /><span className="text-[11px] font-black">{String(content.label || 'Ver mais')}</span>
                </a>
              );
            }
            if (element.type === 'mention' || element.type === 'hashtag' || element.type === 'location' || element.type === 'music') {
              const label = element.type === 'location' ? content.name : element.type === 'music' ? `${content.title}${content.artist ? ` · ${content.artist}` : ''}` : content.value;
              return <div key={element.id} style={positionStyle(element)} className={`${className} bg-black/65 text-[11px] font-black`}>{element.type === 'mention' ? '@' : element.type === 'hashtag' ? '#' : ''}{String(label || '')}</div>;
            }
            return (
              <div key={element.id} style={positionStyle(element)} className={`${className} ${element.type === 'sticker' ? 'bg-amber-400 text-slate-950' : element.type === 'emoji' ? 'bg-black/40 text-2xl' : 'bg-black/55'} text-center font-black`}>
                <span style={{ color: typeof content.color === 'string' ? content.color : undefined, fontSize: typeof content.fontSize === 'number' ? content.fontSize : undefined, textAlign: (content.align as React.CSSProperties['textAlign']) || 'center', display: 'block' }}>
                  {String(content.text || '')}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        {story.caption && (
          <div className="absolute bottom-24 left-4 right-4 z-30 text-center">
            <p className="inline-block rounded-xl bg-black/40 px-3 py-1.5 text-xs font-semibold leading-snug text-white">{story.caption}</p>
          </div>
        )}

        {/* Rodapé de interação */}
        <div className="absolute bottom-3 left-3 right-3 z-40 space-y-2">
          {notice && <div className="rounded-xl bg-black/70 px-3 py-2 text-center text-[10px] font-bold text-white">{notice}</div>}
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/30 bg-black/35">
              <input
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                onFocus={() => setWriting(true)}
                onBlur={() => { if (!replyText) setWriting(false); }}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void sendReply(); } }}
                placeholder={replySent ? 'Resposta enviada' : `Responder a ${story.businessName}...`}
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-xs text-white outline-none placeholder:text-white/65"
                aria-label="Responder ao story"
              />
              <button type="button" onClick={() => void sendReply()} className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/10" aria-label="Enviar resposta"><Send className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => void toggleLike()} className={`flex h-10 w-10 items-center justify-center rounded-full border ${liked ? 'border-rose-400 bg-rose-500/30 text-rose-300' : 'border-white/30 bg-black/35 text-white'}`} aria-label={liked ? 'Remover gosto' : 'Gostar'} aria-pressed={liked}>
              <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
            </button>
            <button type="button" onClick={() => setShowReactions((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/35 text-lg" aria-label="Reagir com emoji">{reaction || '😊'}</button>
            <button type="button" onClick={() => void share()} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white" aria-label="Partilhar story"><Share2 className="h-4 w-4" /></button>
          </div>
          {showReactions && (
            <div className="flex items-center justify-center gap-1 rounded-full bg-black/75 p-1.5">
              {REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => void sendReaction(emoji)} className="rounded-full px-2 py-1 text-lg transition hover:scale-125">{emoji}</button>)}
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] font-bold text-white/70">
            <span>{likeCount} gosto(s){reaction ? ` · ${reaction}` : ''}</span>
            <span>{story.counts?.views || 0} visualizações</span>
          </div>
        </div>

        {menuOpen && (
          <div className="absolute right-3 top-20 z-50 w-56 overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 py-1 text-xs text-white shadow-2xl">
            <button type="button" onClick={() => void share()} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/10"><Link2 className="h-4 w-4" /> Copiar ligação</button>
            {isOwner && <button type="button" onClick={() => { setMenuOpen(false); void openStats(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/10"><BarChart3 className="h-4 w-4" /> Estatísticas {loadingStats ? '...' : ''}</button>}
            {currentUser && !isOwner && (
              <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-rose-300 hover:bg-white/10"><Flag className="h-4 w-4" /> Denunciar story</button>
            )}
          </div>
        )}

        {reportOpen && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between"><h3 className="text-sm font-black">Denunciar story</h3><button type="button" onClick={() => setReportOpen(false)} aria-label="Fechar denúncia"><X className="h-4 w-4" /></button></div>
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-3 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-xs">
                {REPORT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={3} placeholder="Detalhes adicionais (opcional)" className="mt-2 w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-xs" />
              <button type="button" onClick={() => void submitReport()} className="mt-3 w-full rounded-xl bg-rose-600 px-3 py-2 text-xs font-black">Enviar denúncia</button>
            </div>
          </div>
        )}

        {stats && (
          <div className="absolute inset-0 z-[60] overflow-y-auto bg-slate-950/95 p-5 text-white">
            <div className="flex items-center justify-between"><h3 className="text-sm font-black">Estatísticas da story</h3><button type="button" onClick={() => setStats(null)} aria-label="Fechar estatísticas"><X className="h-5 w-5" /></button></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
              {[
                ['Visualizações', stats.counts?.views], ['Gostos', stats.counts?.likes], ['Reações', stats.counts?.reactions],
                ['Respostas', stats.counts?.replies], ['Sondagens', stats.counts?.pollVotes], ['Perguntas', stats.counts?.questionResponses],
              ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white/10 p-3"><div className="text-lg font-black">{String(value ?? 0)}</div><div className="text-[10px] text-white/65">{String(label)}</div></div>)}
            </div>
            <h4 className="mt-5 text-[11px] font-black uppercase tracking-wider text-white/70">Quem viu</h4>
            <div className="mt-2 space-y-1.5">
              {(stats.viewers || []).length === 0 && <p className="text-xs text-white/60">Ainda sem visualizações registadas.</p>}
              {(stats.viewers || []).map((viewer: any) => <div key={viewer.userId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs"><span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white/15">{viewer.avatarUrl ? <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" /> : viewer.name?.slice(0, 1)}</span><span className="flex-1 font-bold">{viewer.name}</span><span className="text-[10px] text-white/50">{storyTimestampLabel(viewer.viewedAt)}</span></div>)}
            </div>
            {(stats.questionResponses || []).length > 0 && <>
              <h4 className="mt-5 text-[11px] font-black uppercase tracking-wider text-white/70">Respostas às perguntas</h4>
              <div className="mt-2 space-y-1.5">{(stats.questionResponses || []).map((response: any) => <p key={response.id} className="rounded-xl bg-white/5 px-3 py-2 text-xs">{response.response}</p>)}</div>
            </>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryModal;
