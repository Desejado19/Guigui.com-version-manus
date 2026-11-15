import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Filter, Search } from 'lucide-react';
import {
  ManagementActionButton,
  ManagementKpiGrid,
  ManagementPage,
  ManagementPagination,
  ManagementTable,
  type ManagementColumn,
} from './ManagementUi';
import { ManagementFilter } from './ManagementUi';
import { paginateItems } from './managementState';
import { FinanceExportButtons, FinanceLoading, FinanceMessage, FinanceModal, financeInputClass } from './FinanceShared';
import {
  downloadFinanceExport,
  financeFetch,
  financeOriginLabel,
  financeOriginTone,
  financeStatusTone,
  formatFinanceDateTime,
  formatXOF,
  type FinanceTransaction,
} from './financeApi';

interface Props { onBack: () => void }

interface TransactionDetailResponse {
  transaction: FinanceTransaction;
  actions: Array<{ id: string; action: string; reason: string | null; proof_reference: string | null; actor_name: string | null; created_at: string }>;
  refunds: Array<{ id: string; amount_xof: number; reason: string; status: string; kind: string; provider_reference: string | null; created_at: string }>;
  events: Array<{ id: string; provider: string; event_reference: string; signature_valid: boolean; received_at: string }>;
}

const SORT_KEYS = new Set(['createdAt', 'amount', 'payer', 'status']);

