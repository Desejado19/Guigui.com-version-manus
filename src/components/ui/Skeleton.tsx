import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = '1rem', className = '', style, ...props }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)] dark:bg-[var(--color-neutral-700)] ${className}`}
    style={{ width, height, ...style }}
    {...props}
  />
);
