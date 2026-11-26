import React from 'react';
import { MapPin } from 'lucide-react';

interface LocationCardProps {
  neighborhood: string;
  imageUrl?: string | null;
  description?: string | null;
  actions?: React.ReactNode;
  count?: number;
  className?: string;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  neighborhood,
  imageUrl,
  description,
  actions,
  count,
  className,
}) => {
  return (
    <div
      className={`guigui-location-card rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden cursor-pointer ${className || ''}`}
      onClick={() => alert('Location card clicked')}
    >
      <div className="guigui-location-inner">
        <div className="guigui-location-thumb h-36 sm:h-44 w-full">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="guigui-location-thumb-media"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full px-4 py-6 flex items-center justify-center text-slate-500 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide">
              <MapPin className="w-5 h-5 mr-2" />
              {neighborhood}
            </div>
          )}
          <div className="guigui-location-thumb-overlay" />
          <div className="guigui-location-thumb-tag">{neighborhood}</div>
        </div>

        <div className="guigui-location-body">
          <div className="guigui-location-title">{neighborhood}</div>
          {description && (
            <div className="guigui-location-sub">{description}</div>
          )}
          {actions && (
            <div className="guigui-location-actions">{actions}</div>
          )}
          {count != null && (
            <div className="guigui-location-count">
              {count} espaço(s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
