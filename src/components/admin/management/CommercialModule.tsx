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
    { label: 'Receita registada', value: formatCommercialXOF(summary?.revenueXOF), hint: `${summary?.paymentCount ?? 0} pagamentos confirmados`, tone: 'border-[#cfe2df] bg-[#f3faf8] text-[#123e3b]' },
    { label: 'Assinaturas ativas', value: String(summary?.activeSubscriptions ?? '—'), hint: 'Contratos válidos', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Assinaturas pendentes', value: String(summary?.pendingSubscriptions ?? '—'), hint: 'A aguardar ativação', tone: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Assinaturas expiradas', value: String(summary?.expiredSubscriptions ?? '—'), hint: `${summary?.suspendedSubscriptions ?? 0} suspensas`, tone: 'border-rose-200 bg-rose-50 text-rose-900' },
    { label: 'Planos ativos', value: String(summary?.activePlans ?? '—'), hint: 'Catálogo comercial', tone: 'border-sky-200 bg-sky-50 text-sky-900' },
    { label: 'Produtos ativos', value: String(summary?.activeProducts ?? '—'), hint: 'Extras e pacotes', tone: 'border-violet-200 bg-violet-50 text-violet-900' },
  ];

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
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6dac8] bg-white px-3 py-1.5 text-[10px] font-black text-[#123e3b] shadow-sm transition hover:bg-[#f7f2ec]"
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
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
