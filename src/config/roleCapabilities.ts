import type { UserRole } from '../types';

/**
 * Matriz única de perfis e permissões no cliente.
 *
 * É a tradução visível das regras que o servidor já impõe
 * (`server/platformWriteAccess.ts`, `requireRole`, âmbito de sessão): o perfil
 * mostra ao utilizador o que a sua conta faz, o que pode fazer e o que é
 * reservado a outro papel, sem duplicar a lógica de autorização.
 */

export interface RoleCapability {
  id: string;
  label: string;
  detail: string;
}

/** Acento visual do perfil: verde (cidadão), dourado (empresa) e azul (administração). */
export type RoleTone = 'green' | 'gold' | 'blue';

export interface RoleProfilePlan {
  role: UserRole;
  /** Identidade visual curta usada no cartão de permissões. */
  name: string;
  /** Para que serve este perfil. */
  mission: string;
  /** Acento do cartão, sempre resolvido por tokens de tema. */
  tone: RoleTone;
  /** Onde este perfil trabalha, em uma linha. */
  scope: string;
  can: RoleCapability[];
  cannot: RoleCapability[];
}

export const ROLE_PROFILE_PLANS: Record<UserRole, RoleProfilePlan> = {
  user: {
    role: 'user',
    name: 'Cidadão',
    mission: 'Descobrir Bissau, comprar bilhetes e falar com as empresas.',
    tone: 'green',
    scope: 'Feed, diretório, agenda e a sua conta',
    can: [
      { id: 'browse', label: 'Explorar a plataforma', detail: 'Feed, diretório, mapa, agenda e promoções.' },
      { id: 'tickets', label: 'Comprar bilhetes', detail: 'Compra com QR e envio por SMS para a sua conta.' },
      { id: 'publish', label: 'Publicar posts', detail: 'Conteúdo próprio, sujeito à fila de moderação.' },
      { id: 'stories', label: 'Ver stories das empresas', detail: 'Stories de empresas e da administração, sem publicar as suas.' },
      { id: 'support', label: 'Conversas e suporte', detail: 'Mensagens e pedidos seus, visíveis apenas para si.' },
      { id: 'settings', label: 'Gerir a sua conta', detail: 'Perfil, privacidade, tema e idioma.' },
    ],
    cannot: [
      { id: 'create-stories', label: 'Publicar stories', detail: 'As stories são das empresas e da administração; o cidadão só as vê.' },
      { id: 'events', label: 'Criar ou editar eventos', detail: 'Reservado às empresas organizadoras e à administração.' },
      { id: 'business', label: 'Alterar fichas de empresas', detail: 'Cada empresa gere a sua própria ficha.' },
      { id: 'platform', label: 'Alterar dados da plataforma', detail: 'Planos, preços e caixas partilhadas são geridos pelo servidor.' },
      { id: 'dashboards', label: 'Painéis comercial e administrativo', detail: 'Acesso por papel, verificado no servidor.' },
    ],
  },
  business: {
    role: 'business',
    name: 'Empresa',
    mission: 'Gerir a ficha, o conteúdo, os eventos, a bilhética e os clientes.',
    tone: 'gold',
    scope: 'Painel comercial da sua empresa',
    can: [
      { id: 'profile', label: 'Editar a sua ficha', detail: 'Contactos, horários, serviços, logótipo e galeria.' },
      { id: 'content', label: 'Eventos, promoções, stories e campanhas', detail: 'Agenda cultural, ofertas, stories e calendário de marketing.' },
      { id: 'scanner', label: 'Validar bilhetes', detail: 'Leitura QR no local, também sem ligação.' },
      { id: 'team', label: 'Equipa e permissões', detail: 'Colaboradores com acesso próprio ao painel.' },
      { id: 'analytics', label: 'Métricas e facturação', detail: 'Desempenho, histórico e exportação de dados.' },
    ],
    cannot: [
      { id: 'global', label: 'Alterar planos e catálogo global', detail: 'Preços e regras de negócio são da administração.' },
      { id: 'admin', label: 'Painel administrativo', detail: 'Utilizadores, moderação e auditoria ficam reservados.' },
      { id: 'others', label: 'Editar outras empresas', detail: 'O âmbito é sempre a ficha ligada à sua sessão.' },
      { id: 'buy', label: 'Comprar bilhetes de cidadão', detail: 'A compra é uma acção de perfil cidadão.' },
    ],
  },
  admin: {
    role: 'admin',
    name: 'Administração',
    mission: 'Governar a plataforma: moderação, diretório, finanças e utilizadores.',
    tone: 'blue',
    scope: 'Administração global da plataforma',
    can: [
      { id: 'governance', label: 'Moderar e aprovar', detail: 'Empresas, conteúdo, denúncias e decisões.' },
      { id: 'stories', label: 'Publicar stories da plataforma', detail: 'Comunicação oficial no feed, como as empresas.' },
      { id: 'users', label: 'Gerir utilizadores e equipa', detail: 'Contas, funções, permissões e estados.' },
      { id: 'finance', label: 'Finanças e monetização', detail: 'Pagamentos, catálogo, livro-razão e métricas.' },
      { id: 'audit', label: 'Auditoria e segurança', detail: 'Registo de acções, sessões e MFA.' },
    ],
    cannot: [
      { id: 'buy', label: 'Comprar bilhetes', detail: 'A compra exige uma conta cidadã.' },
      { id: 'business-ops', label: 'Operações reservadas às empresas', detail: 'Campanhas e validação de bilhetes no local.' },
      { id: 'unknown-keys', label: 'Inventar chaves de estado', detail: 'Só as chaves públicas da plataforma podem ser gravadas.' },
    ],
  },
};

export function getRoleProfilePlan(role?: UserRole | null): RoleProfilePlan {
  return ROLE_PROFILE_PLANS[role ?? 'user'];
}
