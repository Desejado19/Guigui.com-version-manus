import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, ArrowRight, Camera, Check,
  ChevronDown, Clock3, Hash, Image as ImageIcon, Link2, MapPin, Music, Plus,
  Redo2, Send, Sparkles, Sticker, Trash2, Type, Undo2, Upload, X,
} from 'lucide-react';
import type { Story, StoryElement, UserProfile } from '../types';
import { useLocationCatalog } from '../hooks/useLocationCatalog';
import { storyApi, uploadStoryAsset, type StoryElementType, type StoryInputApi } from '../services/storyApi';

interface StoryComposerProps {
  open: boolean;
  currentUser: UserProfile;
  draft?: Story | null;
  onClose: () => void;
  onPublished: (story: Story) => void;
  onNotice?: (message: string) => void;
}

type EditorElement = {
  key: string;
  type: StoryElementType;
  content: Record<string, any>;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  zIndex: number;
};

const EMOJIS = ['😀', '😍', '🔥', '🎉', '👏', '💚', '✨', '☀️', '🌊', '🦁', '🎶', '📍'];
const STICKERS = ['Novo', 'Promoção', 'Últimas unidades', 'Hoje', 'Grátis', 'Guigui'];
const BACKGROUNDS = ['#0f172a', '#064e3b', '#7c2d12', '#4c1d95', '#831843', '#0c4a6e'];

function elementKey() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fromStoryElement(element: StoryElement): EditorElement {
  return {
    key: element.id || elementKey(),
    type: element.type,
    content: { ...(element.content || {}) },
    positionX: element.positionX,
    positionY: element.positionY,
    scale: element.scale,
    rotation: element.rotation,
    zIndex: element.zIndex,
  };
}

