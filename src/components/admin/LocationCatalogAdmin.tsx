import React, { useEffect, useMemo, useState } from 'react';
import { foldForSearch, matchesSearch } from '../../../shared/textNormalization';
import { Archive, MapPin, Plus, RefreshCw, Search } from 'lucide-react';
import type { BissauLocationCatalogResponse, BissauLocationDto } from '../../../shared/bissauLocations';

const inputClass = 'h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';

/**
 * Lê a resposta sem assumir JSON: se o servidor devolver HTML (rota ausente ou
 * proxy), a mensagem apresentada é legível em vez de um erro de parsing.
 */
async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error || fallback);
  if (!payload || typeof payload !== 'object') throw new Error(fallback);
  return payload;
}

export const LocationCatalogAdmin: React.FC = () => {
  const [catalog, setCatalog] = useState<BissauLocationCatalogResponse | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', sector: '', kind: 'bairro' as 'bairro' | 'zona', aliases: '' });

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/locations', { credentials: 'include' });
      const payload = await readJson<BissauLocationCatalogResponse>(response, 'Não foi possível carregar as localidades.');
      if (!Array.isArray(payload.locations)) throw new Error('Resposta inválida do catálogo de localidades.');
      setCatalog(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as localidades.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const sectors = useMemo(() => Array.from(new Set((catalog?.locations || []).map((entry) => entry.sector))), [catalog]);
  useEffect(() => {
    if (!form.sector && sectors[0]) setForm((current) => ({ ...current, sector: sectors[0] }));
  }, [form.sector, sectors]);

  const filtered = (catalog?.locations || []).filter((entry) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return [entry.name, entry.sector, ...entry.aliases].some((value) => matchesSearch(value, foldForSearch(search)));
  });

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/locations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          sector: form.sector,
          kind: form.kind,
          aliases: form.aliases.split(',').map((entry) => entry.trim()).filter(Boolean),
        }),
      });
      await readJson<{ location?: BissauLocationDto }>(response, 'Não foi possível criar a localidade.');
      setForm((current) => ({ ...current, name: '', aliases: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar a localidade.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (entry: BissauLocationDto) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/locations/${encodeURIComponent(entry.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !entry.isActive }),
      });
      await readJson<{ location?: BissauLocationDto }>(response, 'Não foi possível atualizar a localidade.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a localidade.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm" aria-labelledby="admin-locations-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-200 pb-3">
        <div>
          <h3 id="admin-locations-title" className="flex items-center gap-2 text-sm font-black text-emerald-950">
            <MapPin className="h-4 w-4 text-emerald-700" />
            Catálogo de localidades de Bissau
          </h3>
          <p className="mt-1 text-[11px] font-medium text-emerald-900/80">
            Lista central usada por empresas, eventos e todos os filtros geográficos. Arquivar mantém os registos históricos intactos.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-[10px] font-black text-emerald-900 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <form onSubmit={create} className="mt-4 grid gap-2 lg:grid-cols-[1.2fr_1.2fr_130px_1.2fr_auto]">
        <label className="text-[9px] font-black uppercase tracking-wide text-emerald-900">Nome
          <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={`${inputClass} mt-1`} placeholder="Nome do bairro ou zona" />
        </label>
        <label className="text-[9px] font-black uppercase tracking-wide text-emerald-900">Sector
          <select value={form.sector} onChange={(event) => setForm((current) => ({ ...current, sector: event.target.value }))} className={`${inputClass} mt-1`}>
            {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
          </select>
        </label>
        <label className="text-[9px] font-black uppercase tracking-wide text-emerald-900">Tipo
          <select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as 'bairro' | 'zona' }))} className={`${inputClass} mt-1`}>
            <option value="bairro">Bairro</option>
            <option value="zona">Zona</option>
          </select>
        </label>
        <label className="text-[9px] font-black uppercase tracking-wide text-emerald-900">Grafias antigas
          <input value={form.aliases} onChange={(event) => setForm((current) => ({ ...current, aliases: event.target.value }))} className={`${inputClass} mt-1`} placeholder="Separadas por vírgulas" />
        </label>
        <button type="submit" disabled={busy} className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-[10px] font-black text-white hover:bg-emerald-800 disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </form>

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Pesquisar localidades</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar localidade..." className={`${inputClass} pl-8`} />
        </label>
        <span className="text-[10px] font-bold text-emerald-900">{filtered.length} de {catalog?.locations.length || 0}</span>
      </div>

      <div className="mt-3 max-h-[min(48vh,460px)] overflow-y-auto rounded-2xl border border-emerald-200 bg-white">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-emerald-900 text-white">
            <tr>
              <th className="px-3 py-2 font-black">Localidade</th>
              <th className="px-3 py-2 font-black">Sector</th>
              <th className="px-3 py-2 font-black">Tipo</th>
              <th className="px-3 py-2 font-black">Estado</th>
              <th className="px-3 py-2 text-right font-black">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-t border-emerald-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-black text-slate-900">{entry.name}</div>
                  {entry.aliases.length > 0 && <div className="mt-0.5 text-[9px] text-slate-500">Também: {entry.aliases.join(', ')}</div>}
                </td>
                <td className="px-3 py-2 text-slate-600">{entry.sector}</td>
                <td className="px-3 py-2 capitalize text-slate-600">{entry.kind}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${entry.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {entry.isActive ? 'Ativa' : 'Arquivada'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => void toggle(entry)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-800 disabled:opacity-50">
                    <Archive className="h-3 w-3" /> {entry.isActive ? 'Arquivar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="px-3 py-6 text-center text-xs font-semibold text-slate-500">Nenhuma localidade encontrada.</p>}
      </div>
    </section>
  );
};
