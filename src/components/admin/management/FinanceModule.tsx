import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Clock, FileText, Receipt, RotateCcw, Scale, Smartphone } from 'lucide-react';
import { ManagementActionButton, ManagementPage, ModuleNav, type ModuleNavItem } from './ManagementUi';
import { FinanceLoading, FinanceMessage } from './FinanceShared';
import { financeFetch, formatFinanceAge, formatXOF, type FinanceSummary, type OperationalAlertsResponse } from './financeApi';

export type FinanceSection = 'transactions' | 'reconciliation' | 'operators' | 'pending' | 'refunds' | 'statements';

interface FinanceModuleProps {
  onOpenSection: (section: FinanceSection) => void;
}

const SECTIONS: ModuleNavItem[] = [
  { key: 'transactions', label: 'Transações', icon: <Receipt className="h-4 w-4" /> },
  { key: 'reconciliation', label: 'Reconciliação', icon: <Scale className="h-4 w-4" /> },
  { key: 'operators', label: 'Operadoras', icon: <Smartphone className="h-4 w-4" /> },
  { key: 'pending', label: 'Pagamentos pendentes', icon: <Clock className="h-4 w-4" /> },
  { key: 'refunds', label: 'Reembolsos e estornos', icon: <RotateCcw className="h-4 w-4" /> },
  { key: 'statements', label: 'Extratos e exportações', icon: <FileText className="h-4 w-4" /> },
];

