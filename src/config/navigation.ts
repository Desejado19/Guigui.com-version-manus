import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CircleUserRound,
  Compass,
  CreditCard,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  Map,
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

export type CitizenPrimaryModule = 'feed' | 'directory' | 'events' | 'map' | 'messages' | 'account';
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
  | 'categories'
  | 'notifications'
  | 'architecture'
  | 'capabilities'
  | 'profile';

export const CITIZEN_PRIMARY_NAVIGATION: NavigationItem<CitizenPrimaryModule>[] = [
  { id: 'feed', label: 'Feed', icon: Home, mobile: true, desktop: true },
  { id: 'directory', label: 'Descobrir', icon: Compass, mobile: true, desktop: true },
  { id: 'events', label: 'Eventos', icon: CalendarDays, mobile: true, desktop: true },
  { id: 'map', label: 'Mapa', icon: Map, mobile: true, desktop: true },
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
    items: [{ id: 'overview', label: 'Visão Geral', icon: LayoutDashboard, help: 'Resumo executivo e KPIs' }],
  },
  {
    id: 'management',
    label: 'Gestão',
    items: [
      { id: 'businesses', label: 'Empresas & Negócios', icon: Building2, badgeKey: 'pendingBusinesses', help: 'Aprovação e estatísticas' },
      { id: 'events', label: 'Eventos & Bilhetes', icon: Ticket, help: 'Agenda e validação' },
      { id: 'users', label: 'Utilizadores', icon: Users, help: 'Contas e atividade' },
    ],
  },
  {
    id: 'finance',
    label: 'Financeiro',
    items: [
      { id: 'financials', label: 'Financeiro', icon: CreditCard, help: 'Vendas e comissões' },
      { id: 'pricing', label: 'Planos & Assinaturas', icon: WalletCards, help: 'Planos e pricing' },
    ],
  },
  {
    id: 'control',
    label: 'Controlo',
    items: [
      { id: 'moderation', label: 'Moderação', icon: ShieldCheck, badgeKey: 'pendingModeration', help: 'Conteúdo pendente' },
      { id: 'reports', label: 'Relatórios', icon: BarChart3, help: 'Estatísticas' },
    ],
  },
  {
    id: 'support',
    label: 'Suporte',
    items: [
      { id: 'support', label: 'Suporte', icon: HelpCircle, badgeKey: 'pendingAdminSupport', help: 'Pedidos e mensagens' },
      { id: 'notifications', label: 'Notificações em Massa', icon: Bell, help: 'Avisos globais' },
    ],
  },
  {
    id: 'administration',
    label: 'Administração',
    items: [
      { id: 'roles', label: 'Permissões', icon: ShieldCheck, help: 'Matriz da equipa' },
      { id: 'admin_staff', label: 'Equipa Admin', icon: Users, help: 'Administradores' },
      { id: 'categories', label: 'Categorias & Tags', icon: Tag, help: 'Taxonomia' },
      { id: 'architecture', label: 'Sistema', icon: Settings, help: 'Infraestrutura' },
      { id: 'capabilities', label: 'Configurações Globais', icon: SlidersHorizontal, help: 'Mapa de capacidades' },
    ],
  },
  {
    id: 'security',
    label: 'Segurança',
    items: [
      { id: 'audit_logs', label: 'Auditoria', icon: FileText, help: 'Logs e segurança' },
    ],
  },
];
