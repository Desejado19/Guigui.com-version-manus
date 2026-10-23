// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CommunicationHub } from '../../../src/components/CommunicationHub';
import { INITIAL_BUSINESSES } from '../../../src/data/initialData';
import type { Conversation, ConversationMessage, SupportRequest, UserProfile } from '../../../src/types';

const business = INITIAL_BUSINESSES[0];

const citizen: UserProfile = {
  id: 'usr-citizen',
  name: 'Aissatu Mané',
  role: 'user',
  phone: '+2459550000',
  neighborhood: 'Bissau',
  avatarUrl: '',
};

const conversation: Conversation = {
  id: 'conv-1',
  userId: citizen.id,
  userName: citizen.name,
  businessId: business.id,
  businessName: business.name,
  subject: 'Entrega dos bilhetes',
  lastMessage: 'Já recebi, obrigado.',
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  unreadForUser: false,
  unreadForBusiness: false,
  participantOnline: true,
};

const messages: ConversationMessage[] = [
  { id: 'msg-1', conversationId: conversation.id, senderId: citizen.id, senderRole: 'user', text: 'Olá, bom dia.', createdAt: '2026-01-01T09:00:00.000Z' },
  { id: 'msg-2', conversationId: conversation.id, senderId: 'usr-business', senderRole: 'business', text: 'Bom dia, tudo pronto.', createdAt: '2026-01-01T09:30:00.000Z' },
];

const supportRequest: SupportRequest = {
  id: 'sup-1',
  requesterId: citizen.id,
  requesterRole: 'user',
  businessId: business.id,
  subject: 'Problema no pagamento',
  description: 'O pagamento ficou pendente.',
  category: 'payments',
  status: 'open',
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
  replies: [{ id: 'rep-1', senderId: 'usr-admin', senderRole: 'admin', text: 'Estamos a analisar.', createdAt: '2026-01-01T11:00:00.000Z' }],
};

const baseRender = (props: Partial<React.ComponentProps<typeof CommunicationHub>> = {}) => {
  const handlers = {
    onCreateConversation: vi.fn(async () => 'conv-2'),
    onSendMessage: vi.fn(),
    onCreateSupport: vi.fn(),
    onReplySupport: vi.fn(),
    onMarkConversationRead: vi.fn(),
  };
  const result = render(
    <CommunicationHub
      mode="user"
      currentLang="pt"
      currentUser={citizen}
      businesses={INITIAL_BUSINESSES}
      conversations={[conversation]}
      messages={messages}
      supportRequests={[supportRequest]}
      {...handlers}
      {...props}
    />,
  );
  return { ...result, handlers };
};

const renderHub = (props: Partial<React.ComponentProps<typeof CommunicationHub>> = {}) =>
  baseRender(props).handlers;