const OperationalAlertsPanel: React.FC<{
  data: OperationalAlertsResponse | null;
  loading: boolean;
  error: string;
  onOpenSection: (section: FinanceSection) => void;
}> = ({ data, loading, error, onOpenSection }) => {
  const active = (data?.alerts || []).filter((alert) => alert.count > 0);
  return (
    <section aria-labelledby="finance-operational-alerts" className="rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#123e3b] text-white shadow-sm"><BellRing className="h-4 w-4" /></span>
          <div>
            <h3 id="finance-operational-alerts" className="text-[12px] font-black text-slate-900">Alertas operacionais</h3>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-600">
              Divergências de reconciliação e pagamentos pendentes há mais de 48 horas, calculados em tempo real a partir da base de dados.
            </p>
          </div>
        </div>
        {data && active.length > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[9px] font-black text-rose-800">
            {data.totals.affectedItems} item(ns) · {formatXOF(data.totals.amountXOF)}
          </span>
        )}
      </div>

      {error && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[10px] font-bold text-rose-900">{error}</div>}
      {loading ? (
        <p className="mt-3 text-[10px] font-bold text-slate-500">A calcular alertas operacionais…</p>
      ) : !error && active.length === 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[10px] text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span><strong className="font-black">Sem alertas operacionais.</strong> Não existem divergências de reconciliação nem pagamentos pendentes acima de 48 horas.</span>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2.5 xl:grid-cols-2">
          {active.map((alert) => {
            const critical = alert.severity === 'critical';
            return (
              <article key={alert.id} className={`rounded-xl border p-3 ${critical ? 'border-rose-200 bg-rose-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${critical ? 'text-rose-700' : 'text-amber-700'}`} />
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900">{alert.title}</h4>
                      <p className="mt-0.5 text-[9.5px] leading-relaxed text-slate-600">{alert.description}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[8.5px] font-black ${critical ? 'border-rose-300 bg-white text-rose-800' : 'border-amber-300 bg-white text-amber-800'}`}>
                    {alert.count} {alert.count === 1 ? 'ocorrência' : 'ocorrências'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
                  <span className="font-bold text-slate-600">Valor afetado: <strong className="font-black text-slate-900">{formatXOF(alert.amountXOF)}</strong></span>
                  {alert.thresholdHours != null && <span className="font-bold text-slate-500">Limite: {alert.thresholdHours} h</span>}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {alert.items.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white bg-white/80 px-2.5 py-1.5 text-[9.5px]">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-black text-slate-800">
                          {item.payerName} <span className="font-mono text-[8.5px] font-bold text-slate-400">{item.transactionId}</span>
                        </div>
                        <div className="text-slate-500">{item.providerLabel} · {item.statusLabel} · há {formatFinanceAge(item.ageHours)}</div>
                      </div>
                      <div className="text-right">
                        <div className="whitespace-nowrap font-black tabular-nums text-slate-900">{formatXOF(item.amountXOF)}</div>
                        {item.divergenceXOF != null && <div className="font-bold text-rose-700">Desvio: {formatXOF(item.divergenceXOF)}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
                {alert.count > 3 && <p className="mt-1 text-[9px] font-bold text-slate-500">e mais {alert.count - 3} item(ns) na página de detalhe.</p>}
                <div className="mt-2.5 flex justify-end">
                  <ManagementActionButton tone={critical ? 'danger' : 'warning'} onClick={() => onOpenSection(alert.target)}>
                    {alert.target === 'reconciliation' ? 'Analisar divergências' : 'Regularizar pagamentos em atraso'} <ArrowRight className="h-3.5 w-3.5" />
                  </ManagementActionButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const FinanceModule: React.FC<FinanceModuleProps> = ({ onOpenSection }) => {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState<OperationalAlertsResponse | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    financeFetch<FinanceSummary>('/api/admin/finance/summary')
      .then((data) => { if (!cancelled) { setSummary(data); setError(''); } })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAlertsLoading(true);
    financeFetch<OperationalAlertsResponse>('/api/admin/finance/alerts')
      .then((data) => { if (!cancelled) { setAlerts(data); setAlertsError(''); } })
      .catch((reason: Error) => { if (!cancelled) setAlertsError(reason.message); })
      .finally(() => { if (!cancelled) setAlertsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const platform = summary?.platform;
  const kpis = [
    { label: 'Volume financeiro registado', value: formatXOF(platform?.volumeXOF), hint: `${platform?.transactionCount ?? 0} transações de plataforma`, tone: 'border-[#cfe2df] bg-[#f3faf8] text-[#123e3b]' },
    { label: 'Pagamentos confirmados', value: String(platform?.confirmedCount ?? '—'), hint: `${formatXOF(platform?.confirmedXOF)} · apenas reais`, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Pagamentos pendentes', value: String(platform?.pendingCount ?? '—'), hint: formatXOF(platform?.pendingXOF), tone: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Total reconciliado', value: formatXOF(platform?.reconciledXOF), hint: `${platform?.reconciledCount ?? 0} pagamentos`, tone: 'border-sky-200 bg-sky-50 text-sky-900' },
    { label: 'Reembolsos efetuados', value: formatXOF(platform?.refundsProcessedXOF), hint: `${platform?.refundsProcessedCount ?? 0} processos concluídos`, tone: 'border-violet-200 bg-violet-50 text-violet-900' },
    { label: 'Número de transações', value: String(platform?.transactionCount ?? '—'), hint: 'Receita de bilhetes excluída', tone: 'border-slate-200 bg-white text-slate-900' },
  ];

  return (
    <ManagementPage
      title="Financeiro"
      description="Indicadores e operações financeiras da plataforma."
      moduleLabel="Financeiro"
      breadcrumbTail="Módulo"
    >
      {error && <FinanceMessage tone="error">{error}</FinanceMessage>}

      <ModuleNav
        items={SECTIONS}
        onSelect={(key) => onOpenSection(key as FinanceSection)}
        ariaLabel="Submódulos financeiros"
      />

      {loading ? (
        <FinanceLoading />
      ) : (
        <>
          <OperationalAlertsPanel data={alerts} loading={alertsLoading} error={alertsError} onOpenSection={onOpenSection} />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`rounded-2xl border p-3.5 shadow-sm ${kpi.tone}`}>
                <div className="text-[9px] font-black uppercase tracking-[0.15em] opacity-70">{kpi.label}</div>
                <div className="mt-1.5 text-[19px] font-black leading-tight tabular-nums">{kpi.value}</div>
                <div className="mt-1 text-[9.5px] font-medium opacity-70">{kpi.hint}</div>
              </div>
            ))}
          </div>



        </>
      )}
    </ManagementPage>
  );
};
