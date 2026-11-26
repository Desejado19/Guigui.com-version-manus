// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessDetailModal } from '../../../src/components/BusinessDetailModal';
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
  subscriptionRenewDate: '2030-01-01T00:00:00.000Z',
  postsQuotaRemaining: 2,
};

function renderProfile(profile: Business, props: Partial<React.ComponentProps<typeof BusinessDetailModal>> = {}) {
  return render(
    <BusinessDetailModal
      business={profile}
      currentLang="pt"
      onClose={vi.fn()}
      onAddReview={vi.fn()}
      {...props}
    />,
  );
}

const scrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  if (scrollToDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollToDescriptor);
  else delete HTMLElement.prototype.scrollTo;
  document.body.style.overflow = '';
  document.body.classList.remove('modal-open');
});

describe('BusinessDetailModal', () => {
  it('uses branded image fallbacks and omits empty profile sections and contacts', () => {
    const { container } = renderProfile({ ...business, description: '' });

    expect(screen.getAllByRole('img', { name: 'Capa de Atelier Nô Pintcha' })).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Logótipo de Atelier Nô Pintcha' }).textContent).toBe('AN');
    expect(screen.queryByText('Sobre o Negócio')).toBeNull();
    expect(screen.queryByText(/Horário de Funcionamento/i)).toBeNull();
    expect(screen.queryByText(/Contactos Diretos/i)).toBeNull();
    expect(screen.queryByText(/Localização em Bissau/i)).toBeNull();
    expect(container.querySelector('a[href="tel:"]')).toBeNull();
  });

  it('replaces broken header images and presents only populated profile details', () => {
    const { container } = renderProfile({
      ...business,
      coverImage: '/capa-antiga.jpg',
      logo: '/logotipo-antigo.jpg',
      description: 'Costura e reparação.',
      address: 'Rua Principal',
      phone: '+245 955 123 456',
      whatsapp: '+245 955 123 456',
      openingHours: 'Segunda a sábado',
      publicEmail: 'contacto@atelier.test',
      website: 'https://atelier.test',
      socialLinks: { instagram: 'https://instagram.com/atelier' },
      features: ['Ajustes de roupa'],
      products: [{ id: 'product-1', name: 'Camisa', category: 'Vestuário', priceXOF: 5000, isAvailable: true }],
    });

    act(() => fireEvent.error(container.querySelector('img')!));
    act(() => fireEvent.error(container.querySelector('img')!));

    expect(screen.getByRole('img', { name: 'Capa de Atelier Nô Pintcha' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Logótipo de Atelier Nô Pintcha' }).textContent).toBe('AN');
    expect(screen.getByText('Costura e reparação.')).not.toBeNull();
    expect(screen.getByText('Ajustes de roupa')).not.toBeNull();
    expect(screen.getByText('Camisa')).not.toBeNull();
    expect(screen.getByText('Horário de Funcionamento')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Email público/i }).getAttribute('href')).toBe('mailto:contacto@atelier.test');
    expect(screen.getByRole('link', { name: 'Instagram' }).getAttribute('href')).toBe('https://instagram.com/atelier');
  });

  it('does not show a rating summary when no reviews exist', () => {
    renderProfile({ ...business, ratingLabel: 'Muito Bom' });
    fireEvent.click(screen.getByRole('button', { name: /avaliações/i }));

    expect(screen.getByText('Ainda não existem avaliações')).not.toBeNull();
    expect(screen.queryByText(/Classificação Predominante Qualitativa/i)).toBeNull();
  });

  it('keeps follow, message, and phone contact actions working', () => {
    const onToggleFollow = vi.fn();
    const onMessage = vi.fn();
    const onContactMetric = vi.fn();
    renderProfile({ ...business, phone: '+245 955 123 456' }, {
      onToggleFollow,
      onMessage,
      onContactMetric,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Seguir Atelier Nô Pintcha' }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar mensagem interna para Atelier Nô Pintcha/i }));
    const phoneLink = screen.getByRole('link', { name: /Ligar pela operadora/i });
    phoneLink.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(phoneLink);

    expect(onToggleFollow).toHaveBeenCalledWith(business.id);
    expect(onMessage).toHaveBeenCalledWith(business.id);
    expect(onContactMetric).toHaveBeenCalledWith(business.id, 'phoneClicks');
  });
});
