import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Ticket, TrendingUp, Users } from 'lucide-react';
import type { Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { formatCurrencyXOF } from '../utils/i18n';
import { Button, Card, EmptyState } from './ui';

/**
 * Bilhetes vendidos pela empresa (Secção 7 / GUI-3.4.11).
 *
 * Lê `/api/tickets/sold`, que devolve apenas os bilhetes dos eventos da própria
 * empresa. O reembolso é pedido pelo organizador — quem comprou cancela o seu
 * bilhete na área pessoal — e o pedido fica registado para confirmação manual,
 * porque a devolução ao operador ainda não é automática.
 */

interface SoldTicket {
  id: string;
  ticketCode: string;
  status: string;
  priceXOF: number;
  holderName: string | null;
  holderPhone: string | null;
  purchasedAt: string | null;
  eventTitle: string | null;
  refundStatus: string | null;
}

interface SoldTotals { total: number; valid: number; used: number; cancelled: number; refunded: number; revenueXOF: number }

const STATUS_STYLES: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  used: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-amber-100 text-amber-800 border-amber-200',
};

const STATUS_LABELS: Record<string, Record<Language, string>> = {
  valid: { pt: 'Por usar', en: 'Unused', fr: 'À utiliser', es: 'Sin usar' },
  used: { pt: 'Utilizado', en: 'Used', fr: 'Utilisé', es: 'Usado' },
  cancelled: { pt: 'Cancelado', en: 'Cancelled', fr: 'Annulé', es: 'Cancelado' },
  expired: { pt: 'Expirado', en: 'Expired', fr: 'Expiré', es: 'Expirado' },
};

const EMPTY_TOTALS: SoldTotals = { total: 0, valid: 0, used: 0, cancelled: 0, refunded: 0, revenueXOF: 0 };

export const SoldTicketsPanel: React.FC<{ currentLang: Language }> = ({ currentLang }) => {
  const t = useCallback((key: string) => getTranslation(currentLang, key), [currentLang]);
  const [tickets, setTickets] = useState<SoldTicket[]>([]);
  const [totals, setTotals] = useState<SoldTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tickets/sold');
      if (!response.ok) {
        setNotice({ tone: 'error', text: t('soldTicketsLoadFailed') });
        return;
      }
      const payload = await response.json() as { tickets?: SoldTicket[]; totals?: SoldTotals };
      setTickets(payload.tickets || []);
      setTotals(payload.totals || EMPTY_TOTALS);
    } catch {
      setNotice({ tone: 'error', text: t('soldTicketsLoadFailed') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const refundTicket = async (ticket: SoldTicket) => {
    if (!window.confirm(t('refundTicketConfirm'))) return;
    setBusyTicketId(ticket.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: t('refundTicketReasonDefault') }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) {
        setNotice({ tone: 'error', text: payload.error || t('refundTicketFailed') });
        await load();
        return;
      }
      setNotice({ tone: 'success', text: payload.message || t('refundTicketDone') });
      await load();
    } catch {
      setNotice({ tone: 'error', text: t('networkError') });
    } finally {
      setBusyTicketId(null);
    }
  };

  const stats = [
    { label: t('soldTicketsTotal'), value: totals.total, icon: Users },
    { label: t('soldTicketsUnused'), value: totals.valid, icon: Ticket },
    { label: t('soldTicketsUsed'), value: totals.used, icon: TrendingUp },
    { label: t('soldTicketsRevenue'), value: formatCurrencyXOF(totals.revenueXOF, currentLang), icon: TrendingUp },
  ];

  return (
    <Card className="border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">{t('soldTicketsTitle')}</p>
          <h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">{t('soldTicketsSubtitle')}</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()} loading={loading} className="min-h-10 text-[11px]">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t('retry')}
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800">
            <stat.icon className="mx-auto mb-1 h-4 w-4 text-indigo-600" aria-hidden="true" />
            <div className="text-lg font-black text-slate-900 dark:text-white">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-xs font-bold ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'}`}
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice.text}</span>
        </div>
      )}

      {!loading && tickets.length === 0 ? (
        <EmptyState title={t('noSoldTickets')} description={t('noSoldTicketsHint')} icon={<Ticket className="h-6 w-6" aria-hidden="true" />} />
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const refundable = ticket.status === 'valid' && !ticket.refundStatus;
            const label = STATUS_LABELS[ticket.status]?.[currentLang] || ticket.status;
            return (
              <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{ticket.eventTitle || t('events.all')}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {ticket.holderName || ticket.holderPhone || t('customer')} · <span className="font-mono">{ticket.ticketCode}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{formatCurrencyXOF(ticket.priceXOF, currentLang)}</span>
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${STATUS_STYLES[ticket.status] || 'border-slate-200 bg-slate-100 text-slate-600'}`}>{label}</span>
                  {refundable && (
                    <Button type="button" variant="danger" size="sm" loading={busyTicketId === ticket.id} onClick={() => void refundTicket(ticket)} className="min-h-9 text-[11px]">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t('refundTicket')}
                    </Button>
                  )}
                  {ticket.refundStatus && (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase text-indigo-800">
                      {t('refundRequested')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

