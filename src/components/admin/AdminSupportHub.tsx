import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, LifeBuoy, Send, ShieldCheck, Tag, Layers } from 'lucide-react';
import { Business, Language, SupportRequest, SupportCategory } from '../../types';
import { getTranslation } from '../../utils/i18n';

interface AdminSupportHubProps {
  supportRequests: SupportRequest[];
  businesses: Business[];
  onReplySupport: (requestId: string, text: string) => void;
  onUpdateSupportStatus: (requestId: string, status: SupportRequest['status']) => void;
  focusSupportId?: string | null;
  currentLang: Language;
}

const statusLabel: Record<SupportRequest['status'], string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  resolved: 'Resolvido',
};

const CATEGORY_OPTIONS: Array<{ value: SupportCategory; label: string }> = [
  { value: 'account', label: 'Conta' },
  { value: 'payments', label: 'Pagamentos' },
  { value: 'tickets', label: 'Bilhetes' },
  { value: 'technical', label: 'Problema técnico' },
  { value: 'business_report', label: 'Denúncia de empresa' },
  { value: 'other', label: 'Outro' },
];

const categoryLabel: Record<NonNullable<SupportRequest['category']>, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<NonNullable<SupportRequest['category']>, string>;

export const AdminSupportHub: React.FC<AdminSupportHubProps> = ({
  supportRequests,
  businesses,
  onReplySupport,
  onUpdateSupportStatus,
  focusSupportId,
  currentLang,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const localizedStatusLabel = (status: SupportRequest['status']) => ({
    open: t('admin.supportOpen'),
    in_progress: t('admin.supportProgress'),
    resolved: t('admin.supportResolved'),
  }[status]);

  const [statusFilter, setStatusFilter] = useState<SupportRequest['status']>('open');
  const [categoryFilter, setCategoryFilter] = useState<SupportCategory | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(supportRequests[0]?.id || null);
  const [replyText, setReplyText] = useState('');
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusSupportId && supportRequests.some((request) => request.id === focusSupportId)) setSelectedId(focusSupportId);
  }, [focusSupportId, supportRequests]);

  const filteredRequests = useMemo(() => supportRequests
    .filter((request) => request.status === statusFilter && (categoryFilter === undefined || request.category === categoryFilter))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [statusFilter, categoryFilter, supportRequests]);
  const selected = filteredRequests.find((request) => request.id === selectedId) || filteredRequests[0] || null;

  // Como no WhatsApp: ao abrir um ticket a conversa mostra logo a mensagem mais recente.
  useEffect(() => {
    const container = threadRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [selected?.id, selected?.replies?.length, statusFilter, categoryFilter]);

  const businessNameFor = (businessId?: string) => businessId
    ? businesses.find((business) => business.id === businessId)?.name || businessId
    : 'Suporte geral Guigui.com';

  const submitReply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !replyText.trim()) return;
    onReplySupport(selected.id, replyText.trim());
    setReplyText('');
  };

  return (
    <section className="flex flex-col gap-4 lg:h-[calc(100dvh-11rem)] lg:min-h-[560px]" aria-labelledby="admin-support-title">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-950 to-slate-950 p-6 text-white shadow-sm dark:border-emerald-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Comunicação administrativa</p>
            <h2 id="admin-support-title" className="mt-2 text-2xl font-black">{t('support')}</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-emerald-100/80">Aqui a Administração atende problemas do Guigui.com. As conversas comerciais cidadão–empresa permanecem privadas e não aparecem neste centro.</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300"><LifeBuoy className="h-6 w-6" /></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {(['open', 'in_progress', 'resolved'] as const).map((status) => <div key={status} className="rounded-2xl bg-white/10 p-3"><p className="text-lg font-black">{supportRequests.filter((request) => request.status === status).length}</p><p className="text-[10px] font-bold text-emerald-100/75">{localizedStatusLabel(status)}</p></div>)}
        </div>
      </div>

      {/* Filtro por estado (real: open / in_progress / resolved) */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('admin.supportFilter')}>
        {(['open', 'in_progress', 'resolved'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`min-h-10 rounded-xl px-3 text-xs font-black ${
              statusFilter === value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {`${localizedStatusLabel(value)} (${supportRequests.filter((request) => request.status === value).length})`}
          </button>
        ))}
      </div>

      {/* Painel "Todos + categorias" (organização visual, não duplica registos) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Categoria:</span>
          <button
            type="button"
            onClick={() => setCategoryFilter(undefined)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
              categoryFilter === undefined
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            Todas
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                categoryFilter === undefined
                  ? 'bg-white/40 text-emerald-950'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {supportRequests.length}
            </span>
          </button>
          {CATEGORY_OPTIONS.map((option) => {
            const count = supportRequests.filter((request) => request.category === option.value).length;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === option.value ? undefined : option.value)}
                disabled={count === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                  categoryFilter === option.value
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : count === 0
                    ? 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Tag className="w-3.5 h-3.5 shrink-0" />
                {option.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    categoryFilter === option.value
                      ? 'bg-white/40 text-emerald-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1 max-lg:max-h-[46vh]">
          {filteredRequests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedId(request.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selected?.id === request.id
                  ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-700 bg-white hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-950 dark:text-white">{request.subject}</p>
                  <p className="mt-1 truncate text-[10px] font-bold text-slate-500">
                    {request.requesterRole === 'business' ? businessNameFor(request.businessId) : 'Cidadão Guigui.com'} · {request.category ? categoryLabel[request.category] : 'Geral'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  {localizedStatusLabel(request.status)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{request.lastReply || request.description}</p>
              <p className="mt-2 text-[9px] font-bold text-slate-400">{new Date(request.updatedAt).toLocaleString('pt-PT')}</p>
            </button>
          ))}
          {filteredRequests.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center text-xs font-semibold text-slate-500 dark:border-slate-700">
              {t('noResults')}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] max-lg:max-h-[52vh]">
          {selected ? <><div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-700 px-4 pb-4 pt-4 dark:border-slate-800 sm:px-5"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">{selected.id}</p><h3 className="mt-1 text-base font-black text-[var(--color-text-strong)]">{selected.subject}</h3><p className="mt-1 text-[11px] font-semibold text-slate-500">{selected.requesterRole === 'business' ? businessNameFor(selected.businessId) : 'Cidadão Guigui.com'} · Aberto em {new Date(selected.createdAt).toLocaleString('pt-PT')}</p></div><ShieldCheck className="h-5 w-5 text-emerald-600" /></div><div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"><div className="rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/25 dark:text-amber-100"><p className="mb-1 text-[10px] font-black uppercase">Pedido inicial</p>{selected.description}</div>{(selected.replies || []).slice(1).map((reply) => <div key={reply.id} className={`rounded-2xl p-4 text-xs leading-relaxed ${reply.senderRole === 'admin' ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/25 dark:text-emerald-100' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}><p className="mb-1 text-[10px] font-black uppercase">{reply.senderRole === 'admin' ? 'Administração Guigui.com' : 'Requerente'}</p>{reply.text}</div>)}</div><form onSubmit={submitReply} className="flex shrink-0 gap-2 border-t border-slate-200 dark:border-slate-700 px-4 pt-4 dark:border-slate-800 sm:px-5">          <input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder={t('admin.supportReply')} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" aria-label="Enviar resposta"><Send className="h-4 w-4" /></button></form><div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-700 px-4 pb-4 pt-3 dark:border-slate-800 sm:px-5"><p className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><Clock3 className="h-3.5 w-3.5" />Estado: {statusLabel[selected.status]}</p><div className="flex gap-2">{selected.status !== 'resolved' && <button type="button" onClick={() => onUpdateSupportStatus(selected.id, 'resolved')} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Marcar resolvido</button>}{selected.status === 'resolved' && <button type="button" onClick={() => onUpdateSupportStatus(selected.id, 'in_progress')} className="rounded-xl bg-amber-100 px-3 py-2 text-[10px] font-black text-amber-900 hover:bg-amber-200">Reabrir ticket</button>}</div></div></> : <div className="m-auto text-center text-xs font-semibold text-slate-500"><LifeBuoy className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-2">Seleccione um ticket para começar.</p></div>}
        </div>
      </div>
    </section>
  );
};
