import React, { useState } from 'react';
import {
  MapPin,
  MessageCircle,
  Phone,
  UserPlus,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  CheckSquare,
  Square,
  Bell,
  BellOff,
  Tag,
  Star,
} from 'lucide-react';
import { Business, BusinessCategory, Language } from '../types';
import { getTranslation } from '../utils/i18n';
import { useTranslatedText } from '../utils/contentTranslation';
import { getBusinessDescriptionPreview } from '../utils/businessProfile';
import { getCategoryIcon } from '../utils/categoryIcons';
import { Card } from './ui';

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
  const category = categories.find((item) => item.id === business.categoryId);
  const categoryName = business.category || category?.name;
  const CategoryIcon = getCategoryIcon(category?.iconName);
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
      {/* Fotografia full-bleed com selos sobrepostos */}
      <div className="guigui-business-cover cursor-pointer" onClick={() => onSelect(business)}>
        {hasCoverImage ? (
          <img
            src={business.coverImage}
            alt={`Capa de ${business.name}`}
            className="guigui-business-cover-image"
            onError={() => setFailedCoverSource(business.coverImage)}
          />
        ) : (
          <div
            role="img"
            aria-label={`Capa de ${business.name}`}
            className="guigui-business-cover-fallback"
          >
            {initials}
          </div>
        )}

        <div className="guigui-business-cover-tags">
          {(isEnterprise || isPremium) && (
            <span className="guigui-business-tag guigui-business-tag--gold">
              <Sparkles aria-hidden="true" className="h-3 w-3" />
              {isEnterprise ? t('featured') : t('tierPremium')}
            </span>
          )}
          {hasActivePromo && <span className="guigui-business-tag guigui-business-tag--gold">{t('activeOffer')}</span>}
        </div>

        <span className="guigui-business-status">
          <span
            aria-hidden="true"
            className={`guigui-business-status-dot ${business.isOpenNow ? 'is-open' : 'is-closed'}`}
          />
          {business.isOpenNow ? t('openNow') : t('closedNow')}
        </span>

        {onToggleCompare && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCompare(business);
            }}
            disabled={compareDisabled && !isCompared}
            className={`guigui-business-compare ${isCompared ? 'is-selected' : ''}`}
            title={isCompared ? t('removeFromComparison') : t('compareBusinesses')}
            aria-label={isCompared ? t('removeFromComparison') : t('compareBusinesses')}
            aria-pressed={isCompared}
          >
            {isCompared ? (
              <CheckSquare aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Square aria-hidden="true" className="h-4 w-4" />
            )}
            <span>{isCompared ? t('comparing') : t('compare')}</span>
          </button>
        )}
      </div>

      <div className="guigui-business-body">
        {/* Logótipo, nome e selo de verificação */}
        <div className="guigui-business-heading">
          {hasLogoImage ? (
            <img
              src={business.logo}
              alt={`Logótipo de ${business.name}`}
              onError={() => setFailedLogoSource(business.logo)}
              className="guigui-business-logo"
            />
          ) : (
            <div role="img" aria-label={`Logótipo de ${business.name}`} className="guigui-business-logo is-fallback">
              {initials}
            </div>
          )}
          <h3 className="guigui-business-title cursor-pointer" onClick={() => onSelect(business)}>
            {business.name}
          </h3>
          {business.verified && (
            <CheckCircle2
              className="guigui-business-verified"
              aria-label={t('verifiedBadge')}
            />
          )}
        </div>

        {/* Localização e etiquetas */}
        {(business.neighborhood.trim() || categoryName || business.subcategoryId.trim()) && (
          <div className="guigui-business-meta">
            {business.neighborhood.trim() && (
              <span className="guigui-business-location">
                <MapPin aria-hidden="true" className="h-4 w-4" />
                {business.neighborhood}
              </span>
            )}
            {business.neighborhood.trim() && categoryName && <span aria-hidden="true" className="guigui-business-meta-divider" />}
            {categoryName && (
              <span className="guigui-business-chip">
                <CategoryIcon aria-hidden="true" className="h-3.5 w-3.5" />
                {categoryName}
              </span>
            )}
            {business.subcategoryId.trim() && (
              <span className="guigui-business-chip">
                <Tag aria-hidden="true" className="h-3.5 w-3.5" />
                {business.subcategoryId}
              </span>
            )}
          </div>
        )}

        <p className="guigui-business-description">
          {descriptionPreview.preview || 'Sem descrição disponível.'}
          {descriptionPreview.truncated && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => onSelect(business)}
                aria-label={`Ler mais sobre ${business.name}`}
                className="guigui-business-more"
              >
                Ler mais
              </button>
            </>
          )}
        </p>

        {hasReviews && (
          <div className="guigui-business-rating">
            <Star aria-hidden="true" className="h-3.5 w-3.5" />
            {business.ratingLabel.trim() && <span>{business.ratingLabel}</span>}
            <span className="guigui-business-rating-count">
              {business.reviews.length} {t('reviewsCount')}
            </span>
          </div>
        )}

        <div className="guigui-business-actions">
          {onToggleFollow && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFollow(business.id);
              }}
              className={`contact ${isFollowed ? 'is-active' : ''}`}
              title={isFollowed ? t('unfollowBusiness') : t('followBusiness')}
              aria-label={isFollowed ? `Deixar de seguir ${business.name}` : `Seguir ${business.name}`}
              aria-pressed={isFollowed}
            >
              {isFollowed ? <UserCheck aria-hidden="true" className="h-[18px] w-[18px]" /> : <UserPlus aria-hidden="true" className="h-[18px] w-[18px]" />}
            </button>
          )}
          {onToggleNotifications && isFollowed && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleNotifications(business.id);
              }}
              className={`contact ${notificationsMuted ? '' : 'is-active'}`}
              title={notificationsMuted ? t('enableBusinessNotifications') : t('disableBusinessNotifications')}
              aria-label={notificationsMuted ? `Activar notificações de ${business.name}` : `Desactivar notificações de ${business.name}`}
            >
              {notificationsMuted ? <BellOff aria-hidden="true" className="h-[18px] w-[18px]" /> : <Bell aria-hidden="true" className="h-[18px] w-[18px]" />}
            </button>
          )}
          {onMessage && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMessage(business.id);
              }}
              className="contact"
              title={`${t('sendInternalMessage')} ${business.name}`}
              aria-label={`${t('sendInternalMessage')} ${business.name}`}
            >
              <MessageCircle aria-hidden="true" className="h-[18px] w-[18px]" />
            </button>
          )}
          {business.phone.trim() && (
            <a
              href={`tel:${business.phone}`}
              onClick={(event) => {
                event.stopPropagation();
                onContactMetric?.(business.id, 'phoneClicks');
              }}
              className="contact"
              title={t('callPhone')}
              aria-label={`${t('callPhone')} ${business.name}`}
            >
              <Phone aria-hidden="true" className="h-[18px] w-[18px]" />
            </a>
          )}

          <button
            type="button"
            onClick={() => onSelect(business)}
            className="view"
            aria-label={`${t('viewProfile')} de ${business.name}`}
          >
            <span>{t('viewProfile')}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};
