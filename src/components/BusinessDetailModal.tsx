import React, { useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Globe,
  Share2,
  CheckCircle,
  Tag,
  Flag,
  Award,
  MessageSquare,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellOff,
  UserPlus,
  UserCheck,
  FileText,
} from 'lucide-react';
import { Business, Language, QualitativeScore, Review, UserProfile } from '../types';
import { getTranslation } from '../utils/i18n';
import { translatePublishedText } from '../utils/contentTranslation';
import { QUALITATIVE_SCORE_LABELS, calculateBusinessRating, getQualitativeScoreLabel } from '../utils/reviews';
import { Badge, Button, Card, EmptyState, IconButton } from './ui';
import { FeedPostCard } from './FeedPostCard';

interface BusinessDetailModalProps {
  business: Business | null;
  currentLang: Language;
  onClose: () => void;
  onAddReview: (businessId: string, review: Review) => void;
  onFlagReview?: (businessId: string, reviewId: string, reason: string) => void;
  currentUser?: UserProfile | null;
  onRequireLogin?: (notice?: string) => void;
  isFollowed?: boolean;
  onToggleFollow?: (businessId: string) => void;
  onToggleNotifications?: (businessId: string) => void;
  notificationsMuted?: boolean;
  onMessage?: (businessId: string) => void;
  onContactMetric?: (businessId: string, metric: 'phoneClicks' | 'whatsappClicks' | 'directionsClicks' | 'websiteClicks') => void;
}

