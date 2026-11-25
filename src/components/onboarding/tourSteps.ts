import { hasModuleAccess } from '../../config/teamAccess';
import type { BusinessTeamRole, Language, TeamModuleAccess, UserRole } from '../../types';

/** Conteúdo do guia de boas-vindas, com um percurso por tipo de conta. */

export type TourIconKey =
  | 'layout'
  | 'compass'
  | 'ticket'
  | 'bell'
  | 'message'
  | 'lifebuoy'
  | 'user'
  | 'shield'
  | 'store'
  | 'package'
  | 'calendar'
  | 'wallet'
  | 'users'
  | 'settings';

export interface TourStepCopy {
  title: string;
  description: string;
}

export interface TourStep {
  id: string;
  icon: TourIconKey;
  copy: Record<Language, TourStepCopy>;
}

export const CITIZEN_TOUR: TourStep[] = [
  {
    id: 'overview',
    icon: 'layout',
    copy: {
      pt: { title: 'Visão geral', description: 'O seu painel reúne bilhetes, compras, notificações e atalhos para o que precisa.' },
      en: { title: 'Overview', description: 'Your dashboard gathers tickets, purchases, notifications and shortcuts to what you need.' },
      fr: { title: 'Vue d’ensemble', description: 'Votre tableau de bord réunit billets, achats, notifications et raccourcis utiles.' },
      es: { title: 'Vista general', description: 'Su panel reúne entradas, compras, notificaciones y atajos a lo que necesita.' },
    },
  },
  {
    id: 'explore',
    icon: 'compass',
    copy: {
      pt: { title: 'Explorar', description: 'Descubra empresas, promoções, eventos e serviços de Bissau a partir do feed e da diretoria.' },
      en: { title: 'Explore', description: 'Discover businesses, promotions, events and services in Bissau from the feed and directory.' },
      fr: { title: 'Explorer', description: 'Découvrez entreprises, promotions, événements et services de Bissau depuis le fil et l’annuaire.' },
      es: { title: 'Explorar', description: 'Descubra empresas, promociones, eventos y servicios de Bisáu desde el feed y el directorio.' },
    },
  },
  {
    id: 'tickets',
    icon: 'ticket',
    copy: {
      pt: { title: 'Bilhetes e compras', description: 'Compre bilhetes, acompanhe encomendas e abra o QR Code na entrada. Pode descarregar vários bilhetes de uma vez.' },
      en: { title: 'Tickets and purchases', description: 'Buy tickets, follow orders and open the QR code at the door. You can download several tickets at once.' },
      fr: { title: 'Billets et achats', description: 'Achetez des billets, suivez vos commandes et ouvrez le QR code à l’entrée. Téléchargez plusieurs billets à la fois.' },
      es: { title: 'Entradas y compras', description: 'Compre entradas, siga sus pedidos y abra el código QR en la entrada. Puede descargar varias a la vez.' },
    },
  },
  {
    id: 'notifications',
    icon: 'bell',
    copy: {
      pt: { title: 'Notificações', description: 'Cada aviso abre diretamente o bilhete, o pagamento, o evento ou a conversa que o originou.' },
      en: { title: 'Notifications', description: 'Each alert opens the exact ticket, payment, event or conversation that created it.' },
      fr: { title: 'Notifications', description: 'Chaque alerte ouvre précisément le billet, le paiement, l’événement ou la conversation concernée.' },
      es: { title: 'Notificaciones', description: 'Cada aviso abre exactamente la entrada, el pago, el evento o la conversación que lo originó.' },
    },
  },
  {
    id: 'messages',
    icon: 'message',
    copy: {
      pt: { title: 'Mensagens', description: 'Fale com as empresas no Guigui.com. A conversa fica guardada e pode ser retomada mais tarde.' },
      en: { title: 'Messages', description: 'Talk to businesses inside Guigui.com. The conversation is saved and can be resumed later.' },
      fr: { title: 'Messages', description: 'Échangez avec les entreprises sur Guigui.com. La conversation est conservée et reprenable.' },
      es: { title: 'Mensajes', description: 'Hable con las empresas dentro de Guigui.com. La conversación se guarda y puede retomarse.' },
    },
  },
  {
    id: 'support',
    icon: 'lifebuoy',
    copy: {
      pt: { title: 'Suporte', description: 'Abra um pedido de ajuda e acompanhe cada resposta num único histórico.' },
      en: { title: 'Support', description: 'Open a help request and follow every reply in a single history.' },
      fr: { title: 'Assistance', description: 'Ouvrez une demande d’aide et suivez chaque réponse dans un historique unique.' },
      es: { title: 'Soporte', description: 'Abra una solicitud de ayuda y siga cada respuesta en un único historial.' },
    },
  },
  {
    id: 'profile',
    icon: 'user',
    copy: {
      pt: { title: 'Perfil', description: 'Personalize nome, contactos, bairro, idioma e modo claro ou escuro.' },
      en: { title: 'Profile', description: 'Personalise name, contacts, neighbourhood, language and light or dark mode.' },
      fr: { title: 'Profil', description: 'Personnalisez nom, contacts, quartier, langue et mode clair ou sombre.' },
      es: { title: 'Perfil', description: 'Personalice nombre, contactos, barrio, idioma y modo claro u oscuro.' },
    },
  },
  {
    id: 'security',
    icon: 'shield',
    copy: {
      pt: { title: 'Segurança', description: 'Altere a palavra-passe, controle alertas de sessão e proteja os seus dados.' },
      en: { title: 'Security', description: 'Change your password, control session alerts and protect your data.' },
      fr: { title: 'Sécurité', description: 'Changez votre mot de passe, contrôlez les alertes de session et protégez vos données.' },
      es: { title: 'Seguridad', description: 'Cambie su contraseña, controle las alertas de sesión y proteja sus datos.' },
    },
  },
];