export const StoryComposer: React.FC<StoryComposerProps> = ({
  open, currentUser, draft, onClose, onPublished, onNotice,
}) => {
  const { locations } = useLocationCatalog();
  const [storyType, setStoryType] = useState<'image' | 'video' | 'text'>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaPreview, setMediaPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUNDS[0]);
  const [visibility, setVisibility] = useState<'public' | 'limited'>('public');
  const [durationMs, setDurationMs] = useState(5000);
  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [history, setHistory] = useState<EditorElement[][]>([]);
  const [future, setFuture] = useState<EditorElement[][]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderType, setBuilderType] = useState<StoryElementType>('text');
  const [builderText, setBuilderText] = useState('');
  const [builderQuestion, setBuilderQuestion] = useState('');
  const [builderOptions, setBuilderOptions] = useState('Sim\nNão');
  const [builderLabel, setBuilderLabel] = useState('');
  const [builderUrl, setBuilderUrl] = useState('');
  const [builderValue, setBuilderValue] = useState('');
  const [builderDate, setBuilderDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPreview(false);
    setBuilderOpen(false);
    if (draft) {
      setStoryType(draft.storyType || 'image');
      setMediaUrl(draft.mediaUrl || '');
      setMediaPreview(draft.mediaUrl || '');
      setCaption(draft.caption || '');
      setBackgroundColor(draft.backgroundColor || BACKGROUNDS[0]);
      setVisibility(draft.visibility || 'public');
      setDurationMs(draft.durationMs || 5000);
      setLocationId(draft.locationId || '');
      setLocationName(draft.locationName || '');
      setActionLabel(draft.actionLabel || '');
      setActionUrl(draft.actionUrl || '');
      setElements((draft.elements || []).map(fromStoryElement));
    } else {
      setStoryType('image');
      setMediaUrl('');
      setMediaPreview('');
      setCaption('');
      setBackgroundColor(BACKGROUNDS[0]);
      setVisibility('public');
      setDurationMs(5000);
      setLocationId('');
      setLocationName('');
      setActionLabel('');
      setActionUrl('');
      setElements([]);
      setHistory([]);
      setFuture([]);
    }
  }, [open, draft?.id]);

  const commit = (next: EditorElement[]) => {
    setHistory((previous) => [...previous.slice(-30), elements]);
    setFuture([]);
    setElements(next);
  };

  const updateElement = (key: string, patch: Partial<EditorElement>) => {
    setElements((previous) => previous.map((element) => element.key === key ? { ...element, ...patch } : element));
  };

  const undo = () => {
    setHistory((previous) => {
      if (!previous.length) return previous;
      const prior = previous[previous.length - 1];
      setFuture((next) => [elements, ...next].slice(0, 30));
      setElements(prior);
      return previous.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((previous) => {
      if (!previous.length) return previous;
      const next = previous[0];
      setHistory((past) => [...past, elements]);
      setElements(next);
      return previous.slice(1);
    });
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    const localUrl = URL.createObjectURL(file);
    setMediaPreview(localUrl);
    setStoryType(file.type.startsWith('video/') ? 'video' : 'image');
    setUploading(true);
    try {
      const uploaded = await uploadStoryAsset(file);
      setMediaUrl(uploaded.url);
      setMediaPreview(uploaded.url);
      setStoryType(uploaded.kind);
    } catch (uploadError) {
      setMediaUrl('');
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível carregar o ficheiro.');
    } finally {
      setUploading(false);
    }
  };

  const addElement = () => {
    let content: Record<string, any> = {};
    if (builderType === 'text' || builderType === 'sticker' || builderType === 'emoji') {
      if (!builderText.trim()) { setError('Escreve o texto do elemento.'); return; }
      content = { text: builderText.trim(), color: '#ffffff', align: 'center', fontSize: builderType === 'sticker' ? 16 : 24 };
    } else if (builderType === 'poll' || builderType === 'quiz') {
      const options = builderOptions.split('\n').map((option) => option.trim()).filter(Boolean).slice(0, 4);
      if (!builderQuestion.trim() || options.length < 2) { setError('A sondagem precisa de pergunta e duas opções.'); return; }
      content = { question: builderQuestion.trim(), options, correctIndex: 0 };
    } else if (builderType === 'question') {
      if (!builderQuestion.trim()) { setError('Escreve a pergunta.'); return; }
      content = { question: builderQuestion.trim() };
    } else if (builderType === 'countdown') {
      content = { label: builderLabel.trim() || 'Contagem decrescente', targetAt: new Date(builderDate).toISOString() };
    } else if (builderType === 'link' || builderType === 'cta') {
      if (!builderUrl.trim()) { setError('Insere o endereço do link.'); return; }
      content = { label: builderLabel.trim() || 'Ver mais', url: builderUrl.trim() };
    } else if (builderType === 'location') {
      const entry = locations.find((location) => location.name === locationName);
      content = { name: locationName || 'Bissau' };
      if (entry) setLocationId(entry.id);
    } else if (builderType === 'music') {
      if (!builderValue.trim()) { setError('Indica o título da música.'); return; }
      content = { title: builderValue.trim(), artist: builderLabel.trim() };
    } else if (builderType === 'mention') {
      content = { value: builderValue.trim() };
      if (!content.value) { setError('Indica a empresa a mencionar.'); return; }
    } else if (builderType === 'hashtag') {
      content = { value: builderValue.replace(/^#/, '').trim() };
      if (!content.value) { setError('Indica a hashtag.'); return; }
    }
    commit([...elements, {
      key: elementKey(), type: builderType, content,
      positionX: 50, positionY: 35 + (elements.length % 5) * 9, scale: 1, rotation: 0, zIndex: elements.length + 1,
    }]);
    setBuilderOpen(false);
    setError(null);
    setBuilderText('');
    setBuilderQuestion('');
    setBuilderOptions('Sim\nNão');
    setBuilderLabel('');
    setBuilderUrl('');
    setBuilderValue('');
  };

  const save = async (publish: boolean) => {
    if (uploading) { setError('Aguarda o carregamento do ficheiro.'); return; }
    if (storyType !== 'text' && !mediaUrl) { setError('Seleciona uma fotografia ou um vídeo.'); return; }
    if (storyType === 'text' && !caption.trim()) { setError('Escreve o texto da story.'); return; }
    setSaving(true);
    setError(null);
    const payload: StoryInputApi = {
      storyType,
      mediaUrl: storyType === 'text' ? null : mediaUrl,
      caption: caption.trim() || null,
      durationMs,
      backgroundColor,
      visibility,
      locationId: locationId || null,
      locationName: locationName || null,
      actionLabel: actionLabel.trim() || null,
      actionUrl: actionUrl.trim() || null,
      publish,
      elements: elements.map((element) => ({
        type: element.type,
        content: element.content,
        positionX: element.positionX,
        positionY: element.positionY,
        scale: element.scale,
        rotation: element.rotation,
        zIndex: element.zIndex,
      })),
    };
    try {
      const result = draft
        ? await storyApi.update(draft.id, payload)
        : await storyApi.create(payload);
      onPublished(result.story as unknown as Story);
      onNotice?.(publish ? 'Story publicada com sucesso.' : 'Rascunho guardado.');
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível guardar a story.');
    } finally {
      setSaving(false);
    }
  };

  const previewElements = useMemo(() => elements, [elements]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Editor de Story">
      <div className="flex h-full max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3 dark:border-slate-700">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{draft ? 'Editar story' : 'Criar story'}</h2>
            <p className="text-[10px] font-semibold text-slate-500">Publica como {currentUser.businessName || currentUser.name} · visível 24 h</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={undo} disabled={!history.length} className="rounded-lg border border-[var(--color-border-subtle)] p-2 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300" aria-label="Desfazer"><Undo2 className="h-4 w-4" /></button>
            <button type="button" onClick={redo} disabled={!future.length} className="rounded-lg border border-[var(--color-border-subtle)] p-2 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300" aria-label="Refazer"><Redo2 className="h-4 w-4" /></button>
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Fechar editor"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(260px,340px)_1fr]">
          <div className="flex flex-col items-center justify-start bg-slate-950 p-3">
            <div className="relative aspect-[9/16] w-full max-w-[290px] overflow-hidden rounded-2xl bg-slate-900 shadow-xl" style={{ backgroundColor }}>
              {mediaPreview && storyType === 'video' ? <video src={mediaPreview} className="h-full w-full object-contain" muted autoPlay loop playsInline /> : mediaPreview ? <img src={mediaPreview} alt="" className="h-full w-full object-contain" /> : (
                <div className="flex h-full w-full items-center justify-center p-6 text-center text-lg font-black text-white">{caption || 'A tua story'}</div>
              )}
              {caption && mediaPreview && <div className="absolute bottom-4 left-3 right-3 text-center"><p className="inline-block rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-bold text-white">{caption}</p></div>}
              {previewElements.map((element) => (
                <div key={element.key} className="absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/60 px-2 py-1.5 text-center text-[11px] font-black text-white" style={{ left: `${element.positionX}%`, top: `${element.positionY}%`, zIndex: element.zIndex }}>
                  {element.type === 'poll' || element.type === 'quiz' ? `${element.content.question} · ${(element.content.options || []).length} opções`
                    : element.type === 'question' ? element.content.question
                      : element.type === 'link' || element.type === 'cta' ? `${element.content.label} →`
                        : element.type === 'location' ? `📍 ${element.content.name}`
                          : element.type === 'countdown' ? `⏳ ${element.content.label}`
                            : element.type === 'music' ? `🎵 ${element.content.title}`
                              : element.type === 'hashtag' ? `#${element.content.value}`
                                : element.type === 'mention' ? `@${element.content.value}`
                                  : element.content.text}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0] || null)} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0] || null)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-slate-900"><Upload className="h-3.5 w-3.5" /> Ficheiro</button>
              <button type="button" onClick={() => cameraRef.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-white"><Camera className="h-3.5 w-3.5" /> Câmara</button>
            </div>
            {uploading && <p className="mt-2 text-[10px] font-bold text-amber-300">A carregar ficheiro...</p>}
          </div>

          <div className="space-y-4 p-4 text-xs">
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
            <div className="grid grid-cols-3 gap-1.5">
              {(['image', 'video', 'text'] as const).map((type) => (
                <button key={type} type="button" onClick={() => { setStoryType(type); if (type === 'text') { setMediaPreview(''); setMediaUrl(''); } }} className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 font-black ${storyType === type ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {type === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : type === 'video' ? <Camera className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
                  {type === 'image' ? 'Foto' : type === 'video' ? 'Vídeo' : 'Texto'}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="font-black text-slate-700 dark:text-slate-200">Legenda</span>
              <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={2} maxLength={2200} placeholder="Escreve uma legenda..." className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="font-black text-slate-700 dark:text-slate-200">Audiência</span>
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as 'public' | 'limited')} className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="public">Todos os cidadãos</option>
                  <option value="limited">Audiência autenticada</option>
                </select>
              </label>
              <label className="block">
                <span className="font-black text-slate-700 dark:text-slate-200">Localização</span>
                <select value={locationName} onChange={(event) => { setLocationName(event.target.value); setLocationId(locations.find((entry) => entry.name === event.target.value)?.id || ''); }} className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Sem localização</option>
                  {locations.map((entry) => <option key={entry.id} value={entry.name}>{entry.name}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="flex items-center justify-between font-black text-slate-700 dark:text-slate-200"><span>Duração</span><span>{(durationMs / 1000).toFixed(1)} s</span></span>
              <input type="range" min={1000} max={60000} step={500} value={durationMs} onChange={(event) => setDurationMs(Number(event.target.value))} className="mt-1 w-full accent-emerald-600" />
              <span className="text-[10px] font-medium text-slate-500">A duração de reprodução não altera a permanência pública de 24 horas.</span>
            </label>

            <div>
              <span className="font-black text-slate-700 dark:text-slate-200">Fundo (texto)</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {BACKGROUNDS.map((color) => <button key={color} type="button" onClick={() => setBackgroundColor(color)} className={`h-7 w-7 rounded-full border-2 ${backgroundColor === color ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-white'}`} style={{ backgroundColor: color }} aria-label={`Fundo ${color}`} />)}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border-subtle)] p-3 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-700 dark:text-slate-200">Elementos e stickers</span>
                <button type="button" onClick={() => setBuilderOpen((value) => !value)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white"><Plus className="h-3 w-3" /> Adicionar</button>
              </div>
              {builderOpen && (
                <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <select aria-label="Tipo de elemento" value={builderType} onChange={(event) => setBuilderType(event.target.value as StoryElementType)} className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                    <option value="text">Texto</option><option value="emoji">Emoji</option><option value="sticker">Sticker</option>
                    <option value="poll">Sondagem</option><option value="question">Caixa de perguntas</option><option value="quiz">Teste de escolha múltipla</option>
                    <option value="countdown">Contagem decrescente</option><option value="link">Link</option><option value="cta">Chamada para ação</option>
                    <option value="location">Localização</option><option value="mention">Menção a empresa</option><option value="hashtag">Hashtag</option><option value="music">Música</option>
                  </select>
                  {['text', 'sticker', 'emoji'].includes(builderType) && <>
                    {builderType === 'emoji' && <div className="flex flex-wrap gap-1">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setBuilderText(emoji)} className="rounded p-1 text-lg">{emoji}</button>)}</div>}
                    {builderType === 'sticker' && <div className="flex flex-wrap gap-1">{STICKERS.map((sticker) => <button key={sticker} type="button" onClick={() => setBuilderText(sticker)} className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900">{sticker}</button>)}</div>}
                    <input value={builderText} onChange={(event) => setBuilderText(event.target.value)} placeholder="Texto do elemento" className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />
                  </>}
                  {(builderType === 'poll' || builderType === 'question' || builderType === 'quiz') && <input value={builderQuestion} onChange={(event) => setBuilderQuestion(event.target.value)} placeholder="Pergunta" className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />}
                  {(builderType === 'poll' || builderType === 'quiz') && <textarea value={builderOptions} onChange={(event) => setBuilderOptions(event.target.value)} rows={3} placeholder="Uma opção por linha" className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />}
                  {(builderType === 'link' || builderType === 'cta') && <>
                    <input value={builderLabel} onChange={(event) => setBuilderLabel(event.target.value)} placeholder="Texto do botão" className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />
                    <input value={builderUrl} onChange={(event) => setBuilderUrl(event.target.value)} placeholder="https://..." className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />
                  </>}
                  {builderType === 'countdown' && <><input value={builderLabel} onChange={(event) => setBuilderLabel(event.target.value)} placeholder="Título" className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" /><input type="datetime-local" value={builderDate} onChange={(event) => setBuilderDate(event.target.value)} className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" /></>}
                  {builderType === 'location' && <select value={locationName} onChange={(event) => setLocationName(event.target.value)} className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"><option value="">Escolhe o bairro</option>{locations.map((entry) => <option key={entry.id} value={entry.name}>{entry.name}</option>)}</select>}
                  {['mention', 'hashtag', 'music'].includes(builderType) && <input value={builderValue} onChange={(event) => setBuilderValue(event.target.value)} placeholder={builderType === 'mention' ? 'Nome da empresa' : builderType === 'hashtag' ? 'hashtag' : 'Título da música'} className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />}
                  {builderType === 'music' && <input value={builderLabel} onChange={(event) => setBuilderLabel(event.target.value)} placeholder="Artista" className="w-full rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" />}
                  <button type="button" onClick={addElement} className="w-full rounded-lg bg-emerald-600 px-2 py-1.5 font-black text-white">Inserir elemento</button>
                </div>
              )}
              <div className="mt-2 space-y-1.5">
                {elements.length === 0 && <p className="text-[10px] text-slate-500">Sem elementos. A story ainda pode ser publicada só com fotografia, vídeo ou texto.</p>}
                {elements.map((element) => (
                  <div key={element.key} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 dark:bg-slate-800">
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-700 dark:text-slate-200">{element.type} · {element.content.question || element.content.text || element.content.label || element.content.name || element.content.value || element.content.title}</span>
                    <button type="button" onClick={() => updateElement(element.key, { positionY: Math.max(5, element.positionY - 8) })} className="rounded p-1 text-slate-500" aria-label="Mover para cima"><ArrowLeft className="h-3 w-3 rotate-90" /></button>
                    <button type="button" onClick={() => updateElement(element.key, { positionY: Math.min(90, element.positionY + 8) })} className="rounded p-1 text-slate-500" aria-label="Mover para baixo"><ArrowRight className="h-3 w-3 rotate-90" /></button>
                    <button type="button" onClick={() => commit(elements.filter((candidate) => candidate.key !== element.key))} className="rounded p-1 text-rose-500" aria-label="Remover elemento"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="font-black text-slate-700 dark:text-slate-200">Botão de ação</span><input value={actionLabel} onChange={(event) => setActionLabel(event.target.value)} placeholder="Ver oferta" className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800" /></label>
              <label className="block"><span className="font-black text-slate-700 dark:text-slate-200">Link do botão</span><input value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800" /></label>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] px-4 py-3 dark:border-slate-700">
          <button type="button" onClick={() => setPreview((value) => !value)} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Sparkles className="h-3.5 w-3.5" /> {preview ? 'Editar' : 'Pré-visualizar'}</button>
          <div className="flex gap-2">
            <button type="button" onClick={() => void save(false)} disabled={saving || uploading} className="rounded-xl border border-[var(--color-border-default)] px-3 py-2 font-black text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">Guardar rascunho</button>
            <button type="button" onClick={() => void save(true)} disabled={saving || uploading} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-black text-white disabled:opacity-40"><Send className="h-3.5 w-3.5" /> {saving ? 'A publicar...' : 'Publicar story'}</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default StoryComposer;
