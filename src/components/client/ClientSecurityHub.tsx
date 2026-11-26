import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { Business, Language, UserProfile } from '../../types';
import { SubmoduleNavbar } from '../navigation/SubmoduleNavbar';
import { AdminPagination } from '../admin/AdminPagination';

/**
 * Centro de segurança da conta empresarial.
 *
 * Responsabilidades: proteger a conta (palavra-passe, recuperação), mostrar e
 * encerrar sessões, listar a trilha de auditoria da própria conta e derivar
 * alertas a partir desses dados reais. A gestão de funções dos funcionários
 * mantém-se no módulo «Equipa e permissões».
 */

type SecuritySection = 'protecao' | 'sessoes' | 'historico' | 'alertas';

interface SecuritySession {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface SecurityEvent {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  result: string;
  reason: string | null;
  createdAt: string;
}

interface ClientSecurityHubProps {
  business: Business;
  currentUser: UserProfile;
  currentLang?: Language;
}

const SECTION_TABS: SecuritySection[] = ['protecao', 'sessoes', 'historico', 'alertas'];

const SECTION_LABELS: Record<SecuritySection, string> = {
  protecao: 'Proteção da conta',
  sessoes: 'Sessões e dispositivos',
  historico: 'Histórico de segurança',
  alertas: 'Alertas',
};

const EVENT_LABELS: Record<string, string> = {
  login: 'Início de sessão',
  logout: 'Fim de sessão',
  login_failed: 'Tentativa de autenticação falhada',
  password_changed: 'Palavra-passe alterada',
  change_password: 'Palavra-passe alterada',
  sessions_revoked_all: 'Todas as sessões encerradas',
  session_revoked: 'Sessão encerrada',
  mfa_enabled: 'Autenticação de dois fatores activada',
  mfa_disabled: 'Autenticação de dois factores desactivada',
  account_deactivated: 'Conta desactivada',
  business_team_invited: 'Convite de equipa enviado',
  permissions_changed: 'Permissões alteradas',
};

function formatDateTime(value?: string | null, lang: Language = 'pt'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(lang === 'pt' ? 'pt-PT' : lang, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Descrição legível do dispositivo a partir do user-agent da sessão. */
function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: 'Dispositivo desconhecido', mobile: false };
  const browser = /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\/|Opera/.test(userAgent) ? 'Opera'
      : /Firefox\//.test(userAgent) ? 'Firefox'
        : /Chrome\//.test(userAgent) ? 'Chrome'
          : /Safari\//.test(userAgent) ? 'Safari'
            : 'Navegador';
  const system = /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
      : /Windows/.test(userAgent) ? 'Windows'
        : /Mac OS X/.test(userAgent) ? 'macOS'
          : /Linux/.test(userAgent) ? 'Linux'
            : 'Sistema desconhecido';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/.test(userAgent);
  return { label: `${browser} · ${system}`, mobile };
}

function eventLabel(action: string): string {
  return EVENT_LABELS[action] || action.replace(/_/g, ' ');
}

export const ClientSecurityHub: React.FC<ClientSecurityHubProps> = ({ business, currentUser, currentLang = 'pt' as Language }) => {
  const [section, setSection] = useState<SecuritySection>('protecao');

  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsSource, setEventsSource] = useState<string>('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const response = await fetch('/api/auth/sessions', { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) {
        setSessionsError('A sessão expirou. Inicie sessão novamente.');
        setSessions([]);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { sessions?: SecuritySession[] };
      setSessions(payload.sessions || []);
    } catch {
      setSessionsError('Não foi possível carregar as sessões activas.');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async (page = 1, search = '', pageSize = 20) => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/security/events?${params.toString()}`, { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) {
        setEventsError('A sessão expirou. Inicie sessão novamente.');
        setEvents([]);
        setHistoryTotal(0);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { events?: SecurityEvent[]; source?: string; total?: number };
      setEvents(payload.events || []);
      setEventsSource(payload.source || '');
      setHistoryTotal(Number(payload.total ?? 0));
    } catch {
      setEventsError('Não foi possível carregar o histórico de segurança.');
      setHistoryTotal(0);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Pesquisa e paginação são resolvidas no servidor (20 registos por omissão).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEvents(historyPage, historyQuery, historyPageSize);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [historyPage, historyQuery, historyPageSize, loadEvents]);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordNotice(null);
    if (newPassword.length < 6) {
      setPasswordNotice({ tone: 'error', text: 'A nova palavra-passe precisa de pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ tone: 'error', text: 'A confirmação não coincide com a nova palavra-passe.' });
      return;
    }
    setPasswordBusy(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) {
        setPasswordNotice({ tone: 'error', text: payload.error || 'Não foi possível alterar a palavra-passe.' });
        return;
      }
      setPasswordNotice({ tone: 'success', text: payload.message || 'Palavra-passe actualizada com sucesso.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      void loadEvents(historyPage, historyQuery, historyPageSize);
    } catch {
      setPasswordNotice({ tone: 'error', text: 'Falha de rede ao alterar a palavra-passe.' });
    } finally {
      setPasswordBusy(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setBusySessionId(sessionId);
    setSessionsError(null);
    try {
      const response = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setSessionsError(payload.error || 'Não foi possível encerrar a sessão.');
        return;
      }
      setSessions((previous) => previous.filter((session) => session.id !== sessionId));
      void loadEvents(historyPage, historyQuery, historyPageSize);
    } catch {
      setSessionsError('Falha de rede ao encerrar a sessão.');
    } finally {
      setBusySessionId(null);
    }
  };

  const revokeAll = async () => {
    if (!window.confirm('Encerrar todas as sessões, incluindo esta? Terá de iniciar sessão novamente.')) return;
    setBusySessionId('all');
    try {
      const response = await fetch('/api/auth/sessions/revoke-all', { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        setSessionsError('Não foi possível encerrar as sessões.');
        return;
      }
      window.location.reload();
    } catch {
      setSessionsError('Falha de rede ao encerrar as sessões.');
    } finally {
      setBusySessionId(null);
    }
  };

  const alerts = useMemo(() => {
    const items: Array<{ tone: 'info' | 'warning' | 'success'; title: string; detail: string }> = [];
    const failures = events.filter((event) => event.result === 'failure');
    if (failures.length > 0) {
      items.push({
        tone: 'warning',
        title: `${failures.length} tentativa(s) de autenticação falhada`,
        detail: `Última em ${formatDateTime(failures[0].createdAt, currentLang)}. Confirme se reconhece a origem.`,
      });
    }
    if (sessions.length > 1) {
      items.push({
        tone: 'info',
        title: `${sessions.length} sessões activas`,
        detail: 'Se não reconhece algum dispositivo, encerre essa sessão na secção «Sessões e dispositivos».',
      });
    }
    const recent = sessions.find((session) => !session.current && Date.now() - Date.parse(session.createdAt) < 24 * 60 * 60 * 1000);
    if (recent) {
      items.push({
        tone: 'info',
        title: 'Novo dispositivo nas últimas 24 horas',
        detail: `${describeDevice(recent.userAgent).label} · ${recent.ipAddress || 'origem não registada'}.`,
      });
    }
    const passwordChanged = events.find((event) => /password/i.test(event.action));
    if (!passwordChanged) {
      items.push({
        tone: 'info',
        title: 'Recomendação: reveja a palavra-passe',
        detail: 'Não há registo recente de alteração de palavra-passe nesta conta.',
      });
    } else {
      items.push({
        tone: 'success',
        title: 'Palavra-passe alterada com registo',
        detail: `Última alteração em ${formatDateTime(passwordChanged.createdAt, currentLang)}.`,
      });
    }
    items.push({
      tone: 'success',
      title: 'Sessão actual protegida por cookie HttpOnly',
      detail: 'O token de sessão não é exposto ao JavaScript da aplicação.',
    });
    return items;
  }, [events, sessions, currentLang]);

  const filteredEvents = events;

  const sectionCounts = {
    protecao: undefined,
    sessoes: sessions.length,
    historico: historyTotal,
    alertas: alerts.filter((alert) => alert.tone === 'warning').length,
  } as Record<string, number | undefined>;

  const passwordChecklist = [
    { label: 'Palavra-passe própria da conta empresarial', done: true },
    { label: 'Sessão protegida por cookie HttpOnly', done: true },
    { label: 'Alteração de palavra-passe registada na auditoria', done: events.some((event) => /password/i.test(event.action)) },
    { label: 'Sem tentativas de autenticação falhadas recentes', done: !events.some((event) => event.result === 'failure') },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Shield className="h-3.5 w-3.5" /> Segurança
            </div>
            <h2 className="mt-2 text-lg font-black text-[var(--color-text-strong)] dark:text-white">Proteção e acessos de {business.name}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--color-text-muted)] dark:text-slate-300">
              Conta, sessões activas e histórico de segurança da conta empresarial. A gestão de funções dos funcionários continua em «Equipa e permissões».
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="text-lg font-black text-slate-900 dark:text-white">{sessions.length}</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Sessões</div>
            </div>
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="text-lg font-black text-slate-900 dark:text-white">{alerts.filter((alert) => alert.tone === 'warning').length}</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Alertas</div>
            </div>
          </div>
        </div>
      </section>

      <SubmoduleNavbar
        currentTab={section}
        onTabChange={(tab) => setSection(tab as SecuritySection)}
        tabs={SECTION_TABS as unknown as string[]}
        tabLabels={SECTION_LABELS}
        showCounts
        counts={sectionCounts}
        wrap
        ariaLabel="Secções de segurança"
      />

      {section === 'protecao' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><KeyRound className="h-4 w-4 text-emerald-600" /> Alterar palavra-passe</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">A conta é <strong>{currentUser.email}</strong>. A alteração fica registada no histórico de segurança.</p>
            <form className="mt-3 max-w-xl space-y-3" onSubmit={changePassword}>
              <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300">Palavra-passe actual
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300">Nova palavra-passe
                  <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </label>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300">Confirmar nova palavra-passe
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </label>
              </div>
              <button type="submit" disabled={passwordBusy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">
                <Lock className="h-4 w-4" /> {passwordBusy ? 'A guardar…' : 'Alterar palavra-passe'}
              </button>
              {passwordNotice && (
                <p role={passwordNotice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-xs font-bold ${passwordNotice.tone === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200' : 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
                  {passwordNotice.text}
                </p>
              )}
            </form>

            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-700">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Recuperação e redefinição de acesso</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Se perder o acesso, use «Esqueci-me da palavra-passe» no ecrã de início de sessão: o servidor envia um código de redefinição para {currentUser.email}.
                O e-mail de recuperação é o mesmo da conta e não pode ser alterado a partir do painel da empresa.
              </p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Autenticação de dois fatores</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                O 2FA existe apenas para contas de administração; a conta empresarial autentica com palavra-passe e sessão assinada.
                Não é apresentada nenhuma opção inactiva para não sugerir uma protecção que o servidor não aplica.
              </p>
            </div>
          </section>

          <aside className="space-y-3">
            <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800">
              <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Verificação da conta</h4>
              <ul className="mt-2 space-y-2">
                {passwordChecklist.map((item) => (
                  <li key={item.label} className="flex items-start gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {item.done
                      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800">
              <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100"><Clock className="h-4 w-4 text-slate-500" /> Último acesso</h4>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {sessions[0] ? formatDateTime(sessions[0].lastSeenAt || sessions[0].createdAt, currentLang) : 'Sem sessões registadas.'}
              </p>
            </section>
          </aside>
        </div>
      )}

      {section === 'sessoes' && (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Sessões activas</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Cada sessão corresponde a um início de sessão com sessão assinada no servidor.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadSessions()} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-1.5 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} /> Actualizar
              </button>
              <button type="button" onClick={() => void revokeAll()} disabled={busySessionId === 'all' || sessions.length === 0} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-rose-700 disabled:opacity-60">
                <LogOut className="h-3.5 w-3.5" /> Encerrar todas as sessões
              </button>
            </div>
          </div>

          {sessionsError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{sessionsError}</p>}

          {sessionsLoading ? (
            <p className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">A carregar sessões…</p>
          ) : sessions.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">Nenhuma sessão activa registada.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sessions.map((session) => {
                const device = describeDevice(session.userAgent);
                return (
                  <li key={session.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {device.mobile ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                    </span>
                    <div className="min-w-[180px] flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900 dark:text-white">{device.label}</span>
                        {session.current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Sessão actual</span>}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        Início {formatDateTime(session.createdAt, currentLang)} · Último acesso {formatDateTime(session.lastSeenAt, currentLang)}
                        {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void revokeSession(session.id)}
                      disabled={busySessionId === session.id}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-[10px] font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="h-3.5 w-3.5" /> {session.current ? 'Encerrar esta sessão' : 'Encerrar'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {section === 'historico' && (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Histórico de segurança</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Trilha de auditoria da própria conta{eventsSource ? ` · origem: ${eventsSource}` : ''}. Apenas operações desta conta são mostradas.
              </p>
            </div>
            <div className="flex gap-2">
              <input type="search" value={historyQuery} onChange={(event) => { setHistoryQuery(event.target.value); setHistoryPage(1); }} placeholder="Pesquisar acção ou recurso" className="min-h-9 w-56 rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              <button type="button" onClick={() => void loadEvents(historyPage, historyQuery, historyPageSize)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-1.5 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <RefreshCw className={`h-3.5 w-3.5 ${eventsLoading ? 'animate-spin' : ''}`} /> Actualizar
              </button>
            </div>
          </div>

          {eventsError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{eventsError}</p>}

          {eventsLoading ? (
            <p className="mt-4 text-xs font-bold text-slate-500">A carregar histórico…</p>
          ) : filteredEvents.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">Sem operações registadas para os filtros actuais.</p>
          ) : (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Operação</th>
                      <th className="p-2">Recurso</th>
                      <th className="p-2">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="p-2 font-bold text-slate-600 dark:text-slate-300">{formatDateTime(event.createdAt, currentLang)}</td>
                        <td className="p-2 font-black text-slate-900 dark:text-white">{eventLabel(event.action)}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-300">{event.resource || '—'}{event.resourceId ? ` · ${event.resourceId}` : ''}</td>
                        <td className="p-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${event.result === 'failure' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'}`}>
                            {event.result === 'failure' ? 'Falhou' : 'Sucesso'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination
                className="mt-3"
                currentLang={currentLang}
                currentPage={historyPage}
                pageSize={historyPageSize}
                totalItems={historyTotal}
                onPageChange={setHistoryPage}
                onPageSizeChange={(size) => { setHistoryPageSize(size); setHistoryPage(1); }}
                pageSizeOptions={[20, 50]}
              />
            </>
          )}
        </section>
      )}

      {section === 'alertas' && (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map((alert) => (
            <section key={alert.title} className={`rounded-2xl border p-3.5 shadow-[var(--shadow-xs)] ${alert.tone === 'warning' ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'border-[var(--color-border-subtle)] bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
              <h4 className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                {alert.tone === 'warning' ? <ShieldAlert className="h-4 w-4 text-amber-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                {alert.title}
              </h4>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{alert.detail}</p>
            </section>
          ))}
          <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900 md:col-span-2">
            <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100"><Globe className="h-4 w-4 text-slate-500" /> Recomendações</h4>
            <ul className="mt-1 list-disc pl-5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              <li>Use uma palavra-passe exclusiva para a conta empresarial e altere-a quando alguém da equipa sair.</li>
              <li>Encerre sessões que não reconhece; cada sessão encerrada deixa de dar acesso imediatamente.</li>
              <li>Confirme os acessos recentes em «Histórico de segurança» sempre que a equipa muda.</li>
            </ul>
          </section>
        </div>
      )}

      <p className="text-[10px] text-slate-500 dark:text-slate-500">
        Conta {currentUser.email} · empresa {business.name}. As operações sensíveis são validadas e registadas no servidor.
      </p>
    </div>
  );
};

export default ClientSecurityHub;