export const BUSINESS_TOUR: TourStep[] = [
  {
    id: 'overview',
    icon: 'layout',
    copy: {
      pt: { title: 'Painel empresarial', description: 'Indicadores de vendas, receita e alcance logo no primeiro ecrã.' },
      en: { title: 'Business dashboard', description: 'Sales, revenue and reach indicators right on the first screen.' },
      fr: { title: 'Tableau de bord', description: 'Ventes, revenus et portée dès le premier écran.' },
      es: { title: 'Panel empresarial', description: 'Ventas, ingresos y alcance desde la primera pantalla.' },
    },
  },
  {
    id: 'profile',
    icon: 'store',
    copy: {
      pt: { title: 'Perfil da empresa', description: 'Configure contactos, apresentação comercial e documentos de verificação.' },
      en: { title: 'Business profile', description: 'Set up contacts, commercial presentation and verification documents.' },
      fr: { title: 'Profil de l’entreprise', description: 'Configurez contacts, présentation commerciale et documents de vérification.' },
      es: { title: 'Perfil de la empresa', description: 'Configure contactos, presentación comercial y documentos de verificación.' },
    },
  },
  {
    id: 'products',
    icon: 'package',
    copy: {
      pt: { title: 'Serviços e produtos', description: 'Publique e atualize ofertas, promoções e publicações do feed.' },
      en: { title: 'Services and products', description: 'Publish and update offers, promotions and feed posts.' },
      fr: { title: 'Services et produits', description: 'Publiez et mettez à jour offres, promotions et publications.' },
      es: { title: 'Servicios y productos', description: 'Publique y actualice ofertas, promociones y publicaciones.' },
    },
  },
  {
    id: 'events',
    icon: 'calendar',
    copy: {
      pt: { title: 'Eventos', description: 'Crie eventos, defina bilhetes e acompanhe a aprovação da equipa Guigui.' },
      en: { title: 'Events', description: 'Create events, define tickets and follow the Guigui team approval.' },
      fr: { title: 'Événements', description: 'Créez des événements, définissez les billets et suivez l’approbation.' },
      es: { title: 'Eventos', description: 'Cree eventos, defina entradas y siga la aprobación del equipo Guigui.' },
    },
  },
  {
    id: 'sales',
    icon: 'wallet',
    copy: {
      pt: { title: 'Bilhetes e vendas', description: 'Valide entradas no scanner e consulte vendas, pagamentos e reembolsos.' },
      en: { title: 'Tickets and sales', description: 'Validate entries in the scanner and check sales, payments and refunds.' },
      fr: { title: 'Billets et ventes', description: 'Validez les entrées au scanner et consultez ventes, paiements et remboursements.' },
      es: { title: 'Entradas y ventas', description: 'Valide entradas en el escáner y consulte ventas, pagos y reembolsos.' },
    },
  },
  {
    id: 'customers',
    icon: 'users',
    copy: {
      pt: { title: 'Clientes', description: 'Consulte as interações permitidas com quem compra e contacta a sua empresa.' },
      en: { title: 'Customers', description: 'See the permitted interactions with people who buy from and contact you.' },
      fr: { title: 'Clients', description: 'Consultez les interactions autorisées avec ceux qui achètent et vous contactent.' },
      es: { title: 'Clientes', description: 'Consulte las interacciones permitidas con quienes compran y le contactan.' },
    },
  },
  {
    id: 'messages',
    icon: 'message',
    copy: {
      pt: { title: 'Mensagens', description: 'Responda aos cidadãos. Cada cidadão tem um canal único, sem conversas duplicadas.' },
      en: { title: 'Messages', description: 'Reply to citizens. Each citizen has a single channel, with no duplicate conversations.' },
      fr: { title: 'Messages', description: 'Répondez aux citoyens. Chaque citoyen dispose d’un canal unique, sans doublons.' },
      es: { title: 'Mensajes', description: 'Responda a los ciudadanos. Cada uno tiene un canal único, sin conversaciones duplicadas.' },
    },
  },
  {
    id: 'notifications',
    icon: 'bell',
    copy: {
      pt: { title: 'Notificações', description: 'Avisos de vendas, moderação e pagamentos abrem diretamente o registo certo.' },
      en: { title: 'Notifications', description: 'Sales, moderation and payment alerts open the exact record.' },
      fr: { title: 'Notifications', description: 'Les alertes de ventes, modération et paiements ouvrent le bon dossier.' },
      es: { title: 'Notificaciones', description: 'Los avisos de ventas, moderación y pagos abren el registro exacto.' },
    },
  },
  {
    id: 'support',
    icon: 'lifebuoy',
    copy: {
      pt: { title: 'Suporte', description: 'Abra pedidos com categoria empresarial e acompanhe as respostas da administração.' },
      en: { title: 'Support', description: 'Open requests with business categories and follow administration replies.' },
      fr: { title: 'Assistance', description: 'Ouvrez des demandes par catégorie et suivez les réponses de l’administration.' },
      es: { title: 'Soporte', description: 'Abra solicitudes por categoría y siga las respuestas de la administración.' },
    },
  },
  {
    id: 'settings',
    icon: 'settings',
    copy: {
      pt: { title: 'Configurações', description: 'Gerir conta, equipa, permissões e subscrição do plano.' },
      en: { title: 'Settings', description: 'Manage account, team, permissions and plan subscription.' },
      fr: { title: 'Paramètres', description: 'Gérez compte, équipe, permissions et abonnement.' },
      es: { title: 'Configuración', description: 'Gestione cuenta, equipo, permisos y suscripción del plan.' },
    },
  },
];

