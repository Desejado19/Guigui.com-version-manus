// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdCampaign, Business } from '../../../src/types';
import { FeaturedHomepageBanner } from '../../../src/components/FeaturedHomepageBanner';

const createBusiness = (overrides: Partial<Business> & Pick<Business, 'id' | 'name'>): Business => ({
  id: overrides.id,
  name: overrides.name,
  slug: overrides.id,
  logo: '',
  coverImage: '',
  gallery: [],
  description: '',
  categoryId: '',
  subcategoryId: '',
  groupGroupId: 'servicos_profissionais',
  tier: 'basic',
  neighborhood: '',
  address: '',
  phone: '',
  whatsapp: '',
  openingHours: '',
  isOpenNow: false,
  priceRange: '$',
  status: 'active',
  verified: false,
  featured: false,
  ratingLabel: '',
  reviewsCount: 0,
  reviews: [],
  posts: [],
  promotions: [],
  metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 },
  subscriptionRenewDate: '',
  postsQuotaRemaining: 0,
  ...overrides,
});

const createCampaign = (overrides: Partial<AdCampaign> & Pick<AdCampaign, 'id' | 'title'>): AdCampaign => ({
  id: overrides.id,
  title: overrides.title,
  productCode: 'homepage_banner',
  placementCode: 'homepage',
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2027-01-01T00:00:00.000Z',
  priority: 1,
  impressions: 0,
  clicks: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('FeaturedHomepageBanner', () => {
  afterEach(cleanup);

  it('places curated active businesses before campaigns and opens the public profile', () => {
    const featuredBusiness = createBusiness({ id: 'featured', name: 'Mercado Central', homepageFeaturedOrder: 0 });
    const unselectedBusiness = createBusiness({ id: 'not-featured', name: 'Plano Premium', featured: true, tier: 'premium' });
    const onBusinessSelect = vi.fn();
    const onCampaignImpression = vi.fn();

    render(
      <FeaturedHomepageBanner
        businesses={[featuredBusiness, unselectedBusiness]}
        campaigns={[createCampaign({ id: 'campaign-1', title: 'Campanha Um' })]}
        onBusinessSelect={onBusinessSelect}
        onCampaignImpression={onCampaignImpression}
        onCampaignClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Empresa em destaque')).toBeTruthy();
    expect(screen.getByText('Mercado Central')).toBeTruthy();
    expect(screen.queryByText('Plano Premium')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver perfil público de Mercado Central' }));
    expect(onBusinessSelect).toHaveBeenCalledWith(featuredBusiness);

    fireEvent.click(screen.getByRole('button', { name: 'Próximo destaque' }));
    expect(screen.getByText('Publicidade — Comunidade Guigui')).toBeTruthy();
    expect(screen.getByText('Campanha Um')).toBeTruthy();
    expect(onCampaignImpression).toHaveBeenCalledWith('campaign-1');
  });

  it('rotates campaign slides and reports campaign clicks', () => {
    const onCampaignClick = vi.fn();
    render(
      <FeaturedHomepageBanner
        businesses={[createBusiness({ id: 'featured', name: 'Mercado Central', homepageFeaturedOrder: 0 })]}
        campaigns={[
          createCampaign({ id: 'campaign-1', title: 'Campanha Um', linkUrl: 'https://example.com/one' }),
          createCampaign({ id: 'campaign-2', title: 'Campanha Dois' }),
        ]}
        onBusinessSelect={vi.fn()}
        onCampaignImpression={vi.fn()}
        onCampaignClick={onCampaignClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Próximo destaque' }));
    const campaignLink = screen.getByRole('link', { name: /Campanha Um/ });
    fireEvent.click(campaignLink);
    expect(onCampaignClick).toHaveBeenCalledWith('campaign-1', expect.any(Object));
    fireEvent.click(screen.getByRole('button', { name: 'Próximo destaque' }));
    expect(screen.getByText('Campanha Dois')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo destaque' }));
    expect(screen.getByText('Mercado Central')).toBeTruthy();
  });

  it('renders nothing when no businesses or active campaigns are supplied', () => {
    const { container } = render(
      <FeaturedHomepageBanner
        businesses={[]}
        campaigns={[]}
        onBusinessSelect={vi.fn()}
        onCampaignImpression={vi.fn()}
        onCampaignClick={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
