import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive, BarChart3, Bookmark, Check, ChevronLeft, Eye, Heart, MessageCircle,
  Pencil, Play, Plus, RefreshCw, Send, Trash2, X,
} from 'lucide-react';
import type { Story, UserProfile } from '../types';
import { storyApi, type StoryApi, type StoryHighlightApi } from '../services/storyApi';
import { StoryComposer } from './StoryComposer';

interface StoriesManagementHubProps {
  currentUser: UserProfile;
  embedded?: boolean;
  onClose?: () => void;
  /** Avisa o feed para a story aparecer na faixa logo depois de publicada. */
  onStoryPublished?: (story: Story) => void;
}

type Scope = 'active' | 'archive' | 'drafts' | 'highlights' | 'stats';

const SCOPE_LABEL: Record<Scope, string> = {
  active: 'Ativas', archive: 'Arquivo', drafts: 'Rascunhos', highlights: 'Destaques', stats: 'Estatísticas',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export const StoriesManagementHub: React.FC<StoriesManagementHubProps> = ({ currentUser, embedded, onClose, onStoryPublished }) => {
  const [scope, setScope] = useState<Scope>('active');
  const [stories, setStories] = useState<StoryApi[]>([]);
  const [highlights, setHighlights] = useState<StoryHighlightApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [selectedStats, setSelectedStats] = useState<Record<string, any> | null>(null);
  const [highlightTitle, setHighlightTitle] = useState('');
  const [highlightCover, setHighlightCover] = useState('');
  const [highlightStories, setHighlightStories] = useState<string[]>([]);
  const [highlightFormOpen, setHighlightFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, highlightResult] = await Promise.all([
        storyApi.mine('all'),
        storyApi.highlights(currentUser.role === 'business' ? currentUser.businessId : undefined),
      ]);
      setStories(mine.stories || []);
      setHighlights(highlightResult.highlights || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as stories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [currentUser.id, currentUser.businessId]);

  const filtered = useMemo(() => {
    if (scope === 'active') return stories.filter((story) => story.status === 'active');
    if (scope === 'drafts') return stories.filter((story) => story.status === 'draft');
    if (scope === 'archive') return stories.filter((story) => ['expired', 'removed', 'suspended'].includes(story.status));
    return stories;
  }, [stories, scope]);

  const summary = useMemo(() => ({
    active: stories.filter((story) => story.status === 'active').length,
    draft: stories.filter((story) => story.status === 'draft').length,
    archived: stories.filter((story) => ['expired', 'removed', 'suspended'].includes(story.status)).length,
    views: stories.reduce((total, story) => total + (story.counts?.views || 0), 0),
    likes: stories.reduce((total, story) => total + (story.counts?.likes || 0), 0),
    replies: stories.reduce((total, story) => total + (story.counts?.replies || 0), 0),
  }), [stories]);

  const publishDraft = async (story: StoryApi) => {
    try {
      const result = await storyApi.update(story.id, { storyType: story.storyType, mediaUrl: story.mediaUrl, caption: story.caption, publish: true });
      if (result.story) onStoryPublished?.(result.story as unknown as Story);
      await load();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Não foi possível publicar o rascunho.');
    }
  };

  const remove = async (story: StoryApi) => {
    if (!window.confirm(`Eliminar definitivamente a story de ${story.businessName}?`)) return;
    try {
      await storyApi.remove(story.id);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Não foi possível eliminar a story.');
    }
  };

  const openStats = async (story: StoryApi) => {
    try {
      setSelectedStats(await storyApi.stats(story.id));
    } catch (statsError) {
      setError(statsError instanceof Error ? statsError.message : 'Não foi possível carregar as estatísticas.');
    }
  };

  const createHighlight = async () => {
    if (!highlightTitle.trim()) { setError('Dá um nome ao destaque.'); return; }
    try {
      const result = await storyApi.createHighlight({
        title: highlightTitle.trim(),
        coverStoryId: highlightCover || highlightStories[0],
        storyIds: highlightStories,
      });
      setHighlights((previous) => [...previous, result.highlight]);
      setHighlightFormOpen(false);
      setHighlightTitle('');
      setHighlightCover('');
      setHighlightStories([]);
    } catch (highlightError) {
      setError(highlightError instanceof Error ? highlightError.message : 'Não foi possível criar o destaque.');
    }
  };

  const removeHighlight = async (highlight: StoryHighlightApi) => {
    if (!window.confirm(`Eliminar o destaque "${highlight.title}"?`)) return;
    try {
      await storyApi.deleteHighlight(highlight.id);
      setHighlights((previous) => previous.filter((entry) => entry.id !== highlight.id));
    } catch (highlightError) {
      setError(highlightError instanceof Error ? highlightError.message : 'Não foi possível eliminar o destaque.');
    }
  };

  const renameHighlight = async (highlight: StoryHighlightApi) => {
    const title = window.prompt('Novo nome do destaque', highlight.title);
    if (!title?.trim()) return;
    try {
      await storyApi.updateHighlight(highlight.id, { title: title.trim(), coverStoryId: highlight.coverStoryId || null });
      await load();
    } catch (highlightError) {
      setError(highlightError instanceof Error ? highlightError.message : 'Não foi possível renomear o destaque.');
    }
  };

  return (
    <div className={embedded ? 'rounded-3xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900' : 'fixed inset-0 z-[115] overflow-y-auto bg-slate-950/70 p-2 sm:p-6'}>
      <div className={embedded ? '' : 'mx-auto min-h-full max-w-5xl rounded-3xl bg-white p-4 shadow-2xl dark:bg-slate-900 sm:p-6'}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3 dark:border-slate-700">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Gestão de Stories</h2>
            <p className="text-[11px] text-slate-500">Publica, organiza, arquiva e consulta interações. As stories públicas duram 24 horas.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="rounded-lg border border-[var(--color-border-subtle)] p-2 text-slate-600 dark:border-slate-700 dark:text-slate-300" aria-label="Atualizar stories"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={() => { setEditing(null); setComposerOpen(true); }} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> Publicar story</button>
            {onClose && <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Fechar gestão"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['Ativas', summary.active], ['Rascunhos', summary.draft], ['Arquivo', summary.archived], ['Visualizações', summary.views]].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800"><div className="text-lg font-black text-slate-900 dark:text-white">{String(value)}</div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{String(label)}</div></div>
          ))}
        </div>

        <div className="mt-4 flex gap-1.5 overflow-x-auto border-b border-[var(--color-border-subtle)] pb-2 dark:border-slate-700">
          {(Object.keys(SCOPE_LABEL) as Scope[]).map((key) => (
            <button key={key} type="button" onClick={() => { setScope(key); setSelectedStats(null); }} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black ${scope === key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{SCOPE_LABEL[key]}</button>
          ))}
        </div>

        {scope === 'highlights' ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Destaques permanentes</h3>
              <button type="button" onClick={() => setHighlightFormOpen((value) => !value)} className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-black text-white dark:bg-white dark:text-slate-900"><Bookmark className="h-3.5 w-3.5" /> Criar destaque</button>
            </div>
            {highlightFormOpen && (
              <div className="space-y-2 rounded-2xl border border-[var(--color-border-subtle)] p-3 dark:border-slate-700">
                <input value={highlightTitle} onChange={(event) => setHighlightTitle(event.target.value)} placeholder="Nome do destaque (ex.: Produtos)" className="w-full rounded-xl border border-[var(--color-border-subtle)] px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <p className="text-[10px] font-bold text-slate-500">Seleciona stories do arquivo ou ativas:</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {stories.filter((story) => story.status !== 'removed').map((story) => (
                    <label key={story.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] dark:bg-slate-800">
                      <input type="checkbox" checked={highlightStories.includes(story.id)} onChange={(event) => setHighlightStories((previous) => event.target.checked ? [...previous, story.id] : previous.filter((id) => id !== story.id))} />
                      <span className="flex-1 truncate">{story.caption || story.businessName} · {formatDate(story.createdAt)}</span>
                      <button type="button" onClick={() => setHighlightCover(story.id)} className={`rounded px-1.5 py-0.5 font-bold ${highlightCover === story.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>Capa</button>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setHighlightFormOpen(false)} className="rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-500">Cancelar</button><button type="button" onClick={() => void createHighlight()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white">Criar</button></div>
              </div>
            )}
            {highlights.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800">Ainda não criaste destaques.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {highlights.map((highlight) => (
                <div key={highlight.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] p-3 dark:border-slate-700">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500 bg-slate-100">
                    {highlight.cover?.mediaUrl ? <img src={highlight.cover.mediaUrl} alt="" className="h-full w-full object-cover" /> : <Bookmark className="h-5 w-5 text-slate-500" />}
                  </div>
                  <div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-900 dark:text-white">{highlight.title}</div><div className="text-[10px] text-slate-500">{highlight.itemCount} story(s)</div></div>
                  <button type="button" onClick={() => void renameHighlight(highlight)} className="rounded p-1.5 text-slate-500" aria-label="Editar destaque"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void removeHighlight(highlight)} className="rounded p-1.5 text-rose-500" aria-label="Eliminar destaque"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        ) : scope === 'stats' ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['Visualizações', summary.views], ['Gostos', summary.likes], ['Respostas', summary.replies]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div className="text-xl font-black text-emerald-800 dark:text-emerald-300">{String(value)}</div><div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{String(label)}</div></div>)}
            </div>
            {stories.map((story) => (
              <button key={story.id} type="button" onClick={() => void openStats(story)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] p-3 text-left dark:border-slate-700">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800"><BarChart3 className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-900 dark:text-white">{story.caption || `${story.storyType} · ${formatDate(story.createdAt)}`}</span><span className="text-[10px] text-slate-500">{story.counts.views} vistas · {story.counts.likes} gostos · {story.counts.replies} respostas</span></span>
                <Eye className="h-4 w-4 text-slate-500" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {!loading && filtered.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800">Sem stories neste separador.</p>}
            {filtered.map((story) => (
              <div key={story.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] p-3 dark:border-slate-700">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {story.storyType === 'video' ? <Play className="h-5 w-5 text-slate-500" /> : story.mediaUrl ? <img src={story.mediaUrl} alt="" className="h-full w-full object-cover" /> : <span className="p-1 text-center text-[9px] font-bold text-slate-500">{story.caption?.slice(0, 40) || 'Texto'}</span>}
                </div>
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-black text-slate-900 dark:text-white">{story.storyType === 'video' ? 'Vídeo' : story.storyType === 'image' ? 'Fotografia' : 'Texto'}</span><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${story.status === 'active' ? 'bg-emerald-100 text-emerald-800' : story.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>{story.status}</span>{story.ownerRole === 'admin' && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800">Institucional</span>}</div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-300">{story.caption || 'Sem legenda'}</p>
                  <p className="text-[9px] text-slate-500">{formatDate(story.publishedAt || story.createdAt)} · {story.counts.views} vistas · {story.counts.likes} gostos · {story.counts.replies} respostas</p>
                </div>
                <div className="flex items-center gap-1">
                  {story.status === 'draft' && <button type="button" onClick={() => void publishDraft(story)} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-black text-white"><Send className="mr-1 inline h-3 w-3" />Publicar</button>}
                  {['draft', 'active'].includes(story.status) && <button type="button" onClick={() => { setEditing(story as unknown as Story); setComposerOpen(true); }} className="rounded-lg border border-[var(--color-border-subtle)] p-1.5 text-slate-600 dark:border-slate-700 dark:text-slate-300" aria-label="Editar story"><Pencil className="h-3.5 w-3.5" /></button>}
                  <button type="button" onClick={() => void openStats(story)} className="rounded-lg border border-[var(--color-border-subtle)] p-1.5 text-slate-600 dark:border-slate-700 dark:text-slate-300" aria-label="Ver estatísticas"><BarChart3 className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void remove(story)} className="rounded-lg border border-rose-200 p-1.5 text-rose-500" aria-label="Eliminar story"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedStats && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-3">
            <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 dark:bg-slate-900">
              <div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900 dark:text-white">Desempenho</h3><button type="button" onClick={() => setSelectedStats(null)} aria-label="Fechar desempenho"><X className="h-4 w-4" /></button></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">{[['Vistas', selectedStats.counts?.views], ['Gostos', selectedStats.counts?.likes], ['Reações', selectedStats.counts?.reactions], ['Respostas', selectedStats.counts?.replies], ['Sondagens', selectedStats.counts?.pollVotes], ['Perguntas', selectedStats.counts?.questionResponses]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800"><div className="text-lg font-black text-slate-900 dark:text-white">{String(value ?? 0)}</div><div className="text-[9px] font-bold text-slate-500">{String(label)}</div></div>)}</div>
              <h4 className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Visualizadores</h4>
              <div className="mt-1 space-y-1">{(selectedStats.viewers || []).length === 0 ? <p className="text-xs text-slate-500">Sem visualizações registadas.</p> : (selectedStats.viewers || []).map((viewer: any) => <div key={viewer.userId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-800"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-black">{viewer.name?.slice(0, 1)}</span><span className="flex-1 font-bold">{viewer.name}</span><span className="text-[9px] text-slate-300">{formatDate(viewer.viewedAt)}</span></div>)}</div>
            </div>
          </div>
        )}

        {composerOpen && (
          <StoryComposer
            open={composerOpen}
            currentUser={currentUser}
            draft={editing}
            onClose={() => { setComposerOpen(false); setEditing(null); }}
            onPublished={(story) => {
              setComposerOpen(false);
              setEditing(null);
              onStoryPublished?.(story);
              void load();
            }}
            onNotice={(message) => setError(message)}
          />
        )}
      </div>
    </div>
  );
};

export default StoriesManagementHub;
