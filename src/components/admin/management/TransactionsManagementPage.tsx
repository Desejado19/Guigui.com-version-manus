import React, { useMemo } from 'react';
import type { PaymentTransaction } from '../../../types';
import { formatManagementDate } from './managementState';
import { RecordsManagementPage } from './RecordsManagementPage';

const STATUS_LABELS: Record<string, string> = {
  pending_provider: 'Pendente do provider',
  pending_manual_confirmation: 'Pendente de confirmação manual',
  confirmed_api: 'Confirmada (API)',
  confirmed_manual: 'Confirmada (manual)',
  reconciled: 'Reconciliada',
  refunded: 'Reembolsada',
  failed: 'Falhada',
};

const CONFIRMED_STATUSES = new Set(['confirmed_api', 'confirmed_manual', 'reconciled']);

/** Um pagamento confirmado por adaptador simulado nunca é apresentado como real. */
const paymentStatusLabel = (transaction: PaymentTransaction): string => {
  if (transaction.status === 'confirmed_api' && transaction.providerMode === 'simulated') {
    return 'Confirmado em modo simulado';
  }
  return STATUS_LABELS[transaction.status] || transaction.status;
};

interface TransactionsManagementPageProps {
  transactions: PaymentTransaction[];
  onBack: () => void;
}

