import {
  Briefcase,
  Building2,
  Car,
  Compass,
  Factory,
  GraduationCap,
  HeartPulse,
  Hotel,
  Landmark,
  Radio,
  ShoppingBag,
  Store,
  Ticket,
  Tractor,
  Users,
  UtensilsCrossed,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ícone de cada categoria principal. A chave é o `iconName` do catálogo
 * (`categoryCatalog`/metadata das categorias na base de dados), para o cartão
 * do directório não mostrar sempre o mesmo ícone.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Hotel,
  Compass,
  HeartPulse,
  GraduationCap,
  Briefcase,
  ShoppingBag,
  Car,
  Building2,
  Landmark,
  Wifi,
  Factory,
  Tractor,
  Ticket,
  Users,
  Radio,
};

/** Devolve o ícone da categoria; categorias novas sem mapa usam a loja. */
export function getCategoryIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return Store;
  return CATEGORY_ICONS[iconName] ?? Store;
}
