import React from "react";
import { Building2, LifeBuoy, Search } from "lucide-react";
import type {
  Conversation,
  SupportCategory,
  SupportRequest,
  UserProfile,
} from "../../types";

export type ConversationFilter =
  "all" | "unread" | "business" | "events" | "people";

interface ConversationListProps {
  mode: "user" | "business";
  visibleConversations: Conversation[];
  messageSearch: string;
  conversationFilter: ConversationFilter;
  onSearch: (value: string) => void;
  onFilter: (value: ConversationFilter) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  businessNameFor: (id: string) => string;
  participantNameFor: (id: string, fallback: string) => string;
  t: (key: string) => string;
}

const FILTER_OPTIONS: Array<{ value: ConversationFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "business", label: "Empresas" },
  { value: "events", label: "Eventos" },
  { value: "people", label: "Pessoas" },
];

export function ConversationList({
  mode,
  visibleConversations,
  messageSearch,
  conversationFilter,
  onSearch,
  onFilter,
  onNew,
  onSelect,
  selectedId,
  businessNameFor,
  participantNameFor,
  t,
}: ConversationListProps) {
  const isUnread = (conversation: Conversation): boolean =>
    mode === "user"
      ? Boolean(conversation.unreadForUser)
      : Boolean(conversation.unreadForBusiness);

  const titleFor = (conversation: Conversation): string =>
    mode === "user"
      ? conversation.businessName || businessNameFor(conversation.businessId)
      : conversation.userName ||
        participantNameFor(conversation.userId, t("customer"));

  return (
    <div className="guigui-communication-sidebar guigui-dpanel">
      <div className="guigui-communication-list">
        <div className="guigui-message-search">
          <Search className="h-4 w-4" />
          <input
            value={messageSearch}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Pesquisar mensagens"
            aria-label="Pesquisar mensagens"
          />
        </div>
        <div className="guigui-message-filters">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={conversationFilter === option.value ? "is-active" : ""}
              onClick={() => onFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
          {mode === "user" && (
            <button
              type="button"
              className="guigui-new-message-button"
              onClick={onNew}
            >
              + Nova mensagem
            </button>
          )}
        </div>
        <div className="guigui-list-heading">
          <div>
            <span>Conversas</span>
            <em>Ordenadas por atividade recente</em>
          </div>
          <small>{visibleConversations.length}</small>
        </div>
        {visibleConversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelect(conversation.id)}
            className={selectedId === conversation.id ? "is-selected" : ""}
          >
            <div className="guigui-list-avatar">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p>{titleFor(conversation)}</p>
              <strong>{conversation.subject}</strong>
              <span>{conversation.lastMessage || t("noMessages")}</span>
            </div>
            {isUnread(conversation) && <i />}
          </button>
        ))}
        {visibleConversations.length === 0 && (
          <div className="guigui-communication-empty">
            {messageSearch
              ? "Nenhuma conversa encontrada."
              : t("noConversations")}
          </div>
        )}
      </div>
    </div>
  );
}

export type SupportStatusFilter =
  "all" | "open" | "in_progress" | "resolved";

interface SupportListProps {
  visibleSupport: SupportRequest[];
  supportSearch: string;
  supportFilter: SupportStatusFilter;
  onSearch: (value: string) => void;
  onFilter: (value: SupportStatusFilter) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

const SUPPORT_STATUS_FILTERS: Array<{
  value: SupportStatusFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abertos" },
  { value: "in_progress", label: "Em análise" },
  { value: "resolved", label: "Resolvidos" },
];

export const SUPPORT_CATEGORY_OPTIONS: Array<{
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

export function supportStatusLabel(status: SupportRequest["status"]): string {
  if (status === "open") return "Aberto";
  if (status === "in_progress") return "Em análise";
  return "Resolvido";
}

export function supportCategoryLabel(category?: SupportCategory): string {
  return (
    SUPPORT_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.label || "Suporte"
  );
}

export function SupportList({
  visibleSupport,
  supportSearch,
  supportFilter,
  onSearch,
  onFilter,
  onNew,
  onSelect,
  selectedId,
}: SupportListProps) {
  const statusDotClass = (request: SupportRequest): string =>
    request.status === "in_progress"
      ? "is-in_progress"
      : request.status === "resolved"
        ? "is-resolved"
        : "";

  return (
    <div className="guigui-communication-sidebar guigui-dpanel">
      <div className="guigui-communication-list">
        <div className="guigui-message-search">
          <Search className="h-4 w-4" />
          <input
            value={supportSearch}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Pesquisar pedidos"
            aria-label="Pesquisar pedidos"
          />
        </div>
        <div className="guigui-message-filters">
          {SUPPORT_STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={supportFilter === option.value ? "is-active" : ""}
              onClick={() => onFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className="guigui-new-message-button"
            onClick={onNew}
          >
            + Novo pedido
          </button>
        </div>
        <div className="guigui-list-heading">
          <div>
            <span>Pedidos de suporte</span>
            <em>Ordenados por atividade recente</em>
          </div>
          <small>{visibleSupport.length}</small>
        </div>
        {visibleSupport.map((request) => (
          <button
            key={request.id}
            type="button"
            onClick={() => onSelect(request.id)}
            className={selectedId === request.id ? "is-selected" : ""}
          >
            <div className="guigui-list-avatar">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p>{supportCategoryLabel(request.category)}</p>
              <strong>{request.subject}</strong>
              <span>{request.description}</span>
            </div>
            <i className={statusDotClass(request)} />
          </button>
        ))}
        {visibleSupport.length === 0 && (
          <div className="guigui-communication-empty">
            {supportSearch
              ? "Nenhum pedido encontrado."
              : "Ainda não há pedidos de suporte neste contexto."}
          </div>
        )}
      </div>
    </div>
  );
}


