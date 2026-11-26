import React from 'react';
import { Clock, MapPin } from 'lucide-react';
import type { EventItem, Language } from '../../types';
import { translatePublishedText } from '../../utils/contentTranslation';

interface EventCardProps {
  event: EventItem;
  currentLang: Language;
  onOpen: (event: EventItem) => void;
  /** Visitantes sem sessão apenas consultam o evento, sem comprar bilhetes. */
  canBuy?: boolean;
}

const WEEKDAYS: Record<Language, string[]> = {
  pt: ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'],
  en: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
  fr: ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'],
  es: ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'],
};

const MONTHS: Record<Language, string[]> = {
  pt: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  fr: ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'],
  es: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
};

/** Data do evento em partes, para o bloco de calendário do cartão. */
export function splitEventDate(event: Pick<EventItem, 'date'>, currentLang: Language) {
  const parsed = new Date(`${event.date}T12:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { weekday: '', day: event.date.slice(8, 10) || '--', month: '' };
  }
  return {
    weekday: WEEKDAYS[currentLang][parsed.getDay()] ?? '',
    day: String(parsed.getDate()).padStart(2, '0'),
    month: MONTHS[currentLang][parsed.getMonth()] ?? '',
  };
}

export function formatEventDateLong(event: Pick<EventItem, 'date' | 'time'>, currentLang: Language) {
  const parsed = new Date(`${event.date}T${event.time || '00:00'}`);
  if (Number.isNaN(parsed.getTime())) return `${event.date} ${event.time}`.trim();
  const locale = currentLang === 'pt' ? 'pt-PT' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-GB';
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(parsed);
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${weekday}, ${day}/${month}, ${event.time || '--:--'}`;
}

export function lowestTicketPrice(event: EventItem): number | null {
  const prices = (event.ticketTypes || []).map((type) => type.priceXOF).filter((price) => Number.isFinite(price));
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Cartao de evento seguindo a estrutura aprovada: imagem com bloco de data,
 * categoria, titulo, local, hora e rodape com preco minimo e accao de compra.
 */
export const EventCard: React.FC<EventCardProps> = ({ event, currentLang, onOpen, canBuy = true }) => {
  const date = splitEventDate(event, currentLang);
  const price = lowestTicketPrice(event);
  const soldOut = (event.ticketTypes || []).every((type) => type.availableQuantity <= 0);

  return (
    <article className="guigui-event-card group flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--color-neutral-200)] bg-[var(--color-bg-surface)] dark:bg-slate-800 shadow-[0_1px_2px_rgba(16,41,35,0.06)] transition hover:shadow-[0_10px_30px_rgba(16,41,35,0.12)]">
      <button type="button" onClick={() => onOpen(event)} className="relative block h-56 w-full overflow-hidden bg-[var(--color-neutral-100)] text-left">
        {event.mediaType === 'video' ? (
          <video src={event.coverImage} muted playsInline className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" aria-label={event.title} />
        ) : (
          <img src={event.coverImage} alt={event.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        )}

        <div className="absolute left-4 top-4 flex w-[68px] flex-col items-center gap-0.5 rounded-2xl bg-white dark:bg-slate-900 px-2 py-2.5 text-center shadow-[0_6px_18px_rgba(8,26,22,0.18)]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">{date.weekday}</span>
          <span className="text-2xl font-black leading-none text-[var(--color-green-900)]">{date.day}</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">{date.month}</span>
        </div>

        <span className="absolute right-4 top-4 rounded-full bg-[var(--color-green-800)] px-3.5 py-1.5 text-xs font-semibold text-white capitalize">
          {event.category}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-black leading-tight tracking-[-0.01em] text-[var(--color-neutral-900)]">
          {translatePublishedText(event.title, currentLang, 'title')}
        </h3>

        <div className="space-y-2 text-sm text-[var(--color-neutral-600)]">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--color-neutral-500)]" />
            <span className="truncate">{event.location}, {event.neighborhood}</span>
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-[var(--color-neutral-500)]" />
            <span>{event.time}</span>
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <div className="min-w-0">
            {price === null ? (
              <span className="text-sm font-black text-[var(--color-green-800)]">Preço sob consulta</span>
            ) : (
              <span className="text-sm font-black text-[var(--color-green-800)]">
                desde {price.toLocaleString(currentLang === 'pt' ? 'pt-PT' : currentLang)} XOF
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpen(event)}
            className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-green-700)] ${
              canBuy
                ? 'bg-[var(--color-coral-700)] text-white hover:bg-[var(--color-coral-800)]'
                : 'border border-[var(--color-green-700)] text-[var(--color-green-800)] hover:bg-[var(--color-green-50)]'
            }`}
          >
            {!canBuy ? 'Ver detalhes' : soldOut ? 'Esgotado' : 'Comprar bilhete'}
          </button>
        </div>
      </div>
    </article>
  );
};
