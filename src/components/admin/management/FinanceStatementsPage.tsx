import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Search } from 'lucide-react';
import {
  ManagementActionButton,
  ManagementKpiGrid,
  ManagementPage,
  ManagementPagination,
  ManagementTable,
  type ManagementColumn,
} from './ManagementUi';
import { paginateItems } from './managementState';
import { FinanceExportButtons, FinanceLoading, FinanceMessage, financeInputClass } from './FinanceShared';
import {
  downloadFinanceExport,
  financeFetch,
  financeStatusTone,
  formatFinanceDateTime,
  formatXOF,
  type FinanceStatements,
  type FinanceTransaction,
} from './financeApi';

interface Props { onBack: () => void }

export const FinanceStatementsPage: React.FC<Props> = ({ onBack }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [provider, setProvider] = useState('all');
  const [data, setData] = useState<FinanceStatements | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const query = new URLSearchParams();
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      if (provider !== 'all') query.set('provider', provider);
      const result = await financeFetch<FinanceStatements>(`/api/admin/finance/statements?${query.toString()}`);
      setData(result);
      setPage(1);
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const paged = useMemo(() => paginateItems(data?.transactions || [], page, pageSize), [data?.transactions, page, pageSize]);

  const runExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!data) return;
    void downloadFinanceExport(format, {
      filename: `extrato-financeiro-plataforma-${from || 'inicio'}-${to || 'fim'}`,
      title: 'Extrato Financeiro — Plataforma Guigui.com',
      description: `Período ${from || 'início'} a ${to || 'hoje'} · operadora ${provider === 'all' ? 'todas' : provider}. Inclui apenas o financeiro próprio da plataforma.`,
      headers: ['ID', 'Data', 'Cliente', 'Serviço', 'Operadora', 'Origem', 'Valor XOF', 'Estado', 'Reconciliação', 'Referência'],
      rows: data.transactions.map((item) => [
        item.id, formatFinanceDateTime(item.createdAt), item.payerName, item.useCaseLabel,
        item.providerLabel, item.dataOrigin, item.amountXOF, item.statusLabel,
        item.reconciliationStatusLabel, item.providerReference || '',
      ]),
      kpis: [
        { label: 'Transações', value: String(data.totals.count) },
        { label: 'Volume', value: formatXOF(data.totals.volumeXOF) },
        { label: 'Confirmado real', value: formatXOF(data.totals.confirmedXOF) },
        { label: 'Pendente', value: formatXOF(data.totals.pendingXOF) },
      ],
    });
  };

  const columns: Array<ManagementColumn<FinanceTransaction>> = [
    { key: 'id', label: 'Transação', render: (item) => <div className="min-w-[160px]"><div className="font-black text-slate-900">{item.id}</div><div className="text-[9px] text-slate-500">{formatFinanceDateTime(item.createdAt)}</div></div> },
    { key: 'payer', label: 'Cliente', render: (item) => <span className="block min-w-[120px] text-[10px]">{item.payerName}</span> },
    { key: 'service', label: 'Serviço', render: (item) => <span className="block min-w-[140px] text-[10px]">{item.useCaseLabel}</span> },
    { key: 'provider', label: 'Operadora', render: (item) => <span className="font-bold">{item.providerLabel}</span> },
    { key: 'amount', label: 'Valor', className: 'text-right', render: (item) => <span className="whitespace-nowrap font-black">{formatXOF(item.amountXOF)}</span> },
    { key: 'status', label: 'Estado', render: (item) => <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${financeStatusTone(item.status)}`}>{item.statusLabel}</span> },
    { key: 'reconciliation', label: 'Reconciliação', render: (item) => <span className="text-[9.5px] font-bold text-slate-600">{item.reconciliationStatusLabel}</span> },
    { key: 'origin', label: 'Origem', render: (item) => <span className="text-[9.5px] capitalize text-slate-600">{item.dataOrigin}</span> },
  ];

  return (
    <ManagementPage
      title="Extratos e Exportações"
      description="Relatórios financeiros da plataforma por período e operadora, extratos de transações, resumo de reconciliação e reembolsos. Todos os valores vêm do PostgreSQL."
      moduleLabel="Financeiro"
      onBack={onBack}
      breadcrumbTail="Extratos e Exportações"
      actions={<FinanceExportButtons onExport={runExport} />}
      kpis={[
        { label: 'Transações no período', value: data?.totals.count ?? '—', tone: 'info' },
        { label: 'Volume do período', value: formatXOF(data?.totals.volumeXOF), tone: 'neutral' },
        { label: 'Confirmado real', value: formatXOF(data?.totals.confirmedXOF), tone: 'success' },
        { label: 'Pendente no período', value: formatXOF(data?.totals.pendingXOF), tone: 'warning' },
      ]}
    >
      <div className="space-y-3 rounded-2xl border border-[var(--color-border-default)] bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500"><Search className="h-3.5 w-3.5" /> Parâmetros do relatório</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <label className="flex flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">De</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={financeInputClass} /></label>
          <label className="flex flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Até</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={financeInputClass} /></label>
          <label className="flex flex-col gap-1"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Operadora</span>
            <select value={provider} onChange={(event) => setProvider(event.target.value)} className={financeInputClass}>
              <option value="all">Todas as operadoras</option>
              <option value="orange_money">Orange Money</option>
              <option value="telecel">Telecel</option>
              <option value="manual_transfer">Transferência manual</option>
            </select>
          </label>
          <div className="flex items-end"><ManagementActionButton tone="primary" onClick={() => void load()}>Gerar relatório</ManagementActionButton></div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30); setFrom(start.toISOString().slice(0, 10)); setTo(end.toISOString().slice(0, 10)); }} className="rounded-full border border-[var(--color-border-default)] px-2.5 py-1 text-[9px] font-black text-slate-600">Últimos 30 dias</button>
          <button type="button" onClick={() => { const now = new Date(); setFrom(`${now.getFullYear()}-01-01`); setTo(now.toISOString().slice(0, 10)); }} className="rounded-full border border-[var(--color-border-default)] px-2.5 py-1 text-[9px] font-black text-slate-600">Ano atual</button>
          <button type="button" onClick={() => { setFrom(''); setTo(''); setProvider('all'); }} className="rounded-full border border-[var(--color-border-default)] px-2.5 py-1 text-[9px] font-black text-slate-600">Limpar</button>
        </div>
      </div>

      {message && <FinanceMessage tone={message.tone}>{message.text}</FinanceMessage>}
      {loading ? <FinanceLoading label="A gerar extratos…" /> : data && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="space-y-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[var(--color-green-800)]" /><h3 className="text-[12px] font-black text-slate-900">Extrato por operadora</h3></div>
              {data.providers.length === 0 ? <p className="text-[10px] text-slate-500">Sem transações no período.</p> : (
                <table className="w-full text-left text-[10px]">
                  <thead className="text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-400"><tr><th className="py-1">Operadora</th><th className="py-1 text-right">Nº</th><th className="py-1 text-right">Volume</th><th className="py-1 text-right">Confirmado</th><th className="py-1 text-right">Pendente</th></tr></thead>
                  <tbody>{data.providers.map((item) => (
                    <tr key={item.provider} className="border-t border-[var(--color-border-subtle)]">
                      <td className="py-1.5 font-bold">{item.label}</td>
                      <td className="py-1.5 text-right">{item.count}</td>
                      <td className="py-1.5 text-right">{formatXOF(item.volumeXOF)}</td>
                      <td className="py-1.5 text-right text-[var(--tone-success-text)]">{formatXOF(item.confirmedXOF)}</td>
                      <td className="py-1.5 text-right text-[var(--tone-warning-text)]">{formatXOF(item.pendingXOF)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </section>
            <section className="space-y-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm">
              <h3 className="text-[12px] font-black text-slate-900">Reconciliação e reembolsos</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 p-2.5">
                  <div className="text-[9px] font-black uppercase text-slate-500">Reconciliação</div>
                  {data.reconciliation.length === 0 ? <p className="text-[10px] text-slate-500">Sem registos.</p> : data.reconciliation.map((item) => (
                    <div key={item.status} className="mt-1 flex justify-between gap-2 text-[9.5px]"><span>{item.statusLabel} ({item.count})</span><strong>{formatXOF(item.amountXOF)}</strong></div>
                  ))}
                </div>
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 p-2.5">
                  <div className="text-[9px] font-black uppercase text-slate-500">Reembolsos</div>
                  {data.refunds.length === 0 ? <p className="text-[10px] text-slate-500">Sem registos.</p> : data.refunds.map((item) => (
                    <div key={item.status} className="mt-1 flex justify-between gap-2 text-[9.5px]"><span>{item.statusLabel} ({item.count})</span><strong>{formatXOF(item.amountXOF)}</strong></div>
                  ))}
                </div>
              </div>
              <p className="text-[9px] leading-relaxed text-slate-500">As compras de bilhetes das empresas organizadoras não fazem parte deste extrato.</p>
            </section>
          </div>

          <ManagementTable columns={columns} rows={paged.items} rowKey={(item) => item.id} emptyMessage="Sem transações no período selecionado." />
          <ManagementPagination page={paged.page} pageSize={pageSize} totalItems={paged.totalItems} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}
    </ManagementPage>
  );
};
