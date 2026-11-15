import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';

type SubmissionStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'changes_requested'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

interface Submission {
  id: string;
  type: string;
  title: string;
  summary: string;
  referenceId: string | null;
  status: SubmissionStatus;
  decisionReason: string;
  reviewerName: string | null;
  version: number;
  submittedAt: string;
  decidedAt: string | null;
}

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Rascunho',
  pending: 'Pendente de aprovação',
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

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

export const BusinessModerationPanel: React.FC = () => {
  const [items, setItems] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resubmitting, setResubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/moderation/submissions/mine', { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar as suas submissões.');
      setItems(Array.isArray(data.items) ? data.items : []);
      setCounts(data.counts && typeof data.counts === 'object' ? data.counts : {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar as submissões.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resubmit = async (submission: Submission) => {
    const changesNote = (notes[submission.id] || '').trim();
    if (changesNote.length < 5) {
      setError('Descreva as alterações efetuadas (mínimo 5 caracteres).');
      return;
    }
    setResubmitting(submission.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/moderation/submissions/${encodeURIComponent(submission.id)}/resubmit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changesNote }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível reenviar a submissão.');
      setNotice(`Submissão "${submission.title}" reenviada para aprovação.`);
      setNotes((prev) => ({ ...prev, [submission.id]: '' }));
      await load();
    } catch (resubmitError) {
      setError(resubmitError instanceof Error ? resubmitError.message : 'Erro ao reenviar a submissão.');
    } finally {
      setResubmitting(null);
    }
  };

  const pendingTotal = (counts.pending ?? 0) + (counts.in_review ?? 0) + (counts.resubmitted ?? 0);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            As minhas submissões de moderação
          </h4>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Acompanhe eventos, perfil e conteúdos enviados para aprovação, consulte motivos e reenvie correções.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[10px] font-black uppercase text-amber-700">Pendentes</p>
          <p className="text-lg font-black text-amber-900">{pendingTotal}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] font-black uppercase text-emerald-700">Aprovadas</p>
          <p className="text-lg font-black text-emerald-900">{counts.approved ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
          <p className="text-[10px] font-black uppercase text-orange-700">Alterações pedidas</p>
          <p className="text-lg font-black text-orange-900">{counts.changes_requested ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <p className="text-[10px] font-black uppercase text-red-700">Recusadas</p>
          <p className="text-lg font-black text-red-900">{counts.rejected ?? 0}</p>
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-6 text-xs font-bold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[11px] text-slate-500">
          Ainda não existem submissões para esta conta.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const canResubmit = item.status === 'changes_requested' || item.status === 'rejected';
            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${STATUS_STYLES[item.status]}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                      <span className="text-[10px] text-slate-400">v{item.version}</span>
                    </div>
                    <p className="mt-1 text-xs font-extrabold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Submetido {formatDate(item.submittedAt)}
                      {item.decidedAt ? ` · decidido ${formatDate(item.decidedAt)}` : ''}
                      {item.reviewerName ? ` · revisor ${item.reviewerName}` : ''}
                    </p>
                  </div>
                  {item.status === 'approved' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {item.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                  {['pending', 'in_review', 'resubmitted'].includes(item.status) && <Clock className="h-4 w-4 text-amber-600" />}
                </div>

                {item.decisionReason && (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900">
                    <strong>{item.status === 'changes_requested' ? 'Alterações pedidas' : 'Motivo'}:</strong> {item.decisionReason}
                  </p>
                )}

                {canResubmit && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      value={notes[item.id] || ''}
                      onChange={(event) => setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      rows={2}
                      placeholder="Descreva as correções efetuadas antes de reenviar."
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={resubmitting === item.id}
                      onClick={() => void resubmit(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      {resubmitting === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Reenviar para aprovação
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
