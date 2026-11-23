import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Check, Eye, Flag, RefreshCw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { storyApi, type StoryApi } from '../../services/storyApi';

type Tab = 'stories' | 'reports' | 'stats';

const STATUS_OPTIONS = [
  ['all', 'Todas'], ['active', 'Ativas'], ['draft', 'Rascunhos'], ['expired', 'Arquivadas'],
  ['suspended', 'Suspensas'], ['removed', 'Removidas'],
] as const;

const REASON_LABEL: Record<string, string> = {
  improper: 'Conteúdo impróprio', false_information: 'Informação falsa', fraud: 'Fraude',
  spam: 'Spam', harassment: 'Assédio', rights: 'Violação de direitos', other: 'Outro',
};

export const StoriesModerationPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('stories');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [stories, setStories] = useState<StoryApi[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'stories') {
        const result = await storyApi.adminList({ status, query });
        setStories(result.stories || []);
      } else if (tab === 'reports') {
        const result = await storyApi.adminReports();
        setReports(result.reports || []);
      } else {
        setStats(await storyApi.adminStats());
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a moderação de Stories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tab, status]);

  const pendingReports = useMemo(() => reports.filter((report) => report.status === 'pending').length, [reports]);

  const moderate = async (story: StoryApi, action: string) => {
    const reason = action === 'approve' || action === 'restore'
      ? undefined
      : window.prompt('Justificação da decisão (obrigatória):', '') || '';
    if (action !== 'approve' && action !== 'restore' && !reason.trim()) return;
    try {
      await storyApi.adminModerate(story.id, action, reason);
      await load();
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : 'Não foi possível moderar a story.');
    }
  };

  const resolveReport = async (report: any, nextStatus: string) => {
    const resolution = window.prompt('Resolução / justificação:', '') || '';
    if (!resolution.trim()) return;
    try {
      await storyApi.adminResolveReport(report.id, nextStatus, resolution);
      await load();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Não foi possível resolver a denúncia.');
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-default)] pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-[var(--tone-warning-bg)] p-2 text-[var(--tone-warning-text)] dark:bg-amber-950/40 dark:text-amber-300"><ShieldAlert className="h-5 w-5" /></span>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Moderação de Stories</h3>
            <p className="text-[10px] text-slate-500">Permissão granular: story_moderation. Denúncias, suspensão, remoção e auditoria.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => void load()} className="rounded-lg border border-[var(--color-border-default)] p-2 text-slate-600 dark:border-slate-700 dark:text-slate-300" aria-label="Atualizar"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          {pendingReports > 0 && <span className="rounded-full bg-[var(--tone-danger-bg)] px-2 py-1 text-[10px] font-black text-[var(--tone-danger-text)] dark:bg-rose-950/50 dark:text-rose-300">{pendingReports} denúncia(s)</span>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {([['stories', 'Stories'], ['reports', 'Denúncias'], ['stats', 'Estatísticas']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${tab === key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>{label}</button>
          ))}
        </div>
        {tab === 'stories' && <>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 py-1.5 text-[10px] font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex min-w-[180px] flex-1 items-center gap-1 rounded-xl border border-[var(--color-border-default)] bg-white px-2 dark:border-slate-700 dark:bg-slate-800">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Empresa ou legenda" className="min-w-0 flex-1 bg-transparent py-1.5 text-[10px] outline-none dark:text-white" />
          </form>
        </>}
      </div>

      {error && <p className="mt-3 rounded-xl bg-[var(--tone-danger-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-danger-text)] dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      {tab === 'stories' && (
        <div className="mt-3 space-y-2">
          {!loading && stories.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500 dark:bg-slate-800">Sem stories para estes filtros.</p>}
          {stories.map((story) => (
            <div key={story.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border-default)] p-3 dark:border-slate-700">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {story.storyType === 'video' ? <Eye className="h-4 w-4 text-slate-500" /> : story.mediaUrl ? <img src={story.mediaUrl} alt="" className="h-full w-full object-cover" /> : <span className="p-1 text-center text-[8px] font-bold">{story.caption?.slice(0, 30) || 'Texto'}</span>}
              </div>
              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-black text-slate-900 dark:text-white">{story.businessName}</span><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{story.status}</span>{story.ownerRole === 'admin' && <span className="rounded-full bg-[var(--tone-warning-bg)] px-1.5 py-0.5 text-[9px] font-black text-[var(--tone-warning-text)]">Institucional</span>}</div>
                <p className="line-clamp-1 text-[10px] text-slate-500">{story.caption || 'Sem legenda'} · {story.counts.views} vistas · {story.counts.likes} gostos · {story.counts.replies} respostas</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {story.status !== 'active' && <button type="button" onClick={() => void moderate(story, story.status === 'suspended' ? 'restore' : 'approve')} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[9px] font-black text-white"><Check className="mr-1 inline h-3 w-3" />Aprovar</button>}
                {story.status === 'active' && <button type="button" onClick={() => void moderate(story, 'suspend')} className="rounded-lg bg-amber-500 px-2 py-1.5 text-[9px] font-black text-white">Suspender</button>}
                <button type="button" onClick={() => void moderate(story, 'reject')} className="rounded-lg bg-rose-600 px-2 py-1.5 text-[9px] font-black text-white"><Trash2 className="mr-1 inline h-3 w-3" />Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        <div className="mt-3 space-y-2">
          {!loading && reports.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500 dark:bg-slate-800">Sem denúncias registadas.</p>}
          {reports.map((report) => (
            <div key={report.id} className="rounded-2xl border border-[var(--color-border-default)] p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Flag className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-black text-slate-900 dark:text-white">{report.business_name}</span>
                <span className="rounded-full bg-[var(--tone-danger-bg)] px-2 py-0.5 text-[9px] font-black text-[var(--tone-danger-text)] dark:bg-rose-950/40 dark:text-rose-300">{REASON_LABEL[report.reason] || report.reason}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{report.status}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{report.details || 'Sem detalhes'} · por {report.reporter_name}</p>
              {report.status === 'pending' && <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => void resolveReport(report, 'dismissed')} className="rounded-lg bg-slate-200 px-2 py-1 text-[9px] font-black text-slate-700 dark:bg-slate-700 dark:text-slate-200">Arquivar</button>
                <button type="button" onClick={() => void resolveReport(report, 'actioned')} className="rounded-lg bg-rose-600 px-2 py-1 text-[9px] font-black text-white">Ação tomada</button>
              </div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Stories', stats.total], ['Ativas', stats.active], ['Arquivadas', stats.archived], ['Visualizações', stats.views], ['Gostos', stats.likes], ['Respostas', stats.replies], ['Denúncias pendentes', stats.pending_reports]].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800"><div className="text-lg font-black text-slate-900 dark:text-white">{String(value ?? 0)}</div><div className="text-[9px] font-bold uppercase text-slate-500">{String(label)}</div></div>
            ))}
          </div>
          <div className="space-y-1.5">
            {(stats.topStories || []).map((story: any) => <div key={story.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] dark:bg-slate-800"><BarChart3 className="h-3.5 w-3.5 text-emerald-600" /><span className="flex-1 font-black text-slate-800 dark:text-slate-200">{story.business_name}</span><span className="text-slate-500">{story.views} vistas · {story.likes} gostos</span></div>)}
          </div>
        </div>
      )}
    </section>
  );
};

export default StoriesModerationPanel;
