import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Megaphone } from 'lucide-react';
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

/**
 * Divide o título em duas partes para o realce laranja da última expressão.
 * Títulos com uma ou duas palavras ficam inteiros a branco: dividi-los tornaria
 * o texto difícil de ler e quebraria pesquisas por texto exacto.
 */
function splitTitle(value: string): { lead: string; accent: string } {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return { lead: value, accent: '' };
  return {
    lead: words.slice(0, -2).join(' '),
    accent: words.slice(-2).join(' '),
  };
}

const SlideTitle: React.FC<{ value: string }> = ({ value }) => {
  const { lead, accent } = splitTitle(value);
  return (
    <h2 className="guigui-sponsored-title">
      {lead}
      {accent ? <> <span className="guigui-sponsored-accent">{accent}</span></> : null}
    </h2>
  );
};

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

  const image = activeSlide.type === 'business'
    ? activeSlide.business.coverImage
    : activeSlide.campaign.imageUrl;

  return (
    <section className="guigui-sponsored-banner" aria-label="Destaques da página inicial" aria-live="polite">
      {activeSlide.type === 'business' ? (
        <div className="guigui-sponsored-slide">
          {image ? <img src={image} alt="" aria-hidden="true" className="guigui-sponsored-bg" /> : null}
          <div className="guigui-sponsored-scrim" aria-hidden="true" />
          <div className="guigui-sponsored-content">
            <span className="guigui-sponsored-label">Empresa em destaque</span>
            <SlideTitle value={activeSlide.business.name} />
            {activeSlide.business.description && (
              <p className="guigui-sponsored-description">{activeSlide.business.description}</p>
            )}
            <button
              type="button"
              onClick={() => onBusinessSelect(activeSlide.business)}
              className="guigui-sponsored-cta"
              aria-label={`Ver perfil público de ${activeSlide.business.name}`}
            >
              Ver perfil público <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <a
          href={activeSlide.campaign.linkUrl || '#'}
          target={activeSlide.campaign.linkUrl && !activeSlide.campaign.linkUrl.startsWith('#') ? '_blank' : undefined}
          rel="noreferrer"
          onClick={(event) => onCampaignClick(activeSlide.campaign.id, event)}
          className="guigui-sponsored-slide"
        >
          {image ? <img src={image} alt="" aria-hidden="true" className="guigui-sponsored-bg" /> : null}
          <div className="guigui-sponsored-scrim" aria-hidden="true" />
          <div className="guigui-sponsored-content">
            <span className="guigui-sponsored-label">
              <Megaphone aria-hidden="true" className="h-3.5 w-3.5 text-[#F58220]" />
              Publicidade — {activeSlide.campaign.audience === 'all' ? 'Comunidade Guigui' : activeSlide.campaign.audience || 'Comunidade Guigui'}
            </span>
            <SlideTitle value={activeSlide.campaign.title} />
            {activeSlide.campaign.description && (
              <p className="guigui-sponsored-description">{activeSlide.campaign.description}</p>
            )}
            <span className="guigui-sponsored-cta">
              Saber mais <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </span>
          </div>
        </a>
      )}

      {slides.length > 1 && (
        <div className="guigui-sponsored-pager">
          <div className="guigui-sponsored-progress" aria-hidden="true">
            <span style={{ width: `${((activeSlideIndex + 1) / slides.length) * 100}%` }} />
          </div>
          <div className="guigui-sponsored-controls">
            <button type="button" aria-label="Destaque anterior" onClick={() => goToSlide(-1)} className="guigui-sponsored-nav">
              <ArrowLeft aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
            </button>
            <span className="guigui-sponsored-counter">{activeSlideIndex + 1}/{slides.length}</span>
            <button type="button" aria-label="Próximo destaque" onClick={() => goToSlide(1)} className="guigui-sponsored-nav">
              <ArrowRight aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
