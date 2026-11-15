import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileSearch, Filter, Loader2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

type SubmissionStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'changes_requested'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

type SubmissionAction = 'approve' | 'reject' | 'request_changes' | 'in_review';

interface SubmissionHistoryEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  actorName: string | null;
  notes: string;
  createdAt: string;
}

interface Submission {
  id: string;
  type: string;
  title: string;
  summary: string;
  referenceId: string | null;
  companyId: string | null;
  submittedBy: string | null;
  status: SubmissionStatus;
  priority: string;
  payload: Record<string, unknown>;
  decisionReason: string;
  reviewerName: string | null;
  version: number;
  submittedAt: string;
  decidedAt: string | null;
  updatedAt: string;
  history?: SubmissionHistoryEntry[];
}

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  in_review: 'Em análise',
  changes_requested: 'Aguardando alterações',
  resubmitted: 'Reenviado',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
};

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  in_review: 'bg-blue-100 text-blue-800 border-blue-200',
  changes_requested: 'bg-orange-100 text-orange-800 border-orange-200',
  resubmitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const TYPE_LABELS: Record<string, string> = {
  event: 'Evento',
  business: 'Empresa',
  business_profile: 'Perfil empresarial',
  post: 'Publicação',
  promotion: 'Promoção',
  campaign: 'Campanha',
  ticket: 'Bilhete / Operação',
  other: 'Outro',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

export const CentralModerationPanel: React.FC = () => {
  const [items, setItems] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState<SubmissionAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (companyFilter.trim()) params.set('companyId', companyFilter.trim());
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const response = await fetch(`/api/moderation/submissions?${params.toString()}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar a fila de moderação.');
      setItems(Array.isArray(data.items) ? data.items : []);
      setCounts(data.counts && typeof data.counts === 'object' ? data.counts : {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar a fila de moderação.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, companyFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (submission: Submission) => {
    setSelected(submission);
    setReason('');
    setNotice('');
    try {
      const response = await fetch(`/api/moderation/submissions/${encodeURIComponent(submission.id)}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.submission) setSelected(data.submission as Submission);
    } catch {
      // O detalhe da lista já contém os dados essenciais.
    }
  };

  const decide = async (action: SubmissionAction) => {
    if (!selected) return;
    if ((action === 'reject' || action === 'request_changes') && reason.trim().length < 5) {
      setError('Indique uma justificação com pelo menos 5 caracteres.');
      return;
    }
    setActing(action);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/moderation/submissions/${encodeURIComponent(selected.id)}/decision`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível registar a decisão.');
      const updated = data.submission as Submission;
      setNotice(`Decisão registada: ${STATUS_LABELS[updated.status] || updated.status}. O responsável foi notificado.`);
      setReason('');
      setSelected(updated);
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Erro ao registar a decisão.');
    } finally {
      setActing(null);
    }
  };

  const pendingTotal = (counts.pending ?? 0) + (counts.in_review ?? 0) + (counts.changes_requested ?? 0) + (counts.resubmitted ?? 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <span className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              Moderação centralizada
            </span>
            <h4 className="mt-1 flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
              <ShieldAlert className="h-4 w-4 text-indigo-600" />
              Submissões de todos os módulos
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Eventos, empresas, publicações, promoções e campanhas na mesma fila, com histórico e decisão auditável.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800">
              {pendingTotal} a aguardar decisão
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', 'pending', 'in_review', 'changes_requested', 'resubmitted', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold ${
                statusFilter === status
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {status === 'all' ? 'Todas' : STATUS_LABELS[status]} ({status === 'all' ? items.length : counts[status] ?? 0})
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 lg:col-span-2">
            Pesquisar
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Título, resumo ou empresa"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Tipo
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="all">Todos</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Empresa
            <input
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              placeholder="ID da empresa"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            De
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Até
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar submissões…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-xs text-slate-500">
            <FileSearch className="h-6 w-6 text-slate-400" />
            <p className="font-bold">Nenhuma submissão neste filtro.</p>
            <p>As submissões de eventos, empresas e conteúdos aparecem aqui automaticamente.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openDetail(item)}
                className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  selected?.id === item.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${STATUS_STYLES[item.status]}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                    {item.priority !== 'normal' && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-700">
                        {PRIORITY_LABELS[item.priority] || item.priority}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs font-extrabold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    Empresa: {item.companyId || '—'} · Submetido: {formatDate(item.submittedAt)} · Versão {item.version}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-indigo-600">Analisar →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm dark:border-indigo-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${STATUS_STYLES[selected.status]}`}>
                {STATUS_LABELS[selected.status] || selected.status}
              </span>
              <h4 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">{selected.title}</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {TYPE_LABELS[selected.type] || selected.type} · {selected.id} · submetido {formatDate(selected.submittedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Fechar
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
              <p><strong>Resumo:</strong> {selected.summary || '—'}</p>
              <p><strong>Empresa:</strong> {selected.companyId || '—'}</p>
              <p><strong>Responsável:</strong> {selected.submittedBy || '—'}</p>
              <p><strong>Referência:</strong> {selected.referenceId || '—'}</p>
              <p><strong>Revisor:</strong> {selected.reviewerName || 'Ainda não atribuído'}</p>
              <p><strong>Última atualização:</strong> {formatDate(selected.updatedAt)}</p>
              {selected.decidedAt && <p><strong>Decidido em:</strong> {formatDate(selected.decidedAt)}</p>}
              {selected.decisionReason && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-900">
                  <strong>Motivo/observações:</strong> {selected.decisionReason}
                </p>
              )}
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <Filter className="h-3 w-3" /> Conteúdo submetido
              </p>
              <pre className="max-h-52 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100">
{JSON.stringify(selected.payload ?? {}, null, 2)}
              </pre>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
              <Clock className="h-3 w-3" /> Histórico ({selected.history?.length ?? 0})
            </p>
            <div className="max-h-44 space-y-1.5 overflow-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {(selected.history ?? []).map((entry) => (
                <div key={entry.id} className="rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] dark:bg-slate-800">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    {entry.action} · {entry.fromStatus || '—'} → {entry.toStatus}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {formatDate(entry.createdAt)} · {entry.actorName || 'sistema'}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </p>
                </div>
              ))}
              {(!selected.history || selected.history.length === 0) && (
                <p className="p-2 text-[10px] text-slate-500">Sem eventos registados.</p>
              )}
            </div>
          </div>

          {!['pending', 'in_review', 'resubmitted', 'changes_requested'].includes(selected.status) && (
            <p className="mt-4 rounded-xl bg-slate-100 p-2 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Esta submissão já tem decisão final. O histórico permanece disponível para auditoria.
            </p>
          )}

          {['pending', 'in_review', 'resubmitted', 'changes_requested'].includes(selected.status) && (
            <div className="mt-4 space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                Justificação / observações (obrigatória para recusar ou pedir alterações)
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder="Ex.: falta a descrição detalhada e o comprovativo do local."
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {selected.status !== 'in_review' && (
                  <button
                    type="button"
                    disabled={acting !== null}
                    onClick={() => void decide('in_review')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800 disabled:opacity-50"
                  >
                    {acting === 'in_review' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                    Iniciar análise
                  </button>
                )}
                <button
                  type="button"
                  disabled={acting !== null}
                  onClick={() => void decide('approve')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {acting === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Aprovar
                </button>
                <button
                  type="button"
                  disabled={acting !== null}
                  onClick={() => void decide('request_changes')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {acting === 'request_changes' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  Pedir alterações
                </button>
                <button
                  type="button"
                  disabled={acting !== null}
                  onClick={() => void decide('reject')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {acting === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Recusar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
