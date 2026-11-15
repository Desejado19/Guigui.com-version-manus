import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Building2,
  Calendar,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Headphones,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  Package,
  Send,
  ShoppingBag,
  Star,
  Tag,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';
import { usePostEngagementContext } from '../PostEngagementProvider';
import type {
  AppNotification,
  Business,
  BusinessTeamAuditEntry,
  BusinessTeamMember,
  Conversation,
  ConversationMessage,
  EventItem,
  Language,
  MarketingAudienceSegment,
  MarketingCampaign,
  MarketingLibraryAsset,
  PurchaseOrder,
  ScheduledItem,
  SupportRequest,
  UserProfile,
} from '../../types';
import { storyApi, type StoryApi } from '../../services/storyApi';
import { downloadCSV, downloadExcel, downloadExcelWorkbook, downloadPDFReport } from '../../utils/exportHelpers';
import { readExportHistory, recordExportHistory, type ExportHistoryEntry } from '../../utils/exportHistory';
import { getTranslation } from '../../utils/i18n';

type ExportFormat = 'pdf' | 'excel' | 'csv';
type ExportRow = Array<string | number>;

interface ClientExportHubProps {
  business: Business;
  currentLang?: Language;
  purchaseOrders: PurchaseOrder[];
  events?: EventItem[];
  teamMembers?: BusinessTeamMember[];
  teamAudit?: BusinessTeamAuditEntry[];
  conversations?: Conversation[];
  conversationMessages?: ConversationMessage[];
  supportRequests?: SupportRequest[];
  marketingCampaigns?: MarketingCampaign[];
  marketingSegments?: MarketingAudienceSegment[];
  marketingAssets?: MarketingLibraryAsset[];
  scheduledItems?: ScheduledItem[];
  notifications?: AppNotification[];
  followerCount?: number;
  audienceReach?: number;
  currentUser?: UserProfile;
}

interface ExportDataset {
  key: string;
  group: string;
  title: string;
  description: string;
  filename: string;
  sheet: string;
  headers: string[];
  rows: ExportRow[];
  kpis: Array<{ label: string; value: string }>;
}

const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'valid', label: 'Válido' },
  { value: 'redeemed', label: 'Resgatado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const ORDER_TYPE_OPTIONS = [
  { value: 'ticket', label: 'Bilhete' },
  { value: 'product', label: 'Produto' },
  { value: 'promotion', label: 'Promoção' },
  { value: 'service', label: 'Serviço' },
];

const POST_STATUS_OPTIONS = [
  { value: 'approved', label: 'Aprovada' },
  { value: 'pending_moderation', label: 'Em moderação' },
  { value: 'scheduled', label: 'Agendada' },
  { value: 'rejected', label: 'Rejeitada' },
  { value: 'expired', label: 'Expirada' },
];

const REVIEW_STATUS_OPTIONS = [
  { value: 'approved', label: 'Aprovada' },
  { value: 'pending', label: 'Pendente' },
  { value: 'flagged', label: 'Sinalizada' },
];

const EVENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'ended', label: 'Terminado' },
];

const TEAM_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'invited', label: 'Convidado' },
  { value: 'suspended', label: 'Suspenso' },
];

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'repeat', label: 'Clientes recorrentes' },
  { value: 'single', label: 'Compra única' },
];

const TICKET_CREDENTIAL_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'valid', label: 'Válido' },
  { value: 'used', label: 'Utilizado' },
];

const CAMPAIGN_STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'scheduled', label: 'Agendada' },
  { value: 'active', label: 'Ativa' },
  { value: 'paused', label: 'Pausada' },
  { value: 'ended', label: 'Terminada' },
  { value: 'archived', label: 'Arquivada' },
];

const ASSET_TYPE_OPTIONS = [
  { value: 'image', label: 'Imagem' },
  { value: 'video', label: 'Vídeo' },
  { value: 'banner', label: 'Banner' },
  { value: 'logo', label: 'Logótipo' },
  { value: 'document', label: 'Documento' },
];

const SCHEDULED_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'publishing', label: 'A publicar' },
  { value: 'published', label: 'Publicado' },
  { value: 'failed', label: 'Falhou' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'expired', label: 'Expirado' },
];

const STORY_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativa' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'expired', label: 'Expirada' },
  { value: 'removed', label: 'Removida' },
  { value: 'suspended', label: 'Suspensa' },
];

const CONVERSATION_STATE_OPTIONS = [
  { value: 'unread', label: 'Não lidas' },
  { value: 'pinned', label: 'Fixadas' },
];

const SUPPORT_STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em curso' },
  { value: 'resolved', label: 'Resolvido' },
];

const SUPPORT_CATEGORY_OPTIONS = [
  { value: 'account', label: 'Conta' },
  { value: 'payments', label: 'Pagamentos' },
  { value: 'tickets', label: 'Bilhetes' },
  { value: 'technical', label: 'Técnico' },
  { value: 'business_report', label: 'Denúncia de empresa' },
  { value: 'other', label: 'Outro' },
];

const NOTIFICATION_READ_OPTIONS = [
  { value: 'unread', label: 'Não lidas' },
  { value: 'read', label: 'Lidas' },
];

const CAMPAIGN_OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Notoriedade',
  engagement: 'Engajamento',
  traffic: 'Tráfego',
  conversions: 'Conversões',
  sales: 'Vendas',
};

const CAMPAIGN_CHANNEL_LABELS: Record<string, string> = {
  guigui: 'Guigui',
  social: 'Redes sociais',
  sms: 'SMS',
  email: 'Email',
  banner: 'Banner',
};

const DATASET_GROUPS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'company', label: 'Empresa e subscrição', hint: 'Identidade, plano, limites e resultados globais' },
  { id: 'sales', label: 'Vendas e clientes', hint: 'Pedidos, compradores e bilhetes emitidos' },
  { id: 'content', label: 'Catálogo e conteúdo', hint: 'Produtos, publicações, promoções, avaliações e eventos' },
  { id: 'marketing', label: 'Marketing', hint: 'Campanhas, audiências, ficheiros, agendamentos e stories' },
  { id: 'communication', label: 'Comunicação e suporte', hint: 'Conversas, mensagens e pedidos de apoio' },
  { id: 'team', label: 'Equipa e atividade', hint: 'Membros, auditoria e notificações da empresa' },
];

const REVIEW_SCORE_LABELS: Record<string, string> = {
  nao_gostei: 'Não gostei',
  gostei: 'Gostei',
  gostei_muito: 'Gostei muito',
  muito_bom: 'Muito bom',
};

