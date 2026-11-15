import React from 'react';
import { Language, UserRole } from '../types';
import { getTranslation } from '../utils/i18n';
import { GuiguiStar } from './GuiguiStar';

interface FooterProps {
  currentLang: Language;
  currentRole?: UserRole;
  onTabChange: (tab: any) => void;
  sidebarOffset?: number;
}

export const Footer: React.FC<FooterProps> = ({ currentLang, currentRole = 'user', onTabChange, sidebarOffset = 0 }) => {
  const t = (key: string) => getTranslation(currentLang, key);

  return (
    <footer style={{ '--sidebar-offset': `${sidebarOffset}px` } as React.CSSProperties} className="guigui-profile-footer bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-10 px-4 mt-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Col 1 */}
        <div className="space-y-3">
          <div className="font-extrabold text-lg text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
              <GuiguiStar className="h-5 w-5" fill="#ffffff" stroke="#ffffff" />
            </div>
            <span>Guigui<span className="text-blue-400">.com</span></span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            {t('platformDescription')}
          </p>
          <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
            Propriedade de Guigui.com ⬢ 2026
          </div>
        </div>

        {/* Col 2 */}
        <div className="space-y-2">
          <h2 className="font-extrabold text-white uppercase tracking-wider text-[11px]">{t('navigation')}</h2>
          <ul className="space-y-2 text-slate-300">
            <li>
              <button type="button" onClick={() => onTabChange('directory')} className="hover:text-blue-400 transition">
                {t('navDirectory')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTabChange('promotions')} className="hover:text-amber-400 transition">
                {t('navPromotions')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTabChange('events')} className="hover:text-teal-300 transition">
                {t('navEvents')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onTabChange('institutional')} className="hover:text-blue-300 transition">
                {t('advertiseYourBusiness')}
              </button>
            </li>
          </ul>
        </div>

        {/* Col 3 */}
        <div className="space-y-2">
          <h2 className="font-extrabold text-white uppercase tracking-wider text-[11px]">{t('bissauZones')}</h2>
          <ul className="space-y-1.5 text-slate-400 text-[11px]">
            <li>⬢ Bissau Velho & Porto</li>
            <li>⬢ Mercado de Bandim</li>
            <li>⬢ Praça dos Heróis</li>
            <li>⬢ Santa Luzia & Estádio</li>
            <li>⬢ Chapa de Bissau & Cuntum</li>
          </ul>
        </div>

        {/* Col 4: Apenas acessos profissionais autorizados pelo papel activo */}
        {(currentRole === 'business' || currentRole === 'admin') && (
          <div className="space-y-3">
            <h2 className="font-extrabold text-white uppercase tracking-wider text-[11px]">{t('profileAccess')}</h2>
            <div className="space-y-2">
              {currentRole === 'business' && (
                <>
                  <button type="button"
                    onClick={() => onTabChange('client')}
                    className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2.5 rounded-xl text-blue-300 font-bold text-[11px] transition min-h-[40px]"
                  >
                    {t('myBusinessArea')}
                  </button>
                  <button type="button"
                    onClick={() => onTabChange('scanner')}
                    className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2.5 rounded-xl text-emerald-300 font-bold text-[11px] transition min-h-[40px]"
                  >
                    {t('myBusinessScanner')}
                  </button>
                </>
              )}
              {currentRole === 'admin' && (
                <button type="button"
                  onClick={() => onTabChange('admin')}
                  className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2.5 rounded-xl text-slate-300 font-bold text-[11px] transition min-h-[40px]"
                >
                  Administração Guigui
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-400 dark:text-slate-400">
        © 2026 Guigui.com. {t('allRightsReserved')}
      </div>
    </footer>
  );
};
