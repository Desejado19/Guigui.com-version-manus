// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { StoriesBar } from '../../../src/components/StoriesBar';
import type { Business, Story, UserProfile } from '../../../src/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const activeBusiness: Business = {
  id: 'biz-1',
  name: 'Restaurante Bandim',
  slug: 'restaurante-bandim',
  logo: '',
  coverImage: '',
  gallery: [],
  description: '',
  categoryId: 'food',
  subcategoryId: 'local',
  groupGroupId: 'restauracao',
  tier: 'premium',
  neighborhood: 'Bandim',
  address: 'Bissau',
  phone: '+245000000',
  whatsapp: '+245000000',
  openingHours: '08:00 - 20:00',
  isOpenNow: true,
  priceRange: '$$',
  status: 'active',
  verified: true,
  featured: false,
  ratingLabel: 'Muito Bom',
  reviewsCount: 0,
  reviews: [],
  posts: [],
  promotions: [],
  metrics: {
    views: 0,
    whatsappClicks: 0,
    phoneClicks: 0,
    directionsClicks: 0,
    websiteClicks: 0,
  },
  postsQuotaRemaining: 3,
  subscriptionStatus: 'active',
  subscriptionRenewDate: new Date(Date.now() + 86_400_000).toISOString(),
} as Business;

const payingUser: UserProfile = {
  id: 'user-1',
  name: 'Dona Maria',
  role: 'business',
  phone: '+245111111',
  neighborhood: 'Bandim',
  avatarUrl: '',
  businessId: 'biz-1',
  businessName: 'Restaurante Bandim',
  subscriptionStatus: 'active',
} as UserProfile;

const story: Story = {
  id: 'story-1',
  businessId: 'biz-1',
  businessName: 'Restaurante Bandim',
  businessLogo: '',
  storyType: 'text',
  caption: 'Peixe grelhado hoje',
  createdAt: new Date().toISOString(),
  isUnread: true,
};

function renderBar(overrides: Partial<React.ComponentProps<typeof StoriesBar>> = {}) {
  const props: React.ComponentProps<typeof StoriesBar> = {
    stories: [],
    businesses: [activeBusiness],
    currentLang: 'pt',
    onTabChange: () => {},
    currentUser: payingUser,
    currentRole: 'business',
    onAddStory: vi.fn(),
    onRequireLogin: vi.fn(),
    onStoryComment: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<StoriesBar {...props} />) };
}

describe('StoriesBar - criador de stories', () => {
  it('mantém o compositor fechado até o utilizador o abrir', async () => {
    const user = userEvent.setup();
    renderBar();

    expect(screen.queryByText('Publicar Story')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Criar Story/i }));

    expect(screen.getByText('Publicar Story')).toBeTruthy();
  });

  it('esconde o botão de criar quando não há sessão com plano ativo', () => {
    renderBar({ currentUser: null, currentRole: undefined });

    expect(screen.queryByRole('button', { name: /Criar Story/i })).toBeNull();
  });

  it('publica uma story de texto com os dados da conta ativa', async () => {
    const user = userEvent.setup();
    const onAddStory = vi.fn();
    renderBar({ onAddStory });

    await user.click(screen.getByRole('button', { name: /Criar Story/i }));
    await user.click(screen.getByRole('button', { name: 'Texto' }));
    await user.type(screen.getByPlaceholderText(/O que queres partilhar/i), 'Menu do dia');
    await user.click(screen.getByRole('button', { name: 'Publicar Story' }));

    expect(onAddStory).toHaveBeenCalledTimes(1);
    expect(onAddStory.mock.calls[0][0]).toMatchObject({
      businessId: 'biz-1',
      businessName: 'Restaurante Bandim',
      storyType: 'text',
      caption: 'Menu do dia',
      isUnread: true,
    });
  });

  it('recusa publicar imagem sem destaque escolhido e mostra aviso', async () => {
    const user = userEvent.setup();
    const onAddStory = vi.fn();
    renderBar({ onAddStory });

    await user.click(screen.getByRole('button', { name: /Criar Story/i }));
    await user.click(screen.getByRole('button', { name: 'Publicar Story' }));

    expect(onAddStory).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Escolhe uma imagem ou vídeo de destaque/i),
    ).toBeTruthy();
  });

  it('aceita uma URL de imagem personalizada', async () => {
    const user = userEvent.setup();
    const onAddStory = vi.fn();
    renderBar({ onAddStory });

    await user.click(screen.getByRole('button', { name: /Criar Story/i }));
    await user.type(
      screen.getByPlaceholderText(/Ou insere a URL de uma imagem/i),
      'https://exemplo.gov/cacacu.jpg',
    );
    await user.click(screen.getByRole('button', { name: 'Publicar Story' }));

    expect(onAddStory).toHaveBeenCalledTimes(1);
    expect(onAddStory.mock.calls[0][0]).toMatchObject({
      storyType: 'image',
      imageUrl: 'https://exemplo.gov/cacacu.jpg',
    });
  });

  it('fecha e limpa o compositor ao cancelar', async () => {
    const user = userEvent.setup();
    const onAddStory = vi.fn();
    renderBar({ onAddStory });

    await user.click(screen.getByRole('button', { name: /Criar Story/i }));
    await user.click(screen.getByRole('button', { name: 'Texto' }));
    await user.type(screen.getByPlaceholderText(/O que queres partilhar/i), 'Rascunho');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Publicar Story')).toBeNull();
    expect(onAddStory).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Criar Story/i }));
    await user.click(screen.getByRole('button', { name: 'Texto' }));
    expect((screen.getByPlaceholderText(/O que queres partilhar/i) as HTMLTextAreaElement).value).toBe('');
  });

  it('abre o modal de visualização ao clicar numa story existente', async () => {
    const user = userEvent.setup();
    renderBar({ stories: [story] });

    await user.click(screen.getByRole('button', { name: /Restaurante Bandim/i }));

    expect(screen.getByRole('button', { name: /Fechar story/i })).toBeTruthy();
  });
});

