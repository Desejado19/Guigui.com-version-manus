import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Download, Eye, KeyRound, Mail, MapPin, Pencil, Phone, Save, ShieldCheck, ShieldOff, UserRound, X } from 'lucide-react';
import { AdminPagination } from '../AdminPagination';
import { exportManagementCsv, exportManagementPdf } from './managementExports';
import { formatManagementDate, useManagementListState } from './managementState';
import {
  ManagementActionButton,
  ManagementFilter,
  ManagementPage,
  ManagementTable,
  ManagementToolbar,
  type ManagementColumn,
} from './ManagementUi';

type CitizenMode = 'all' | 'user' | 'business' | 'admin' | 'suspended';
type CitizenFilterKey = 'status' | 'dateFrom' | 'dateTo';

interface AdminCitizen {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  neighborhood?: string | null;
  avatarUrl?: string | null;
  role: 'user' | 'business' | 'admin';
  accountStatus: 'active' | 'deactivated';
  accountStatusReason?: string | null;
  statusChangedAt?: string | null;
  birthDate?: string | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

interface CitizenDetail {
  user: AdminCitizen;
  company: { id: string; name: string } | null;
  counts: { orders: number; notifications: number; active_sessions: number };
}

interface CitizenActivityEntry {
  id: string;
  timestamp: string;
  action: string;
  result: string;
  reason?: string | null;
  actorId?: string | null;
  actorName?: string;
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface CitizenActivity {
  activity: CitizenActivityEntry[];
  sessions: Array<{ id: string; last_seen_at: string; ip_address?: string | null; user_agent?: string | null }>;
}

const MODE_META: Record<CitizenMode, { title: string; description: string; role?: AdminCitizen['role']; status?: string }> = {
  all: { title: 'Visão geral de utilizadores', description: 'Todas as contas da plataforma num único local: cidadãos, empresas e administradores, com pesquisa, filtros e paginação servida pela base de dados.' },
  user: { title: 'Cidadãos', description: 'Contas de cidadão registadas na plataforma. Consulte, edite e gira o estado de cada conta com rastreabilidade completa.', role: 'user' },
  business: { title: 'Empresas', description: 'Contas com papel empresarial. A gestão do negócio continua no módulo Empresas & Negócios; aqui apenas se consulta a conta.', role: 'business' },
  admin: { title: 'Administradores', description: 'Contas com acesso administrativo. A gestão de permissões é feita no módulo Equipa.', role: 'admin' },
  suspended: { title: 'Contas suspensas', description: 'Contas com acesso suspenso. Consulte o motivo, o responsável e o histórico da suspensão.', status: 'deactivated' },
};

const inputClass =
  'w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-[11px] font-medium text-slate-800 outline-none transition focus:border-[var(--color-focus-ring)] focus:ring-2 focus:ring-[var(--color-focus-ring)]/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export const CitizensManagementPage: React.FC<{ mode: CitizenMode; onBack: () => void }> = ({ mode, onBack }) => {
  const meta = MODE_META[mode];
  const { state, setQuery, setFilter, setSort, setPage, setPageSize, reset } = useManagementListState<CitizenFilterKey>(
    `admin.management.users.${mode}`,
    { status: meta.status || 'all', dateFrom: '', dateTo: '' },
    'createdAt',
    'desc',
  );

  const [debouncedQuery, setDebouncedQuery] = useState(state.query);
  const [users, setUsers] = useState<AdminCitizen[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [detail, setDetail] = useState<CitizenDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [detailTab, setDetailTab] = useState<'profile' | 'activity'>('profile');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activity, setActivity] = useState<CitizenActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [detailFeedback, setDetailFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    avatarUrl: '',
    neighborhood: '',
    birthDate: '',
    accountStatus: 'active' as 'active' | 'deactivated',
    reason: '',
  });

