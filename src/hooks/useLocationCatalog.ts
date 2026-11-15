import { useCallback, useEffect, useState } from 'react';
import type { BissauLocationCatalogResponse, BissauLocationDto } from '../../shared/bissauLocations';

let cache: BissauLocationCatalogResponse | null = null;
let inflight: Promise<BissauLocationCatalogResponse> | null = null;

async function loadCatalog(force = false): Promise<BissauLocationCatalogResponse> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = fetch('/api/locations', { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Não foi possível carregar as localidades (${response.status}).`);
      return await response.json() as BissauLocationCatalogResponse;
    })
    .then((payload) => {
      cache = payload;
      return payload;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export interface UseLocationCatalogResult {
  locations: BissauLocationDto[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useLocationCatalog(): UseLocationCatalogResult {
  const [catalog, setCatalog] = useState<BissauLocationCatalogResponse | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await loadCatalog(force));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as localidades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache) return;
    void load();
  }, [load]);

  return {
    locations: catalog?.locations || [],
    loading,
    error,
    reload: () => load(true),
  };
}