export const ADMIN_TOUR: TourStep[] = [
  {
    id: 'overview',
    icon: 'layout',
    copy: {
      pt: { title: 'Visão geral', description: 'Os indicadores da plataforma — empresas, utilizadores, bilhetes e receita — abrem o painel administrativo.' },
      en: { title: 'Overview', description: 'Platform indicators — businesses, users, tickets and revenue — open the admin dashboard.' },
      fr: { title: 'Vue d’ensemble', description: 'Les indicateurs de la plateforme — entreprises, utilisateurs, billets et revenus — ouvrent le tableau de bord.' },
      es: { title: 'Vista general', description: 'Los indicadores de la plataforma — empresas, usuarios, entradas e ingresos — abren el panel.' },
    },
  },
  {
    id: 'businesses',
    icon: 'store',
    copy: {
      pt: { title: 'Empresas', description: 'Aprovar, destacar e acompanhar empresas. Cada decisão fica registada na auditoria.' },
      en: { title: 'Businesses', description: 'Approve, feature and follow businesses. Every decision is recorded in the audit trail.' },
      fr: { title: 'Entreprises', description: 'Approuvez, mettez en avant et suivez les entreprises. Chaque décision est auditée.' },
      es: { title: 'Empresas', description: 'Apruebe, destaque y siga empresas. Cada decisión queda auditada.' },
    },
  },
  {
    id: 'moderation',
    icon: 'shield',
    copy: {
      pt: { title: 'Moderação', description: 'Fila de conteúdos e perfis a rever, com motivos e histórico de cada decisão.' },
      en: { title: 'Moderation', description: 'Queue of content and profiles to review, with reasons and the history of each decision.' },
      fr: { title: 'Modération', description: 'File de contenus et profils à réviser, avec motifs et historique des décisions.' },
      es: { title: 'Moderación', description: 'Cola de contenidos y perfiles a revisar, con motivos e historial de cada decisión.' },
    },
  },
  {
    id: 'events',
    icon: 'calendar',
    copy: {
      pt: { title: 'Eventos e bilhetes', description: 'Agenda, estados de publicação e bilhetes emitidos em toda a plataforma.' },
      en: { title: 'Events and tickets', description: 'Agenda, publication status and tickets issued across the platform.' },
      fr: { title: 'Événements et billets', description: 'Agenda, statuts de publication et billets émis sur toute la plateforme.' },
      es: { title: 'Eventos y entradas', description: 'Agenda, estados de publicación y entradas emitidas en toda la plataforma.' },
    },
  },
  {
    id: 'users',
    icon: 'users',
    copy: {
      pt: { title: 'Utilizadores e equipa', description: 'Contas cidadãs, empresariais e membros internos, com acessos por módulo.' },
      en: { title: 'Users and team', description: 'Citizen, business and internal accounts, with per-module access.' },
      fr: { title: 'Utilisateurs et équipe', description: 'Comptes citoyens, entreprises et internes, avec accès par module.' },
      es: { title: 'Usuarios y equipo', description: 'Cuentas ciudadanas, empresariales e internas, con accesos por módulo.' },
    },
  },
  {
    id: 'finance',
    icon: 'wallet',
    copy: {
      pt: { title: 'Financeiro', description: 'Transações, reconciliação, reembolsos e extratos com valores em XOF.' },
      en: { title: 'Finance', description: 'Transactions, reconciliation, refunds and statements in XOF.' },
      fr: { title: 'Finances', description: 'Transactions, rapprochement, remboursements et relevés en XOF.' },
      es: { title: 'Finanzas', description: 'Transacciones, conciliación, reembolsos y extractos en XOF.' },
    },
  },
  {
    id: 'audit',
    icon: 'lifebuoy',
    copy: {
      pt: { title: 'Auditoria e suporte', description: 'Histórico de acessos, pedidos de suporte e relatórios operacionais.' },
      en: { title: 'Audit and support', description: 'Access history, support requests and operational reports.' },
      fr: { title: 'Audit et assistance', description: 'Historique des accès, demandes d’assistance et rapports.' },
      es: { title: 'Auditoría y soporte', description: 'Historial de accesos, solicitudes de soporte e informes.' },
    },
  },
  {
    id: 'security',
    icon: 'settings',
    copy: {
      pt: { title: 'A minha conta', description: 'Altere a palavra-passe, o tema e o idioma no seu perfil de administração.' },
      en: { title: 'My account', description: 'Change your password, theme and language in your admin profile.' },
      fr: { title: 'Mon compte', description: 'Changez votre mot de passe, thème et langue dans votre profil administrateur.' },
      es: { title: 'Mi cuenta', description: 'Cambie su contraseña, tema e idioma en su perfil de administración.' },
    },
  },
];

