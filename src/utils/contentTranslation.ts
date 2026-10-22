import { useEffect, useState } from 'react';
import { Language } from '../types';

type ContentKind = 'title' | 'description' | 'content' | 'caption';

const memoryCache = new Map<string, string>();
const STORAGE_KEY = 'guigui_published_content_translations_v1';

// Demo data is authored in Portuguese. These phrases make the demo useful offline
// while unknown user text safely falls back to its original value.
const DEMO_TRANSLATIONS: Record<Exclude<Language, 'pt'>, Record<string, string>> = {
  en: {
    'Promoções Activas com Desconto': 'Active Promotions with Discounts',
    'Oportunidades em Bissau': 'Opportunities in Bissau',
    'Descontos exclusivos em restaurantes, hotéis, lojas e serviços em Bissau com contagem regressiva em tempo real.': 'Exclusive discounts at restaurants, hotels, shops and services in Bissau with a real-time countdown.',
    'Sem publicações recentes.': 'No recent posts.',
    'Sem promoções ativas de momento.': 'No active promotions at the moment.',
    'Nova Story publicada pela comunidade.': 'New story published by the community.',
    'Conteúdo Patrocinado': 'Sponsored Content',
  },
  fr: {
    'Promoções Activas com Desconto': 'Promotions actives avec remise',
    'Oportunidades em Bissau': 'Opportunités à Bissau',
    'Descontos exclusivos em restaurantes, hotéis, lojas e serviços em Bissau com contagem regressiva em tempo real.': 'Réductions exclusives dans les restaurants, hôtels, magasins et services de Bissau avec compte à rebours en temps réel.',
    'Sem publicações recentes.': 'Aucune publication récente.',
    'Sem promoções ativas de momento.': 'Aucune promotion active pour le moment.',
    'Nova Story publicada pela comunidade.': 'Nouvelle story publiée par la communauté.',
    'Conteúdo Patrocinado': 'Contenu sponsorisé',
  },
  es: {
    'Promoções Activas com Desconto': 'Promociones activas con descuento',
    'Oportunidades em Bissau': 'Oportunidades en Bissau',
    'Descontos exclusivos em restaurantes, hotéis, lojas e serviços em Bissau com contagem regressiva em tempo real.': 'Descuentos exclusivos en restaurantes, hoteles, tiendas y servicios de Bissau con cuenta atrás en tiempo real.',
    'Sem publicações recentes.': 'No hay publicaciones recientes.',
    'Sem promoções ativas de momento.': 'No hay promociones activas por el momento.',
    'Nova Story publicada pela comunidade.': 'Nueva story publicada por la comunidad.',
    'Conteúdo Patrocinado': 'Contenido patrocinado',
  },
};

const COMMON_WORDS: Record<Exclude<Language, 'pt'>, Record<string, string>> = {
  en: { 'restaurante': 'restaurant', 'restaurantes': 'restaurants', 'hotel': 'hotel', 'hotéis': 'hotels', 'loja': 'shop', 'lojas': 'shops', 'serviço': 'service', 'serviços': 'services', 'desconto': 'discount', 'descontos': 'discounts', 'oferta': 'offer', 'ofertas': 'offers', 'evento': 'event', 'eventos': 'events', 'aberto': 'open', 'fechado': 'closed' },
  fr: { 'restaurante': 'restaurant', 'restaurantes': 'restaurants', 'hotel': 'hôtel', 'hotéis': 'hôtels', 'loja': 'boutique', 'lojas': 'boutiques', 'serviço': 'service', 'serviços': 'services', 'desconto': 'remise', 'descontos': 'remises', 'oferta': 'offre', 'ofertas': 'offres', 'evento': 'événement', 'eventos': 'événements', 'aberto': 'ouvert', 'fechado': 'fermé' },
  es: { 'restaurante': 'restaurante', 'restaurantes': 'restaurantes', 'hotel': 'hotel', 'hotéis': 'hoteles', 'loja': 'tienda', 'lojas': 'tiendas', 'serviço': 'servicio', 'serviços': 'servicios', 'desconto': 'descuento', 'descontos': 'descuentos', 'oferta': 'oferta', 'ofertas': 'ofertas', 'evento': 'evento', 'eventos': 'eventos', 'aberto': 'abierto', 'fechado': 'cerrado' },
};

function readStorage(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function writeStorage(values: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch { /* storage is optional */ }
}

/** Translate display text without changing the published/original object. */
export function translatePublishedText(text: string | undefined | null, lang: Language, kind: ContentKind = 'content'): string {
  if (!text || lang === 'pt') return text || '';
  const key = `${lang}:${kind}:${text}`;
  const cached = memoryCache.get(key);
  if (cached) return cached;
  const stored = readStorage()[key];
  if (stored) { memoryCache.set(key, stored); return stored; }

  const translated = DEMO_TRANSLATIONS[lang][text] || text.replace(/\b(restaurantes?|hotel|hotéis|lojas?|serviços?|descontos?|ofertas?|eventos?|aberto|fechado)\b/gi, (word) => COMMON_WORDS[lang][word.toLowerCase()] || word);
  memoryCache.set(key, translated);
  if (translated !== text) {
    const values = readStorage();
    values[key] = translated;
    writeStorage(values);
  }
  return translated;
}

/** Async seam for a future translation API; currently deterministic and offline-safe. */
export async function translatePublishedTextAsync(text: string | undefined | null, lang: Language, kind: ContentKind = 'content') {
  return translatePublishedText(text, lang, kind);
}

export function useTranslatedText(text: string | undefined | null, lang: Language, kind: ContentKind = 'content') {
  const [value, setValue] = useState(() => translatePublishedText(text, lang, kind));
  useEffect(() => {
    let active = true;
    translatePublishedTextAsync(text, lang, kind).then((result) => { if (active) setValue(result); });
    return () => { active = false; };
  }, [text, lang, kind]);
  return { translated: value, original: text || '' };
}
