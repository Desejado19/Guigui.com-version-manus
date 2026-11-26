import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SubmoduleNavbar } from './navigation/SubmoduleNavbar';
import { AdminPagination } from './admin/AdminPagination';
import { SectionHeader } from './ui';
import { AlertTriangle, RefreshCw, Search, Ticket, TrendingUp, Users } from 'lucide-react';
import type { Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { formatCurrencyXOF } from '../utils/i18n';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { Button, Card, EmptyState } from './ui';

/**
 * Bilhetes vendidos pela empresa (Secção 7 / GUI-3.4.11).
 *
 * Lê `/api/tickets/sold`, que devolve apenas os bilhetes dos eventos da própria
 * empresa. Um bilhete vendido não é reembolsável no sistema: esta lista serve
 * só para consulta e validação na portaria, sem acções de devolução.
 *
 * Cada submodulo (Todos / Por usar / Utilizados / Cancelados / Expirados)
 * apresenta apenas os bilhetes desse estado, com pesquisa propria, estado vazio
 * proprio e paginacao configuravel.
 */

interface SoldTicket {
  id: string;
  ticketCode: string;
  status: string;
  priceXOF: number;
  buyerName?: string | null;
  buyerPhone?: string | null;
  holderName: string | null;
  holderPhone: string | null;
  purchasedAt: string | null;
  eventTitle: string | null;
}

interface SoldTotals { total: number; valid: number; used: number; cancelled: number; refunded: number; revenueXOF: number }

type StatusTab = 'all' | 'valid' | 'used' | 'cancelled' | 'expired';

const TICKET_TABS: StatusTab[] = ['all', 'valid', 'used', 'cancelled', 'expired'];

const TAB_LABELS: Record<StatusTab, Record<Language, string>> = {
  all: { pt: 'Todos', en: 'All', fr: 'Tous', es: 'Todos' },
  valid: { pt: 'Por usar', en: 'Unused', fr: 'À utiliser', es: 'Sin usar' },
  used: { pt: 'Utilizados', en: 'Used', fr: 'Utilisés', es: 'Usados' },
  cancelled: { pt: 'Cancelados', en: 'Cancelled', fr: 'Annulés', es: 'Cancelados' },
  expired: { pt: 'Expirados', en: 'Expired', fr: 'Expirés', es: 'Expirados' },
};

const TAB_DESCRIPTIONS: Record<StatusTab, Record<Language, string>> = {
  all: {
    pt: 'Todos os bilhetes vendidos nos eventos desta empresa.',
    en: 'Every ticket sold across this company events.',
    fr: 'Tous les billets vendus pour les événements de cette entreprise.',
    es: 'Todas las entradas vendidas en los eventos de esta empresa.',
  },
  valid: {
    pt: 'Bilhetes ainda não utilizados na portaria, prontos para validação.',
    en: 'Tickets not yet scanned at the door, ready to be validated.',
    fr: 'Billets pas encore scannés à l’entrée, prêts à être validés.',
    es: 'Entradas aún no escaneadas en la puerta, listas para validar.',
  },
  used: {
    pt: 'Bilhetes já validados na portaria. Entradas confirmadas.',
    en: 'Tickets already validated at the door. Confirmed entries.',
    fr: 'Billets déjà validés à l’entrée. Entrées confirmées.',
    es: 'Entradas ya validadas en la puerta. Accesos confirmados.',
  },
  cancelled: {
    pt: 'Bilhetes cancelados pelo comprador ou pela organização.',
    en: 'Tickets cancelled by the buyer or the organiser.',
    fr: 'Billets annulés par l’acheteur ou l’organisation.',
    es: 'Entradas canceladas por el comprador o la organización.',
  },
  expired: {
    pt: 'Bilhetes cujo evento já terminou sem validação de entrada.',
    en: 'Tickets whose event ended without being scanned.',
    fr: 'Billets dont l’événement est terminé sans validation.',
    es: 'Entradas cuyo evento terminó sin validación.',
  },
};

const STATUS_STYLES: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  used: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-[var(--color-border-subtle)] dark:border-slate-700',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-amber-100 text-amber-800 border-amber-200',
};

const STATUS_LABELS: Record<string, Record<Language, string>> = {
  valid: { pt: 'Por usar', en: 'Unused', fr: 'À utiliser', es: 'Sin usar' },
  used: { pt: 'Utilizado', en: 'Used', fr: 'Utilisé', es: 'Usado' },
  cancelled: { pt: 'Cancelado', en: 'Cancelled', fr: 'Annulé', es: 'Cancelado' },
  expired: { pt: 'Expirado', en: 'Expired', fr: 'Expiré', es: 'Expirado' },
};

const SEARCH_PLACEHOLDER: Record<Language, string> = {
  pt: 'Pesquisar evento, nome, telefone ou código',
  en: 'Search by event, name, phone or code',
  fr: 'Rechercher par événement, nom, téléphone ou code',
  es: 'Buscar por evento, nombre, teléfono o código',
};

const EMPTY_TOTALS: SoldTotals = { total: 0, valid: 0, used: 0, cancelled: 0, refunded: 0, revenueXOF: 0 };

