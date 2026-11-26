import React, { useEffect, useMemo, useState } from "react";
import { LifeBuoy, Mail, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import type {
  Business,
  Conversation,
  ConversationMessage,
  Language,
  SupportCategory,
  SupportRequest,
  UserProfile,
} from "../types";
import { getTranslation } from "../utils/i18n";
import {
  ConversationList,
  SupportList,
  type ConversationFilter,
  type SupportStatusFilter,
  type ConversationRowMeta,
  type CommunicationLabels,
  COMMUNICATION_LABELS,
} from "./communication/CommunicationSections";
import {
  CommunicationOverlays,
  ConversationThread,
  NewConversationForm,
  NewSupportForm,
  SupportThread,
} from "./communication/CommunicationPanels";
import { ExternalEmailComposer } from "./communication/ExternalEmailComposer";

export type CommunicationMode = "user" | "business";
export type { ConversationFilter };

interface CommunicationHubProps {
  mode: "user" | "business";
  currentLang?: Language;
  currentUser: UserProfile;
  businesses: Business[];
  conversations: Conversation[];
  messages: ConversationMessage[];
  supportRequests: SupportRequest[];
  onCreateConversation: (
    businessId: string,
    subject: string,
    text: string,
  ) => void | Promise<string | void>;
  onSendMessage: (
    conversationId: string,
    text: string,
    options?: {
      replyToId?: string;
      attachmentName?: string;
      attachmentUrl?: string;
      messageType?: "text" | "image" | "document" | "link" | "shared_content";
      clientMessageId?: string;
    },
  ) => void | boolean | Promise<void | boolean>;
  onCreateSupport: (
    subject: string,
    description: string,
    businessId?: string,
    category?: SupportCategory,
  ) => void | Promise<string | void>;
  onReplySupport: (requestId: string, text: string) => void;
  onMarkConversationRead: (conversationId: string) => void;
  initialChannel?: "messages" | "support";
  focusConversationId?: string | null;
  focusSupportId?: string | null;
  initialBusinessId?: string | null;
  channelOnly?: boolean;
}

export const CommunicationHub: React.FC<CommunicationHubProps> = ({
  mode,
  currentLang = "pt" as Language,
  currentUser,
  businesses,
  conversations,
  messages,
  supportRequests,
  onCreateConversation,
  onSendMessage,
  onCreateSupport,
  onReplySupport,
  onMarkConversationRead,
  initialChannel = "messages",
  focusConversationId,
  focusSupportId,
  initialBusinessId,
  channelOnly = false,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [activeChannel, setActiveChannel] = useState<"messages" | "support">(
    initialChannel,
  );
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messageText, setMessageText] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [conversationFilter, setConversationFilter] =
    useState<ConversationFilter>("all");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(
    null,
  );
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [newConversationError, setNewConversationError] = useState<string | null>(null);
  const [newBusinessId, setNewBusinessId] = useState<string | null>(
    initialBusinessId || null,
  );
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportCategory, setSupportCategory] =
    useState<SupportCategory>("technical");
  const [supportReply, setSupportReply] = useState("");
  const [supportSearch, setSupportSearch] = useState("");
  const [supportFilter, setSupportFilter] =
    useState<SupportStatusFilter>("all");
  const [newSupportOpen, setNewSupportOpen] = useState(false);
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(
    null,
  );
  const [supportInfoOpen, setSupportInfoOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(false);
  const [conversationInfoOpen, setConversationInfoOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const [externalEmailOpen, setExternalEmailOpen] = useState(false);
  const threadEndRef = React.useRef<HTMLDivElement>(null);

  const scopedConversations = useMemo(
    () =>
      mode === "user"
        ? conversations.filter(
            (conversation) => conversation.userId === currentUser.id,
          )
        : conversations.filter(
            (conversation) =>
              conversation.businessId === currentUser.businessId,
          ),
    [conversations, currentUser.businessId, currentUser.id, mode],
  );
  const scopedSupport = useMemo(
    () =>
      mode === "user"
        ? supportRequests.filter(
            (request) => request.requesterId === currentUser.id,
          )
        : supportRequests.filter(
            (request) => request.businessId === currentUser.businessId,
          ),
    [currentUser.businessId, currentUser.id, mode, supportRequests],
  );
  const visibleConversations = useMemo(
    () =>
      scopedConversations
        .filter(
          (conversation) =>
            conversationFilter !== "unread" ||
            (mode === "user"
              ? conversation.unreadForUser
              : conversation.unreadForBusiness),
        )
        .filter(
          (conversation) =>
            conversationFilter !== "awaiting" ||
            !(conversationMeta[conversation.id]?.lastFromMe ?? false),
        )
        .filter((conversation) =>
          `${conversation.subject} ${conversation.lastMessage || ""} ${conversation.businessName || conversation.userName || ""}`
            .toLocaleLowerCase()
            .includes(messageSearch.toLocaleLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
            Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
    [conversationFilter, messageSearch, mode, scopedConversations],
  );
  const conversationMeta = useMemo(
    () => {
      const grouped: Record<string, ConversationMessage[]> = Object.create(null);
      for (const message of messages) {
        (grouped[message.conversationId] ||= []).push(message);
      }
      const map: Record<string, ConversationRowMeta> = Object.create(null);
      for (const conversation of scopedConversations) {
        const conversationMessages = grouped[conversation.id] ?? [];
        conversationMessages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        const last = conversationMessages[conversationMessages.length - 1];
        const unreadCount = conversationMessages.filter(
          (message) =>
            message.senderId !== currentUser.id &&
            (mode === "user" ? !message.readByUser : !message.readByBusiness),
        ).length;
        map[conversation.id] = {
          unreadCount,
          lastAt: last?.createdAt ?? conversation.updatedAt,
          lastText:
            last?.text ||
            (last?.attachmentName ? `Anexo: ${last.attachmentName}` : "") ||
            conversation.lastMessage ||
            "",
          lastFromMe: !!last && last.senderId === currentUser.id,
        };
      }
      return map;
    },
    [messages, scopedConversations, currentUser.id, mode],
  );

  const conversationCounts = useMemo(
    () => {
      let all = 0;
      let unread = 0;
      let awaiting = 0;
      for (const conversation of scopedConversations) {
        const meta = conversationMeta[conversation.id];
        if (!meta) continue;
        all += 1;
        if (meta.unreadCount > 0) unread += 1;
        if (mode === "business" && !meta.lastFromMe) awaiting += 1;
      }
      return { all, unread, awaiting };
    },
    [scopedConversations, conversationMeta, mode],
  );

  const supportCounts: Record<SupportStatusFilter, number> = useMemo(
    () => ({
      all: scopedSupport.length,
      open: scopedSupport.filter((request) => request.status === "open").length,
      in_progress: scopedSupport.filter((request) => request.status === "in_progress").length,
      resolved: scopedSupport.filter((request) => request.status === "resolved").length,
    }),
    [scopedSupport],
  );

  const visibleSupport = useMemo(
    () =>
      scopedSupport
        .filter(
          (request) =>
            supportFilter === "all" || request.status === supportFilter,
        )
        .filter((request) =>
          `${request.subject} ${request.description}`
            .toLocaleLowerCase()
            .includes(supportSearch.toLocaleLowerCase()),
        )
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [scopedSupport, supportFilter, supportSearch],
  );

  const selectedSupport = newSupportOpen
    ? null
    : scopedSupport.find((r) => r.id === selectedSupportId) ||
      visibleSupport[0] ||
      null;

  // Limpa apenas a selecção que deixou de existir nos dados sincronizados.
  useEffect(() => {
    if (
      selectedConversationId &&
      !scopedConversations.some((c) => c.id === selectedConversationId)
    ) {
      setSelectedConversationId(null);
    }
  }, [scopedConversations, selectedConversationId]);

  // Aplica o foco pedido uma única vez por foco. Antes, este efeito voltava a
  // correr a cada sondagem (10 s, porque os arrays mudam de identidade) e repunha
  // o canal e a conversa seleccionados, fazendo a caixa de mensagens saltar
  // entre painéis e perder a escolha do utilizador.
  const appliedFocusRef = React.useRef<string | null>(null);
  const focusSignature = `${initialChannel}|${initialBusinessId ?? ""}|${focusConversationId ?? ""}|${focusSupportId ?? ""}`;

  useEffect(() => {
    if (appliedFocusRef.current === focusSignature) return;
    if (focusConversationId) {
      // Espera que a conversa chegue com os dados, sem aplicar duas vezes.
      if (!scopedConversations.some((c) => c.id === focusConversationId)) return;
      appliedFocusRef.current = focusSignature;
      setActiveChannel("messages");
      setSelectedConversationId(focusConversationId);
      return;
    }
    if (focusSupportId) {
      if (!scopedSupport.some((r) => r.id === focusSupportId)) return;
      appliedFocusRef.current = focusSignature;
      setActiveChannel("support");
      setSelectedSupportId(focusSupportId);
      setNewSupportOpen(false);
      return;
    }
    appliedFocusRef.current = focusSignature;
    if (
      initialBusinessId &&
      businesses.some((b) => b.id === initialBusinessId)
    ) {
      setActiveChannel("messages");
      const existingConversation = scopedConversations.find(
        (c) => c.businessId === initialBusinessId,
      );
      if (existingConversation) setSelectedConversationId(existingConversation.id);
    }
    if (initialChannel) setActiveChannel(initialChannel);
  }, [
    businesses,
    focusConversationId,
    focusSignature,
    focusSupportId,
    initialBusinessId,
    initialChannel,
    scopedConversations,
    scopedSupport,
  ]);

  useEffect(() => {
    if (
      selectedSupportId &&
      !scopedSupport.some((request) => request.id === selectedSupportId)
    ) {
      setSelectedSupportId(null);
    }
  }, [scopedSupport, selectedSupportId]);
  const participantNameFor = (participantId: string, fallback: string) => {
    if (participantId === currentUser.id) return currentUser.name;
    const business = businesses.find((b) => b.id === participantId);
    if (business) return business.name;
    return fallback;
  };
  const selectedConversation = newConversationOpen
    ? null
    : scopedConversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ||
      (initialBusinessId
        ? scopedConversations.find(
            (conversation) => conversation.businessId === initialBusinessId,
          )
        : visibleConversations[0]) ||
      null;
  const selectedMessages = selectedConversation
    ? messages
        .filter((message) => message.conversationId === selectedConversation.id)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    : [];
  const messageDateLabel = (createdAt: string) => {
    const date = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Hoje";
    if (date.toDateString() === yesterday.toDateString()) return "Ontem";
    return date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const submitMessage = async (
    event: React.FormEvent,
    attachment?: { name: string; url: string; mimeType: string },
  ): Promise<boolean> => {
    event.preventDefault();
    const text = messageText.trim();
    if (!selectedConversation || (!text && !attachment)) return false;
    setSendError(null);
    const result = await onSendMessage(selectedConversation.id, text, {
      replyToId: replyToId || undefined,
      attachmentName: attachment?.name,
      attachmentUrl: attachment?.url,
      messageType: attachment
        ? attachment.mimeType.startsWith("image/")
          ? "image"
          : "document"
        : undefined,
    });
    if (result === false) {
      setSendError("Não foi possível enviar a mensagem. Verifique a ligação e tente novamente.");
      return false;
    }
    setMessageText("");
    setReplyToId(null);
    return true;
  };

  const retryMessage = (message: ConversationMessage) => {
    setSendError(null);
    void Promise.resolve(onSendMessage(message.conversationId, message.text, {
      replyToId: message.replyToId,
      attachmentName: message.attachmentName,
      attachmentUrl: message.attachmentUrl,
      messageType: message.type,
      clientMessageId: message.clientMessageId,
    })).then((result) => {
      if (result === false) setSendError("Não foi possível reenviar a mensagem. Tente novamente.");
    });
  };

  const submitSupportReply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSupport || !supportReply.trim()) return;
    onReplySupport(selectedSupport.id, supportReply.trim());
    setSupportReply("");
  };

  const submitNewConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetBusinessId = newBusinessId || initialBusinessId;
    if (!targetBusinessId || !newSubject.trim() || !newMessage.trim()) {
      setNewConversationError("Escolha uma empresa e preencha o assunto e a mensagem.");
      return;
    }
    setNewConversationError(null);
    try {
      const conversationId = await onCreateConversation(
        targetBusinessId,
        newSubject.trim(),
        newMessage.trim(),
      );
      if (!conversationId) throw new Error("Não foi possível criar a conversa. Tente novamente.");
      setSelectedConversationId(conversationId);
      setNewConversationOpen(false);
      // Só limpa o rascunho depois de a conversa ficar guardada no servidor.
      setNewSubject("");
      setNewMessage("");
    } catch (error) {
      setNewConversationError((error as Error).message || "Não foi possível criar a conversa. Tente novamente.");
    }
  };

  const submitSupport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supportSubject.trim() || !supportDescription.trim()) return;
    const targetBusinessId =
      mode === "user"
        ? initialBusinessId || currentUser.businessId
        : currentUser.businessId;
    // Um cidadão sem empresa também pode abrir pedido de suporte: o servidor
    // deriva o âmbito do ticket a partir da sessão. Só a empresa exige businessId.
    if (mode === "business" && !targetBusinessId) return;
    const requestId = await onCreateSupport(
      supportSubject.trim(),
      supportDescription.trim(),
      targetBusinessId,
      supportCategory,
    );
    if (requestId) {
      setSelectedSupportId(requestId);
      setNewSupportOpen(false);
    }
    setSupportSubject("");
    setSupportDescription("");
  };

  const businessNameFor = (businessId: string) =>
    businesses.find((business) => business.id === businessId)?.name ||
    "Empresa Guigui";

  const accountInitials =
    currentUser.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "G";

  return (
    <section
      className="guigui-communication-shell guigui-dpanel"
      aria-labelledby="communication-title"
    >
      <header className="guigui-communication-topbar">
        <div className="guigui-communication-brand">
          <span
            className={`guigui-communication-brand-mark ${initialChannel === "support" ? "is-support" : ""}`}
            aria-hidden="true"
          >
            {initialChannel === "support" ? (
              <LifeBuoy className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
          </span>
          <span className="guigui-communication-brand-label">
            {t("secureCommunication")}
          </span>
          <span className="guigui-communication-brand-divider" aria-hidden="true" />
          <h2 id="communication-title" className="guigui-communication-topbar-title">
            {channelOnly
              ? initialChannel === "support"
                ? t("support")
                : t("messages")
              : t("messagesAndSupport")}
          </h2>
        </div>
        <div className="guigui-communication-topbar-actions">
          <button
            type="button"
            className="guigui-communication-external-email"
            onClick={() => setExternalEmailOpen(true)}
            aria-label="Escrever email externo"
            title="Escrever email externo"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>Email externo</span>
          </button>
          <div className="guigui-communication-account">
            <span className="guigui-communication-account-avatar" aria-hidden="true">
              {accountInitials}
            </span>
            <span className="guigui-communication-account-name">
              {currentUser.name}
            </span>
          </div>
        </div>
      </header>

      {!channelOnly && (
        <div className="guigui-communication-tabs" role="tablist">
          <button
            type="button"
            onClick={() => setActiveChannel("messages")}
            className={activeChannel === "messages" ? "is-active" : ""}
          >
            <MessageCircle className="h-4 w-4" />
            {t("messages")}
            <span>{scopedConversations.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChannel("support")}
            className={
              activeChannel === "support" ? "is-active is-support" : ""
            }
          >
            <LifeBuoy className="h-4 w-4" />
            {t("support")}
            <span>{scopedSupport.length}</span>
          </button>
        </div>
      )}

      {activeChannel === "messages" && (
        <div
          className={`guigui-communication-layout ${mobilePane === "list" ? "is-mobile-list" : "is-mobile-thread"}`}
        >
          <ConversationList
            mode={mode}
            visibleConversations={visibleConversations}
            messageSearch={messageSearch}
            conversationFilter={conversationFilter}
            counts={conversationCounts}
            onSearch={setMessageSearch}
            onFilter={setConversationFilter}
            onNew={() => {
              setSelectedConversationId(null);
              setNewConversationOpen(true);
              setNewBusinessId(null);
              setMessageSearch("");
              setNewConversationError(null);
              setMobilePane("list");
            }}
            onSelect={(conversationId) => {
              setSelectedConversationId(conversationId);
              setMobilePane("thread");
              onMarkConversationRead(conversationId);
            }}
            selectedId={selectedConversation?.id || null}
            businessNameFor={businessNameFor}
            participantNameFor={participantNameFor}
            t={t}
            labels={COMMUNICATION_LABELS[currentLang]}
            metaFor={(conversation) => conversationMeta[conversation.id]}
            lang={currentLang}
          />
          <ConversationThread
            mode={mode}
            currentUser={currentUser}
            conversation={selectedConversation}
            messages={selectedMessages}
            businessNameFor={businessNameFor}
            participantNameFor={participantNameFor}
            messageDateLabel={messageDateLabel}
            t={t}
            setSelectedProfile={setSelectedProfile}
            setConversationInfoOpen={setConversationInfoOpen}
            openMessageMenuId={openMessageMenuId}
            setOpenMessageMenuId={setOpenMessageMenuId}
            replyToId={replyToId}
            setReplyToId={setReplyToId}
            emojiOpen={emojiOpen}
            setEmojiOpen={setEmojiOpen}
            messageText={messageText}
            setMessageText={setMessageText}
            submitMessage={submitMessage}
            sendError={sendError}
            onRetryMessage={retryMessage}
            threadEndRef={threadEndRef}
            onBackToList={() => setMobilePane("list")}
          >
            {newConversationOpen || initialBusinessId ? (
              <NewConversationForm
                businesses={businesses}
                initialBusinessId={initialBusinessId}
                newBusinessId={newBusinessId}
                setNewBusinessId={setNewBusinessId}
                newSubject={newSubject}
                setNewSubject={setNewSubject}
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                submitNewConversation={submitNewConversation}
                businessNameFor={businessNameFor}
                t={t}
                error={newConversationError}
              />
            ) : (
              <div className="guigui-communication-empty is-centered">
                <UserRound className="h-8 w-8" />
                <p>
                  Selecione uma empresa para iniciar uma conversa ou escolha uma
                  conversa existente.
                </p>
              </div>
            )}
          </ConversationThread>
        </div>
      )}

      {activeChannel === "support" && (
        <div className="guigui-communication-layout">
          <SupportList
            visibleSupport={visibleSupport}
            supportSearch={supportSearch}
            supportFilter={supportFilter}
            counts={supportCounts}
            onSearch={setSupportSearch}
            onFilter={setSupportFilter}
            onNew={() => {
              setSelectedSupportId(null);
              setNewSupportOpen(true);
              setSupportSearch("");
            }}
            onSelect={(requestId) => {
              setSelectedSupportId(requestId);
              setNewSupportOpen(false);
            }}
            selectedId={selectedSupport?.id || null}
            labels={COMMUNICATION_LABELS[currentLang]}
            lang={currentLang}
          />
          <SupportThread
            currentUser={currentUser}
            request={selectedSupport}
            businessNameFor={businessNameFor}
            messageDateLabel={messageDateLabel}
            setSupportInfoOpen={setSupportInfoOpen}
            supportReply={supportReply}
            setSupportReply={setSupportReply}
            submitSupportReply={submitSupportReply}
          >
            <NewSupportForm
              supportCategory={supportCategory}
              supportSubject={supportSubject}
              supportDescription={supportDescription}
              onCategory={setSupportCategory}
              onSubject={setSupportSubject}
              onDescription={setSupportDescription}
              onSubmit={submitSupport}
            />
          </SupportThread>
        </div>
      )}

      <CommunicationOverlays
        mode={mode}
        selectedProfile={selectedProfile}
        setSelectedProfile={setSelectedProfile}
        conversationInfoOpen={conversationInfoOpen}
        setConversationInfoOpen={setConversationInfoOpen}
        selectedConversation={selectedConversation}
        selectedMessages={selectedMessages}
        businessNameFor={businessNameFor}
        supportRequest={selectedSupport}
        supportInfoOpen={supportInfoOpen}
        setSupportInfoOpen={setSupportInfoOpen}
      />

      {externalEmailOpen && (
        <ExternalEmailComposer
          variant="dialog"
          senderEmail={currentUser.email}
          roleLabel={mode === "business" ? "empresa" : "cidadão"}
          onClose={() => setExternalEmailOpen(false)}
        />
      )}
    </section>
  );
};
