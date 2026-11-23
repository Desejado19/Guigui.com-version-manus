import { renderEmailLayout } from '../layout';
import type { EmailAttachment } from '../types';

/**
 * Convite de colaborador (Administração ou Empresa).
 *
 * O link individual e temporário é o único conteúdo accionável; o email não
 * inclui tokens no assunto nem no texto alternativo além do próprio botão.
 */

export interface TeamInvitationEmailData {
  recipientName: string;
  organizationName: string;
  roleLabel: string;
  modules: string[];
  invitationUrl: string;
  isAdminScope: boolean;
  appUrl?: string;
}

export interface RenderedTeamInvitationEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

export function renderTeamInvitationEmail(
  input: TeamInvitationEmailData,
): RenderedTeamInvitationEmail {
  const modules = input.modules.map((module) => module.trim()).filter(Boolean);
  const intro = input.isAdminScope
    ? 'Foi criado um convite para integrares a equipa de administração do Guigui.com.'
    : `Foi criado um convite para integrares a equipa de ${input.organizationName}.`;

  const { html, text } = renderEmailLayout({
    locale: 'pt',
    title: 'Convite para integrar a equipa',
    preheader: `Convite para ${input.organizationName} — ${input.roleLabel}`,
    greeting: `Olá, ${input.recipientName}!`,
    intro,
    sections: [
      {
        type: 'panel',
        title: 'Detalhes do convite',
        rows: [
          { label: 'Organização', value: input.organizationName },
          { label: 'Cargo', value: input.roleLabel },
          { label: 'Âmbito', value: input.isAdminScope ? 'Administração' : 'Empresa' },
        ],
      },
      ...(modules.length > 0
        ? [{ type: 'list' as const, title: 'Módulos atribuídos', items: modules }]
        : []),
    ],
    action: { label: 'Aceitar convite e ativar conta', url: input.invitationUrl },
    closing:
      'Depois de aceitares o convite, poderás configurar a tua palavra-passe e iniciar sessão.',
    appUrl: input.appUrl,
    footer: {
      reason: `Recebeu este convite porque foi indicado(a) como colaborador(a) de ${input.organizationName}.`,
    },
  });

  return {
    subject: 'Convite para integrar a equipa do Guigui.com',
    html,
    text,
    attachments: [],
  };
}
