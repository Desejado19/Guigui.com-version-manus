// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Business } from '../../../src/types';
import { FeaturedBusinessesAdmin } from '../../../src/components/admin/FeaturedBusinessesAdmin';

const createBusiness = (overrides: Partial<Business> & Pick<Business, 'id' | 'name' | 'status'>): Business => ({
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
  status: overrides.status,
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

describe('FeaturedBusinessesAdmin', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('lists only active businesses and uses persisted order rather than tier or legacy featured state', () => {
    const businesses = [
      createBusiness({ id: 'legacy-featured', name: 'Destaque legado', status: 'active', featured: true, tier: 'premium' }),
      createBusiness({ id: 'curated', name: 'Empresa selecionada', status: 'active', homepageFeaturedOrder: 0 }),
      createBusiness({ id: 'inactive', name: 'Empresa pendente', status: 'pending', homepageFeaturedOrder: 1 }),
    ];

    render(<FeaturedBusinessesAdmin businesses={businesses} />);

    expect(screen.getByLabelText('Selecionar Destaque legado')).toBeTruthy();
    expect(screen.getByLabelText('Selecionar Empresa selecionada')).toBeTruthy();
    expect(screen.queryByLabelText('Selecionar Empresa pendente')).toBeNull();
    const orderedList = screen.getByRole('list', { name: 'Ordem das empresas em destaque' });
    expect(within(orderedList).getByText(/Empresa selecionada/)).toBeTruthy();
    expect(within(orderedList).queryByText(/Destaque legado/)).toBeNull();
  });

  it('reorders and removes selections, saves the order, and preserves other business fields', async () => {
    const businesses = [
      createBusiness({ id: 'first', name: 'Primeira', status: 'active', homepageFeaturedOrder: 0, featured: false }),
      createBusiness({ id: 'second', name: 'Segunda', status: 'active', homepageFeaturedOrder: 1, featured: true, tier: 'premium' }),
      createBusiness({ id: 'not-selected', name: 'Não selecionada', status: 'active', featured: true, tier: 'premium' }),
    ];
    const onUpdateBusinesses = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, businesses: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FeaturedBusinessesAdmin businesses={businesses} onUpdateBusinesses={onUpdateBusinesses} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mover Segunda para cima' }));
    const orderedList = screen.getByRole('list', { name: 'Ordem das empresas em destaque' });
    expect(within(orderedList).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Segunda'),
      expect.stringContaining('Primeira'),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Primeira' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ordem' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ businessIds: ['second'] });
    await waitFor(() => expect(onUpdateBusinesses).toHaveBeenCalledOnce());
    const savedBusinesses = onUpdateBusinesses.mock.calls[0][0] as Business[];
    expect(savedBusinesses.find((business) => business.id === 'second')).toMatchObject({
      homepageFeaturedOrder: 0,
      featured: true,
      tier: 'premium',
    });
    expect(savedBusinesses.find((business) => business.id === 'first')?.homepageFeaturedOrder).toBeNull();
    expect(savedBusinesses.find((business) => business.id === 'not-selected')).toMatchObject({
      homepageFeaturedOrder: null,
      featured: true,
      tier: 'premium',
    });
  });

  it('shows an explicit error when saving fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A lista não pôde ser guardada.' }),
    }));
    render(<FeaturedBusinessesAdmin businesses={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar ordem' }));

    expect((await screen.findByRole('alert')).textContent).toContain('A lista não pôde ser guardada.');
  });
});
