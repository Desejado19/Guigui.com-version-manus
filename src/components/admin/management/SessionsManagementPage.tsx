import React, { useEffect, useMemo, useState } from 'react';
import { formatManagementDate } from './managementState';
import { RecordsManagementPage } from './RecordsManagementPage';
import { ManagementActionButton } from './ManagementUi';

interface AdminSessionRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  derivedStatus: 'active' | 'expired' | 'revoked';
}

const ROLE_LABELS: Record<string, string> = {
  user: 'Cidadão',
  business: 'Empresa',
  admin: 'Administrador',
};

const STATUS_LABELS: Record<AdminSessionRow['derivedStatus'], string> = {
  active: 'Ativa',
  expired: 'Expirada',
  revoked: 'Revogada',
};

interface SessionsManagementPageProps {
  onBack: () => void;
}

export const SessionsManagementPage: React.FC<SessionsManagementPageProps> = ({ onBack }) => {
  const [rows, setRows] = useState<AdminSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/sessions', { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as sessões.');
      const now = Date.now();
      const sessions: AdminSessionRow[] = (data.sessions || []).map((session: Omit<AdminSessionRow, 'derivedStatus'>) => ({
        ...session,
        derivedStatus: session.revoked_at
          ? 'revoked'
          : new Date(session.expires_at).getTime() <= now ? 'expired' : 'active',
      }));
      setRows(sessions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar as sessões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const revoke = async (session: AdminSessionRow) => {
    if (!window.confirm(`Revogar a sessão de ${session.user_name || session.user_email}? O utilizador terá de iniciar sessão novamente.`)) return;
    setBusyId(session.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/sessions/${encodeURIComponent(session.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível revogar a sessão.');
      setRows((current) => current.map((row) => (row.id === session.id ? { ...row, revoked_at: new Date().toISOString(), derivedStatus: 'revoked' } : row)));
      setFeedback('Sessão revogada.');
    } catch (revokeError) {
      setFeedback(revokeError instanceof Error ? revokeError.message : 'Falha ao revogar a sessão.');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => ({
    active: rows.filter((row) => row.derivedStatus === 'active').length,
    expired: rows.filter((row) => row.derivedStatus === 'expired').length,
    revoked: rows.filter((row) => row.derivedStatus === 'revoked').length,
    users: new Set(rows.map((row) => row.user_id)).size,
  }), [rows]);

  return (
    <RecordsManagementPage<AdminSessionRow>
      title="Sessões e dispositivos"
      description="Sessões autenticadas registadas na base de dados, com utilizador, função, IP, dispositivo, última atividade e estado. É possível revogar uma sessão ativa."
      moduleLabel="Equipa"
      storageKey="admin.management.sessions"
      onBack={onBack}
      rows={rows}
      rowKey={(row) => row.id}
      searchPlaceholder="Pesquisar por utilizador, email, IP ou dispositivo…"
      searchFields={(row) => [row.user_name, row.user_email, row.ip_address, row.user_agent, row.user_id, row.id]}
      filters={[
        { key: 'status', label: 'Estado', options: [
          { value: 'all', label: 'Todas' },
          { value: 'active', label: 'Ativas' },
          { value: 'expired', label: 'Expiradas' },
          { value: 'revoked', label: 'Revogadas' },
        ] },
        { key: 'role', label: 'Função', options: [
          { value: 'all', label: 'Todas' },
          { value: 'user', label: 'Cidadãos' },
          { value: 'business', label: 'Empresas' },
          { value: 'admin', label: 'Administradores' },
        ] },
      ]}
      matchesFilters={(row, filters) => (
        (filters.status === 'all' || row.derivedStatus === filters.status)
        && (filters.role === 'all' || row.user_role === filters.role)
      )}
      sortValue={(row, key) => {
        if (key === 'created_at') return row.created_at ? new Date(row.created_at).getTime() : 0;
        if (key === 'expires_at') return row.expires_at ? new Date(row.expires_at).getTime() : 0;
        return row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
      }}
      defaultSortKey="last_seen_at"
      columns={[
        {
          key: 'user_name',
          label: 'Utilizador',
          sortable: true,
          render: (row) => (
            <div className="min-w-[190px]">
              <div className="truncate font-black text-slate-900">{row.user_name || row.user_email}</div>
              <div className="truncate text-[9.5px] text-slate-500">{row.user_email} · {ROLE_LABELS[row.user_role] || row.user_role}</div>
            </div>
          ),
        },
        { key: 'ip_address', label: 'IP', render: (row) => <span className="font-mono text-[10px]">{row.ip_address || '—'}</span> },
        { key: 'user_agent', label: 'Dispositivo', render: (row) => <span className="block max-w-[220px] truncate text-[10px] text-slate-600" title={row.user_agent || ''}>{row.user_agent || '—'}</span> },
        { key: 'created_at', label: 'Início', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatManagementDate(row.created_at)}</span> },
        { key: 'last_seen_at', label: 'Última atividade', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatManagementDate(row.last_seen_at)}</span> },
        { key: 'expires_at', label: 'Expira', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatManagementDate(row.expires_at)}</span> },
        { key: 'status', label: 'Estado', render: (row) => (
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${
            row.derivedStatus === 'active' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
              : row.derivedStatus === 'expired' ? 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]'
                : 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'
          }`}>{STATUS_LABELS[row.derivedStatus]}</span>
        ) },
      ]}
      rowActions={(row) => (
        <ManagementActionButton
          tone="danger"
          disabled={row.derivedStatus !== 'active' || busyId === row.id}
          onClick={() => void revoke(row)}
        >
          Revogar
        </ManagementActionButton>
      )}
      kpis={[
        { label: 'Sessões carregadas', value: rows.length, tone: 'info' },
        { label: 'Ativas', value: counts.active, tone: 'success' },
        { label: 'Expiradas', value: counts.expired, tone: 'warning' },
        { label: 'Revogadas', value: counts.revoked, tone: 'danger' },
        { label: 'Utilizadores distintos', value: counts.users, tone: 'neutral' },
      ]}
      notice={
        <>
          {loading && <div className="rounded-xl border border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-info-text)]">A carregar sessões…</div>}
          {error && <div role="alert" className="rounded-xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-danger-text)]">{error}</div>}
          {feedback && <div role="status" className="rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-[11px] font-bold text-slate-700">{feedback}</div>}
        </>
      }
      exportSpec={{
        filename: `sessoes-guigui-${new Date().toISOString().slice(0, 10)}`,
        sheet: 'Sessões',
        title: 'Relatório de Sessões — Guigui.com',
        description: 'Sessões autenticadas após aplicação dos filtros atuais.',
        headers: ['ID', 'Utilizador', 'Email', 'Função', 'IP', 'Dispositivo', 'Início', 'Última atividade', 'Expira', 'Estado'],
        row: (row) => [row.id, row.user_name, row.user_email, ROLE_LABELS[row.user_role] || row.user_role, row.ip_address || '', row.user_agent || '', formatManagementDate(row.created_at), formatManagementDate(row.last_seen_at), formatManagementDate(row.expires_at), STATUS_LABELS[row.derivedStatus]],
        pdfKpis: [
          { label: 'Sessões', value: String(rows.length) },
          { label: 'Ativas', value: String(counts.active) },
          { label: 'Revogadas', value: String(counts.revoked) },
        ],
      }}
      detailLabel={(row) => `Sessão de ${row.user_name || row.user_email}`}
      detail={(row) => (
        <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
          {[
            ['ID da sessão', row.id],
            ['Utilizador', `${row.user_name} (${row.user_email})`],
            ['Função', ROLE_LABELS[row.user_role] || row.user_role],
            ['IP', row.ip_address],
            ['Dispositivo', row.user_agent],
            ['Início', formatManagementDate(row.created_at)],
            ['Última atividade', formatManagementDate(row.last_seen_at)],
            ['Expira', formatManagementDate(row.expires_at)],
            ['Revogada em', formatManagementDate(row.revoked_at)],
            ['Estado', STATUS_LABELS[row.derivedStatus]],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
              <div className="mt-0.5 break-words font-medium text-slate-700">{value || '—'}</div>
            </div>
          ))}
        </div>
      )}
    />
  );
};
