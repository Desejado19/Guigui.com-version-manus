// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessCard } from '../../../src/components/BusinessCard';
import { MAIN_CATEGORIES } from '../../../src/data/categoryCatalog';
import type { Business } from '../../../src/types';

const business: Business = {
  id: 'atelier-1',
  name: 'Atelier Nô Pintcha',
  slug: 'atelier-no-pintcha',
  logo: '',
  coverImage: '',
  gallery: [],
  description: 'Costura e reparação de roupas para toda a comunidade.',
  categoryId: 'restauracao',
  subcategoryId: 'Restaurantes',
  groupGroupId: 'restauracao',
  tier: 'basic',
  neighborhood: 'Bandim',
  address: '',
  phone: '+245 955 123 456',
  whatsapp: '',
  openingHours: '',
  isOpenNow: false,
  priceRange: '$',
  status: 'active',
  verified: false,
  featured: false,
  ratingLabel: 'Muito Bom',
  reviewsCount: 0,
  reviews: [],
  posts: [],
  promotions: [],
  metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 },
  subscriptionRenewDate: '2030-01-01T00:00:00.000Z',
  postsQuotaRemaining: 2,
};

afterEach(cleanup);

describe('BusinessCard', () => {
  it('uses branded local image fallbacks and omits ratings when no reviews exist', () => {
    const { container } = render(
      <BusinessCard business={business} categories={MAIN_CATEGORIES} currentLang="pt" onSelect={vi.fn()} />,
    );

    expect(screen.getByRole('img', { name: 'Capa de Atelier Nô Pintcha' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Logótipo de Atelier Nô Pintcha' }).textContent).toBe('AN');
    expect(container.querySelector('img[src^="https://images.unsplash.com"]')).toBeNull();
    expect(screen.queryByText('Muito Bom')).toBeNull();
    expect(screen.queryByText(/avaliações/i)).toBeNull();
  });

  it('replaces broken cover and logo images with branded fallbacks', async () => {
    const { container } = render(
      <BusinessCard
        business={{ ...business, coverImage: '/capa-antiga.jpg', logo: '/logotipo-antigo.jpg' }}
        categories={MAIN_CATEGORIES}
        currentLang="pt"
        onSelect={vi.fn()}
      />,
    );

    await act(async () => { fireEvent.error(container.querySelector('img')!); });
    await act(async () => { fireEvent.error(container.querySelector('img')!); });

    expect(screen.getByRole('img', { name: 'Capa de Atelier Nô Pintcha' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Logótipo de Atelier Nô Pintcha' }).textContent).toBe('AN');
  });

  it('keeps follow, message, and profile selection actions available', () => {
    const onSelect = vi.fn();
    const onToggleFollow = vi.fn();
    const onMessage = vi.fn();
    render(
      <BusinessCard
        business={business}
        categories={MAIN_CATEGORIES}
        currentLang="pt"
        onSelect={onSelect}
        onToggleFollow={onToggleFollow}
        onMessage={onMessage}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Seguir Atelier Nô Pintcha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem interna Atelier Nô Pintcha' }));
    fireEvent.click(screen.getByRole('button', { name: /ver ficha/i }));

    expect(onToggleFollow).toHaveBeenCalledWith(business.id);
    expect(onMessage).toHaveBeenCalledWith(business.id);
    expect(onSelect).toHaveBeenCalledWith(business);
  });

  it('uses the supplied catalog to display database-backed categories', () => {
    const category = { ...MAIN_CATEGORIES[0], id: 'postgres-category', name: 'Categoria PostgreSQL' };
    render(
      <BusinessCard
        business={{ ...business, categoryId: category.id }}
        categories={[category]}
        currentLang="pt"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Categoria PostgreSQL')).not.toBeNull();
  });
});
