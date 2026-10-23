import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Star, X } from 'lucide-react';
import type { Business } from '../../types';

interface FeaturedBusinessesAdminProps {
  businesses: Business[];
  onUpdateBusinesses?: (businesses: Business[]) => void;
}

function getFeaturedBusinessIds(businesses: Business[]): string[] {
  return businesses
    .filter((business) => business.status === 'active'
      && typeof business.homepageFeaturedOrder === 'number'
      && Number.isInteger(business.homepageFeaturedOrder)
      && business.homepageFeaturedOrder >= 0)
    .sort((left, right) => left.homepageFeaturedOrder! - right.homepageFeaturedOrder!)
    .map((business) => business.id);
}

export const FeaturedBusinessesAdmin: React.FC<FeaturedBusinessesAdminProps> = ({ businesses, onUpdateBusinesses }) => {
  const [orderedIds, setOrderedIds] = useState(() => getFeaturedBusinessIds(businesses));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const activeBusinesses = useMemo(() => businesses.filter((business) => business.status === 'active'), [businesses]);
  const activeBusinessesById = useMemo(() => new Map(activeBusinesses.map((business) => [business.id, business])), [activeBusinesses]);
  const orderedBusinesses = orderedIds
    .map((id) => activeBusinessesById.get(id))
    .filter((business): business is Business => Boolean(business));

  useEffect(() => {
    setOrderedIds(getFeaturedBusinessIds(businesses));
  }, [businesses]);

  const toggleBusiness = (businessId: string, selected: boolean) => {
    setOrderedIds((current) => selected
      ? [...current, businessId]
      : current.filter((id) => id !== businessId));
    setSaveError(null);
  };

  const moveBusiness = (businessId: string, offset: -1 | 1) => {
    setOrderedIds((current) => {
      const index = current.indexOf(businessId);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setSaveError(null);
  };

  const saveOrder = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/api/admin/businesses/featured', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds: orderedBusinesses.map((business) => business.id) }),
      });
      const result: { success?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Não foi possível guardar a ordem das empresas em destaque.');
      }

      const orderById = new Map(orderedBusinesses.map((business, index) => [business.id, index]));
      onUpdateBusinesses?.(businesses.map((business) => ({
        ...business,
        homepageFeaturedOrder: orderById.get(business.id) ?? null,
      })));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível guardar a ordem das empresas em destaque.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-labelledby="featured-businesses-admin-title" className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-start gap-3">
        <Star aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h4 id="featured-businesses-admin-title" className="text-sm font-black text-slate-900">Empresas em destaque na página inicial</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Selecione empresas ativas e organize a ordem apresentada. A seleção é independente do plano e do destaque legado.
          </p>
        </div>
      </div>

      <fieldset disabled={isSaving} className="space-y-2">
        <legend className="mb-2 text-xs font-bold text-slate-700">Empresas ativas disponíveis</legend>
        {activeBusinesses.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">Não existem empresas ativas para selecionar.</p>
        ) : (
          activeBusinesses.map((business) => (
            <label key={business.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
              <input
                type="checkbox"
                aria-label={`Selecionar ${business.name}`}
                checked={orderedIds.includes(business.id)}
                onChange={(event) => toggleBusiness(business.id, event.target.checked)}
                className="h-4 w-4 accent-amber-600"
              />
              <span>{business.name}</span>
            </label>
          ))
        )}
      </fieldset>

      <div>
        <h5 className="mb-2 text-xs font-bold text-slate-700">Ordem publicada</h5>
        {orderedBusinesses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-xs text-slate-500">Ainda não há empresas selecionadas.</p>
        ) : (
          <ol aria-label="Ordem das empresas em destaque" className="space-y-2">
            {orderedBusinesses.map((business, index) => (
              <li key={business.id} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{index + 1}. {business.name}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Mover ${business.name} para cima`}
                    disabled={isSaving || index === 0}
                    onClick={() => moveBusiness(business.id, -1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover ${business.name} para baixo`}
                    disabled={isSaving || index === orderedBusinesses.length - 1}
                    onClick={() => moveBusiness(business.id, 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${business.name}`}
                    disabled={isSaving}
                    onClick={() => toggleBusiness(business.id, false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {saveError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saveError}</p>}
      <button
        type="button"
        onClick={() => void saveOrder()}
        disabled={isSaving}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
      >
        {isSaving ? 'A guardar...' : 'Guardar ordem'}
      </button>
    </section>
  );
};
