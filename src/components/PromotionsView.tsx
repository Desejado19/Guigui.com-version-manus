import React, { useState, useEffect } from 'react';
import { Tag, Clock, MapPin, Sparkles, MessageCircle, Copy, Check, QrCode, X } from 'lucide-react';
import { Promotion, Language, UserProfile, PurchaseOrder } from '../types';
import { getTranslation } from '../utils/i18n';
import { QRCodeDisplay } from './QRCodeDisplay';
import { translatePublishedText } from '../utils/contentTranslation';
import { LocationFilter } from './ui';
import { useLocationCatalog } from '../hooks/useLocationCatalog';
import { locationMatches } from '../../shared/bissauLocations';

interface PromotionsViewProps {
  promotions: Promotion[];
  currentLang: Language;
  currentUser?: UserProfile | null;
  onRequireLogin?: (notice?: string) => void;
  onAddPurchaseOrder?: (order: PurchaseOrder) => void;
  onPromotionMessage?: (promotion: Promotion) => void;
  searchQuery?: string;
}

export const PromotionsView: React.FC<PromotionsViewProps> = ({
  promotions,
  currentLang,
  currentUser,
  onRequireLogin,
  onAddPurchaseOrder,
  onPromotionMessage,
  searchQuery = '',
}) => {
  const t = (key: string) => getTranslation(currentLang, key);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const { locations: bissauLocations } = useLocationCatalog();
  const [activeClaimPromo, setActiveClaimPromo] = useState<Promotion | null>(null);
  const [generatedOrder, setGeneratedOrder] = useState<PurchaseOrder | null>(null);

  const handleClaimPromo = (promo: Promotion) => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie a sua conta para solicitar vouchers e códigos QR de promoção.');
      return;
    }

    const orderCode = `LEV-${Math.floor(1000 + Math.random() * 9000)}`;
    const qrToken = `GUI-QR-${Math.floor(10000 + Math.random() * 90000)}-BSS`;

    const newOrder: PurchaseOrder = {
      id: `ord-${Date.now()}`,
      orderCode,
      qrToken,
      businessId: promo.businessId,
      businessName: promo.businessName,
      customerName: currentUser.name,
      customerPhone: currentUser.phone || '+245 955 00 00',
      itemType: 'promotion',
      itemTitle: `Voucher: ${promo.title} (${promo.discountBadge})`,
      quantity: 1,
      totalPriceXOF: 0,
      paymentMethod: 'orange_money',
      purchasedAt: new Date().toISOString(),
      status: 'pending',
    };

    if (onAddPurchaseOrder) {
      onAddPurchaseOrder(newOrder);
    }

    setGeneratedOrder(newOrder);
    setActiveClaimPromo(promo);
  };

  // Live Timer tick
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const copyToClipboard = (code: string) => {
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie a sua conta para copiar e usar cupões de promoção.');
      return;
    }
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const getTimeRemaining = (validUntil: string) => {
    const total = Date.parse(validUntil) - now.getTime();
    if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds, expired: false };
  };

  const filteredPromos = promotions.filter((p) => {
    if (!p.isActive || Date.parse(p.validUntil) <= now.getTime()) return false;
    if (!locationMatches(p.neighborhood, selectedNeighborhood)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchBiz = p.businessName.toLowerCase().includes(q);
      const matchBadge = p.discountBadge.toLowerCase().includes(q);
      const matchNeigh = p.neighborhood.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchBiz && !matchBadge && !matchNeigh) return false;
    }
    return true;
  });

  return (
    <div className="w-full px-1 py-8 space-y-8 guigui-secondary-page">
      {/* Page Header */}
      <div className="guigui-hero text-white">
        <div className="guigui-hero-inner">
          <div className="guigui-eyebrow">
            <Sparkles className="h-3.5 w-3.5" />
            Ofertas escolhidas para si
          </div>
          <h1 className="guigui-hero-title">
            Descubra. Aproveite. <em>Poupe.</em>
          </h1>
          <p className="guigui-hero-copy">
            As melhores oportunidades de Bissau, reunidas num só lugar e disponíveis por tempo limitado.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5B6B67] flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#C9852A]" />Localização</span>
        <LocationFilter
          locations={bissauLocations}
          selectedLocation={selectedNeighborhood}
          onSelect={setSelectedNeighborhood}
          triggerLabel="Todos"
          allLabel="Ver todos"
        />
      </div>

      {/* Promotions List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPromos.map((promo) => {
          const timer = getTimeRemaining(promo.validUntil);

          return (
            <div
              key={promo.id}
              className="guigui-promo-card bg-white p-5 flex flex-col justify-between"
              onClick={() => onPromotionMessage?.(promo)}
            >
              <div>
                {/* Header Badge & Business Name */}
                <div className="flex items-start justify-between gap-2">
                  <span className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    {promo.discountBadge}
                  </span>
                  <span className="text-[11px] text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    {promo.neighborhood}
                  </span>
                </div>

                {promo.videoUrl ? (
                  <video src={promo.videoUrl} controls className="mt-3 h-40 w-full rounded-2xl border border-purple-200 bg-slate-900 object-cover" aria-label={`Vídeo da promoção ${promo.title}`} />
                ) : promo.imageUrl ? (
                  <img src={promo.imageUrl} alt={`Imagem da promoção ${promo.title}`} className="mt-3 h-40 w-full rounded-2xl border border-amber-200 object-cover" />
                ) : null}

                <div className="mt-3 font-bold text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  {promo.businessName}
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1 leading-snug">
                  {translatePublishedText(promo.title, currentLang, 'title')}
                </h3>

                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {translatePublishedText(promo.description, currentLang, 'description')}
                </p>

                {/* Countdown Timer Widget */}
                <div className="mt-4 bg-slate-50 border border-[var(--color-border-subtle)] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tempo Restante</span>
                  </div>

                  {timer.expired ? (
                    <span className="text-xs text-red-600 font-bold">Expirada</span>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-xs">
                      <div className="bg-white p-1.5 rounded-lg border border-[var(--color-border-subtle)]">
                        <div className="font-extrabold text-slate-900 dark:text-slate-300 text-sm">{timer.days}</div>
                        <div className="text-[9px] text-slate-500 font-sans">DIAS</div>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-[var(--color-border-subtle)]">
                        <div className="font-extrabold text-slate-900 dark:text-slate-300 text-sm">{timer.hours}</div>
                        <div className="text-[9px] text-slate-500 font-sans">HRS</div>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-[var(--color-border-subtle)]">
                        <div className="font-extrabold text-slate-900 dark:text-slate-300 text-sm">{timer.minutes}</div>
                        <div className="text-[9px] text-slate-500 font-sans">MIN</div>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-[var(--color-border-subtle)]">
                        <div className="font-extrabold text-slate-900 dark:text-slate-300 text-sm">{timer.seconds}</div>
                        <div className="text-[9px] text-slate-500 font-sans">SEG</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Promo Code & Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                {promo.code && (
                  <button type="button"
                    onClick={() => copyToClipboard(promo.code!)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-[var(--color-border-subtle)] text-slate-800 dark:text-slate-300 px-3 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between transition min-h-[40px]"
                  >
                    <span>{promo.code}</span>
                    {copiedCode === promo.code ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                )}

                <button type="button"
                  onClick={() => handleClaimPromo(promo)}
                  className="bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold px-3 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm min-h-[40px]"
                  title="Gerar código QR de levantamento para esta promoção"
                >
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>Obter QR Code</span>
                </button>

                <button type="button"
                  onClick={() => {
                    if (!currentUser) {
                      onRequireLogin?.('Inicie sessão ou crie a sua conta para enviar uma mensagem sobre esta promoção.');
                      return;
                    }
                    onPromotionMessage?.(promo);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm min-h-[40px]"
                  title="Enviar esta promoção para a área de mensagens"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar mensagem</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Voucher Modal */}
      {activeClaimPromo && generatedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-900 dark:text-slate-300 relative shadow-2xl space-y-4 my-auto">
            <button type="button"
              onClick={() => {
                setActiveClaimPromo(null);
                setGeneratedOrder(null);
              }}
              className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <QRCodeDisplay
              code={generatedOrder.orderCode}
              qrToken={generatedOrder.qrToken}
              title={activeClaimPromo.title}
              subtitle={activeClaimPromo.businessName}
              buyerName={generatedOrder.customerName}
              buyerPhone={generatedOrder.customerPhone}
              amountXOF={0}
              status="pending"
              currentLang={currentLang}
            />

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-500">
                Apresente este código ou QR na <strong>{activeClaimPromo.businessName}</strong> para aplicar o seu desconto em Bissau.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
