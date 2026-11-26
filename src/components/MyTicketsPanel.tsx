import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Download,
  FileText,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  Square,
  Ticket,
} from 'lucide-react';
import type { Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { Button, Card, EmptyState } from './ui';
import { QRCodeDisplay } from './QRCodeDisplay';
import { AdminPagination } from './admin/AdminPagination';
import { buildTicketPdf, ticketPdfFileName } from '../utils/ticketPdf';
import { createZip } from '../utils/zip';

/**
 * Bilhetes do cidadão (Secção 7 / GUI-3.4.10).
 *
 * Lê `/api/tickets/mine`, que é a fonte de verdade e faz a paginação no
 * servidor (10 por página). A retenção de 7 dias também é decidida no servidor:
 * bilhetes de eventos já realizados saem da listagem ativa, mas nada é apagado
 * — o histórico continua disponível no separador "Arquivados".
 *
 * NOTA (Regra 6): Após a confirmação do pagamento, a compra é definitiva.
 * O comprador NÃO pode cancelar voluntariamente nem solicitar reembolso por
 * motivos pessoais. O sistema não apresenta funcionalidade de "Cancelar compra".
 * O cancelamento só é possível por operação do organizador ou administração
 * (Regra 7), ou como parte de um procedimento de reembolso aprovado (Regra 9).
 */

interface RealTicket {
  id: string;
  ticketCode: string;
  qrToken?: string;
  pinCode?: string;
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  ticketTypeName?: string;
  status: string;
  priceXOF?: number;
  purchasedAt?: string;
  expiresAt?: string;
  holderName?: string;
  holderPhone?: string;
  buyerName?: string;
  buyerPhone?: string;
  archived?: boolean;
}

interface TicketsResponse {
  tickets?: RealTicket[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  activeTotal?: number;
  archivedTotal?: number;
  retentionDays?: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-[var(--color-gold-100)] text-[var(--color-gold-800)] border-[var(--color-gold-200)] dark:bg-[var(--color-gold-900)]/35 dark:text-[var(--color-gold-200)]',
  valid: 'bg-[var(--color-green-100)] text-[var(--color-green-800)] border-[var(--color-green-200)] dark:bg-[var(--color-green-900)]/40 dark:text-[var(--color-green-200)]',
  used: 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] dark:bg-[var(--color-neutral-800)] dark:text-[var(--color-text-muted-dark)]',
  expired: 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] dark:bg-[var(--color-neutral-800)] dark:text-[var(--color-text-muted-dark)]',
  cancelled: 'bg-[var(--color-red-100)] text-[var(--color-red-800)] border-[var(--color-red-200)] dark:bg-[var(--color-red-900)]/35 dark:text-[var(--color-red-200)]',
};

const STATUS_LABELS: Record<string, Record<Language, string>> = {
  pending: { pt: 'Pendente', en: 'Pending', fr: 'En attente', es: 'Pendiente' },
  valid: { pt: 'Válido', en: 'Valid', fr: 'Valide', es: 'Válido' },
  used: { pt: 'Utilizado', en: 'Used', fr: 'Utilisé', es: 'Usado' },
  expired: { pt: 'Expirado', en: 'Expired', fr: 'Expiré', es: 'Expirado' },
  cancelled: { pt: 'Cancelado', en: 'Cancelled', fr: 'Annulé', es: 'Cancelado' },
};

const PAGE_SIZE = 10;

