import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Star,
  Store,
  X,
} from 'lucide-react';
import type { Business, BusinessCategory, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { useLocationCatalog } from '../hooks/useLocationCatalog';
import { locationMatches } from '../../shared/bissauLocations';

interface BusinessMapViewProps {
  businesses: Business[];
  categories?: BusinessCategory[];
  currentLang: Language;
  onSelectBusiness: (business: Business) => void;
  onViewDirectory: () => void;
  onDirections?: (business: Business) => void;
}

type SortMode = 'relevance' | 'name' | 'rating';

const collator = new Intl.Collator('pt', { sensitivity: 'base' });

const zoneOf = (business: Business): string => business.neighborhood.trim() || 'Sem zona';

const categoryOf = (business: Business, categories: BusinessCategory[]): string =>
  business.category?.trim()
  || categories.find((category) => category.id === business.categoryId)?.name
  || business.subcategoryId.replace(/_/g, ' ')
  || 'Serviço';

const initialsOf = (business: Business): string =>
  business.name
    .trim()
    .split(/\s+/)
    .filter((part) => /^[\p{L}\p{N}]/u.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const directionsUrl = (business: Business): string =>
  `https://maps.google.com/?q=${encodeURIComponent(
    [business.address, business.neighborhood, 'Bissau Guinea-Bissau'].filter(Boolean).join(' ')
  )}`;

const sortBusinesses = (items: Business[], mode: SortMode): Business[] => {
  const sorted = [...items];
  if (mode === 'name') return sorted.sort((left, right) => collator.compare(left.name, right.name));
  if (mode === 'rating') {
    return sorted.sort((left, right) => (right.rating || 0) - (left.rating || 0) || right.reviewsCount - left.reviewsCount);
  }
  return sorted.sort((left, right) =>
    Number(right.featured) - Number(left.featured)
    || Number(right.verified) - Number(left.verified)
    || Number(right.isOpenNow) - Number(left.isOpenNow)
    || right.reviewsCount - left.reviewsCount
    || collator.compare(left.name, right.name)
  );
};

export const BusinessMapView: React.FC<BusinessMapViewProps> = ({
  businesses,
  categories = [],
  currentLang,
  onSelectBusiness,
  onViewDirectory,
  onDirections,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [search, setSearch] = useState('');
  const [neighborhood, setNeighborhood] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { locations: bissauLocations } = useLocationCatalog();

  const activeBusinesses = useMemo(
    () => businesses.filter((business) => business.status === 'active'),
    [businesses]
  );

  const neighborhoodOptions = useMemo(() => {
    const catalogNames = bissauLocations.map((entry) => entry.name);
    const legacyNames = activeBusinesses
      .map(zoneOf)
      .filter((name) => name && name !== 'Sem zona' && !catalogNames.some((catalogName) => locationMatches(name, catalogName)));
    return Array.from(new Set([...catalogNames, ...legacyNames])).sort(collator.compare);
  }, [activeBusinesses, bissauLocations]);

  const categoryOptions = useMemo(
    () => categories
      .filter((category) => activeBusinesses.some((business) => business.categoryId === category.id))
      .sort((left, right) => collator.compare(left.name, right.name)),
    [activeBusinesses, categories]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeBusinesses.filter((business) => {
      if (neighborhood !== 'all' && !locationMatches(zoneOf(business), neighborhood)) return false;
      if (categoryId !== 'all' && business.categoryId !== categoryId) return false;
      if (onlyOpen && !business.isOpenNow) return false;
      if (!query) return true;
      return [
        business.name,
        business.description,
        business.neighborhood,
        business.address,
        business.subcategoryId,
        business.category || '',
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [activeBusinesses, categoryId, neighborhood, onlyOpen, search]);

  const sorted = useMemo(() => sortBusinesses(filtered, sortMode), [filtered, sortMode]);

  const zones = useMemo(() => {
    const grouped = new Map<string, Business[]>();
    sorted.forEach((business) => {
      const zone = zoneOf(business);
      grouped.set(zone, [...(grouped.get(zone) || []), business]);
    });
    return Array.from(grouped.entries()).sort(([left], [right]) => collator.compare(left, right));
  }, [sorted]);

  const selected = useMemo(
    () => sorted.find((business) => business.id === selectedId) || null,
    [selectedId, sorted]
  );

  const hasFilters = Boolean(search.trim()) || neighborhood !== 'all' || categoryId !== 'all' || onlyOpen;
  const verifiedCount = sorted.filter((business) => business.verified).length;

  const resetFilters = () => {
    setSearch('');
    setNeighborhood('all');
    setCategoryId('all');
    setOnlyOpen(false);
    setSortMode('relevance');
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
              <MapPin className="h-3 w-3" />
              Mapa de empresas
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Empresas e serviços por zona</h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-emerald-100/85">
              Pesquise, filtre por bairro e explore os negócios de Bissau. Selecione um local para ver a morada,
              o horário e abrir as direções.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewDirectory}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-white/20"
          >
            <Store className="h-4 w-4" />
            Ver diretório completo
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-lg">
          {[
            { label: 'Locais', value: sorted.length },
            { label: 'Zonas', value: zones.length },
            { label: 'Verificados', value: verifiedCount },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5">
              <p className="font-mono text-xl font-black leading-none">{stat.value}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100/75">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--color-border-subtle)] bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_190px_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Pesquisar empresas no mapa</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`${t('search')} por nome, serviço ou bairro`}
              className="h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 pl-9 pr-9 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                aria-label="Limpar pesquisa"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <label className="relative block">
            <span className="sr-only">{t('neighborhood')}</span>
            <select
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Todos os bairros</option>
              {neighborhoodOptions.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
            <MapPin className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </label>

          <label className="relative block">
            <span className="sr-only">Categoria</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Todas as categorias</option>
              {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <Filter className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </label>

          <button
            type="button"
            onClick={() => setOnlyOpen((value) => !value)}
            aria-pressed={onlyOpen}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
              onlyOpen
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-[var(--color-border-subtle)] bg-slate-50 text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Clock3 className="h-3.5 w-3.5" />
            Abertos agora
          </button>

          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Ordenar empresas</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-11 w-full appearance-none rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="relevance">Relevância</option>
                <option value="name">Nome A–Z</option>
                <option value="rating">Melhor avaliação</option>
              </select>
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--color-border-subtle)] px-3 text-[11px] font-black text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/30"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </button>
            )}
          </div>
        </div>
      </section>

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--color-border-default)] bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 dark:bg-slate-800">
            <MapPin className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-sm font-black text-slate-900 dark:text-white">Nenhuma empresa nesta vista</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-300">
            Ajuste a pesquisa ou os filtros para voltar a ver os locais disponíveis.
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <aside className="order-2 overflow-hidden rounded-3xl border border-[var(--color-border-subtle)] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:order-1">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">Locais encontrados</h2>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {sorted.length} {sorted.length === 1 ? 'resultado' : 'resultados'} em {zones.length} {zones.length === 1 ? 'zona' : 'zonas'}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {filtered.length} de {activeBusinesses.length}
              </span>
            </div>

            <div className="max-h-[680px] space-y-4 overflow-y-auto overscroll-contain p-3">
              {zones.map(([zone, zoneBusinesses]) => (
                <section key={zone}>
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-lg bg-white px-1 py-1.5 dark:bg-slate-900">
                    <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      <MapPin className="h-3 w-3 text-emerald-600" />
                      {zone}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500">{zoneBusinesses.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {zoneBusinesses.map((business) => {
                      const isSelected = selected?.id === business.id;
                      return (
                        <button
                          key={business.id}
                          type="button"
                          onClick={() => setSelectedId(business.id)}
                          aria-current={isSelected ? 'true' : undefined}
                          className={`group flex w-full items-start gap-3 rounded-2xl border p-2.5 text-left transition ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-50/80 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/30'
                              : 'border-transparent hover:border-[var(--color-border-subtle)] hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-100 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            {business.logo ? (
                              <img src={business.logo} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : initialsOf(business)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1">
                              <span className="truncate text-xs font-black text-slate-900 dark:text-white">{business.name}</span>
                              {business.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Empresa verificada" />}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {categoryOf(business, categories)} · {business.address || business.neighborhood}
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-[9px] font-bold">
                              <span className={business.isOpenNow ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                                {business.isOpenNow ? t('openNow') : t('closedNow')}
                              </span>
                              {(business.rating || 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                                  <Star className="h-2.5 w-2.5 fill-current" />
                                  {business.rating?.toFixed(1)}
                                </span>
                              )}
                            </span>
                          </span>
                          <ChevronRight className={`mt-2 h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-500'}`} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </aside>

          <div className="order-1 space-y-4 xl:order-2">
            <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm dark:border-emerald-900 dark:bg-slate-900 sm:p-4">
              <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
                <div className="absolute left-[18%] top-0 h-full w-px rotate-[10deg] bg-white dark:bg-slate-800" />
                <div className="absolute left-[62%] top-0 h-full w-px -rotate-[14deg] bg-white dark:bg-slate-800" />
                <div className="absolute left-0 top-[30%] h-px w-full rotate-[4deg] bg-white dark:bg-slate-800" />
                <div className="absolute left-0 top-[68%] h-px w-full -rotate-[5deg] bg-white dark:bg-slate-800" />
              </div>

              <div className="relative">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-black text-emerald-950 dark:text-white">
                      <MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                      Zonas de Bissau
                    </h2>
                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-800/70 dark:text-slate-400">
                      Cada zona agrupa os locais pela sua localização, sem marcadores sobrepostos.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-black text-emerald-800 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-200">
                    {zones.length} {zones.length === 1 ? 'zona' : 'zonas'}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                  {zones.map(([zone, zoneBusinesses]) => {
                    const zoneSelected = selected ? zoneOf(selected) === zone : false;
                    return (
                      <div
                        key={zone}
                        className={`rounded-2xl border p-3 shadow-sm transition ${
                          zoneSelected
                            ? 'border-emerald-400 bg-white ring-2 ring-emerald-200 dark:border-emerald-700 dark:bg-slate-800 dark:ring-emerald-900'
                            : 'border-white/80 bg-white dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
                          <h3 className="flex min-w-0 items-center gap-1.5 text-[11px] font-black text-slate-900 dark:text-white">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              <MapPin className="h-3 w-3" />
                            </span>
                            <span className="truncate">{zone}</span>
                          </h3>
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            {zoneBusinesses.length}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {zoneBusinesses.slice(0, 4).map((business) => (
                            <button
                              key={business.id}
                              type="button"
                              onClick={() => setSelectedId(business.id)}
                              className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[10px] font-bold transition ${
                                selected?.id === business.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${business.isOpenNow ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-500'}`} />
                              <span className="min-w-0 flex-1 truncate">{business.name}</span>
                              {business.verified && <ShieldCheck className="h-3 w-3 shrink-0 opacity-80" />}
                            </button>
                          ))}
                          {zoneBusinesses.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setNeighborhood(zone)}
                              className="w-full rounded-lg px-2 py-1 text-left text-[9px] font-black text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-slate-700"
                            >
                              +{zoneBusinesses.length - 4} locais nesta zona
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {selected ? (
              <article className="rounded-3xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-sm font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    {selected.logo ? (
                      <img src={selected.logo} alt="" className="h-full w-full object-cover" />
                    ) : initialsOf(selected)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate text-base font-black text-slate-900 dark:text-white">{selected.name}</h2>
                      {selected.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          <ShieldCheck className="h-3 w-3" />
                          Verificada
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${selected.isOpenNow ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {selected.isOpenNow ? t('openNow') : t('closedNow')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {categoryOf(selected, categories)} · {selected.neighborhood}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                    aria-label="Fechar detalhe do local"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-[11px] dark:border-slate-800 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Morada</span>
                    <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{selected.address || selected.neighborhood}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Horário</span>
                    <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{selected.openingHours || 'Não indicado'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Avaliação</span>
                    <p className="mt-0.5 flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                      {(selected.rating || 0) > 0 ? (
                        <>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {selected.rating?.toFixed(1)} · {selected.reviewsCount} {t('reviewsCount')}
                        </>
                      ) : 'Sem avaliações'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectBusiness(selected)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 sm:flex-none"
                  >
                    <Store className="h-4 w-4" />
                    Abrir perfil
                  </button>
                  <a
                    href={directionsUrl(selected)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onDirections?.(selected)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-4 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex-none"
                  >
                    <Navigation className="h-4 w-4" />
                    {t('getDirections')}
                  </a>
                </div>
              </article>
            ) : (
              <div className="flex items-center gap-3 rounded-3xl border border-dashed border-[var(--color-border-default)] bg-white p-4 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                Selecione um local na lista ou numa zona para ver os detalhes e as direções.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
