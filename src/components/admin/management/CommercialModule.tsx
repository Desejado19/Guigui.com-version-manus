import React, { useEffect, useState } from 'react';
import {
  BadgePercent,
  Boxes,
  CreditCard,
  History,
  Layers3,
  ReceiptText,
  SlidersHorizontal,
  Ticket,
  TriangleAlert,
} from 'lucide-react';
import { ManagementPage, ModuleNav, type ModuleNavItem } from './ManagementUi';
import { CommercialLoading, CommercialMessage } from './CommercialShared';
import {
  commercialRequest,
  formatCommercialXOF,
  type CommercialOverview,
  type CommercialSection,
} from './commercialApi';

interface CommercialModuleProps {
  onOpenSection: (section: CommercialSection) => void;
}

const SECTIONS: ModuleNavItem[] = [
  { key: 'plans', label: 'Planos', icon: <Layers3 className="h-4 w-4" /> },
  { key: 'subscriptions', label: 'Assinaturas', icon: <ReceiptText className="h-4 w-4" /> },
  { key: 'features', label: 'Funcionalidades e limites', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { key: 'pricing', label: 'Matriz de preços', icon: <BadgePercent className="h-4 w-4" /> },
  { key: 'products', label: 'Produtos, extras e pacotes', icon: <Boxes className="h-4 w-4" /> },
  { key: 'ticket-fees', label: 'Taxas de bilheteira', icon: <Ticket className="h-4 w-4" /> },
  { key: 'rules', label: 'Regras comerciais', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'audit', label: 'Histórico e auditoria', icon: <History className="h-4 w-4" /> },
];

export const CommercialModule: React.FC<CommercialModuleProps> = ({ onOpenSection }) => {
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    commercialRequest<CommercialOverview>('/api/admin/commercial/overview')
      .then((data) => { if (!cancelled) { setOverview(data); setError(''); } })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const summary = overview?.summary;
  const kpis = [
    { label: 'Receita registada', value: formatCommercialXOF(summary?.revenueXOF), hint: `${summary?.paymentCount ?? 0} pagamentos confirmados`, tone: 'border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-[var(--color-green-800)]' },
    { label: 'Assinaturas ativas', value: String(summary?.activeSubscriptions ?? '—'), hint: 'Contratos válidos', tone: 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' },
    { label: 'Assinaturas pendentes', value: String(summary?.pendingSubscriptions ?? '—'), hint: 'A aguardar ativação', tone: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]' },
    { label: 'Assinaturas expiradas', value: String(summary?.expiredSubscriptions ?? '—'), hint: `${summary?.suspendedSubscriptions ?? 0} suspensas`, tone: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]' },
    { label: 'Planos ativos', value: String(summary?.activePlans ?? '—'), hint: 'Catálogo comercial', tone: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]' },
    { label: 'Produtos ativos', value: String(summary?.activeProducts ?? '—'), hint: 'Extras e pacotes', tone: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]' },
    { label: 'A expirar em 30 dias', value: String(summary?.expiringSubscriptions ?? 0), hint: 'Renovações a acompanhar', tone: 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]' },
    { label: 'Assinaturas em alerta', value: String(summary?.usageAlertSubscriptions ?? 0), hint: 'Uso acima de 90% do limite', tone: 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]' },
  ];
  const usageAlerts = overview?.usageAlerts || [];

  return (
    <ManagementPage
      title="Planos & Assinaturas"
      description="Catálogo comercial e contratos das empresas."
      moduleLabel="Planos & Assinaturas"
      breadcrumbTail="Módulo"
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}

      <ModuleNav
        items={SECTIONS}
        onSelect={(key) => onOpenSection(key as CommercialSection)}
        ariaLabel="Submódulos comerciais"
      />

      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'features', label: 'Configurar funcionalidades', icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
          { key: 'products', label: 'Gerir produtos e pacotes', icon: <Boxes className="h-3.5 w-3.5" /> },
          { key: 'ticket-fees', label: 'Configurar taxas', icon: <Ticket className="h-3.5 w-3.5" /> },
          { key: 'audit', label: 'Consultar auditoria', icon: <History className="h-3.5 w-3.5" /> },
        ].map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => onOpenSection(action.key as CommercialSection)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-1.5 text-[10px] font-black text-[var(--color-green-800)] shadow-sm transition hover:bg-[var(--color-bg-subtle)]"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {loading ? (
        <CommercialLoading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-8">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`rounded-2xl border p-3.5 shadow-sm ${kpi.tone}`}>
                <div className="text-[9px] font-black uppercase tracking-[0.15em] opacity-70">{kpi.label}</div>
                <div className="mt-1.5 text-[19px] font-black leading-tight tabular-nums">{kpi.value}</div>
                <div className="mt-1 text-[9.5px] font-medium opacity-70">{kpi.hint}</div>
              </div>
            ))}
          </div>

          {usageAlerts.length > 0 && (
            <div className="rounded-2xl border border-[var(--tone-warning-border)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-800"><TriangleAlert className="h-3.5 w-3.5 text-[var(--tone-warning-text)]" /> Alertas de utilização</div>
                <button type="button" onClick={() => onOpenSection('subscriptions')} className="text-[10px] font-black text-[var(--color-green-800)] underline decoration-dotted">Ver assinaturas</button>
              </div>
              <div className="mt-2 divide-y divide-[var(--color-border-subtle)] text-[10.5px]">
                {usageAlerts.map((alert) => (
                  <div key={`${alert.subscriptionId}-${alert.code}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0"><strong className="text-slate-900">{alert.companyName}</strong><span className="text-slate-500"> · {alert.code} · {alert.message}</span></div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${alert.severity === 'critical' ? 'bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]' : 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]'}`}>{alert.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </ManagementPage>
  );
};
