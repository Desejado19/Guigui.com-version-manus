import React from 'react';

export type TextSize = 'xs' | 'sm' | 'md' | 'lg';
export type TextTone = 'default' | 'muted' | 'strong' | 'link' | 'brand' | 'success' | 'warning' | 'danger';

export interface TextProps extends Omit<React.HTMLAttributes<HTMLElement>, keyof TextOwnProps>, TextOwnProps {
  as?: keyof JSX.IntrinsicElements;
}

export interface TextOwnProps {
  size?: TextSize;
  tone?: TextTone;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  truncate?: boolean;
  children?: React.ReactNode;
}

const sizeClasses: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
};

const toneClasses: Record<TextTone, string> = {
  default: 'text-[var(--color-text-default)]',
  muted: 'text-[var(--color-text-muted)]',
  strong: 'text-[var(--color-text-strong)]',
  link: 'text-[var(--color-text-link)]',
  brand: 'text-[var(--color-text-on-brand)]',
  success: 'text-[var(--color-green-700)]',
  warning: 'text-[var(--color-yellow-700)]',
  danger: 'text-[var(--color-red-700)]',
};

const weightClasses: Record<NonNullable<TextOwnProps['weight']>, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  { as: Tag = 'span', size = 'md', tone = 'default', weight, truncate, className = '', children, ...props },
  ref,
) {
  const classes = [
    sizeClasses[size],
    toneClasses[tone],
    weight && weightClasses[weight],
    truncate ? 'truncate' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (Tag === 'p' || Tag === 'div') {
    return (
      <Tag ref={ref as React.Ref<HTMLParagraphElement | HTMLDivElement>} className={classes} {...props}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag ref={ref} className={classes} {...props}>
      {children}
    </Tag>
  );
});

Text.displayName = 'Text';
