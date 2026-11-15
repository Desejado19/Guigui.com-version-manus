import React from "react";
import { Building2, LifeBuoy, Search, SquarePen } from "lucide-react";
import type {
  Conversation,
  Language,
  SupportCategory,
  SupportRequest,
} from "../../types";

const LOCALES: Record<Language, string> = {
  pt: "pt-PT",
  en: "en-GB",
  fr: "fr-FR",
  es: "es-ES",
};

/** Horário curto da lista: hoje mostra a hora, ontem o dia, e o resto a data. */
function formatConversationTime(iso: string | undefined, lang: Language): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(LOCALES[lang], { hour: "2-digit", minute: "2-digit"});
 }
  if (date.toDateString() === yesterday.toDateString()) {
    return lang === "pt" ? "Ontem" : lang === "fr" ? "Hier" : lang === "es" ? "Ayer" : "Yesterday";
 }
  const withinWeek = today.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000;
  if (withinWeek) {
    return new Intl.DateTimeFormat(LOCALES[lang], { weekday: "short"}).format(date).replace(/\.$/, "");
 }
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: "2-digit",
    month: "2-digit",
 }).format(date);
}

/**
 * Pré-visualização curta para a lista: junta as linhas (incluindo "\\n"
 * literal vindo dos dados) e corta num limite confortável de leitura.
 */
