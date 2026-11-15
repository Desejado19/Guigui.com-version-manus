import React from 'react';
import { Inbox } from 'lucide-react';
import { Button, ButtonVariant } from './Button';

type EmptyStateIcon = React.ComponentType<React.SVGProps<SVGSVGElement>> | React.ReactElement;

interface EmptyStateProps {
  icon?: EmptyStateIcon;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  accent?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Quando presente, o fundo é pintado com o acento e o conteúdo fica em branco (destaque de secção). */
  highlight?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: string;
}

const sizeScale = {
  sm: 'h-10 w-10 text-lg p-4',
  md: 'h-12 w-12 text-xl p-6',
  lg: 'h-16 w-16 text-3xl p-8',
} as const;

const sizeText = {
  sm: 'text-sm font-bold',
  md: 'text-lg font-bold',
  lg: 'text-xl font-bold',
} as const;

function normalizeIcon(icon?: EmptyStateIcon): React.ComponentType<React.SVGProps<SVGSVGElement>> {
  if (!icon) return Inbox;
  if (React.isValidElement(icon)) {
    const child = (icon as React.ReactElement).type as unknown;
    // Em React 19 os componentes `forwardRef`/`memo` (usados pelos icones do
    // lucide-react) tem `type` como objecto e nao como funcao. Sem tratar este
    // caso, `normalizeIcon` devolvia o proprio elemento e o React quebrava com
    // "Element type is invalid ... got: <CalendarDays />".
    if (typeof child === 'function' || typeof child === 'string' || (typeof child === 'object' && child !== null)) {
      return child as React.ComponentType<React.SVGProps<SVGSVGElement>>;
    }
  }
  return icon as React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actions,
  accent = 'var(--color-green-600)',
  size = 'md',
  highlight = false,
  actionLabel,
  onAction,
  actionVariant,
}) => {
  const IconComp = normalizeIcon(Icon);
  if (highlight) {
    return (
      <div
        className="relative overflow-hidden rounded-[var(--radius-xl)] p-6 text-center shadow-sm"
        style={{ backgroundColor: accent }}
      >
        <span className="absolute inset-0 opacity-10" aria-hidden="true" />
        <IconComp className={`${sizeScale[size]} mx-auto text-white shadow-md`} aria-hidden="true" />
        {title && (
          <h3 className={`${sizeText[size]} text-white font-black`}>{title}</h3>
        )}
        {description && (
          <p className="mt-1.5 text-sm font-semibold text-white/90">{description}</p>
        )}
        {actions && <div className="mt-4 flex flex-wrap justify-center gap-3">{actions}</div>}
      </div>
    );
  }

  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-6 text-center text-slate-500">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-sm`}>
        <IconComp className={sizeScale[size]} />
      </span>
      {title && <p className={sizeText[size]}>{title}</p>}
      {description && <p className="text-sm text-slate-400">{description}</p>}
      {(actions || onAction) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {actions}
          {onAction && <Button variant={actionVariant as any || 'primary'} size="sm" onClick={onAction}>{actionLabel}</Button>}
        </div>
      )}
    </div>
  );
};
