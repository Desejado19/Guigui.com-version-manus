import React, { useMemo } from 'react';
import { Check, Lock, Save, ShieldCheck, Ticket, Users } from 'lucide-react';
import { AdminPermissionKey, AdminStaffMember, AuditLogEntry, Language } from '../../types';
import { getTranslation } from '../../utils/i18n';

interface AdminPermissionsMatrixProps {
  currentLang?: Language;
  staffList: AdminStaffMember[];
  onUpdateStaff: (updatedStaff: AdminStaffMember[]) => void;
  onLogAuditAction?: (action: Partial<AuditLogEntry>) => void;
}

type PermissionDefinition = {
  key: AdminPermissionKey;
  label: string;
  description: string;
  companyOnly?: boolean;
};

const permissionDefinitions: PermissionDefinition[] = [
  { key: 'manageBusinesses', label: 'Empresas', description: 'Cadastro, verificação e estados das empresas.' },
  { key: 'manageUsers', label: 'Utilizadores', description: 'Políticas e gestão de contas de cidadãos.' },
  { key: 'contentModeration', label: 'Moderação IA', description: 'Decisões de moderação e revisão humana.' },
  { key: 'manageContent', label: 'Conteúdo', description: 'Publicações, destaques e categorias de conteúdo.' },
  { key: 'manageEvents', label: 'Eventos', description: 'Agenda e governação de eventos.' },
  { key: 'manageSubscriptions', label: 'Subscrições', description: 'Planos, upgrades e estado das empresas.' },
  { key: 'manageAdvertising', label: 'Publicidade', description: 'Campanhas e anúncios da plataforma.' },
  { key: 'financialAudit', label: 'Financeiro', description: 'Pagamentos, receitas, comissões e reembolsos.' },
  { key: 'manageAdmins', label: 'Administradores', description: 'Equipa, funções, acessos e revogação.' },
  { key: 'viewAuditLogs', label: 'Logs e auditoria', description: 'Consulta do histórico imutável e conformidade.' },
  { key: 'exportReports', label: 'Relatórios', description: 'Filtros e exportação de relatórios.' },
  { key: 'managePricing', label: 'Preços', description: 'Matriz de preços e regras comerciais.' },
  { key: 'manageCategories', label: 'Categorias', description: 'Categorias e subcategorias do directório.' },
  { key: 'manageSupport', label: 'Suporte', description: 'Fila de pedidos e respostas operacionais.' },
  { key: 'manageSecurity', label: 'Segurança', description: 'Sessões, 2FA, credenciais e políticas.' },
  { key: 'manageBackups', label: 'Backup', description: 'Cópias, restauração e exportação técnica.' },
  { key: 'validateTickets', label: 'Scanner / validação de bilhetes', description: 'Operação exclusiva da empresa organizadora e da sua equipa de porta.', companyOnly: true },
];

const accessLevelLabels: Record<AdminStaffMember['accessLevel'], string> = {
  super_admin: 'Super Admin',
  moderator: 'Moderador',
  finance_manager: 'Gestor Financeiro',
  support_agent: 'Suporte',
  events_coordinator: 'Coord. de Eventos',
};

