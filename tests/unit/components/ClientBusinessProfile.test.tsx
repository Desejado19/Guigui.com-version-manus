// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientBusinessProfile } from '../../../src/components/client/ClientBusinessProfile';
import { MAIN_CATEGORIES } from '../../../src/data/categoryCatalog';
import type { Business } from '../../../src/types';

const business: Business = {
  id: 'profile-business',
  name: 'Atelier Nô Pintcha',
  slug: 'atelier-no-pintcha',
  logo: '',
  coverImage: '',
  gallery: [],
  description: 'Costura e reparação de roupas para toda a comunidade.',
  categoryId: 'cat-1',
  subcategoryId: 'Restaurantes',
  groupGroupId: 'restauracao',
  neighborhood: 'Bandim',
  address: 'Rua principal',
  phone: '+245 955 123 456',
  whatsapp: '+245 955 123 456',
  publicEmail: 'contacto@atelier.test',
  website: 'https://atelier.test',
  openingHours: 'Segunda a sábado',
  notApplicableFields: [],
  isOpenNow: false,
  priceRange: '$',
  status: 'active',
  tier: 'basic',
  verified: true,
  featured: false,
  ratingLabel: '',
  reviewsCount: 0,
  reviews: [],
  posts: [],
  promotions: [],
  metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 },
  subscriptionRenewDate: '2030-01-01T00:00:00.000Z',
  postsQuotaRemaining: 3,
};

function renderProfile(
  onUpdateBusiness: (updated: Business) => Promise<void> = vi.fn().mockResolvedValue(undefined),
  profile: Business = business,
  categories = MAIN_CATEGORIES,
) {
  render(<ClientBusinessProfile business={profile} categories={categories} currentLang="pt" onUpdateBusiness={onUpdateBusiness} />);
  return onUpdateBusiness;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ClientBusinessProfile', () => {
  it('shows complete profiles at 100 percent', () => {
    renderProfile(undefined, {
      ...business,
      description: 'Costura e reparação com atendimento personalizado para toda a comunidade.',
    });

    expect(screen.getByRole('progressbar', { name: /completude do perfil/i }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByText('Perfil completo.')).not.toBeNull();
    expect(screen.queryByText(/campos obrigatórios em falta:/i)).toBeNull();
  });

  it('shows profile completion and the missing required fields', () => {
    renderProfile(undefined, { ...business, description: '', subcategoryId: '' });

    expect(screen.getByRole('progressbar', { name: /completude do perfil/i }).getAttribute('aria-valuenow')).toBe('67');
    const missingFields = screen.getByText(/campos obrigatórios em falta:/i).textContent;
    expect(missingFields).toContain('Descrição');
    expect(missingFields).toContain('Subcategoria');
  });

  it('uses the supplied catalog for category and subcategory options', () => {
    const category = {
      ...MAIN_CATEGORIES[0],
      id: 'postgres-category',
      name: 'Categoria PostgreSQL',
      subcategories: ['Subcategoria PostgreSQL'],
    };
    renderProfile(undefined, {
      ...business,
      categoryId: category.id,
      subcategoryId: 'Subcategoria PostgreSQL',
    }, [category]);

    expect(screen.getByRole('option', { name: 'Categoria PostgreSQL' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Subcategoria PostgreSQL' })).not.toBeNull();
  });

  it('lists missing recommended information but excludes fields marked not applicable', () => {
    renderProfile(undefined, {
      ...business,
      address: '',
      openingHours: '',
      whatsapp: '',
      website: '',
      notApplicableFields: ['address'],
    });

    const recommendations = screen.getByText(/informações recomendadas em falta:/i).textContent;
    expect(recommendations).toContain('Horário de funcionamento');
    expect(recommendations).toContain('WhatsApp');
    expect(recommendations).not.toContain('Morada completa');
  });

  it('hydrates updated persisted values into the editor', async () => {
    const { rerender } = render(
      <ClientBusinessProfile business={{ ...business, name: 'Nome inicial' }} categories={MAIN_CATEGORIES} currentLang="pt" onUpdateBusiness={vi.fn()} />,
    );
    rerender(
      <ClientBusinessProfile business={{ ...business, name: 'Nome persistido' }} categories={MAIN_CATEGORIES} currentLang="pt" onUpdateBusiness={vi.fn()} />,
    );

    await waitFor(() => {
      expect((screen.getByLabelText('Nome comercial') as HTMLInputElement).value).toBe('Nome persistido');
    });
  });

  it('saves only after the API callback succeeds and keeps non-editable business fields', async () => {
    let resolveSave: (() => void) | undefined;
    const onUpdateBusiness = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));
    renderProfile(onUpdateBusiness);
    fireEvent.change(screen.getByLabelText('Nome comercial'), { target: { value: 'Atelier Atualizado' } });
    fireEvent.submit(screen.getByRole('button', { name: /actualizar dados da empresa/i }).closest('form')!);

    expect(onUpdateBusiness).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Atelier Atualizado',
      status: 'active',
      tier: 'basic',
      verified: true,
      featured: false,
    }));
    expect(screen.queryByText(/dados guardados/i)).toBeNull();
    expect((screen.getByRole('button', { name: /a guardar/i }) as HTMLButtonElement).disabled).toBe(true);

    resolveSave?.();
    await screen.findByText(/dados guardados/i);
  });

  it('shows a save error without discarding entered values', async () => {
    const onUpdateBusiness = vi.fn().mockRejectedValue(new Error('Falha ao persistir perfil.'));
    renderProfile(onUpdateBusiness);
    fireEvent.change(screen.getByLabelText('Nome comercial'), { target: { value: 'Nome por guardar' } });
    fireEvent.submit(screen.getByRole('button', { name: /actualizar dados da empresa/i }).closest('form')!);

    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao persistir perfil.');
    expect((screen.getByLabelText('Nome comercial') as HTMLInputElement).value).toBe('Nome por guardar');
    expect(screen.queryByText(/dados guardados/i)).toBeNull();
  });

  it('lets owners mark optional profile fields as not applicable', async () => {
    const onUpdateBusiness = vi.fn().mockResolvedValue(undefined);
    renderProfile(onUpdateBusiness);
    fireEvent.click(screen.getByLabelText('Morada completa: não aplicável'));
    fireEvent.submit(screen.getByRole('button', { name: /actualizar dados da empresa/i }).closest('form')!);

    await waitFor(() => expect(onUpdateBusiness).toHaveBeenCalledWith(expect.objectContaining({
      notApplicableFields: ['address'],
    })));
  });
});
