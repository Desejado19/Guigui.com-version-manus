import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Ticket, QrCode } from 'lucide-react';
import type { Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { Button, Card, EmptyState } from './ui';
import { QRCodeDisplay } from './QRCodeDisplay';

/**
 * Bilhetes do cidadão (Secção 7 / GUI-3.4.10).
 *
 * Lê `/api/tickets/mine`, que é a fonte de verdade.
 *
 * NOTA (Regra 6): Após a confirmação do pagamento, a compra é definitiva.
 * O comprador NÃO pode cancelar voluntariamente nem solicitar reembolso por
 * motivos pessoais. O sistema não apresenta funcionalidade de "Cancelar compra".
 * O cancelamento só é possível por operação do organizador ou administração
 * (Regra 7), ou como parte de um procedimento de reembolso aprovado (Regra 9).
 *
 * Quando a conta ainda não tem bilhetes reais, o `fallback` é mostrado em seu
 * lugar. Assim nunca há duas listas de bilhetes com nomes parecidos no mesmo
 * ecrã: ou são os reais, ou são exemplos claramente rotulados.
 */

interface RealTicket {
  id: string;
  ticketCode: string;
  qrToken?: string;
  eventTitle?: string;
  ticketTypeName?: string;
  status: string;
  priceXOF?: number;
  purchasedAt?: string;
  holderName?: string;
  holderPhone?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-[var(--color-gold-100)] text-[var(--color-gold-800)] border-[var(--color-gold-200)]',
  valid: 'bg-[var(--color-green-100)] text-[var(--color-green-800)] border-[var(--color-green-200)]',
  used: 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
};

const STATUS_LABELS: Record<string, Record<Language, string>> = {
  pending: { pt: 'Pendente', en: 'Pending', fr: 'En attente', es: 'Pendiente' },
  valid: { pt: 'Válido', en: 'Valid', fr: 'Valide', es: 'Válido' },
  used: { pt: 'Utilizado', en: 'Used', fr: 'Utilisé', es: 'Usado' },
};

export const MyTicketsPanel: React.FC<{
  currentLang: Language;
  /** Mostrado apenas quando a conta não tem bilhetes reais. */
  fallback?: React.ReactNode;
}> = ({ currentLang, fallback }) => {
  const t = useCallback((key: string) => getTranslation(currentLang, key), [currentLang]);
  const [tickets, setTickets] = useState<RealTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tickets/mine');
      if (!response.ok) {
        setNotice({ tone: 'error', text: t('ticketsLoadFailed') });
        return;
      }
      const payload = await response.json() as { tickets?: RealTicket[] };
      setTickets(payload.tickets || []);
    } catch {
      setNotice({ tone: 'error', text: t('ticketsLoadFailed') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-green-700)]">{t('realTicketsTitle')}</p>
          <h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">{t('realTicketsSubtitle')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} loading={loading} className="min-h-10 text-[11px]">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t('retry')}
          </Button>
          <Ticket className="h-6 w-6 text-[var(--color-green-600)]" aria-hidden="true" />
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-xs font-bold ${notice.tone === 'success' ? 'border-[var(--color-green-200)] bg-[var(--color-green-100)] text-[var(--color-green-800)]' : 'border-[var(--color-red-200)] bg-[var(--color-red-100)] text-[var(--color-red-800)]'}`}
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
              <div className="h-3 w-2/3 rounded bg-[var(--color-border-subtle)]" />
              <div className="mt-2 h-2.5 w-1/3 rounded bg-[var(--color-border-subtle)]" />
              <div className="mt-2 h-2.5 w-1/2 rounded bg-[var(--color-border-subtle)]" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        fallback ?? <EmptyState title={t('noRealTickets')} description={t('noRealTicketsHint')} icon={<Ticket className="h-6 w-6" aria-hidden="true" />} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tickets.map((ticket) => {
            const label = STATUS_LABELS[ticket.status]?.[currentLang] || ticket.status;
            const isOpen = openTicketId === ticket.id;
            return (
              <div key={ticket.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-black text-[var(--color-text-strong)]">{ticket.eventTitle || t('events.all')}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">{ticket.ticketTypeName}</p>
                    <p className="mt-1 font-mono text-[11px] font-black tracking-wide text-[var(--color-green-700)]">{ticket.ticketCode}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase ${STATUS_STYLES[ticket.status] || 'border-[var(--color-border-subtle)] bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'}`}>{label}</span>
                </div>
                {ticket.qrToken && (
                  <div className="mt-4 flex justify-center border-t border-[var(--color-border-subtle)] pt-3">
                    <button type="button" onClick={() => setOpenTicketId(isOpen ? null : ticket.id)} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--color-green-100)] px-3 text-[11px] font-black text-[var(--color-green-700)] transition hover:bg-[var(--color-green-200)]" aria-expanded={isOpen}>
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" /> {isOpen ? t('hideTicket') : t('openTicket')}
                    </button>
                  </div>
                )}
                {isOpen && ticket.qrToken && (
                  <div className="mt-3 rounded-xl bg-[var(--color-bg-subtle)] p-3">
                    <QRCodeDisplay
                      code={ticket.ticketCode}
                      qrToken={ticket.qrToken}
                      title={ticket.eventTitle || t('events.all')}
                      buyerName={ticket.holderName || t('customer')}
                      buyerPhone={ticket.holderPhone || ''}
                      amountXOF={ticket.priceXOF || 0}
                      currentLang={currentLang}
                      status={ticket.status === 'used' ? 'used' : ticket.status === 'cancelled' ? 'cancelled' : 'valid'}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