export const TransactionsManagementPage: React.FC<TransactionsManagementPageProps> = ({ transactions, onBack }) => {
  const providers = useMemo(
    () => [...new Set(transactions.map((transaction) => transaction.provider).filter(Boolean))].sort(),
    [transactions],
  );
  const useCases = useMemo(
    () => [...new Set(transactions.map((transaction) => transaction.useCase).filter(Boolean))].sort(),
    [transactions],
  );

  const totals = useMemo(() => {
    const confirmed = transactions.filter((transaction) => CONFIRMED_STATUSES.has(transaction.status));
    const pending = transactions.filter((transaction) => String(transaction.status).startsWith('pending'));
    return {
      confirmedCount: confirmed.length,
      pendingCount: pending.length,
      refunded: transactions.filter((transaction) => transaction.status === 'refunded').length,
      gross: confirmed.reduce((sum, transaction) => sum + (transaction.amountXOF || 0), 0),
      pendingAmount: pending.reduce((sum, transaction) => sum + (transaction.amountXOF || 0), 0),
    };
  }, [transactions]);

  return (
    <RecordsManagementPage<PaymentTransaction>
      title="Gestão de transações financeiras"
      description="Todas as transações de pagamento registadas, com pesquisa, filtros por estado, método e finalidade, ordenação, paginação, exportação e ficha detalhada."
      moduleLabel="Financeiro"
      storageKey="admin.management.transactions"
      onBack={onBack}
      rows={transactions}
      rowKey={(transaction) => transaction.id}
      searchPlaceholder="Pesquisar por referência, pagador, empresa, finalidade ou referência do provider…"
      searchFields={(transaction) => [
        transaction.id,
        transaction.providerRef,
        transaction.payerName,
        transaction.businessName,
        transaction.businessId,
        transaction.useCaseLabel,
        transaction.amountXOF,
      ]}
      filters={[
        { key: 'status', label: 'Estado', options: [
          { value: 'all', label: 'Todos' },
          ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        ] },
        { key: 'provider', label: 'Método', options: [
          { value: 'all', label: 'Todos' },
          ...providers.map((provider) => ({ value: provider, label: provider })),
        ] },
        { key: 'useCase', label: 'Finalidade', options: [
          { value: 'all', label: 'Todas' },
          ...useCases.map((useCase) => ({ value: useCase, label: useCase })),
        ] },
      ]}
      matchesFilters={(transaction, filters) => (
        (filters.status === 'all' || transaction.status === filters.status)
        && (filters.provider === 'all' || transaction.provider === filters.provider)
        && (filters.useCase === 'all' || transaction.useCase === filters.useCase)
      )}
      sortValue={(transaction, key) => {
        if (key === 'amount') return transaction.amountXOF || 0;
        if (key === 'status') return transaction.status;
        if (key === 'createdAt') return transaction.createdAt ? new Date(transaction.createdAt).getTime() : 0;
        return transaction.payerName || '';
      }}
      defaultSortKey="createdAt"
      columns={[
        {
          key: 'id',
          label: 'Transação',
          render: (transaction) => (
            <div className="min-w-[170px]">
              <div className="font-black text-slate-900">{transaction.id}</div>
              <div className="truncate text-[9.5px] text-slate-500">{transaction.providerRef || 'Sem referência do provider'}</div>
            </div>
          ),
        },
        {
          key: 'payer',
          label: 'Pagador / Empresa',
          sortable: true,
          render: (transaction) => (
            <div className="min-w-[160px]">
              <div className="truncate font-bold text-slate-800">{transaction.payerName || '—'}</div>
              <div className="truncate text-[9.5px] text-slate-500">{transaction.businessName || transaction.businessId || 'Plataforma'}</div>
            </div>
          ),
        },
        { key: 'useCase', label: 'Finalidade', render: (transaction) => <span className="block min-w-[150px] text-[10px]">{transaction.useCaseLabel || transaction.useCase}</span> },
        { key: 'amount', label: 'Montante', sortable: true, render: (transaction) => <span className="whitespace-nowrap font-black tabular-nums">{(transaction.amountXOF || 0).toLocaleString('pt-PT')} XOF</span> },
        { key: 'status', label: 'Estado', sortable: true, render: (transaction) => (
          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${
            CONFIRMED_STATUSES.has(transaction.status) ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : String(transaction.status).startsWith('pending') ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}>{paymentStatusLabel(transaction)}</span>
        ) },
        { key: 'createdAt', label: 'Data', sortable: true, render: (transaction) => <span className="whitespace-nowrap">{formatManagementDate(transaction.createdAt)}</span> },
      ]}
      kpis={[
        { label: 'Total registadas', value: transactions.length, tone: 'info' },
        { label: 'Confirmadas', value: totals.confirmedCount, hint: `${totals.gross.toLocaleString('pt-PT')} XOF`, tone: 'success' },
        { label: 'Pendentes', value: totals.pendingCount, hint: `${totals.pendingAmount.toLocaleString('pt-PT')} XOF`, tone: 'warning' },
        { label: 'Reembolsadas', value: totals.refunded, tone: 'danger' },
        { label: 'Receita confirmada', value: `${totals.gross.toLocaleString('pt-PT')} XOF`, tone: 'neutral' },
      ]}
      exportSpec={{
        filename: `transacoes-guigui-${new Date().toISOString().slice(0, 10)}`,
        sheet: 'Transações',
        title: 'Relatório de Transações — Guigui.com',
        description: 'Transações financeiras após aplicação dos filtros atuais.',
        headers: ['ID', 'Data', 'Pagador', 'Empresa', 'Finalidade', 'Método', 'Montante XOF', 'Estado', 'Referência provider'],
        row: (transaction) => [transaction.id, formatManagementDate(transaction.createdAt), transaction.payerName, transaction.businessName || '', transaction.useCaseLabel, transaction.provider, transaction.amountXOF, paymentStatusLabel(transaction), transaction.providerRef || ''],
        pdfKpis: [
          { label: 'Transações', value: String(transactions.length) },
          { label: 'Confirmadas', value: String(totals.confirmedCount) },
          { label: 'Receita', value: `${totals.gross} XOF` },
        ],
      }}
      detailLabel={(transaction) => `Transação ${transaction.id}`}
      detail={(transaction) => (
        <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
          {[
            ['ID', transaction.id],
            ['Referência do provider', transaction.providerRef],
            ['Pagador', transaction.payerName],
            ['Telefone', transaction.payerPhone],
            ['Empresa', transaction.businessName || transaction.businessId],
            ['Finalidade', transaction.useCaseLabel],
            ['Método', transaction.provider],
            ['Modo', transaction.providerMode],
            ['Montante', `${transaction.amountXOF.toLocaleString('pt-PT')} XOF`],
            ['Estado', paymentStatusLabel(transaction)],
            ['Criada em', formatManagementDate(transaction.createdAt)],
            ['Confirmada em', formatManagementDate(transaction.confirmedAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
              <div className="mt-0.5 font-medium text-slate-700">{value || '—'}</div>
            </div>
          ))}
        </div>
      )}
    />
  );
};
