import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Search, XCircle } from 'lucide-react';
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
  financeOriginLabel,
  financeOriginTone,
  formatFinanceAge,
  formatFinanceDateTime,
  formatXOF,
  type PendingPayment,
} from './financeApi';

interface Props { onBack: () => void }
type PendingAction = 'view' | 'confirm' | 'reject' | 'request-proof';

const OVERDUE_HOURS = 48;

function pendingAgeHours(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 3_600_000));
}

export const FinancePendingPage: React.FC<Props> = ({ onBack }) => {
  const [items, setItems] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [target, setTarget] = useState<{ payment: PendingPayment; action: PendingAction } | null>(null);
  const [form, setForm] = useState({ reason: '', proofReference: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await financeFetch<{ items: PendingPayment[] }>('/api/admin/finance/pending');
      setItems(data.items || []);
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((payment) => {
      if (provider !== 'all' && payment.provider !== provider) return false;
      if (!term) return true;
      return [payment.id, payment.payerName, payment.payerPhone, payment.providerReference, payment.useCaseLabel]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [items, provider, query]);
  const paged = paginateItems(filtered, page, pageSize);
  const providers = [...new Map(items.map((item) => [item.provider, item.providerLabel])).entries()];
  const overdue = useMemo(
    () => items.filter((item) => pendingAgeHours(item.createdAt) >= OVERDUE_HOURS),
    [items],
  );

  const openAction = (payment: PendingPayment, action: PendingAction) => {
    setTarget({ payment, action });
    setForm({ reason: '', proofReference: '' });
    setMessage(null);
  };

  const submit = async () => {
    if (!target || target.action === 'view') return;
    setSaving(true);
    setMessage(null);
    try {
      await financeFetch(`/api/admin/finance/pending/${encodeURIComponent(target.payment.id)}/${target.action}`, {
        method: 'POST',
        body: JSON.stringify({
          reason: form.reason,
          proofReference: form.proofReference,
        }),
      });
      setTarget(null);
      await load();
      setMessage({
        tone: 'success',
        text: target.action === 'confirm'
          ? 'Pagamento confirmado após validação do comprovativo e registado na auditoria.'
          : target.action === 'reject'
            ? 'Pagamento rejeitado com justificação registada.'
            : 'Pedido de comprovativo registado na fila.',
      });
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<ManagementColumn<PendingPayment>> = [
    {
      key: 'id', label: 'Transação',
      render: (item) => (
        <div className="min-w-[160px]">
          <div className="font-black text-slate-900">{item.id}</div>
          <div className="text-[9.5px] text-slate-500">{formatFinanceDateTime(item.createdAt)}</div>
          {pendingAgeHours(item.createdAt) >= OVERDUE_HOURS && (
            <span className="mt-0.5 inline-block rounded-full border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] px-1.5 py-0.5 text-[8px] font-black text-[var(--tone-danger-text)]">+48 h</span>
          )}
        </div>
      ),
    },
    { key: 'payer', label: 'Cliente ou empresa', render: (item) => <div className="min-w-[140px]"><div className="font-bold">{item.payerName}</div><div className="text-[9.5px] text-slate-500">{item.payerPhone}</div></div> },
    { key: 'service', label: 'Serviço', render: (item) => <span className="block min-w-[140px] text-[10px]">{item.useCaseLabel}</span> },
    { key: 'amount', label: 'Valor', className: 'text-right', render: (item) => <span className="whitespace-nowrap font-black">{formatXOF(item.amountXOF)}</span> },
    { key: 'provider', label: 'Operadora', render: (item) => <div className="min-w-[110px]"><div className="font-bold">{item.providerLabel}</div><span className={`inline-block rounded-full border px-1.5 py-0.5 text-[8px] font-black ${financeOriginTone(item.dataOrigin)}`}>{financeOriginLabel(item.dataOrigin)}</span></div> },
    { key: 'reference', label: 'Referência', render: (item) => <span className="block max-w-[130px] truncate font-mono text-[9px]">{item.providerReference || '—'}</span> },
    { key: 'proof', label: 'Comprovativo', render: (item) => <span className="block max-w-[140px] truncate text-[9px]">{item.actions.find((action) => action.proofReference)?.proofReference || 'Não anexado'}</span> },
    {
      key: 'actions', label: 'Ações', className: 'text-right',
      render: (item) => (
        <div className="flex flex-wrap justify-end gap-1">
          <ManagementActionButton onClick={() => openAction(item, 'view')}><Eye className="h-3 w-3" /> Detalhes</ManagementActionButton>
          <ManagementActionButton tone="success" onClick={() => openAction(item, 'confirm')}><CheckCircle2 className="h-3 w-3" /> Confirmar</ManagementActionButton>
          <ManagementActionButton tone="danger" onClick={() => openAction(item, 'reject')}><XCircle className="h-3 w-3" /> Rejeitar</ManagementActionButton>
          <ManagementActionButton tone="warning" onClick={() => openAction(item, 'request-proof')}>Pedir comprovativo</ManagementActionButton>
        </div>
      ),
    },
  ];

  return (
    <ManagementPage
      title="Pagamentos pendentes"
      description="Fila de pagamentos que exigem validação manual. Confirme apenas após conferir o comprovativo, rejeite com justificação ou solicite nova prova ao cliente."
      moduleLabel="Financeiro"
      onBack={onBack}
      breadcrumbTail="Pagamentos pendentes"
      kpis={[
        { label: 'Na fila', value: items.length, tone: 'warning' },
        { label: 'Há mais de 48 h', value: overdue.length, hint: formatXOF(overdue.reduce((sum, item) => sum + item.amountXOF, 0)), tone: 'danger' },
        { label: 'Valor pendente', value: formatXOF(items.reduce((sum, item) => sum + item.amountXOF, 0)), tone: 'neutral' },
        { label: 'Registos legados', value: items.filter((item) => item.dataOrigin === 'legacy').length, hint: 'Exigem validação manual', tone: 'info' },
        { label: 'Simulados bloqueados', value: items.filter((item) => item.isSimulated).length, tone: 'danger' },
      ]}
    >
      <div className="rounded-2xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] p-3 text-[10px] leading-relaxed text-[var(--tone-warning-text)]">
        <strong className="font-black">Confirmação responsável:</strong> cada ação fica registada com administrador, data e motivo.
        Pagamentos de sandbox ou simulados nunca são convertidos em pagamentos reais confirmados.
      </div>
      {overdue.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] p-3 text-[10px] leading-relaxed text-[var(--tone-danger-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-black">{overdue.length} pagamento(s) ultrapassaram 48 horas na fila</strong>, num total de {formatXOF(overdue.reduce((sum, item) => sum + item.amountXOF, 0))}.
            Regularize com comprovativo validado ou rejeição justificada.
          </span>
        </div>
      )}
      {message && <FinanceMessage tone={message.tone}>{message.text}</FinanceMessage>}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-3.5 shadow-sm">
        <div className="relative min-w-[230px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Pesquisar por transação, cliente, telefone ou referência…" className={`${financeInputClass} pl-8`} />
        </div>
        <ManagementFilter label="Operadora" value={provider} onChange={(value) => { setProvider(value); setPage(1); }} options={[{ value: 'all', label: 'Todas' }, ...providers.map(([value, label]) => ({ value, label }))]} />
        <span className="text-[10px] font-bold text-slate-500">{filtered.length} pendente(s)</span>
      </div>

      {loading ? <FinanceLoading label="A carregar pagamentos pendentes…" /> : (
        <>
          <ManagementTable columns={columns} rows={paged.items} rowKey={(item) => item.id} emptyMessage="Não existem pagamentos pendentes com os filtros atuais." />
          <ManagementPagination page={paged.page} pageSize={pageSize} totalItems={paged.totalItems} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <FinanceModal
        open={Boolean(target)}
        title={target ? `${target.action === 'view' ? 'Detalhe' : target.action === 'confirm' ? 'Confirmar' : target.action === 'reject' ? 'Rejeitar' : 'Pedir comprovativo'} · ${target.payment.id}` : 'Pagamento'}
        description={target ? `${target.payment.payerName} · ${formatXOF(target.payment.amountXOF)} · ${target.payment.providerLabel}` : undefined}
        onClose={() => setTarget(null)}
        footer={target && target.action !== 'view' ? (
          <>
            <ManagementActionButton onClick={() => setTarget(null)}>Cancelar</ManagementActionButton>
            <ManagementActionButton tone={target.action === 'reject' ? 'danger' : target.action === 'confirm' ? 'success' : 'warning'} disabled={saving} onClick={() => void submit()}>
              {saving ? 'A processar…' : target.action === 'confirm' ? 'Confirmar pagamento' : target.action === 'reject' ? 'Rejeitar pagamento' : 'Registar pedido'}
            </ManagementActionButton>
          </>
        ) : <ManagementActionButton onClick={() => setTarget(null)}>Fechar</ManagementActionButton>}
      >
        {target && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--color-border-default)] bg-slate-50 p-3 text-[10px] sm:grid-cols-2">
              <div><span className="block font-black text-slate-500">Serviço</span>{target.payment.useCaseLabel}</div>
              <div><span className="block font-black text-slate-500">Origem</span>{financeOriginLabel(target.payment.dataOrigin)}</div>
              <div><span className="block font-black text-slate-500">Referência original</span>{target.payment.providerReference || '—'}</div>
              <div><span className="block font-black text-slate-500">Criado em</span>{formatFinanceDateTime(target.payment.createdAt)}</div>
              <div><span className="block font-black text-slate-500">Tempo na fila</span>há {formatFinanceAge(pendingAgeHours(target.payment.createdAt))}</div>
            </div>
            {target.action === 'confirm' && (
              <FinanceField label="Referência do comprovativo validado" hint="Obrigatório. Confirme que o valor e o comprovativo correspondem à transação.">
                <input value={form.proofReference} onChange={(event) => setForm((current) => ({ ...current, proofReference: event.target.value }))} className={financeInputClass} placeholder="Ex.: OM-2026-88192" />
              </FinanceField>
            )}
            {target.action !== 'view' && (
              <FinanceField label={target.action === 'confirm' ? 'Nota de validação (opcional)' : 'Motivo'} hint={target.action === 'request-proof' ? 'Descreva o comprovativo que deve ser solicitado ao cliente.' : undefined}>
                <textarea rows={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className={financeInputClass} />
              </FinanceField>
            )}
            {target.payment.actions.length > 0 && (
              <div>
                <h4 className="text-[11px] font-black text-slate-900">Ações anteriores</h4>
                {target.payment.actions.map((action) => (
                  <div key={action.id} className="mt-1 rounded-lg border border-[var(--color-border-subtle)] p-2 text-[9.5px]">
                    <strong>{action.action}</strong> · {action.actorName} · {formatFinanceDateTime(action.createdAt)}
                    {action.proofReference && <span className="block">Comprovativo: {action.proofReference}</span>}
                    {action.reason && <span className="block text-slate-500">{action.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </FinanceModal>
    </ManagementPage>
  );
};
