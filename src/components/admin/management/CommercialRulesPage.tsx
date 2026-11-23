import React, { useEffect, useState } from 'react';
import { Info, Settings2, ShieldCheck } from 'lucide-react';
import { ManagementActionButton, type ManagementKpi } from './ManagementUi';
import {
  CommercialField,
  CommercialLoading,
  CommercialMessage,
  CommercialPageShell,
  commercialInputClass,
} from './CommercialShared';
import { commercialRequest, formatCommercialDate, type CommercialOverview, type CommercialRules } from './commercialApi';

const formFromRules = (rules: CommercialRules) => ({
  annualDiscountPercent: rules.annualDiscountPercent,
  gracePeriodDays: rules.gracePeriodDays,
  renewalNoticeDays: rules.renewalNoticeDays,
  autoSuspendAfterExpiry: rules.autoSuspendAfterExpiry,
  autoRenewalEnabled: rules.autoRenewalEnabled,
  allowPlanChange: rules.allowPlanChange,
  allowExtraPublications: rules.allowExtraPublications,
  monthlyPostRule: rules.monthlyPostRule,
  terms: rules.terms,
  reason: '',
});

export const CommercialRulesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [form, setForm] = useState<ReturnType<typeof formFromRules> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (resetForm = false) => {
    setLoading(true);
    try {
      const data = await commercialRequest<CommercialOverview>('/api/admin/commercial/overview');
      setOverview(data);
      if (data.rules) setForm((current) => resetForm || !current ? formFromRules(data.rules!) : current);
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const rules = overview?.rules;
  const kpis: ManagementKpi[] = [
    { label: 'Desconto anual', value: `${rules?.annualDiscountPercent ?? 15}%`, hint: 'Pagamento antecipado', tone: 'success' },
    { label: 'Período de tolerância', value: `${rules?.gracePeriodDays ?? 0} dias`, hint: 'Após expiração', tone: 'warning' },
    { label: 'Aviso de renovação', value: `${rules?.renewalNoticeDays ?? 0} dias`, hint: 'Antes do fim', tone: 'info' },
    { label: 'Regra de publicações', value: `${rules?.monthlyPostRule ?? 3}/mês`, hint: 'Base transversal', tone: 'neutral' },
  ];

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await commercialRequest('/api/admin/commercial/rules', { method: 'PUT', body: JSON.stringify(form) });
      setNotice('Regras comerciais guardadas. Novas adesões e renovações passam a usar esta configuração.');
      await load(true);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommercialPageShell
      title="Regras Comerciais"
      description="Condições que orientam descontos, tolerância, suspensão, renovação, limites e alteração de plano. As alterações são auditadas e não reescrevem contratos já pagos."
      onBack={onBack}
      breadcrumb="Regras Comerciais"
      kpis={kpis}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      {notice && <CommercialMessage tone="success">{notice}</CommercialMessage>}
      {loading || !form ? <CommercialLoading /> : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <form onSubmit={(event) => void save(event)} className="space-y-4 rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-[var(--color-green-800)]" /><h3 className="text-[13px] font-black text-slate-900">Parâmetros comerciais</h3><span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">v{rules?.version ?? 1}</span></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CommercialField label="Desconto anual antecipado (%)" hint="Valor inicial configurado: 15%."><input type="number" min={0} max={100} step={0.5} className={commercialInputClass} value={form.annualDiscountPercent} onChange={(event) => setForm({ ...form, annualDiscountPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} /></CommercialField>
              <CommercialField label="Período de tolerância (dias)"><input type="number" min={0} className={commercialInputClass} value={form.gracePeriodDays} onChange={(event) => setForm({ ...form, gracePeriodDays: Math.max(0, Number(event.target.value) || 0) })} /></CommercialField>
              <CommercialField label="Aviso de renovação (dias)"><input type="number" min={0} className={commercialInputClass} value={form.renewalNoticeDays} onChange={(event) => setForm({ ...form, renewalNoticeDays: Math.max(0, Number(event.target.value) || 0) })} /></CommercialField>
              <CommercialField label="Publicações mensais da regra base" hint="Deve coincidir com a quota dos planos sempre que a regra for transversal."><input type="number" min={0} className={commercialInputClass} value={form.monthlyPostRule} onChange={(event) => setForm({ ...form, monthlyPostRule: Math.max(0, Number(event.target.value) || 0) })} /></CommercialField>
            </div>
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--color-border-default)] bg-slate-50 p-3 text-[10px] font-bold text-slate-700 sm:grid-cols-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoSuspendAfterExpiry} onChange={(event) => setForm({ ...form, autoSuspendAfterExpiry: event.target.checked })} className="h-4 w-4 accent-[#123e3b]" /> Suspender automaticamente após expiração</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoRenewalEnabled} onChange={(event) => setForm({ ...form, autoRenewalEnabled: event.target.checked })} className="h-4 w-4 accent-[#123e3b]" /> Renovação automática permitida</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowPlanChange} onChange={(event) => setForm({ ...form, allowPlanChange: event.target.checked })} className="h-4 w-4 accent-[#123e3b]" /> Permitir alteração de plano</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowExtraPublications} onChange={(event) => setForm({ ...form, allowExtraPublications: event.target.checked })} className="h-4 w-4 accent-[#123e3b]" /> Permitir publicações adicionais</label>
            </div>
            <CommercialField label="Condições de contratação"><textarea className={`${commercialInputClass} min-h-28`} value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></CommercialField>
            <CommercialField label="Motivo da alteração"><input className={commercialInputClass} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Registado na auditoria" /></CommercialField>
            <div className="flex justify-end"><ManagementActionButton type="submit" tone="primary" disabled={busy}>{busy ? 'A guardar…' : 'Guardar regras'}</ManagementActionButton></div>
          </form>
          <aside className="space-y-3">
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 text-[10px] leading-relaxed text-[var(--color-green-800)] shadow-sm">
              <h3 className="flex items-center gap-2 text-[12px] font-black"><ShieldCheck className="h-4 w-4" /> Proteção contratual</h3>
              <p className="mt-1">Uma alteração de regras não modifica assinaturas já pagas. A fotografia contratada inclui preço, funcionalidades, limites, categoria, período e versão.</p>
            </section>
            <section className="rounded-2xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] p-4 text-[10px] leading-relaxed text-amber-950 shadow-sm">
              <h3 className="flex items-center gap-2 text-[12px] font-black"><Info className="h-4 w-4" /> Suspensão e tolerância</h3>
              <p className="mt-1">A suspensão automática só atua depois do período de tolerância. Desligá-la mantém a empresa em consulta até intervenção administrativa.</p>
            </section>
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-white p-4 shadow-sm">
              <h3 className="text-[12px] font-black text-slate-900">Última alteração</h3>
              <p className="mt-1 text-[10px] text-slate-500">{rules?.updatedAt ? formatCommercialDate(rules.updatedAt, true) : 'Sem data'}</p>
              <p className="mt-2 text-[9.5px] text-slate-500">Versão atual v{rules?.version ?? 1}. Consulte o Histórico e Auditoria para ver valor anterior e novo.</p>
            </section>
          </aside>
        </div>
      )}
    </CommercialPageShell>
  );
};
