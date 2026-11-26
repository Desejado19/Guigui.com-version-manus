import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, GripVertical, Plus, Save, Star, X } from 'lucide-react';
import type { Business } from '../../../types';
import { matchesSearch, paginateItems, useManagementListState } from './managementState';
import {
  ManagementActionButton,
  ManagementCard,
  ManagementFilter,
  ManagementPage,
  ManagementPagination,
  ManagementToolbar,
} from './ManagementUi';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';
import { locationMatches } from '../../../../shared/bissauLocations';

interface FeaturedBusinessesManagementPageProps {
  businesses: Business[];
  onBack: () => void;
  onBusinessesChanged: (businesses: Business[]) => void;
}

function getFeaturedIds(businesses: Business[]): string[] {
  return businesses
    .filter((business) => typeof business.homepageFeaturedOrder === 'number'
      && Number.isInteger(business.homepageFeaturedOrder)
      && business.homepageFeaturedOrder >= 0)
    .sort((left, right) => (left.homepageFeaturedOrder ?? 0) - (right.homepageFeaturedOrder ?? 0))
    .map((business) => business.id);
}

function getPublishedActiveIds(businesses: Business[]): string[] {
  return businesses
    .filter((business) => business.status === 'active'
      && typeof business.homepageFeaturedOrder === 'number'
      && Number.isInteger(business.homepageFeaturedOrder)
      && business.homepageFeaturedOrder >= 0)
    .sort((left, right) => (left.homepageFeaturedOrder ?? 0) - (right.homepageFeaturedOrder ?? 0))
    .map((business) => business.id);
}

type AvailableFilterKey = 'category' | 'location';

