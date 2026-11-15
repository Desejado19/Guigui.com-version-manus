import type { Language, UserRole } from '../../types';

/**
 * Conteúdo do guia de boas-vindas.
 *
 * Cidadãos e empresas recebem percursos diferentes: não faz sentido explicar a
 * gestão de eventos a quem só compra bilhetes, nem explicar como comprar a quem
 * gere vendas. Cada passo é curto e aponta para um ecrã que já existe.
 */

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

export function getTourSteps(role: UserRole): TourStep[] {
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

/** O guia abre sozinho apenas antes de o utilizador o concluir ou saltar. */
export function shouldAutoOpenTour(userId: string | null | undefined): boolean {
  const state = readTourState(userId);
  return !state || state.status === 'pending' || state.status === 'in_progress';
}
