import React from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  Info,
  LifeBuoy,
  MessageCircle,
  Paperclip,
  Send,
  UserRound,
  X,
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
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  formatAttachmentSize,
  isImageAttachment,
  uploadConversationAttachment,
  type UploadedAttachment,
} from "../../services/messageAttachment";

/** Campos que merecem destaque dentro do corpo de uma mensagem. */
const MESSAGE_FIELD = /^(oferta|promoção|promocao|localização|localizacao|validade|válida até|valida ate|válido até|valido ate|código|codigo|preço|preco|horário|horario|contacto|telefone)\s*:\s*(.+)$/i;

/**
 * Apresenta o texto de uma mensagem em linhas legíveis: quebra também as
 * sequências literais "\\n" que chegam dentro dos dados e destaca os campos
 * importantes da promoção (oferta, localização, validade, código).
 */
function MessageText({ text }: { text: string }) {
  const lines = text
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <div className="guigui-message-content">
      {lines.map((line, index) => {
        const field = line.match(MESSAGE_FIELD);
        if (field) {
          return (
            <p key={`${index}-${field[1]}`} className="guigui-message-field">
              <strong>{field[1]}:</strong> {field[2]}
            </p>
          );
        }
        return (
          <p key={index} className="guigui-message-line">{line}</p>
        );
      })}
    </div>
  );
}

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
  submitMessage: (
    event: React.FormEvent,
    attachment?: UploadedAttachment,
  ) => void | boolean | Promise<void | boolean>;
  sendError?: string | null;
  onRetryMessage?: (message: ConversationMessage) => void;
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
  sendError,
  onRetryMessage,
  threadEndRef,
  onBackToList,
  children,
}: ConversationThreadProps) {
  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = React.useRef(true);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [attachment, setAttachment] = React.useState<UploadedAttachment | null>(null);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

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
  const conversationTitle = selectedConversation
    ? mode === "user"
      ? selectedConversation.businessName ||
        businessNameFor(selectedConversation.businessId)
      : selectedConversation.userName ||
        participantNameFor(selectedConversation.userId, "Cliente Guigui")
    : "";
  const conversationInitials =
    conversationTitle
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "G";

  const handleAttachmentChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedConversation) return;
    setAttachmentError(null);
    if (file.size > ATTACHMENT_MAX_BYTES) {
      setAttachmentError("O ficheiro excede o limite de 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadConversationAttachment(
        selectedConversation.id,
        file,
      );
      setAttachment(uploaded);
    } catch (error) {
      setAttachmentError((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (uploading) return;
    if (!messageText.trim() && !attachment) return;
    // Só limpa o rascunho e o anexo depois de o servidor confirmar o envio.
    const result = await submitMessage(event, attachment ?? undefined);
    if (result === false) return;
    setAttachment(null);
    setAttachmentError(null);
  };

  return (
    <div className="guigui-communication-thread guigui-dpanel">
      {selectedConversation ? (
        <>
          <header className="guigui-thread-header">
            {onBackToList && (
              <button
                type="button"
                className="guigui-thread-back"
                onClick={onBackToList}
                aria-label="Voltar às conversas"
                title="Voltar às conversas"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <span className="guigui-thread-avatar" aria-hidden="true">
              {conversationInitials}
            </span>
            <div className="guigui-thread-identity">
              <strong>{conversationTitle}</strong>
              <span className="guigui-thread-status">
                <i className={selectedConversation.participantOnline ? "is-online" : ""} />
                {selectedConversation.participantOnline
                  ? "Online"
                  : "Ativo recentemente"}
              </span>
            </div>
            <div className="guigui-thread-actions">
              <button
                type="button"
                className="guigui-thread-info"
                onClick={() => setConversationInfoOpen(true)}
                aria-label="Detalhes da conversa"
                title="Detalhes da conversa"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="guigui-thread-info"
                onClick={() => setSelectedProfile(true)}
                aria-label="Ver perfil do participante"
                title="Ver perfil do participante"
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

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
                    <span>{messageDateLabel(message.createdAt)}</span>
                  </div>
                )}
                <div
                  className={`guigui-message-row ${message.senderId === currentUser.id ? "is-own" : ""}`}
                >
                  {message.senderId !== currentUser.id && (
                    <span className="guigui-message-avatar" aria-hidden="true">
                      {conversationInitials}
                    </span>
                  )}
                  <div
                    id={`message-${message.id}`}
                    className={`guigui-message-bubble ${message.senderId === currentUser.id ? "is-own" : ""}`}
                  >
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
                  {message.attachmentUrl &&
                    (isImageAttachment({
                      url: message.attachmentUrl,
                      mimeType: message.type === "image" ? "image/*" : undefined,
                    }) ? (
                      <a
                        className="guigui-message-attachment is-image"
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={message.attachmentUrl}
                          alt={message.attachmentName || "Anexo da mensagem"}
                          loading="lazy"
                        />
                      </a>
                    ) : (
                      <a
                        className="guigui-message-attachment is-file"
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={message.attachmentName || undefined}
                      >
                        <Paperclip className="h-4 w-4" aria-hidden="true" />
                        <span>{message.attachmentName || "Anexo"}</span>
                      </a>
                    ))}
                  <MessageText text={message.text} />
                  <div className="guigui-message-meta">
                    <small>
                      {new Date(message.createdAt).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {message.senderId === currentUser.id && (
                        message.status === "sending" ? (
                          <b className="guigui-message-state is-sending" aria-label="A enviar">A enviar…</b>
                        ) : message.status === "failed" ? (
                          <b className="guigui-message-state is-failed" aria-label="Falhou">Falhou</b>
                        ) : message.status === "read" || message.readByBusiness || message.readByUser ? (
                          <b aria-label="Lida">✓✓</b>
                        ) : (
                          <b aria-label="Enviada">✓</b>
                        )
                      )}
                    </small>
                    {message.senderId === currentUser.id && message.status === "failed" && onRetryMessage && (
                      <button
                        type="button"
                        className="guigui-message-retry"
                        onClick={() => onRetryMessage(message)}
                      >
                        Tentar novamente
                      </button>
                    )}
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
                </div>
              </React.Fragment>
            ))}
            <div ref={threadEndRef} />
          </div>
          <p className="guigui-thread-notice">
            As mensagens comerciais ficam limitadas aos participantes desta conversa.
          </p>
          <form onSubmit={handleSubmit} className="guigui-message-reply">
            {sendError && (
              <p className="guigui-composer-status is-error" role="alert">{sendError}</p>
            )}
            {attachment && (
              <div className="guigui-composer-attachment">
                {isImageAttachment(attachment) ? (
                  <img src={attachment.url} alt="" aria-hidden="true" />
                ) : (
                  <span className="guigui-composer-attachment-icon" aria-hidden="true">
                    <Paperclip className="h-4 w-4" />
                  </span>
                )}
                <div className="guigui-composer-attachment-meta">
                  <strong>{attachment.name}</strong>
                  <small>{formatAttachmentSize(attachment.size)} · pronto a enviar</small>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remover anexo"
                  title="Remover anexo"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            {uploading && <p className="guigui-composer-status">A carregar anexo…</p>}
            {attachmentError && (
              <p className="guigui-composer-status is-error">{attachmentError}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={ATTACHMENT_ACCEPT}
              onChange={handleAttachmentChange}
              tabIndex={-1}
            />
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
              onClick={() => fileInputRef.current?.click()}
              aria-label="Anexar ficheiro"
              title="Anexar ficheiro"
              disabled={uploading || !selectedConversation}
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </button>
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
                  handleSubmit(event);
                }
              }}
              placeholder="Escrever mensagem..."
              aria-label="Escrever mensagem"
              rows={1}
            />
            <button
              type="submit"
              className="guigui-composer-send"
              aria-label={t("sendMessage")}
              disabled={uploading}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Enviar</span>
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
  error?: string | null;
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
  error,
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
      {error && (
        <p className="guigui-new-conversation-error" role="alert">{error}</p>
      )}
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
  const [supportEmojiOpen, setSupportEmojiOpen] = React.useState(false);
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
      <header className="guigui-thread-header">
        <span className="guigui-thread-avatar is-support" aria-hidden="true">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div className="guigui-thread-identity">
          <strong>{request.subject}</strong>
          <span className="guigui-thread-status">
            <i className={request.status === "open" ? "is-online" : ""} />
            {supportCategoryLabel(request.category)} ·{" "}
            {supportStatusLabel(request.status)}
          </span>
        </div>
        <div className="guigui-thread-actions">
          <button
            type="button"
            className="guigui-thread-info"
            onClick={() => setSupportInfoOpen(true)}
            aria-label="Informações do pedido"
            title="Informações do pedido"
          >
            i
          </button>
        </div>
      </header>
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
                <span>{messageDateLabel(entry.createdAt)}</span>
              </div>
            )}
            <div
              className={
                "guigui-message-row " +
                (entry.senderId === currentUser.id ? "is-own" : "")
              }
            >
              {entry.senderId !== currentUser.id && (
                <span className="guigui-message-avatar is-support" aria-hidden="true">
                  <LifeBuoy className="h-3.5 w-3.5" />
                </span>
              )}
              <div
                id={"support-entry-" + entry.id}
                className={
                  "guigui-message-bubble " +
                  (entry.senderId === currentUser.id ? "is-own" : "")
                }
              >
              <p className="guigui-message-author">{senderLabel(entry.senderRole)}</p>
              <MessageText text={entry.text} />
              <div className="guigui-message-meta">
                <small>
                  {new Date(entry.createdAt).toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {entry.senderId === currentUser.id && (
                    <b aria-label="Enviada">✓✓</b>
                  )}
                </small>
              </div>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {request.status !== "resolved" ? (
        <>
          <p className="guigui-thread-notice">
            Pedido de suporte visível a si e à Administração do Guigui.com.
          </p>
          <form onSubmit={submitSupportReply} className="guigui-message-reply">
            {supportEmojiOpen && (
              <div className="guigui-emoji-picker">
                {["👍", "❤️", "😂", "😮", "😢"].map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => {
                      setSupportReply((value) => `${value}${emoji}`);
                      setSupportEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="guigui-composer-action"
              onClick={() => setSupportEmojiOpen((value) => !value)}
              aria-label="Adicionar emoji"
            >
              ☺
            </button>
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
        </>
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
            <p className="guigui-message-panel-subject">
              {selectedConversation.subject}
            </p>
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
