import React, { useMemo } from 'react';
import { Check, Lock, Save, ShieldCheck, Ticket } from 'lucide-react';
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
  companyOnly?: boolean;
};

const permissionDefinitions: PermissionDefinition[] = [
  { key: 'manageBusinesses', label: 'Empresas' },
  { key: 'manageUsers', label: 'Utilizadores' },
  { key: 'contentModeration', label: 'Moderação IA' },
  { key: 'manageContent', label: 'Conteúdo' },
  { key: 'manageEvents', label: 'Eventos' },
  { key: 'manageSubscriptions', label: 'Subscrições' },
  { key: 'manageAdvertising', label: 'Publicidade' },
  { key: 'financialAudit', label: 'Financeiro' },
  { key: 'manageAdmins', label: 'Administradores' },
  { key: 'viewAuditLogs', label: 'Logs e auditoria' },
  { key: 'exportReports', label: 'Relatórios' },
  { key: 'managePricing', label: 'Preços' },
  { key: 'manageCategories', label: 'Categorias' },
  { key: 'manageSupport', label: 'Suporte' },
  { key: 'manageSecurity', label: 'Segurança' },
  { key: 'manageBackups', label: 'Backup' },
  { key: 'validateTickets', label: 'Scanner / validação de bilhetes', companyOnly: true },
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
  };  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-default)] dark:border-slate-700 md:min-w-[1050px] w-full border-collapse text-left text-[11px]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border-default)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <th className="sticky left-0 z-10 min-w-[235px] border-r border-[var(--color-border-default)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 font-black text-slate-700">{t('admin.permissionColumn')}</th>
              {roles.map(({ accessLevel, members }) => (
                <th key={accessLevel} className="min-w-[145px] p-3 text-center font-black text-slate-700">
                  <div>{accessLevelLabels[accessLevel]}</div>
                  <div className="mt-1 text-[9px] font-semibold text-slate-500">{members.length} conta(s)</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {permissionDefinitions.map((definition) => (
              <tr key={definition.key} className={definition.companyOnly ? 'bg-[var(--tone-warning-bg)]/60' : 'bg-white dark:bg-slate-900'}>
                <td className="sticky left-0 z-10 border-r border-[var(--color-border-subtle)] bg-inherit p-3">
                  <div className="flex items-start gap-2">
                    {definition.companyOnly ? <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    <div>
                      <div className="font-black text-slate-800">{definition.label}</div>
        
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
                            ? 'cursor-not-allowed border-[var(--color-border-default)] dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400'
                            : checked
                            ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)] hover:bg-[var(--tone-success-bg)]'
                            : 'border-[var(--color-border-default)] dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:border-[var(--tone-warning-border)] hover:bg-[var(--tone-warning-bg)]'
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
    </div>
  );
};