const PERMISSION_LABELS: Record<string, string> = {
  profile: 'Perfil',
  content: 'Conteúdo',
  events: 'Eventos',
  tickets: 'Bilhetes',
  billing: 'Faturação',
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(query: string, ...values: unknown[]): boolean {
  if (!query) return true;
  return values.some((value) => normalizeText(value).includes(query));
}

function fileToken(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'empresa';
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function withinPeriod(value: string | null | undefined, cutoff: number): boolean {
  if (!cutoff) return true;
  const parsed = timestamp(value);
  return parsed === 0 || parsed >= cutoff;
}

function formatDateValue(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-PT');
}

function permissionText(permissions: BusinessTeamMember['permissions']): string {
  const enabled = Object.entries(permissions)
    .filter(([, allowed]) => allowed)
    .map(([permission]) => PERMISSION_LABELS[permission] || permission);
  return enabled.length > 0 ? enabled.join(', ') : 'Sem permissões';
}

export const ClientExportHub: React.FC<ClientExportHubProps> = ({
  business,
  currentLang = 'pt' as Language,
  purchaseOrders,
  events = [],
  teamMembers = [],
  teamAudit = [],
  conversations = [],
  conversationMessages = [],
  supportRequests = [],
  marketingCampaigns = [],
  marketingSegments = [],
  marketingAssets = [],
  scheduledItems = [],
  notifications = [],
  followerCount = 0,
  audienceReach = 0,
  currentUser,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) =>
    getTranslation(currentLang, key, variables);
  const [exportTimeframe, setExportTimeframe] = useState<'30days' | '90days' | 'year' | 'all'>('30days');
  const [query, setQuery] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [orderType, setOrderType] = useState('all');
  const [postStatus, setPostStatus] = useState('all');
  const [promotionStatus, setPromotionStatus] = useState('all');
  const [reviewStatus, setReviewStatus] = useState('all');
  const [eventStatus, setEventStatus] = useState('all');
  const [teamStatus, setTeamStatus] = useState('all');
  const [catalogAvailability, setCatalogAvailability] = useState('all');
  const [customerType, setCustomerType] = useState('all');
  const [ticketCredentialStatus, setTicketCredentialStatus] = useState('all');
  const [campaignStatus, setCampaignStatus] = useState('all');
  const [assetType, setAssetType] = useState('all');
  const [scheduledStatus, setScheduledStatus] = useState('all');
  const [storyStatus, setStoryStatus] = useState('all');
  const [conversationState, setConversationState] = useState('all');
  const [supportStatus, setSupportStatus] = useState('all');
  const [supportCategory, setSupportCategory] = useState('all');
  const [notificationRead, setNotificationRead] = useState('all');
  const [stories, setStories] = useState<StoryApi[]>([]);

  useEffect(() => {
    let active = true;
    storyApi.mine('all')
      .then((result) => {
        if (active) setStories(result.stories || []);
      })
      .catch(() => {
        if (active) setStories([]);
      });
    return () => { active = false; };
  }, [business.id]);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const exportCutoff = exportTimeframe === 'all'
    ? 0
    : exportTimeframe === 'year'
      ? yearStart
      : Date.now() - (exportTimeframe === '30days' ? 30 : 90) * 24 * 60 * 60 * 1000;
  const timeframeLabel = exportTimeframe === '30days'
    ? t('business.UltimosDias2')
    : exportTimeframe === '90days'
      ? t('business.UltimosDias90')
      : exportTimeframe === 'year'
        ? t('business.AnoCorrente')
        : t('business.TodoHistorico');
  const queryTerm = normalizeText(query);

  const myOrders = purchaseOrders.filter((order) => order.businessId === business.id);
  const myEvents = events.filter((event) => !event.businessId || event.businessId === business.id);
  const products = business.products || [];

  const filteredOrders = myOrders.filter((order) => (
    withinPeriod(order.purchasedAt, exportCutoff)
    && (orderStatus === 'all' || order.status === orderStatus)
    && (orderType === 'all' || order.itemType === orderType)
    && matchesQuery(queryTerm, order.orderCode, order.id, order.customerName, order.customerPhone, order.itemTitle, order.holderName)
  ));
  const filteredProducts = products.filter((product) => (
    (catalogAvailability === 'all'
      || (catalogAvailability === 'available' ? product.isAvailable : !product.isAvailable))
    && matchesQuery(queryTerm, product.name, product.category)
  ));
  const postEngagement = usePostEngagementContext();
  const filteredPosts = business.posts.filter((post) => (
    withinPeriod(post.publishedAt || post.createdAt, exportCutoff)
    && (postStatus === 'all' || post.status === postStatus)
    && matchesQuery(queryTerm, post.title, post.content, post.status)
  ));
  const filteredPromotions = business.promotions.filter((promotion) => (
    withinPeriod(promotion.validUntil, exportCutoff)
    && (promotionStatus === 'all'
      || (promotionStatus === 'active' ? promotion.isActive : !promotion.isActive))
    && matchesQuery(queryTerm, promotion.title, promotion.description, promotion.code, promotion.discountBadge)
  ));
  const filteredReviews = business.reviews.filter((review) => (
    withinPeriod(review.createdAt, exportCutoff)
    && (reviewStatus === 'all' || review.status === reviewStatus)
    && matchesQuery(queryTerm, review.authorName, review.comment, review.ownerReply)
  ));
  const filteredEvents = myEvents.filter((event) => (
    withinPeriod(event.date, exportCutoff)
    && (eventStatus === 'all' || event.status === eventStatus)
    && matchesQuery(queryTerm, event.title, event.location, event.neighborhood, event.category)
  ));
  const filteredTeam = teamMembers.filter((member) => (
    (teamStatus === 'all' || member.status === teamStatus)
    && matchesQuery(queryTerm, member.name, member.email, member.phone, member.role)
  ));

  const myConversations = conversations.filter((conversation) => conversation.businessId === business.id);
  const conversationById = new Map(myConversations.map((conversation) => [conversation.id, conversation]));
  const myMessages = conversationMessages.filter((message) => conversationById.has(message.conversationId));
  const mySupportRequests = supportRequests.filter((request) => request.businessId === business.id);
  const myCampaigns = marketingCampaigns.filter((campaign) => campaign.businessId === business.id);
  const mySegments = marketingSegments.filter((segment) => segment.businessId === business.id);
  const myAssets = marketingAssets.filter((asset) => asset.businessId === business.id);
  const myScheduledItems = scheduledItems.filter((item) => item.businessId === business.id);
  const myStories = stories.filter((story) => story.businessId === business.id);
  // O App já entrega apenas as notificações visíveis para o contexto desta empresa.
  const myNotifications = notifications;

  const filteredConversations = myConversations.filter((conversation) => (
    withinPeriod(conversation.updatedAt || conversation.createdAt, exportCutoff)
    && (conversationState !== 'unread' || conversation.unreadForBusiness)
    && (conversationState !== 'pinned' || conversation.pinned)
    && matchesQuery(queryTerm, conversation.subject, conversation.userName, conversation.lastMessage)
  ));
  const filteredMessages = myMessages.filter((message) => {
    const conversation = conversationById.get(message.conversationId);
    return withinPeriod(message.createdAt, exportCutoff)
      && (conversationState === 'all' || filteredConversations.some((item) => item.id === message.conversationId))
      && matchesQuery(queryTerm, message.text, message.senderName, conversation?.subject, message.attachmentName);
  });
  const filteredSupport = mySupportRequests.filter((request) => (
    withinPeriod(request.updatedAt || request.createdAt, exportCutoff)
    && (supportStatus === 'all' || request.status === supportStatus)
    && (supportCategory === 'all' || (request.category || 'other') === supportCategory)
    && matchesQuery(queryTerm, request.subject, request.description, request.lastReply, request.category, request.status)
  ));
  const filteredCampaigns = myCampaigns.filter((campaign) => (
    withinPeriod(campaign.startsAt || campaign.createdAt, exportCutoff)
    && (campaignStatus === 'all' || campaign.status === campaignStatus)
    && matchesQuery(queryTerm, campaign.name, campaign.description, campaign.objective, campaign.channels.join(' '))
  ));
  const filteredSegments = mySegments.filter((segment) => (
    withinPeriod(segment.createdAt, exportCutoff)
    && matchesQuery(queryTerm, segment.name, segment.location, segment.interests.join(' '))
  ));
  const filteredAssets = myAssets.filter((asset) => (
    withinPeriod(asset.createdAt, exportCutoff)
    && (assetType === 'all' || asset.type === assetType)
    && matchesQuery(queryTerm, asset.name, asset.type, asset.url, asset.sourceId)
  ));
  const filteredScheduled = myScheduledItems.filter((item) => (
    withinPeriod(item.scheduledAt || item.createdAt, exportCutoff)
    && (scheduledStatus === 'all' || item.status === scheduledStatus)
    && matchesQuery(queryTerm, item.itemType, item.label, item.description, item.status, item.errorMessage)
  ));
  const filteredStories = myStories.filter((story) => (
    withinPeriod(story.createdAt, exportCutoff)
    && (storyStatus === 'all' || story.status === storyStatus)
    && matchesQuery(queryTerm, story.caption, story.storyType, story.status, story.moderationStatus)
  ));
  const filteredAudit = teamAudit.filter((entry) => (
    entry.businessId === business.id
    && withinPeriod(entry.createdAt, exportCutoff)
    && matchesQuery(queryTerm, entry.memberName, entry.action)
  ));
  const filteredNotifications = myNotifications.filter((notification) => (
    withinPeriod(notification.createdAt, exportCutoff)
    && (notificationRead === 'all' || (notificationRead === 'unread' ? !notification.read : notification.read))
    && matchesQuery(queryTerm, notification.title, notification.message, notification.category, notification.eventType)
  ));

  const customerMap = new Map<string, {
    name: string;
    phone: string;
    orders: number;
    totalXOF: number;
    firstPurchase: string;
    lastPurchase: string;
    types: Set<string>;
    pending: number;
    redeemed: number;
  }>();
  filteredOrders.forEach((order) => {
    const key = normalizeText(order.customerPhone) || normalizeText(order.customerName) || order.id;
    const current = customerMap.get(key) || {
      name: order.customerName || 'Cliente sem nome',
      phone: order.customerPhone || '—',
      orders: 0,
      totalXOF: 0,
      firstPurchase: order.purchasedAt,
      lastPurchase: order.purchasedAt,
      types: new Set<string>(),
      pending: 0,
      redeemed: 0,
    };
    current.orders += 1;
    current.totalXOF += order.totalPriceXOF;
    current.types.add(order.itemType);
    current.pending += order.status === 'pending' ? 1 : 0;
    current.redeemed += order.status === 'redeemed' ? 1 : 0;
    if (timestamp(order.purchasedAt) < timestamp(current.firstPurchase)) current.firstPurchase = order.purchasedAt;
    if (timestamp(order.purchasedAt) > timestamp(current.lastPurchase)) current.lastPurchase = order.purchasedAt;
    customerMap.set(key, current);
  });
  const customers = Array.from(customerMap.values())
    .filter((customer) => customerType === 'all' || (customerType === 'repeat' ? customer.orders > 1 : customer.orders === 1))
    .sort((a, b) => b.totalXOF - a.totalXOF);

  const issuedTickets = filteredOrders
    .filter((order) => order.itemType === 'ticket' || (order.ticketCredentials?.length || 0) > 0)
    .flatMap((order) => {
      const credentials = order.ticketCredentials?.length ? order.ticketCredentials : [undefined];
      return credentials.map((credential) => ({
        orderCode: order.orderCode || order.id,
        event: order.itemTitle,
        ticketCode: credential?.ticketCode || '—',
        holder: credential?.holderName || order.holderName || order.customerName || '—',
        phone: credential?.holderPhone || order.holderPhone || order.customerPhone || '—',
        type: credential?.ticketTypeName || order.itemTitle,
        status: credential?.status || order.status,
        purchasedAt: order.purchasedAt,
        amountXOF: order.totalPriceXOF,
        search: [credential?.ticketCode, credential?.holderName, credential?.holderPhone, order.orderCode, order.customerName, order.itemTitle],
      }));
    })
    .filter((ticket) => ticketCredentialStatus === 'all' || ticket.status === ticketCredentialStatus)
    .filter((ticket) => matchesQuery(queryTerm, ...ticket.search));

  const businessSlug = fileToken(business.name);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = (dataset: string) => `Guigui_${dataset}_${businessSlug}_${dateStamp}`;

  const profileDataset: ExportDataset = {
    key: 'profile',
    group: 'company',
    title: t('business.exportProfileTitle'),
    description: t('business.exportProfileDescription'),
    filename: filename('Perfil'),
    sheet: t('business.exportProfileTitle'),
    headers: ['Campo', 'Valor'],
    rows: [
      ['ID da empresa', business.id],
      ['Nome', business.name],
      ['Slug', business.slug],
      ['Proprietário / responsável', business.ownerName || '—'],
      ['Grupo de categoria', business.groupGroupId],
      ['Categoria', business.category || business.categoryId],
      ['Subcategoria', business.subcategoryId],
      ['Bairro', business.neighborhood],
      ['Endereço', business.address || '—'],
      ['Telefone', business.phone || '—'],
      ['WhatsApp', business.whatsapp || '—'],
      ['Email público', business.publicEmail || business.email || '—'],
      ['Website', business.website || '—'],
      ['Horário', business.openingHours || '—'],
      ['Aberto agora', business.isOpenNow ? 'Sim' : 'Não'],
      ['Faixa de preço', business.priceRange],
      ['Estado', business.status],
      ['Verificada', business.verified ? 'Sim' : 'Não'],
      ['Em destaque', business.featured ? 'Sim' : 'Não'],
      ['Ordem no destaque da página inicial', business.homepageFeaturedOrder ?? '—'],
      ['Plano', business.planName || business.tier],
      ['ID do plano', business.planId || '—'],
      ['Versão do plano', business.subscriptionPlanVersion ?? '—'],
      ['Periodicidade', business.subscriptionPeriod || '—'],
      ['Início da subscrição', formatDateValue(business.subscriptionStartedAt)],
      ['Estado da subscrição', business.subscriptionStatus || '—'],
      ['Renovação da subscrição', formatDateValue(business.subscriptionRenewDate)],
      ['Pagamento da subscrição', business.subscriptionPaymentId || '—'],
      ['Suspensa em', formatDateValue(business.subscriptionSuspendedAt)],
      ['Motivo da suspensão', business.subscriptionSuspensionReason || '—'],
      ['Suspensão automática', business.subscriptionAutoSuspended ? 'Sim' : 'Não'],
      ['Registada em', formatDateValue(business.createdAt)],
      ['Avaliação', `${business.rating ?? '—'} (${business.reviewsCount} avaliações)`],
      ['Etiqueta de avaliação', business.ratingLabel || '—'],
      ['Descrição', business.description || '—'],
      ['Logótipo', business.logo || '—'],
      ['Imagem de capa', business.coverImage || '—'],
      ['Galeria', (business.gallery || []).join(' | ') || '—'],
      ['Campos não aplicáveis', (business.notApplicableFields || []).join(', ') || '—'],
      ['Idiomas de atendimento', (business.serviceLanguages || []).join(', ') || '—'],
      ['Redes sociais', [
        business.socialLinks?.facebook ? `Facebook: ${business.socialLinks.facebook}` : '',
        business.socialLinks?.instagram ? `Instagram: ${business.socialLinks.instagram}` : '',
      ].filter(Boolean).join(' | ') || '—'],
      ['Funcionalidades', (business.features || []).join(', ') || '—'],
    ],
    kpis: [
      { label: 'Estado', value: business.status },
      { label: 'Plano', value: business.planName || business.tier },
      { label: 'Avaliação', value: String(business.rating ?? '—') },
      { label: 'Avaliações', value: String(business.reviewsCount) },
    ],
  };

  const ordersDataset: ExportDataset = {
    key: 'orders',
    group: 'sales',
    title: t('business.exportSalesTitle'),
    description: t('business.exportSalesDescription', { count: filteredOrders.length }),
    filename: filename('Vendas'),
    sheet: t('business.exportOrderSheet'),
    headers: [
      t('business.exportOrderColCode'),
      t('business.exportOrderColCustomer'),
      t('business.exportOrderColPhone'),
      'Titular',
      'Telemóvel do titular',
      t('business.exportOrderColItem'),
      t('business.exportOrderColType'),
      'Quantidade',
      t('business.exportOrderColAmount'),
      t('business.exportOrderColMethod'),
      t('business.exportOrderColStatus'),
      t('business.exportOrderColDate'),
      'Resgatado em',
      'Resgatado por',
      'Credenciais emitidas',
    ],
    rows: filteredOrders.map((order) => [
      order.orderCode || order.id,
      order.customerName || '—',
      order.customerPhone || '—',
      order.holderName || '—',
      order.holderPhone || '—',
      order.itemTitle,
      order.itemType.toUpperCase(),
      order.quantity,
      order.totalPriceXOF,
      order.paymentMethod.toUpperCase(),
      order.status.toUpperCase(),
      formatDateValue(order.purchasedAt),
      order.redeemedAt ? formatDateValue(order.redeemedAt) : '—',
      order.redeemedBy || '—',
      order.ticketCredentials?.length || 0,
    ]),
    kpis: [
      { label: t('business.exportOrderPdfTotal'), value: String(filteredOrders.length) },
      { label: t('business.exportOrderPdfRevenue'), value: `${filteredOrders.reduce((sum, order) => sum + order.totalPriceXOF, 0).toLocaleString('pt-PT')} XOF` },
      { label: t('business.exportOrderPdfRedeemed'), value: String(filteredOrders.filter((order) => order.status === 'redeemed').length) },
      { label: t('business.exportOrderPdfPending'), value: String(filteredOrders.filter((order) => order.status === 'pending').length) },
    ],
  };

  const catalogDataset: ExportDataset = {
    key: 'catalog',
    group: 'content',
    title: t('business.exportCatalogTitle', { name: business.name }),
    description: t('business.exportCatalogDescription'),
    filename: filename('Catalogo'),
    sheet: t('business.exportCatalogSheet'),
    headers: ['ID', t('business.exportCatalogColName'), t('business.exportCatalogColCategory'), t('business.exportCatalogColPrice'), t('business.exportCatalogColAvailability')],
    rows: filteredProducts.map((product) => [
      product.id,
      product.name,
      product.category,
      product.priceXOF,
      product.isAvailable ? t('business.exportCatalogAvailable') : t('business.exportCatalogSoldOut'),
    ]),
    kpis: [
      { label: t('business.exportCatalogPdfItems'), value: String(filteredProducts.length) },
      { label: t('business.exportCatalogPdfCategory'), value: business.category || business.categoryId },
      { label: t('business.exportCatalogPdfPlan'), value: business.tier.toUpperCase() },
      { label: t('business.exportCatalogPdfLocation'), value: business.neighborhood },
    ],
  };

  const postsDataset: ExportDataset = {
    key: 'posts',
    group: 'content',
    title: t('business.exportPostsTitle'),
    description: t('business.exportPostsDescription'),
    filename: filename('Publicacoes'),
    sheet: t('business.exportPostsTitle'),
    headers: ['ID', 'Título', 'Tipo de conteúdo', 'Estado', 'Criada em', 'Agendada para', 'Publicada em', 'Gostos', 'Comentários', 'Partilhas', 'Motivo de moderação'],
    rows: filteredPosts.map((post) => [
      post.id,
      post.title || 'Sem título',
      (post.mediaType || 'text').toUpperCase(),
      post.status,
      formatDateValue(post.createdAt),
      post.scheduledAt ? formatDateValue(post.scheduledAt) : '—',
      post.publishedAt ? formatDateValue(post.publishedAt) : '—',
      postEngagement?.engagements[post.id]?.likes ?? 0,
      postEngagement?.engagements[post.id]?.comments.length ?? 0,
      postEngagement?.engagements[post.id]?.shares ?? 0,
      post.moderationReason || '—',
    ]),
    kpis: [
      { label: 'Publicações', value: String(filteredPosts.length) },
      { label: 'Aprovadas', value: String(filteredPosts.filter((post) => post.status === 'approved').length) },
      { label: 'Em moderação', value: String(filteredPosts.filter((post) => post.status === 'pending_moderation').length) },
      { label: 'Agendadas', value: String(filteredPosts.filter((post) => post.status === 'scheduled').length) },
    ],
  };

  const promotionsDataset: ExportDataset = {
    key: 'promotions',
    group: 'content',
    title: t('business.exportPromotionsTitle'),
    description: t('business.exportPromotionsDescription'),
    filename: filename('Promocoes'),
    sheet: t('business.exportPromotionsTitle'),
    headers: ['ID', 'Título', 'Oferta', 'Código', 'Categoria', 'Estado', 'Ativa', 'Início', 'Validade', 'Cliques'],
    rows: filteredPromotions.map((promotion) => [
      promotion.id,
      promotion.title,
      promotion.discountBadge,
      promotion.code || '—',
      promotion.categoryName,
      promotion.status || (promotion.isActive ? 'active' : 'inactive'),
      promotion.isActive ? 'Sim' : 'Não',
      promotion.startsAt ? formatDateValue(promotion.startsAt) : '—',
      formatDateValue(promotion.validUntil),
      promotion.clicksCount,
    ]),
    kpis: [
      { label: 'Promoções', value: String(filteredPromotions.length) },
      { label: 'Ativas', value: String(filteredPromotions.filter((promotion) => promotion.isActive).length) },
      { label: 'Cliques', value: String(filteredPromotions.reduce((sum, promotion) => sum + promotion.clicksCount, 0)) },
    ],
  };

  const reviewsDataset: ExportDataset = {
    key: 'reviews',
    group: 'content',
    title: t('business.exportReviewsTitle'),
    description: t('business.exportReviewsDescription'),
    filename: filename('Avaliacoes'),
    sheet: t('business.exportReviewsTitle'),
    headers: ['ID', 'Autor', 'Nota qualitativa', 'Comentário', 'Estado', 'Verificada por SMS', 'Resposta da empresa', 'Data'],
    rows: filteredReviews.map((review) => [
      review.id,
      review.authorName,
      REVIEW_SCORE_LABELS[review.qualitativeScore] || review.qualitativeScore,
      review.comment || '—',
      review.status,
      review.verifiedSms ? 'Sim' : 'Não',
      review.ownerReply || '—',
      formatDateValue(review.createdAt),
    ]),
    kpis: [
      { label: 'Avaliações', value: String(filteredReviews.length) },
      { label: 'Aprovadas', value: String(filteredReviews.filter((review) => review.status === 'approved').length) },
      { label: 'Com resposta', value: String(filteredReviews.filter((review) => Boolean(review.ownerReply)).length) },
      { label: 'Nota média', value: String(business.rating ?? '—') },
    ],
  };

  const eventsDataset: ExportDataset = {
    key: 'events',
    group: 'content',
    title: t('business.exportEventsTitle'),
    description: t('business.exportEventsDescription'),
    filename: filename('Eventos'),
    sheet: t('business.exportEventsTitle'),
    headers: ['ID', 'Evento', 'Data', 'Hora', 'Local', 'Bairro', 'Categoria', 'Estado', 'Tipos de bilhete', 'Bilhetes vendidos', 'Receita (XOF)', 'Código do scanner'],
    rows: filteredEvents.map((event) => [
      event.id,
      event.title,
      event.date,
      event.time,
      event.location,
      event.neighborhood,
      event.category,
      event.status,
      event.ticketTypes.length,
      event.totalTicketsSold,
      event.totalRevenueXOF,
      event.scannerDoorCode,
    ]),
    kpis: [
      { label: 'Eventos', value: String(filteredEvents.length) },
      { label: 'Ativos', value: String(filteredEvents.filter((event) => event.status === 'active').length) },
      { label: 'Bilhetes vendidos', value: String(filteredEvents.reduce((sum, event) => sum + event.totalTicketsSold, 0)) },
      { label: 'Receita', value: `${filteredEvents.reduce((sum, event) => sum + event.totalRevenueXOF, 0).toLocaleString('pt-PT')} XOF` },
    ],
  };

  const ticketTypeRows: ExportRow[] = filteredEvents.flatMap((event) => event.ticketTypes.map((ticketType) => [
    event.title,
    event.date,
    ticketType.name,
    ticketType.priceXOF,
    ticketType.availableQuantity,
    ticketType.soldQuantity,
    ticketType.priceXOF * ticketType.soldQuantity,
  ]));
  const ticketTypesDataset: ExportDataset = {
    key: 'ticket-types',
    group: 'content',
    title: t('business.exportTicketTypesTitle'),
    description: t('business.exportTicketTypesDescription'),
    filename: filename('Tipos_de_Bilhete'),
    sheet: t('business.exportTicketTypesTitle'),
    headers: ['Evento', 'Data do evento', 'Tipo de bilhete', 'Preço (XOF)', 'Disponíveis', 'Vendidos', 'Receita estimada (XOF)'],
    rows: ticketTypeRows,
    kpis: [
      { label: 'Tipos de bilhete', value: String(ticketTypeRows.length) },
      { label: 'Bilhetes vendidos', value: String(filteredEvents.reduce((sum, event) => sum + event.totalTicketsSold, 0)) },
      { label: 'Receita', value: `${filteredEvents.reduce((sum, event) => sum + event.totalRevenueXOF, 0).toLocaleString('pt-PT')} XOF` },
    ],
  };

  const teamDataset: ExportDataset = {
    key: 'team',
    group: 'team',
    title: t('business.exportTeamTitle'),
    description: t('business.exportTeamDescription'),
    filename: filename('Equipa'),
    sheet: t('business.exportTeamTitle'),
    headers: ['Nome', 'Email', 'Telefone', 'Função', 'Estado', 'Permissões', 'Convidado em', 'Última atividade'],
    rows: filteredTeam.map((member) => [
      member.name,
      member.email,
      member.phone || '—',
      member.role,
      member.status,
      permissionText(member.permissions),
      formatDateValue(member.createdAt),
      member.lastActiveAt ? formatDateValue(member.lastActiveAt) : '—',
    ]),
    kpis: [
      { label: 'Membros', value: String(filteredTeam.length) },
      { label: 'Ativos', value: String(filteredTeam.filter((member) => member.status === 'active').length) },
      { label: 'Convidados', value: String(filteredTeam.filter((member) => member.status === 'invited').length) },
      { label: 'Suspensos', value: String(filteredTeam.filter((member) => member.status === 'suspended').length) },
    ],
  };

  const metricsDataset: ExportDataset = {
    key: 'metrics',
    group: 'company',
    title: t('business.exportMetricsTitle'),
    description: t('business.exportMetricsDescription', { views: business.metrics.views, clicks: business.metrics.whatsappClicks }),
    filename: filename('Metricas'),
    sheet: t('business.exportMetricSheet'),
    headers: [
      t('business.exportMetricColMetric'),
      t('business.exportMetricColValue'),
      t('business.exportMetricColUnit'),
      t('business.exportMetricColChannel'),
    ],
    rows: [
      [t('business.exportMetricViews'), business.metrics.views, t('business.exportMetricUnitVisits'), t('business.exportMetricChannelDirectory')],
      [t('business.exportMetricWhatsapp'), business.metrics.whatsappClicks, t('business.exportMetricUnitLeads'), t('business.exportMetricChannelDirect')],
      [t('business.exportMetricCalls'), business.metrics.phoneClicks, t('business.exportMetricUnitCalls'), t('business.exportMetricChannelVoice')],
      [t('business.exportMetricDirections'), business.metrics.directionsClicks, t('business.exportMetricUnitVisitsPhysical'), t('business.exportMetricChannelGps')],
      ['Cliques no website', business.metrics.websiteClicks || 0, 'Visitas', 'Website'],
      ['Seguidores', followerCount, 'Seguidores', 'Guigui'],
      ['Alcance da audiência', audienceReach, 'Pessoas', 'Guigui'],
      [t('business.exportMetricPosts'), business.posts.length, t('business.exportMetricUnitPosts'), t('business.exportMetricChannelFeed')],
      [t('business.exportMetricPromos'), business.promotions.length, t('business.exportMetricUnitOffers'), t('business.exportMetricChannelPromos')],
      [t('business.exportMetricReviews'), business.reviews.length, t('business.exportMetricUnitComments'), `${t('business.exportMetricNote')}${business.rating || 5.0}`],
    ],
    kpis: [
      { label: t('business.exportMetricPdfViews'), value: business.metrics.views.toLocaleString('pt-PT') },
      { label: t('business.exportMetricPdfWhatsapp'), value: String(business.metrics.whatsappClicks) },
      { label: t('business.exportMetricPdfCalls'), value: String(business.metrics.phoneClicks) },
      { label: t('business.exportMetricPdfRoutes'), value: String(business.metrics.directionsClicks) },
    ],
  };

  const subscriptionPlan = business.subscriptionPlanSnapshot;
  const subscriptionUsage = business.subscriptionUsage;
  const monetizationWallet = business.monetizationWallet;
  const subscriptionDataset: ExportDataset = {
    key: 'subscription',
    group: 'company',
    title: 'Subscrição, limites e carteira',
    description: 'Plano contratado, período de renovação, quotas utilizadas, extras e carteira de monetização da empresa.',
    filename: filename('Subscricao'),
    sheet: 'Subscrição e limites',
    headers: ['Campo', 'Valor'],
    rows: [
      ['Plano atual', business.planName || business.tier],
      ['ID do plano', business.planId || '—'],
      ['Versão do plano', business.subscriptionPlanVersion ?? '—'],
      ['Preço do plano', subscriptionPlan ? `${subscriptionPlan.price.toLocaleString('pt-PT')} ${subscriptionPlan.currency}` : '—'],
      ['Periodicidade de cobrança', subscriptionPlan?.billingPeriod || business.subscriptionPeriod || '—'],
      ['Estado da subscrição', business.subscriptionStatus || '—'],
      ['Início da subscrição', formatDateValue(business.subscriptionStartedAt)],
      ['Próxima renovação', formatDateValue(business.subscriptionRenewDate)],
      ['Pagamento associado', business.subscriptionPaymentId || '—'],
      ['Suspensa em', formatDateValue(business.subscriptionSuspendedAt)],
      ['Motivo da suspensão', business.subscriptionSuspensionReason || '—'],
      ['Suspensão automática', business.subscriptionAutoSuspended ? 'Sim' : 'Não'],
      ['Período de uso', subscriptionUsage?.periodKey || '—'],
      ['Publicações usadas no período', subscriptionUsage?.postsUsed ?? 0],
      ['Promoções usadas no período', subscriptionUsage?.promotionsUsed ?? 0],
      ['Eventos usados no período', subscriptionUsage?.eventsUsed ?? 0],
      ['Imagens usadas no período', subscriptionUsage?.imagesUsed ?? 0],
      ['Campanhas usadas no período', subscriptionUsage?.campaignsUsed ?? 0],
      ['Publicações extra compradas', monetizationWallet?.postsExtraPurchased ?? 0],
      ['Publicações extra usadas', monetizationWallet?.postsExtraUsed ?? 0],
      ['Promoções extra compradas', monetizationWallet?.promotionsExtraPurchased ?? 0],
      ['Promoções extra usadas', monetizationWallet?.promotionsExtraUsed ?? 0],
      ['Carteira atualizada em', formatDateValue(monetizationWallet?.updatedAt)],
      ['Quota de publicações restante', business.postsQuotaRemaining],
      ['Funcionalidades do plano', (subscriptionPlan?.featureSlugs || business.features || []).join(', ') || '—'],
      ['Limites do plano', subscriptionPlan ? Object.entries(subscriptionPlan.limits).map(([key, value]) => `${key}: ${value}`).join(' | ') : '—'],
    ],
    kpis: [
      { label: 'Plano', value: business.planName || business.tier },
      { label: 'Estado', value: business.subscriptionStatus || '—' },
      { label: 'Renovação', value: formatDateValue(business.subscriptionRenewDate) },
      { label: 'Posts restantes', value: String(business.postsQuotaRemaining) },
    ],
  };

  const subscriptionPaymentDate = business.subscriptionStartedAt || business.subscriptionRenewDate;
  const includeSubscriptionPayment = Boolean(business.subscriptionPaymentId) && withinPeriod(subscriptionPaymentDate, exportCutoff);
  const subscriptionPaymentAmount = subscriptionPlan?.price || 0;
  const paymentRows: ExportRow[] = [
    ...(includeSubscriptionPayment ? [[
      formatDateValue(subscriptionPaymentDate),
      `Subscrição ${business.planName || business.tier}`,
      business.subscriptionPaymentId,
      subscriptionPaymentAmount,
      'Confirmado',
      'Subscrição',
    ] as ExportRow] : []),
    ...filteredOrders.map((order) => [
      formatDateValue(order.purchasedAt),
      order.itemTitle,
      order.orderCode || order.id,
      order.totalPriceXOF,
      order.status === 'cancelled' ? 'Cancelado' : order.status === 'pending' ? 'Pendente' : 'Pago',
      order.itemType,
    ] as ExportRow),
  ];
  const paymentsDataset: ExportDataset = {
    key: 'payments',
    group: 'company',
    title: 'Pagamentos e recibos',
    description: 'Comprovativos da subscrição e dos pedidos da empresa, com referência, valor e estado do pagamento.',
    filename: filename('Pagamentos_Recibos'),
    sheet: 'Pagamentos e recibos',
    headers: ['Data', 'Descrição', 'Referência', 'Valor (XOF)', 'Estado', 'Tipo'],
    rows: paymentRows,
    kpis: [
      { label: 'Comprovativos', value: String(paymentRows.length) },
      { label: 'Valor total', value: `${(filteredOrders.reduce((sum, order) => sum + order.totalPriceXOF, 0) + (includeSubscriptionPayment ? subscriptionPaymentAmount : 0)).toLocaleString('pt-PT')} XOF` },
      { label: 'Pendentes', value: String(filteredOrders.filter((order) => order.status === 'pending').length) },
      { label: 'Subscrição', value: business.subscriptionPaymentId ? 'Registada' : 'Sem pagamento' },
    ],
  };

  const customersDataset: ExportDataset = {
    key: 'customers',
    group: 'sales',
    title: 'Clientes e histórico de compras',
    description: 'Compradores agregados a partir dos pedidos filtrados, com valor total, frequência e última compra.',
    filename: filename('Clientes'),
    sheet: 'Clientes',
    headers: ['Cliente', 'Telemóvel', 'Pedidos', 'Total (XOF)', 'Primeira compra', 'Última compra', 'Tipos de compra', 'Pedidos pendentes', 'Pedidos resgatados', 'Ticket médio (XOF)'],
    rows: customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.orders,
      customer.totalXOF,
      formatDateValue(customer.firstPurchase),
      formatDateValue(customer.lastPurchase),
      Array.from(customer.types).join(', ').toUpperCase(),
      customer.pending,
      customer.redeemed,
      Math.round(customer.totalXOF / Math.max(customer.orders, 1)),
    ]),
    kpis: [
      { label: 'Clientes', value: String(customers.length) },
      { label: 'Recorrentes', value: String(customers.filter((customer) => customer.orders > 1).length) },
      { label: 'Valor total', value: `${customers.reduce((sum, customer) => sum + customer.totalXOF, 0).toLocaleString('pt-PT')} XOF` },
      { label: 'Ticket médio', value: `${Math.round(customers.reduce((sum, customer) => sum + customer.totalXOF, 0) / Math.max(customers.reduce((sum, customer) => sum + customer.orders, 0), 1)).toLocaleString('pt-PT')} XOF` },
    ],
  };

  const issuedTicketsDataset: ExportDataset = {
    key: 'issued-tickets',
    group: 'sales',
    title: 'Bilhetes emitidos',
    description: 'Lista nominal dos bilhetes emitidos nos pedidos filtrados. Não inclui tokens QR nem PIN de segurança.',
    filename: filename('Bilhetes_Emitidos'),
    sheet: 'Bilhetes emitidos',
    headers: ['Pedido', 'Evento / item', 'Código do bilhete', 'Titular', 'Telemóvel', 'Tipo de bilhete', 'Estado', 'Comprado em', 'Valor do pedido (XOF)'],
    rows: issuedTickets.map((ticket) => [
      ticket.orderCode,
      ticket.event,
      ticket.ticketCode,
      ticket.holder,
      ticket.phone,
      ticket.type,
      ticket.status,
      formatDateValue(ticket.purchasedAt),
      ticket.amountXOF,
    ]),
    kpis: [
      { label: 'Bilhetes', value: String(issuedTickets.length) },
      { label: 'Válidos', value: String(issuedTickets.filter((ticket) => ticket.status === 'valid').length) },
      { label: 'Utilizados', value: String(issuedTickets.filter((ticket) => ticket.status === 'used').length) },
      { label: 'Pendentes', value: String(issuedTickets.filter((ticket) => ticket.status === 'pending').length) },
    ],
  };

  const campaignNameById = new Map(myCampaigns.map((campaign) => [campaign.id, campaign.name]));
  const segmentNameById = new Map(mySegments.map((segment) => [segment.id, segment.name]));
  const campaignsDataset: ExportDataset = {
    key: 'campaigns',
    group: 'marketing',
    title: 'Campanhas de marketing',
    description: 'Campanhas da empresa com objetivo, canais, orçamento, gasto e audiência associada.',
    filename: filename('Campanhas'),
    sheet: 'Campanhas',
    headers: ['ID', 'Nome', 'Objetivo', 'Estado', 'Canais', 'Audiência', 'Conteúdos', 'Orçamento (XOF)', 'Gasto (XOF)', 'Restante (XOF)', 'Início', 'Fim', 'Criada em', 'Atualizada em'],
    rows: filteredCampaigns.map((campaign) => [
      campaign.id,
      campaign.name,
      CAMPAIGN_OBJECTIVE_LABELS[campaign.objective || ''] || campaign.objective || '—',
      campaign.status,
      campaign.channels.map((channel) => CAMPAIGN_CHANNEL_LABELS[channel] || channel).join(', '),
      segmentNameById.get(campaign.audienceSegmentId || '') || '—',
      campaign.contentIds.length,
      campaign.budgetXOF ?? 0,
      campaign.spentXOF ?? 0,
      Math.max((campaign.budgetXOF ?? 0) - (campaign.spentXOF ?? 0), 0),
      formatDateValue(campaign.startsAt),
      formatDateValue(campaign.endsAt),
      formatDateValue(campaign.createdAt),
      formatDateValue(campaign.updatedAt),
    ]),
    kpis: [
      { label: 'Campanhas', value: String(filteredCampaigns.length) },
      { label: 'Ativas', value: String(filteredCampaigns.filter((campaign) => campaign.status === 'active').length) },
      { label: 'Orçamento', value: `${filteredCampaigns.reduce((sum, campaign) => sum + (campaign.budgetXOF || 0), 0).toLocaleString('pt-PT')} XOF` },
      { label: 'Gasto', value: `${filteredCampaigns.reduce((sum, campaign) => sum + (campaign.spentXOF || 0), 0).toLocaleString('pt-PT')} XOF` },
    ],
  };

  const segmentsDataset: ExportDataset = {
    key: 'audiences',
    group: 'marketing',
    title: 'Audiências e segmentos',
    description: 'Segmentos de audiência criados pela empresa, com localização, idades, interesses e alcance estimado.',
    filename: filename('Audiencias'),
    sheet: 'Audiências',
    headers: ['ID', 'Nome', 'Localização', 'Idade mínima', 'Idade máxima', 'Interesses', 'Alcance estimado', 'Criada em'],
    rows: filteredSegments.map((segment) => [
      segment.id,
      segment.name,
      segment.location || '—',
      segment.minAge ?? '—',
      segment.maxAge ?? '—',
      segment.interests.join(', ') || '—',
      segment.estimatedReach ?? 0,
      formatDateValue(segment.createdAt),
    ]),
    kpis: [
      { label: 'Segmentos', value: String(filteredSegments.length) },
      { label: 'Alcance estimado', value: String(filteredSegments.reduce((sum, segment) => sum + (segment.estimatedReach || 0), 0)) },
      { label: 'Localizações', value: String(new Set(filteredSegments.map((segment) => segment.location).filter(Boolean)).size) },
    ],
  };

  const assetsDataset: ExportDataset = {
    key: 'assets',
    group: 'marketing',
    title: 'Ficheiros de marketing',
    description: 'Imagens, vídeos, banners e logótipos usados nos conteúdos e campanhas da empresa.',
    filename: filename('Ficheiros_Marketing'),
    sheet: 'Ficheiros de marketing',
    headers: ['ID', 'Nome', 'Tipo', 'URL', 'Origem', 'Utilizado em', 'Criado em', 'Arquivado'],
    rows: filteredAssets.map((asset) => [
      asset.id,
      asset.name,
      asset.type,
      asset.url,
      asset.sourceId || '—',
      asset.usedBy.map((id) => campaignNameById.get(id) || id).join(' | ') || '—',
      formatDateValue(asset.createdAt),
      asset.archived ? 'Sim' : 'Não',
    ]),
    kpis: [
      { label: 'Ficheiros', value: String(filteredAssets.length) },
      { label: 'Imagens/banners', value: String(filteredAssets.filter((asset) => asset.type === 'image' || asset.type === 'banner').length) },
      { label: 'Vídeos', value: String(filteredAssets.filter((asset) => asset.type === 'video').length) },
      { label: 'Arquivados', value: String(filteredAssets.filter((asset) => asset.archived).length) },
    ],
  };

  const scheduledDataset: ExportDataset = {
    key: 'scheduled',
    group: 'marketing',
    title: 'Conteúdo agendado',
    description: 'Publicações, promoções e campanhas agendadas, com estado de publicação e eventuais erros.',
    filename: filename('Agendamentos'),
    sheet: 'Conteúdo agendado',
    headers: ['Tipo', 'Referência', 'Descrição', 'Agendado para', 'Termina em', 'Estado', 'Tentativas', 'Publicado em', 'Pagamento', 'Erro'],
    rows: filteredScheduled.map((item) => [
      item.itemType,
      item.label || item.itemId,
      item.description || '—',
      formatDateValue(item.scheduledAt),
      formatDateValue(item.endsAt),
      item.status,
      item.attempts,
      formatDateValue(item.publishedAt),
      item.paymentStatus || '—',
      item.errorMessage || '—',
    ]),
    kpis: [
      { label: 'Agendamentos', value: String(filteredScheduled.length) },
      { label: 'Agendados', value: String(filteredScheduled.filter((item) => item.status === 'scheduled').length) },
      { label: 'Publicados', value: String(filteredScheduled.filter((item) => item.status === 'published').length) },
      { label: 'Falhas', value: String(filteredScheduled.filter((item) => item.status === 'failed').length) },
    ],
  };

  const storiesDataset: ExportDataset = {
    key: 'stories',
    group: 'marketing',
    title: 'Stories da empresa',
    description: 'Stories ativas, arquivadas e rascunhos, com métricas de visualizações, reações e respostas.',
    filename: filename('Stories'),
    sheet: 'Stories',
    headers: ['ID', 'Tipo', 'Legenda', 'Estado', 'Visibilidade', 'Moderação', 'Criada em', 'Publicada em', 'Expira em', 'Views', 'Views únicas', 'Gostos', 'Reações', 'Respostas', 'Partilhas', 'Engagement (%)'],
    rows: filteredStories.map((story) => [
      story.id,
      story.storyType,
      story.caption || '—',
      story.status,
      story.visibility,
      story.moderationStatus,
      formatDateValue(story.createdAt),
      formatDateValue(story.publishedAt),
      formatDateValue(story.expiresAt),
      story.counts?.views ?? 0,
      story.counts?.uniqueViews ?? 0,
      story.counts?.likes ?? 0,
      story.counts?.reactions ?? 0,
      story.counts?.replies ?? 0,
      story.counts?.shares ?? 0,
      story.counts?.engagementRate ?? 0,
    ]),
    kpis: [
      { label: 'Stories', value: String(filteredStories.length) },
      { label: 'Ativas', value: String(filteredStories.filter((story) => story.status === 'active').length) },
      { label: 'Visualizações', value: String(filteredStories.reduce((sum, story) => sum + (story.counts?.views || 0), 0)) },
      { label: 'Gostos', value: String(filteredStories.reduce((sum, story) => sum + (story.counts?.likes || 0), 0)) },
    ],
  };

  const conversationsDataset: ExportDataset = {
    key: 'conversations',
    group: 'communication',
    title: 'Conversas com clientes',
    description: 'Conversas da empresa com clientes, incluindo estado de leitura, mensagens e última interação.',
    filename: filename('Conversas'),
    sheet: 'Conversas',
    headers: ['ID', 'Assunto', 'Participante', 'Tipo de participante', 'Mensagens', 'Não lidas', 'Fixada', 'Última mensagem', 'Criada em', 'Atualizada em'],
    rows: filteredConversations.map((conversation) => [
      conversation.id,
      conversation.subject,
      conversation.userName || conversation.userId,
      conversation.participantType || 'person',
      myMessages.filter((message) => message.conversationId === conversation.id).length,
      conversation.unreadForBusiness ? 'Sim' : 'Não',
      conversation.pinned ? 'Sim' : 'Não',
      conversation.lastMessage || '—',
      formatDateValue(conversation.createdAt),
      formatDateValue(conversation.updatedAt),
    ]),
    kpis: [
      { label: 'Conversas', value: String(filteredConversations.length) },
      { label: 'Não lidas', value: String(filteredConversations.filter((conversation) => conversation.unreadForBusiness).length) },
      { label: 'Fixadas', value: String(filteredConversations.filter((conversation) => conversation.pinned).length) },
      { label: 'Mensagens', value: String(filteredMessages.length) },
    ],
  };

  const messagesDataset: ExportDataset = {
    key: 'messages',
    group: 'communication',
    title: 'Mensagens das conversas',
    description: 'Mensagens trocadas nas conversas da empresa, com remetente, tipo, anexos e estado de leitura.',
    filename: filename('Mensagens'),
    sheet: 'Mensagens',
    headers: ['Conversa', 'Remetente', 'Perfil', 'Tipo', 'Mensagem', 'Anexo', 'Conteúdo partilhado', 'Estado', 'Enviada em', 'Lida pelo utilizador', 'Lida pela empresa'],
    rows: filteredMessages.map((message) => [
      conversationById.get(message.conversationId)?.subject || message.conversationId,
      message.senderName || message.senderId,
      message.senderRole,
      message.type || 'text',
      message.text,
      message.attachmentName || '—',
      message.sharedContent ? `${message.sharedContent.kind}: ${message.sharedContent.title}` : '—',
      message.status || 'sent',
      formatDateValue(message.createdAt),
      message.readByUser ? 'Sim' : 'Não',
      message.readByBusiness ? 'Sim' : 'Não',
    ]),
    kpis: [
      { label: 'Mensagens', value: String(filteredMessages.length) },
      { label: 'Enviadas pela empresa', value: String(filteredMessages.filter((message) => message.senderRole === 'business').length) },
      { label: 'Enviadas por clientes', value: String(filteredMessages.filter((message) => message.senderRole === 'user').length) },
      { label: 'Com anexo', value: String(filteredMessages.filter((message) => Boolean(message.attachmentName)).length) },
    ],
  };

  const supportDataset: ExportDataset = {
    key: 'support',
    group: 'communication',
    title: 'Pedidos de suporte',
    description: 'Pedidos de apoio enviados pela empresa, com categoria, estado, resposta mais recente e histórico.',
    filename: filename('Suporte'),
    sheet: 'Suporte',
    headers: ['ID', 'Assunto', 'Categoria', 'Estado', 'Descrição', 'Última resposta', 'Respostas', 'Criado em', 'Atualizado em'],
    rows: filteredSupport.map((request) => [
      request.id,
      request.subject,
      request.category || 'other',
      request.status,
      request.description,
      request.lastReply || '—',
      request.replies?.length || 0,
      formatDateValue(request.createdAt),
      formatDateValue(request.updatedAt),
    ]),
    kpis: [
      { label: 'Pedidos', value: String(filteredSupport.length) },
      { label: 'Abertos', value: String(filteredSupport.filter((request) => request.status === 'open').length) },
      { label: 'Em curso', value: String(filteredSupport.filter((request) => request.status === 'in_progress').length) },
      { label: 'Resolvidos', value: String(filteredSupport.filter((request) => request.status === 'resolved').length) },
    ],
  };

  const auditDataset: ExportDataset = {
    key: 'team-audit',
    group: 'team',
    title: 'Auditoria da equipa',
    description: 'Histórico de convites, alterações de acesso e remoções de membros da equipa.',
    filename: filename('Auditoria_Equipa'),
    sheet: 'Auditoria da equipa',
    headers: ['Membro', 'Ação', 'Data'],
    rows: filteredAudit.map((entry) => [entry.memberName, entry.action, formatDateValue(entry.createdAt)]),
    kpis: [
      { label: 'Registos', value: String(filteredAudit.length) },
      { label: 'Membros envolvidos', value: String(new Set(filteredAudit.map((entry) => entry.memberName)).size) },
    ],
  };

  const notificationsDataset: ExportDataset = {
    key: 'notifications',
    group: 'team',
    title: 'Notificações da empresa',
    description: 'Notificações operacionais recebidas pela empresa, com categoria, prioridade e estado de leitura.',
    filename: filename('Notificacoes'),
    sheet: 'Notificações',
    headers: ['Título', 'Mensagem', 'Categoria', 'Prioridade', 'Estado', 'Evento', 'Entidade', 'Link', 'Criada em'],
    rows: filteredNotifications.map((notification) => [
      notification.title,
      notification.message,
      notification.category,
      notification.priority || 'normal',
      notification.read ? 'Lida' : 'Não lida',
      notification.eventType || '—',
      notification.entityId ? `${notification.entityType || 'entidade'}: ${notification.entityId}` : '—',
      notification.linkTab || '—',
      formatDateValue(notification.createdAt),
    ]),
    kpis: [
      { label: 'Notificações', value: String(filteredNotifications.length) },
      { label: 'Não lidas', value: String(filteredNotifications.filter((notification) => !notification.read).length) },
      { label: 'Alta prioridade', value: String(filteredNotifications.filter((notification) => notification.priority === 'high' || notification.priority === 'urgent').length) },
    ],
  };

  const datasets: Array<{ dataset: ExportDataset; icon: React.ReactNode; accent: string }> = [
    { dataset: profileDataset, icon: <Building2 className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-700' },
    { dataset: subscriptionDataset, icon: <Wallet className="h-5 w-5" />, accent: 'bg-lime-50 text-lime-700' },
    { dataset: metricsDataset, icon: <Eye className="h-5 w-5" />, accent: 'bg-slate-100 text-slate-700' },
    { dataset: paymentsDataset, icon: <ClipboardList className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-700' },
    { dataset: ordersDataset, icon: <ShoppingBag className="h-5 w-5" />, accent: 'bg-teal-50 text-teal-700' },
    { dataset: customersDataset, icon: <Users className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-700' },
    { dataset: issuedTicketsDataset, icon: <Ticket className="h-5 w-5" />, accent: 'bg-teal-50 text-teal-700' },
    { dataset: catalogDataset, icon: <Package className="h-5 w-5" />, accent: 'bg-violet-50 text-violet-700' },
    { dataset: postsDataset, icon: <FileText className="h-5 w-5" />, accent: 'bg-blue-50 text-blue-700' },
    { dataset: promotionsDataset, icon: <Tag className="h-5 w-5" />, accent: 'bg-amber-50 text-amber-700' },
    { dataset: reviewsDataset, icon: <Star className="h-5 w-5" />, accent: 'bg-orange-50 text-orange-700' },
    { dataset: eventsDataset, icon: <Calendar className="h-5 w-5" />, accent: 'bg-cyan-50 text-cyan-700' },
    { dataset: ticketTypesDataset, icon: <Ticket className="h-5 w-5" />, accent: 'bg-indigo-50 text-indigo-700' },
    { dataset: campaignsDataset, icon: <Megaphone className="h-5 w-5" />, accent: 'bg-fuchsia-50 text-fuchsia-700' },
    { dataset: segmentsDataset, icon: <Users className="h-5 w-5" />, accent: 'bg-purple-50 text-purple-700' },
    { dataset: assetsDataset, icon: <ImageIcon className="h-5 w-5" />, accent: 'bg-pink-50 text-pink-700' },
    { dataset: scheduledDataset, icon: <Calendar className="h-5 w-5" />, accent: 'bg-blue-50 text-blue-700' },
    { dataset: storiesDataset, icon: <ImageIcon className="h-5 w-5" />, accent: 'bg-rose-50 text-rose-700' },
    { dataset: conversationsDataset, icon: <MessageCircle className="h-5 w-5" />, accent: 'bg-sky-50 text-sky-700' },
    { dataset: messagesDataset, icon: <Send className="h-5 w-5" />, accent: 'bg-cyan-50 text-cyan-700' },
    { dataset: supportDataset, icon: <Headphones className="h-5 w-5" />, accent: 'bg-indigo-50 text-indigo-700' },
    { dataset: teamDataset, icon: <Users className="h-5 w-5" />, accent: 'bg-rose-50 text-rose-700' },
    { dataset: auditDataset, icon: <Activity className="h-5 w-5" />, accent: 'bg-slate-100 text-slate-700' },
    { dataset: notificationsDataset, icon: <Bell className="h-5 w-5" />, accent: 'bg-amber-50 text-amber-700' },
  ];
  const totalRecords = datasets.reduce((sum, { dataset }) => sum + dataset.rows.length, 0);

  const [history, setHistory] = useState<ExportHistoryEntry[]>(() => readExportHistory(business.id));

  useEffect(() => {
    setHistory(readExportHistory(business.id));
    const refresh = () => setHistory(readExportHistory(business.id));
    window.addEventListener('guigui:export-history', refresh);
    return () => window.removeEventListener('guigui:export-history', refresh);
  }, [business.id]);

  const logExport = (fileName: string, category: string, format: ExportFormat, records: number) => {
    recordExportHistory(business.id, {
      fileName,
      category,
      format: format === 'excel' ? 'xlsx' : format,
      records,
      actor: currentUser?.name || currentUser?.email || business.name,
      status: 'completed',
      detail: `${timeframeLabel} · ${category}`,
    });
  };

  const exportDataset = (dataset: ExportDataset, format: ExportFormat) => {
    logExport(`${dataset.filename}.${format === 'excel' ? 'xlsx' : format}`, dataset.group, format, dataset.rows.length);
    if (format === 'pdf') {
      downloadPDFReport(
        dataset.title,
        `${business.name} · ${dataset.description}`,
        dataset.kpis,
        dataset.headers,
        dataset.rows,
      );
    } else if (format === 'excel') {
      downloadExcel(dataset.filename, dataset.sheet, dataset.headers, dataset.rows);
    } else {
      downloadCSV(dataset.filename, dataset.headers, dataset.rows);
    }
  };

  const downloadAll = () => {
    logExport(`Guigui_Dados_Empresa_${businessSlug}_${dateStamp}.xlsx`, 'Todos os conjuntos', 'excel', totalRecords);
    downloadExcelWorkbook(
      `Guigui_Dados_Empresa_${businessSlug}_${dateStamp}`,
      datasets.map(({ dataset }) => ({
        title: dataset.sheet,
        headers: dataset.headers,
        rows: dataset.rows,
      })),
    );
  };

  const resetFilters = () => {
    setExportTimeframe('30days');
    setQuery('');
    setOrderStatus('all');
    setOrderType('all');
    setPostStatus('all');
    setPromotionStatus('all');
    setReviewStatus('all');
    setEventStatus('all');
    setTeamStatus('all');
    setCatalogAvailability('all');
    setCustomerType('all');
    setTicketCredentialStatus('all');
    setCampaignStatus('all');
    setAssetType('all');
    setScheduledStatus('all');
    setStoryStatus('all');
    setConversationState('all');
    setSupportStatus('all');
    setSupportCategory('all');
    setNotificationRead('all');
  };

  const filteredMarketplaceOrders = myOrders.filter((order) => order.itemType === 'product' || order.itemType === 'service');
  const filteredTicketOrders = myOrders.filter((order) => order.itemType === 'ticket' || order.itemType === 'promotion');

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel dark:bg-slate-800 shadow-[var(--shadow-xs)] space-y-2 p-3.5 sm:p-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <Download className="h-3.5 w-3.5" />
          <span>{t('businessDataExport')}</span>
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white">{t('organizedReports')}</h3>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {t('business.exportHubIntroBefore')} <strong>{business.name}</strong>{t('business.exportHubIntroAfter')}
        </p>
      </div>

      <section className="space-y-3 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel p-4 shadow-[var(--shadow-xs)] dark:bg-slate-800 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">{t('business.exportFiltersTitle')}</h4>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{t('business.exportFiltersHint')}</p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-700 transition hover:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            {t('business.exportResetFilters')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('business.periodoRelatorio')}</span>
            <select value={exportTimeframe} onChange={(event) => setExportTimeframe(event.target.value as typeof exportTimeframe)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-black text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              <option value="30days">{t('business.UltimosDias2')}</option>
              <option value="90days">{t('business.UltimosDias90')}</option>
              <option value="year">{t('business.AnoCorrente')}</option>
              <option value="all">{t('business.TodoHistorico')}</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('business.exportSearchLabel')}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('business.exportSearchPlaceholder')}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <div className="flex items-end">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[9px] font-black text-emerald-800">
              {timeframeLabel}
            </span>
          </div>
          <FilterSelect label={t('business.exportOrderStatusFilter')} value={orderStatus} onChange={setOrderStatus} options={ORDER_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label={t('business.exportOrderTypeFilter')} value={orderType} onChange={setOrderType} options={ORDER_TYPE_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label={t('business.exportPostStatusFilter')} value={postStatus} onChange={setPostStatus} options={POST_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label={t('business.exportPromotionStatusFilter')} value={promotionStatus} onChange={setPromotionStatus} options={[{ value: 'active', label: 'Ativas' }, { value: 'inactive', label: 'Inativas' }]} allLabel={t('business.Todos')} />
          <FilterSelect label={t('business.exportReviewStatusFilter')} value={reviewStatus} onChange={setReviewStatus} options={REVIEW_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label={t('business.exportEventStatusFilter')} value={eventStatus} onChange={setEventStatus} options={EVENT_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label={t('business.exportTeamStatusFilter')} value={teamStatus} onChange={setTeamStatus} options={TEAM_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label={t('business.exportCatalogAvailabilityFilter')} value={catalogAvailability} onChange={setCatalogAvailability} options={[{ value: 'available', label: t('business.exportCatalogAvailable') }, { value: 'unavailable', label: t('business.exportCatalogSoldOut') }]} allLabel={t('business.Todos')} />
          <FilterSelect label="Tipo de cliente" value={customerType} onChange={setCustomerType} options={CUSTOMER_TYPE_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Estado do bilhete" value={ticketCredentialStatus} onChange={setTicketCredentialStatus} options={TICKET_CREDENTIAL_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Estado da campanha" value={campaignStatus} onChange={setCampaignStatus} options={CAMPAIGN_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Tipo de ficheiro" value={assetType} onChange={setAssetType} options={ASSET_TYPE_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Estado do agendamento" value={scheduledStatus} onChange={setScheduledStatus} options={SCHEDULED_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Estado da story" value={storyStatus} onChange={setStoryStatus} options={STORY_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Estado da conversa" value={conversationState} onChange={setConversationState} options={CONVERSATION_STATE_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Estado do suporte" value={supportStatus} onChange={setSupportStatus} options={SUPPORT_STATUS_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Categoria do suporte" value={supportCategory} onChange={setSupportCategory} options={SUPPORT_CATEGORY_OPTIONS} allLabel={t('business.Todos')} />
          <FilterSelect label="Estado da notificação" value={notificationRead} onChange={setNotificationRead} options={NOTIFICATION_READ_OPTIONS} allLabel={t('business.Todos')} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
          <p className="text-[10px] font-bold text-emerald-900">
            {t('business.exportRecords', { count: totalRecords })}
          </p>
          <button
            type="button"
            onClick={downloadAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-[10px] font-black text-white transition hover:bg-emerald-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t('business.exportFullWorkbook')}
          </button>
        </div>
        <p className="text-[9px] text-slate-500 dark:text-slate-400">{t('business.exportFullWorkbookHint')}</p>
      </section>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm sm:grid-cols-4 sm:p-5 dark:border-slate-700">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-300">{t('business.PedidosNoAmbito')}</p>
          <p className="mt-1 text-sm font-black">{filteredOrders.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{t('business.VolumeNoAmbito')}</p>
          <p className="mt-1 text-sm font-black">{filteredOrders.reduce((total, order) => total + order.totalPriceXOF, 0).toLocaleString('pt-PT')} XOF</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Registos no âmbito</p>
          <p className="mt-1 text-sm font-black">{totalRecords} registos · {datasets.filter(({ dataset }) => dataset.rows.length > 0).length}/{datasets.length} relatórios</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">{t('business.exportCompanyLabel')}</p>
          <p className="mt-1 truncate text-sm font-black">{business.name}</p>
        </div>
      </div>

      <div className="space-y-5">
        {DATASET_GROUPS.map((group) => {
          const groupDatasets = datasets.filter(({ dataset }) => dataset.group === group.id);
          if (groupDatasets.length === 0) return null;
          const groupRecords = groupDatasets.reduce((sum, { dataset }) => sum + dataset.rows.length, 0);
          return (
            <section key={group.id} className="space-y-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-2">
                <div>
                  <h4 className="text-sm font-black text-[var(--color-text-strong)]">{group.label}</h4>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{group.hint}</p>
                </div>
                <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[9px] font-black text-[var(--color-text-muted)]">
                  {groupDatasets.length} relatório(s) · {groupRecords} registo(s)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groupDatasets.map(({ dataset, icon, accent }) => (
                  <section key={dataset.key} className="flex flex-col justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-xs)] transition hover:border-[var(--color-border-strong)] dark:bg-slate-800">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold ${accent}`}>{icon}</div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          {dataset.rows.length} registo(s)
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{dataset.title}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-300">{dataset.description}</p>
                      </div>
                      {dataset.rows.length === 0 && (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-800">
                          {t('business.exportEmpty')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                      <div className="grid grid-cols-3 gap-1.5">
                        <ExportButton format="pdf" disabled={dataset.rows.length === 0} onClick={() => exportDataset(dataset, 'pdf')} label="PDF" />
                        <ExportButton format="excel" disabled={dataset.rows.length === 0} onClick={() => exportDataset(dataset, 'excel')} label="Excel" />
                        <ExportButton format="csv" disabled={dataset.rows.length === 0} onClick={() => exportDataset(dataset, 'csv')} label="CSV" />
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <strong className="font-black text-slate-900 dark:text-white">Pedidos de catálogo:</strong> {filteredMarketplaceOrders.length} pedido(s) de produtos ou serviços no período filtrado.
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <strong className="font-black text-slate-900 dark:text-white">Bilhetes e promoções:</strong> {filteredTicketOrders.length} pedido(s) de bilhetes ou promoções no período filtrado.
        </div>
      </div>

      <section className="space-y-3 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">Histórico de exportações</h4>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Últimas operações desta empresa neste dispositivo. O acesso fica limitado à conta autenticada.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{history.length} registo(s)</span>
        </div>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[11px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Ainda não foram gerados ficheiros. Escolha um conjunto de dados e um formato para registar a primeira exportação.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[11px]" data-testid="export-history-table">
              <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="p-2">Ficheiro</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2">Formato</th>
                  <th className="p-2">Registos</th>
                  <th className="p-2">Responsável</th>
                  <th className="p-2">Data</th>
                  <th className="p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="p-2 font-black text-slate-900 dark:text-white">{entry.fileName}</td>
                    <td className="p-2 text-slate-600 dark:text-slate-300">{entry.category}</td>
                    <td className="p-2 uppercase text-slate-600 dark:text-slate-300">{entry.format}</td>
                    <td className="p-2 text-slate-600 dark:text-slate-300">{entry.records}</td>
                    <td className="p-2 text-slate-600 dark:text-slate-300">{entry.actor}</td>
                    <td className="p-2 text-slate-600 dark:text-slate-300">{new Date(entry.createdAt).toLocaleString('pt-PT')}</td>
                    <td className="p-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        {entry.status === 'completed' ? 'Concluída' : 'Falhou'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}> = ({ label, value, onChange, options, allLabel }) => (
  <label>
    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-black text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
    >
      <option value="all">{allLabel}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

const ExportButton: React.FC<{
  format: ExportFormat;
  label: string;
  disabled: boolean;
  onClick: () => void;
}> = ({ format, label, disabled, onClick }) => {
  const Icon = format === 'pdf' ? Download : format === 'excel' ? FileSpreadsheet : FileText;
  const tone = format === 'pdf'
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : format === 'excel'
      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
      : 'border border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}>
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
};