export function shortPreview(value: string, max = 78): string {
  const flat = (value || "")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return "";
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export type ConversationFilter = "all" | "unread" | "awaiting";

export interface ConversationRowMeta {
  unreadCount: number;
  lastAt: string;
  lastText: string;
  lastFromMe: boolean;
}

export interface CommunicationLabels {
  conversations: string;
  requests: string;
  all: string;
  unread: string;
  awaiting: string;
  newMessage: string;
  newRequest: string;
  searchMessages: string;
  searchRequests: string;
  noConversations: string;
  noUnread: string;
  noAwaiting: string;
  noSearchResults: string;
  noRequests: string;
  you: string;
  noMessagesYet: string;
  open: string;
  inProgress: string;
  resolved: string;
}

export const COMMUNICATION_LABELS: Record<Language, CommunicationLabels> = {
  pt: {
    conversations: "Conversas",
    requests: "Pedidos de suporte",
    all: "Todas",
    unread: "Não lidas",
    awaiting: "Por responder",
    newMessage: "Nova mensagem",
    newRequest: "Novo pedido",
    searchMessages: "Pesquisar conversas",
    searchRequests: "Pesquisar pedidos",
    noConversations: "Ainda não tem conversas. Escolha uma empresa para começar.",
    noUnread: "Não tem conversas por ler.",
    noAwaiting: "Nenhuma conversa à espera de resposta sua.",
    noSearchResults: "Nenhum resultado para esta pesquisa.",
    noRequests: "Ainda não há pedidos de suporte neste contexto.",
    you: "Você",
    noMessagesYet: "Sem mensagens",
    open: "Aberto",
    inProgress: "Em análise",
    resolved: "Resolvido",
 },
  en: {
    conversations: "Conversations",
    requests: "Support requests",
    all: "All",
    unread: "Unread",
    awaiting: "Awaiting reply",
    newMessage: "New message",
    newRequest: "New request",
    searchMessages: "Search conversations",
    searchRequests: "Search requests",
    noConversations: "No conversations yet. Pick a business to start one.",
    noUnread: "You have no unread conversations.",
    noAwaiting: "Nothing is waiting for your reply.",
    noSearchResults: "No results for this search.",
    noRequests: "No support requests in this context yet.",
    you: "You",
    noMessagesYet: "No messages",
    open: "Open",
    inProgress: "In progress",
    resolved: "Resolved",
 },
  fr: {
    conversations: "Conversations",
    requests: "Demandes d’assistance",
    all: "Toutes",
    unread: "Non lues",
    awaiting: "En attente de réponse",
    newMessage: "Nouveau message",
    newRequest: "Nouvelle demande",
    searchMessages: "Rechercher des conversations",
    searchRequests: "Rechercher des demandes",
    noConversations: "Aucune conversation. Choisissez une entreprise pour commencer.",
    noUnread: "Aucune conversation non lue.",
    noAwaiting: "Aucune conversation en attente de votre réponse.",
    noSearchResults: "Aucun résultat pour cette recherche.",
    noRequests: "Aucune demande d’assistance dans ce contexte.",
    you: "Vous",
    noMessagesYet: "Aucun message",
    open: "Ouverte",
    inProgress: "En cours",
    resolved: "Résolue",
 },
  es: {
    conversations: "Conversaciones",
    requests: "Solicitudes de soporte",
    all: "Todas",
    unread: "No leídas",
    awaiting: "Pendientes de respuesta",
    newMessage: "Nuevo mensaje",
    newRequest: "Nueva solicitud",
    searchMessages: "Buscar conversaciones",
    searchRequests: "Buscar solicitudes",
    noConversations: "Aún no hay conversaciones. Elija una empresa para empezar.",
    noUnread: "No tiene conversaciones sin leer.",
    noAwaiting: "Ninguna conversación espera su respuesta.",
    noSearchResults: "Sin resultados para esta búsqueda.",
    noRequests: "Aún no hay solicitudes de soporte en este contexto.",
    you: "Usted",
    noMessagesYet: "Sin mensajes",
    open: "Abierta",
    inProgress: "En análisis",
    resolved: "Resuelta",
 },
};

export interface ConversationListProps {
  mode: "user" | "business";
  visibleConversations: Conversation[];
  messageSearch: string;
  conversationFilter: ConversationFilter;
  counts: { all: number; unread: number; awaiting: number };
  onSearch: (value: string) => void;
  onFilter: (value: ConversationFilter) => void;
  onNew: () => void;
  onSelect: (conversationId: string) => void;
  selectedId: string | null;
  businessNameFor: (businessId: string) => string;
  participantNameFor: (participantId: string, fallback: string) => string;
  t: (key: string) => string;
  labels: CommunicationLabels;
  metaFor: (conversation: Conversation) => ConversationRowMeta | undefined;
  lang: Language;
}

export function ConversationList({
  mode,
  visibleConversations,
  messageSearch,
  conversationFilter,
  counts,
  onSearch,
  onFilter,
  onNew,
  onSelect,
  selectedId,
  businessNameFor,
  participantNameFor,
  t,
  labels,
  metaFor,
  lang,
}: ConversationListProps) {

  const titleFor = (conversation: Conversation): string =>
    mode === "user"
      ? conversation.businessName || businessNameFor(conversation.businessId)
      : conversation.userName ||
        participantNameFor(conversation.userId, t("customer"));

  const filters: Array<{ value: ConversationFilter; label: string; count: number}> = [
    { value: "all", label: labels.all, count: counts.all},
    { value: "unread", label: labels.unread, count: counts.unread},
    ...(mode === "business"
      ? [
          { value: "awaiting" as ConversationFilter, label: labels.awaiting, count: counts.awaiting},
        ]
      : []),
  ];

  const emptyMessage =
    messageSearch !== ""
      ? labels.noSearchResults
      : conversationFilter === "unread"
        ? labels.noUnread
        : conversationFilter === "awaiting"
          ? labels.noAwaiting
          : labels.noConversations;

  return (
    <div className="guigui-communication-sidebar guigui-dpanel">
      <div className="guigui-inbox-toolbar">
        <div className="guigui-inbox-head">
          <div className="guigui-inbox-title">
            <strong>{labels.conversations}</strong>
            <span>{counts.all}</span>
          </div>
          {mode === "user" && (
            <button
              type="button"
              className="guigui-inbox-new"
              onClick={onNew}
              title={labels.newMessage}
            >
              <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{labels.newMessage}</span>
            </button>
          )}
        </div>

        <label className="guigui-inbox-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            value={messageSearch}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={labels.searchMessages}
            aria-label={labels.searchMessages}
          />
        </label>

        <div className="guigui-inbox-filters" role="group" aria-label={labels.conversations}>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={conversationFilter === option.value}
              className={conversationFilter === option.value ? "is-active" : ""}
              onClick={() => onFilter(option.value)}
            >
              {option.label}
              <span>{option.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="guigui-communication-list">
        {visibleConversations.map((conversation) => {
          const meta = metaFor(conversation);
          const unread = meta?.unreadCount ?? 0;
          const preview = conversation.lastMessage || meta?.lastText || labels.noMessagesYet;
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={selectedId === conversation.id ? "true" : undefined}
              title={conversation.subject}
              className={`guigui-conversation-item ${selectedId === conversation.id ? "is-selected" : ""} ${unread > 0 ? "is-unread" : ""}`}
            >
              <span className="guigui-conversation-avatar" aria-hidden="true">
                {(() => {
                  const short = titleFor(conversation);
                  // Filtra palavras sem letra/dígito inicial ("&" gerava "F&").
                  const initials = short
                    .split(/\s+/)
                    .filter((part) => /^[\p{L}\p{N}]/u.test(part))
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() || "")
                    .join("");
                  return initials || <Building2 className="h-4 w-4" />;
               })()}
              </span>
              <span className="guigui-conversation-body">
                <span className="guigui-conversation-top">
                  <strong>{titleFor(conversation)}</strong>
                  <time dateTime={meta?.lastAt || conversation.updatedAt}>
                    {formatConversationTime(meta?.lastAt || conversation.updatedAt, lang)}
                  </time>
                </span>
                <span className="guigui-conversation-preview" title={preview}>
                  {meta?.lastFromMe ? `${labels.you}: ` : ""}
                  {shortPreview(preview)}
                </span>
              </span>
              {unread > 0 && (
                <span className="guigui-unread-badge" aria-label={`${unread} ${labels.unread}`}>
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          );
       })}
        {visibleConversations.length === 0 && (
          <div className="guigui-communication-empty">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}

export type SupportStatusFilter = "all" | "open" | "in_progress" | "resolved";

interface SupportListProps {
  visibleSupport: SupportRequest[];
  supportSearch: string;
  supportFilter: SupportStatusFilter;
  counts: Record<SupportStatusFilter, number>;
  onSearch: (value: string) => void;
  onFilter: (value: SupportStatusFilter) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  labels: CommunicationLabels;
  lang: Language;
}export const SUPPORT_CATEGORY_OPTIONS: Array<{
  value: SupportCategory;
  label: string;
}> = [
  { value: "account", label: "Conta" },
  { value: "payments", label: "Pagamentos" },
  { value: "tickets", label: "Bilhetes" },
  { value: "technical", label: "Problema técnico" },
  { value: "business_report", label: "Denúncia de empresa" },
  { value: "other", label: "Outro" },
];

interface SupportLabelOverrides {
  open?: string;
  inProgress?: string;
  resolved?: string;
}

export function supportStatusLabel(
  status: SupportRequest["status"],
  labels?: CommunicationLabels,
): string {
  if (status === "open") return labels?.open ?? "Aberto";
  if (status === "in_progress") return labels?.inProgress ?? "Em análise";
  return labels?.resolved ?? "Resolvido";
}

export function supportCategoryLabel(category?: SupportCategory): string {
  return (
    SUPPORT_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.label || "Suporte"
  );
}export function SupportList({
  visibleSupport,
  supportSearch,
  supportFilter,
  counts,
  onSearch,
  onFilter,
  onNew,
  onSelect,
  selectedId,
  labels,
  lang,
}: SupportListProps) {
  const filters: Array<{ value: SupportStatusFilter; label: string; count: number }> = [
    { value: "all", label: labels.all, count: counts.all },
    { value: "open", label: labels.open, count: counts.open },
    { value: "in_progress", label: labels.inProgress, count: counts.in_progress },
    { value: "resolved", label: labels.resolved, count: counts.resolved },
  ];

  return (
    <div className="guigui-communication-sidebar guigui-dpanel">
      <div className="guigui-inbox-toolbar">
        <div className="guigui-inbox-head">
          <div className="guigui-inbox-title">
            <strong>{labels.requests}</strong>
            <span>{counts.all}</span>
          </div>
          <button
            type="button"
            className="guigui-inbox-new"
            onClick={onNew}
            title={labels.newRequest}
          >
            <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{labels.newRequest}</span>
          </button>
        </div>

        <label className="guigui-inbox-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            value={supportSearch}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={labels.searchRequests}
            aria-label={labels.searchRequests}
          />
        </label>

        <div className="guigui-inbox-filters" role="group" aria-label={labels.requests}>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={supportFilter === option.value}
              className={supportFilter === option.value ? "is-active" : ""}
              onClick={() => onFilter(option.value)}
            >
              {option.label}
              <span>{option.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="guigui-communication-list">
        {visibleSupport.map((request) => (
          <button
            key={request.id}
            type="button"
            onClick={() => onSelect(request.id)}
            aria-current={selectedId === request.id ? "true" : undefined}
            className={`guigui-ticket-item ${selectedId === request.id ? "is-selected" : ""}`}
          >
            <span className="guigui-ticket-icon" aria-hidden="true">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <span className="guigui-conversation-body">
              <span className="guigui-conversation-top">
                <strong>{request.subject}</strong>
                <time dateTime={request.updatedAt}>
                  {formatConversationTime(request.updatedAt, lang)}
                </time>
              </span>
              <span className="guigui-ticket-meta">
                <span className="guigui-ticket-category">
                  {supportCategoryLabel(request.category)}
                </span>
                <span className={`guigui-ticket-state is-${request.status}`}>
                  {supportStatusLabel(request.status, labels)}
                </span>
              </span>
              <span className="guigui-conversation-preview">
                {shortPreview(request.lastReply || request.description)}
              </span>
            </span>
          </button>
        ))}
        {visibleSupport.length === 0 && (
          <div className="guigui-communication-empty">
            {supportSearch !== "" ? labels.noSearchResults : labels.noRequests}
          </div>
        )}
      </div>
    </div>
  );
}