export const SoldTicketsPanel: React.FC<{ currentLang: Language }> = ({ currentLang }) => {
  const t = useCallback((key: string) => getTranslation(currentLang, key), [currentLang]);
  const [tickets, setTickets] = useState<SoldTicket[]>([]);
  const [totals, setTotals] = useState<SoldTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tickets/sold');
      if (!response.ok) {
        setNotice({ tone: 'error', text: t('soldTicketsLoadFailed') });
        return;
      }
      const payload = await response.json() as { tickets?: SoldTicket[]; totals?: SoldTotals; truncated?: boolean };
      setTickets(payload.tickets || []);
      setTotals(payload.totals || EMPTY_TOTALS);
      // A API limita a vista aos 500 bilhetes mais recentes: avisar em vez de
      // apresentar contagens parciais como se fossem o total da empresa.
      setNotice(payload.truncated ? { tone: 'warning', text: t('soldTicketsTruncated') } : null);
    } catch {
      setNotice({ tone: 'error', text: t('soldTicketsLoadFailed') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: tickets.length,
    valid: tickets.filter((ticket) => ticket.status === 'valid').length,
    used: tickets.filter((ticket) => ticket.status === 'used').length,
    cancelled: tickets.filter((ticket) => ticket.status === 'cancelled').length,
    expired: tickets.filter((ticket) => ticket.status === 'expired').length,
  }), [tickets]);

  // Conteudo do submodulo activo: nunca mistura estados diferentes.
  const tabTickets = useMemo(() => {
    const byStatus = statusTab === 'all' ? tickets : tickets.filter((ticket) => ticket.status === statusTab);
    const needle = query.trim().toLowerCase();
    if (!needle) return byStatus;
    return byStatus.filter((ticket) =>
      [ticket.eventTitle, ticket.holderName, ticket.holderPhone, ticket.ticketCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [tickets, statusTab, query]);

  const pagination = usePaginatedList(tabTickets, {
    initialPageSize: 20,
    pageSizeOptions: [20],
    persist: false,
    resetKey: `${statusTab}|${query}`,
  });

  const tabLabels = useMemo(
    () => Object.fromEntries(TICKET_TABS.map((tab) => [tab, TAB_LABELS[tab][currentLang]])) as Record<string, string>,
    [currentLang],
  );

  const stats = [
    { label: t('soldTicketsTotal'), value: totals.total, icon: Users },
    { label: t('soldTicketsUnused'), value: totals.valid, icon: Ticket },
    { label: t('soldTicketsUsed'), value: totals.used, icon: TrendingUp },
    { label: t('soldTicketsRevenue'), value: formatCurrencyXOF(totals.revenueXOF, currentLang), icon: TrendingUp },
  ];

  return (
    <Card className="border-[var(--color-border-subtle)] dark:border-slate-700 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">{t('soldTicketsTitle')}</p>
          <h2 className="mt-1 text-base sm:text-lg font-black text-[var(--color-text-strong)]">{t('soldTicketsSubtitle')}</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()} loading={loading} className="min-h-10 text-[11px]">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t('retry')}
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800">
            <stat.icon className="mx-auto mb-1 h-4 w-4 text-indigo-600" aria-hidden="true" />
            <div className="text-lg font-black text-slate-900 dark:text-white">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <SubmoduleNavbar
          currentTab={statusTab}
          onTabChange={(tab) => setStatusTab(tab as StatusTab)}
          tabs={TICKET_TABS as unknown as string[]}
          tabLabels={tabLabels}
          showCounts
          counts={counts}
          wrap
          ariaLabel={t('soldTicketsTitle')}
        />
      </div>

      <SectionHeader
        className="mb-3"
        title={TAB_LABELS[statusTab][currentLang]}
        description={TAB_DESCRIPTIONS[statusTab][currentLang]}
        actionsClassName="w-full sm:w-auto"
        actionsStyle={{ width: 'min(320px, 100%)' }}
        actions={(
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={SEARCH_PLACEHOLDER[currentLang]}
              aria-label={SEARCH_PLACEHOLDER[currentLang]}
              style={{ fontSize: 12 }}
              className="min-h-10 w-full min-w-0 rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 font-bold text-slate-700 dark:text-slate-200 placeholder:font-normal placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        )}
      />

      {notice && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-xs font-bold ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : notice.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice.text}</span>
        </div>
      )}

      {!loading && tabTickets.length === 0 ? (
        <EmptyState
          title={statusTab === 'all' ? t('noSoldTickets') : TAB_LABELS[statusTab][currentLang]}
          description={statusTab === 'all' ? t('noSoldTicketsHint') : TAB_DESCRIPTIONS[statusTab][currentLang]}
          icon={<Ticket className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-2">
          {pagination.pageItems.map((ticket) => {
            const label = STATUS_LABELS[ticket.status]?.[currentLang] || ticket.status;
            return (
              <div key={ticket.id} className="grid gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-black text-slate-900 dark:text-white dark:text-slate-100">{ticket.eventTitle || t('events.all')}</p>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-100">
                    {ticket.buyerName || ticket.holderName || ticket.holderPhone || t('customer')}
                    {ticket.holderName && ticket.buyerName && ticket.holderName !== ticket.buyerName
                      ? ` → ${ticket.holderName}`
                      : ''}{' '}
                    · <span className="whitespace-nowrap font-mono">{ticket.ticketCode}</span>
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{formatCurrencyXOF(ticket.priceXOF, currentLang)}</span>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${STATUS_STYLES[ticket.status] || 'border-[var(--color-border-subtle)] dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tabTickets.length > 0 && (
        <AdminPagination
          className="mt-4"
          currentLang={currentLang}
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={pagination.pageSizeOptions}
        />
      )}
    </Card>
  );
};
