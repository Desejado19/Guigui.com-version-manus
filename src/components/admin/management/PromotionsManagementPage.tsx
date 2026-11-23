import React, { useMemo } from 'react';
import type { Business, Promotion } from '../../../types';
import { formatManagementDate } from './managementState';
import { RecordsManagementPage } from './RecordsManagementPage';

interface PromotionRow {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  discountBadge: string;
  description: string;
  categoryName: string;
  neighborhood: string;
  validUntil: string;
  code?: string;
  status: string;
  clicks: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending_moderation: 'Pendente de moderação',
  scheduled: 'Agendada',
  active: 'Ativa',
  failed: 'Falhada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  inactive: 'Inativa',
};

interface PromotionsManagementPageProps {
  businesses: Business[];
  promotions?: Promotion[];
  onBack: () => void;
  title?: string;
  moduleLabel?: string;
  storageKey?: string;
}

export const PromotionsManagementPage: React.FC<PromotionsManagementPageProps> = ({
  businesses,
  promotions = [],
  onBack,
  title = 'Gestão de promoções',
  moduleLabel = 'Promoções',
  storageKey = 'admin.management.promotions',
}) => {
  const rows = useMemo<PromotionRow[]>(() => {
    const businessesById = new Map(businesses.map((business) => [business.id, business]));
    const source: Promotion[] = promotions.length > 0
      ? promotions
      : businesses.flatMap((business) => (business.promotions || []).map((promotion) => ({ ...promotion, businessId: promotion.businessId || business.id, businessName: promotion.businessName || business.name })));

    return source.map((promotion) => {
      const business = businessesById.get(promotion.businessId);
      const status = promotion.status || (promotion.isActive ? 'active' : 'inactive');
      return {
        id: `${promotion.businessId || business?.id || 'empresa'}::${promotion.id}`,
        businessId: promotion.businessId || business?.id || '',
        businessName: promotion.businessName || business?.name || 'Empresa',
        title: promotion.title,
        discountBadge: promotion.discountBadge,
        description: promotion.description,
        categoryName: promotion.categoryName || business?.category || '',
        neighborhood: promotion.neighborhood || business?.neighborhood || '',
        validUntil: promotion.validUntil,
        code: promotion.code,
        status,
        clicks: promotion.clicksCount || 0,
      };
    });
  }, [businesses, promotions]);

  const businessOptions = useMemo(
    () => [...new Map(rows.map((row) => [row.businessId, row.businessName])).entries()]
      .sort((left, right) => left[1].localeCompare(right[1], 'pt'))
      .map(([value, label]) => ({ value, label })),
    [rows],
  );

  const totals = useMemo(() => ({
    active: rows.filter((row) => row.status === 'active').length,
    pending: rows.filter((row) => row.status === 'pending_moderation').length,
    scheduled: rows.filter((row) => row.status === 'scheduled').length,
    clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
  }), [rows]);

  return (
    <RecordsManagementPage<PromotionRow>
      title={title}
      description="Promoções reais publicadas pelas empresas, com pesquisa, filtros por estado e empresa, ordenação, paginação, exportação e ficha detalhada."
      moduleLabel={moduleLabel}
      storageKey={storageKey}
      onBack={onBack}
      rows={rows}
      rowKey={(row) => row.id}
      searchPlaceholder="Pesquisar por título, empresa, desconto, código ou categoria…"
      searchFields={(row) => [row.title, row.businessName, row.discountBadge, row.code, row.categoryName, row.description, row.businessId]}
      filters={[
        { key: 'status', label: 'Estado', options: [
          { value: 'all', label: 'Todos' },
          ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        ] },
        { key: 'business', label: 'Empresa', options: [
          { value: 'all', label: 'Todas' },
          ...businessOptions,
        ] },
      ]}
      matchesFilters={(row, filters) => (
        (filters.status === 'all' || row.status === filters.status)
        && (filters.business === 'all' || row.businessId === filters.business)
      )}
      sortValue={(row, key) => {
        if (key === 'validUntil') return row.validUntil ? new Date(row.validUntil).getTime() : 0;
        if (key === 'clicks') return row.clicks;
        if (key === 'status') return row.status;
        return row.title;
      }}
      defaultSortKey="validUntil"
      columns={[
        {
          key: 'title',
          label: 'Promoção',
          sortable: true,
          render: (row) => (
            <div className="min-w-[200px]">
              <div className="truncate font-black text-slate-900">{row.title}</div>
              <div className="truncate text-[9.5px] text-slate-500">{row.businessName} · {row.neighborhood}</div>
            </div>
          ),
        },
        { key: 'discountBadge', label: 'Oferta', render: (row) => <span className="rounded-md border border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] px-1.5 py-0.5 text-[9px] font-black text-[var(--tone-success-text)]">{row.discountBadge || '—'}</span> },
        { key: 'code', label: 'Código', render: (row) => <span className="font-mono text-[10px]">{row.code || '—'}</span> },
        { key: 'validUntil', label: 'Válida até', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatManagementDate(row.validUntil)}</span> },
        { key: 'status', label: 'Estado', sortable: true, render: (row) => (
          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${
            row.status === 'active' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
              : row.status === 'pending_moderation' ? 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]'
                : row.status === 'scheduled' ? 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]'
                  : 'border-slate-300 bg-slate-100 text-slate-700'
          }`}>{STATUS_LABELS[row.status] || row.status}</span>
        ) },
        { key: 'clicks', label: 'Cliques', sortable: true, render: (row) => <span className="tabular-nums">{row.clicks.toLocaleString('pt-PT')}</span> },
      ]}
      kpis={[
        { label: 'Total de promoções', value: rows.length, tone: 'info' },
        { label: 'Ativas', value: totals.active, tone: 'success' },
        { label: 'Pendentes', value: totals.pending, tone: 'warning' },
        { label: 'Agendadas', value: totals.scheduled, tone: 'neutral' },
        { label: 'Cliques', value: totals.clicks.toLocaleString('pt-PT'), tone: 'neutral' },
      ]}
      exportSpec={{
        filename: `promocoes-guigui-${new Date().toISOString().slice(0, 10)}`,
        sheet: 'Promoções',
        title: 'Relatório de Promoções — Guigui.com',
        description: 'Promoções das empresas após aplicação dos filtros atuais.',
        headers: ['ID', 'Empresa', 'Título', 'Oferta', 'Código', 'Categoria', 'Localização', 'Válida até', 'Estado', 'Cliques'],
        row: (row) => [row.id, row.businessName, row.title, row.discountBadge, row.code || '', row.categoryName, row.neighborhood, formatManagementDate(row.validUntil), STATUS_LABELS[row.status] || row.status, row.clicks],
        pdfKpis: [
          { label: 'Promoções', value: String(rows.length) },
          { label: 'Ativas', value: String(totals.active) },
          { label: 'Cliques', value: String(totals.clicks) },
        ],
      }}
      detailLabel={(row) => row.title}
      detail={(row) => (
        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ['Empresa', row.businessName],
              ['Referência', row.id],
              ['Oferta', row.discountBadge],
              ['Código', row.code],
              ['Categoria', row.categoryName],
              ['Localização', row.neighborhood],
              ['Validade', formatManagementDate(row.validUntil)],
              ['Estado', STATUS_LABELS[row.status] || row.status],
              ['Cliques', String(row.clicks)],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
                <div className="mt-0.5 font-medium text-slate-700">{value || '—'}</div>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-slate-50 p-3 leading-relaxed text-slate-600">{row.description || 'Sem descrição registada.'}</p>
        </div>
      )}
    />
  );
};
