import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CircleUserRound,
  Compass,
  CreditCard,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Tag,
  Ticket,
  Users,
  WalletCards,
} from 'lucide-react';
import type { NavigationGroup, NavigationItem } from '../utils/navigationTypes';

export type CitizenPrimaryModule = 'feed' | 'directory' | 'promotions' | 'events' | 'map' | 'messages' | 'support' | 'account';
export type CitizenAccountModule =
  | 'overview'
  | 'tickets'
  | 'purchases'
  | 'notifications'
  | 'messages'
  | 'support'
  | 'account-data'
  | 'system-settings'
  | 'personal-settings'
  | 'privacy-settings';

export type BusinessModule =
  | 'overview'
  | 'my_business'
  | 'posts'
  | 'promotions'
  | 'events'
  | 'tickets'
  | 'communications'
  | 'clients'
  | 'analytics'
  | 'team'
  | 'billing'
  | 'marketing'
  | 'marketing_campaigns'
  | 'marketing_calendar'
  | 'support'
  | 'settings'
  | 'reviews'
  | 'order_history'
  | 'redemptions'
  | 'export'
  | 'notifications';

export type AdminModule =
  | 'overview'
  | 'businesses'
  | 'events'
  | 'financials'
  | 'moderation'
  | 'users'
  | 'roles'
  | 'admin_staff'
  | 'support'
  | 'reports'
  | 'pricing'
  | 'audit_logs'
  | 'quality_audit'
  | 'categories'
  | 'notifications'
  | 'architecture'
  | 'capabilities'
  | 'profile'
  | 'sobre-nos';

/**
 * Destinos da navegação inferior do cidadão que só existem para sessões activas.
 * O Feed, o Diretório, as Ofertas e a Agenda continuam públicos.
 */
export const CITIZEN_PRIVATE_PRIMARY_MODULES: readonly CitizenPrimaryModule[] = ['messages', 'account'];

export const isCitizenPrimaryModulePrivate = (id: CitizenPrimaryModule): boolean =>
  CITIZEN_PRIVATE_PRIMARY_MODULES.includes(id);

export const CITIZEN_PRIMARY_NAVIGATION: NavigationItem<CitizenPrimaryModule>[] = [
  { id: 'feed', label: 'Feed', icon: Home, mobile: true, desktop: true },
  { id: 'directory', label: 'Diretório', icon: Compass, mobile: true, desktop: true },
  { id: 'promotions', label: 'Ofertas', icon: Tag, mobile: true, desktop: true },
  { id: 'events', label: 'Agenda', icon: CalendarDays, mobile: true, desktop: true },
  { id: 'messages', label: 'Mensagens', icon: MessageCircle, badgeKey: 'unreadMessages', mobile: true, desktop: true },
  { id: 'account', label: 'Conta', icon: CircleUserRound, mobile: true, desktop: true },
];

export const CITIZEN_ACCOUNT_NAVIGATION: NavigationGroup<CitizenAccountModule>[] = [
  {
    id: 'general',
    label: 'Geral',
    items: [
      { id: 'overview', label: 'Minha Conta', icon: WalletCards, help: 'Resumo da conta' },
      { id: 'tickets', label: 'Meus Bilhetes', icon: Ticket, help: 'Bilhetes comprados' },
      { id: 'purchases', label: 'Compras', icon: ShoppingBag, help: 'Histórico de compras' },
    ],
  },
  {
    id: 'service',
    label: 'Atendimento',
    items: [
      { id: 'notifications', label: 'Notificações', icon: Bell, badgeKey: 'unreadNotifications', help: 'Avisos e alertas' },
      { id: 'messages', label: 'Mensagens', icon: MessageCircle, badgeKey: 'unreadMessages', help: 'Conversas' },
      { id: 'support', label: 'Suporte', icon: HelpCircle, badgeKey: 'pendingSupport', help: 'Pedidos de ajuda' },
    ],
  },
  {
    id: 'account',
    label: 'Gestão da conta',
    items: [
      { id: 'account-data', label: 'Dados e conta', icon: CircleUserRound, help: 'Perfil e dados' },
      { id: 'system-settings', label: 'Definições do sistema', icon: Settings, help: 'Tema e idioma' },
      { id: 'personal-settings', label: 'Configurações pessoais', icon: CircleUserRound, help: 'Preferências' },
      { id: 'privacy-settings', label: 'Privacidade', icon: ShieldCheck, help: 'Visibilidade' },
    ],
  },
];

