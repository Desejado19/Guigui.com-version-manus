import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, Filter, Plus, Search } from 'lucide-react';
import { ManagementActionButton, ManagementPage } from './ManagementUi';
import { EventControlCenter } from '../../events/EventControlCenter';
import { FinanceExportButtons, FinanceField, FinanceLoading, FinanceMessage, FinanceModal, financeInputClass } from './FinanceShared';
import {
  downloadFinanceExport,
  financeFetch,
  financeStatusTone,
  formatFinanceDateTime,
  formatXOF,
  type EventPayout,
  type TicketFinanceOverview,
} from './financeApi';

interface Props { onBack: () => void }

interface FormState {
  eventId: string;
  amountXOF: string;
  method: 'manual_transfer' | 'orange_money' | 'telecel' | 'bank_transfer';
  reference: string;
  proofReference: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  eventId: '',
  amountXOF: '',
  method: 'manual_transfer',
  reference: '',
  proofReference: '',
  notes: '',
};

export const FinancePayoutsPage: React.FC<Props> = ({ onBack }) => {
  const [overview, setOverview] = useState<TicketFinanceOverview | null>(null);
  const [payouts, setPayouts] = useState<EventPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [confirming, setConfirming] = useState<EventPayout | null>(null);
  const [confirmReference, setConfirmReference] = useState('');
  const [confirmProof, setConfirmProof] = useState('');
  const [saving, setSaving] = useState(false);
  const [openEvent, setOpenEvent] = useState<{ id: string; title: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ticketOverview, payoutList] = await Promise.all([
        financeFetch<TicketFinanceOverview>('/api/admin/finance/tickets'),
        financeFetch<{ payouts: EventPayout[] }>('/api/admin/finance/payouts'),
      ]);
      setOverview(ticketOverview);
      setPayouts(payoutList.payouts || []);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const events = useMemo(
    () => [...(overview?.events || [])].sort((a, b) => `${a.companyName || ''} ${a.eventTitle}`.localeCompare(`${b.companyName || ''} ${b.eventTitle}`, 'pt')),
    [overview],
  );
  const selectedEvent = events.find((event) => event.eventId === form.eventId) || null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payouts.filter((payout) => {
      if (status !== 'all' && payout.status !== status) return false;
      if (!needle) return true;
      return [payout.id, payout.companyName, payout.eventTitle, payout.reference, payout.proofReference, payout.methodLabel]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [payouts, query, status]);

  const create = async () => {
    if (!selectedEvent) {
      setError('Selecione o evento de origem do repasse.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await financeFetch<EventPayout>('/api/admin/finance/payouts', {
        method: 'POST',
        body: JSON.stringify({
          companyId: selectedEvent.companyId,
          eventId: selectedEvent.eventId,
          amountXOF: Number(form.amountXOF),
          method: form.method,
          reference: form.reference,
          proofReference: form.proofReference,
          notes: form.notes,
        }),
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setNotice('Repasse registado como pendente. Ainda não foi transferido nem confirmado.');
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (payout: EventPayout, next: EventPayout['status'], extra: Record<string, unknown> = {}) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await financeFetch<EventPayout>(`/api/admin/finance/payouts/${encodeURIComponent(payout.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next, ...extra }),
      });
      setConfirming(null);
      setConfirmReference('');
      setConfirmProof('');
      setNotice(
        next === 'confirmed'
          ? 'Repasse confirmado com a referência indicada.'
          : next === 'processing'
            ? 'Repasse marcado como em processamento.'
            : next === 'cancelled'
              ? 'Repasse cancelado. O valor volta a ficar pendente para a empresa.'
              : 'Estado do repasse atualizado.',
      );
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exportPayouts = (format: 'csv' | 'excel' | 'pdf') => {
    void downloadFinanceExport(format, {
      filename: `repasses-${new Date().toISOString().slice(0, 10)}`,
      title: 'Repasses às empresas organizadoras',
      description: 'Repasses registados com evento de origem, referência, comprovativo e estado real. Confirmar exige referência.',
      headers: ['ID', 'Empresa', 'Evento', 'Valor XOF', 'Método', 'Estado', 'Referência', 'Comprovativo', 'Responsável', 'Criado em', 'Confirmado em'],
      rows: filtered.map((payout) => [
        payout.id, payout.companyName, payout.eventTitle || '—', payout.amountXOF, payout.methodLabel,
        payout.statusLabel, payout.reference || '', payout.proofReference || '', payout.createdByName || '',
        formatFinanceDateTime(payout.createdAt), formatFinanceDateTime(payout.confirmedAt),
      ]),
      kpis: [
        { label: 'Repasses', value: String(filtered.length) },
        { label: 'Confirmado', value: formatXOF(filtered.filter((p) => p.status === 'confirmed').reduce((sum, p) => sum + p.amountXOF, 0)) },
        { label: 'Pendente + processamento', value: formatXOF(filtered.filter((p) => p.status === 'pending' || p.status === 'processing').reduce((sum, p) => sum + p.amountXOF, 0)) },
      ],
    });
  };

  const totals = overview?.totals;

  return (
    <ManagementPage
      title="Repasses às empresas"
      description="Registo e acompanhamento dos valores devidos às empresas. Confirmar um repasse exige referência real; o sistema nunca executa transferências."
      moduleLabel="Financeiro"
      onBack={onBack}
      breadcrumbTail="Repasses"
      actions={
        <>
          <ManagementActionButton onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> Registar repasse
          </ManagementActionButton>
          <FinanceExportButtons onExport={exportPayouts} />
        </>
      }
      kpis={[
        { label: 'Valor líquido das empresas', value: formatXOF(totals?.netXOF), tone: 'info' },
        { label: 'Já repassado', value: formatXOF(totals?.paidOutXOF), tone: 'success' },
        { label: 'Em processamento', value: formatXOF(totals?.processingXOF), tone: 'warning' },
        { label: 'Pendente de repasse', value: formatXOF(totals?.pendingPayoutXOF), tone: 'warning' },
      ]}
    >
      {error && <FinanceMessage tone="error">{error}</FinanceMessage>}
      {notice && <FinanceMessage tone="success">{notice}</FinanceMessage>}

      {totals && totals.unlinkedTransactionsCount > 0 && (
        <details className="rounded-xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] px-3 py-2 text-[10px] font-bold text-[var(--tone-warning-text)]">
          <summary className="flex cursor-pointer items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {totals.unlinkedTransactionsCount} pagamento(s) confirmados sem evento associado ({formatXOF(totals.unlinkedTransactionsXOF)}). São anteriores à correção e ficam visíveis como divergência, sem afectar os saldos por evento.
          </summary>
          <ul className="mt-2 space-y-1 border-t border-[var(--tone-warning-border)] pt-2">
            {(overview?.unlinkedTransactions || []).slice(0, 10).map((transaction) => (
              <li key={transaction.id} className="flex flex-wrap justify-between gap-2 rounded bg-white px-2 py-1">
                <span className="font-mono text-[9px]">{transaction.id} · {transaction.providerLabel}</span>
                <span>{transaction.payerName || 'Sem comprador'} · {formatXOF(transaction.amountXOF)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {(overview?.companies || []).slice(0, 6).map((company) => (
          <article key={company.companyId} className="rounded-2xl border border-[var(--color-border-default)] bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-green-900)] text-white"><Banknote className="h-4 w-4" /></span>
              <div className="min-w-0">
                <h3 className="truncate text-[11px] font-black text-slate-900">{company.companyName}</h3>
                <p className="text-[9px] font-bold text-slate-500">{company.events} evento(s) com movimento</p>
              </div>
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[10px]">
              <div><dt className="font-bold text-slate-500">Líquido</dt><dd className="font-black text-slate-900">{formatXOF(company.netXOF)}</dd></div>
              <div><dt className="font-bold text-slate-500">Já repassado</dt><dd className="font-black text-[var(--tone-success-text)]">{formatXOF(company.paidOutXOF)}</dd></div>
              <div><dt className="font-bold text-slate-500">Pendente</dt><dd className="font-black text-[var(--tone-warning-text)]">{formatXOF(company.pendingPayoutXOF)}</dd></div>
              <div><dt className="font-bold text-slate-500">Comissão Guigui</dt><dd className="font-black text-slate-700">{formatXOF(company.commissionXOF)}</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-default)] bg-white shadow-sm">
        <table className="min-w-full text-left text-[10.5px]">
          <thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase text-slate-500">
            <tr><th className="px-3 py-2">Empresa / Evento</th><th className="px-3 py-2">Receita bruta</th><th className="px-3 py-2">Comissão</th><th className="px-3 py-2">Líquido</th><th className="px-3 py-2">Repassado</th><th className="px-3 py-2">Pendente</th><th className="px-3 py-2 text-right">Centro do evento</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {events.slice(0, 20).map((event) => (
              <tr key={event.eventId}>
                <td className="px-3 py-2">
                  <div className="font-black text-slate-900">{event.eventTitle}</div>
                  <div className="text-[9px] text-slate-500">{event.companyName || 'Sem empresa'}</div>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatXOF(event.grossXOF)}</td>
                <td className="px-3 py-2 tabular-nums">{formatXOF(event.commissionXOF)}</td>
                <td className="px-3 py-2 font-bold tabular-nums">{formatXOF(event.netXOF)}</td>
                <td className="px-3 py-2 tabular-nums text-[var(--tone-success-text)]">{formatXOF(event.paidOutXOF)}</td>
                <td className="px-3 py-2 font-bold tabular-nums text-[var(--tone-warning-text)]">{formatXOF(event.pendingPayoutXOF)}</td>
                <td className="px-3 py-2 text-right">
                  <ManagementActionButton onClick={() => setOpenEvent({ id: event.eventId, title: event.eventTitle })}>
                    Abrir <ArrowRight className="h-3 w-3" />
                  </ManagementActionButton>
                </td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-slate-500">Sem eventos com receita confirmada.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border-default)] bg-white p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por empresa, evento, referência ou comprovativo…"
            aria-label="Pesquisar repasses"
            className={`${financeInputClass} pl-8`}
          />
        </div>
        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500">
          <Filter className="h-3.5 w-3.5" /> Estado
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={financeInputClass} aria-label="Filtrar repasses por estado">
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="processing">Em processamento</option>
            <option value="confirmed">Confirmado</option>
            <option value="failed">Falhado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <span className="text-[10px] font-bold text-slate-500">{filtered.length} repasse(s)</span>
      </div>

      {loading ? <FinanceLoading label="A carregar repasses e saldos reais…" /> : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-default)] bg-white shadow-sm">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Empresa / Evento</th><th className="px-3 py-2.5">Valor</th><th className="px-3 py-2.5">Método</th>
                <th className="px-3 py-2.5">Referência</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Criado</th><th className="px-3 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map((payout) => (
                <tr key={payout.id} data-testid="payout-row">
                  <td className="px-3 py-2.5">
                    <div className="font-black text-slate-900">{payout.companyName}</div>
                    <div className="text-[9.5px] text-slate-500">{payout.eventTitle || 'Sem evento'} · <span className="font-mono">{payout.id}</span></div>
                  </td>
                  <td className="px-3 py-2.5 font-black tabular-nums text-slate-900">{formatXOF(payout.amountXOF)}</td>
                  <td className="px-3 py-2.5">{payout.methodLabel}</td>
                  <td className="px-3 py-2.5 text-[10px]">
                    <div>{payout.reference || '—'}</div>
                    <div className="text-[9px] text-slate-500">Comprovativo: {payout.proofReference || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${financeStatusTone(payout.status === 'confirmed' ? 'processed' : payout.status)}`}>{payout.statusLabel}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[9.5px] text-slate-500">{formatFinanceDateTime(payout.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      {payout.status === 'pending' && (
                        <ManagementActionButton onClick={() => void changeStatus(payout, 'processing')} disabled={saving}>
                          Processar
                        </ManagementActionButton>
                      )}
                      {(payout.status === 'pending' || payout.status === 'processing') && (
                        <>
                          <ManagementActionButton onClick={() => { setConfirming(payout); setConfirmReference(payout.reference || ''); setConfirmProof(payout.proofReference || ''); }} disabled={saving}>
                            <CheckCircle2 className="h-3 w-3" /> Confirmar
                          </ManagementActionButton>
                          <ManagementActionButton tone="danger" onClick={() => void changeStatus(payout, 'cancelled')} disabled={saving}>Cancelar</ManagementActionButton>
                        </>
                      )}
                      {payout.status === 'confirmed' && <span className="text-[9px] font-bold text-slate-500">Confirmado em {formatFinanceDateTime(payout.confirmedAt)}</span>}
                      {(payout.status === 'failed' || payout.status === 'cancelled') && <span className="text-[9px] font-bold text-slate-500">Estado final</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-[11px] text-slate-500">Ainda não existem repasses para os filtros aplicados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <FinanceModal
        open={showCreate}
        title="Registar repasse"
        description="O registo não executa nenhuma transferência. O valor fica reservado ao evento e só é confirmado depois de indicar a referência real."
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <ManagementActionButton onClick={() => setShowCreate(false)}>Cancelar</ManagementActionButton>
            <ManagementActionButton onClick={() => void create()} disabled={saving}>
              {saving ? 'A registar…' : 'Registar repasse'}
            </ManagementActionButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FinanceField label="Evento de origem">
            <select
              value={form.eventId}
              onChange={(event) => setForm((current) => ({ ...current, eventId: event.target.value }))}
              className={financeInputClass}
              data-testid="payout-event"
            >
              <option value="">Selecione o evento…</option>
              {events.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.companyName || 'Empresa'} — {event.eventTitle} ({formatXOF(event.pendingPayoutXOF)} pendente)
                </option>
              ))}
            </select>
          </FinanceField>
          <FinanceField label="Valor (XOF)" hint={selectedEvent ? `Disponível: ${formatXOF(selectedEvent.pendingPayoutXOF)}` : 'Escolha primeiro o evento.'}>
            <input
              type="number"
              min={1}
              max={selectedEvent?.pendingPayoutXOF || undefined}
              value={form.amountXOF}
              onChange={(event) => setForm((current) => ({ ...current, amountXOF: event.target.value }))}
              className={financeInputClass}
              data-testid="payout-amount"
            />
          </FinanceField>
          <FinanceField label="Método">
            <select value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value as FormState['method'] }))} className={financeInputClass}>
              <option value="manual_transfer">Transferência manual</option>
              <option value="bank_transfer">Transferência bancária</option>
              <option value="orange_money">Orange Money</option>
              <option value="telecel">Telecel</option>
            </select>
          </FinanceField>
          <FinanceField label="Referência (opcional no registo)">
            <input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} className={financeInputClass} placeholder="Ex.: TRF-2026-00123" />
          </FinanceField>
          <FinanceField label="Comprovativo (opcional)">
            <input value={form.proofReference} onChange={(event) => setForm((current) => ({ ...current, proofReference: event.target.value }))} className={financeInputClass} placeholder="Ex.: comprovativo-001.pdf" />
          </FinanceField>
          <FinanceField label="Notas">
            <input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={financeInputClass} placeholder="Observações internas" />
          </FinanceField>
        </div>
      </FinanceModal>

      {openEvent && (
        <EventControlCenter
          eventId={openEvent.id}
          eventTitle={openEvent.title}
          viewerRole="admin"
          onClose={() => setOpenEvent(null)}
          initialTab="finance"
        />
      )}

      <FinanceModal
        open={Boolean(confirming)}
        title="Confirmar repasse"
        description="Só confirme depois de a transferência estar efectivamente concluída. A referência fica registada na auditoria."
        onClose={() => setConfirming(null)}
        footer={
          <>
            <ManagementActionButton onClick={() => setConfirming(null)}>Voltar</ManagementActionButton>
            <ManagementActionButton
              onClick={() => confirming && void changeStatus(confirming, 'confirmed', { reference: confirmReference, proofReference: confirmProof })}
              disabled={saving || confirmReference.trim().length < 3}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar repasse
            </ManagementActionButton>
          </>
        }
      >
        {confirming && (
          <div className="space-y-3">
            <p className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 p-3 text-[11px] text-slate-700">
              <strong>{confirming.companyName}</strong> · {confirming.eventTitle || 'Sem evento'}<br />
              Valor: <strong>{formatXOF(confirming.amountXOF)}</strong> · {confirming.methodLabel}
            </p>
            <FinanceField label="Referência real da transferência">
              <input value={confirmReference} onChange={(event) => setConfirmReference(event.target.value)} className={financeInputClass} data-testid="payout-confirm-reference" />
            </FinanceField>
            <FinanceField label="Comprovativo">
              <input value={confirmProof} onChange={(event) => setConfirmProof(event.target.value)} className={financeInputClass} />
            </FinanceField>
          </div>
        )}
      </FinanceModal>
    </ManagementPage>
  );
};
