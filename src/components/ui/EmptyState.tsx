import React from 'react';
import { Inbox } from 'lucide-react';
import { Button, ButtonVariant } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'outline',
  icon = <Inbox className="h-6 w-6" aria-hidden="true" />,
}) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-6 py-12 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-brand-soft)] text-[var(--color-text-link)]">
      {icon}
    </div>
    <h3 className="text-base font-bold text-[var(--color-text-strong)]">{title}</h3>
    {description && <p className="max-w-md text-sm leading-relaxed text-[var(--color-text-muted)]">{description}</p>}
    {actionLabel && onAction && <Button variant={actionVariant} size="sm" onClick={onAction}>{actionLabel}</Button>}
  </div>
);