export const AdminPermissionsMatrix: React.FC<AdminPermissionsMatrixProps> = ({
  currentLang = 'pt' as Language,
  staffList,
  onUpdateStaff,
  onLogAuditAction,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const roles = useMemo(() => {
    const ordered = ['super_admin', 'moderator', 'finance_manager', 'support_agent', 'events_coordinator'] as AdminStaffMember['accessLevel'][];
    return ordered.map((accessLevel) => ({
      accessLevel,
      members: staffList.filter((staff) => staff.accessLevel === accessLevel),
    }));
  }, [staffList]);

  const getPermissionValue = (staff: AdminStaffMember | undefined, key: AdminPermissionKey) => {
    if (key === 'validateTickets') return false;
    if (!staff) return false;
    return Boolean(staff.permissions[key]);
  };

  const handleToggle = (accessLevel: AdminStaffMember['accessLevel'], key: AdminPermissionKey) => {
    if (key === 'validateTickets') return;
    const roleMembers = staffList.filter((staff) => staff.accessLevel === accessLevel);
    if (roleMembers.length === 0) return;
    const nextValue = !getPermissionValue(roleMembers[0], key);

    const roleMemberIds = new Set(roleMembers.map((member) => member.id));
    onUpdateStaff(staffList.map((member) => roleMemberIds.has(member.id)
      ? {
          ...member,
          permissions: {
            ...member.permissions,
            [key]: nextValue,
            validateTickets: false,
          },
        }
      : member
    ));

    onLogAuditAction?.({
      action: 'permissions_updated',
      actionLabel: 'Permissão de Função Actualizada',
      category: 'admin_management',
      severity: 'security',
      targetEntity: accessLevelLabels[accessLevel],
      targetId: accessLevel,
      details: `${permissionDefinitions.find((definition) => definition.key === key)?.label || key}: ${nextValue ? 'activado' : 'desactivado'} para a função ${accessLevelLabels[accessLevel]}. Aplicado a ${roleMembers.length} administrador(es).`,
      changes: [{
        field: key,
        fieldLabel: permissionDefinitions.find((definition) => definition.key === key)?.label || key,
        oldValue: !nextValue,
        newValue: nextValue,
      }],
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs text-indigo-950">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><ShieldCheck className="h-4 w-4" /></div>
          <div>
            <h4 className="font-black">{t('admin.permissionsTitle')}</h4>
            <p className="mt-1 leading-relaxed">{t('admin.permissionsIntro')}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1050px] w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-10 min-w-[235px] border-r border-slate-200 bg-slate-50 p-3 font-black text-slate-700">{t('admin.permissionColumn')}</th>
              {roles.map(({ accessLevel, members }) => (
                <th key={accessLevel} className="min-w-[145px] p-3 text-center font-black text-slate-700">
                  <div>{accessLevelLabels[accessLevel]}</div>
                  <div className="mt-1 text-[9px] font-semibold text-slate-400">{members.length} conta(s)</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {permissionDefinitions.map((definition) => (
              <tr key={definition.key} className={definition.companyOnly ? 'bg-amber-50/60' : 'bg-white'}>
                <td className="sticky left-0 z-10 border-r border-slate-100 bg-inherit p-3">
                  <div className="flex items-start gap-2">
                    {definition.companyOnly ? <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    <div>
                      <div className="font-black text-slate-800">{definition.label}</div>
                      <div className="mt-0.5 max-w-[210px] text-[10px] leading-relaxed text-slate-500">{definition.description}</div>
                    </div>
                  </div>
                </td>
                {roles.map(({ accessLevel, members }) => {
                  const checked = getPermissionValue(members[0], definition.key);
                  const disabled = definition.companyOnly || members.length === 0;
                  return (
                    <td key={accessLevel} className="p-2 text-center">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleToggle(accessLevel, definition.key)}
                        className={`mx-auto flex min-h-[38px] min-w-[116px] items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-black transition ${
                          disabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            : checked
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50'
                        }`}
                        title={definition.companyOnly ? 'Operação reservada ao painel da empresa organizadora' : `Alterar ${definition.label} para ${accessLevelLabels[accessLevel]}`}
                      >
                        {definition.companyOnly ? <Lock className="h-3.5 w-3.5" /> : checked ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                        {definition.companyOnly ? 'Só empresa' : checked ? 'Permitido' : 'Bloqueado'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] text-emerald-900"><div className="flex items-center gap-2 font-black"><Check className="h-3.5 w-3.5" /> {t('admin.allowed')}</div><p className="mt-1">{t('admin.permissionHint')}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-700"><div className="flex items-center gap-2 font-black"><Save className="h-3.5 w-3.5" /> {t('admin.blocked')}</div><p className="mt-1">{t('admin.permissionHint')}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900"><div className="flex items-center gap-2 font-black"><Users className="h-3.5 w-3.5" /> {t('admin.tickets')}</div><p className="mt-1">{t('admin.permissionHint')}</p></div>
      </div>
    </div>
  );
};
