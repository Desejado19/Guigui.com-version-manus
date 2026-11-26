/**
 * Ponto de importação histórico (`./ui` e `../ui`).
 *
 * O kit real vive em `src/ui/`; este barrel mantém os imports antigos a
 * funcionar enquanto os painéis são migrados. Não adicionar componentes novos
 * aqui — criar em `src/ui/` e reexportar.
 */

export * from '../../ui';

export { Badge, type BadgeVariant } from './Badge';
export { EmptyState } from './EmptyState';
export { IconButton } from './IconButton';
export { SectionHeader } from './SectionHeader';
export { BusinessLogo, businessInitials } from './BusinessLogo';
export { StatCard, type StatTone } from './StatCard';
export { LocationFilter } from './LocationFilter';
export { Field, fieldClassName } from './Field';
export { Skeleton } from './Skeleton';
