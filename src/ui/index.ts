/**
 * Kit interno de interface (shadcn-style).
 *
 * Esta pasta contém componentes base reutilizáveis em todos os painéis:
 * admin, empresa e cidadão. A intenção é ter um sistema de componentes
 * coerente, auditável e com a identidade visual do Guigui.
 *
 * Reexportamos apenas os públicos do kit; componentes antigos ficam em
 * `src/components/ui/` para não interromper integrações existentes.
 */

export { tokens, type Tokens, type ColorTokenFamily, type ColorTokenLevel } from './tokens';
export { Button, Spinner, type ButtonVariant, type ButtonSize } from './button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, type CardProps } from './card';
export { Text, type TextProps, type TextSize, type TextTone } from './text';
export { Panel, PanelHeader, PanelTitleRegion, type PanelProps } from './panel';
