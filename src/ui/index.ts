/**
 * Kit interno de interface do Guigui (estilo shadcn).
 *
 * Fonte única dos componentes base reutilizados pelos painéis admin, empresa e
 * cidadão. Os componentes herdados de `src/components/ui/` são reexportados
 * aqui para manter compatibilidade com os imports antigos.
 */

export {
  Button,
  Spinner,
  Loader,
  type ButtonVariant,
  type ButtonSize,
  type ButtonProps,
  type ButtonOwnProps,
  type AnchorButtonProps,
  type AnyButtonProps,
} from './button';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from './card';
export { Text, type TextProps, type TextSize, type TextTone } from './text';
export {
  Panel,
  PanelHeader,
  PanelTitleRegion,
  type PanelProps,
  type PanelHeaderProps,
} from './panel';

/* Componentes herdados partilhados entre painéis. */
export { Badge, type BadgeVariant } from '../components/ui/Badge';
export { EmptyState } from '../components/ui/EmptyState';
export { IconButton } from '../components/ui/IconButton';
export { SectionHeader } from '../components/ui/SectionHeader';
export { BusinessLogo, businessInitials } from '../components/ui/BusinessLogo';
export { StatCard, type StatTone } from '../components/ui/StatCard';
export { LocationFilter } from '../components/ui/LocationFilter';
export { Field, fieldClassName } from '../components/ui/Field';
export { Skeleton } from '../components/ui/Skeleton';
