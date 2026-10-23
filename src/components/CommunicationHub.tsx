import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LifeBuoy, MessageCircle, UserRound } from "lucide-react";
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
} from "./communication/CommunicationSections";
import {
  CommunicationOverlays,
  ConversationThread,
  NewConversationForm,
  NewSupportForm,
  SupportThread,
} from "./communication/CommunicationPanels";

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
    options?: { replyToId?: string },
  ) => void;
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
            conversationFilter !== "business" ||
            Boolean(conversation.businessId),
        )
        .filter(
          (conversation) =>
            conversationFilter !== "events" ||
            conversation.participantType === "event",
        )
        .filter(
          (conversation) =>
            conversationFilter !== "people" ||
            conversation.participantType === "person",
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
    : scopedSupport.find((request) => request.id === selectedSupportId) ||
      visibleSupport[0] ||
      null;

  useEffect(() => {
    if (
      selectedConversationId &&
      !scopedConversations.some(
        (conversation) => conversation.id === selectedConversationId,
      )
    ) {
      setSelectedConversationId(null);
    }
    if (
      initialBusinessId &&
      businesses.some((business) => business.id === initialBusinessId)
    ) {
      setActiveChannel("messages");
      const existingConversation = scopedConversations.find(
        (conversation) => conversation.businessId === initialBusinessId,
      );
      setSelectedConversationId(existingConversation?.id || null);
    }
    if (
      focusConversationId &&
      scopedConversations.some(
        (conversation) => conversation.id === focusConversationId,
      )
    ) {
      setActiveChannel("messages");
      setSelectedConversationId(focusConversationId);
    } else if (
      focusSupportId &&
      scopedSupport.some((request) => request.id === focusSupportId)
    ) {
      setActiveChannel("support");
      setSelectedSupportId(focusSupportId);
    } else if (initialChannel) {
      setActiveChannel(initialChannel);
    }
  }, [
    businesses,
    focusConversationId,
    focusSupportId,
    initialBusinessId,
    initialChannel,
    scopedConversations,
    scopedSupport,
    selectedConversationId,
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

  const submitMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConversation || !messageText.trim()) return;
    onSendMessage(selectedConversation.id, messageText.trim(), {
      replyToId: replyToId || undefined,
    });
    setMessageText("");
    setReplyToId(null);
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
    if (!targetBusinessId || !newSubject.trim() || !newMessage.trim())
      return;
    const conversationId = await onCreateConversation(
      targetBusinessId,
      newSubject.trim(),
      newMessage.trim(),
    );
    if (conversationId) {
      setSelectedConversationId(conversationId);
      setNewConversationOpen(false);
    }
    setNewSubject("");
    setNewMessage("");
  };

  const submitSupport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supportSubject.trim() || !supportDescription.trim()) return;
    const targetBusinessId =
      mode === "user"
        ? initialBusinessId || currentUser.businessId
        : currentUser.businessId;

    if (!targetBusinessId) return;

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

  return (
    <section
      className="guigui-communication-shell guigui-dpanel"
      aria-labelledby="communication-title"
    >
      <header className="guigui-communication-header">
        <div>
          <p className="guigui-communication-eyebrow">
            {t("secureCommunication")}
          </p>
          <h2 id="communication-title">
            {channelOnly
              ? initialChannel === "support"
                ? t("support")
                : t("messages")
              : t("messagesAndSupport")}
          </h2>
          <p>
            {channelOnly
              ? initialChannel === "support"
                ? "Pedidos de apoio e intervenções à administração."
                : "Conversas privadas com empresas."
              : t("communicationDescription")}
          </p>
        </div>
        <div
          className={`guigui-communication-icon ${initialChannel === "support" ? "is-support" : ""}`}
        >
          {initialChannel === "support" ? (
            <LifeBuoy className="h-5 w-5" />
          ) : (
            <MessageCircle className="h-5 w-5" />
          )}
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
            onSearch={setMessageSearch}
            onFilter={setConversationFilter}
            onNew={() => {
              setSelectedConversationId(null);
              setNewConversationOpen(true);
              setNewBusinessId(null);
              setMessageSearch("");
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
            threadEndRef={threadEndRef}
            onBackToList={() => setMobilePane("list")}
          >
            {(newConversationOpen || initialBusinessId) ? (
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
      <footer className="guigui-communication-notice">
        <CheckCircle2 className="h-4 w-4" />
        As mensagens comerciais ficam limitadas aos participantes; os tickets de
        suporte ficam visíveis ao requerente e à Administração.
      </footer>
    </section>
  );
};


