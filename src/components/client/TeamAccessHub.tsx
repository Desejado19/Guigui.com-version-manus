import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { Business, BusinessTeamMember, Language, TeamAction, TeamModuleAccess, TeamAccessStatus, UserProfile } from '../../types';
import {
  BUSINESS_ACCESS_MODULES,
  BUSINESS_ACCESS_PRESETS,
  TEAM_ACTION_LABELS,
  accessPresetById,
  grantedModules,
  legacyPermissionsFromAccess,
} from '../../config/teamAccess';
import { AdminPagination } from '../admin/AdminPagination';
import { usePaginatedList } from '../../hooks/usePaginatedList';

/**
 * Equipa e permissões (empresa).
 *
 * Contas reais por colaborador com acesso por módulo e acções granulares.
 * Todas as operações passam pelo servidor (`/api/business/team/*`), que valida
 * a autorização e registra as alterações na auditoria.
 */

interface TeamAccessHubProps {
  business: Business;
  currentUser: UserProfile;
  currentLang?: Language;
}

interface AccessActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  targetName: string | null;
  createdAt: string;
  scope: string;
}

type ApiMember = {
  userId: string;
  businessId: string;
  name: string;
  email: string;
  phone: string;
  jobTitle?: string;
  role: string;
  status: TeamAccessStatus;
  access: TeamModuleAccess;
  createdAt: string;
  lastActiveAt?: string;
};

interface ApiInvitation {
  id: string;
  email: string;
  name: string;
  jobTitle?: string;
  role: string;
  status: string;
  expiresAt: string;
  access: TeamModuleAccess;
}

const INVITATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  expired: 'Expirado',
  accepted: 'Aceite',
  revoked: 'Revogado',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendente',
  invited: 'Convite pendente',
  suspended: 'Suspenso',
  disabled: 'Desactivado',
};

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  invited: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  suspended: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
  disabled: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const ACTION_LABELS = TEAM_ACTION_LABELS;

function toMember(member: ApiMember): BusinessTeamMember {
  return {
    id: member.userId,
    businessId: member.businessId,
    name: member.name,
    email: member.email,
    phone: member.phone,
    role: member.role,
    status: member.status,
    permissions: legacyPermissionsFromAccess(member.access),
    access: member.access,
    jobTitle: member.jobTitle,
    createdAt: member.createdAt,
    lastActiveAt: member.lastActiveAt,
  };
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-PT') : '—';
}

