import React, { useState } from 'react';
import {
  MapPin,
  MessageCircle,
  Phone,
  UserPlus,
  UserCheck,
  CheckCircle2,
  Award,
  ChevronRight,
  Sparkles,
  CheckSquare,
  Square,
  Bell,
  BellOff,
} from 'lucide-react';
import { Business, BusinessCategory, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { useTranslatedText } from '../utils/contentTranslation';
import { getBusinessDescriptionPreview } from '../utils/businessProfile';
import { Badge, Card } from './ui';

interface BusinessCardProps {
  business: Business;
  categories: BusinessCategory[];
  currentLang: Language;
  onSelect: (b: Business) => void;
  onToggleCompare?: (b: Business) => void;
  isCompared?: boolean;
  compareDisabled?: boolean;
  isFollowed?: boolean;
  onToggleFollow?: (businessId: string) => void;
  onToggleNotifications?: (businessId: string) => void;
  notificationsMuted?: boolean;
  onMessage?: (businessId: string) => void;
  onContactMetric?: (businessId: string, metric: 'phoneClicks' | 'whatsappClicks' | 'directionsClicks' | 'websiteClicks') => void;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  categories,
  currentLang,
  onSelect,
  onToggleCompare,
  isCompared = false,
  compareDisabled = false,
  isFollowed = false,
  onToggleFollow,
  onToggleNotifications,
  notificationsMuted = false,
  onMessage,
  onContactMetric,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const { translated: description } = useTranslatedText(business.description, currentLang, 'description');
  const descriptionPreview = getBusinessDescriptionPreview(description);
  const [failedCoverSource, setFailedCoverSource] = useState<string | null>(null);
  const [failedLogoSource, setFailedLogoSource] = useState<string | null>(null);

  const isEnterprise = business.tier === 'enterprise';
  const isPremium = business.tier === 'premium';
  const hasActivePromo = business.promotions.some((p) => p.isActive);
  const isPriceRangeJustCurrencySymbol = Boolean(business.priceRange && business.priceRange.trim() === '$');
  const priceDots = (!isPriceRangeJustCurrencySymbol && business.priceRange?.repeat(1)) ?? '';
  const categoryName = business.category || categories.find((category) => category.id === business.categoryId)?.name;
  const initials =
    business.name
      .trim()
      .split(/\s+/)
      .filter((part) => /^[\p{L}\p{N}]/u.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?';
  const hasReviews = business.reviews.length > 0;
  const hasCoverImage = Boolean(business.coverImage.trim()) && failedCoverSource !== business.coverImage;
  const hasLogoImage = Boolean(business.logo.trim()) && failedLogoSource !== business.logo;

  return (
    <Card interactive className="guigui-business-card group flex flex-col justify-between">
      {/* Cover Image & Badges */}
      <div className="relative w-full cursor-pointer" onClick={() => onSelect(business)}>
        <div className="guigui-business-cover relative w-full h-[160px] overflow-hidden">
        {hasCoverImage ? (
          <img
            src={business.coverImage}
            alt={`Capa de ${business.name}`}
            onError={() => setFailedCoverSource(business.coverImage)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            role="img"
            aria-label={`Capa de ${business.name}`}
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-600 text-4xl font-black tracking-widest text-white/90"
          >
            {initials}
          </div>
        )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-green-950)]/70 via-transparent to-transparent" />

          {/* Tier / Highlight Badge — topo esquerdo */}
          {(isEnterprise || isPremium) && (
            <Badge variant={isEnterprise ? 'verified' : 'premium'} className="absolute top-4 left-4 shadow-lg uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-gold-300" />
              <span>{isEnterprise ? t('featured') : t('tierPremium')}</span>
            </Badge>
          )}

          {/* Open/Closed Badge — topo direito */}
          <Badge variant={business.isOpenNow ? 'success' : 'neutral'} className="absolute top-4 right-4 shadow-lg backdrop-blur-md">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                business.isOpenNow ? 'bg-[var(--color-state-success)] animate-pulse' : 'bg-[var(--color-text-muted)]'
              }`}
            />
            <span>{business.isOpenNow ? t('openNow') : t('closedNow')}</span>
          </Badge>

          {/* Active Promo Tag — canto inferior direito da capa */}
          {hasActivePromo && (
            <Badge variant="premium" className="absolute bottom-4 right-4 shadow-lg">
              {t('activeOffer')}
            </Badge>
          )}

          {/* Comparison Checkbox — canto inferior esquerdo da capa */}
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare(business);
              }}
              disabled={compareDisabled && !isCompared}
              className={`absolute bottom-4 left-4 z-10 text-[11px] font-extrabold px-2.5 py-1 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-1.5 transition ${
                isCompared
                  ? 'bg-[var(--color-blue-600)] text-white ring-2 ring-[var(--color-blue-400)]'
                  : compareDisabled
                  ? 'bg-[rgba(13,41,36,0.6)] text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-[rgba(13,41,36,0.8)] text-white hover:bg-[var(--color-green-900)]'
              }`}
              title={isCompared ? t('removeFromComparison') : t('compareBusinesses')}
              aria-label={isCompared ? t('removeFromComparison') : t('compareBusinesses')}
            >
              {isCompared ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-300" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-300" />
              )}
              <span>{isCompared ? t('comparing') : t('compare')}</span>
            </button>
          )}
        </div>

      </div>

      {/* Card Content */}
      <div className="guigui-business-content flex-1 flex flex-col space-y-4 p-5">
        {/* Business Title & Verified Check */}
        <div className="flex items-start justify-between gap-2 cursor-pointer group" onClick={() => onSelect(business)}>
          <div className="flex min-w-0 items-center gap-2.5">
            {hasLogoImage ? (
              <img
                src={business.logo}
                alt={`Logótipo de ${business.name}`}
                onError={() => setFailedLogoSource(business.logo)}
                className="w-9 h-9 shrink-0 rounded-xl object-cover border border-[var(--color-border-subtle)]"
              />
            ) : (
              <div
                role="img"
                aria-label={`Logótipo de ${business.name}`}
                className="w-9 h-9 shrink-0 rounded-xl bg-[var(--color-green-950)] text-[11px] font-black tracking-wide text-white/90 flex items-center justify-center"
              >
                {initials}
              </div>
            )}
            <h3 className="font-black text-lg text-[var(--color-text-strong)] leading-tight group-hover:text-[var(--color-green-600)] transition-colors line-clamp-1">
              {business.name}
            </h3>
          </div>
          {business.verified && (
            <CheckCircle2
              className="w-4 h-4 text-[var(--color-green-600)] fill-[var(--color-green-600)] shrink-0 mt-0.5"
              aria-label={t('verifiedBadge')}
            />
          )}
        </div>

          {/* Location & Subcategory */}
        {(business.neighborhood.trim() || categoryName || business.subcategoryId.trim()) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            {business.neighborhood.trim() && (
              <span className="flex items-center gap-1 text-[var(--color-green-700)] font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[var(--color-green-600)]" />
                {business.neighborhood}
              </span>
            )}
            {categoryName && <span className="text-[var(--color-text-default)] font-medium">{categoryName}</span>}
            {business.subcategoryId.trim() && <span className="text-[var(--color-text-muted)]">{business.subcategoryId}</span>}
          </div>
        )}

        {/* Description — recorte fixo de caracteres com "Ler mais" */}
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-default)]">
          {descriptionPreview.preview || 'Sem descrição disponível.'}
          {descriptionPreview.truncated && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => onSelect(business)}
                aria-label={`Ler mais sobre ${business.name}`}
                className="font-black text-[var(--color-green-700)] underline-offset-2 hover:underline"
              >
                Ler mais
              </button>
            </>
          )}
        </p>

        {/* Rating & Reviews (preço isolado "$" não aparece no card) */}
        {hasReviews && (
          <div className="mt-2 flex items-center justify-between gap-3 px-2 py-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]">
            {business.ratingLabel.trim() && (
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[var(--color-blue-600)]" />
                <span className="font-extrabold text-[var(--color-text-strong)]">{business.ratingLabel}</span>
              </div>
            )}
            <span className="text-[var(--color-text-muted)] text-[11px] font-medium">
              {business.reviews.length} {t('reviewsCount')}
            </span>
          </div>
        )}
      </div>

      {/* Card Action Buttons */}
      <div className="guigui-business-actions flex items-center gap-2 p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800">
          {/* Follow + notification bell */}
          {onToggleFollow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow(business.id);
              }}
              className={`contact ${isFollowed ? 'bg-[var(--color-green-50)] text-[var(--color-green-700)] border-[var(--color-green-200)]' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]'}`}
              title={isFollowed ? t('unfollowBusiness') : t('followBusiness')}
              aria-label={isFollowed ? `Deixar de seguir ${business.name}` : `Seguir ${business.name}`}
            >
              {isFollowed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </button>
          )}
          {onToggleNotifications && isFollowed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleNotifications(business.id);
              }}
              className={`contact ${notificationsMuted ? 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]' : 'bg-[var(--color-gold-50)] text-[var(--color-gold-700)] border-[var(--color-gold-200)]'}`}
              title={notificationsMuted ? t('enableBusinessNotifications') : t('disableBusinessNotifications')}
              aria-label={notificationsMuted ? `Activar notificações de ${business.name}` : `Desactivar notificações de ${business.name}`}
            >
              {notificationsMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>
          )}

          {/* Internal business message */}
          {onMessage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMessage(business.id);
              }}
              className="contact bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:bg-[var(--color-green-50)] hover:text-[var(--color-green-700)] hover:border-[var(--color-green-200)] transition-colors"
              title={`${t('sendInternalMessage')} ${business.name}`}
              aria-label={`${t('sendInternalMessage')} ${business.name}`}
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}

          {/* Phone Call */}
          {business.phone.trim() && <a
            href={`tel:${business.phone}`}
            onClick={(e) => { e.stopPropagation(); onContactMetric?.(business.id, 'phoneClicks'); }}
            className="contact bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:bg-[var(--color-green-50)] hover:text-[var(--color-green-700)] hover:border-[var(--color-green-200)] transition-colors"
            title={t('callPhone')}
          >
            <Phone className="w-4 h-4" />
          </a>}

          {/* View Profile */}
          <button type="button"
            onClick={() => onSelect(business)}
            className="view flex-1 bg-[var(--ink)] text-white hover:bg-[var(--color-green-800)] transition-colors"
          >
            <span>{t('viewProfile')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
    </Card>
  );
};
