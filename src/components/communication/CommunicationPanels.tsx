import React from "react";
import {
  Building2,
  CheckCircle2,
  Copy,
  LifeBuoy,
  MessageCircle,
  Send,
} from "lucide-react";
import { Panel, PanelHeader } from "../../components/ui";
import type {
  Business,
  Conversation,
  ConversationMessage,
  SupportCategory,
  SupportRequest,
  UserProfile,
} from "../../types";
import {
  SUPPORT_CATEGORY_OPTIONS,
  supportCategoryLabel,
  supportStatusLabel,
} from "./CommunicationSections";

interface ConversationThreadProps {
  mode: "user" | "business";
  currentUser: UserProfile;
  conversation: Conversation | null;
  messages: ConversationMessage[];
  businessNameFor: (businessId: string) => string;
  participantNameFor: (participantId: string, fallback: string) => string;
  messageDateLabel: (value: string) => string;
  t: (key: string) => string;
  setSelectedProfile: React.Dispatch<React.SetStateAction<boolean>>;
  setConversationInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMessageMenuId: string | null;
  setOpenMessageMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  replyToId: string | null;
  setReplyToId: React.Dispatch<React.SetStateAction<string | null>>;
  emojiOpen: boolean;
  setEmojiOpen: React.Dispatch<React.SetStateAction<boolean>>;
  messageText: string;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  submitMessage: (event: React.FormEvent) => void | Promise<void>;
  threadEndRef: React.RefObject<HTMLDivElement | null>;
  onBackToList?: () => void;
  children?: React.ReactNode;
}

