// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { StoryModal } from '../../../src/components/StoryModal';
import type { Story, UserProfile } from '../../../src/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const imageStory = (id: string, caption: string, overrides: Partial<Story> = {}): Story => ({
  id,
  businessId: 'biz-1',
  businessName: 'Restaurante Bandim',
  businessLogo: '',
  storyType: 'image',
  imageUrl: 'https://images.unsplash.com/photo',
  caption,
  createdAt: new Date().toISOString(),
  isUnread: true,
  ...overrides,
});

const citizen: UserProfile = {
  id: 'user-9',
  name: 'Dona Maria',
  role: 'user',
  phone: '+245111222',
  neighborhood: 'Bandim',
  avatarUrl: '',
} as UserProfile;

type ModalProps = React.ComponentProps<typeof StoryModal>;

const defaultStories = () => [
  imageStory('story-a', 'Primeira story'),
  imageStory('story-b', 'Segunda story'),
];

function renderModal(overrides: Partial<ModalProps> = {}) {
  const props: ModalProps = {
    stories: defaultStories(),
    initialStoryIndex: 0,
    onClose: vi.fn(),
    currentUser: null,
    onRequireLogin: vi.fn(),
    onStoryComment: vi.fn(),
    onStoryViewed: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<StoryModal {...props} />) };
}

describe('StoryModal - visualizador estilo Instagram', () => {
  it('mostra empresa, legenda, data relativa e marca a story como vista', () => {
    const onStoryViewed = vi.fn();
    renderModal({ onStoryViewed });

    expect(screen.getByText('Restaurante Bandim')).toBeTruthy();
    expect(screen.getByText('Primeira story')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fechar story' })).toBeTruthy();
    expect(onStoryViewed).toHaveBeenCalledTimes(1);
    expect(onStoryViewed.mock.calls[0][0]).toMatchObject({ id: 'story-a' });
  });

  it('desenha uma barra de progresso por story do grupo', () => {
    renderModal();
    // Duas stories = dois segmentos de progresso dentro do visualizador.
    const bars = document.querySelectorAll('[class*="flex-1"]');
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  it('avança e recua com as zonas de toque', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Seguinte story' }));
    expect(screen.getByText('Segunda story')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Story anterior' }));
    expect(screen.getByText('Primeira story')).toBeTruthy();
  });

  it('fecha quando se chega ao fim do grupo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ stories: [imageStory('story-only', 'Única story')], onClose });

    await user.click(screen.getByRole('button', { name: 'Seguinte story' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navega com ←/→ e fecha com Esc', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Segunda story')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Primeira story')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('avança automaticamente ao fim da duração', () => {
    vi.useFakeTimers();
    renderModal({ storyDurationMs: 1000 });
    expect(screen.getByText('Primeira story')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1050);
    });

    expect(screen.getByText('Segunda story')).toBeTruthy();
  });

  it('pausa com Espaço e retoma na segunda pulsacão', () => {
    vi.useFakeTimers();
    renderModal({ storyDurationMs: 1000 });

    fireEvent.keyDown(window, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Primeira story')).toBeTruthy();

    fireEvent.keyDown(window, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(1050);
    });
    expect(screen.getByText('Segunda story')).toBeTruthy();
  });

  it('marca a story seguinte como vista após navegar', async () => {
    const user = userEvent.setup();
    const onStoryViewed = vi.fn();
    renderModal({ onStoryViewed });

    await user.click(screen.getByRole('button', { name: 'Seguinte story' }));

    expect(onStoryViewed.mock.calls.map((call) => call[0].id)).toEqual(['story-a', 'story-b']);
  });

  it('alterna o gosto da story', async () => {
    const user = userEvent.setup();
    renderModal();

    const likeButton = screen.getByRole('button', { name: 'Gostar da story' });
    expect(likeButton.getAttribute('aria-pressed')).toBe('false');

    await user.click(likeButton);
    expect(screen.getByRole('button', { name: 'Gostar da story' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('pede sessão para responder quando não há conta', async () => {
    const user = userEvent.setup();
    const { props } = renderModal({ currentUser: null });

    await user.type(screen.getByLabelText('Enviar mensagem à story'), 'Boa noite!');
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    expect(props.onRequireLogin).toHaveBeenCalledTimes(1);
    expect(props.onStoryComment).not.toHaveBeenCalled();
  });

  it('envia a resposta para a conversa quando há sessão', async () => {
    const user = userEvent.setup();
    const onStoryComment = vi.fn();
    const { props } = renderModal({ currentUser: citizen, onStoryComment });

    await user.type(screen.getByLabelText('Enviar mensagem à story'), 'Ainda há mesa?');
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    expect(onStoryComment).toHaveBeenCalledTimes(1);
    expect(onStoryComment.mock.calls[0][0]).toMatchObject({
      text: 'Ainda há mesa?',
      businessId: 'biz-1',
      businessName: 'Restaurante Bandim',
      authorId: 'user-9',
      authorName: 'Dona Maria',
    });
    expect((screen.getByLabelText('Enviar mensagem à story') as HTMLInputElement).value).toBe('');
    expect(props.onRequireLogin).not.toHaveBeenCalled();
  });

  it('abre directamente na story inicial pedida', () => {
    renderModal({ initialStoryIndex: 1 });
    expect(screen.getByText('Segunda story')).toBeTruthy();
  });
});