/**
 * Guia do colaborador: só entram os módulos que lhe foram atribuídos, para o
 * percurso descrever as tarefas reais daquela conta e não o painel completo.
 */
export function getTeamTourSteps(access?: TeamModuleAccess | null): TourStep[] {
  // Sem permissões conhecidas assume-se o mínimo: visão geral + segurança.
  const can = (moduleId: string) => hasModuleAccess(access, moduleId);
  const steps: TourStep[] = [
    {
      id: 'overview',
      icon: 'layout',
      copy: {
        pt: { title: 'As suas tarefas', description: 'Este é o painel da equipa. Só aparecem os módulos que a empresa lhe atribuiu.' },
        en: { title: 'Your tasks', description: 'This is the team dashboard. Only the modules the business assigned to you are shown.' },
        fr: { title: 'Vos tâches', description: 'Voici le tableau de bord de l’équipe. Seuls les modules attribués par l’entreprise apparaissent.' },
        es: { title: 'Sus tareas', description: 'Este es el panel del equipo. Solo aparecen los módulos que la empresa le asignó.' },
      },
    },
  ];
  if (can('events')) {
    steps.push({
      id: 'events',
      icon: 'calendar',
      copy: {
        pt: { title: 'Eventos', description: 'Crie e acompanhe eventos da empresa dentro do acesso que lhe foi dado.' },
        en: { title: 'Events', description: 'Create and follow the business events within the access you were given.' },
        fr: { title: 'Événements', description: 'Créez et suivez les événements de l’entreprise selon votre accès.' },
        es: { title: 'Eventos', description: 'Cree y siga los eventos de la empresa según su acceso.' },
      },
    });
  }
  if (can('tickets') || can('redemptions') || can('order_history')) {
    steps.push({
      id: 'tickets',
      icon: 'ticket',
      copy: {
        pt: { title: 'Bilhetes e validação', description: 'Consulte vendas, valide entradas no scanner e descarregue a lista de compradores dos eventos.' },
        en: { title: 'Tickets and validation', description: 'Check sales, validate entries in the scanner and download each event buyer list.' },
        fr: { title: 'Billets et validation', description: 'Consultez les ventes, validez les entrées au scanner et téléchargez la liste des acheteurs.' },
        es: { title: 'Entradas y validación', description: 'Consulte ventas, valide entradas en el escáner y descargue la lista de compradores.' },
      },
    });
  }
  if (can('content') || can('stories') || can('reviews')) {
    steps.push({
      id: 'content',
      icon: 'package',
      copy: {
        pt: { title: 'Conteúdo', description: 'Publique no feed e nas stories conforme a sua permissão.' },
        en: { title: 'Content', description: 'Publish to the feed and stories according to your permission.' },
        fr: { title: 'Contenu', description: 'Publiez dans le fil et les stories selon votre permission.' },
        es: { title: 'Contenido', description: 'Publique en el feed y las historias según su permiso.' },
      },
    });
  }
  if (can('clients')) {
    steps.push({
      id: 'clients',
      icon: 'users',
      copy: {
        pt: { title: 'Clientes', description: 'Veja as interações permitidas com quem compra e contacta a empresa.' },
        en: { title: 'Customers', description: 'See the permitted interactions with people who buy from and contact the business.' },
        fr: { title: 'Clients', description: 'Consultez les interactions autorisées avec ceux qui achètent et contactent l’entreprise.' },
        es: { title: 'Clientes', description: 'Consulte las interacciones permitidas con quienes compran y contactan la empresa.' },
      },
    });
  }
  if (can('reports')) {
    steps.push({
      id: 'reports',
      icon: 'wallet',
      copy: {
        pt: { title: 'Relatórios', description: 'Exporte vendas, clientes e bilhetes para contabilidade e gestão interna.' },
        en: { title: 'Reports', description: 'Export sales, customers and tickets for accounting and internal management.' },
        fr: { title: 'Rapports', description: 'Exportez ventes, clients et billets pour la comptabilité et la gestion.' },
        es: { title: 'Informes', description: 'Exporte ventas, clientes y entradas para contabilidad y gestión interna.' },
      },
    });
  }
  if (can('support')) {
    steps.push({
      id: 'support',
      icon: 'lifebuoy',
      copy: {
        pt: { title: 'Suporte', description: 'Responda aos pedidos dos clientes e acompanhe cada conversa.' },
        en: { title: 'Support', description: 'Reply to customer requests and follow every conversation.' },
        fr: { title: 'Assistance', description: 'Répondez aux demandes des clients et suivez chaque conversation.' },
        es: { title: 'Soporte', description: 'Responda a las solicitudes de los clientes y siga cada conversación.' },
      },
    });
  }
  steps.push({
    id: 'security',
    icon: 'shield',
    copy: {
      pt: { title: 'A sua conta', description: 'Altere a palavra-passe e consulte as sessões ativas. Cada colaborador gere as suas próprias credenciais.' },
      en: { title: 'Your account', description: 'Change your password and review active sessions. Each team member manages their own credentials.' },
      fr: { title: 'Votre compte', description: 'Changez votre mot de passe et consultez les sessions actives. Chacun gère ses identifiants.' },
      es: { title: 'Su cuenta', description: 'Cambie su contraseña y consulte las sesiones activas. Cada colaborador gestiona sus credenciales.' },
    },
  });
  return steps;
}