export function ConversationThread({
  conversation: selectedConversation,
  messages: selectedMessages,
  currentUser,
  mode,
  businessNameFor,
  participantNameFor,
  messageDateLabel,
  t,
  setSelectedProfile,
  setConversationInfoOpen,
  openMessageMenuId,
  setOpenMessageMenuId,
  replyToId,
  setReplyToId,
  emojiOpen,
  setEmojiOpen,
  messageText,
  setMessageText,
  submitMessage,
  threadEndRef,
  onBackToList,
  children,
}: ConversationThreadProps) {
  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = React.useRef(true);

  const isNearBottom = (element: HTMLDivElement): boolean =>
    element.scrollHeight - element.scrollTop - element.clientHeight <= 80;

  const scrollToBottom = (behavior: ScrollBehavior): void => {
    const container = messagesRef.current;
    if (!container) return;
    stickToBottomRef.current = true;
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }
    container.scrollTop = container.scrollHeight;
  };

  React.useEffect(() => {
    scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  React.useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom("smooth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessages.length]);
  return (
    <div className="guigui-communication-thread guigui-dpanel">
      {selectedConversation ? (
        <>
          <PanelHeader
            className="guigui-thread-header"
            eyebrow="Conversa"
            title={selectedConversation.subject}
            description={
              (mode === "user"
                ? selectedConversation.businessName ||
                  businessNameFor(selectedConversation.businessId)
                : selectedConversation.userName ||
                  participantNameFor(
                    selectedConversation.userId,
                    "Cliente Guigui",
                  )) +
              " · " +
              (selectedConversation.participantOnline
                ? "Online"
                : "Ativo recentemente")
            }
            icon={Building2}
            tone="success"
            actions={
              <>
                {onBackToList && (
                  <button
                    type="button"
                    className="guigui-thread-back"
                    onClick={onBackToList}
                    aria-label="Voltar às conversas"
                    title="Voltar às conversas"
                  >
                    Voltar às conversas
                  </button>
                )}
                <button
                  type="button"
                  className="guigui-thread-info flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-default)]"
                  onClick={() => setSelectedProfile(true)}
                  aria-label="Abrir perfil do participante"
                  title="Abrir perfil do participante"
                >
                  <Building2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="guigui-thread-info flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-default)]"
                  onClick={() => setConversationInfoOpen(true)}
                  aria-label="Informações da conversa"
                  title="Informações da conversa"
                >
                  i
                </button>
              </>
            }
          />

          <div
            className="guigui-thread-messages"
            ref={messagesRef}
            onScroll={(event) => {
              stickToBottomRef.current = isNearBottom(
                event.currentTarget as HTMLDivElement,
              );
            }}
          >
            {selectedMessages.map((message, index) => (
              <React.Fragment key={message.id}>
                {(index === 0 ||
                  messageDateLabel(message.createdAt) !==
                    messageDateLabel(
                      selectedMessages[index - 1].createdAt,
                    )) && (
                  <div className="guigui-message-date">
                    {messageDateLabel(message.createdAt)}
                  </div>
                )}
                <div
                  id={`message-${message.id}`}
                  className={`guigui-message-bubble ${message.senderId === currentUser.id ? "is-own" : ""}`}
                >
                  <p>
                    {message.senderName ||
                      (message.senderRole === "business"
                        ? selectedConversation.businessName || "Empresa"
                        : selectedConversation.userName ||
                          participantNameFor(
                            selectedConversation.userId,
                            "Cidadão",
                          ))}
                  </p>
                  {message.replyToId && (
                    <button
                      type="button"
                      className="guigui-message-quote"
                      onClick={() =>
                        document
                          .getElementById(`message-${message.replyToId}`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          })
                      }
                    >
                      Resposta a uma mensagem
                    </button>
                  )}
                  <span>{message.text}</span>
                  <small>
                    {new Date(message.createdAt).toLocaleTimeString("pt-PT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {message.senderId === currentUser.id && (
                      <b aria-label="Enviada">✓</b>
                    )}{" "}
                    {message.senderId !== currentUser.id && (
                      <span aria-label="Mensagem recebida">•</span>
                    )}
                  </small>
                  <div className="guigui-message-actions">
                    {[
                      ["👍", "Gostar"],
                      ["❤️", "Amar"],
                      ["😂", "Rir"],
                    ].map(([emoji, label]) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() =>
                          setOpenMessageMenuId(
                            openMessageMenuId === message.id
                              ? null
                              : message.id,
                          )
                        }
                        title={label}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyToId(message.id);
                        setOpenMessageMenuId(null);
                      }}
                      title="Responder"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard?.writeText(message.text)
                      }
                      title="Copiar"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  {openMessageMenuId === message.id && (
                    <div className="guigui-message-reactions">
                      <button
                        type="button"
                        onClick={() => setOpenMessageMenuId(null)}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenMessageMenuId(null)}
                      >
                        ❤️
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenMessageMenuId(null)}
                      >
                        😂
                      </button>
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}
            <div ref={threadEndRef} />
          </div>
          <form onSubmit={submitMessage} className="guigui-message-reply">
            {emojiOpen && (
              <div className="guigui-emoji-picker">
                {["👍", "❤️", "😂", "😮", "😢"].map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => {
                      setMessageText((value) => `${value}${emoji}`);
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {replyToId && (
              <div className="guigui-reply-preview">
                <span>Respondendo a uma mensagem</span>
                <button
                  type="button"
                  onClick={() => setReplyToId(null)}
                  aria-label="Cancelar resposta"
                >
                  ×
                </button>
              </div>
            )}
            <button
              type="button"
              className="guigui-composer-action"
              onClick={() => setEmojiOpen((value) => !value)}
              aria-label="Adicionar emoji"
            >
              ☺
            </button>
            <textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage(event);
                }
              }}
              placeholder="Escrever mensagem..."
              aria-label="Escrever mensagem"
              rows={1}
            />
            <button type="submit" aria-label={t("sendMessage")}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      ) : (
        children
      )}
    </div>
  );
}

interface NewConversationFormProps {
  businesses: Business[];
  initialBusinessId?: string | null;
  newBusinessId: string | null;
  setNewBusinessId: React.Dispatch<React.SetStateAction<string | null>>;
  newSubject: string;
  setNewSubject: React.Dispatch<React.SetStateAction<string>>;
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  submitNewConversation: (event: React.FormEvent) => void | Promise<void>;
  businessNameFor: (businessId: string) => string;
  t: (key: string) => string;
}

export function NewConversationForm({
  businesses,
  initialBusinessId,
  newBusinessId,
  setNewBusinessId,
  newSubject,
  setNewSubject,
  newMessage,
  setNewMessage,
  submitNewConversation,
  businessNameFor,
  t,
}: NewConversationFormProps) {
  return (
    <form
      onSubmit={submitNewConversation}
      className="guigui-new-conversation guigui-dpanel"
    >
      {!initialBusinessId && (
        <select
          value={newBusinessId || ""}
          onChange={(event) => setNewBusinessId(event.target.value || null)}
          aria-label="Escolher empresa para nova conversa"
        >
          <option value="">Escolha uma empresa</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      )}
      <div className="guigui-new-conversation-icon">
        <MessageCircle className="h-6 w-6" />
      </div>
      <div>
        <p className="guigui-new-conversation-eyebrow">Nova conversa</p>
        <h3>
          Enviar mensagem para{" "}
          {businessNameFor(newBusinessId || initialBusinessId || "")}
        </h3>
        <span>
          Escolha um destinatário e escreva a primeira mensagem. Se já existir
          uma conversa, ela será reutilizada.
        </span>
      </div>
      <input
        value={newSubject}
        onChange={(event) => setNewSubject(event.target.value)}
        placeholder={t("subject")}
        aria-label="Assunto da nova conversa"
      />
      <textarea
        value={newMessage}
        onChange={(event) => setNewMessage(event.target.value)}
        placeholder={t("writeMessage")}
        rows={5}
        aria-label="Mensagem da nova conversa"
      />
      <button type="submit">Iniciar conversa</button>
    </form>
  );
}

interface NewSupportFormProps {
  supportCategory: SupportCategory;
  supportSubject: string;
  supportDescription: string;
  onCategory: (value: SupportCategory) => void;
  onSubject: (value: string) => void;
  onDescription: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void | Promise<void>;
}

export function NewSupportForm({
  supportCategory,
  supportSubject,
  supportDescription,
  onCategory,
  onSubject,
  onDescription,
  onSubmit,
}: NewSupportFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="guigui-communication-compose is-support guigui-dpanel"
    >
      <div className="guigui-compose-heading">
        <LifeBuoy className="h-4 w-4" />
        <div>
          <p>Abrir pedido de suporte</p>
          <span>A Administração do Guigui.com responderá neste espaço.</span>
        </div>
      </div>
      <select
        value={supportCategory}
        onChange={(event) => onCategory(event.target.value as SupportCategory)}
        aria-label="Categoria do pedido"
      >
        {SUPPORT_CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        value={supportSubject}
        onChange={(event) => onSubject(event.target.value)}
        placeholder="Assunto"
        aria-label="Assunto do pedido"
      />
      <textarea
        value={supportDescription}
        onChange={(event) => onDescription(event.target.value)}
        placeholder="Descreva o que precisa"
        rows={5}
        aria-label="Descrição do pedido"
      />
      <button type="submit">Enviar pedido</button>
    </form>
  );
}

interface SupportEntry {
  id: string;
  senderId: string;
  senderRole: "user" | "business" | "admin";
  text: string;
  createdAt: string;
}

interface SupportThreadProps {
  currentUser: UserProfile;
  request: SupportRequest | null;
  businessNameFor: (businessId: string) => string;
  messageDateLabel: (value: string) => string;
  setSupportInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  supportReply: string;
  setSupportReply: React.Dispatch<React.SetStateAction<string>>;
  submitSupportReply: (event: React.FormEvent) => void | Promise<void>;
  children?: React.ReactNode;
}

export function SupportThread({
  currentUser,
  request,
  businessNameFor,
  messageDateLabel,
  setSupportInfoOpen,
  supportReply,
  setSupportReply,
  submitSupportReply,
  children,
}: SupportThreadProps) {
  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = React.useRef(true);

  const isNearBottom = (element: HTMLDivElement): boolean =>
    element.scrollHeight - element.scrollTop - element.clientHeight <= 80;

  const scrollToBottom = (behavior: ScrollBehavior): void => {
    const container = messagesRef.current;
    if (!container) return;
    stickToBottomRef.current = true;
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }
    container.scrollTop = container.scrollHeight;
  };

  React.useEffect(() => {
    scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const replyCount = request?.replies?.length ?? 0;
  React.useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom("smooth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyCount]);

  if (!request) {
    return <div className="guigui-communication-thread guigui-dpanel">{children}</div>;
  }

  const entries: SupportEntry[] = [
    {
      id: request.id + "-opening",
      senderId: request.requesterId,
      senderRole: request.requesterRole,
      text: request.description,
      createdAt: request.createdAt,
    },
    ...(request.replies ?? []),
  ];

  const senderLabel = (senderRole: SupportEntry["senderRole"]): string =>
    senderRole === "admin"
      ? "Administração Guigui.com"
      : senderRole === "business"
        ? businessNameFor(request.businessId || "")
        : "O seu pedido";

  return (
    <div className="guigui-communication-thread guigui-dpanel">
      <PanelHeader
        className="guigui-thread-header"
        eyebrow="Suporte"
        title={request.subject}
        description={
          supportCategoryLabel(request.category) +
          " · " +
          supportStatusLabel(request.status)
        }
        icon={LifeBuoy}
        tone="success"
        actions={
          <button
            type="button"
            className="guigui-thread-info flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-default)]"
            onClick={() => setSupportInfoOpen(true)}
            aria-label="Informações do pedido"
            title="Informações do pedido"
          >
            i
          </button>
        }
      />
      <div
        className="guigui-thread-messages"
        ref={messagesRef}
        onScroll={(event) => {
          stickToBottomRef.current = isNearBottom(
            event.currentTarget as HTMLDivElement,
          );
        }}
      >
        {entries.map((entry, index) => (
          <React.Fragment key={entry.id}>
            {(index === 0 ||
              messageDateLabel(entry.createdAt) !==
                messageDateLabel(entries[index - 1].createdAt)) && (
              <div className="guigui-message-date">
                {messageDateLabel(entry.createdAt)}
              </div>
            )}
            <div
              id={"support-entry-" + entry.id}
              className={
                "guigui-message-bubble " +
                (entry.senderId === currentUser.id ? "is-own" : "")
              }
            >
              <p>{senderLabel(entry.senderRole)}</p>
              <span>{entry.text}</span>
              <small>
                {new Date(entry.createdAt).toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {entry.senderId === currentUser.id && (
                  <b aria-label="Enviada">✓</b>
                )}
              </small>
            </div>
          </React.Fragment>
        ))}
      </div>
      {request.status !== "resolved" ? (
        <form onSubmit={submitSupportReply} className="guigui-message-reply">
          <textarea
            value={supportReply}
            onChange={(event) => setSupportReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitSupportReply(event);
              }
            }}
            placeholder="Escrever resposta..."
            aria-label="Responder ao pedido"
            rows={1}
          />
          <button type="submit" aria-label="Enviar resposta">
            <Send className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <div className="guigui-support-resolved-note">
          <CheckCircle2 className="h-4 w-4" />
          Pedido resolvido — tratado pela Administração do Guigui.com
        </div>
      )}
    </div>
  );
}

interface CommunicationOverlaysProps {
  mode: "user" | "business";
  selectedProfile: boolean;
  setSelectedProfile: React.Dispatch<React.SetStateAction<boolean>>;
  conversationInfoOpen: boolean;
  setConversationInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedConversation: Conversation | null;
  selectedMessages: ConversationMessage[];
  businessNameFor: (businessId: string) => string;
  supportRequest: SupportRequest | null;
  supportInfoOpen: boolean;
  setSupportInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function CommunicationOverlays({
  mode,
  selectedProfile,
  setSelectedProfile,
  conversationInfoOpen,
  setConversationInfoOpen,
  selectedConversation,
  selectedMessages,
  businessNameFor,
  supportRequest,
  supportInfoOpen,
  setSupportInfoOpen,
}: CommunicationOverlaysProps) {
  return (
    <>
      {selectedProfile && selectedConversation && (
        <div className="guigui-message-overlay" role="dialog" aria-modal="true">
          <div className="guigui-message-panel guigui-dpanel">
            <button
              type="button"
              onClick={() => setSelectedProfile(false)}
              aria-label="Fechar perfil"
            >
              ×
            </button>
            <div className="guigui-list-avatar">
              <Building2 className="h-5 w-5" />
            </div>
            <h3>
              {mode === "user"
                ? selectedConversation.businessName ||
                  businessNameFor(selectedConversation.businessId)
                : selectedConversation.userName || "Cliente Guigui"}
            </h3>
            <p>
              {mode === "user"
                ? "Empresa · Perfil público"
                : "Pessoa · Participante da conversa"}
            </p>
          </div>
        </div>
      )}
      {conversationInfoOpen && selectedConversation && (
        <div className="guigui-message-overlay" role="dialog" aria-modal="true">
          <div className="guigui-message-panel guigui-dpanel">
            <button
              type="button"
              onClick={() => setConversationInfoOpen(false)}
              aria-label="Fechar informações"
            >
              ×
            </button>
            <h3>Informações da conversa</h3>
            <p>
              Iniciada em{" "}
              {new Date(selectedConversation.createdAt).toLocaleDateString(
                "pt-PT",
              )}
            </p>
            <p>{selectedMessages.length} mensagens nesta conversa.</p>
            <p>
              Participantes:{" "}
              {mode === "user"
                ? selectedConversation.businessName ||
                  businessNameFor(selectedConversation.businessId)
                : selectedConversation.userName || "Cliente Guigui"}
            </p>
          </div>
        </div>
      )}
      {supportInfoOpen && supportRequest && (
        <div className="guigui-message-overlay" role="dialog" aria-modal="true">
          <div className="guigui-message-panel guigui-dpanel">
            <button
              type="button"
              onClick={() => setSupportInfoOpen(false)}
              aria-label="Fechar informações do pedido"
            >
              ×
            </button>
            <div className="guigui-list-avatar">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <h3>Informações do pedido</h3>
            <p>{supportRequest.subject}</p>
            <p>
              {supportCategoryLabel(supportRequest.category)} ·{" "}
              {supportStatusLabel(supportRequest.status)}
            </p>
            <p>
              Aberto em{" "}
              {new Date(supportRequest.createdAt).toLocaleDateString("pt-PT")}
            </p>
            <p>{supportRequest.replies?.length || 0} respostas neste pedido.</p>
          </div>
        </div>
      )}
    </>
  );
}