function formatEventDate(ticket: RealTicket, lang: Language): string {
  if (!ticket.eventDate) return '';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(ticket.eventDate) ? `${ticket.eventDate}T12:00:00` : ticket.eventDate;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return ticket.eventDate;
  const locale = lang === 'pt' ? 'pt-PT' : lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'es-ES';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPrice(value: number | undefined, lang: Language): string {
  const locale = lang === 'pt' ? 'pt-PT' : lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'es-ES';
  return `${(value || 0).toLocaleString(locale)} XOF`;
}

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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState(7);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /** Cache dos bilhetes já vistos, para o download em massa não voltar a pedir. */
  const knownTickets = useRef<Map<string, RealTicket>>(new Map());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const buildQuery = useCallback((targetPage: number, pageSize = PAGE_SIZE) => {
    const params = new URLSearchParams({
      page: String(targetPage),
      pageSize: String(pageSize),
    });
    if (showArchived) params.set('archivedOnly', '1');
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    return params.toString();
  }, [debouncedSearch, showArchived, statusFilter]);

  const applyPayload = useCallback((payload: TicketsResponse) => {
    const list = payload.tickets || [];
    list.forEach((ticket) => knownTickets.current.set(ticket.id, ticket));
    setTickets(list);
    setTotal(payload.total ?? list.length);
    setActiveTotal(payload.activeTotal ?? 0);
    setArchivedTotal(payload.archivedTotal ?? 0);
    setRetentionDays(payload.retentionDays ?? 7);
    if (payload.page && payload.page !== page) setPage(payload.page);
  }, [page]);

  const load = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tickets/mine?${buildQuery(targetPage)}`);
      if (!response.ok) {
        setNotice({ tone: 'error', text: t('ticketsLoadFailed') });
        return;
      }
      applyPayload(await response.json() as TicketsResponse);
    } catch {
      setNotice({ tone: 'error', text: t('ticketsLoadFailed') });
    } finally {
      setLoading(false);
    }
  }, [applyPayload, buildQuery, page, t]);

  useEffect(() => { void load(page); }, [load, page, debouncedSearch, statusFilter, showArchived]);

  /** Reúne todos os bilhetes que correspondem aos filtros atuais (todas as páginas). */
  const fetchAllFiltered = useCallback(async (): Promise<RealTicket[]> => {
    const collected: RealTicket[] = [];
    let currentPage = 1;
    let pages = 1;
    do {
      const response = await fetch(`/api/tickets/mine?${buildQuery(currentPage, 50)}`);
      if (!response.ok) break;
      const payload = await response.json() as TicketsResponse;
      (payload.tickets || []).forEach((ticket) => {
        collected.push(ticket);
        knownTickets.current.set(ticket.id, ticket);
      });
      pages = payload.totalPages || 1;
      currentPage += 1;
    } while (currentPage <= pages && currentPage <= 40);
    return collected;
  }, [buildQuery]);

  const selectedOnPage = tickets.filter((ticket) => selected.has(ticket.id)).length;
  const allOnPageSelected = tickets.length > 0 && selectedOnPage === tickets.length;

  const toggleTicket = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allOnPageSelected) tickets.forEach((ticket) => next.delete(ticket.id));
      else tickets.forEach((ticket) => next.add(ticket.id));
      return next;
    });
  };

  const selectAllEligible = async () => {
    setNotice(null);
    try {
      const all = await fetchAllFiltered();
      setSelected(new Set(all.map((ticket) => ticket.id)));
      setNotice({
        tone: 'success',
        text: `${all.length} ${all.length === 1 ? 'bilhete selecionado' : 'bilhetes selecionados'}.`,
      });
    } catch {
      setNotice({ tone: 'error', text: t('ticketsLoadFailed') });
    }
  };

  const downloadBlob = (fileName: string, data: BlobPart, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSinglePdf = async (ticket: RealTicket) => {
    setDownloadingId(ticket.id);
    setNotice(null);
    try {
      const bytes = await buildTicketPdf(ticket);
      downloadBlob(`${ticket.ticketCode}-bilhete.pdf`, bytes, 'application/pdf');
    } catch {
      setNotice({ tone: 'error', text: 'Não foi possível gerar o PDF deste bilhete. Tente novamente.' });
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * Download em massa: um PDF por bilhete, com o QR Code original, dentro de um
   * único ZIP. O estado dos bilhetes não é alterado por este download.
   */
  const downloadSelected = async () => {
    if (!selected.size || downloadProgress) return;
    setNotice(null);
    const ids = [...selected];
    let pool = ids.map((id) => knownTickets.current.get(id)).filter((ticket): ticket is RealTicket => Boolean(ticket));
    if (pool.length < ids.length) {
      await fetchAllFiltered();
      pool = ids.map((id) => knownTickets.current.get(id)).filter((ticket): ticket is RealTicket => Boolean(ticket));
    }
    if (!pool.length) {
      setNotice({ tone: 'error', text: 'Não foi possível obter os bilhetes selecionados.' });
      return;
    }

    setDownloadProgress({ done: 0, total: pool.length });
    try {
      const entries: Array<{ name: string; data: Uint8Array }> = [];
      for (let index = 0; index < pool.length; index += 1) {
        const ticket = pool[index];
        const bytes = await buildTicketPdf(ticket);
        entries.push({ name: ticketPdfFileName(ticket, index), data: bytes });
        setDownloadProgress({ done: index + 1, total: pool.length });
      }
      const zip = createZip(entries);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(`bilhetes-guigui-${stamp}.zip`, zip, 'application/zip');
      setNotice({
        tone: 'success',
        text: `${entries.length} ${entries.length === 1 ? 'bilhete descarregado' : 'bilhetes descarregados'} num ficheiro ZIP.`,
      });
    } catch {
      setNotice({ tone: 'error', text: 'A geração do ZIP falhou. Tente com menos bilhetes selecionados.' });
    } finally {
      setDownloadProgress(null);
    }
  };

  const statusOptions = useMemo(() => (['all', 'valid', 'pending', 'used', 'expired', 'cancelled'] as const), []);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-green-700)]">{t('realTicketsTitle')}</p>
          <h2 className="mt-1 text-base font-black text-[var(--color-text-strong)] sm:text-lg">{t('realTicketsSubtitle')}</h2>
          <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {total} {total === 1 ? 'bilhete' : 'bilhetes'}
            {!showArchived && archivedTotal > 0 && (
              <> · {archivedTotal} {archivedTotal === 1 ? 'arquivado' : 'arquivados'} após {retentionDays} dias do evento ou da compra</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void load(page)} loading={loading} className="min-h-10 text-[11px]">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t('retry')}
          </Button>
          <Ticket className="h-6 w-6 text-[var(--color-green-600)]" aria-hidden="true" />
        </div>
      </div>

      {notice && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs font-bold ${notice.tone === 'success' ? 'border-[var(--color-green-200)] bg-[var(--color-green-100)] text-[var(--color-green-800)] dark:border-[var(--color-green-900)] dark:bg-[var(--color-green-900)]/30 dark:text-[var(--color-green-100)]' : 'border-[var(--color-red-200)] bg-[var(--color-red-100)] text-[var(--color-red-800)] dark:border-[var(--color-red-900)] dark:bg-[var(--color-red-900)]/30 dark:text-[var(--color-red-100)]'}`}
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice.text}</span>
        </div>
      )}

      {/* Filtros: mantêm-se durante a navegação entre páginas */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar bilhete ou evento"
            aria-label="Pesquisar bilhete ou evento"
            className="min-h-10 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] pl-9 pr-3 text-xs font-semibold text-[var(--color-text-strong)] outline-none focus-visible:border-[var(--color-green-500)]"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
          aria-label="Filtrar por estado"
          className="min-h-10 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 text-[11px] font-bold text-[var(--color-text-strong)]"
        >
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {value === 'all' ? 'Todos os estados' : STATUS_LABELS[value]?.[currentLang] || value}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setShowArchived((previous) => !previous); setPage(1); setSelected(new Set()); }}
          aria-pressed={showArchived}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-black transition ${showArchived ? 'border-[var(--color-green-600)] bg-[var(--color-green-100)] text-[var(--color-green-800)] dark:bg-[var(--color-green-900)]/40 dark:text-[var(--color-green-100)]' : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'}`}
        >
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          Arquivados {archivedTotal > 0 ? `(${archivedTotal})` : ''}
        </button>
      </div>

      {/* Barra de seleção / download em massa */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePage}
            disabled={tickets.length === 0}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-black text-[var(--color-text-strong)] transition enabled:hover:bg-[var(--color-bg-surface)] disabled:opacity-40"
          >
            {allOnPageSelected ? <CheckSquare className="h-4 w-4 text-[var(--color-green-600)]" aria-hidden="true" /> : <Square className="h-4 w-4" aria-hidden="true" />}
            {allOnPageSelected ? 'Desmarcar página' : 'Selecionar página'}
          </button>
          <button
            type="button"
            onClick={() => void selectAllEligible()}
            disabled={total === 0}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-black text-[var(--color-text-muted)] transition enabled:hover:bg-[var(--color-bg-surface)] enabled:hover:text-[var(--color-text-strong)] disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Selecionar todos os elegíveis
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
            {selected.size} selecionado{selected.size === 1 ? '' : 's'}
          </span>
          {downloadProgress && (
            <span className="text-[11px] font-black text-[var(--color-green-700)]" role="status">
              {downloadProgress.done}/{downloadProgress.total}
            </span>
          )}
          <button
            type="button"
            onClick={() => void downloadSelected()}
            disabled={selected.size === 0 || Boolean(downloadProgress)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--color-green-600)] px-3 text-[11px] font-black text-white transition enabled:hover:bg-[var(--color-green-700)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {downloadProgress ? 'A preparar…' : 'Descarregar selecionados'}
          </button>
        </div>
      </div>
      {downloadProgress && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-subtle)]" role="progressbar" aria-valuemin={0} aria-valuemax={downloadProgress.total} aria-valuenow={downloadProgress.done} aria-label="Progresso do download">
          <div className="h-full bg-[var(--color-green-600)] transition-all" style={{ width: `${Math.round((downloadProgress.done / Math.max(1, downloadProgress.total)) * 100)}%` }} />
        </div>
      )}

      {loading ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
              <div className="h-3 w-2/3 rounded bg-[var(--color-border-subtle)]" />
              <div className="mt-2 h-2.5 w-1/3 rounded bg-[var(--color-border-subtle)]" />
              <div className="mt-2 h-2.5 w-1/2 rounded bg-[var(--color-border-subtle)]" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        showArchived || debouncedSearch || statusFilter !== 'all'
          ? <EmptyState title={t('noResults')} description="Nenhum bilhete corresponde a estes filtros." icon={<Ticket className="h-6 w-6" aria-hidden="true" />} />
          : fallback ?? <EmptyState title={t('noRealTickets')} description={t('noRealTicketsHint')} icon={<Ticket className="h-6 w-6" aria-hidden="true" />} />
      ) : (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => {
            const label = STATUS_LABELS[ticket.status]?.[currentLang] || ticket.status;
            const isOpen = openTicketId === ticket.id;
            const isSelected = selected.has(ticket.id);
            return (
              <article
                key={ticket.id}
                className={`rounded-[var(--radius-lg)] border bg-[var(--color-bg-surface)] guigui-dpanel p-3 shadow-[var(--shadow-xs)] transition ${isSelected ? 'border-[var(--color-green-500)] ring-1 ring-[var(--color-green-500)]' : 'border-[var(--color-border-subtle)]'}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTicket(ticket.id)}
                    aria-pressed={isSelected}
                    aria-label={`Selecionar bilhete ${ticket.ticketCode}`}
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-green-700)]"
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4 text-[var(--color-green-600)]" aria-hidden="true" /> : <Square className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-green-100)] text-[var(--color-green-700)] dark:bg-[var(--color-green-900)]/40 dark:text-[var(--color-green-200)]" aria-hidden="true">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[12.5px] font-black leading-snug text-[var(--color-text-strong)]">{ticket.eventTitle || t('events.all')}</p>
                    <p className="mt-0.5 truncate text-[10.5px] font-semibold text-[var(--color-text-muted)]">{ticket.ticketTypeName || 'Entrada'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${STATUS_STYLES[ticket.status] || STATUS_STYLES.used}`}>{label}</span>
                </div>

                <dl className="mt-2 grid gap-1 text-[10.5px] text-[var(--color-text-muted)]">
                  {(ticket.eventDate || ticket.eventTime) && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-[var(--color-text-strong)]">{formatEventDate(ticket, currentLang)}</span>
                      {ticket.eventTime && <span>{ticket.eventTime}</span>}
                    </div>
                  )}
                  {ticket.eventLocation && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{ticket.eventLocation}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-black tracking-wide text-[var(--color-green-700)]">{ticket.ticketCode}</span>
                    <span className="font-bold text-[var(--color-text-strong)]">{formatPrice(ticket.priceXOF, currentLang)}</span>
                  </div>
                </dl>

                {ticket.archived && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-[var(--color-neutral-100)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--color-text-muted)] dark:bg-[var(--color-neutral-800)]">
                    <Archive className="h-2.5 w-2.5" aria-hidden="true" /> Arquivado
                  </p>
                )}

                <div className="mt-2 flex items-center gap-1.5 border-t border-[var(--color-border-subtle)] pt-2">
                  {ticket.qrToken && (
                    <button
                      type="button"
                      onClick={() => setOpenTicketId(isOpen ? null : ticket.id)}
                      aria-expanded={isOpen}
                      className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-green-100)] px-2 text-[10.5px] font-black text-[var(--color-green-700)] transition hover:bg-[var(--color-green-200)] dark:bg-[var(--color-green-900)]/40 dark:text-[var(--color-green-100)]"
                    >
                      <QrCode className="h-3 w-3" aria-hidden="true" /> {isOpen ? t('hideTicket') : t('openTicket')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void downloadSinglePdf(ticket)}
                    disabled={downloadingId === ticket.id}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2 text-[10.5px] font-black text-[var(--color-text-strong)] transition enabled:hover:border-[var(--color-green-400)] disabled:opacity-50"
                    title="Descarregar este bilhete em PDF"
                  >
                    <FileText className="h-3 w-3" aria-hidden="true" /> PDF
                  </button>
                </div>

                {isOpen && ticket.qrToken && (
                  <div className="mt-2 rounded-xl bg-[var(--color-bg-subtle)] p-2.5">
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
              </article>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="mt-4">
          <AdminPagination
            currentLang={currentLang}
            currentPage={page}
            pageSize={PAGE_SIZE}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            pageSizeOptions={[PAGE_SIZE]}
          />
        </div>
      )}
    </Card>
  );
};
