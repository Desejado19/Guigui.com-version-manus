import React from 'react';
import { Search, MapPin, Tag, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Language, BusinessCategory } from '../types';
import { getTranslation } from '../utils/i18n';

interface HeroHeaderProps {
  currentLang: Language;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string | null;
  onSelectCategory: (catId: string | null) => void;
  selectedNeighborhood: string | null;
  onSelectNeighborhood: (n: string | null) => void;
  onlyOpenNow: boolean;
  onToggleOpenNow: (open: boolean) => void;
  onlyWithPromotions: boolean;
  onTogglePromotions: (promo: boolean) => void;
  categories: BusinessCategory[];
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({
  currentLang,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  selectedNeighborhood,
  onSelectNeighborhood,
  onlyOpenNow,
  onToggleOpenNow,
  onlyWithPromotions,
  onTogglePromotions,
  categories,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);

  const neighborhoods = [
    'Bissau Velho',
    'Bandim',
    'Praça',
    'Santa Luzia',
    'Chapa de Bissau',
    'Cuntum',
    'Bairro de Penha',
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white py-8 sm:py-12 px-4 relative">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Title Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-300 text-xs px-3 py-1 rounded-full border border-slate-700 font-semibold">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>{t('heroBadge')}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            {t('heroTitle')}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t('heroDescription')}
          </p>
        </div>

        {/* Clean Search & Filter Box */}
        <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label={t('search')}
                placeholder={t('searchPlaceholder')}
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 text-slate-900 text-xs sm:text-sm rounded-xl py-3 pl-10 pr-4 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
              />
            </div>

            {/* Neighborhood Selector */}
            <div className="md:col-span-4 relative">
              <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600" />
              <select
                aria-label="Filtrar por localização"
                value={selectedNeighborhood || ''}
                onChange={(e) => onSelectNeighborhood(e.target.value || null)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 text-slate-800 text-xs sm:text-sm rounded-xl py-3 pl-10 pr-4 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">{t('allLocations')}</option>
                {neighborhoods.map((n) => (
                  <option key={n} value={n}>
                    {t('locationOption')}: {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Toggle Buttons */}
            <div className="md:col-span-3 flex items-center gap-2">
              <button type="button"
                onClick={() => onToggleOpenNow(!onlyOpenNow)}
                className={`flex-1 py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition min-h-[44px] ${
                  onlyOpenNow
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('openNowShort')}</span>
              </button>

              <button type="button"
                onClick={() => onTogglePromotions(!onlyWithPromotions)}
                className={`flex-1 py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition min-h-[44px] ${
                  onlyWithPromotions
                    ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>{t('promotions')}</span>
              </button>
            </div>
          </div>

          {/* Streamlined Categories Bar */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 pb-1 text-xs">
            <button type="button"
              onClick={() => onSelectCategory(null)}
              className={`whitespace-nowrap px-3.5 py-2 rounded-xl border font-semibold transition min-h-[38px] ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t('allCategories')}
            </button>

            {categories.slice(0, 8).map((cat) => (
              <button type="button"
                key={cat.id}
                onClick={() => onSelectCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl border font-semibold transition min-h-[38px] ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Clean Metrics Summary */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300 pt-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span><strong className="text-white font-bold">150+</strong> {t('businessesRegistered')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span><strong className="text-white font-bold">100%</strong> {t('verifiedContacts')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-300" />
            <span><strong className="text-white font-bold">{t('qrTicketsBySms')}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
