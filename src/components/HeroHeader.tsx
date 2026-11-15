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

  const [neighborhoodsOpen, setNeighborhoodsOpen] = React.useState(false);
  const [neighborhoodSearch, setNeighborhoodSearch] = React.useState('');
  const [quickFilter, setQuickFilter] = React.useState<'restaurant' | 'pharmacy' | 'events' | 'publicservices' | null>(null);

  const neighborhoods = [
    'Bissau Velho',
    'Bandim',
    'Praça',
    'Santa Luzia',
    'Chapa de Bissau',
    'Cuntum',
    'Bairro de Penha',
  ];

  const openNeighborhoodList = () => setNeighborhoodsOpen(true);
  const closeNeighborhoodList = () => { setNeighborhoodsOpen(false); setNeighborhoodSearch(''); };
  const selectNeighborhood = (name: string | null) => {
    onSelectNeighborhood(name);
    closeNeighborhoodList();
  };

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
        <div className="bg-white dark:bg-slate-900 text-slate-900 rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-blue-600 text-slate-900 text-xs sm:text-sm rounded-xl py-3 pl-10 pr-4 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
              />
            </div>

            {/* Neighborhood Selector (All / List) */}
            <div className="md:col-span-4">
              <label className="sr-only">Filtrar por localização</label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 z-10" />
                <button
                  type="button"
                  onClick={openNeighborhoodList}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-blue-600 text-slate-800 text-xs sm:text-sm rounded-xl py-3 pl-10 pr-9 focus:outline-none cursor-pointer"
                  aria-haspopup="listbox"
                  aria-expanded={neighborhoodsOpen}
                  aria-controls="neighborhood-listbox"
                >
                  {selectedNeighborhood ? selectedNeighborhood : t('allLocations')}
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform ${neighborhoodsOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
              {neighborhoodsOpen && (
                <div
                  id="neighborhood-listbox"
                  className="absolute left-0 right-0 z-20 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden dark:bg-slate-900 dark:border-slate-700"
                  role="listbox"
                  aria-labelledby="neighborhood-label"
                >
                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        id="neighborhood-search"
                        type="search"
                        aria-label="Pesquisar bairro"
                        value={neighborhoodSearch}
                        onChange={(e) => setNeighborhoodSearch(e.target.value)}
                        placeholder="Pesquisar bairro..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={closeNeighborhoodList}
                        className="text-slate-500 hover:text-slate-700 p-1"
                        aria-label="Fechar"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    <button
                      type="button"
                      onClick={() => selectNeighborhood(null)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition mb-1 ${
                        selectedNeighborhood === null
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      role="option"
                      aria-selected={selectedNeighborhood === null}
                    >
                      <span className="inline-flex items-center gap-2 w-full">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                          </svg>
                        </span>
                        {t('allLocations')}
                      </span>
                    </button>  
                    {neighborhoods
                      .filter((n) => !neighborhoodSearch || n.toLowerCase().includes(neighborhoodSearch.toLowerCase()))
                      .map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => selectNeighborhood(n)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition mb-1 ${
                            selectedNeighborhood === n
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          role="option"
                          aria-selected={selectedNeighborhood === n}
                        >
                          <span className="inline-flex items-center gap-2 w-full">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs">
                              <MapPin className="w-3.5 h-3.5" />
                            </span>
                            {n}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Filter Row (All / Restaurants / Pharmacies / Events This Week / Public Services) */}
            <div className="md:col-span-7 flex flex-wrap items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => { onSelectCategory(null); closeNeighborhoodList(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  selectedCategory === null
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                {t('filterAll')}
              </button>
              <button
                type="button"
                onClick={() => { setQuickFilter('restaurant'); closeNeighborhoodList(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  quickFilter === 'restaurant'
                    ? 'bg-amber-400 text-amber-900 border-amber-400 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" />
                  <path d="M7 6h10l-2 6H9Z" />
                  <path d="M9 12h6M9 15h2" />
                </svg>
                {t('filterRestaurants')}
              </button>
              <button
                type="button"
                onClick={() => { setQuickFilter('pharmacy'); closeNeighborhoodList(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  quickFilter === 'pharmacy'
                    ? 'bg-blue-400 text-blue-900 border-blue-400 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M11 20a7 7 0 1 0 0-14 3 3 0 0 1 0-6 3 3 0 0 1 0 6 9 9 0 0 0 0 14z" />
                  <path d="M12 14v4M9 16h6" />
                  <circle cx="12" cy="12" r="1.5" />
                </svg>
                {t('filterPharmacies')}
              </button>
              <button
                type="button"
                onClick={() => { setQuickFilter('events'); closeNeighborhoodList(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  quickFilter === 'events'
                    ? 'bg-violet-400 text-violet-900 border-violet-400 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                </svg>
                {t('filterEventsThisWeek')}
              </button>
              <button
                type="button"
                onClick={() => { setQuickFilter('publicservices'); closeNeighborhoodList(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  quickFilter === 'publicservices'
                    ? 'bg-emerald-400 text-emerald-900 border-emerald-400 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l7-4 7 4v14" />
                  <path d="M9 21h6" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
                {t('filterPublicServices')}
              </button>
              <button
                type="button"
                onClick={openNeighborhoodList}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
                aria-label="Ver todos os bairros"
              >
                <MapPin className="w-3.5 h-3.5" />
                Todos
              </button>
            </div>

            {/* Quick Toggle Buttons */}
            <div className="md:col-span-5 flex flex-wrap items-center gap-2 w-full">
              <button type="button"
                onClick={() => onToggleOpenNow(!onlyOpenNow)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  onlyOpenNow
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                    : 'bg-white dark:bg-slate-900 border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <Clock className="w-3 h-3" />
                {t('openNowShort')}
              </button>

              <button type="button"
                onClick={() => onTogglePromotions(!onlyWithPromotions)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  onlyWithPromotions
                    ? 'bg-amber-100 border-amber-500 text-amber-900'
                    : 'bg-white dark:bg-slate-900 border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <Tag className="w-3 h-3" />
                {t('promotions')}
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
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 hover:bg-slate-200'
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
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 hover:bg-slate-200'
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
