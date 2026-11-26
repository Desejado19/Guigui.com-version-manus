import { useEffect, useState } from 'react';

/**
 * Fonte pública única do conteúdo institucional.
 *
 * Tanto a página Sobre Nós como o Footer leem da última publicação
 * (`GET /api/institutional`), em vez de manterem textos ou contactos próprios.
 * O resultado fica em cache de módulo durante um minuto para o Footer não
 * repetir o pedido em cada página, e nunca é persistido no browser.
 */

export interface InstitutionalPublicProfile {
  official_name?: string;
  trade_name?: string;
  slogan?: string;
  short_description?: string;
  long_description?: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  domain?: string;
  country?: string;
  category?: string;
  primary_language?: string;
  supported_languages?: string;
  launch_date?: string;
}

export interface InstitutionalPublicContact {
  id: number | string;
  label?: string;
  purpose?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  country?: string;
  hours?: string;
  isVisible?: boolean;
  position?: number;
}

export interface InstitutionalPublicSocialLink {
  id: number | string;
  network?: string;
  label?: string;
  url?: string;
  icon?: string;
  isVisible?: boolean;
  position?: number;
}

export interface InstitutionalPublicDocument {
  id: number | string;
  name?: string;
  slug?: string;
  description?: string;
  content?: string;
  version?: string;
  status?: string;
  category?: string;
  fileUrl?: string;
  publishedAt?: string;
  documentDate?: string;
  isVisible?: boolean;
}

export interface InstitutionalPublicCommunication {
  id: number | string;
  title?: string;
  slug?: string;
  type?: string;
  body?: string;
  image_url?: string;
  audience?: string;
  status?: string;
  publish_at?: string;
  expires_at?: string;
  author?: string;
  isVisible?: boolean;
}

export interface InstitutionalPublicSnapshot {
  profile: InstitutionalPublicProfile;
  contacts: InstitutionalPublicContact[];
  socialLinks: InstitutionalPublicSocialLink[];
  documents: InstitutionalPublicDocument[];
  communications: InstitutionalPublicCommunication[];
  publishedAt: string | null;
}

interface CacheEntry {
  at: number;
  promise: Promise<InstitutionalPublicSnapshot | null>;
}

const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

async function fetchInstitutionalSnapshot(): Promise<InstitutionalPublicSnapshot | null> {
  try {
    const response = await fetch('/api/institutional', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = await response.json() as { data?: Record<string, unknown>; publishedAt?: string | null };
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const entities = (data.entities ?? {}) as Record<string, unknown>;
    const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
    const visible = <T extends { isVisible?: boolean }>(rows: T[]) => rows.filter((row) => row.isVisible !== false);
    return {
      profile: (data.profile ?? {}) as InstitutionalPublicProfile,
      contacts: visible(list<InstitutionalPublicContact>(entities.contacts)),
      socialLinks: visible(list<InstitutionalPublicSocialLink>(entities.social_links)),
      documents: visible(list<InstitutionalPublicDocument>(entities.documents)),
      communications: visible(list<InstitutionalPublicCommunication>(entities.communications)),
      publishedAt: payload.publishedAt ?? null,
    };
  } catch {
    return null;
  }
}

function readCache(): Promise<InstitutionalPublicSnapshot | null> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.promise;
  const entry: CacheEntry = { at: now, promise: fetchInstitutionalSnapshot() };
  cache = entry;
  return entry.promise;
}

/** Limpa a cache (usado depois de publicar/alterar conteúdo institucional). */
export function invalidateInstitutionalPublicCache() {
  cache = null;
}

export function useInstitutionalPublic(): { data: InstitutionalPublicSnapshot | null; loading: boolean } {
  const [data, setData] = useState<InstitutionalPublicSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void readCache().then((snapshot) => {
      if (!active) return;
      setData(snapshot);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { data, loading };
}
