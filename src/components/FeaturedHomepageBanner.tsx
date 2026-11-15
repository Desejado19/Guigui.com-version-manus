import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import type { AdCampaign, Business } from '../types';

interface FeaturedHomepageBannerProps {
  businesses: Business[];
  campaigns: AdCampaign[];
  onBusinessSelect: (business: Business) => void;
  onCampaignImpression: (campaignId: string) => void;
  onCampaignClick: (campaignId: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
}

type HomepageSlide =
  | { type: 'business'; id: string; business: Business }
  | { type: 'campaign'; id: string; campaign: AdCampaign };

const SLIDE_INTERVAL_MS = 7000;

export const FeaturedHomepageBanner: React.FC<FeaturedHomepageBannerProps> = ({
  businesses,
  campaigns,
  onBusinessSelect,
  onCampaignImpression,
  onCampaignClick,
}) => {
  const slides = useMemo<HomepageSlide[]>(() => {
    const featuredBusinesses = businesses
      .filter((business) => business.status === 'active'
        && typeof business.homepageFeaturedOrder === 'number'
        && Number.isInteger(business.homepageFeaturedOrder)
        && business.homepageFeaturedOrder >= 0)
      .sort((left, right) => left.homepageFeaturedOrder! - right.homepageFeaturedOrder!);

    return [
      ...featuredBusinesses.map((business) => ({ type: 'business' as const, id: business.id, business })),
      ...campaigns.map((campaign) => ({ type: 'campaign' as const, id: campaign.id, campaign })),
    ];
  }, [businesses, campaigns]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex];

  useEffect(() => {
    setActiveSlideIndex((index) => slides.length === 0 ? 0 : index % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setActiveSlideIndex((index) => (index + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  useEffect(() => {
    if (activeSlide?.type === 'campaign') onCampaignImpression(activeSlide.campaign.id);
  }, [activeSlide?.type, activeSlide?.id, onCampaignImpression]);

  if (!activeSlide) return null;

  const goToSlide = (offset: -1 | 1) => {
    setActiveSlideIndex((index) => (index + offset + slides.length) % slides.length);
  };

  return (
    <section className="guigui-sponsored-banner" aria-label="Destaques da página inicial" aria-live="polite">
      {activeSlide.type === 'business' ? (
        <div className="group grid grid-cols-1 items-stretch sm:grid-cols-[1.35fr_1fr]">
          <div className="guigui-sponsored-copy">
            <span className="guigui-sponsored-label">Empresa em destaque</span>
            <h2>{activeSlide.business.name}</h2>
            {activeSlide.business.description && <p>{activeSlide.business.description}</p>}
            <button
              type="button"
              onClick={() => onBusinessSelect(activeSlide.business)}
              className="guigui-sponsored-link inline-flex items-center gap-1"
              aria-label={`Ver perfil público de ${activeSlide.business.name}`}
            >
              Ver perfil público <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
          {activeSlide.business.coverImage && (
            <img src={activeSlide.business.coverImage} alt="" className="guigui-sponsored-image" />
          )}
        </div>
      ) : (
        <a
          href={activeSlide.campaign.linkUrl || '#'}
          target={activeSlide.campaign.linkUrl && !activeSlide.campaign.linkUrl.startsWith('#') ? '_blank' : undefined}
          rel="noreferrer"
          onClick={(event) => onCampaignClick(activeSlide.campaign.id, event)}
          className="group grid grid-cols-1 items-stretch sm:grid-cols-[1.35fr_1fr]"
        >
          <div className="guigui-sponsored-copy">
            <span className="guigui-sponsored-label">
              Publicidade — {activeSlide.campaign.audience === 'all' ? 'Comunidade Guigui' : activeSlide.campaign.audience || 'Comunidade Guigui'}
            </span>
            <h2>{activeSlide.campaign.title}</h2>
            {activeSlide.campaign.description && <p>{activeSlide.campaign.description}</p>}
            <span className="guigui-sponsored-link">Saber mais →</span>
          </div>
          {activeSlide.campaign.imageUrl && <img src={activeSlide.campaign.imageUrl} alt="" className="guigui-sponsored-image" />}
        </a>
      )}

      {slides.length > 1 && (
        <div className="flex items-center justify-end gap-2 px-3 pb-3">
          <button
            type="button"
            aria-label="Destaque anterior"
            onClick={() => goToSlide(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-sm hover:bg-white"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs font-bold text-slate-700 dark:text-slate-200">{activeSlideIndex + 1} / {slides.length}</span>
          <button
            type="button"
            aria-label="Próximo destaque"
            onClick={() => goToSlide(1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-sm hover:bg-white"
          >
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
};