describe('CommunicationHub', () => {
  beforeEach(() => {
    // jsdom não implementa scrollIntoView nem scrollTo em contentores,
    // usados pelo encadeamento de mensagens.
    Element.prototype.scrollIntoView = vi.fn();
    if (typeof Element.prototype.scrollTo !== 'function') {
      Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
    }
  });

  it('stays at the bottom when new messages arrive at the bottom', () => {
    const { rerender } = baseRender();
    const container = document.querySelector(
      '.guigui-thread-messages',
    ) as HTMLDivElement | null;
    expect(container).toBeTruthy();
    if (!container) return;
    Object.defineProperties(container, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
    });
    const scrollTo = vi.fn();
    container.scrollTo = scrollTo as unknown as typeof container.scrollTo;
    container.scrollTop = 600;
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    rerender(
      <CommunicationHub
        mode="user"
        currentLang="pt"
        currentUser={citizen}
        businesses={INITIAL_BUSINESSES}
        conversations={[conversation]}
        messages={[
          ...messages,
          {
            id: 'msg-4',
            conversationId: conversation.id,
            senderId: 'usr-business',
            senderRole: 'business',
            text: 'Mensagem no final.',
            createdAt: '2026-01-01T10:31:00.000Z',
          },
        ]}
        supportRequests={[supportRequest]}
        onCreateConversation={async () => 'conv-2'}
        onSendMessage={vi.fn()}
        onCreateSupport={vi.fn()}
        onReplySupport={vi.fn()}
        onMarkConversationRead={vi.fn()}
      />,
    );

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('keeps the user position when new messages arrive away from the bottom', () => {
    const { rerender } = baseRender();
    const container = document.querySelector(
      '.guigui-thread-messages',
    ) as HTMLDivElement | null;
    expect(container).toBeTruthy();
    if (!container) return;
    Object.defineProperties(container, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
    });
    const scrollTo = vi.fn();
    container.scrollTo = scrollTo as unknown as typeof container.scrollTo;
    container.scrollTop = 100;
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    rerender(
      <CommunicationHub
        mode="user"
        currentLang="pt"
        currentUser={citizen}
        businesses={INITIAL_BUSINESSES}
        conversations={[conversation]}
        messages={[
          ...messages,
          {
            id: 'msg-3',
            conversationId: conversation.id,
            senderId: 'usr-business',
            senderRole: 'business',
            text: 'Acabou de chegar.',
            createdAt: '2026-01-01T10:30:00.000Z',
          },
        ]}
        supportRequests={[supportRequest]}
        onCreateConversation={async () => 'conv-2'}
        onSendMessage={vi.fn()}
        onCreateSupport={vi.fn()}
        onReplySupport={vi.fn()}
        onMarkConversationRead={vi.fn()}
      />,
    );

    expect(container.scrollTop).toBe(100);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the conversation list beside the selected thread', () => {
    renderHub();
    expect(document.querySelector('.guigui-communication-list')).toBeTruthy();
    expect(document.querySelector('.guigui-communication-thread')).toBeTruthy();
    expect(document.querySelector('.guigui-thread-header')).toBeTruthy();
    expect(screen.getAllByText('Entrega dos bilhetes').length).toBeGreaterThan(0);
    expect(screen.getByText('Olá, bom dia.')).toBeTruthy();
    expect(screen.getByText('Bom dia, tudo pronto.')).toBeTruthy();
  });

  it('switches between the conversation list and thread on narrow screens', async () => {
    renderHub();
    const layout = document.querySelector('.guigui-communication-layout');

    expect(layout?.classList.contains('is-mobile-list')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /Entrega dos bilhetes/ }));
    expect(layout?.classList.contains('is-mobile-thread')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Voltar às conversas' }));
    expect(layout?.classList.contains('is-mobile-list')).toBe(true);
  });

  it('marks the conversation as read when it is selected', async () => {
    const handlers = renderHub();
    await userEvent.click(screen.getByRole('button', { name: /Já recebi, obrigado\./ }));
    expect(handlers.onMarkConversationRead).toHaveBeenCalledWith(conversation.id);
  });

  it('sends a message from the thread composer', async () => {
    const handlers = renderHub();
    await userEvent.type(screen.getByLabelText('Escrever mensagem'), 'Mensagem nova');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    expect(handlers.onSendMessage).toHaveBeenCalledWith(conversation.id, 'Mensagem nova', { replyToId: undefined });
  });

  it('opens and closes the conversation overlays', async () => {
    renderHub();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir perfil do participante' }));
    expect(screen.getByText('Empresa · Perfil público')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar perfil' }));
    expect(screen.queryByText('Empresa · Perfil público')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Informações da conversa' }));
    expect(screen.getByText('Informações da conversa')).toBeTruthy();
    expect(screen.getByText('2 mensagens nesta conversa.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar informações' }));
    expect(screen.queryByText('Informações da conversa')).toBeNull();
  });

  it('creates a new conversation with the selected business', async () => {
    const handlers = renderHub();
    await userEvent.click(screen.getByRole('button', { name: '+ Nova mensagem' }));
    expect(screen.getByText('Nova conversa')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('Escolher empresa para nova conversa'), business.id);
    await userEvent.type(screen.getByLabelText('Assunto da nova conversa'), 'Nova dúvida');
    await userEvent.type(screen.getByLabelText('Mensagem da nova conversa'), 'Olá equipa Guigui.');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar conversa' }));
    expect(handlers.onCreateConversation).toHaveBeenCalledWith(business.id, 'Nova dúvida', 'Olá equipa Guigui.');
  });

  it('replies to a support request from the support channel', async () => {
    const handlers = renderHub({ initialChannel: 'support' });
    expect(screen.getAllByText('Problema no pagamento').length).toBeGreaterThan(0);
    await userEvent.type(screen.getByPlaceholderText('Escrever resposta...'), 'Obrigado pelo retorno.');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    expect(handlers.onReplySupport).toHaveBeenCalledWith(supportRequest.id, 'Obrigado pelo retorno.');
  });

  it('hides the citizen-only flows when the hub runs in business mode', () => {
    const owner: UserProfile = { ...citizen, id: 'usr-owner', role: 'business', businessId: business.id, businessName: business.name };
    renderHub({
      mode: 'business',
      currentUser: owner,
      conversations: [{ ...conversation, userId: 'usr-other', userName: 'Carlos Domingos' }],
    });
    expect(screen.queryByRole('button', { name: '+ Nova mensagem' })).toBeNull();
    expect(screen.getAllByText('Carlos Domingos').length).toBeGreaterThan(0);
  });
});
