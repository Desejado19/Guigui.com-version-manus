import React from 'react';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Globe2,
  KeyRound,
  Laptop,
  LockKeyhole,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { Language } from '../../types';
import { getTranslation } from '../../utils/i18n';

interface AdminProfilePanelProps {
  currentLang: Language;
  currentThemeMode?: 'light' | 'dark' | 'auto';
  onLanguageChange?: (lang: Language) => void;
  onThemeModeChange?: (mode: 'light' | 'dark' | 'auto') => void;
  onNavigateTab: (tab: string) => void;
}

const InfoRow: React.FC<{ label: string; value: string; icon?: React.ComponentType<{ className?: string }> }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
    <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
      {Icon && <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
      {label}
    </span>
    <span className="text-right text-xs font-bold text-slate-800 dark:text-slate-100">{value}</span>
  </div>
);

export const AdminProfilePanel: React.FC<AdminProfilePanelProps> = ({
  currentLang,
  currentThemeMode = 'auto',
  onLanguageChange,
  onThemeModeChange,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  return (
  <div className="space-y-5">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">{t('admin.myAccount')}</p>
      <h2 className="mt-1 text-2xl font-black tabular-nums text-[var(--color-text-strong)] dark:text-white">{t('admin.profile')}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gira os dados, preferências e segurança da sua conta de administrador.</p>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--color-text-strong)]"><UserRound className="h-4 w-4 text-emerald-600" /> {t('admin.profile')}</h3>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#123e3b] text-lg font-black text-[#f0d59c]">AD</div>
          <div><p className="font-black text-slate-900 dark:text-white">Admin Guigui</p><p className="text-xs text-slate-500 dark:text-slate-400">Administrador principal</p></div>
        </div>
        <InfoRow label="Nome" value="Admin Guigui" />
        <InfoRow label="Foto/avatar" value="Avatar AD" />
        <InfoRow label="Função/cargo" value="Administrador principal" />
        <InfoRow label="Informações básicas da conta" value="admin.teste@guigui.com" />
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--color-text-strong)]"><MonitorSmartphone className="h-4 w-4 text-emerald-600" /> {t('admin.session')}</h3>
        <InfoRow label="Estado da sessão atual" value="Ativa" icon={CheckCircle2} />
        <InfoRow label="Último acesso" value="Hoje, 23:42" icon={CalendarDays} />
        <InfoRow label="Dispositivos/sessões ativas" value="1 dispositivo" icon={Laptop} />
        <InfoRow label="Terminar outras sessões" value="Nenhuma outra sessão ativa" />
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--color-text-strong)]"><Palette className="h-4 w-4 text-emerald-600" /> {t('admin.preferences')}</h3>
        <label className="mb-3 block text-xs font-bold text-slate-500 dark:text-slate-400">Tema
          <select value={currentThemeMode} onChange={(e) => onThemeModeChange?.(e.target.value as 'light' | 'dark' | 'auto')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="light">Claro</option><option value="dark">Escuro</option><option value="auto">Sistema</option>
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">Idioma
          <select value={currentLang} onChange={(e) => onLanguageChange?.(e.target.value as Language)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="pt">{t('language.portuguese')}</option>
            <option value="en">{t('language.english')}</option>
            <option value="fr">{t('language.french')}</option>
            <option value="es">{t('language.spanish')}</option>
          </select>
        </label>
        <div className="mt-3 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><p className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Preferências de interface</p><p className="flex items-center gap-2"><Bell className="h-4 w-4" /> Preferências de notificações</p></div>
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--color-text-strong)]"><ShieldCheck className="h-4 w-4 text-emerald-600" /> {t('admin.accountSecurity')}</h3>
        <InfoRow label="Alterar palavra-passe" value="Atualizada recentemente" icon={KeyRound} />
        <InfoRow label="Autenticação de dois fatores (2FA)" value="Ativada" icon={LockKeyhole} />
        <InfoRow label="Atividade de acesso" value="Sem alertas recentes" icon={ShieldCheck} />
      </section>
    </div>

    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--color-text-strong)]"><CalendarDays className="h-4 w-4 text-emerald-600" /> Informações da conta</h3>
      <div className="grid gap-x-8 md:grid-cols-3"><InfoRow label="Data de criação" value="15/01/2024" /><InfoRow label="Estado da conta" value="Ativa" /><InfoRow label="Última atualização do perfil" value="02/09/2026" /></div>
    </section>
  </div>
  );
};