  const detailRequestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(state.query), 300);
    return () => clearTimeout(timer);
  }, [state.query]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim());
    if (meta.role) params.set('role', meta.role);
    if (state.filters.status && state.filters.status !== 'all') params.set('status', state.filters.status);
    if (state.filters.dateFrom) params.set('dateFrom', state.filters.dateFrom);
    if (state.filters.dateTo) params.set('dateTo', state.filters.dateTo);
    params.set('sort', state.sortKey || 'createdAt');
    params.set('direction', state.sortDirection);
    return params;
  }, [debouncedQuery, meta.role, state.filters, state.sortDirection, state.sortKey]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(queryString);
        params.set('limit', String(state.pageSize));
        params.set('offset', String((state.page - 1) * state.pageSize));
        const response = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include', signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as contas.');
        setUsers(Array.isArray(data.users) ? data.users : []);
        setTotal(Number(data.total || 0));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar as contas.');
        setUsers([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [queryString, state.page, state.pageSize]);

  const openDetail = async (userId: string, nextMode: 'view' | 'edit') => {
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    setDetailOpen(true);
    setDetailMode(nextMode);
    setDetailTab('profile');
    setDetail(null);
    setActivity(null);
    setDetailError(null);
    setDetailFeedback(null);
    setDetailLoading(true);
    setActivityLoading(true);
    try {
      const [detailResponse, activityResponse] = await Promise.all([
        fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { credentials: 'include' }),
        fetch(`/api/admin/users/${encodeURIComponent(userId)}/activity`, { credentials: 'include' }),
      ]);
      const detailData = await detailResponse.json().catch(() => ({}));
      const activityData = await activityResponse.json().catch(() => ({}));
      if (detailRequestId.current !== requestId) return;
      if (!detailResponse.ok) throw new Error(detailData.error || 'Não foi possível abrir a ficha.');
      setDetail(detailData);
      setForm({
        name: detailData.user.name || '',
        avatarUrl: detailData.user.avatarUrl || '',
        neighborhood: detailData.user.neighborhood || '',
        birthDate: detailData.user.birthDate ? String(detailData.user.birthDate).slice(0, 10) : '',
        accountStatus: detailData.user.accountStatus === 'deactivated' ? 'deactivated' : 'active',
        reason: '',
      });
      if (activityResponse.ok) setActivity(activityData);
    } catch (openError) {
      if (detailRequestId.current !== requestId) return;
      setDetailError(openError instanceof Error ? openError.message : 'Falha ao abrir a ficha.');
    } finally {
      if (detailRequestId.current === requestId) {
        setDetailLoading(false);
        setActivityLoading(false);
      }
    }
  };

  const closeDetail = () => {
    detailRequestId.current += 1;
    setDetailOpen(false);
    setDetail(null);
    setActivity(null);
    setDetailMode('view');
  };

  const refreshDetail = async (userId: string) => {
    const [detailResponse, activityResponse] = await Promise.all([
      fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { credentials: 'include' }),
      fetch(`/api/admin/users/${encodeURIComponent(userId)}/activity`, { credentials: 'include' }),
    ]);
    const detailData = await detailResponse.json().catch(() => ({}));
    const activityData = await activityResponse.json().catch(() => ({}));
    if (detailResponse.ok && detailData.user) {
      setDetail(detailData);
      setUsers((current) => current.map((user) => (user.id === detailData.user.id ? { ...user, ...detailData.user } : user)));
      setForm((current) => ({ ...current, accountStatus: detailData.user.accountStatus === 'deactivated' ? 'deactivated' : 'active', reason: '' }));
    }
    if (activityResponse.ok) setActivity(activityData);
  };

  const validateForm = (): string | null => {
    if (form.name.trim().length < 2 || form.name.trim().length > 120) return 'O nome deve ter entre 2 e 120 caracteres.';
    if (!form.neighborhood.trim()) return 'A localização é obrigatória.';
    if (form.avatarUrl.trim() && !/^https?:\/\//i.test(form.avatarUrl.trim()) && !/^data:image\//i.test(form.avatarUrl.trim())) {
      return 'A fotografia deve ser um URL de imagem válido.';
    }
    if (form.birthDate) {
      const parsed = new Date(`${form.birthDate}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) return 'A data de nascimento não é válida.';
    }
    if (form.accountStatus === 'deactivated' && form.reason.trim().length < 3) {
      return 'Indique o motivo da suspensão (mínimo 3 caracteres).';
    }
    return null;
  };

  const saveChanges = async () => {
    if (!detail) return;
    const validationError = validateForm();
    if (validationError) {
      setDetailFeedback({ tone: 'error', message: validationError });
      return;
    }
    setSaving(true);
    setDetailFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(detail.user.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          avatarUrl: form.avatarUrl.trim(),
          neighborhood: form.neighborhood.trim(),
          birthDate: form.birthDate,
          accountStatus: form.accountStatus,
          reason: form.reason.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível guardar as alterações.');
      await refreshDetail(detail.user.id);
      setDetailMode('view');
      setDetailFeedback({ tone: 'success', message: 'Alterações guardadas e registadas na auditoria.' });
      setFeedback('Alterações guardadas.');
    } catch (saveError) {
      setDetailFeedback({ tone: 'error', message: saveError instanceof Error ? saveError.message : 'Falha ao guardar as alterações.' });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (nextStatus: 'active' | 'deactivated') => {
    if (!detail) return;
    let reason = '';
    if (nextStatus === 'deactivated') {
      const input = window.prompt('Motivo da suspensão da conta (mínimo 3 caracteres):');
      if (input === null) return;
      if (input.trim().length < 3) {
        setDetailFeedback({ tone: 'error', message: 'Indique um motivo com pelo menos 3 caracteres.' });
        return;
      }
      reason = input.trim();
    }
    setActionBusy(true);
    setDetailFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(detail.user.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: nextStatus, reason: reason || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar o estado da conta.');
      await refreshDetail(detail.user.id);
      setDetailFeedback({ tone: 'success', message: nextStatus === 'deactivated' ? 'Conta suspensa. As sessões ativas foram revogadas.' : 'Conta reativada.' });
    } catch (statusError) {
      setDetailFeedback({ tone: 'error', message: statusError instanceof Error ? statusError.message : 'Falha ao alterar o estado.' });
    } finally {
      setActionBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!detail) return;
    if (!window.confirm(`Iniciar o processo seguro de redefinição de credenciais para ${detail.user.name}?`)) return;
    setActionBusy(true);
    setDetailFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(detail.user.id)}/request-password-reset`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível iniciar a redefinição.');
      setDetailFeedback({ tone: 'success', message: data.message || 'Processo de redefinição iniciado.' });
      await refreshDetail(detail.user.id);
    } catch (resetError) {
      setDetailFeedback({ tone: 'error', message: resetError instanceof Error ? resetError.message : 'Falha ao iniciar a redefinição.' });
    } finally {
      setActionBusy(false);
    }
  };

  const exportAll = async (format: 'csv' | 'pdf') => {
    try {
      const params = new URLSearchParams(queryString);
      params.set('limit', '200');
      params.set('offset', '0');
      const response = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível exportar.');
      const rows: AdminCitizen[] = Array.isArray(data.users) ? data.users : [];
      const headers = ['ID', 'Nome', 'Email', 'Telefone', 'Localização', 'Papel', 'Estado', 'Registo'];
      const cells = rows.map((user) => [
        user.id,
        user.name,
        user.email,
        user.phone || '',
        user.neighborhood || '',
        user.role,
        user.accountStatus === 'active' ? 'Ativa' : 'Suspensa',
        formatManagementDate(user.createdAt),
      ]);
      const filename = `utilizadores-${mode}-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        exportManagementCsv(`${filename}.csv`, headers, cells);
      } else {
        exportManagementPdf({
          title: `Relatório de ${meta.title} — Guigui.com`,
          description: `${rows.length} conta(s) exportada(s) com os filtros atuais.`,
          kpis: [
            { label: 'Total exportado', value: String(rows.length) },
            { label: 'Ativas', value: String(rows.filter((user) => user.accountStatus === 'active').length) },
            { label: 'Suspensas', value: String(rows.filter((user) => user.accountStatus === 'deactivated').length) },
          ],
          headers,
          rows: cells,
        });
      }
    } catch (exportError) {
      setFeedback(exportError instanceof Error ? exportError.message : 'Falha ao exportar.');
    }
  };

  const canManage = mode === 'user' || mode === 'all';
  const columns: Array<ManagementColumn<AdminCitizen>> = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
      render: (user) => (
        <div className="flex min-w-[200px] items-center gap-2">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-[var(--color-border-default)] object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound className="h-4 w-4" /></div>
          )}
          <div className="min-w-0">
            <div className="truncate font-black text-slate-900">{user.name}</div>
            <div className="truncate text-[9.5px] text-slate-500">{user.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (user) => (
        <div className="min-w-[180px]">
          <div className="flex items-center gap-1 text-[10.5px]"><Mail className="h-3 w-3 text-slate-400" />{user.email}</div>
          {user.phone && <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-slate-500"><Phone className="h-3 w-3" />{user.phone}</div>}
        </div>
      ),
    },
    {
      key: 'neighborhood',
      label: 'Localização',
      render: (user) => <span className="flex items-center gap-1 text-[10.5px]"><MapPin className="h-3 w-3 text-slate-400" />{user.neighborhood || '—'}</span>,
    },
    {
      key: 'role',
      label: 'Papel',
      sortable: true,
      render: (user) => <span className="rounded-md border border-[var(--color-border-default)] bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">{user.role === 'user' ? 'Cidadão' : user.role === 'business' ? 'Empresa' : 'Admin'}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: (user) => (
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${user.accountStatus === 'active' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'}`}>
          {user.accountStatus === 'active' ? 'Ativa' : 'Suspensa'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Registo',
      sortable: true,
      render: (user) => <span className="whitespace-nowrap text-[10px] tabular-nums text-slate-500">{formatManagementDate(user.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Ações',
      className: 'text-right',
      render: (user) => (
        <div className="flex flex-wrap justify-end gap-1">
          <ManagementActionButton onClick={() => void openDetail(user.id, 'view')}><Eye className="h-3.5 w-3.5" /> Ver</ManagementActionButton>
          {canManage && user.role === 'user' && <ManagementActionButton tone="primary" onClick={() => void openDetail(user.id, 'edit')}><Pencil className="h-3.5 w-3.5" /> Editar</ManagementActionButton>}
        </div>
      ),
    },
  ];

  const renderDetail = () => {
    if (detailLoading) return <div className="py-10 text-center text-[11px] font-bold text-slate-500">A carregar ficha…</div>;
    if (detailError) return <div role="alert" className="rounded-xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] p-3 text-[11px] font-bold text-[var(--tone-danger-text)]">{detailError}</div>;
    if (!detail) return null;
    const user = detail.user;
    const isCitizen = user.role === 'user';

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-12 w-12 rounded-full border border-[var(--color-border-default)] object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound className="h-5 w-5" /></div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-slate-900">{user.name}</h3>
              <p className="truncate text-[10px] text-slate-500">{user.email} · {user.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${user.accountStatus === 'active' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'}`}>
              {user.accountStatus === 'active' ? 'Conta ativa' : 'Conta suspensa'}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${user.emailVerifiedAt ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'border-[var(--color-border-default)] bg-slate-50 text-slate-600'}`}>
              Email: {user.emailVerifiedAt ? 'verificado' : 'não verificado'}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${user.phoneVerifiedAt ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'border-[var(--color-border-default)] bg-slate-50 text-slate-600'}`}>
              Telefone: {user.phoneVerifiedAt ? 'verificado' : 'não verificado'}
            </span>
          </div>
        </div>

        {detailFeedback && (
          <div role="status" className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${detailFeedback.tone === 'success' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'}`}>
            {detailFeedback.message}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setDetailTab('profile')} className={`rounded-full px-3 py-1.5 text-[10px] font-black ${detailTab === 'profile' ? 'bg-[#123e3b] text-white' : 'bg-slate-100 text-slate-600'}`}>Perfil</button>
          <button type="button" onClick={() => setDetailTab('activity')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black ${detailTab === 'activity' ? 'bg-[#123e3b] text-white' : 'bg-slate-100 text-slate-600'}`}>
            <Activity className="h-3 w-3" /> Histórico ({activity?.activity.length ?? 0})
          </button>
        </div>

        {detailTab === 'profile' ? (
          <>
            <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
              {[
                ['Compras', String(detail.counts.orders)],
                ['Notificações', String(detail.counts.notifications)],
                ['Sessões ativas', String(detail.counts.active_sessions)],
                ['Empresa associada', detail.company?.name || '—'],
                ['Registado em', formatManagementDate(user.createdAt)],
                ['Atualizado em', formatManagementDate(user.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50/60 p-2.5">
                  <dt className="text-[8.5px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</dt>
                  <dd className="mt-0.5 font-bold text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>

            {user.accountStatus === 'deactivated' && user.accountStatusReason && (
              <p className="rounded-xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)]/60 p-3 text-[10.5px] text-[var(--tone-danger-text)]">
                <strong>Motivo da suspensão:</strong> {user.accountStatusReason}
                {user.statusChangedAt ? ` · ${formatManagementDate(user.statusChangedAt)}` : ''}
              </p>
            )}

            {detailMode === 'edit' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Nome completo</span>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Fotografia de perfil (URL)</span>
                    <input value={form.avatarUrl} onChange={(event) => setForm((current) => ({ ...current, avatarUrl: event.target.value }))} placeholder="https://…" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Email (requer verificação)</span>
                    <input value={user.email} readOnly disabled className={inputClass} />
                    <span className="text-[9px] text-slate-500">Alterações de email são feitas apenas pelo cidadão após verificação.</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Telefone (requer verificação)</span>
                    <input value={user.phone || ''} readOnly disabled className={inputClass} />
                    <span className="text-[9px] text-slate-500">Alterações de telefone exigem verificação pelo próprio cidadão.</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Data de nascimento</span>
                    <input type="date" value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Localização</span>
                    <input value={form.neighborhood} onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Estado da conta</span>
                    <select value={form.accountStatus} onChange={(event) => setForm((current) => ({ ...current, accountStatus: event.target.value as 'active' | 'deactivated' }))} className={inputClass}>
                      <option value="active">Ativa</option>
                      <option value="deactivated">Suspensa</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Motivo (obrigatório ao suspender)</span>
                    <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={500} className={inputClass} />
                  </label>
                </div>
                <p className="rounded-xl border border-[var(--color-border-default)] bg-slate-50 p-2.5 text-[10px] text-slate-600">
                  Alterações autorizadas: nome, fotografia, data de nascimento, localização e estado da conta. Palavras-passe nunca são visíveis nem editáveis.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <ManagementActionButton onClick={() => setDetailMode('view')} disabled={saving}>Cancelar</ManagementActionButton>
                  <ManagementActionButton tone="primary" onClick={() => void saveChanges()} disabled={saving}>
                    <Save className="h-3.5 w-3.5" /> {saving ? 'A guardar…' : 'Guardar alterações'}
                  </ManagementActionButton>
                </div>
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-2">
                  {[
                    ['Nome completo', user.name],
                    ['Email', user.email],
                    ['Telefone', user.phone],
                    ['Data de nascimento', user.birthDate ? formatManagementDate(user.birthDate) : '—'],
                    ['Localização', user.neighborhood],
                    ['Papel', user.role],
                    ['Motivo do estado', user.accountStatusReason || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
                {canManage && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border-subtle)] pt-3">
                    {isCitizen && user.accountStatus === 'active' ? (
                      <ManagementActionButton tone="warning" onClick={() => void changeStatus('deactivated')} disabled={actionBusy}>
                        <ShieldOff className="h-3.5 w-3.5" /> Suspender conta
                      </ManagementActionButton>
                    ) : isCitizen ? (
                      <ManagementActionButton tone="success" onClick={() => void changeStatus('active')} disabled={actionBusy}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Reativar conta
                      </ManagementActionButton>
                    ) : null}
                    {isCitizen && (
                      <ManagementActionButton onClick={() => void requestPasswordReset()} disabled={actionBusy}>
                        <KeyRound className="h-3.5 w-3.5" /> Redefinir credenciais
                      </ManagementActionButton>
                    )}
                    {isCitizen && (
                      <ManagementActionButton tone="primary" onClick={() => setDetailMode('edit')}>
                        <Pencil className="h-3.5 w-3.5" /> Editar cidadão
                      </ManagementActionButton>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {activityLoading ? (
              <p className="py-6 text-center text-[11px] text-slate-500">A carregar histórico…</p>
            ) : (
              <>
                <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                  {(activity?.activity || []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-[11px] text-slate-500">Ainda não existem atividades registadas.</p>
                  ) : (activity?.activity || []).map((entry) => (
                    <article key={entry.id} className="rounded-xl border border-[var(--color-border-default)] p-2.5 text-[10.5px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-slate-800">{entry.action.replace(/_/g, ' ')}</span>
                        <span className="whitespace-nowrap text-[9px] text-slate-400">{formatManagementDate(entry.timestamp)}</span>
                      </div>
                      <div className="mt-0.5 text-[9.5px] text-slate-500">
                        {entry.actorName || 'Sistema'} {entry.actorId ? `(${entry.actorId})` : ''} · {entry.result}
                      </div>
                      {entry.changedFields.length > 0 && <div className="mt-1 text-[9.5px] text-slate-600">Campos: {entry.changedFields.join(', ')}</div>}
                      {entry.reason && <div className="mt-1 rounded-lg bg-slate-50 p-1.5 text-[9.5px] text-slate-600">Motivo: {entry.reason}</div>}
                      {entry.before && entry.after && (
                        <details className="mt-1 text-[9.5px] text-slate-500">
                          <summary className="cursor-pointer font-bold">Ver antes/depois</summary>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-2">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
                <div>
                  <h4 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Sessões recentes</h4>
                  {(activity?.sessions || []).length === 0 ? (
                    <p className="text-[10.5px] text-slate-500">Sem sessões registadas.</p>
                  ) : (activity?.sessions || []).map((session) => (
                    <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] py-1.5 text-[10px]">
                      <span className="font-mono">{session.ip_address || 'IP desconhecido'}</span>
                      <span className="max-w-[240px] truncate text-slate-500">{session.user_agent || 'Dispositivo desconhecido'}</span>
                      <span className="text-slate-400">{formatManagementDate(session.last_seen_at)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <ManagementPage
      title={meta.title}
      description={meta.description}
      moduleLabel="Utilizadores"
      onBack={onBack}
      actions={
        <>
          <ManagementActionButton onClick={() => void exportAll('csv')}><Download className="h-3.5 w-3.5" /> CSV</ManagementActionButton>
          <ManagementActionButton onClick={() => void exportAll('pdf')}><Download className="h-3.5 w-3.5" /> PDF</ManagementActionButton>
        </>
      }
    >
      {feedback && <div role="status" className="rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-[11px] font-bold text-slate-700">{feedback}</div>}

      <ManagementToolbar
        query={state.query}
        onQueryChange={setQuery}
        placeholder="Pesquisar por nome, email ou telefone…"
        totalLabel={loading ? 'A carregar contas…' : `${total} conta(s) encontrada(s)`}
        onReset={reset}
      >
        <ManagementFilter
          label="Estado"
          value={state.filters.status || 'all'}
          onChange={(value) => setFilter('status', value)}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Ativas' },
            { value: 'deactivated', label: 'Suspensas' },
          ]}
        />
        <label className="flex min-w-[130px] flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Registo desde</span>
          <input type="date" value={state.filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} className={inputClass} />
        </label>
        <label className="flex min-w-[130px] flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Até</span>
          <input type="date" value={state.filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} className={inputClass} />
        </label>
      </ManagementToolbar>

      {error && <div role="alert" className="rounded-xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-danger-text)]">{error}</div>}

      <ManagementTable
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        sortKey={state.sortKey}
        sortDirection={state.sortDirection}
        onSort={setSort}
        emptyMessage={loading ? 'A carregar contas…' : 'Nenhuma conta encontrada com os filtros atuais.'}
      />

      <AdminPagination
        currentPage={state.page}
        pageSize={state.pageSize}
        totalItems={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[20, 30, 50, 100, 200]}
      />

      {detailOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${detail?.user.name || 'cidadão'}`}>
          <div className="my-6 w-full max-w-4xl rounded-2xl border border-[var(--color-border-default)] bg-white shadow-2xl">
            <div className="flex justify-end border-b border-[var(--color-border-subtle)] px-4 py-2">
              <button type="button" onClick={closeDetail} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fechar ficha"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[76vh] overflow-y-auto p-4">{renderDetail()}</div>
          </div>
        </div>
      )}
    </ManagementPage>
  );
};
