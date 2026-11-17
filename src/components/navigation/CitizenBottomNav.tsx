import React from 'react';
import type { NavigationBadgeCounts } from '../../utils/navigationTypes';
import {
  CITIZEN_PRIMARY_NAVIGATION,
  isCitizenPrimaryModulePrivate,
  type CitizenPrimaryModule,
} from '../../config/navigation';
import { GlassBottomNav } from './GlassBottomNav';

interface CitizenBottomNavProps {
  activeId: CitizenPrimaryModule;
  onSelect: (id: CitizenPrimaryModule) => void;
  badges?: NavigationBadgeCounts;
  /**
   * `true` apenas quando o servidor confirmou a sessão. Enquanto a verificação
   * decorre (`false`) a barra mostra só os destinos públicos, nunca os privados.
   */
  isAuthenticated: boolean;
}

/**
 * Navegação principal do cidadão: os mesmos destinos e permissões de sempre,
 * apresentados numa barra flutuante de fundo sólido (ver `GlassBottomNav`).
 *
 * Visitantes (ou sessões por confirmar) vêem Feed, Diretório, Ofertas e Agenda;
 * Mensagens e Conta só aparecem depois de a sessão ser validada no servidor.
 * O Suporte fica de fora desta barra: vive no menu principal e no menu do painel.
 */
export const CitizenBottomNav: React.FC<CitizenBottomNavProps> = ({
  activeId,
  onSelect,
  badges = {},
  isAuthenticated,
}) => (
  <GlassBottomNav
    ariaLabel="Navegação principal"
    testId="citizen-bottom-nav"
    activeId={activeId}
    onSelect={(id) => onSelect(id as CitizenPrimaryModule)}
    items={CITIZEN_PRIMARY_NAVIGATION
      .filter((item) => isAuthenticated || !isCitizenPrimaryModulePrivate(item.id))
      .map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        badge: item.badgeKey ? badges[item.badgeKey] : undefined,
      }))}
  />
);