export const FinanceTransactionsPage: React.FC<Props> = ({ onBack }) => {
  const [scope, setScope] = useState<'platform' | 'business'>('platform');
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [service, setService] = useState('all');
  const [provider, setProvider] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detail, setDetail] = useState<TransactionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    financeFetch<{ transactions: FinanceTransaction[] }>(`/api/admin/finance/transactions?scope=${scope}`)
      .then((data) => { if (!cancelled) { setTransactions(data.transactions || []); setPage(1); } })
      .catch((reason: Error) => { if (!cancelled) { setError(reason.message); setTransactions([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope]);

  const services = useMemo(
    () => [...new Map(transactions.map((item) => [item.useCase, item.useCaseLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt')),
    [transactions],
  );
  const providers = useMemo(
    () => [...new Map(transactions.map((item) => [item.provider, item.providerLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt')),
    [transactions],
  );
  const statuses = useMemo(
    () => [...new Map(transactions.map((item) => [item.status, item.statusLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt')),
    [transactions],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    const min = minValue.trim() === '' ? null : Number(minValue);
    const max = maxValue.trim() === '' ? null : Number(maxValue);
    const rows = transactions.filter((item) => {
      if (service !== 'all' && item.useCase !== service) return false;
      if (provider !== 'all' && item.provider !== provider) return false;
      if (status !== 'all' && item.status !== status) return false;
      const created = new Date(item.createdAt).getTime();
      if (fromTime !== null && created < fromTime) return false;
      if (toTime !== null && created > toTime) return false;
      if (min !== null && Number.isFinite(min) && item.amountXOF < min) return false;
      if (max !== null && Number.isFinite(max) && item.amountXOF > max) return false;
      if (!term) return true;
      return [item.id, item.payerName, item.payerPhone, item.companyName, item.eventTitle, item.providerReference, item.useCaseLabel]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      if (sortKey === 'amount') return (left.amountXOF - right.amountXOF) * direction;
      if (sortKey === 'payer') return left.payerName.localeCompare(right.payerName, 'pt') * direction;
      if (sortKey === 'status') return left.status.localeCompare(right.status, 'pt') * direction;
      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    });
  }, [from, maxValue, minValue, provider, query, service, sortDirection, sortKey, status, to, transactions]);

  const paged = paginateItems(filtered, page, pageSize);
  const confirmed = filtered.filter((item) => item.isRealConfirmed);
  const pending = filtered.filter((item) => item.status === 'pending' || item.status === 'created');

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await financeFetch<TransactionDetailResponse>(`/api/admin/finance/transactions/${encodeURIComponent(id)}`));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const reset = () => {
    setQuery(''); setService('all'); setProvider('all'); setStatus('all');
    setFrom(''); setTo(''); setMinValue(''); setMaxValue(''); setPage(1);
  };

  const runExport = (format: 'csv' | 'excel' | 'pdf') => {
    void downloadFinanceExport(format, {
      filename: `transacoes-${scope}-${new Date().toISOString().slice(0, 10)}`,
      title: `Transações — ${scope === 'platform' ? 'Plataforma' : 'Empresas organizadoras'}`,
      description: 'Transações após aplicação dos filtros atuais. Os montantes de bilhetes não são receita da plataforma.',
      headers: ['ID', 'Data', 'Pagador', 'Telefone', 'Empresa/Evento', 'Serviço', 'Operadora', 'Origem', 'Valor XOF', 'Estado', 'Reconciliação', 'Referência'],
      rows: filtered.map((item) => [
        item.id, formatFinanceDateTime(item.createdAt), item.payerName, item.payerPhone,
        item.companyName || item.eventTitle || '', item.useCaseLabel, item.providerLabel,
        financeOriginLabel(item.dataOrigin), item.amountXOF, item.statusLabel,
        item.reconciliationStatusLabel, item.providerReference || '',
      ]),
      kpis: [
        { label: 'Transações', value: String(filtered.length) },
        { label: 'Volume', value: formatXOF(filtered.reduce((sum, item) => sum + item.amountXOF, 0)) },
        { label: 'Confirmado real', value: formatXOF(confirmed.reduce((sum, item) => sum + item.amountXOF, 0)) },
      ],
    });
  };

  const columns: Array<ManagementColumn<FinanceTransaction>> = [
    {
      key: 'id', label: 'Transação', sortable: true,
      render: (item) => (
        <div className="min-w-[170px]">
          <div className="font-black text-slate-900">{item.id}</div>
          <div className="text-[9.5px] text-slate-500">{formatFinanceDateTime(item.createdAt)}</div>
          <div className="mt-0.5 font-mono text-[9px] text-slate-400">{item.providerReference || 'Sem referência'}</div>
        </div>
      ),
    },
    {
      key: 'payer', label: 'Cliente / Empresa', sortable: true,
      render: (item) => (
        <div className="min-w-[150px]">
          <div className="truncate font-bold text-slate-800">{item.payerName}</div>
          <div className="truncate text-[9.5px] text-slate-500">{item.payerPhone}</div>
          <div className="truncate text-[9.5px] text-slate-500">{item.companyName || item.eventTitle || 'Plataforma'}</div>
        </div>
      ),
    },
    { key: 'service', label: 'Serviço', render: (item) => <span className="block min-w-[150px] text-[10px]">{item.useCaseLabel}</span> },
    { key: 'amount', label: 'Valor', sortable: true, className: 'text-right', render: (item) => <span className="whitespace-nowrap font-black tabular-nums">{formatXOF(item.amountXOF)}</span> },
    {
      key: 'provider', label: 'Operadora / Origem',
      render: (item) => (
        <div className="min-w-[120px]">
          <div className="font-bold text-slate-800">{item.providerLabel}</div>
          <span className={`mt-0.5 inline-block rounded-full border px-1.5 py-0.5 text-[8px] font-black ${financeOriginTone(item.dataOrigin)}`}>{financeOriginLabel(item.dataOrigin)}</span>
        </div>
      ),
    },
    {
      key: 'status', label: 'Estado', sortable: true,
      render: (item) => <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${financeStatusTone(item.status)}`}>{item.statusLabel}</span>,
    },
    { key: 'reconciliation', label: 'Reconciliação', render: (item) => <span className="block min-w-[100px] text-[9.5px] font-bold text-slate-600">{item.reconciliationStatusLabel}</span> },
    {
      key: 'actions', label: 'Ações', className: 'text-right',
      render: (item) => <ManagementActionButton onClick={() => void openDetail(item.id)}><Eye className="h-3 w-3" /> Detalhes</ManagementActionButton>,
    },
  ];

  return (
    <ManagementPage
      title="Transações"
      description="Todas as transações registadas, com pesquisa, filtros por serviço, operadora, estado, data e valor, ordenação, paginação e exportação. A receita de bilhetes pertence às empresas organizadoras."
      moduleLabel="Financeiro"
      onBack={onBack}
      breadcrumbTail="Transações"
      actions={<FinanceExportButtons onExport={runExport} />}
      kpis={[
        { label: 'Registos filtrados', value: filtered.length, tone: 'info' },
        { label: 'Confirmado real', value: confirmed.length, hint: formatXOF(confirmed.reduce((sum, item) => sum + item.amountXOF, 0)), tone: 'success' },
        { label: 'Pendentes', value: pending.length, hint: formatXOF(pending.reduce((sum, item) => sum + item.amountXOF, 0)), tone: 'warning' },
        { label: 'Volume filtrado', value: formatXOF(filtered.reduce((sum, item) => sum + item.amountXOF, 0)), tone: 'neutral' },
      ]}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e6dac8] bg-white p-3 shadow-sm">
        <span className="mr-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Âmbito financeiro</span>
        {(['platform', 'business'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            className={`rounded-xl border px-3 py-2 text-[10px] font-black transition ${
              scope === value ? 'border-[#123e3b] bg-[#123e3b] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#123e3b]'
            }`}
          >
            {value === 'platform' ? 'Plataforma Guigui.com' : 'Empresas organizadoras'}
          </button>
        ))}
        <span className="ml-auto text-[9.5px] font-medium text-slate-500">
          {scope === 'platform' ? 'Subscrições, planos e serviços da plataforma.' : 'Bilhetes e vendas das empresas. Não é receita da Guigui.com.'}
        </span>
      </div>

      {error && <FinanceMessage tone="error">{error}</FinanceMessage>}

      <div className="space-y-2.5 rounded-2xl border border-[#e6dac8] bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          <Filter className="h-3.5 w-3.5" /> Pesquisa e filtros
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Pesquisar por ID, cliente, telefone, empresa, evento ou referência…"
            aria-label="Pesquisar transações"
            className={`${financeInputClass} pl-8`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <ManagementFilter label="Serviço" value={service} onChange={(value) => { setService(value); setPage(1); }} options={[{ value: 'all', label: 'Todos' }, ...services.map(([value, label]) => ({ value, label }))]} />
          <ManagementFilter label="Operadora" value={provider} onChange={(value) => { setProvider(value); setPage(1); }} options={[{ value: 'all', label: 'Todas' }, ...providers.map(([value, label]) => ({ value, label }))]} />
          <ManagementFilter label="Estado" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: 'all', label: 'Todos' }, ...statuses.map(([value, label]) => ({ value, label }))]} />
          <label className="flex flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">De</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className={financeInputClass} /></label>
          <label className="flex flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Até</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className={financeInputClass} /></label>
          <label className="flex flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Valor mínimo</span><input type="number" min={0} value={minValue} onChange={(event) => { setMinValue(event.target.value); setPage(1); }} placeholder="XOF" className={financeInputClass} /></label>
          <label className="flex flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Valor máximo</span><input type="number" min={0} value={maxValue} onChange={(event) => { setMaxValue(event.target.value); setPage(1); }} placeholder="XOF" className={financeInputClass} /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-500">{filtered.length} registo(s) · página {paged.page} de {paged.totalPages}</span>
          <button type="button" onClick={reset} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 transition hover:border-[#123e3b]">Limpar filtros</button>
        </div>
      </div>

      {loading ? <FinanceLoading /> : (
        <>
          <ManagementTable
            columns={columns}
            rows={paged.items}
            rowKey={(item) => item.id}
            sortKey={SORT_KEYS.has(sortKey) ? sortKey : undefined}
            sortDirection={sortDirection}
            onSort={(key) => {
              if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
              else { setSortKey(key); setSortDirection(key === 'payer' ? 'asc' : 'desc'); }
              setPage(1);
            }}
            emptyMessage="Nenhuma transação encontrada com os filtros atuais."
          />
          <ManagementPagination page={paged.page} pageSize={pageSize} totalItems={paged.totalItems} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <FinanceModal
        open={Boolean(detail) || detailLoading}
        title={detail ? `Transação ${detail.transaction.id}` : 'A carregar transação…'}
        description={detail ? `${detail.transaction.useCaseLabel} · ${formatXOF(detail.transaction.amountXOF)}` : undefined}
        onClose={() => setDetail(null)}
        wide
      >
        {detailLoading || !detail ? <FinanceLoading label="A carregar detalhe completo…" /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['ID', detail.transaction.id],
                ['Âmbito', detail.transaction.scope === 'platform' ? 'Plataforma Guigui.com' : 'Empresa organizadora'],
                ['Cliente', detail.transaction.payerName],
                ['Telefone', detail.transaction.payerPhone],
                ['Empresa', detail.transaction.companyName],
                ['Evento', detail.transaction.eventTitle],
                ['Serviço', detail.transaction.useCaseLabel],
                ['Operadora', detail.transaction.providerLabel],
                ['Origem', financeOriginLabel(detail.transaction.dataOrigin)],
                ['Referência da operadora', detail.transaction.providerReference],
                ['Valor', formatXOF(detail.transaction.amountXOF)],
                ['Estado', detail.transaction.statusLabel],
                ['Reconciliação', detail.transaction.reconciliationStatusLabel],
                ['Reembolsado', formatXOF(detail.transaction.refundedAmountXOF)],
                ['Criada em', formatFinanceDateTime(detail.transaction.createdAt)],
                ['Confirmada em', formatFinanceDateTime(detail.transaction.confirmedAt)],
                ['Atualizada em', formatFinanceDateTime(detail.transaction.updatedAt)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="text-[8.5px] font-black uppercase tracking-[0.13em] text-slate-400">{label}</div>
                  <div className="mt-0.5 break-words text-[10.5px] font-semibold text-slate-800">{value || '—'}</div>
                </div>
              ))}
            </div>
            <section>
              <h4 className="text-[11px] font-black text-slate-900">Ações manuais ({detail.actions.length})</h4>
              {detail.actions.length === 0 ? <p className="mt-1 text-[10px] text-slate-500">Sem ações manuais registadas.</p> : (
                <div className="mt-1.5 space-y-1.5">
                  {detail.actions.map((action) => (
                    <div key={action.id} className="rounded-lg border border-slate-100 bg-white p-2 text-[10px]">
                      <strong className="text-slate-800">{action.action}</strong> · {action.actor_name || 'Sistema'} · {formatFinanceDateTime(action.created_at)}
                      {action.proof_reference && <span className="block text-slate-500">Comprovativo: {action.proof_reference}</span>}
                      {action.reason && <span className="block text-slate-500">{action.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h4 className="text-[11px] font-black text-slate-900">Reembolsos ({detail.refunds.length})</h4>
              {detail.refunds.length === 0 ? <p className="mt-1 text-[10px] text-slate-500">Sem reembolsos associados.</p> : (
                <div className="mt-1.5 space-y-1.5">
                  {detail.refunds.map((refund) => (
                    <div key={refund.id} className="rounded-lg border border-slate-100 bg-white p-2 text-[10px]">
                      <strong>{formatXOF(refund.amount_xof)}</strong> · {refund.status} · {refund.kind}
                      <span className="block text-slate-500">{refund.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h4 className="text-[11px] font-black text-slate-900">Eventos de pagamento ({detail.events.length})</h4>
              {detail.events.length === 0 ? <p className="mt-1 text-[10px] text-slate-500">Sem webhooks registados.</p> : detail.events.map((event) => (
                <div key={event.id} className="mt-1 rounded-lg border border-slate-100 bg-white p-2 text-[10px]">
                  {event.provider} · {event.event_reference} · assinatura {event.signature_valid ? 'válida' : 'inválida'} · {formatFinanceDateTime(event.received_at)}
                </div>
              ))}
            </section>
          </div>
        )}
      </FinanceModal>
    </ManagementPage>
  );
};
