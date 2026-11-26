import React, { useMemo, useState } from 'react';
import { Ticket } from 'lucide-react';
import type { EventItem } from '../../../types';
import { formatManagementDate } from './managementState';
import { RecordsManagementPage } from './RecordsManagementPage';
import { EventControlCenter } from '../../events/EventControlCenter';

const STATUS_LABELS: Record<EventItem['status'], string> = {
  active: 'Ativo',
  draft: 'Rascunho',
  cancelled: 'Cancelado',
  ended: 'Encerrado',
};

interface EventsManagementPageProps {
  events: EventItem[];
  onBack: () => void;
}

export const EventsManagementPage: React.FC<EventsManagementPageProps> = ({ events, onBack }) => {
  const [controlEvent, setControlEvent] = useState<EventItem | null>(null);
  const categories = useMemo(
    () => [...new Set(events.map((event) => event.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')),
    [events],
  );

  const totals = useMemo(() => ({
    active: events.filter((event) => event.status === 'active').length,
    draft: events.filter((event) => event.status === 'draft').length,
    cancelled: events.filter((event) => event.status === 'cancelled').length,
    tickets: events.reduce((sum, event) => sum + (event.totalTicketsSold || 0), 0),
    revenue: events.reduce((sum, event) => sum + (event.totalRevenueXOF || 0), 0),
  }), [events]);

  return (
    <>
    <RecordsManagementPage<EventItem>
      title="Gestão de eventos"
      description="Pesquise e filtre todos os eventos, consulte ocupação e receita e abra a ficha detalhada de cada registo."
      moduleLabel="Eventos & Bilhetes"
      storageKey="admin.management.events"
      onBack={onBack}
      rows={events}
      rowKey={(event) => event.id}
      searchPlaceholder="Pesquisar por título, organizador, local ou referência…"
      searchFields={(event) => [event.id, event.title, event.organizerName, event.location, event.neighborhood, event.category]}
      filters={[
        { key: 'status', label: 'Estado', options: [
          { value: 'active', label: 'Ativos' },
          { value: 'draft', label: 'Rascunhos' },
          { value: 'cancelled', label: 'Cancelados' },
          { value: 'ended', label: 'Encerrados' },
        ] },
        { key: 'category', label: 'Categoria', options: [
          { value: 'all', label: 'Todas' },
          ...categories.map((category) => ({ value: category, label: category })),
        ] },
      ]}
      matchesFilters={(event, filters) => (
        (filters.status === 'all' || event.status === filters.status)
        && (filters.category === 'all' || event.category === filters.category)
      )}
      sortValue={(event, key) => {
        if (key === 'date') return event.date || '';
        if (key === 'sold') return event.totalTicketsSold || 0;
        if (key === 'revenue') return event.totalRevenueXOF || 0;
        if (key === 'status') return event.status;
        return event.title;
      }}
      defaultSortKey="date"
      columns={[
        {
          key: 'title',
          label: 'Evento',
          sortable: true,
          render: (event) => (
            <div className="flex min-w-[220px] items-center gap-2">
              {event.coverImage ? <img src={event.coverImage} alt="" className="h-9 w-9 rounded-lg border border-[var(--color-border-default)] object-cover" /> : null}
              <div className="min-w-0">
                <div className="truncate font-black text-slate-900">{event.title}</div>
                <div className="truncate text-[9.5px] text-slate-500">{event.organizerName} · {event.location}</div>
              </div>
            </div>
          ),
        },
        { key: 'category', label: 'Categoria', sortable: true, render: (event) => event.category || '—' },
        { key: 'date', label: 'Data', sortable: true, render: (event) => <span className="whitespace-nowrap">{formatManagementDate(event.date)} · {event.time}</span> },
        {
          key: 'status',
          label: 'Estado',
          sortable: true,
          render: (event) => (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${
              event.status === 'active' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
                : event.status === 'draft' ? 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]'
                  : 'border-slate-300 bg-slate-100 text-slate-700'
            }`}>{STATUS_LABELS[event.status] || event.status}</span>
          ),
        },
        { key: 'sold', label: 'Bilhetes', sortable: true, render: (event) => <span className="tabular-nums">{(event.totalTicketsSold || 0).toLocaleString('pt-PT')}</span> },
        { key: 'revenue', label: 'Receita', sortable: true, render: (event) => <span className="whitespace-nowrap font-black tabular-nums text-[var(--tone-success-text)]">{(event.totalRevenueXOF || 0).toLocaleString('pt-PT')} XOF</span> },
      ]}
      kpis={[
        { label: 'Total de eventos', value: events.length, tone: 'info' },
        { label: 'Ativos', value: totals.active, tone: 'success' },
        { label: 'Rascunhos', value: totals.draft, tone: 'warning' },
        { label: 'Cancelados', value: totals.cancelled, tone: 'danger' },
        { label: 'Bilhetes vendidos', value: totals.tickets.toLocaleString('pt-PT'), hint: `${totals.revenue.toLocaleString('pt-PT')} XOF`, tone: 'neutral' },
      ]}
      exportSpec={{
        filename: `eventos-guigui-${new Date().toISOString().slice(0, 10)}`,
        sheet: 'Eventos',
        title: 'Relatório de Eventos — Guigui.com',
        description: 'Listagem administrativa de eventos após aplicação dos filtros atuais.',
        headers: ['ID', 'Título', 'Organizador', 'Categoria', 'Data', 'Hora', 'Local', 'Bairro', 'Estado', 'Bilhetes vendidos', 'Receita XOF'],
        row: (event) => [event.id, event.title, event.organizerName, event.category, event.date, event.time, event.location, event.neighborhood, STATUS_LABELS[event.status], event.totalTicketsSold || 0, event.totalRevenueXOF || 0],
        pdfKpis: [
          { label: 'Eventos', value: String(events.length) },
          { label: 'Ativos', value: String(totals.active) },
          { label: 'Bilhetes', value: String(totals.tickets) },
        ],
      }}
      rowActions={(event) => (
        <button
          type="button"
          onClick={() => setControlEvent(event)}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 transition hover:border-[var(--color-green-700)] dark:border-slate-700 dark:text-slate-300"
        >
          <Ticket className="h-3 w-3" /> Centro de controlo
        </button>
      )}
      detailLabel={(event) => event.title}
      detail={(event) => (
        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ['Referência', event.id],
              ['Organizador', event.organizerName],
              ['Data e hora', `${formatManagementDate(event.date)} às ${event.time}`],
              ['Local', `${event.location} · ${event.neighborhood}`],
              ['Categoria', event.category],
              ['Estado', STATUS_LABELS[event.status]],
              ['Bilhetes vendidos', `${event.totalTicketsSold || 0}`],
              ['Receita', `${(event.totalRevenueXOF || 0).toLocaleString('pt-PT')} XOF`],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
                <div className="mt-0.5 font-medium text-slate-700">{value || '—'}</div>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-slate-50 p-3 leading-relaxed text-slate-600">{event.description || 'Sem descrição registada.'}</p>
          <div>
            <h4 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Tipos de bilhete</h4>
            <table className="w-full border-collapse text-left text-[10.5px]">
              <thead><tr className="bg-slate-50 text-[9px] uppercase text-slate-500"><th className="p-2">Tipo</th><th className="p-2">Preço</th><th className="p-2">Vendidos</th><th className="p-2">Disponíveis</th></tr></thead>
              <tbody>
                {(event.ticketTypes || []).map((type) => (
                  <tr key={type.id} className="border-b border-[var(--color-border-subtle)]">
                    <td className="p-2 font-bold">{type.name}</td>
                    <td className="p-2">{type.priceXOF.toLocaleString('pt-PT')} XOF</td>
                    <td className="p-2">{type.soldQuantity}</td>
                    <td className="p-2">{type.availableQuantity}</td>
                  </tr>
                ))}
                {(event.ticketTypes || []).length === 0 && <tr><td colSpan={4} className="p-3 text-center text-slate-500">Sem tipos de bilhete registados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    />
    {controlEvent ? (
      <EventControlCenter
        eventId={controlEvent.id}
        eventTitle={controlEvent.title}
        viewerRole="admin"
        onClose={() => setControlEvent(null)}
      />
    ) : null}
    </>
  );
};