export const BUSINESS_NAVIGATION: NavigationGroup<BusinessModule>[] = [
  {
    id: 'summary',
    label: 'Resumo',
    items: [
      { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard, help: 'Conta e negócio' },
      { id: 'my_business', label: 'Perfil da Empresa', icon: Building2, help: 'Perfil e operações' },
    ],
  },
  {
    id: 'content',
    label: 'Conteúdo',
    items: [
      { id: 'events', label: 'Eventos', icon: CalendarDays, help: 'Agenda e bilhetes' },
      { id: 'reviews', label: 'Avaliações', icon: Star, help: 'Feedback de clientes' },
      { id: 'marketing', label: 'Marketing', icon: Megaphone, help: 'Campanhas e posts', aliases: ['marketing_campaigns', 'marketing_calendar', 'posts', 'promotions'] },
    ],
  },
  {
    id: 'sales',
    label: 'Vendas e clientes',
    items: [
      { id: 'tickets', label: 'Bilhetes & Scanner', icon: ScanLine, badgeKey: 'pendingTickets', help: 'Vendas e validação' },
      { id: 'order_history', label: 'Histórico de Pedidos', icon: ShoppingBag, help: 'Encomendas' },
      { id: 'redemptions', label: 'Levantamentos', icon: ScanLine, help: 'Resgates QR' },
      { id: 'communications', label: 'Mensagens', icon: MessageCircle, badgeKey: 'unreadMessages', help: 'Chat e suporte' },
      { id: 'clients', label: 'Clientes', icon: Users, help: 'Base de clientes' },
      { id: 'analytics', label: 'Estatísticas', icon: BarChart3, help: 'Métricas' },
      { id: 'billing', label: 'Faturação', icon: CreditCard, help: 'Plano e faturas' },
    ],
  },
  {
    id: 'management',
    label: 'Gestão',
    items: [
      { id: 'team', label: 'Equipa', icon: Users, help: 'Permissões' },
      { id: 'notifications', label: 'Notificações', icon: Bell, help: 'Alertas' },
      { id: 'support', label: 'Suporte', icon: HelpCircle, help: 'Ajuda' },
      { id: 'settings', label: 'Definições', icon: Settings, help: 'Segurança' },
      { id: 'export', label: 'Exportação', icon: Settings, help: 'Relatórios' },
    ],
  },
];

export const ADMIN_NAVIGATION: NavigationGroup<AdminModule>[] = [
  {
    id: 'dashboard',
    label: 'Painel',
    items: [{ id: 'overview', label: 'Visão Geral', icon: LayoutDashboard }],
  },
  {
    id: 'management',
    label: 'Gestão',
    items: [
      { id: 'businesses', label: 'Empresas & Negócios', icon: Building2, badgeKey: 'pendingBusinesses' },
      { id: 'events', label: 'Eventos & Bilhetes', icon: Ticket },
      { id: 'users', label: 'Utilizadores', icon: Users },
    ],
  },
  {
    id: 'finance',
    label: 'Financeiro',
    items: [
      { id: 'financials', label: 'Financeiro', icon: CreditCard },
      { id: 'pricing', label: 'Planos & Assinaturas', icon: WalletCards },
    ],
  },
  {
    id: 'control',
    label: 'Controlo',
    items: [
      { id: 'moderation', label: 'Moderação', icon: ShieldCheck, badgeKey: 'pendingModeration' },
      { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    id: 'support',
    label: 'Suporte',
    items: [
      { id: 'support', label: 'Suporte', icon: HelpCircle, badgeKey: 'pendingAdminSupport' },
      { id: 'notifications', label: 'Notificações em Massa', icon: Bell },
    ],
  },
  {
    id: 'administration',
    label: 'Administração',
    items: [
      { id: 'roles', label: 'Permissões', icon: ShieldCheck },
      { id: 'admin_staff', label: 'Equipa Admin', icon: Users },
      { id: 'categories', label: 'Categorias & Tags', icon: Tag },
      { id: 'architecture', label: 'Sistema', icon: Settings },
      { id: 'capabilities', label: 'Configurações Globais', icon: SlidersHorizontal },
      { id: 'sobre-nos', label: 'Sobre Nós', icon: Building2, help: 'Gerencie a identidade visual, informações institucionais e apresentação pública da sua empresa.' },
    ],
  },
  {
    id: 'security',
    label: 'Segurança',
    items: [
      { id: 'audit_logs', label: 'Auditoria', icon: FileText },
      { id: 'quality_audit', label: 'Auditoria e Qualidade', icon: ClipboardCheck },
    ],
  },
];
