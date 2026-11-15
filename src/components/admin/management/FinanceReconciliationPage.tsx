import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Scale, Search } from 'lucide-react';
import {
  ManagementActionButton,
  ManagementFilter,
  ManagementKpiGrid,
  ManagementPage,
  ManagementPagination,
  ManagementTable,
  type ManagementColumn,
} from './ManagementUi';
import { paginateItems } from './managementState';
import { FinanceField, FinanceLoading, FinanceMessage, FinanceModal, financeInputClass } from './FinanceShared';
import {
  financeFetch,
  financeStatusTone,
  formatFinanceDateTime,
  formatXOF,
  type ReconciliationHistoryItem,
  type ReconciliationItem,
} from './financeApi';

interface Props { onBack: () => void }

interface ReconciliationResponse {
  items: ReconciliationItem[];
  history: ReconciliationHistoryItem[];
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_review', label: 'Em verificação' },
  { value: 'reconciled', label: 'Reconciliado' },
  { value: 'divergence', label: 'Divergência' },
  { value: 'unconfirmed', label: 'Não confirmado' },
];

export const FinanceReconciliationPage: React.FC<Props> = ({ onBack }) => {
  const [data, setData] = useState<ReconciliationResponse>({ items: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<ReconciliationItem | null>(null);
  const [form, setForm] = useState({ statementReference: '', statementAmountXOF: '', status: 'pending', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await financeFetch<ReconciliationResponse>('/api/admin/finance/reconciliations'));
      setMessage(null);
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.items.filter((item) => {
      const effectiveStatus = item.id ? item.status : 'pending';
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
      if (!term) return true;
      return [item.transaction.id, item.transaction.payerName, item.transaction.providerReference, item.statementReference, item.transaction.amountXOF]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [data.items, query, statusFilter]);

  const paged = paginateItems(filtered, page, pageSize);
  const pending = data.items.filter((item) => !item.id || item.status === 'pending').length;
  const inReview = data.items.filter((item) => item.status === 'in_review').length;
  const reconciled = data.items.filter((item) => item.status === 'reconciled').length;
  const divergent = data.items.filter((item) => item.status === 'divergence' || item.status === 'unconfirmed').length;

  const openForm = (item: ReconciliationItem) => {
    setEditing(item);
    setForm({
      statementReference: item.statementReference || '',
      statementAmountXOF: String(item.statementAmountXOF ?? item.expectedAmountXOF),
      status: item.id ? item.status : 'pending',
      notes: item.notes || '',
    });
    setMessage(null);
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        transactionId: editing.transactionId,
        statementReference: form.statementReference,
        statementAmountXOF: Number(form.statementAmountXOF),
        status: form.status,
        notes: form.notes,
      };
      if (editing.id) {
        await financeFetch(`/api/admin/finance/reconciliations/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await financeFetch('/api/admin/finance/reconciliations', { method: 'POST', body: JSON.stringify(payload) });
      }
      setEditing(null);
      await load();
      setMessage({ tone: 'success', text: editing.id ? 'Reconciliação atualizada e registada na auditoria.' : 'Reconciliação registada e associada ao pagamento.' });
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<ManagementColumn<ReconciliationItem>> = [
    {
      key: 'transaction', label: 'Pagamento',
      render: (item) => (
        <div className="min-w-[170px]">
          <div className="font-black text-slate-900">{item.transaction.id}</div>
          <div className="text-[9.5px] text-slate-500">{item.transaction.payerName}</div>
          <div className="font-mono text-[9px] text-slate-400">{item.transaction.providerReference || 'Sem referência'}</div>
        </div>
      ),
    },
    { key: 'provider', label: 'Operadora / Data', render: (item) => <div className="min-w-[110px]"><div className="font-bold">{item.transaction.providerLabel}</div><div className="text-[9.5px] text-slate-500">{formatFinanceDateTime(item.transaction.createdAt)}</div></div> },
    { key: 'expected', label: 'Valor esperado', className: 'text-right', render: (item) => <span className="whitespace-nowrap font-black tabular-nums">{formatXOF(item.expectedAmountXOF)}</span> },
    { key: 'statement', label: 'Valor no extrato', className: 'text-right', render: (item) => <span className="whitespace-nowrap font-bold tabular-nums">{item.statementAmountXOF == null ? '—' : formatXOF(item.statementAmountXOF)}</span> },
    { key: 'reference', label: 'Referência do extrato', render: (item) => <span className="block max-w-[170px] truncate font-mono text-[9.5px]">{item.statementReference || '—'}</span> },
    { key: 'status', label: 'Estado', render: (item) => <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${financeStatusTone(item.status)}`}>{item.id ? item.statusLabel : 'Pendente'}</span> },
    { key: 'responsible', label: 'Responsável', render: (item) => <div className="min-w-[110px] text-[9.5px]"><div className="font-bold text-slate-700">{item.updatedByName || item.createdByName || '—'}</div><div className="text-slate-500">{formatFinanceDateTime(item.updatedAt || item.createdAt)}</div></div> },
    {
      key: 'actions', label: 'Ações', className: 'text-right',
      render: (item) => {
        const eligible = item.transaction.reconciliationEligible;
        if (!item.id && !eligible) {
          return <span className="block max-w-[140px] text-right text-[8.5px] font-bold text-slate-400">Sandbox, simulado ou legado: não reconciliar</span>;
        }
        return (
          <ManagementActionButton
            tone={item.status === 'reconciled' ? 'success' : 'primary'}
            disabled={item.status === 'reconciled'}
            onClick={() => openForm(item)}
          >
            {item.status === 'reconciled' ? 'Reconciliado' : item.id ? 'Atualizar' : 'Registar'}
          </ManagementActionButton>
        );
      },
    },
  ];

  return (
    <ManagementPage
      title="Reconciliação"
      description="Compare pagamentos registados com extratos das operadoras e instituições financeiras. Confirme correspondências, identifique divergências e preserve o responsável por cada decisão."
      moduleLabel="Financeiro"
      onBack={onBack}
      breadcrumbTail="Reconciliação"
      kpis={[
        { label: 'Pendentes', value: pending, tone: 'warning' },
        { label: 'Em verificação', value: inReview, tone: 'info' },
        { label: 'Reconciliados', value: reconciled, tone: 'success' },
        { label: 'Divergências', value: divergent, tone: 'danger' },
      ]}
    >
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-[10px] leading-relaxed text-sky-900">
        <strong className="font-black">Regra de integridade:</strong> apenas pagamentos reais confirmados podem ser reconciliados.
        Registos de sandbox, simulados e legados ficam visíveis para auditoria, mas não são convertidos em pagamentos confirmados.
      </div>
      {divergent > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[10px] leading-relaxed text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-black">{divergent} reconciliação(ões) em divergência ou não confirmadas</strong> exigem decisão.
            Use o filtro de estado para isolar os casos e registe a resolução com responsável.
          </span>
        </div>
      )}

      {message && <FinanceMessage tone={message.tone}>{message.text}</FinanceMessage>}

      <div className="space-y-2.5 rounded-2xl border border-[#e6dac8] bg-white p-3.5 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Pesquisar por transação, cliente, referência ou valor…"
            className={`${financeInputClass} pl-8`}
          />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <ManagementFilter label="Estado" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={[{ value: 'all', label: 'Todos' }, ...STATUS_OPTIONS]} />
          <span className="text-[10px] font-bold text-slate-500">{filtered.length} pagamento(s) · página {paged.page} de {paged.totalPages}</span>
        </div>
      </div>

      {loading ? <FinanceLoading /> : (
        <>
          <ManagementTable columns={columns} rows={paged.items} rowKey={(item) => item.transactionId} emptyMessage="Nenhum pagamento corresponde aos filtros." />
          <ManagementPagination page={paged.page} pageSize={pageSize} totalItems={paged.totalItems} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <section className="space-y-2 rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-[#123e3b]" /><h3 className="text-[12px] font-black text-slate-900">Histórico de reconciliações</h3></div>
        {data.history.length === 0 ? <p className="text-[10px] text-slate-500">Ainda não existem operações de reconciliação registadas.</p> : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full min-w-[650px] text-left text-[10px]">
              <thead className="sticky top-0 bg-[#f7f2ec] text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-500">
                <tr><th className="px-2 py-2">Operação</th><th className="px-2 py-2">Transação</th><th className="px-2 py-2">Estado</th><th className="px-2 py-2">Responsável</th><th className="px-2 py-2">Data</th></tr>
              </thead>
              <tbody>
                {data.history.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-bold capitalize text-slate-700">{item.actionLabel}</td>
                    <td className="px-2 py-2 font-mono text-[9px]">{item.transactionId || '—'}</td>
                    <td className="px-2 py-2">{item.status || '—'}</td>
                    <td className="px-2 py-2">{item.actorName}</td>
                    <td className="px-2 py-2">{formatFinanceDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FinanceModal
        open={Boolean(editing)}
        title={editing?.id ? `Atualizar reconciliação de ${editing.transactionId}` : `Registar reconciliação de ${editing?.transactionId || ''}`}
        description="Comparação entre o valor registado na plataforma e o valor do extrato da operadora."
        onClose={() => setEditing(null)}
        footer={(
          <>
            <ManagementActionButton onClick={() => setEditing(null)}>Cancelar</ManagementActionButton>
            <ManagementActionButton tone="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'A guardar…' : 'Guardar reconciliação'}</ManagementActionButton>
          </>
        )}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px]">
              <div><span className="block font-black text-slate-500">Valor esperado</span>{formatXOF(editing.expectedAmountXOF)}</div>
              <div><span className="block font-black text-slate-500">Operadora</span>{editing.transaction.providerLabel}</div>
              <div><span className="block font-black text-slate-500">Cliente</span>{editing.transaction.payerName}</div>
              <div><span className="block font-black text-slate-500">Referência original</span>{editing.transaction.providerReference || '—'}</div>
            </div>
            <FinanceField label="Referência do extrato">
              <input value={form.statementReference} onChange={(event) => setForm((current) => ({ ...current, statementReference: event.target.value }))} className={financeInputClass} placeholder="Ex.: OM-EXTRATO-2026-11" />
            </FinanceField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FinanceField label="Valor no extrato (XOF)">
                <input type="number" min={0} value={form.statementAmountXOF} onChange={(event) => setForm((current) => ({ ...current, statementAmountXOF: event.target.value }))} className={financeInputClass} />
              </FinanceField>
              <FinanceField label="Estado">
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={financeInputClass}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FinanceField>
            </div>
            <FinanceField label="Notas / motivo" hint="Uma divergência deve explicar a diferença detetada.">
              <textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={financeInputClass} />
            </FinanceField>
          </div>
        )}
      </FinanceModal>
    </ManagementPage>
  );
};