const AccessMatrix: React.FC<{
  access: TeamModuleAccess;
  onChange: (next: TeamModuleAccess) => void;
  disabled?: boolean;
}> = ({ access, onChange, disabled }) => {
  const toggleModule = (moduleId: string, checked: boolean) => {
    const next = { ...access };
    if (!checked) {
      delete next[moduleId];
    } else {
      const module = BUSINESS_ACCESS_MODULES.find((candidate) => candidate.id === moduleId);
      next[moduleId] = module ? [...module.actions] : ['view'];
    }
    onChange(next);
  };
  const toggleAction = (moduleId: string, action: TeamAction) => {
    const current = access[moduleId] || [];
    const nextActions = current.includes(action)
      ? current.filter((item) => item !== action)
      : [...current, action];
    const next = { ...access };
    if (nextActions.length === 0) delete next[moduleId];
    else next[moduleId] = nextActions;
    onChange(next);
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="team-access-matrix">
      {BUSINESS_ACCESS_MODULES.map((module) => {
        const actions = access[module.id] || [];
        const enabled = actions.includes('view');
        return (
          <div key={module.id} className={`rounded-xl border p-2.5 ${enabled ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-[var(--color-border-subtle)] bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={enabled}
                disabled={disabled}
                onChange={(event) => toggleModule(module.id, event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--color-border-default)]"
              />
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">{module.label}</span>
            </label>
            {enabled && (
              <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                {module.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleAction(module.id, action)}
                    aria-pressed={actions.includes(action)}
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold transition ${actions.includes(action) ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}
                  >
                    {ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const TeamAccessHub: React.FC<TeamAccessHubProps> = ({ business, currentUser }) => {
  const [members, setMembers] = useState<BusinessTeamMember[]>([]);
  const [activity, setActivity] = useState<AccessActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessTeamMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [invitations, setInvitations] = useState<ApiInvitation[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [presetId, setPresetId] = useState('custom');
  const [access, setAccess] = useState<TeamModuleAccess>({});

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setJobTitle('');
    setPresetId('custom');
    setAccess({});
    setEditing(null);
    setFormOpen(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersResponse, activityResponse] = await Promise.all([
        fetch('/api/business/team/members', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/business/team/activity?limit=30', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (membersResponse.status === 403) {
        setError('Não tem autorização para consultar a equipa desta empresa.');
        setMembers([]);
        return;
      }
      if (!membersResponse.ok) throw new Error(`HTTP ${membersResponse.status}`);
      const payload = await membersResponse.json() as { members?: ApiMember[] };
      setMembers((payload.members || []).map(toMember));
      const invitationResponse = await fetch('/api/team/invitations', { credentials: 'include', cache: 'no-store' });
      if (invitationResponse.ok) {
        const invitationPayload = await invitationResponse.json() as { invitations?: ApiInvitation[] };
        setInvitations(invitationPayload.invitations || []);
      }
      if (activityResponse.ok) {
        const activityPayload = await activityResponse.json() as { entries?: AccessActivityEntry[] };
        setActivity(activityPayload.entries || []);
      }
    } catch {
      setError('Não foi possível carregar a equipa. Verifique a ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    resetForm();
    setInviteLink(null);
    setFormOpen(true);
  };

  const openEdit = (member: BusinessTeamMember) => {
    setInviteLink(null);
    setEditing(member);
    setName(member.name);
    setEmail(member.email);
    setPassword('');
    setJobTitle(member.jobTitle || '');
    setPresetId(member.role || 'custom');
    setAccess(member.access || {});
    setFormOpen(true);
  };

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = accessPresetById('business', id);
    if (preset) setAccess(JSON.parse(JSON.stringify(preset.access)) as TeamModuleAccess);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name,
        email,
        password,
        jobTitle,
        role: presetId,
        access,
      };
      const response = editing
        ? await fetch(`/api/business/team/members/${editing.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        : await fetch('/api/team/invitations', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, jobTitle, role: presetId, access }),
        });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        member?: ApiMember;
        delivery?: { mode: 'sent' | 'simulated'; activationUrl: string };
      };
      if (!response.ok) {
        setError(payload.error || 'Não foi possível guardar o colaborador.');
        return;
      }
      if (!editing && payload.delivery) {
        setInviteLink(payload.delivery.activationUrl);
        setNotice(payload.delivery.mode === 'sent'
          ? `Convite enviado para ${email}.`
          : `Convite de ${name} registado. O e-mail não está configurado, use o link de ativação abaixo.`);
      } else {
        setNotice('Acessos do colaborador actualizados.');
      }
      resetForm();
      await load();
    } catch {
      setError('Falha de rede ao guardar o colaborador.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (member: BusinessTeamMember, status: 'active' | 'suspended') => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/business/team/members/${member.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || 'Não foi possível alterar o estado da conta.');
        return;
      }
      setNotice(status === 'suspended'
        ? `${member.name} suspenso e sessões encerradas.`
        : `${member.name} reactivado.`);
      await load();
    } catch {
      setError('Falha de rede ao alterar o estado da conta.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: BusinessTeamMember) => {
    if (!window.confirm(`Remover ${member.name} da equipa? As sessões activas serão encerradas.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/business/team/members/${member.id}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || 'Não foi possível remover o colaborador.');
        return;
      }
      setNotice(`${member.name} removido da equipa.`);
      await load();
    } catch {
      setError('Falha de rede ao remover o colaborador.');
    } finally {
      setBusy(false);
    }
  };

  const resendInvitation = async (invitation: ApiInvitation) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/team/invitations/${invitation.id}/resend`, { method: 'POST', credentials: 'include' });
      const payload = await response.json().catch(() => ({})) as { error?: string; delivery?: { mode: 'sent' | 'simulated'; activationUrl: string } };
      if (!response.ok) {
        setError(payload.error || 'Não foi possível reenviar o convite.');
        return;
      }
      if (payload.delivery) {
        setInviteLink(payload.delivery.activationUrl);
        setNotice(payload.delivery.mode === 'sent'
          ? `Convite reenviado para ${invitation.email}.`
          : `Novo link gerado para ${invitation.email}. O e-mail não está configurado.`);
      }
      await load();
    } catch {
      setError('Falha de rede ao reenviar o convite.');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvitation = async (invitation: ApiInvitation) => {
    if (!window.confirm(`Revogar o convite de ${invitation.name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/team/invitations/${invitation.id}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || 'Não foi possível revogar o convite.');
        return;
      }
      setNotice(`Convite de ${invitation.name} revogado.`);
      await load();
    } catch {
      setError('Falha de rede ao revogar o convite.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter !== 'all' && member.status !== statusFilter) return false;
      if (!needle) return true;
      return [member.name, member.email, member.jobTitle, member.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [members, query, statusFilter]);

  const pagination = usePaginatedList(filtered, {
    initialPageSize: 20,
    pageSizeOptions: [20, 50],
    persist: false,
    resetKey: `${query}|${statusFilter}`,
  });

  const activeCount = members.filter((member) => member.status === 'active').length;
  const restrictedCount = members.filter((member) => grantedModules(member.access || {}).length < BUSINESS_ACCESS_MODULES.length).length;

  return (
    <div className="space-y-4" data-testid="team-access-hub">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Equipa e permissões
            </div>
            <h2 className="mt-2 text-lg font-black text-[var(--color-text-strong)] dark:text-white">Acessos de {business.name}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--color-text-muted)] dark:text-slate-300">
              Cada colaborador tem conta própria e vê apenas os módulos autorizados. As permissões são validadas no servidor em cada pedido.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="text-lg font-black text-slate-900 dark:text-white">{activeCount}</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Activos</div>
            </div>
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="text-lg font-black text-slate-900 dark:text-white">{members.length}</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Contas</div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={openCreate} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-emerald-800">
            <UserPlus className="h-4 w-4" /> Criar colaborador
          </button>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-1.5 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </section>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}

      {formOpen && (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
              {editing ? <KeyRound className="h-4 w-4 text-emerald-600" /> : <Plus className="h-4 w-4 text-emerald-600" />}
              {editing ? `Editar acessos de ${editing.name}` : 'Convidar colaborador'}
            </h3>
            <button type="button" onClick={resetForm} className="rounded-lg border border-[var(--color-border-default)] p-1.5 text-slate-500 dark:border-slate-600" aria-label="Fechar formulário">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <form className="mt-3 space-y-3" onSubmit={submit}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Nome completo
                <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">E-mail de acesso
                <input required type="email" value={email} disabled={Boolean(editing)} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 text-xs font-bold text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Cargo / função
                <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Ex.: Gestor de eventos" className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              {editing && (
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Nova palavra-passe (opcional)
                  <input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </label>
              )}
            </div>
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Função predefinida (modelo de permissões)
              <select value={presetId} onChange={(event) => applyPreset(event.target.value)} className="mt-1 min-h-9 w-full max-w-sm rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 text-xs font-black text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                {BUSINESS_ACCESS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{BUSINESS_ACCESS_PRESETS.find((preset) => preset.id === presetId)?.description}</p>
            <AccessMatrix access={access} onChange={setAccess} disabled={busy} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">
                <Check className="h-4 w-4" /> {editing ? 'Guardar acessos' : 'Enviar convite'}
              </button>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {Object.keys(access).length} módulo(s) autorizado(s)
              </span>
            </div>
          </form>
        </section>
      )}

      {inviteLink && (
        <section className="rounded-[var(--radius-xl)] border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30" data-testid="business-invite-link">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-800 dark:text-amber-200">Link de ativação (partilhe apenas com o colaborador)</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <input readOnly value={inviteLink} className="min-h-9 min-w-[240px] flex-1 rounded-xl border border-amber-300 bg-white px-2.5 text-[11px] font-bold text-slate-800 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100" />
            <button type="button" onClick={() => void navigator.clipboard?.writeText(inviteLink)} className="inline-flex min-h-9 items-center rounded-xl border border-amber-400 px-3 text-[10px] font-black text-amber-900 dark:text-amber-200">
              Copiar
            </button>
          </div>
        </section>
      )}

      {invitations.length > 0 && (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-3 dark:border-slate-700 dark:bg-slate-900" data-testid="business-team-invitations">
          <h3 className="text-xs font-black text-slate-900 dark:text-white">Convites de colaboradores</h3>
          <ul className="mt-2 space-y-1.5">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[11px] dark:border-slate-700">
                <div className="min-w-[200px] flex-1">
                  <p className="font-black text-slate-900 dark:text-white">{invitation.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{invitation.email}{invitation.jobTitle ? ` · ${invitation.jobTitle}` : ''}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {grantedModules(invitation.access).map((moduleId) => (
                      <span key={moduleId} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {BUSINESS_ACCESS_MODULES.find((module) => module.id === moduleId)?.label || moduleId}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {INVITATION_STATUS_LABELS[invitation.status] || invitation.status}
                </span>
                {['pending', 'sent', 'expired'].includes(invitation.status) && (
                  <div className="flex gap-1.5">
                    <button type="button" disabled={busy} onClick={() => void resendInvitation(invitation)} className="inline-flex min-h-8 items-center rounded-lg border border-emerald-300 px-2 text-[10px] font-black text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">
                      <RefreshCw className="h-3 w-3" /> Reenviar
                    </button>
                    <button type="button" disabled={busy} onClick={() => void revokeInvitation(invitation)} className="inline-flex min-h-8 items-center rounded-lg border border-rose-300 px-2 text-[10px] font-black text-rose-700 dark:border-rose-900 dark:text-rose-300">
                      <Trash2 className="h-3 w-3" /> Revogar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Colaboradores</h3>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Contas individuais, com estado e módulos autorizados.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar nome, e-mail ou cargo" className="min-h-9 w-52 rounded-xl border border-[var(--color-border-default)] bg-white pl-7 pr-2 text-[11px] font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado" className="min-h-9 rounded-xl border border-[var(--color-border-default)] bg-white px-2 text-[11px] font-black text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              <option value="all">Todos os estados</option>
              <option value="active">Activos</option>
              <option value="pending">Pendentes</option>
              <option value="suspended">Suspensos</option>
              <option value="disabled">Desactivados</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">A carregar equipa…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-[var(--color-border-default)] bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <Users className="mx-auto h-6 w-6 text-slate-500" />
            <p className="mt-2 text-xs font-black text-slate-700 dark:text-slate-200">Sem colaboradores para os filtros actuais</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Crie a primeira conta com os módulos que essa função necesita.</p>
          </div>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {pagination.pageItems.map((member) => {
                const modules = grantedModules(member.access || {});
                return (
                  <article key={member.id} className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-[200px] flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{member.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${STATUS_TONE[member.status] || STATUS_TONE.active}`}>
                            {STATUS_LABELS[member.status] || member.status}
                          </span>
                          {member.role && member.role !== 'custom' && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{member.role}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {member.email}{member.jobTitle ? ` · ${member.jobTitle}` : ''} · criado em {formatDateTime(member.createdAt)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {modules.length === 0 ? (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Sem módulos autorizados</span>
                          ) : modules.map((moduleId) => {
                            const module = BUSINESS_ACCESS_MODULES.find((candidate) => candidate.id === moduleId);
                            return (
                              <span key={moduleId} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                                {module?.label || moduleId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => openEdit(member)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--color-border-default)] px-2 py-1 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
                          <KeyRound className="h-3 w-3" /> Acessos
                        </button>
                        {member.status === 'active' ? (
                          <button type="button" disabled={busy} onClick={() => void changeStatus(member, 'suspended')} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-[10px] font-black text-amber-800 dark:border-amber-800 dark:text-amber-200">
                            <Pause className="h-3 w-3" /> Suspender
                          </button>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => void changeStatus(member, 'active')} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[10px] font-black text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">
                            <Play className="h-3 w-3" /> Reactivar
                          </button>
                        )}
                        <button type="button" disabled={busy} onClick={() => void remove(member)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-[10px] font-black text-rose-700 dark:border-rose-900 dark:text-rose-300">
                          <Trash2 className="h-3 w-3" /> Remover
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <AdminPagination
              className="mt-3"
              currentLang="pt"
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          </>
        )}
        {restrictedCount > 0 && (
          <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> {restrictedCount} conta(s) com acesso parcial a módulos.
          </p>
        )}
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><Clock className="h-4 w-4 text-slate-500" /> Histórico de alterações de acesso</h3>
        {activity.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Ainda não há alterações registadas. Cada criação, edição, suspensão ou remoção fica aqui registada.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            {activity.slice(0, 12).map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 py-1 first:border-t-0 dark:border-slate-700">
                <span>
                  <strong className="text-slate-800 dark:text-slate-100">{entry.actorName || 'Sistema'}</strong>
                  {' · '}{entry.action.replace(/_/g, ' ')}
                  {entry.targetName ? ` · ${entry.targetName}` : ''}
                </span>
                <span>{formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-slate-500">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        A conta titular mantém sempre acesso total. Só ela, ou um colaborador com permissão de gestão de equipa, pode alterar acessos.
        {currentUser.role === 'business' ? ' A sua conta está autenticada como conta da empresa.' : ''}
      </p>
    </div>
  );
};

export default TeamAccessHub;
