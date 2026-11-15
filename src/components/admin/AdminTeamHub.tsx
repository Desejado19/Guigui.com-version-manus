import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type { AdminStaffMember, Language, TeamAccessStatus, TeamAction, TeamModuleAccess } from '../../types';
import {
  ADMIN_ACCESS_MODULES,
  ADMIN_ACCESS_PRESETS,
  TEAM_ACTION_LABELS,
  accessPresetById,
  grantedModules,
} from '../../config/teamAccess';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { AdminPagination } from './AdminPagination';

/**
 * Equipa administrativa da plataforma.
 *
 * Contas reais (`users.role = 'admin'`) com acesso por módulo administrativo.
 * A autorização é aplicada no servidor; esta área apenas apresenta e edita o
 * que o servidor devolve. A conta do administrador principal mantém acesso
 * total e não é editável por esta via.
 */

interface AdminTeamHubProps {
  currentLang?: Language;
}

interface ApiAdminMember {
  userId: string;
  name: string;
  email: string;
  phone: string;
  jobTitle?: string;
  role: string;
  status: TeamAccessStatus;
  access: TeamModuleAccess;
  createdAt: string;
  lastActiveAt?: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendente',
  suspended: 'Suspenso',
  disabled: 'Desactivado',
};

export const AdminTeamHub: React.FC<AdminTeamHubProps> = () => {
  const [members, setMembers] = useState<AdminStaffMember[]>([]);
  const [rawMembers, setRawMembers] = useState<ApiAdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminStaffMember | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [presetId, setPresetId] = useState('staff');
  const [access, setAccess] = useState<TeamModuleAccess>({});

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setJobTitle('');
    setPresetId('staff');
    setAccess({});
    setEditing(null);
    setFormOpen(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/team/members', { credentials: 'include', cache: 'no-store' });
      if (response.status === 403) {
        setError('Não tem autorização para consultar a equipa administrativa.');
        setMembers([]);
        setRawMembers([]);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { members?: ApiAdminMember[] };
      const list = payload.members || [];
      setRawMembers(list);
      setMembers(list.map((member) => ({
        id: member.userId,
        name: member.name,
        email: member.email,
        phone: member.phone,
        department: 'Financeiro & Contabilidade',
        accessLevel: member.role === 'admin' ? 'super_admin' : 'moderator',
        status: member.status === 'active' ? 'active' : member.status === 'suspended' ? 'suspended' : 'revoked',
        permissions: {
          manageBusinesses: grantedModules(member.access).includes('businesses'),
          contentModeration: grantedModules(member.access).includes('moderation'),
          financialAudit: grantedModules(member.access).includes('financials'),
          manageAdmins: grantedModules(member.access).includes('admin_staff'),
          viewAuditLogs: grantedModules(member.access).includes('audit_logs'),
          exportReports: grantedModules(member.access).includes('reports'),
          managePricing: grantedModules(member.access).includes('pricing'),
          validateTickets: grantedModules(member.access).includes('events'),
        },
        twoFactorEnabled: false,
        lastLoginAt: member.lastActiveAt,
        createdAt: member.createdAt,
        createdBy: 'platform',
      })));
    } catch {
      setError('Não foi possível carregar a equipa administrativa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accessForMember = (id: string): TeamModuleAccess => {
    const match = rawMembers.find((member) => member.userId === id);
    return match?.access || {};
  };

  const openCreate = () => {
    resetForm();
    const preset = accessPresetById('admin', 'staff');
    setAccess(preset ? JSON.parse(JSON.stringify(preset.access)) as TeamModuleAccess : {});
    setFormOpen(true);
  };

  const openEdit = (member: AdminStaffMember) => {
    setEditing(member);
    setName(member.name);
    setEmail(member.email);
    setPassword('');
    setJobTitle(rawMembers.find((item) => item.userId === member.id)?.jobTitle || '');
    setPresetId(rawMembers.find((item) => item.userId === member.id)?.role || 'staff');
    setAccess(accessForMember(member.id));
    setFormOpen(true);
  };

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = accessPresetById('admin', id);
    if (preset) setAccess(JSON.parse(JSON.stringify(preset.access)) as TeamModuleAccess);
  };

  const toggleModule = (moduleId: string, checked: boolean) => {
    const next = { ...access };
    if (!checked) delete next[moduleId];
    else {
      const module = ADMIN_ACCESS_MODULES.find((candidate) => candidate.id === moduleId);
      next[moduleId] = module ? [...module.actions] : ['view'];
    }
    setAccess(next);
  };

  const toggleAction = (moduleId: string, action: TeamAction) => {
    const current = access[moduleId] || [];
    const nextActions = current.includes(action) ? current.filter((item) => item !== action) : [...current, action];
    const next = { ...access };
    if (nextActions.length === 0) delete next[moduleId];
    else next[moduleId] = nextActions;
    setAccess(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(editing ? `/api/admin/team/members/${editing.id}` : '/api/admin/team/members', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, jobTitle, preset: presetId, access }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || 'Não foi possível guardar o membro da equipa.');
        return;
      }
      setNotice(editing ? 'Acessos actualizados.' : `Conta administrativa de ${name} criada.`);
      resetForm();
      await load();
    } catch {
      setError('Falha de rede ao guardar o membro da equipa.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (member: AdminStaffMember, status: 'active' | 'suspended') => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/team/members/${member.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error || 'Não foi possível alterar o estado.');
        return;
      }
      setNotice(status === 'suspended' ? `${member.name} suspenso e sessões encerradas.` : `${member.name} reactivado.`);
      await load();
    } catch {
      setError('Falha de rede ao alterar o estado.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: AdminStaffMember) => {
    if (!window.confirm(`Revogar o acesso de ${member.name}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/team/members/${member.id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error || 'Não foi possível revogar o acesso.');
        return;
      }
      setNotice(`${member.name} deixou de ter acesso administrativo.`);
      await load();
    } catch {
      setError('Falha de rede ao revogar o acesso.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => [member.name, member.email].some((value) => value.toLowerCase().includes(needle)));
  }, [members, query]);

  const paginated = usePaginatedList(filtered, {
    resetKey: query,
  });

  return (
    <div className="space-y-4" data-testid="admin-team-hub">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Equipa administrativa
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Contas individuais com módulos administrativos autorizados. A conta principal mantém acesso total.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openCreate} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white">
            <Plus className="h-4 w-4" /> Criar conta
          </button>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}

      {formOpen && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
              <KeyRound className="h-4 w-4 text-emerald-600" /> {editing ? `Editar acessos de ${editing.name}` : 'Nova conta administrativa'}
            </h3>
            <button type="button" onClick={resetForm} aria-label="Fechar formulário" className="rounded-lg border border-slate-300 p-1.5 text-slate-500 dark:border-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <form className="mt-3 space-y-3" onSubmit={submit}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Nome completo
                <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">E-mail
                <input required type="email" disabled={Boolean(editing)} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Cargo
                <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">{editing ? 'Nova palavra-passe (opcional)' : 'Palavra-passe inicial'}
                <input type="password" required={!editing} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
            </div>
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Função predefinida
              <select value={presetId} onChange={(event) => applyPreset(event.target.value)} className="mt-1 min-h-9 w-full max-w-sm rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-black text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                {ADMIN_ACCESS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{ADMIN_ACCESS_PRESETS.find((preset) => preset.id === presetId)?.description}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ADMIN_ACCESS_MODULES.map((module) => {
                const actions = access[module.id] || [];
                const enabled = actions.includes('view');
                return (
                  <div key={module.id} className={`rounded-xl border p-2.5 ${enabled ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={enabled} onChange={(event) => toggleModule(module.id, event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                      <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">{module.label}</span>
                    </label>
                    {enabled && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                        {module.actions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => toggleAction(module.id, action)}
                            aria-pressed={actions.includes(action)}
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${actions.includes(action) ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                          >
                            {TEAM_ACTION_LABELS[action]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-60">
              <Check className="h-4 w-4" /> {editing ? 'Guardar acessos' : 'Criar conta'}
            </button>
          </form>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar administrador" className="min-h-9 w-56 rounded-xl border border-slate-300 bg-white pl-7 pr-2 text-[11px] font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
        </label>
        <span className="text-[10px] font-black uppercase text-slate-500">{members.length} conta(s)</span>
      </div>

      {loading ? (
        <p className="text-xs font-bold text-slate-500">A carregar equipa…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Sem contas administrativas.</p>
      ) : (
        <div className="space-y-2">
          {paginated.pageItems.map((member) => {
            const modules = grantedModules(accessForMember(member.id));
            const raw = rawMembers.find((item) => item.userId === member.id);
            return (
              <article key={member.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 dark:text-white">{member.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {STATUS_LABELS[raw?.status || 'active']}
                      </span>
                      {modules.length === 0 && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">Acesso total</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      {member.email}{raw?.jobTitle ? ` · ${raw.jobTitle}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {modules.map((moduleId) => (
                        <span key={moduleId} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                          {ADMIN_ACCESS_MODULES.find((module) => module.id === moduleId)?.label || moduleId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => openEdit(member)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
                      <UserCheck className="h-3 w-3" /> Acessos
                    </button>
                    {raw?.status === 'active' ? (
                      <button type="button" disabled={busy} onClick={() => void changeStatus(member, 'suspended')} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-[10px] font-black text-amber-800 dark:border-amber-800 dark:text-amber-200">
                        <Pause className="h-3 w-3" /> Suspender
                      </button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => void changeStatus(member, 'active')} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[10px] font-black text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">
                        <Play className="h-3 w-3" /> Reactivar
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => void remove(member)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-[10px] font-black text-rose-700 dark:border-rose-900 dark:text-rose-300">
                      <Trash2 className="h-3 w-3" /> Revogar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AdminPagination
        currentPage={paginated.page}
        pageSize={paginated.pageSize}
        totalItems={paginated.totalItems}
        onPageChange={paginated.setPage}
        onPageSizeChange={paginated.setPageSize}
      />
    </div>
  );
};

export default AdminTeamHub;
