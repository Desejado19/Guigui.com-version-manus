import React, { useMemo } from 'react';
import type { EventItem } from '../../../types';
import { RecordsManagementPage } from './RecordsManagementPage';

interface TicketRow {
  id: string;
  eventId: string;
  eventTitle: string;
  organizer: string;
  status: EventItem['status'];
  typeName: string;
  priceXOF: number;
  sold: number;
  available: number;
  revenueXOF: number;
}

interface TicketsManagementPageProps {
  events: EventItem[];
  onBack: () => void;
}

export const TicketsManagementPage: React.FC<TicketsManagementPageProps> = ({ events, onBack }) => {
  const rows = useMemo<TicketRow[]>(() => events.flatMap((event) => (event.ticketTypes || []).map((type) => ({
    id: `${event.id}::${type.id}`,
    eventId: event.id,
    eventTitle: event.title,
    organizer: event.organizerName,
    status: event.status,
    typeName: type.name,
    priceXOF: type.priceXOF,
    sold: type.soldQuantity,
    available: type.availableQuantity,
    revenueXOF: type.priceXOF * type.soldQuantity,
  }))), [events]);

  const totals = useMemo(() => ({
    sold: rows.reduce((sum, row) => sum + row.sold, 0),
    available: rows.reduce((sum, row) => sum + row.available, 0),
    revenue: rows.reduce((sum, row) => sum + row.revenueXOF, 0),
  }), [rows]);

  return (
    <RecordsManagementPage<TicketRow>
      title="Gestão de bilhetes"
      description="Catálogo de bilhetes por evento, com preços, quantidade vendida, disponibilidade e receita. Os valores são calculados a partir dos tipos de bilhete reais de cada evento."
      moduleLabel="Eventos & Bilhetes"
      storageKey="admin.management.tickets"
      onBack={onBack}
      rows={rows}
      rowKey={(row) => row.id}
      searchPlaceholder="Pesquisar por evento, organizador ou tipo de bilhete…"
      searchFields={(row) => [row.eventTitle, row.organizer, row.typeName, row.eventId, row.id]}
      filters={[
        { key: 'status', label: 'Estado do evento', options: [
          { value: 'all', label: 'Todos' },
          { value: 'active', label: 'Ativos' },
          { value: 'draft', label: 'Rascunhos' },
          { value: 'cancelled', label: 'Cancelados' },
          { value: 'ended', label: 'Encerrados' },
        ] },
        { key: 'availability', label: 'Disponibilidade', options: [
          { value: 'all', label: 'Todos' },
          { value: 'available', label: 'Com bilhetes disponíveis' },
          { value: 'soldout', label: 'Esgotados' },
        ] },
      ]}
      matchesFilters={(row, filters) => (
        (filters.status === 'all' || row.status === filters.status)
        && (filters.availability === 'all'
          || (filters.availability === 'soldout' ? row.available <= 0 : row.available > 0))
      )}
      sortValue={(row, key) => {
        if (key === 'price') return row.priceXOF;
        if (key === 'sold') return row.sold;
        if (key === 'available') return row.available;
        if (key === 'revenue') return row.revenueXOF;
        return row.eventTitle;
      }}
      defaultSortKey="sold"
      columns={[
        {
          key: 'eventTitle',
          label: 'Evento',
          sortable: true,
          render: (row) => (
            <div className="min-w-[200px]">
              <div className="truncate font-black text-slate-900">{row.eventTitle}</div>
              <div className="truncate text-[9.5px] text-slate-500">{row.organizer} · {row.eventId}</div>
            </div>
          ),
        },
        { key: 'typeName', label: 'Tipo de bilhete', render: (row) => <span className="font-bold text-slate-800">{row.typeName}</span> },
        { key: 'price', label: 'Preço', sortable: true, render: (row) => <span className="whitespace-nowrap tabular-nums">{row.priceXOF.toLocaleString('pt-PT')} XOF</span> },
        { key: 'sold', label: 'Vendidos', sortable: true, render: (row) => <span className="tabular-nums">{row.sold.toLocaleString('pt-PT')}</span> },
        { key: 'available', label: 'Disponíveis', sortable: true, render: (row) => <span className={`tabular-nums font-bold ${row.available <= 0 ? 'text-rose-700' : 'text-slate-700'}`}>{row.available.toLocaleString('pt-PT')}</span> },
        { key: 'revenue', label: 'Receita', sortable: true, render: (row) => <span className="whitespace-nowrap font-black tabular-nums text-emerald-800">{row.revenueXOF.toLocaleString('pt-PT')} XOF</span> },
      ]}
      kpis={[
        { label: 'Tipos de bilhete', value: rows.length, tone: 'info' },
        { label: 'Bilhetes vendidos', value: totals.sold.toLocaleString('pt-PT'), tone: 'success' },
        { label: 'Bilhetes disponíveis', value: totals.available.toLocaleString('pt-PT'), tone: 'neutral' },
        { label: 'Receita calculada', value: `${totals.revenue.toLocaleString('pt-PT')} XOF`, tone: 'warning' },
      ]}
      exportSpec={{
        filename: `bilhetes-guigui-${new Date().toISOString().slice(0, 10)}`,
        sheet: 'Bilhetes',
        title: 'Relatório de Bilhetes — Guigui.com',
        description: 'Tipos de bilhete por evento com vendas, disponibilidade e receita.',
        headers: ['Evento', 'Referência do evento', 'Organizador', 'Tipo', 'Preço XOF', 'Vendidos', 'Disponíveis', 'Receita XOF'],
        row: (row) => [row.eventTitle, row.eventId, row.organizer, row.typeName, row.priceXOF, row.sold, row.available, row.revenueXOF],
        pdfKpis: [
          { label: 'Tipos', value: String(rows.length) },
          { label: 'Vendidos', value: String(totals.sold) },
          { label: 'Receita', value: `${totals.revenue} XOF` },
        ],
      }}
      emptyMessage="Nenhum tipo de bilhete encontrado para os eventos atuais."
    />
  );
};