describe('StoriesBar - faixa agrupada estilo Instagram', () => {
  const otherStory: Story = {
    id: 'story-9',
    businessId: 'biz-9',
    businessName: 'Farmácia Central',
    businessLogo: '',
    storyType: 'image',
    imageUrl: 'https://images.unsplash.com/photo',
    caption: 'Piquete 24 horas',
    createdAt: new Date().toISOString(),
    isUnread: false,
  };

  it('agrupa stories da mesma empresa num único anel com contador', () => {
    renderBar({
      stories: [
        story,
        { ...story, id: 'story-2', caption: 'Segunda story da casa', createdAt: new Date(Date.now() + 1000).toISOString() },
      ],
    });

    const rings = screen.getAllByTestId('story-ring');
    expect(rings).toHaveLength(1);
    expect(rings[0].getAttribute('data-seen')).toBe('false');
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('ordena empresas não vistas primeiro e diferencia o estado do anel', () => {
    renderBar({ stories: [story, otherStory] });

    const rings = screen.getAllByTestId('story-ring');
    expect(rings).toHaveLength(2);
    expect(rings[0].getAttribute('data-seen')).toBe('false');
    expect(rings[1].getAttribute('data-seen')).toBe('true');
  });

  it('abre o visualizador imersivo com as stories do grupo', async () => {
    const user = userEvent.setup();
    renderBar({ stories: [story, { ...story, id: 'story-2' }] });

    await user.click(screen.getByRole('button', { name: /Restaurante Bandim/i }));

    expect(screen.getByRole('button', { name: 'Fechar story' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seguinte story' })).toBeTruthy();
    expect(screen.getByLabelText('Enviar mensagem à story')).toBeTruthy();
  });

  it('marca a story como vista através do callback', async () => {
    const user = userEvent.setup();
    const onStoryViewed = vi.fn();
    renderBar({ stories: [story], onStoryViewed });

    await user.click(screen.getByRole('button', { name: /Restaurante Bandim/i }));

    expect(onStoryViewed).toHaveBeenCalledTimes(1);
    expect(onStoryViewed.mock.calls[0][0]).toMatchObject({ id: 'story-1' });
  });

  it('mantém o criador de stories acessível na faixa', () => {
    renderBar({ stories: [story] });

    expect(screen.getByRole('button', { name: /Criar Story/i })).toBeTruthy();
    expect(screen.getAllByTestId('story-ring')).toHaveLength(1);
  });
});