export const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({
  business,
  currentLang,
  onClose,
  onAddReview,
  onFlagReview,
  currentUser,
  onRequireLogin,
  isFollowed = false,
  onToggleFollow,
  onToggleNotifications,
  notificationsMuted = false,
  onMessage,
  onContactMetric,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const detailScrollRef = React.useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'info' | 'posts' | 'promotions' | 'reviews'>('info');

  // Review Form State
  const [selectedQualitative, setSelectedQualitative] = useState<QualitativeScore>('muito_bom');
  const [authorName, setAuthorName] = useState(currentUser?.name || '');
  const [authorPhone, setAuthorPhone] = useState(currentUser?.phone || '');
  const [commentText, setCommentText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  React.useEffect(() => {
    if (business) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.classList.remove('modal-open');
      };
    }
  }, [business]);

  React.useEffect(() => {
    setActiveTab('info');
    setSelectedQualitative('muito_bom');
    setAuthorName(currentUser?.name || '');
    setAuthorPhone(currentUser?.phone || '');
    setCommentText('');
    setReviewSubmitted(false);
  }, [business?.id, currentUser?.id]);

  React.useEffect(() => {
    if (!business) return;
    detailScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [business?.id]);

  if (!business) return null;

  const activePromotions = business.promotions.filter((promotion) => promotion.isActive);

  const scoreOptions: { score: QualitativeScore; label: string; color: string }[] = [
    { score: 'nao_gostei', label: t('nao_gostei'), color: 'border-red-300 bg-red-50 text-red-800' },
    { score: 'gostei', label: t('gostei'), color: 'border-blue-300 bg-blue-50 text-blue-800' },
    { score: 'gostei_muito', label: t('gostei_muito'), color: 'border-amber-300 bg-amber-50 text-amber-800' },
    { score: 'muito_bom', label: t('muito_bom'), color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  ];

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie a sua conta (Cidadão ou Empresa) para avaliar empresas.');
      return;
    }
    if (!authorName.trim()) return;

    const newReview: Review = {
      id: 'rev-' + Date.now(),
      businessId: business.id,
      authorName,
      authorPhone: authorPhone.slice(0, 6) + '***',
      qualitativeScore: selectedQualitative,
      comment: commentText,
      createdAt: new Date().toISOString(),
      verifiedSms: false,
      status: 'approved',
    };

    onAddReview(business.id, newReview);
    setReviewSubmitted(true);
  };

  const shareProfile = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: business.name,
          text: `Ficha de ${business.name} no Guigui.com!`,
          url: window.location.href,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copiado para a área de transferência!');
      } else {
        alert('A partilha não está disponível neste navegador.');
      }
    } catch {
      // O utilizador pode cancelar a partilha nativa sem gerar erro na aplicação.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={detailScrollRef} className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl relative text-slate-900 flex flex-col my-auto border border-slate-200 overscroll-contain">
        {/* Botão de retrocesso destacado no canto superior esquerdo */}
        <Button type="button"
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="absolute top-4 left-4 z-20 rounded-full bg-white/95 shadow-md group"
          title={`${t('back')} ao Diretório / Feed`}
          aria-label={`${t('back')}`}
        >
          <ArrowLeft className="w-4 h-4 text-emerald-600 group-hover:-translate-x-0.5 transition-transform" />
          <span>{t('back')}</span>
        </Button>

        {/* Close Button */}
        <IconButton
          label={t('close')}
          variant="secondary"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-full bg-white/90 shadow-sm"
          title={`${t('close')}`}
        >
          <X className="w-5 h-5" />
        </IconButton>

        {/* Header Cover & Logo */}
        <div className="relative h-52 sm:h-64 w-full bg-slate-100 overflow-hidden flex-shrink-0">
          <img src={business.coverImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />

          {/* Logo & Main Info */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-4 text-white">
            <div className="flex items-end gap-3">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-white bg-white overflow-hidden shadow-md flex-shrink-0">
                <img src={business.logo} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black">{business.name}</h2>
                  {business.verified && (
                    <CheckCircle className="w-5 h-5 text-emerald-400" aria-label={t('verifiedBadge')} />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-200 mt-0.5 font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{business.neighborhood}</span>
                  <span>⬢</span>
                  <span>{business.address}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onToggleFollow && (
                <Button type="button"
                  variant={isFollowed ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => onToggleFollow(business.id)}
                  className={isFollowed ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-white/90 text-slate-900 hover:bg-white'}
                  aria-label={isFollowed ? `Deixar de seguir ${business.name}` : `Seguir ${business.name}`}
                >
                  {isFollowed ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{isFollowed ? 'A seguir' : 'Seguir'}</span>
                </Button>
              )}
              {onToggleNotifications && isFollowed && (
                <Button type="button"
                  variant={notificationsMuted ? 'secondary' : 'accent'}
                  size="sm"
                  onClick={() => onToggleNotifications(business.id)}
                  className={notificationsMuted ? 'bg-slate-700 text-slate-200' : 'bg-amber-400 text-slate-950'}
                  aria-label={notificationsMuted ? `Activar notificações de ${business.name}` : `Desactivar notificações de ${business.name}`}
                  title={notificationsMuted ? 'Activar notificações desta empresa' : 'Desactivar notificações desta empresa'}
                >
                  {notificationsMuted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{notificationsMuted ? 'Activar sino' : 'Sino activo'}</span>
                </Button>
              )}
              {onMessage && (
                <Button type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onMessage(business.id)}
                  className="bg-blue-600 hover:bg-blue-500"
                  aria-label={`${t('sendMessage')} interna para ${business.name}`}
                  title={`${t('sendMessage')} dentro do Guigui.com`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mensagem</span>
                </Button>
              )}
              <Button type="button"
                variant="secondary"
                size="sm"
                onClick={shareProfile}
                className="bg-white/90 text-slate-900 hover:bg-white"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Partilhar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-slate-50 border-b border-slate-200 px-4 pt-2 text-xs font-semibold sm:flex sm:flex-wrap sm:gap-2">
          <button type="button"
            onClick={() => setActiveTab('info')}
            className={`w-full py-3 px-3 border-b-2 transition min-h-[44px] text-left sm:w-auto sm:px-4 ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Informações & Contactos
          </button>

          <button type="button"
            onClick={() => setActiveTab('posts')}
            aria-current={activeTab === 'posts' ? 'page' : undefined}
            className={`w-full py-3 px-3 border-b-2 transition flex items-center gap-1.5 min-h-[44px] text-left sm:w-auto sm:px-4 ${
              activeTab === 'posts'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Publicações</span>
            <Badge variant="neutral" className="px-2 py-0.5 text-[10px]">
              {business.posts.length}
            </Badge>
          </button>

          <button type="button"
            onClick={() => setActiveTab('promotions')}
            aria-current={activeTab === 'promotions' ? 'page' : undefined}
            className={`w-full py-3 px-3 border-b-2 transition flex items-center gap-1.5 min-h-[44px] text-left sm:w-auto sm:px-4 ${
              activeTab === 'promotions'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>Promoções</span>
            <Badge variant="warning" className="px-2 py-0.5 text-[10px]">
              {activePromotions.length}
            </Badge>
          </button>

          <button type="button"
            onClick={() => setActiveTab('reviews')}
            aria-current={activeTab === 'reviews' ? 'page' : undefined}
            className={`w-full py-3 px-3 border-b-2 transition flex items-center gap-1.5 min-h-[44px] text-left sm:w-auto sm:px-4 ${
              activeTab === 'reviews'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span>Avaliações</span>
            <Badge variant="neutral" className="px-2 py-0.5 text-[10px]">
              {business.reviews.length}
            </Badge>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 flex-1 text-xs">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Main Column */}
              <div className="md:col-span-2 space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Sobre o Negócio
                  </h3>
                  <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {translatePublishedText(business.description, currentLang, 'description')}
                  </p>
                </div>

                {/* Photo Gallery */}
                {business.gallery.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Galeria
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {business.gallery.map((img, idx) => (
                        <div key={idx} className="h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Location Map Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Localização em Bissau ({business.neighborhood})</span>
                  </h3>
                  <p className="text-slate-500 mb-3">{business.address}</p>
                  <div className="h-32 bg-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-700 border border-slate-300">
                    <MapPin className="w-7 h-7 text-blue-600 animate-bounce" />
                    <span className="font-semibold text-slate-900 mt-1">
                      {business.name} ⬢ {business.neighborhood}
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(business.address + ' Bissau Guinea-Bissau')}`}
                      onClick={() => onContactMetric?.(business.id, 'directionsClicks')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-[11px] bg-white border border-slate-300 px-3 py-1 rounded-full text-blue-700 font-bold hover:bg-blue-50 transition shadow-sm"
                    >
                      Abrir no Google Maps
                    </a>
                  </div>
                </div>
              </div>

              {/* Sidebar Contact Actions */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Contactos Diretos
                  </h3>

                  {onMessage && (
                    <button type="button"
                      onClick={() => onMessage(business.id)}
                      className="w-full py-3 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Mensagem dentro do sistema</span>
                    </button>
                  )}

                  <a
                    href={`https://wa.me/${business.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onContactMetric?.(business.id, 'whatsappClicks')}
                    className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp externo: {business.whatsapp}</span>
                  </a>

                  <a
                    href={`tel:${business.phone}`}
                    onClick={() => onContactMetric?.(business.id, 'phoneClicks')}
                    className="w-full py-3 px-3 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Phone className="w-4 h-4 text-blue-600" />
                    <span>Ligar pela operadora: {business.phone}</span>
                  </a>

                  {business.website && (
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onContactMetric?.(business.id, 'websiteClicks')}
                      className="w-full py-3 px-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      <Globe className="w-4 h-4 text-slate-600" />
                      <span>Visitar Website</span>
                    </a>
                  )}
                </div>

                {/* Opening Hours */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Horário de Funcionamento</span>
                  </h3>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {business.openingHours}
                  </p>
                </div>

                {/* Idiomas de atendimento (não traduzidos: são as línguas faladas pelo negócio) */}
                {(business.serviceLanguages?.length || 0) > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>{t('business.serviceLanguages')}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {business.serviceLanguages!.map((lang) => (
                        <span key={lang} className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                          {getTranslation(currentLang, `language.${lang}`)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {business.posts.length === 0 ? (
                <EmptyState
                  title="Sem publicações recentes"
                  description="Ainda não existem publicações disponíveis para este estabelecimento."
                  icon={<FileText className="h-6 w-6" aria-hidden="true" />}
                />
              ) : (
                business.posts.map((post) => (
                  <FeedPostCard
                    key={post.id}
                    post={post}
                    business={business}
                    currentLang={currentLang}
                    currentUser={currentUser}
                    onRequireLogin={onRequireLogin}
                    onSelectBusiness={() => undefined}
                  />
                ))
              )}
            </div>
          )}

          {/* Promotions Tab */}
          {activeTab === 'promotions' && (
            <div className="space-y-4">
              {activePromotions.length === 0 ? (
                <EmptyState
                  title="Sem promoções ativas"
                  description="Este estabelecimento não tem ofertas disponíveis de momento."
                  icon={<Tag className="h-6 w-6" aria-hidden="true" />}
                />
              ) : (
                activePromotions.map((promo) => (
                  <Card key={promo.id} className="bg-amber-50/60 p-4 sm:p-5 border-amber-300 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div>
                      <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                        {promo.discountBadge}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">{translatePublishedText(promo.title, currentLang, 'title')}</h4>
                      <p className="text-slate-700 mt-1">{translatePublishedText(promo.description, currentLang, 'description')}</p>
                    </div>

                    {promo.code && (
                      <div className="bg-white border border-amber-400 p-3 rounded-xl text-center flex-shrink-0 shadow-sm">
                        <div className="text-[10px] text-slate-500 uppercase">Código</div>
                        <div className="font-mono text-sm font-extrabold text-amber-700">
                          {promo.code}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Summary Header according to Sec. 8 */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-2xl space-y-2 border border-blue-800 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                      Classificação Predominante Qualitativa (Secção 8)
                    </div>
                    <div className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
                      <Award className="w-5 h-5 text-amber-400" />
                      <span>{business.ratingLabel}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-blue-200">{business.reviewsCount}</span>
                    <div className="text-[10px] text-blue-300">Avaliações de clientes</div>
                  </div>
                </div>
                <p className="text-[11px] text-blue-200 border-t border-blue-800/80 pt-2">
                  As avaliações públicas utilizam exclusivamente uma escala qualitativa de 4 níveis. Nunca são exibidas médias numéricas ou estrelas ao público.
                </p>
              </div>

              {/* Reviews List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Avaliações dos Clientes ({business.reviews.length})
                </h3>

                {business.reviews.length === 0 ? (
                  <EmptyState
                    title="Ainda não existem avaliações"
                    description="Seja o primeiro a avaliar este estabelecimento."
                    icon={<Award className="h-6 w-6" aria-hidden="true" />}
                  />
                ) : (
                  business.reviews.map((rev) => {
                    const labelInfo = QUALITATIVE_SCORE_LABELS[rev.qualitativeScore] || QUALITATIVE_SCORE_LABELS.gostei;
                    return (
                      <Card key={rev.id} className="bg-slate-50 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-xs">{rev.authorName}</span>
                            <span className="text-[10px] font-mono text-slate-400">({rev.authorPhone})</span>
                            {rev.verifiedSms && (
                              <Badge variant="success" className="px-1.5 py-0.5 text-[9px]" title="Verificado por SMS de 4 dígitos">
                                <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                SMS Verificado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {new Date(rev.createdAt).toLocaleDateString('pt-PT')}
                            </span>
                            {onFlagReview && (
                              <button type="button"
                                onClick={() => {
                                  const reason = prompt('Motivo da denúncia desta avaliação (ex: conteúdo ofensivo, falso cliente):', 'Conteúdo impróprio');
                                  if (reason) {
                                    onFlagReview(business.id, rev.id, reason);
                                    alert('Denúncia enviada à equipa Guigui para moderação.');
                                  }
                                }}
                                className="text-[10px] text-slate-400 hover:text-red-600 font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-red-50 transition"
                                title="Denunciar avaliação à equipa de moderação"
                              >
                                <Flag className="w-3 h-3" />
                                <span>Denunciar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Qualitative Score Badge */}
                        <div>
                          <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black border ${labelInfo.badgeBg}`}>
                            {getQualitativeScoreLabel(currentLang, rev.qualitativeScore)}
                          </span>
                        </div>

                        {/* Optional Comment */}
                        {rev.comment && (
                          <p className="text-slate-800 text-xs leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                            "{rev.comment}"
                          </p>
                        )}

                        {/* Owner Reply */}
                        {rev.ownerReply && (
                          <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-xl text-xs space-y-1">
                            <div className="font-extrabold text-blue-900 flex items-center gap-1 text-[11px]">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                              <span>Resposta do Estabelecimento ({business.name}):</span>
                            </div>
                            <p className="text-blue-950 leading-relaxed font-medium">
                              {rev.ownerReply}
                            </p>
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Add Review Form */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-600" />
                    <span>Deixar Avaliação Qualitativa</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Limite anti-abuso: 1 avaliação por telemóvel por empresa. Permitida nova reavaliação a cada 90 dias.
                  </p>
                </div>

                {reviewSubmitted ? (
                  <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-center text-emerald-800 text-xs space-y-1">
                    <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto" />
                    <div className="font-bold">Avaliação confirmada e publicada com sucesso!</div>
                    <p className="text-[11px] text-emerald-700">A sua opinião foi registada e o rótulo do estabelecimento atualizado.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <label className="block text-slate-700 font-bold mb-2 text-xs">
                        Classificação Qualitativa (Escolha 1 opção)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {scoreOptions.map((opt) => (
                          <button
                            type="button"
                            key={opt.score}
                            onClick={() => setSelectedQualitative(opt.score)}
                            className={`p-2.5 rounded-xl border text-center font-bold text-xs transition min-h-[44px] ${
                              selectedQualitative === opt.score
                                ? opt.color + ' ring-2 ring-blue-600 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1 text-xs">Seu Nome / Apelido</label>
                        <input
                          type="text"
                          required
                          value={authorName}
                          onChange={(e) => setAuthorName(e.target.value)}
                          placeholder="Ex: Mamadu Djaló"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900"
                        />
                      </div>

                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 font-bold text-xs">Comentário Escrito Opcional</label>
                        <span className={`text-[10px] font-mono font-bold ${commentText.length >= 190 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {commentText.length}/200 caracteres
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={200}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Ex: Atendimento impecável e refeição típica muito bem confecionada..."
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">Máximo de 200 caracteres, sujeito a moderação de linguagem.</span>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 min-h-[44px] shadow-sm"
                    >
                      <Award className="w-4 h-4 text-amber-300" />
                      <span>Publicar avaliação</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
