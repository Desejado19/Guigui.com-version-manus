import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { groupLocations, type BissauLocationDto } from '../../../shared/bissauLocations';

interface LocationFilterProps {
  /** Catálogo completo devolvido por `/api/locations`. */
  locations: BissauLocationDto[];
  selectedLocation: string | null;
  onSelect: (location: string | null) => void;
  /** Texto do botão quando não há localidade escolhida. */
  triggerLabel?: string;
  /** Rótulo da ação que remove o filtro dentro do painel. */
  allLabel?: string;
  /** Mostrar a opção "Todos"/"Ver todos". Desativado em secções que exigem uma localidade concreta. */
  allowAll?: boolean;
  className?: string;
}

const normalise = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const LocationFilter: React.FC<LocationFilterProps> = ({
  locations,
  selectedLocation,
  onSelect,
  triggerLabel = 'Todos',
  allLabel = 'Ver todos',
  allowAll = true,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => groupLocations(locations), [locations]);
  const search = normalise(query);
  const filteredGroups = useMemo(() => groups
    .map((group) => ({
      ...group,
      locations: group.locations.filter((entry) => !search
        || normalise(entry.name).includes(search)
        || entry.aliases.some((alias) => normalise(alias).includes(search))),
    }))
    .filter((group) => group.locations.length > 0), [groups, search]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => searchRef.current?.focus(), 40);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const choose = (location: string | null, label: string) => {
    onSelect(location);
    setAnnouncement(label);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`guigui-filter-chip max-w-[220px] ${selectedLocation === null ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Filtrar por localização. ${selectedLocation ?? triggerLabel}`}
        title={selectedLocation ?? 'Todas as localizações de Bissau'}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{selectedLocation ?? triggerLabel}</span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Localidades de Bissau"
          className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-white text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 p-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Pesquisar bairro ou localidade</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar bairro ou localidade..."
                  className="h-9 w-full rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 pl-8 pr-8 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                    aria-label="Limpar pesquisa de localidades"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </label>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Fechar lista de localidades"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {selectedLocation
                  ? <>Selecionado: <strong className="text-emerald-700 dark:text-emerald-300">{selectedLocation}</strong></>
                  : allowAll ? 'Todas as localidades de Bissau' : 'Escolha uma localidade'}
              </span>
              {allowAll && <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => choose(null, 'Filtro de localização limpo.')}
                  className="rounded-lg px-2 py-1 text-[10px] font-black text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={() => choose(null, 'A mostrar todas as localidades.')}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white transition hover:bg-emerald-700"
                >
                  {allLabel}
                </button>
              </div>}
            </div>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5" role="listbox" aria-label="Lista de localidades">
            {filteredGroups.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                Nenhuma localidade encontrada para “{query}”.
              </p>
            ) : filteredGroups.map((group) => (
              <section key={group.sector} className="mb-1.5">
                <h3 className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {group.sector}
                </h3>
                <div className="space-y-0.5">
                  {group.locations.map((entry) => {
                    const selected = selectedLocation === entry.name;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => choose(entry.name, `Localização selecionada: ${entry.name}.`)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold transition ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <MapPin className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-white' : 'text-emerald-600'}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                        {entry.kind === 'zona' && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wide ${selected ? 'bg-[#2f8f6e] text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                            Zona
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="border-t border-slate-100 px-3 py-2 text-[9px] font-semibold text-slate-500 dark:border-slate-800">
            {locations.length} localidades · organizadas por sector administrativo
          </div>
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
};