export function getTourSteps(
  role: UserRole,
  options?: { teamRole?: BusinessTeamRole | null; teamAccess?: TeamModuleAccess | null },
): TourStep[] {
  if (role === 'admin') return ADMIN_TOUR;
  if (role === 'business' && options?.teamRole) return getTeamTourSteps(options.teamAccess);
  return role === 'business' ? BUSINESS_TOUR : CITIZEN_TOUR;
}

interface StoredTourState {
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  step: number;
  updatedAt: string;
}

const STORAGE_PREFIX = 'guigui_onboarding_v1';
const storageKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

export function readTourState(userId: string | null | undefined): StoredTourState | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTourState>;
    const status: StoredTourState['status'] = ['pending', 'in_progress', 'completed', 'skipped'].includes(String(parsed.status))
      ? String(parsed.status) as StoredTourState['status']
      : 'pending';
    return {
      status,
      step: Number.isInteger(parsed.step) ? Math.max(0, Number(parsed.step)) : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeTourState(userId: string, state: Omit<StoredTourState, 'updatedAt'>): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  } catch {
    // Armazenamento indisponível: o guia volta a aparecer na próxima sessão.
  }
}

export function resetTourState(userId: string): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // Sem armazenamento não há estado a limpar.
  }
}

/**
 * O guia abre sozinho apenas na primeira vez que a conta é usada neste browser.
 * Assim que é apresentado fica registado (ver WelcomeTour), pelo que voltar a
 * iniciar sessão não o reabre; o botão "Guia" permite revê-lo manualmente.
 */
export function shouldAutoOpenTour(userId: string | null | undefined): boolean {
  return readTourState(userId) === null;
}
