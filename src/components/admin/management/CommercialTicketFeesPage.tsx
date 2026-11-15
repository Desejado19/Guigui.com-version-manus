import React, { useEffect, useState } from 'react';
import { History, Ticket } from 'lucide-react';
import {
  ManagementActionButton,
  type ManagementKpi,
} from './ManagementUi';
import {
  CommercialField,
  CommercialLoading,
  CommercialMessage,
  CommercialPageShell,
  commercialInputClass,
} from './CommercialShared';
import {
  commercialRequest,
  formatCommercialDate,
  formatCommercialXOF,
  type CommercialOverview,
} from './commercialApi';

export const CommercialTicketFeesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ commissionPercentage: 10, fixedFeeXOF: 200, currency: 'XOF', feePayer: 'organizer', billingModel: 'percentage_plus_fixed', conditions: '', isActive: true, reason: '' });

  const load = async (resetForm = false) => {
    setLoading(true);
    try {
      const data = await commercialRequest<CommercialOverview>('/api/admin/commercial/overview');
      setOverview(data);
      if (data.ticketFees) setForm((current) => resetForm || !current ? { commissionPercentage: data.ticketFees!.commissionPercentage, fixedFeeXOF: data.ticketFees!.fixedFeeXOF, currency: data.ticketFees!.currency, feePayer: data.ticketFees!.feePayer, billingModel: data.ticketFees!.billingModel, conditions: data.ticketFees!.conditions, isActive: data.ticketFees!.isActive, reason: '' } : current);
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const ticket = overview?.ticketFees;
  const kpis: ManagementKpi[] = [
    { label: 'Comissão por bilhete', value: `${ticket?.commissionPercentage ?? 10}%`, hint: 'Configuração atual', tone: 'success' },
    { label: 'Taxa fixa por emissão', value: formatCommercialXOF(ticket?.fixedFeeXOF ?? 200), hint: 'Por bilhete emitido', tone: 'neutral' },
    { label: 'Receita gerada', value: formatCommercialXOF(ticket?.generatedRevenueXOF), hint: `${ticket?.ticketCount ?? 0} ordens pagas`, tone: 'warning' },
    { label: 'Volume de bilhetes', value: formatCommercialXOF(ticket?.grossTicketVolumeXOF), hint: 'Receita das empresas organizadoras', tone: 'info' },
  ];

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await commercialRequest('/api/admin/commercial/ticket-fees', { method: 'PATCH', body: JSON.stringify(form) });
      setNotice('Taxas de bilheteira atualizadas e registadas no histórico.');
      await load(true);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommercialPageShell
      title="Taxas de Bilheteira"
      description="Configuração separada das subscrições empresariais. A receita de bilheteira é lida das ordens pagas e não é somada à receita de planos."
      onBack={onBack}
      breadcrumb="Taxas de Bilheteira"
      kpis={kpis}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      {notice && <CommercialMessage tone="success">{notice}</CommercialMessage>}
      {loading ? <CommercialLoading /> : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <section className="rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-[#123e3b]" /><h3 className="text-[13px] font-black text-slate-900">Parâmetros atuais</h3></div>
            <p className="mt-1 text-[10px] text-slate-500">Os valores existentes de 10% e 200 XOF são mantidos como configuração inicial e só mudam quando guardados aqui.</p>
            <form onSubmit={(event) => void save(event)} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CommercialField label="Comissão percentual (%)"><input type="number" min={0} max={100} step={0.5} className={commercialInputClass} value={form.commissionPercentage} onChange={(event) => setForm({ ...form, commissionPercentage: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} /></CommercialField>
              <CommercialField label="Taxa fixa por emissão (XOF)"><input type="number" min={0} className={commercialInputClass} value={form.fixedFeeXOF} onChange={(event) => setForm({ ...form, fixedFeeXOF: Math.max(0, Number(event.target.value) || 0) })} /></CommercialField>
              <CommercialField label="Moeda"><input className={commercialInputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></CommercialField>
              <CommercialField label="Quem paga"><select className={commercialInputClass} value={form.feePayer} onChange={(event) => setForm({ ...form, feePayer: event.target.value })}><option value="organizer">Organizador</option><option value="buyer">Comprador</option><option value="split">Partilhada</option></select></CommercialField>
              <CommercialField label="Modelo"><select className={commercialInputClass} value={form.billingModel} onChange={(event) => setForm({ ...form, billingModel: event.target.value })}><option value="percentage_plus_fixed">Percentagem + taxa fixa</option><option value="percentage_only">Apenas percentagem</option><option value="fixed_only">Apenas taxa fixa</option></select></CommercialField>
              <CommercialField label="Estado"><select className={commercialInputClass} value={form.isActive ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'active' })}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></CommercialField>
              <CommercialField label="Condições de aplicação" className="sm:col-span-2"><textarea className={`${commercialInputClass} min-h-20`} value={form.conditions} onChange={(event) => setForm({ ...form, conditions: event.target.value })} /></CommercialField>
              <CommercialField label="Motivo da alteração" className="sm:col-span-2"><input className={commercialInputClass} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Registado na auditoria" /></CommercialField>
              <div className="sm:col-span-2 flex justify-end"><ManagementActionButton type="submit" tone="primary" disabled={busy}>{busy ? 'A guardar…' : 'Guardar taxas'}</ManagementActionButton></div>
            </form>
            <div className="mt-4 rounded-xl border border-[#cfe2df] bg-[#f3faf8] p-3 text-[10px] leading-relaxed text-[#123e3b]">
              Exemplo: um bilhete de 2 500 XOF gera {formatCommercialXOF(Math.round(2500 * form.commissionPercentage / 100) + form.fixedFeeXOF)} de taxa com os valores acima. A receita das subscrições é contabilizada noutro módulo.
            </div>
          </section>
          <section className="rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><History className="h-4 w-4 text-slate-600" /><h3 className="text-[13px] font-black text-slate-900">Histórico de taxas</h3></div>
            <div className="mt-2 max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
              {ticket?.history.map((entry) => <div key={entry.id} className="py-2 text-[10px]"><div className="flex items-center justify-between gap-2"><strong>v{entry.version}</strong><span className="text-slate-500">{formatCommercialDate(entry.createdAt, true)}</span></div><div className="text-slate-600">{entry.reason || 'Alteração das taxas'}</div><div className="text-[9px] text-slate-500">{entry.changedBy}</div></div>)}
              {(!ticket?.history || ticket.history.length === 0) && <p className="py-6 text-center text-[10.5px] text-slate-500">Sem histórico registado.</p>}
            </div>
          </section>
        </div>
      )}
    </CommercialPageShell>
  );
};
