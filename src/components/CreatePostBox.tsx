import React, { useState } from 'react';
import {
  Image,
  Tag,
  Sparkles,
  ShieldCheck,
  X,
  Send,
  Building2,
  Video,
  Crown,
  Plus,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { Business, BusinessPost, Language, ModerationResult, UserProfile } from '../types';
import { getTranslation } from '../utils/i18n';

const readLocalMediaFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!/^image\/(jpeg|png|webp|gif)|^video\/(mp4|webm|quicktime)$/.test(file.type)) {
    reject(new Error('Formato não suportado. Use imagem JPG/PNG/WebP/GIF ou vídeo MP4/WebM.'));
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    reject(new Error('O ficheiro excede o limite de 25 MB da versão de demonstração.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro local.'));
  reader.readAsDataURL(file);
});

interface CreatePostBoxProps {
  business: Business;
  onAddPost: (businessId: string, post: BusinessPost) => void;
  currentUser?: UserProfile | null;
  currentLang?: Language;
  onRequireLogin?: (notice?: string) => void;
}

export const CreatePostBox: React.FC<CreatePostBoxProps> = ({
  business,
  onAddPost,
  currentUser,
  currentLang = 'pt' as Language,
  onRequireLogin,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [modalOpen, setModalOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState<'image' | 'video' | 'gallery'>('image');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postVideoUrl, setPostVideoUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [newGalleryInput, setNewGalleryInput] = useState('');
  const [isModerating, setIsModerating] = useState(false);
  const [aiResult, setAiResult] = useState<ModerationResult | null>(null);

  const isPlanSubscriber = Boolean(business && business.tier);

  const handleOpenClick = () => {
    if (!currentUser) {
      onRequireLogin?.(t('loginToPublish'));
      return;
    }
    setModalOpen(true);
  };

  if (!business) return null;

  const handleLocalImage = async (file?: File) => {
    if (!file) return;
    try { setPostImageUrl(await readLocalMediaFile(file)); } catch (error) { alert(error instanceof Error ? error.message : 'Falha ao carregar a imagem.'); }
  };

  const handleLocalVideo = async (file?: File) => {
    if (!file) return;
    try { setPostVideoUrl(await readLocalMediaFile(file)); } catch (error) { alert(error instanceof Error ? error.message : 'Falha ao carregar o vídeo.'); }
  };

  const handleLocalGallery = async (files: FileList | null) => {
    if (!files) return;
    try {
      const urls = await Promise.all(Array.from(files).map(readLocalMediaFile));
      setGalleryUrls((previous) => [...previous, ...urls]);
    } catch (error) { alert(error instanceof Error ? error.message : 'Falha ao carregar a galeria.'); }
  };

  const handleAddGalleryPhoto = () => {
    if (!newGalleryInput.trim()) return;
    setGalleryUrls((prev) => [...prev, newGalleryInput.trim()]);
    setNewGalleryInput('');
  };

  const handleRemoveGalleryPhoto = (idx: number) => {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle || !postContent) return;

    setIsModerating(true);
    setAiResult(null);

    try {
      const res = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${postTitle}\n${postContent}`,
          author: business.name,
          type: 'post',
        }),
      });

      const data = await res.json();
      setAiResult(data.result);

      if (data.result.status === 'verde' || data.result.status === 'amarelo') {
        const finalGallery = mediaTab === 'gallery' ? galleryUrls : postImageUrl ? [postImageUrl] : [];
        const isSubscriber = Boolean(business.tier);

        const newPost: BusinessPost = {
          id: 'post-' + Date.now(),
          businessId: business.id,
          businessName: business.name,
          businessLogo: business.logo,
          title: postTitle,
          content: postContent,
          imageUrl: postImageUrl || (galleryUrls.length > 0 ? galleryUrls[0] : undefined),
          videoUrl: mediaTab === 'video' && postVideoUrl ? postVideoUrl : undefined,
          mediaType: mediaTab,
          mediaGallery: finalGallery.length > 0 ? finalGallery : undefined,
          isPlanSubscriberPost: isSubscriber,
          planBadge: isSubscriber ? `Plano ${business.tier?.toUpperCase()}` : undefined,
          createdAt: new Date().toISOString(),
          status: 'approved',
          likesCount: 1,
          reactions: { like: 1 },
          comments: [],
          sharesCount: 0,
          neighborhood: business.neighborhood,
        };

        onAddPost(business.id, newPost);
        setTimeout(() => {
          setPostTitle('');
          setPostContent('');
          setPostImageUrl('');
          setPostVideoUrl('');
          setGalleryUrls([]);
          setAiResult(null);
          setModalOpen(false);
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao publicar. Tente novamente.');
    } finally {
      setIsModerating(false);
    }
  };

  return (
    <>
      {/* Modern Create Post Trigger Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={currentUser?.avatarUrl || business.logo}
            alt=""
            className="w-10 h-10 rounded-2xl object-cover border border-slate-200 shrink-0"
          />

          <button type="button"
            onClick={handleOpenClick}
            className="flex-1 bg-slate-100 hover:bg-slate-200/80 rounded-2xl px-4 py-3 text-left text-xs sm:text-sm text-slate-500 font-medium transition cursor-pointer border border-slate-200/60"
          >
            {currentUser ? `${t('publishAs')} ${currentUser.name}...` : t('publishLoginPrompt')}
          </button>
        </div>

        <hr className="border-slate-100" />

        {/* Action Buttons Row */}
        <div className="flex items-center justify-around text-xs font-bold text-slate-600 gap-1">
          <button type="button"
            onClick={() => {
              setMediaTab('image');
              handleOpenClick();
            }}
            className="flex-1 py-2 rounded-2xl hover:bg-slate-50 transition flex items-center justify-center gap-1.5 text-emerald-700"
          >
            <Image className="w-4 h-4 text-emerald-600" />
            <span>{t('photo')}</span>
          </button>

          <button type="button"
            onClick={() => {
              setMediaTab('video');
              handleOpenClick();
            }}
            className="flex-1 py-2 rounded-2xl hover:bg-slate-50 transition flex items-center justify-center gap-1.5 text-purple-700"
          >
            <Video className="w-4 h-4 text-purple-600" />
            <span className="flex items-center gap-1">
              <span>{t('video')}</span>
              {isPlanSubscriber && <Crown className="w-3 h-3 text-amber-500" />}
            </span>
          </button>

          <button type="button"
            onClick={() => {
              setMediaTab('gallery');
              handleOpenClick();
            }}
            className="flex-1 py-2 rounded-2xl hover:bg-slate-50 transition flex items-center justify-center gap-1.5 text-blue-700"
          >
            <Tag className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Galeria</span>
          </button>

          <button type="button"
            onClick={handleOpenClick}
            className="flex-1 py-2 rounded-2xl hover:bg-[#F0F2F5] transition flex items-center justify-center gap-1.5 text-[#1877F2]"
          >
            <Sparkles className="w-4 h-4 text-[#1877F2]" />
            <span className="hidden md:inline">IA</span>
          </button>
        </div>
      </div>

      {/* Post Modal Dialog with Media Selector */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  Criar Publicação Comercial
                </h3>
                {isPlanSubscriber && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    <span>Plano {business.tier?.toUpperCase()}</span>
                  </span>
                )}
              </div>
              <button type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Business Author Metadata */}
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <img src={business.logo} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                <div>
                  <div className="font-bold text-slate-900 text-sm">{business.name}</div>
                  <span className="text-[10px] bg-blue-50 text-[#1877F2] px-2 py-0.5 rounded-full font-bold">
                    📍 {business.neighborhood} • Público 🌐
                  </span>
                </div>
              </div>

              {/* Media Format Selector Tabs */}
              <div className="bg-slate-100 p-1 rounded-2xl grid grid-cols-3 gap-1 font-bold text-center">
                <button
                  type="button"
                  onClick={() => setMediaTab('image')}
                  className={`py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition ${
                    mediaTab === 'image'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Image className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('business.FotoUnica')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaTab('video')}
                  className={`py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition ${
                    mediaTab === 'video'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 text-purple-600" />
                  <span>Vídeo Comercial</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaTab('gallery')}
                  className={`py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition ${
                    mediaTab === 'gallery'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Galeria de Fotos</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Título da Publicação</label>
                  <input
                    type="text"
                    required
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="Ex: Novo Lote de Produtos & Oferta Especial..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-[#1877F2]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Descrição / Conteúdo</label>
                  <textarea
                    required
                    rows={3}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Escreva a novidade para os clientes e moradores de Bissau..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#1877F2]"
                  />
                </div>

                {/* 1. Single Image Tab */}
                {mediaTab === 'image' && (
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">{t('business.ImagemPublicacao')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-3 text-[11px] font-bold text-emerald-800">
                        <span>Carregar</span>
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleLocalImage(e.target.files?.[0])} />
                      </label>
                      <input
                        type="url"
                        value={postImageUrl.startsWith('data:') ? '' : postImageUrl}
                        onChange={(e) => setPostImageUrl(e.target.value)}
                        placeholder="Ou inserir URL da imagem..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-[#1877F2]"
                      />
                    </div>
                    {postImageUrl && (
                      <div className="mt-2 h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                        <img src={postImageUrl} alt={t('business.PreVisualizacao')} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Video Tab (Plan Subscribers) */}
                {mediaTab === 'video' && (
                  <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-purple-900 font-extrabold flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-purple-600" />
                        <span>Link do Vídeo (YouTube, Vimeo ou Direct .MP4)</span>
                      </label>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                        {isPlanSubscriber ? '👑 Recurso do Plano Ativo' : 'Disponível no Plano'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-purple-300 bg-purple-100/70 px-3 py-3 text-[11px] font-bold text-purple-900">
                        <span>Carregar vídeo local</span>
                        <input type="file" accept="video/*" className="sr-only" onChange={(e) => handleLocalVideo(e.target.files?.[0])} />
                      </label>
                      <input
                        type="url"
                        value={postVideoUrl.startsWith('data:') ? '' : postVideoUrl}
                        onChange={(e) => setPostVideoUrl(e.target.value)}
                        placeholder="Ou inserir URL YouTube, Vimeo ou .MP4..."
                        className="w-full bg-white border border-purple-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <p className="text-[11px] text-purple-700">
                      O vídeo será reproduzido com alta qualidade diretamente no feed principal para os utilizadores.
                    </p>
                  </div>
                )}

                {/* 3. Photo Gallery Tab */}
                {mediaTab === 'gallery' && (
                  <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-blue-900 font-extrabold flex items-center gap-1.5">
                        <Image className="w-4 h-4 text-blue-600" />
                        <span>Adicionar Fotos à Galeria</span>
                      </label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                        {galleryUrls.length} foto(s) anexada(s)
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-100/70 px-3 py-2 text-[11px] font-bold text-blue-900">
                        <span>Carregar</span>
                        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => handleLocalGallery(e.target.files)} />
                      </label>
                      <input
                        type="url"
                        value={newGalleryInput}
                        onChange={(e) => setNewGalleryInput(e.target.value)}
                        placeholder="Cole o link da foto (URL)..."
                        className="flex-1 bg-white border border-blue-200 rounded-xl p-2 text-xs text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={handleAddGalleryPhoto}
                        className="px-3 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Anexar</span>
                      </button>
                    </div>

                    {galleryUrls.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {galleryUrls.map((url, idx) => (
                          <div key={idx} className="relative h-16 rounded-xl overflow-hidden border border-blue-200 group">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryPhoto(idx)}
                              className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full text-[10px] opacity-90 hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Result Box */}
                {aiResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      aiResult.status === 'verde'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <span className="font-bold">Moderação Gemini IA: {aiResult.status.toUpperCase()}</span>
                      <p className="text-[11px] mt-0.5">{aiResult.reason}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isModerating}
                  className="w-full py-3.5 bg-[#1877F2] hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Send className="w-4 h-4" />
                  <span>{isModerating ? 'A Validar com IA...' : 'Publicar no Feed Guigui'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
