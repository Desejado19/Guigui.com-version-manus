import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ManagementActionButton, ManagementKpiGrid, ManagementPage, type ManagementKpi } from './ManagementUi';

interface ModuleSummaryPageProps {
  title: string;
  description: string;
  moduleLabel: string;
  kpis?: ManagementKpi[];
  openLabel: string;
  onOpen: () => void;
  secondaryAction?: { label: string; onClick: () => void };
  note?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Página inicial de um módulo de gestão: título, descrição, indicadores e um
 * botão que abre a lista completa numa página independente.
 */
export const ModuleSummaryPage: React.FC<ModuleSummaryPageProps> = ({
  title,
  description,
  moduleLabel,
  kpis,
  openLabel,
  onOpen,
  secondaryAction,
  note,
  children,
}) => (
  <ManagementPage
    title={title}
    description={description}
    moduleLabel={moduleLabel}
    breadcrumbTail="Resumo"
  >
    {kpis && kpis.length > 0 && <ManagementKpiGrid items={kpis} />}

    <section className="flex flex-col justify-between gap-4 rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div>
        <h3 className="text-[13px] font-black text-slate-900">Área de gestão dedicada</h3>
        <p className="mt-1 max-w-2xl text-[10.5px] leading-relaxed text-slate-600">
          Pesquisa, filtros, ordenação, paginação, exportação e ações contextuais ficam numa página própria, para não sobrecarregar este resumo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {secondaryAction && (
          <ManagementActionButton onClick={secondaryAction.onClick}>{secondaryAction.label}</ManagementActionButton>
        )}
        <ManagementActionButton tone="primary" onClick={onOpen}>
          {openLabel} <ArrowRight className="h-3.5 w-3.5" />
        </ManagementActionButton>
      </div>
    </section>

    {children}

    {note && (
      <section className="rounded-2xl border border-[#e6dac8] bg-white p-4 text-[10.5px] leading-relaxed text-slate-600 shadow-sm">
        {note}
      </section>
    )}
  </ManagementPage>
);
