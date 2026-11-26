import React from 'react';
import {
  Home,
  Store,
  Tag,
  Calendar,
  Sparkles,
  QrCode,
  LayoutDashboard,
  ShieldCheck,
  MapPin,
  Building2,
  CheckCircle2,
  User,
  ArrowRightLeft,
} from 'lucide-react';
import { Language, UserRole } from '../types';

interface FacebookLeftSidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentTab: string;
  onTabChange: (tab: any) => void;
  selectedNeighborhood: string | null;
  onSelectNeighborhood: (neighborhood: string | null) => void;
  currentLang: Language;
}

export const FacebookLeftSidebar: React.FC<FacebookLeftSidebarProps> = ({
  currentRole,
  onRoleChange,
  currentTab,
  onTabChange,
  selectedNeighborhood,
  onSelectNeighborhood,
}) => {
  const neighborhoods = [
    'Bissau Velho',
    'Bandim',
    'Praça',
    'Santa Luzia',
    'Chapa',
    'Cuntum',
  ];

  return (
    <aside className="w-64 xl:w-72 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto no-scrollbar py-4 pr-2 space-y-6 text-slate-800 dark:text-slate-100 text-xs">
      {/* Profile Header based on active UserRole */}
      <div
        onClick={() => {
          if (currentRole === 'admin') onTabChange('admin');
          else if (currentRole === 'business') onTabChange('client');
          else onTabChange('feed');
        }}
        className={`border rounded-2xl p-3.5 flex items-center gap-3 shadow-sm transition cursor-pointer ${ currentRole === 'admin' ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800' : currentRole === 'business' ? 'bg-blue-50 border-blue-200 text-slate-900 hover:bg-blue-100/60' : 'bg-white dark:bg-slate-900 border-[var(--color-border-subtle)] dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50' }`}
      >
        <div
          className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0 ${ currentRole === 'admin' ? 'bg-slate-900 text-white' : currentRole === 'business' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white' }`}
        >
          {currentRole === 'admin' ? <ShieldCheck className="w-5 h-5" aria-hidden="true" /> : currentRole === 'business' ? <Building2 className="w-5 h-5" aria-hidden="true" /> : <User className="w-5 h-5" aria-hidden="true" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-xs flex items-center gap-1 truncate">
            <span>
              {currentRole === 'admin'
                ? 'Administração Guigui.com'
                : currentRole === 'business'
                ? 'Restaurante Coqueiros'
                : 'Utilizador Simples'}
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-blue-600)] flex-shrink-0" />
          </div>
          <p className={`text-[10px] truncate mt-0.5 ${currentRole === 'admin' ? 'text-slate-300' : 'text-slate-500'}`}>
            {currentRole === 'admin'
              ? 'Super Admin • Guigui.com'
              : currentRole === 'business'
              ? 'Comerciante • Bissau Velho'
              : 'Cidadão / Visitante • Bissau'}
          </p>
        </div>
      </div>

      {/* Main Social Navigation Links */}
      <div className="space-y-1">
        <button type="button"
          onClick={() => onTabChange('feed')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition text-xs ${ currentTab === 'feed' ? 'bg-[var(--color-blue-50)] text-[var(--color-blue-600)]' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-blue-600)]/10 flex items-center justify-center text-[var(--color-blue-600)]">
            <Home className="w-5 h-5" />
          </div>
          <span>Feed Social Bissau</span>
        </button>

        <button type="button"
          onClick={() => onTabChange('directory')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition text-xs ${ currentTab === 'directory' ? 'bg-[var(--color-blue-50)] text-[var(--color-blue-600)]' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Store className="w-5 h-5" />
          </div>
          <span>Marketplace Directório</span>
        </button>

        <button type="button"
          onClick={() => onTabChange('promotions')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition text-xs ${ currentTab === 'promotions' ? 'bg-[var(--color-blue-50)] text-[var(--color-blue-600)]' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
        >
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Tag className="w-5 h-5" />
          </div>
          <span>Promoções & Descontos</span>
        </button>

        <button type="button"
          onClick={() => onTabChange('events')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition text-xs ${ currentTab === 'events' ? 'bg-[var(--color-blue-50)] text-[var(--color-blue-600)]' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
        >
          <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600">
            <Calendar className="w-5 h-5" />
          </div>
          <span>Agenda Cultural & Bilhetes</span>
        </button>

        <button type="button"
          onClick={() => onTabChange('institutional')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition text-xs ${ currentTab === 'institutional' ? 'bg-[var(--color-blue-50)] text-[var(--color-blue-600)]' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
        >
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <span>Anuncie a sua Empresa</span>
        </button>
      </div>

      {/* Professional Access Shortcuts */}
      <div className="pt-4 border-t border-[var(--color-border-subtle)]/80 dark:border-slate-700 space-y-1">
        <div className="px-3 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Modo de Acesso ({currentRole.toUpperCase()})</span>
        </div>

        {currentRole === 'user' && (
          <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl space-y-2">
            <div className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[var(--color-blue-600)]" />
              <span>É Comerciante em Bissau?</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              Anuncie a sua empresa, publique ofertas com IA e receba clientes via WhatsApp.
            </p>
            <button type="button"
              onClick={() => {
                onRoleChange('business');
                onTabChange('client');
              }}
              className="w-full bg-[var(--color-blue-600)] hover:bg-blue-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Ativar Perfil Empresa</span>
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {currentRole === 'business' && (
          <>
            <button type="button"
              onClick={() => onTabChange('client')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition text-xs ${ currentTab === 'client' ? 'bg-[var(--color-blue-50)] text-[var(--color-blue-600)]' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
            >
              <LayoutDashboard className="w-4 h-4 text-[var(--color-blue-600)]" />
              <span>Painel do Comerciante</span>
            </button>
            <button type="button"
              onClick={() => onTabChange('promotions')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-[var(--color-neutral-200)]/60 transition text-xs"
            >
              <Tag className="w-4 h-4 text-amber-600" />
              <span>Criar Oferta Promocional</span>
            </button>
          </>
        )}

        {currentRole === 'admin' && (
          <>
            <button type="button"
              onClick={() => onTabChange('admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition text-xs ${ currentTab === 'admin' ? 'bg-slate-900 text-white font-bold' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Painel Super Admin</span>
            </button>
          </>
        )}
      </div>

      {/* Neighborhoods Shortcut Filter */}
      <div className="pt-4 border-t border-[var(--color-border-subtle)]/80 dark:border-slate-700 space-y-2">
        <div className="px-3 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            Zonas de Bissau
          </span>
          {selectedNeighborhood && (
            <button type="button"
              onClick={() => onSelectNeighborhood(null)}
              className="text-[var(--color-blue-600)] hover:underline text-[10px]"
            >
              Ver Todas
            </button>
          )}
        </div>

        <div className="space-y-1">
          {neighborhoods.map((n) => (
            <button type="button"
              key={n}
              onClick={() => {
                onSelectNeighborhood(selectedNeighborhood === n ? null : n);
                if (currentTab !== 'directory' && currentTab !== 'feed') {
                  onTabChange('feed');
                }
              }}
              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center justify-between ${ selectedNeighborhood === n ? 'bg-[var(--color-blue-600)] text-white font-bold' : 'hover:bg-[var(--color-neutral-200)]/60 text-slate-700' }`}
            >
              <span>📍 {n}</span>
              <span className="text-[10px] opacity-70">Bissau</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pt-4 border-t border-[var(--color-border-subtle)] dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-500 space-y-1">
        <p>© 2026 Guigui.com</p>
        <p>Privacidade • Termos • Publicidade • Guigui.com</p>
      </div>
    </aside>
  );
};
