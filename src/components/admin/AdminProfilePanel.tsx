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
import { RoleCapabilitiesCard } from '../profile/RoleCapabilitiesCard';

interface AdminProfilePanelProps {
  currentLang: Language;
  currentThemeMode?: 'light' | 'dark' | 'auto';
  onLanguageChange?: (lang: Language) => void;
  onThemeModeChange?: (mode: 'light' | 'dark' | 'auto') => void;
  onNavigateTab?: (tab: string) => void;
}

/**
 * Linha de informação do perfil. Usa apenas tokens de tema, por isso o texto
 * acompanha o tema claro, escuro e sistema.
 */
const InfoRow: React.FC<{ label: string; value: string; icon?: React.ComponentType<{ className?: string }> }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] py-3 last:border-0">
    <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
      {Icon && <Icon className="h-4 w-4 shrink-0 text-[var(--color-green-600)] dark:text-[var(--color-green-300)]" />}
      <span className="truncate">{label}</span>
    </span>
    <span className="shrink-0 text-right text-xs font-bold text-[var(--color-text-strong)]">{value}</span>
  </div>
);

const SectionCard: React.FC<{ title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({
  title,
  icon: Icon,
  children,
}) => (
  <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-4 shadow-[var(--shadow-xs)] sm:p-5">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--color-text-strong)]">
      <Icon className="h-4 w-4 text-[var(--color-green-600)] dark:text-[var(--color-green-300)]" />
      {title}
    </h3>
    {children}
  </section>
);

const StatusChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-green-200)] bg-[var(--color-green-50)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-green-800)] dark:border-[var(--color-green-900)] dark:bg-[var(--color-green-950)]/40 dark:text-[var(--color-green-200)]">
    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
    {children}
  </span>
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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-green-700)] dark:text-[var(--color-green-300)]">
          {t('admin.myAccount')}
        </p>
        <h2 className="mt-1 text-2xl font-black tabular-nums text-[var(--color-text-strong)]">{t('admin.profile')}</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--color-text-muted)]">
          Gira os dados, preferências e segurança da sua conta de administrador.
        </p>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 shadow-[var(--shadow-xs)]">
        <div className="relative bg-[var(--color-bg-surface-dark)] p-3.5 sm:p-4">
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-[var(--color-green-800)] text-lg font-black text-[var(--color-gold-200)]">
                AD
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-gold-300)]">Administração</p>
                <p className="truncate text-lg font-black text-white">Admin Guigui</p>
                <p className="truncate text-xs font-semibold text-[var(--color-green-100)]">admin.teste@guigui.com · Administrador principal</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusChip>Sessão ativa</StatusChip>
              <StatusChip>2FA ativa</StatusChip>
              <StatusChip>Desde 15/01/2024</StatusChip>
            </div>
          </div>
        </div>
      </section>

      <RoleCapabilitiesCard role="admin" />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={t('admin.profile')} icon={UserRound}>
          <InfoRow label="Nome" value="Admin Guigui" />
          <InfoRow label="Foto/avatar" value="Avatar AD" />
          <InfoRow label="Função/cargo" value="Administrador principal" />
          <InfoRow label="Informações básicas da conta" value="admin.teste@guigui.com" />
        </SectionCard>

        <SectionCard title={t('admin.session')} icon={MonitorSmartphone}>
          <InfoRow label="Estado da sessão atual" value="Ativa" icon={CheckCircle2} />
          <InfoRow label="Último acesso" value="Hoje, 23:42" icon={CalendarDays} />
          <InfoRow label="Dispositivos/sessões ativas" value="1 dispositivo" icon={Laptop} />
          <InfoRow label="Terminar outras sessões" value="Nenhuma outra sessão ativa" />
        </SectionCard>

        <SectionCard title={t('admin.preferences')} icon={Palette}>
          <label className="mb-3 block text-xs font-bold text-[var(--color-text-muted)]">
            Tema
            <select
              value={currentThemeMode}
              onChange={(e) => onThemeModeChange?.(e.target.value as 'light' | 'dark' | 'auto')}
              className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            >
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
              <option value="auto">Sistema</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-[var(--color-text-muted)]">
            Idioma
            <select
              value={currentLang}
              onChange={(e) => onLanguageChange?.(e.target.value as Language)}
              className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            >
              <option value="pt">{t('language.portuguese')}</option>
              <option value="en">{t('language.english')}</option>
              <option value="fr">{t('language.french')}</option>
              <option value="es">{t('language.spanish')}</option>
            </select>
          </label>
          <div className="mt-3 space-y-2 text-xs font-semibold text-[var(--color-text-default)]">
            <p className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Preferências de interface</p>
            <p className="flex items-center gap-2"><Bell className="h-4 w-4" /> Preferências de notificações</p>
          </div>
        </SectionCard>

        <SectionCard title={t('admin.accountSecurity')} icon={ShieldCheck}>
          <InfoRow label="Alterar palavra-passe" value="Atualizada recentemente" icon={KeyRound} />
          <InfoRow label="Autenticação de dois fatores (2FA)" value="Ativada" icon={LockKeyhole} />
          <InfoRow label="Atividade de acesso" value="Sem alertas recentes" icon={ShieldCheck} />
        </SectionCard>
      </div>

      <SectionCard title="Informações da conta" icon={CalendarDays}>
        <div className="grid gap-x-8 md:grid-cols-3">
          <InfoRow label="Data de criação" value="15/01/2024" />
          <InfoRow label="Estado da conta" value="Ativa" />
          <InfoRow label="Última atualização do perfil" value="02/09/2026" />
        </div>
      </SectionCard>
    </div>
  );
};
