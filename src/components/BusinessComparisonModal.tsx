import React from 'react';
import {
  X,
  CheckCircle2,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Award,
  Sparkles,
  Tag,
  DollarSign,
  ChevronRight,
  Building2,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import { Business, Language } from '../types';
import { getTranslation } from '../utils/i18n';

interface BusinessComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: Business[];
  onRemoveBusiness: (id: string) => void;
  onSelectBusiness: (b: Business) => void;
  currentLang: Language;
}

export const BusinessComparisonModal: React.FC<BusinessComparisonModalProps> = ({
  isOpen,
  onClose,
  businesses,
  onRemoveBusiness,
  onSelectBusiness,
  currentLang,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);

  React.useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.classList.remove('modal-open');
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 overflow-hidden overscroll-contain">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-1.5 font-bold text-xs border border-slate-700 shadow-xs"
              title={t('back')}
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">{t('back')}</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h2 className="font-extrabold text-base sm:text-lg text-white">
                  {t('compareBusinesses')}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {t('servicesProducts')} · {t('priceRange')} · {t('userRating')}
              </p>
            </div>
          </div>

          <button type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition"
            title={t('closeComparison')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Empty State */}
        {businesses.length === 0 ? (
          <div className="p-12 text-center space-y-4 my-auto">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">
              {t('noBusinessesSelected')}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Selecione até 3 empresas no diretório marcando a opção "{t('compare')}" para visualizar a tabela detalhada de serviços, preços e avaliações.
            </p>
            <button type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl transition shadow"
            >
              {t('back')}
            </button>
          </div>
        ) : (
          /* Table Comparison Container */
          <div className="p-4 sm:p-6 overflow-x-auto overflow-y-auto flex-1 space-y-6">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr>
                  <th className="p-3 w-40 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 rounded-tl-2xl">
                    {t('locationAddress')}
                  </th>
                  {businesses.map((b) => (
                    <th key={b.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 min-w-[220px] text-center relative border-l border-slate-200 dark:border-slate-800">
                      <button type="button"
                        onClick={() => onRemoveBusiness(b.id)}
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full transition"
                        title="Remover da comparação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex flex-col items-center space-y-2 pt-2">
                        <img
                          src={b.logo}
                          alt={b.name}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow"
                        />
                        <div className="text-center">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-center gap-1">
                            <span>{b.name}</span>
                            {b.verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          </h4>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                            {b.subcategoryId}
                          </span>
                        </div>
                      </div>
                    </th>
                  ))}
                  {/* Empty Slot Fillers if less than 3 */}
                  {Array.from({ length: 3 - businesses.length }).map((_, idx) => (
                    <th key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-800/20 text-center border-l border-slate-200 dark:border-slate-800">
                      <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                        {t('availableSlot')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {/* Row 1: Avaliações dos Utilizadores */}
                <tr>
                  <td className="p-3.5 font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>{t('userRating')}</span>
                  </td>
                  {businesses.map((b) => (
                    <td key={b.id} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800">
                      <div className="inline-flex flex-col items-center bg-purple-50 dark:bg-purple-950/30 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/50">
                        <span className="font-black text-purple-700 dark:text-purple-300 text-xs">
                          {b.ratingLabel}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                          {b.reviewsCount} {t('reviewsCount')}
                        </span>
                      </div>
                    </td>
                  ))}
                  {Array.from({ length: 3 - businesses.length }).map((_, idx) => (
                    <td key={idx} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800 text-slate-400">-</td>
                  ))}
                </tr>

                {/* Row 2: Faixa de Preços & Ofertas */}
                <tr>
                  <td className="p-3.5 font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t('priceRange')}</span>
                  </td>
                  {businesses.map((b) => (
                    <td key={b.id} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800">
                      <div className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm tracking-widest">
                        {b.priceRange}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        {b.priceRange === '$'
                          ? 'Económico (< 5.000 XOF)'
                          : b.priceRange === '$$'
                          ? 'Acessível (5.000 - 15.000 XOF)'
                          : b.priceRange === '$$$'
                          ? 'Médio/Alto (15.000 - 35.000 XOF)'
                          : 'Premium (> 35.000 XOF)'}
                      </span>
                    </td>
                  ))}
                  {Array.from({ length: 3 - businesses.length }).map((_, idx) => (
                    <td key={idx} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800 text-slate-400">-</td>
                  ))}
                </tr>

                {/* Row 3: Serviços e Produtos Disponíveis */}
                <tr>
                  <td className="p-3.5 font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t('servicesProducts')}</span>
                  </td>
                  {businesses.map((b) => (
                    <td key={b.id} className="p-3.5 border-l border-slate-200 dark:border-slate-800 text-center">
                      <div className="space-y-1.5 max-w-[200px] mx-auto">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-[11px] font-bold">
                          {b.subcategoryId}
                        </span>
                        {b.promotions.length > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/30 p-1 rounded-lg border border-amber-200 dark:border-amber-800">
                            {b.promotions.length} {t('activePromotionsCount')}
                          </div>
                        )}
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-3 leading-tight mt-1">
                          {b.description}
                        </p>
                      </div>
                    </td>
                  ))}
                  {Array.from({ length: 3 - businesses.length }).map((_, idx) => (
                    <td key={idx} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800 text-slate-400">-</td>
                  ))}
                </tr>

                {/* Row 4: Localização & Endereço em Bissau */}
                <tr>
                  <td className="p-3.5 font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{t('locationAddress')}</span>
                  </td>
                  {businesses.map((b) => (
                    <td key={b.id} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {b.neighborhood}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                        {b.address}
                      </div>
                    </td>
                  ))}
                  {Array.from({ length: 3 - businesses.length }).map((_, idx) => (
                    <td key={idx} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800 text-slate-400">-</td>
                  ))}
                </tr>

                {/* Row 5: Horário de Funcionamento */}
                <tr>
                  <td className="p-3.5 font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{t('statusHours')}</span>
                  </td>
                  {businesses.map((b) => (
                    <td key={b.id} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        b.isOpenNow ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${b.isOpenNow ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {b.isOpenNow ? t('openNow') : t('closedNow')}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                        {b.openingHours}
                      </span>
                    </td>
                  ))}
                  {Array.from({ length: 3 - businesses.length }).map((_, idx) => (
                    <td key={idx} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800 text-slate-400">-</td>
                  ))}
                </tr>

                {/* Row 6: Contactos & Ações */}
                <tr>
                  <td className="p-3.5 font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t('directAction')}</span>
                  </td>
                  {businesses.map((b) => (
                    <td key={b.id} className="p-3.5 border-l border-slate-200 dark:border-slate-800">
                      <div className="flex flex-col gap-2 max-w-[180px] mx-auto">
                        <a
                          href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}?text=Olá ${b.name}! Gostaria de informações.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>

                        <button type="button"
                          onClick={() => {
                            onClose();
                            onSelectBusiness(b);
                          }}
                          className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1"
                        >
                          <span>{t('viewProfile')}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  ))}
                  {Array.from({ length: 3 - businesses.length }).map((_, idx) => (
                    <td key={idx} className="p-3.5 text-center border-l border-slate-200 dark:border-slate-800 text-slate-400">-</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            {businesses.length} de 3 {t('selectedBusinesses')}
          </span>

          <div className="flex items-center gap-2">
            <button type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition"
            >
              {t('close')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