export const FeaturedBusinessesManagementPage: React.FC<FeaturedBusinessesManagementPageProps> = ({
  businesses,
  onBack,
  onBusinessesChanged,
}) => {
  const [orderedIds, setOrderedIds] = useState<string[]>(() => getFeaturedIds(businesses));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { state, setQuery, setFilter, setPage, setPageSize, reset } = useManagementListState<AvailableFilterKey>(
    'admin.management.featured.available',
    { category: 'all', location: 'all' },
    'name',
    'asc',
  );

  useEffect(() => {
    setOrderedIds(getFeaturedIds(businesses));
  }, [businesses]);

  const businessesById = useMemo(() => new Map(businesses.map((business) => [business.id, business])), [businesses]);
  const selectedBusinesses = orderedIds
    .map((id) => businessesById.get(id))
    .filter((business): business is Business => Boolean(business));
  const selectedActiveIds = selectedBusinesses.filter((business) => business.status === 'active').map((business) => business.id);
  const publishedActiveIds = useMemo(() => getPublishedActiveIds(businesses), [businesses]);
  const isDirty = selectedActiveIds.join('|') !== publishedActiveIds.join('|');

  const categories = useMemo(
    () => [...new Set(businesses.map((business) => business.category || business.categoryId).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt')),
    [businesses],
  );
  const { locations: catalogLocations } = useLocationCatalog();
  const locations = useMemo(() => {
    const fromData = businesses.map((business) => business.neighborhood).filter(Boolean);
    return Array.from(new Set([...catalogLocations.map((entry) => entry.name), ...fromData])).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [businesses, catalogLocations]);

  const availableBusinesses = useMemo(() => {
    return businesses
      .filter((business) => business.status === 'active' && !orderedIds.includes(business.id))
      .filter((business) => matchesSearch(state.query, [business.name, business.category, business.categoryId, business.neighborhood, business.id]))
      .filter((business) => state.filters.category === 'all' || (business.category || business.categoryId) === state.filters.category)
      .filter((business) => state.filters.location === 'all' || locationMatches(business.neighborhood, state.filters.location))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt'));
  }, [businesses, orderedIds, state.filters, state.query]);

  const availablePage = paginateItems(availableBusinesses, state.page, state.pageSize);

  const addBusiness = (businessId: string) => {
    setOrderedIds((current) => (current.includes(businessId) ? current : [...current, businessId]));
    setFeedback(null);
  };

  const removeBusiness = (businessId: string) => {
    setOrderedIds((current) => current.filter((id) => id !== businessId));
    setFeedback(null);
  };

  const moveBusiness = (businessId: string, offset: -1 | 1) => {
    setOrderedIds((current) => {
      const index = current.indexOf(businessId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setFeedback(null);
  };

  const dropOn = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    setOrderedIds((current) => {
      const from = current.indexOf(draggingId);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggingId);
      return next;
    });
    setDraggingId(null);
    setFeedback(null);
  };

  const saveOrder = async () => {
    if (!isDirty) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/businesses/featured', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds: selectedActiveIds }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Não foi possível guardar a ordem das empresas em destaque.');
      }

      const orderById = new Map(selectedActiveIds.map((id, index) => [id, index]));
      onBusinessesChanged(businesses.map((business) => {
        if (business.status !== 'active') return business;
        return { ...business, homepageFeaturedOrder: orderById.get(business.id) ?? null };
      }));
      setFeedback({ tone: 'success', message: 'Ordem guardada e publicada na página inicial.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Falha ao guardar a ordem.' });
    } finally {
      setIsSaving(false);
    }
  };

  const publishedBusinesses = publishedActiveIds
    .map((id) => businessesById.get(id))
    .filter((business): business is Business => Boolean(business));

  return (
    <ManagementPage
      title="Gestão de empresas em destaque"
      description="Escolha apenas empresas ativas, organize a ordem por arrastar e largar e guarde. Empresas suspensas mantêm a configuração guardada mas deixam de aparecer publicamente."
      moduleLabel="Empresas & Negócios"
      onBack={onBack}
      kpis={[
        { label: 'Selecionadas', value: selectedBusinesses.length, tone: 'info' },
        { label: 'Ativas disponíveis', value: businesses.filter((business) => business.status === 'active').length, tone: 'success' },
        { label: 'Ordem publicada', value: publishedBusinesses.length, tone: 'neutral' },
        { label: 'Alterações por guardar', value: isDirty ? 'Sim' : 'Não', tone: isDirty ? 'warning' : 'success' },
      ]}
      actions={
        <>
          <ManagementActionButton onClick={() => setPreviewOpen(true)}><Eye className="h-3.5 w-3.5" /> Pré-visualizar</ManagementActionButton>
          <ManagementActionButton tone="primary" onClick={() => void saveOrder()} disabled={isSaving || !isDirty}>
            <Save className="h-3.5 w-3.5" /> {isSaving ? 'A guardar…' : 'Guardar ordem'}
          </ManagementActionButton>
        </>
      }
    >
      {feedback && (
        <div role="status" className={`rounded-xl border px-3.5 py-2.5 text-[11px] font-bold ${feedback.tone === 'success' ? 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'}`}>
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ManagementCard title="Empresas disponíveis" description="Apenas empresas ativas podem ser adicionadas. A seleção é independente do plano comercial e do destaque legado.">
          <ManagementToolbar
            query={state.query}
            onQueryChange={setQuery}
            placeholder="Pesquisar empresas ativas por nome…"
            totalLabel={`${availableBusinesses.length} empresa(s) disponível(is)`}
            onReset={reset}
          >
            <ManagementFilter label="Categoria" value={state.filters.category} onChange={(value) => setFilter('category', value)} options={[
              { value: 'all', label: 'Todas' },
              ...categories.map((category) => ({ value: category, label: category })),
            ]} />
            <ManagementFilter label="Localização" value={state.filters.location} onChange={(value) => setFilter('location', value)} options={[
              { value: 'all', label: 'Todas' },
              ...locations.map((location) => ({ value: location, label: location })),
            ]} />
          </ManagementToolbar>

          <div className="divide-y divide-[var(--color-border-subtle)]">
            {availablePage.items.length === 0 ? (
              <p className="py-6 text-center text-[11px] font-medium text-slate-500">Nenhuma empresa ativa disponível com os filtros atuais.</p>
            ) : (
              availablePage.items.map((business) => (
                <div key={business.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {business.logo ? (
                      <img src={business.logo} alt="" className="h-8 w-8 rounded-lg border border-[var(--color-border-default)] object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-500">{business.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-black text-slate-900">{business.name}</div>
                      <div className="truncate text-[9.5px] text-slate-500">{business.category || business.categoryId} · {business.neighborhood}</div>
                    </div>
                  </div>
                  <ManagementActionButton
                    tone="success"
                    onClick={() => addBusiness(business.id)}
                    disabled={orderedIds.includes(business.id)}
                    title={orderedIds.includes(business.id) ? 'Já está nos destaques' : 'Adicionar aos destaques'}
                  >
                    <Plus className="h-3.5 w-3.5" /> {orderedIds.includes(business.id) ? 'Adicionada' : 'Adicionar'}
                  </ManagementActionButton>
                </div>
              ))
            )}
          </div>

          <ManagementPagination
            page={availablePage.page}
            pageSize={state.pageSize}
            totalItems={availablePage.totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </ManagementCard>

        <ManagementCard title="Empresas selecionadas" description="Arraste para reordenar ou use as setas. A posição 1 é a primeira empresa apresentada na página inicial.">
          {selectedBusinesses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[11px] font-medium text-slate-500">
              Ainda não há empresas selecionadas para destaque.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {selectedBusinesses.map((business, index) => {
                const isActive = business.status === 'active';
                const position = selectedActiveIds.indexOf(business.id);
                return (
                  <li
                    key={business.id}
                    draggable
                    onDragStart={() => setDraggingId(business.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropOn(business.id)}
                    className={`flex items-center gap-2 rounded-xl border bg-white p-2 transition ${draggingId === business.id ? 'border-[var(--color-green-700)] opacity-60' : 'border-[var(--color-border-default)]'} ${isActive ? '' : 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)]/50'}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#123e3b] text-[10px] font-black text-white">
                      {isActive ? position + 1 : '—'}
                    </span>
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" aria-hidden="true" />
                    {business.logo ? (
                      <img src={business.logo} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-[var(--color-border-default)] object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-500">{business.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-black text-slate-900">{business.name}</div>
                      <div className="truncate text-[9.5px] text-slate-500">
                        {business.category || business.categoryId} · {business.neighborhood}
                        {!isActive && <span className="ml-1.5 rounded-full bg-[var(--tone-danger-bg)] px-1.5 py-0.5 text-[8px] font-black uppercase text-[var(--tone-danger-text)]">Suspensa — não publicada</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => moveBusiness(business.id, -1)} disabled={index === 0} aria-label={`Mover ${business.name} para cima`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => moveBusiness(business.id, 1)} disabled={index === selectedBusinesses.length - 1} aria-label={`Mover ${business.name} para baixo`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => removeBusiness(business.id)} aria-label={`Remover ${business.name}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--tone-danger-text)] hover:bg-[var(--tone-danger-bg)]">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3 text-[10px] leading-relaxed text-slate-600">
            <div className="flex items-center gap-1.5 font-black text-slate-800"><Star className="h-3.5 w-3.5 text-amber-600" /> Ordem atualmente publicada</div>
            {publishedBusinesses.length === 0 ? (
              <p className="mt-1">Ainda não existe ordem publicada.</p>
            ) : (
              <p className="mt-1">{publishedBusinesses.map((business, index) => `${index + 1}. ${business.name}`).join(' · ')}</p>
            )}
          </div>
        </ManagementCard>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4" role="dialog" aria-modal="true" aria-label="Pré-visualização das empresas em destaque">
          <div className="my-6 w-full max-w-4xl rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] bg-white p-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Pré-visualização — Empresas em destaque</h3>
                <p className="text-[10px] text-slate-500">Assim aparecerão as empresas ativas na página inicial, pela ordem atual por guardar.</p>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fechar pré-visualização">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedBusinesses.filter((business) => business.status === 'active').map((business, index) => (
                <div key={business.id} className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-white shadow-sm">
                  <div className="h-20 bg-[var(--color-bg-subtle)]">
                    {business.coverImage ? <img src={business.coverImage} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="-mt-6 px-3 pb-3">
                    {business.logo ? (
                      <img src={business.logo} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-[#123e3b] text-[11px] font-black text-white">{business.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-[var(--tone-warning-text)]">#{index + 1}</span>
                      <span className="truncate text-[11px] font-black text-slate-900">{business.name}</span>
                    </div>
                    <div className="truncate text-[9.5px] text-slate-500">{business.category || business.categoryId} · {business.neighborhood}</div>
                  </div>
                </div>
              ))}
              {selectedBusinesses.filter((business) => business.status === 'active').length === 0 && (
                <p className="col-span-full py-8 text-center text-[11px] font-medium text-slate-500">Sem empresas ativas selecionadas para pré-visualizar.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </ManagementPage>
  );
};
