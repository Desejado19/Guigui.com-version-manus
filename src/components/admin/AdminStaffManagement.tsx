import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Phone,
  Mail,
  Building,
  KeyRound,
  Eye,
  FileCheck,
  Check,
  UserCheck,
} from 'lucide-react';
import {
  AdminStaffMember,
  AdminDepartment,
  AdminAccessLevel,
  AuditLogEntry,
  Language,
} from '../../types';
import { getTranslation } from '../../utils/i18n';

interface AdminStaffManagementProps {
  staffList: AdminStaffMember[];
  onAddStaff: (newStaff: AdminStaffMember) => void;
  onUpdateStaff: (updatedStaff: AdminStaffMember) => void;
  onRevokeAccess: (id: string, reason: string) => void;
  onLogAuditAction?: (action: Partial<AuditLogEntry>) => void;
  currentLang: Language;
}

export const AdminStaffManagement: React.FC<AdminStaffManagementProps> = ({
  staffList,
  onAddStaff,
  onUpdateStaff,
  onRevokeAccess,
  onLogAuditAction,
  currentLang,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AdminStaffMember | null>(null);
  const [revokeModalStaff, setRevokeModalStaff] = useState<AdminStaffMember | null>(null);
  const [revokeReason, setRevokeReason] = useState('Desvinculação ou término de contrato com a equipa');

  // Form state for creating / editing staff
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('+245 955 ');
  const [formDepartment, setFormDepartment] = useState<AdminDepartment>('Moderação & Conteúdo');
  const [formAccessLevel, setFormAccessLevel] = useState<AdminAccessLevel>('moderator');
  const [formPermissions, setFormPermissions] = useState({
    manageBusinesses: true,
    contentModeration: true,
    financialAudit: false,
    manageAdmins: false,
    viewAuditLogs: true,
    exportReports: true,
    managePricing: false,
    validateTickets: false,
  });

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('+245 955 ');
    setFormDepartment('Moderação & Conteúdo');
    setFormAccessLevel('moderator');
    setFormPermissions({
      manageBusinesses: true,
      contentModeration: true,
      financialAudit: false,
      manageAdmins: false,
      viewAuditLogs: true,
      exportReports: true,
      managePricing: false,
      validateTickets: false,
    });
    setEditingStaff(null);
  };

  const handleOpenEdit = (staff: AdminStaffMember) => {
    setEditingStaff(staff);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormPhone(staff.phone);
    setFormDepartment(staff.department);
    setFormAccessLevel(staff.accessLevel);
    setFormPermissions({ ...staff.permissions });
    setShowAddModal(true);
  };

  const handleAccessLevelPreset = (level: AdminAccessLevel) => {
    setFormAccessLevel(level);
    if (level === 'super_admin') {
      setFormPermissions({
        manageBusinesses: true,
        contentModeration: true,
        financialAudit: true,
        manageAdmins: true,
        viewAuditLogs: true,
        exportReports: true,
        managePricing: true,
        validateTickets: false,
      });
      setFormDepartment('Diretoria Executiva');
    } else if (level === 'moderator') {
      setFormPermissions({
        manageBusinesses: true,
        contentModeration: true,
        financialAudit: false,
        manageAdmins: false,
        viewAuditLogs: true,
        exportReports: true,
        managePricing: false,
        validateTickets: false,
      });
      setFormDepartment('Moderação & Conteúdo');
    } else if (level === 'finance_manager') {
      setFormPermissions({
        manageBusinesses: false,
        contentModeration: false,
        financialAudit: true,
        manageAdmins: false,
        viewAuditLogs: true,
        exportReports: true,
        managePricing: true,
        validateTickets: false,
      });
      setFormDepartment('Financeiro & Contabilidade');
    } else if (level === 'support_agent') {
      setFormPermissions({
        manageBusinesses: true,
        contentModeration: false,
        financialAudit: false,
        manageAdmins: false,
        viewAuditLogs: false,
        exportReports: false,
        managePricing: false,
        validateTickets: false,
      });
      setFormDepartment('Suporte & Operações');
    } else if (level === 'events_coordinator') {
      setFormPermissions({
        manageBusinesses: true,
        contentModeration: false,
        financialAudit: false,
        manageAdmins: false,
        viewAuditLogs: false,
        exportReports: true,
        managePricing: false,
        validateTickets: false,
      });
      setFormDepartment('Comercial & Parcerias');
    }
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    if (editingStaff) {
      const updated: AdminStaffMember = {
        ...editingStaff,
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        department: formDepartment,
        accessLevel: formAccessLevel,
        permissions: formPermissions,
      };
      onUpdateStaff(updated);

      if (onLogAuditAction) {
        onLogAuditAction({
          action: 'admin_updated',
          actionLabel: 'Edição de Dados de Administrador',
          category: 'admin_management',
          severity: 'security',
          targetEntity: `${updated.name} (${updated.id})`,
          targetId: updated.id,
          details: `Atualizado departamento para ${updated.department} e nível de acesso para ${updated.accessLevel}.`,
        });
      }
    } else {
      const newStaff: AdminStaffMember = {
        id: `staff-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        department: formDepartment,
        accessLevel: formAccessLevel,
        status: 'active',
        avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        permissions: formPermissions,
        twoFactorEnabled: true,
        createdAt: new Date().toISOString().substring(0, 10),
        createdBy: 'Super Admin Guigui (Gorila)',
      };
      onAddStaff(newStaff);

      if (onLogAuditAction) {
        onLogAuditAction({
          action: 'admin_created',
          actionLabel: 'Novo Administrador Criado',
          category: 'admin_management',
          severity: 'security',
          targetEntity: `${newStaff.name} (${newStaff.id})`,
          targetId: newStaff.id,
          details: `Criada conta de acesso para ${newStaff.department} com privilégios de ${newStaff.accessLevel}.`,
        });
      }
    }

    setShowAddModal(false);
    resetForm();
  };

  const handleConfirmRevoke = () => {
    if (!revokeModalStaff) return;
    onRevokeAccess(revokeModalStaff.id, revokeReason);

    if (onLogAuditAction) {
      onLogAuditAction({
        action: 'admin_revoked',
        actionLabel: 'Acesso de Administrador Revogado',
        category: 'admin_management',
        severity: 'critical',
        targetEntity: `${revokeModalStaff.name} (${revokeModalStaff.id})`,
        targetId: revokeModalStaff.id,
        details: `Acesso revogado pelo Super Admin. Motivo: ${revokeReason}`,
      });
    }

    setRevokeModalStaff(null);
  };

  const handleToggleStatus = (staff: AdminStaffMember) => {
    const nextStatus = staff.status === 'active' ? 'suspended' : 'active';
    const updated: AdminStaffMember = {
      ...staff,
      status: nextStatus,
    };
    onUpdateStaff(updated);

    if (onLogAuditAction) {
      onLogAuditAction({
        action: 'admin_status_changed',
        actionLabel: `Administrador ${nextStatus === 'active' ? 'Reativado' : 'Suspenso'}`,
        category: 'admin_management',
        severity: 'warning',
        targetEntity: `${staff.name} (${staff.id})`,
        targetId: staff.id,
        details: `Estado alterado de ${staff.status} para ${nextStatus}.`,
      });
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery);
    const matchDept = selectedDept === 'all' || s.department === selectedDept;
    const matchStatus = selectedStatus === 'all' || s.status === selectedStatus;
    return matchSearch && matchDept && matchStatus;
  });

  const getRoleBadge = (level: AdminAccessLevel) => {
    switch (level) {
      case 'super_admin':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-900 text-amber-400 border border-slate-700 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            Super Admin
          </span>
        );
      case 'moderator':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <Shield className="w-3 h-3 text-amber-500" />
            Moderador IA
          </span>
        );
      case 'finance_manager':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-600" />
            Gestor Financeiro
          </span>
        );
      case 'support_agent':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-600" />
            Suporte Bissau
          </span>
        );
      case 'events_coordinator':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-purple-600" />
            Coord. Eventos
          </span>
        );
    }
  };

  const getStatusBadge = (status: 'active' | 'suspended' | 'revoked') => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ativo
          </span>
        );
      case 'suspended':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Suspenso
          </span>
        );
      case 'revoked':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Revogado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-blue-950 text-blue-300 text-xs px-3 py-1 rounded-full border border-blue-800 font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Segurança & Controlo de Acessos</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">
            Gestão de Administradores & Equipa
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Painel exclusivo do Super Admin para criação, monitorização, alteração de permissões e revogação de acessos dos funcionários da equipa Guigui.com / Grupo Gorila.
          </p>
        </div>

        <button type="button"
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl transition shadow-md flex items-center gap-2 self-start md:self-auto shrink-0 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('admin.createAdmin')}</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total de Administradores
          </div>
          <div className="text-2xl font-black tabular-nums text-[var(--color-text-strong)] mt-1">
            {staffList.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Equipa Guigui / Gorila</div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Administradores Ativos
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {staffList.filter((s) => s.status === 'active').length}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Com credenciais válidas</div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Com 2FA Ativo
          </div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {staffList.filter((s) => s.twoFactorEnabled).length} / {staffList.length}
          </div>
          <div className="text-[10px] text-blue-600 mt-0.5">Autenticação em 2 etapas</div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Acessos Revogados
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {staffList.filter((s) => s.status === 'revoked' || s.status === 'suspended').length}
          </div>
          <div className="text-[10px] text-red-500 mt-0.5">Suspensos ou expirados</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] flex flex-col md:flex-row items-center justify-between gap-3 p-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t('search')}...`}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >

            <option value="Diretoria Executiva">Diretoria Executiva</option>
            <option value="Moderação & Conteúdo">Moderação & Conteúdo</option>
            <option value="Financeiro & Contabilidade">Financeiro & Contabilidade</option>
            <option value="Suporte & Operações">Suporte & Operações</option>
            <option value="Comercial & Parcerias">Comercial & Parcerias</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >

            <option value="active">Apenas Ativos</option>
            <option value="suspended">Suspensos</option>
            <option value="revoked">Revogados</option>
          </select>
        </div>
      </div>

      {/* Staff Members Table */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                <th className="py-3.5 px-4">Administrador / Funcionário</th>
                <th className="py-3.5 px-4">Departamento</th>
                <th className="py-3.5 px-4">Nível de Acesso</th>
                <th className="py-3.5 px-4">Permissões Chave</th>
                <th className="py-3.5 px-4">Segurança (2FA)</th>
                <th className="py-3.5 px-4">Último Acesso</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t('admin.noAdmins')}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={staff.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={staff.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            {staff.name}
                            {staff.accessLevel === 'super_admin' && (
                              <span className="text-[9px] bg-slate-900 text-amber-400 px-1.5 py-0.2 rounded font-black">
                                GORILA
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {staff.email}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {staff.phone}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{staff.department}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{getRoleBadge(staff.accessLevel)}</td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {staff.permissions.manageBusinesses && (
                          <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                            Empresas
                          </span>
                        )}
                        {staff.permissions.contentModeration && (
                          <span className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            Moderação IA
                          </span>
                        )}
                        {staff.permissions.financialAudit && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            Finanças
                          </span>
                        )}
                        {staff.permissions.viewAuditLogs && (
                          <span className="text-[9px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                            {t('admin.auditLogs')}
                          </span>
                        )}
                        {staff.permissions.manageAdmins && (
                          <span className="text-[9px] bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded font-bold">
                            Gestão Admins
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {staff.twoFactorEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Ativo (SMS/App)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          Pendente
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {staff.lastLoginAt || 'Nunca'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(staff.status)}</td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button"
                          onClick={() => handleOpenEdit(staff)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition"
                          title="Editar Perfil & Permissões"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button type="button"
                          onClick={() => handleToggleStatus(staff)}
                          className={`p-1.5 rounded-lg transition ${
                            staff.status === 'active'
                              ? 'hover:bg-amber-50 text-slate-600 hover:text-amber-700'
                              : 'hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'
                          }`}
                          title={staff.status === 'active' ? 'Suspender Acesso' : 'Reativar Acesso'}
                        >
                          {staff.status === 'active' ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {staff.accessLevel !== 'super_admin' && (
                          <button type="button"
                            onClick={() => setRevokeModalStaff(staff)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
                            title="Revogar Acesso Definitivamente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Criar / Editar Administrador */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingStaff ? t('admin.editAdmin') : t('admin.createAdmin')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Equipa de Gestão Guigui.com / Grupo Gorila
                  </p>
                </div>
              </div>
              <button type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
              {/* Presets de Cargo */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase text-[10px]">
                  Nível de Acesso / Modelo de Cargo:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'moderator', label: 'Moderador de Conteúdo', icon: Shield },
                    { id: 'finance_manager', label: 'Gestor Financeiro', icon: ShieldCheck },
                    { id: 'support_agent', label: 'Suporte & Operações', icon: Users },
                    { id: 'events_coordinator', label: 'Coord. de Eventos', icon: UserCheck },
                    { id: 'super_admin', label: 'Super Admin (Gorila)', icon: Lock },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleAccessLevelPreset(preset.id as AdminAccessLevel)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                        formAccessLevel === preset.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-extrabold shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <preset.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Informações Pessoais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('name')}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Institucional *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder={t('email')}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telemóvel (Guiné-Bissau) *</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder={t('phone')}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Departamento</label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value as AdminDepartment)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                  >
                    <option value="Diretoria Executiva">Diretoria Executiva</option>
                    <option value="Moderação & Conteúdo">Moderação & Conteúdo</option>
                    <option value="Financeiro & Contabilidade">Financeiro & Contabilidade</option>
                    <option value="Suporte & Operações">Suporte & Operações</option>
                    <option value="Comercial & Parcerias">Comercial & Parcerias</option>
                    <option value="TI & Infraestrutura">TI & Infraestrutura</option>
                  </select>
                </div>
              </div>

              {/* Matriz de Permissões Granulares */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider mb-2">
                  Permissões Granulares de Acesso:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'manageBusinesses', label: 'Gerir e Aprovar Empresas' },
                    { key: 'contentModeration', label: 'Moderação de Posts & Conteúdo IA' },
                    { key: 'financialAudit', label: 'Auditoria de Pagamentos & Orange Money' },
                    { key: 'managePricing', label: 'Alteração da Matriz de Preços XOF' },
                    { key: 'viewAuditLogs', label: 'Visualizar Logs de Auditoria do Sistema' },
                    { key: 'exportReports', label: 'Exportar Relatórios (PDF/Excel)' },
                    { key: 'validateTickets', label: 'Validação de Bilhetes & QR Tokens' },
                    { key: 'manageAdmins', label: 'Criar e Revogar Administradores' },
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-100/60"
                    >
                      <input
                        type="checkbox"
                        checked={formPermissions[perm.key as keyof typeof formPermissions]}
                        onChange={(e) =>
                          setFormPermissions({
                            ...formPermissions,
                            [perm.key]: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-bold text-slate-800 text-[11px]">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingStaff ? t('admin.saveChanges') : t('admin.createAdminAction')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revogar Acesso com Confirmação */}
      {revokeModalStaff && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900">
                Revogar Acesso de Administrador?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Esta ação revogará imediatamente as credenciais de <b>{revokeModalStaff.name}</b> ({revokeModalStaff.email}).
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {t('admin.revokeReason')}
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button"
                onClick={() => setRevokeModalStaff(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                {t('cancel')}
              </button>
              <button type="button"
                onClick={handleConfirmRevoke}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs transition shadow-md"
              >
                Confirmar Revogação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
