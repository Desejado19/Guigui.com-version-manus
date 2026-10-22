import React from 'react';
import { Button, ButtonSize, ButtonVariant } from './Button';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  size?: Exclude<ButtonSize, 'lg'>;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({
  label,
  children,
  ...props
}, ref) => (
  <Button ref={ref} {...props} size={props.size || 'icon'} aria-label={label} title={props.title || label}>
    {children}
  </Button>
));

IconButton.displayName = 'IconButton';
