import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
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
  type FinanceRefund,
  type FinanceTransaction,
} from './financeApi';

interface Props { onBack: () => void }
type RefundMode = 'create' | 'authorize' | 'process' | 'reject';

export const FinanceRefundsPage: React.FC<Props> = ({ onBack }) => {
  const [refunds, setRefunds] = useState<FinanceRefund[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [mode, setMode] = useState<RefundMode | null>(null);
  const [target, setTarget] = useState<FinanceRefund | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ transactionId: '', amountXOF: '', kind: 'refund', reason: '', providerReference: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [refundData, transactionData] = await Promise.all([
        financeFetch<{ items: FinanceRefund[] }>('/api/admin/finance/refunds'),
        financeFetch<{ transactions: FinanceTransaction[] }>('/api/admin/finance/transactions?scope=platform'),
      ]);
      setRefunds(refundData.items || []);
      setTransactions(transactionData.transactions || []);
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const eligibleTransactions = transactions.filter((transaction) => (
    (transaction.status === 'paid' || transaction.status === 'authorized')
    && !transaction.isSimulated
    && transaction.refundedAmountXOF < transaction.amountXOF
  ));

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return refunds.filter((refund) => {
      if (statusFilter !== 'all' && refund.status !== statusFilter) return false;
      if (!term) return true;
      return [refund.id, refund.transactionId, refund.payerName, refund.reason, refund.originalReference, refund.providerReference]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [query, refunds, statusFilter]);
  const paged = paginateItems(filtered, page, pageSize);

  const openCreate = () => {
    const first = eligibleTransactions[0];
    setMode('create');
    setTarget(null);
    setForm({
      transactionId: first?.id || '',
      amountXOF: first ? String(first.amountXOF - first.refundedAmountXOF) : '',
      kind: 'refund',
      reason: '',
      providerReference: '',
    });
    setMessage(null);
  };

  const openAction = (refund: FinanceRefund, action: Exclude<RefundMode, 'create'>) => {
    setMode(action);
    setTarget(refund);
    setForm({ transactionId: refund.transactionId, amountXOF: String(refund.amountXOF), kind: refund.kind, reason: '', providerReference: '' });
    setMessage(null);
  };

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (mode === 'create') {
        await financeFetch('/api/admin/finance/refunds', {
          method: 'POST',
          body: JSON.stringify({
            transactionId: form.transactionId,
            amountXOF: Number(form.amountXOF),
            kind: form.kind,
            reason: form.reason,
          }),
        });
      } else if (target && mode) {
        await financeFetch(`/api/admin/finance/refunds/${encodeURIComponent(target.id)}/${mode}`, {
          method: 'POST',
          body: JSON.stringify({ reason: form.reason, providerReference: form.providerReference }),
        });
      }
      setMode(null);
      setTarget(null);
      await load();
      setMessage({
        tone: 'success',
        text: mode === 'create' ? 'Pedido de reembolso registado com auditoria.' : mode === 'authorize' ? 'Reembolso autorizado.' : mode === 'process' ? 'Reembolso efetuado e referência da operadora guardada.' : 'Reembolso rejeitado com justificação.',
      });
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<ManagementColumn<FinanceRefund>> = [
    {
      key: 'id', label: 'Reembolso',
      render: (refund) => (
        <div className="min-w-[150px]">
          <div className="font-black text-slate-900">{refund.id}</div>
          <div className="text-[9.5px] capitalize text-slate-500">{refund.kind === 'reversal' ? 'Estorno' : 'Reembolso'} · {formatFinanceDateTime(refund.createdAt)}</div>
        </div>
      ),
    },
    { key: 'transaction', label: 'Transação original', render: (refund) => <div className="min-w-[150px]"><div className="font-mono text-[9.5px] font-bold">{refund.transactionId}</div><div className="text-[9.5px] text-slate-500">{refund.originalReference || '—'}</div></div> },
    { key: 'payer', label: 'Cliente', render: (refund) => <span className="block min-w-[120px] text-[10px]">{refund.payerName}</span> },
    { key: 'amount', label: 'Valor', className: 'text-right', render: (refund) => <span className="whitespace-nowrap font-black">{formatXOF(refund.amountXOF)}</span> },
    { key: 'reason', label: 'Motivo', render: (refund) => <div className="max-w-[180px] text-[9.5px] text-slate-600"><span className="block">{refund.reason}</span>{refund.rejectionReason && <span className="mt-0.5 block text-[var(--tone-danger-text)]">Rejeição: {refund.rejectionReason}</span>}</div> },
    { key: 'status', label: 'Estado', render: (refund) => <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${financeStatusTone(refund.status)}`}>{refund.statusLabel}</span> },
    { key: 'responsible', label: 'Responsáveis', render: (refund) => <div className="min-w-[130px] text-[9px]"><div><strong>Solicitou:</strong> {refund.requestedByName || '—'}</div><div><strong>Autorizou:</strong> {refund.authorizedByName || '—'}</div><div><strong>Efetuou:</strong> {refund.processedByName || '—'}</div></div> },
    {
      key: 'actions', label: 'Ações', className: 'text-right',
      render: (refund) => (
        <div className="flex flex-wrap justify-end gap-1">
          {refund.status === 'requested' && <ManagementActionButton tone="success" onClick={() => openAction(refund, 'authorize')}>Autorizar</ManagementActionButton>}
          {refund.status === 'authorized' && <ManagementActionButton tone="primary" onClick={() => openAction(refund, 'process')}>Efetuar</ManagementActionButton>}
          {['requested', 'authorized'].includes(refund.status) && <ManagementActionButton tone="danger" onClick={() => openAction(refund, 'reject')}>Rejeitar</ManagementActionButton>}
          {['processed', 'rejected'].includes(refund.status) && <span className="text-[9px] font-bold text-slate-400">Concluído</span>}
        </div>
      ),
    },
  ];

  return (
    <ManagementPage
      title="Reembolsos e Estornos"
      description="Pedidos, autorizações e devoluções efetuadas para pagamentos da plataforma. Cada mudança exige responsável e fica registada em auditoria."
      moduleLabel="Financeiro"
      onBack={onBack}
      breadcrumbTail="Reembolsos e Estornos"
      actions={<ManagementActionButton tone="primary" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Novo reembolso</ManagementActionButton>}
      kpis={[
        { label: 'Solicitados', value: refunds.filter((item) => item.status === 'requested').length, tone: 'warning' },
        { label: 'Autorizados', value: refunds.filter((item) => item.status === 'authorized').length, tone: 'info' },
        { label: 'Efetuados', value: refunds.filter((item) => item.status === 'processed').length, tone: 'success' },
        { label: 'Valor efetuado', value: formatXOF(refunds.filter((item) => item.status === 'processed').reduce((sum, item) => sum + item.amountXOF, 0)), tone: 'danger' },
      ]}
    >
      <div className="rounded-2xl border border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] p-3 text-[10px] leading-relaxed text-[var(--tone-info-text)]">
        <strong className="font-black">Política:</strong> pedido, autorização e efetivação são passos separados. O valor não pode exceder a transação original.
        Reembolsos de bilhetes pertencem ao financeiro da empresa organizadora e não são processados nesta área.
      </div>
      {message && <FinanceMessage tone={message.tone}>{message.text}</FinanceMessage>}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-3.5 shadow-sm">
        <div className="relative min-w-[230px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Pesquisar por reembolso, transação, cliente ou motivo…" className={`${financeInputClass} pl-8`} />
        </div>
        <ManagementFilter label="Estado" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={[
          { value: 'all', label: 'Todos' },
          { value: 'requested', label: 'Solicitado' },
          { value: 'authorized', label: 'Autorizado' },
          { value: 'processed', label: 'Efetuado' },
          { value: 'rejected', label: 'Rejeitado' },
          { value: 'failed', label: 'Falhou' },
        ]} />
        <span className="text-[10px] font-bold text-slate-500">{filtered.length} registo(s)</span>
      </div>

      {loading ? <FinanceLoading label="A carregar reembolsos…" /> : (
        <>
          <ManagementTable columns={columns} rows={paged.items} rowKey={(refund) => refund.id} emptyMessage="Ainda não existem reembolsos ou estornos registados para a plataforma." />
          <ManagementPagination page={paged.page} pageSize={pageSize} totalItems={paged.totalItems} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <FinanceModal
        open={Boolean(mode)}
        title={mode === 'create' ? 'Novo pedido de reembolso' : mode === 'authorize' ? 'Autorizar reembolso' : mode === 'process' ? 'Efetuar reembolso' : 'Rejeitar reembolso'}
        description={mode === 'create' ? 'Só transações reais confirmadas podem originar reembolso ou estorno.' : target ? `${target.payerName} · ${formatXOF(target.amountXOF)}` : undefined}
        onClose={() => { setMode(null); setTarget(null); }}
        footer={(
          <>
            <ManagementActionButton onClick={() => { setMode(null); setTarget(null); }}>Cancelar</ManagementActionButton>
            <ManagementActionButton tone={mode === 'reject' ? 'danger' : mode === 'authorize' ? 'success' : 'primary'} disabled={saving} onClick={() => void submit()}>
              {saving ? 'A processar…' : mode === 'create' ? 'Registar pedido' : mode === 'authorize' ? 'Autorizar' : mode === 'process' ? 'Registar efetivação' : 'Rejeitar'}
            </ManagementActionButton>
          </>
        )}
      >
        {mode === 'create' ? (
          <div className="space-y-3">
            {eligibleTransactions.length === 0 && (
              <FinanceMessage tone="error">Não existem transações reais confirmadas elegíveis. Sandbox, simulações e pagamentos pendentes não podem originar reembolsos reais.</FinanceMessage>
            )}
            <FinanceField label="Transação original">
              <select
                value={form.transactionId}
                onChange={(event) => {
                  const selected = eligibleTransactions.find((item) => item.id === event.target.value);
                  setForm((current) => ({ ...current, transactionId: event.target.value, amountXOF: selected ? String(selected.amountXOF - selected.refundedAmountXOF) : current.amountXOF }));
                }}
                className={financeInputClass}
              >
                <option value="">Selecione a transação</option>
                {eligibleTransactions.map((transaction) => (
                  <option key={transaction.id} value={transaction.id}>{transaction.id} · {transaction.payerName} · {formatXOF(transaction.amountXOF)}</option>
                ))}
              </select>
            </FinanceField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FinanceField label="Valor (XOF)">
                <input type="number" min={1} value={form.amountXOF} onChange={(event) => setForm((current) => ({ ...current, amountXOF: event.target.value }))} className={financeInputClass} />
              </FinanceField>
              <FinanceField label="Tipo">
                <select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))} className={financeInputClass}>
                  <option value="refund">Reembolso</option>
                  <option value="reversal">Estorno</option>
                </select>
              </FinanceField>
            </div>
            <FinanceField label="Motivo" hint="Obrigatório. Fica associado ao pedido e à auditoria.">
              <textarea rows={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className={financeInputClass} />
            </FinanceField>
          </div>
        ) : target && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--color-border-default)] bg-slate-50 p-3 text-[10px] sm:grid-cols-2">
              <div><span className="block font-black text-slate-500">Transação</span>{target.transactionId}</div>
              <div><span className="block font-black text-slate-500">Referência original</span>{target.originalReference || '—'}</div>
              <div><span className="block font-black text-slate-500">Valor</span>{formatXOF(target.amountXOF)}</div>
              <div><span className="block font-black text-slate-500">Estado atual</span>{target.statusLabel}</div>
            </div>
            {mode === 'process' && (
              <FinanceField label="Referência da operadora" hint="Referência devolvida pela operadora após a devolução efetiva.">
                <input value={form.providerReference} onChange={(event) => setForm((current) => ({ ...current, providerReference: event.target.value }))} className={financeInputClass} />
              </FinanceField>
            )}
            {mode === 'reject' && (
              <FinanceField label="Motivo da rejeição">
                <textarea rows={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className={financeInputClass} />
              </FinanceField>
            )}
            {mode === 'authorize' && <p className="text-[10.5px] leading-relaxed text-slate-600">Confirme a política aplicável e autorize a devolução. O processamento continua separado e exige referência da operadora.</p>}
          </div>
        )}
      </FinanceModal>
    </ManagementPage>
  );
};
