import React, { useEffect, useMemo, useState } from 'react';
import type { ScheduledItem } from '../../../types';
import { formatManagementDate } from './managementState';
import { RecordsManagementPage } from './RecordsManagementPage';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  publishing: 'A publicar',
  published: 'Publicada',
  failed: 'Falhada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

interface CampaignsManagementPageProps {
  onBack: () => void;
}

export const CampaignsManagementPage: React.FC<CampaignsManagementPageProps> = ({ onBack }) => {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/marketing/scheduled-items', { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as campanhas.');
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar as campanhas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => ({
    scheduled: items.filter((item) => item.status === 'scheduled').length,
    published: items.filter((item) => item.status === 'published').length,
    failed: items.filter((item) => item.status === 'failed').length,
    campaigns: items.filter((item) => item.itemType === 'campaign').length,
  }), [items]);

  return (
    <RecordsManagementPage<ScheduledItem>
      title="Campanhas publicitárias"
      description="Publicações agendadas e campanhas de marketing das empresas (posts, promoções, campanhas, eventos e lembretes), com estado de publicação, erro e pagamento."
      moduleLabel="Empresas & Negócios"
      storageKey="admin.management.campaigns"
      onBack={onBack}
      rows={items}
      rowKey={(item) => item.id}
      searchPlaceholder="Pesquisar por campanha, empresa, referência ou descrição…"
      searchFields={(item) => [item.id, item.label, item.description, item.businessId, item.campaignId, item.itemId, item.itemType]}
      filters={[
        { key: 'status', label: 'Estado', options: [
          { value: 'all', label: 'Todos' },
          ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        ] },
        { key: 'type', label: 'Tipo', options: [
          { value: 'all', label: 'Todos' },
          { value: 'campaign', label: 'Campanhas' },
          { value: 'promotion', label: 'Promoções' },
          { value: 'post', label: 'Publicações' },
          { value: 'event', label: 'Eventos' },
          { value: 'reminder', label: 'Lembretes' },
        ] },
      ]}
      matchesFilters={(item, filters) => (
        (filters.status === 'all' || item.status === filters.status)
        && (filters.type === 'all' || item.itemType === filters.type)
      )}
      sortValue={(item, key) => {
        if (key === 'scheduledAt') return item.scheduledAt ? new Date(item.scheduledAt).getTime() : 0;
        if (key === 'status') return item.status;
        return item.label || '';
      }}
      defaultSortKey="scheduledAt"
      columns={[
        {
          key: 'label',
          label: 'Campanha / item',
          sortable: true,
          render: (item) => (
            <div className="min-w-[210px]">
              <div className="truncate font-black text-slate-900">{item.label || item.itemId}</div>
              <div className="truncate text-[9.5px] text-slate-500">{item.businessId} · {item.itemType}</div>
            </div>
          ),
        },
        { key: 'scheduledAt', label: 'Agendada para', sortable: true, render: (item) => <span className="whitespace-nowrap">{formatManagementDate(item.scheduledAt)}</span> },
        { key: 'status', label: 'Estado', sortable: true, render: (item) => (
          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${
            item.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : item.status === 'failed' || item.status === 'cancelled' ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}>{STATUS_LABELS[item.status] || item.status}</span>
        ) },
        { key: 'payment', label: 'Pagamento', render: (item) => <span className="text-[10px]">{item.paymentStatus || '—'}</span> },
        { key: 'moderation', label: 'Moderação', render: (item) => <span className="text-[10px]">{item.moderationStatus || '—'}</span> },
        { key: 'attempts', label: 'Tentativas', render: (item) => <span className="tabular-nums">{item.attempts ?? 0}</span> },
      ]}
      kpis={[
        { label: 'Itens agendados', value: items.length, tone: 'info' },
        { label: 'Campanhas', value: counts.campaigns, tone: 'neutral' },
        { label: 'Publicados', value: counts.published, tone: 'success' },
        { label: 'Agendados', value: counts.scheduled, tone: 'warning' },
        { label: 'Falhados', value: counts.failed, tone: 'danger' },
      ]}
      notice={
        <>
          {loading && <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-800">A carregar campanhas…</div>}
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">{error}</div>}
        </>
      }
      exportSpec={{
        filename: `campanhas-guigui-${new Date().toISOString().slice(0, 10)}`,
        sheet: 'Campanhas',
        title: 'Relatório de Campanhas — Guigui.com',
        description: 'Itens de marketing agendados após aplicação dos filtros atuais.',
        headers: ['ID', 'Item', 'Tipo', 'Empresa', 'Agendado para', 'Estado', 'Pagamento', 'Moderação', 'Tentativas', 'Erro'],
        row: (item) => [item.id, item.label || '', item.itemType, item.businessId, formatManagementDate(item.scheduledAt), STATUS_LABELS[item.status] || item.status, item.paymentStatus || '', item.moderationStatus || '', item.attempts ?? 0, item.errorMessage || ''],
        pdfKpis: [
          { label: 'Itens', value: String(items.length) },
          { label: 'Publicados', value: String(counts.published) },
          { label: 'Falhados', value: String(counts.failed) },
        ],
      }}
      detailLabel={(item) => item.label || item.itemId}
      detail={(item) => (
        <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
          {[
            ['ID', item.id],
            ['Empresa', item.businessId],
            ['Tipo', item.itemType],
            ['Referência do item', item.itemId],
            ['Campanha', item.campaignId],
            ['Agendado para', formatManagementDate(item.scheduledAt)],
            ['Fuso horário', item.timezone],
            ['Estado', STATUS_LABELS[item.status] || item.status],
            ['Pagamento', item.paymentStatus],
            ['Moderação', item.moderationStatus],
            ['Tentativas', String(item.attempts ?? 0)],
            ['Última tentativa', formatManagementDate(item.lastAttemptAt)],
            ['Publicado em', formatManagementDate(item.publishedAt)],
            ['Erro', item.errorMessage],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
              <div className="mt-0.5 break-words font-medium text-slate-700">{value || '—'}</div>
            </div>
          ))}
        </div>
      )}
    />
  );
};
