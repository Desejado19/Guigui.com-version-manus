import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Globe2,
  KeyRound,
  Languages,
  Loader2,
  LogOut,
  MonitorSmartphone,
  Moon,
  Settings,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import type { Business, Language, NotificationPreferences } from '../../types';
import { NotificationPreferencesPanel } from '../NotificationPreferencesPanel';
import { ChangePasswordCard } from '../security/ChangePasswordCard';

type SettingsSection = 'conta' | 'preferencias' | 'configuracoes' | 'seguranca';
type ThemeMode = 'light' | 'dark' | 'auto';

interface StaffSession {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface SecurityEvent {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  result: string;
  reason: string | null;
  createdAt: string;
}

interface ClientSettingsHubProps {
  business: Business;
  currentLang?: Language;
  accountEmail?: string;
  notificationPreferences?: NotificationPreferences;
  onNotificationPreferencesChange?: (next: NotificationPreferences) => void;
  currentThemeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  onLanguageChange?: (lang: Language) => void;
  onSaveBusiness?: (updated: Business) => Promise<void>;
}

interface CompanyDraft {
  name: string;
  phone: string;
  whatsapp: string;
  publicEmail: string;
  website: string;
  neighborhood: string;
  address: string;
  openingHours: string;
  facebook: string;
  instagram: string;
}

const OPTIONAL_PUBLIC_FIELDS: Array<{ id: 'address' | 'openingHours' | 'publicEmail' | 'whatsapp' | 'website' | 'socialLinks' | 'serviceLanguages'; label: string; help: string }> = [
  { id: 'address', label: 'Endereço completo', help: 'Rua, número e referência.' },
  { id: 'openingHours', label: 'Horário de funcionamento', help: 'Quando o negócio está aberto.' },
  { id: 'publicEmail', label: 'Email público', help: 'Email visível para clientes.' },
  { id: 'whatsapp', label: 'WhatsApp', help: 'Botão de conversa directa.' },
  { id: 'website', label: 'Website', help: 'Ligação para o site da empresa.' },
  { id: 'socialLinks', label: 'Redes sociais', help: 'Facebook e Instagram.' },
  { id: 'serviceLanguages', label: 'Idiomas de atendimento', help: 'Línguas faladas pela equipa.' },
];

const LANGUAGE_OPTIONS: Array<{ id: Language; label: string }> = [
  { id: 'pt', label: 'Português' },
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

const inputClass = 'w-full rounded-xl border border-[var(--color-border-default)] bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300';
const panelClass = 'rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] sm:p-4 dark:bg-slate-800';

function draftFromBusiness(business: Business): CompanyDraft {
  return {
    name: business.name ?? '',
    phone: business.phone ?? '',
    whatsapp: business.whatsapp ?? '',
    publicEmail: business.publicEmail ?? '',
    website: business.website ?? '',
    neighborhood: business.neighborhood ?? '',
    address: business.address ?? '',
    openingHours: business.openingHours ?? '',
    facebook: business.socialLinks?.facebook ?? '',
    instagram: business.socialLinks?.instagram ?? '',
  };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconhecido';
  const agent = userAgent.toLowerCase();
  if (agent.includes('android')) return 'Android';
  if (agent.includes('iphone') || agent.includes('ipad')) return 'iOS';
  if (agent.includes('windows')) return 'Windows';
  if (agent.includes('mac os')) return 'macOS';
  if (agent.includes('linux')) return 'Linux';
  return 'Navegador';
}

/**
 * Configuração da conta empresarial.
 *
 * Cada submódulo trabalha com dados reais: a conta lê e grava o perfil da
 * empresa através de `onSaveBusiness` (PATCH /api/businesses/:id/profile),
 * as preferências usam o painel de notificações e o idioma/tema da aplicação,
 * e a segurança usa as sessões e o histórico de auditoria do servidor.
 * Não há listas de demonstração guardadas no browser.
 */
export const ClientSettingsHub: React.FC<ClientSettingsHubProps> = ({
  business,
  currentLang = 'pt' as Language,
  accountEmail,
  notificationPreferences,
  onNotificationPreferencesChange,
  currentThemeMode = 'auto',
  onThemeModeChange,
  onLanguageChange,
  onSaveBusiness,
}) => {
  const [section, setSection] = useState<SettingsSection>('conta');
  const [draft, setDraft] = useState<CompanyDraft>(() => draftFromBusiness(business));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDraft(draftFromBusiness(business));
  }, [business.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const preferredLanguages = business.serviceLanguages ?? [];
  const notApplicable = business.notApplicableFields ?? [];

  const updateDraft = (field: keyof CompanyDraft, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const toggleLanguage = (language: Language) => {
    const next = preferredLanguages.includes(language)
      ? preferredLanguages.filter((item) => item !== language)
      : [...preferredLanguages, language];
    void persist({ serviceLanguages: next });
  };

  const togglePublicField = (fieldId: typeof OPTIONAL_PUBLIC_FIELDS[number]['id']) => {
    const next = notApplicable.includes(fieldId)
      ? notApplicable.filter((item) => item !== fieldId)
      : [...notApplicable, fieldId];
    void persist({ notApplicableFields: next });
  };

  const persist = useCallback(async (patch: Partial<Business>, successText = 'Alterações guardadas.') => {
    if (!onSaveBusiness) {
      setNotice({ type: 'error', text: 'A gravação do perfil da empresa não está disponível nesta sessão.' });
      return false;
    }
    setSaving(true);
    setNotice(null);
    try {
      await onSaveBusiness({ ...business, ...patch });
      setNotice({ type: 'success', text: successText });
      return true;
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível guardar as alterações.' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [business, onSaveBusiness]);

  const handleSaveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.name.trim().length < 2) {
      setNotice({ type: 'error', text: 'O nome da empresa deve ter pelo menos 2 caracteres.' });
      return;
    }
    if (!draft.phone.trim()) {
      setNotice({ type: 'error', text: 'O telefone de contacto é obrigatório.' });
      return;
    }
    if (draft.publicEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.publicEmail.trim())) {
      setNotice({ type: 'error', text: 'O email público não é válido.' });
      return;
    }
    const website = draft.website.trim();
    if (website && !/^https?:\/\/\S+$/i.test(website)) {
      setNotice({ type: 'error', text: 'O website deve começar por http:// ou https://.' });
      return;
    }
    await persist({
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      whatsapp: draft.whatsapp.trim(),
      publicEmail: draft.publicEmail.trim() || undefined,
      website: website || undefined,
      neighborhood: draft.neighborhood.trim(),
      address: draft.address.trim(),
      openingHours: draft.openingHours.trim(),
      socialLinks: {
        facebook: draft.facebook.trim() || undefined,
        instagram: draft.instagram.trim() || undefined,
      },
    }, 'Dados da empresa guardados.');
  };

  const sections: Array<{ id: SettingsSection; label: string; icon: typeof User }> = [
    { id: 'conta', label: 'Conta e dados', icon: User },
    { id: 'preferencias', label: 'Perfil e preferências', icon: Smartphone },
    { id: 'configuracoes', label: 'Funcionamento', icon: Settings },
    { id: 'seguranca', label: 'Segurança e privacidade', icon: Shield },
  ];

  return (
    <div className="space-y-4">
      <nav
        className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 shadow-[var(--shadow-xs)] dark:bg-slate-800"
        aria-label="Secções de configuração da empresa"
      >
        <div className="flex flex-wrap gap-2">
          {sections.map((entry) => {
            const Icon = entry.icon;
            const active = section === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSection(entry.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${active ? 'bg-[var(--color-green-700)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-strong)]'}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {entry.label}
              </button>
            );
          })}
        </div>
      </nav>

      {notice && (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'}`}
        >
          {notice.type === 'success'
            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span>{notice.text}</span>
        </p>
      )}

      {section === 'conta' && (
        <section className={panelClass}>
          <header className="mb-3">
            <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-100">
              <Building2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Conta e dados da empresa
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Estes dados aparecem no perfil público e são os mesmos que a plataforma usa para contactar a empresa.
            </p>
          </header>

          <dl className="mb-4 grid gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2">
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Email de acesso à conta</dt>
              <dd className="font-black text-slate-900 dark:text-slate-100">{accountEmail || 'Não disponível'}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Identificador da empresa</dt>
              <dd className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">{business.id}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Estado</dt>
              <dd className="font-black text-slate-900 dark:text-slate-100">
                {business.status === 'active' ? 'Ativa' : business.status === 'pending' ? 'Em aprovação' : business.status === 'suspended' ? 'Suspensa' : 'Rejeitada'}
                {business.verified ? ' · Verificada' : ''}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Plano</dt>
              <dd className="font-black text-slate-900 dark:text-slate-100">{business.planName || business.tier}</dd>
            </div>
          </dl>

          <form className="max-w-2xl space-y-3" onSubmit={handleSaveCompany}>
            <div>
              <label className={labelClass} htmlFor="settings-company-name">Nome da empresa</label>
              <input id="settings-company-name" className={inputClass} value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} required minLength={2} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="settings-company-phone">Telefone de contacto</label>
                <input id="settings-company-phone" type="tel" className={inputClass} value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} required />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-company-whatsapp">WhatsApp</label>
                <input id="settings-company-whatsapp" type="tel" className={inputClass} value={draft.whatsapp} onChange={(event) => updateDraft('whatsapp', event.target.value)} placeholder="+245 955 000 000" />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-company-email">Email público</label>
                <input id="settings-company-email" type="email" className={inputClass} value={draft.publicEmail} onChange={(event) => updateDraft('publicEmail', event.target.value)} placeholder="contacto@empresa.gw" />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-company-website">Website</label>
                <input id="settings-company-website" type="url" className={inputClass} value={draft.website} onChange={(event) => updateDraft('website', event.target.value)} placeholder="https://empresa.gw" />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-company-neighborhood">Bairro</label>
                <input id="settings-company-neighborhood" className={inputClass} value={draft.neighborhood} onChange={(event) => updateDraft('neighborhood', event.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-company-address">Endereço</label>
                <input id="settings-company-address" className={inputClass} value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="settings-company-facebook">Facebook</label>
                <input id="settings-company-facebook" className={inputClass} value={draft.facebook} onChange={(event) => updateDraft('facebook', event.target.value)} placeholder="https://facebook.com/…" />
              </div>
              <div>
                <label className={labelClass} htmlFor="settings-company-instagram">Instagram</label>
                <input id="settings-company-instagram" className={inputClass} value={draft.instagram} onChange={(event) => updateDraft('instagram', event.target.value)} placeholder="https://instagram.com/…" />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !onSaveBusiness}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Guardar dados da empresa
            </button>
          </form>
        </section>
      )}

      {section === 'preferencias' && (
        <section className={panelClass}>
          <header className="mb-3">
            <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-100">
              <Smartphone className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Perfil e preferências
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Idioma da conta, aparência e tipos de notificação que a equipa recebe.
            </p>
          </header>

          <div className="space-y-4">
            <div>
              <p className={labelClass}>Idioma da conta</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onLanguageChange?.(option.id)}
                    disabled={!onLanguageChange}
                    aria-pressed={currentLang === option.id}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${currentLang === option.id ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-[var(--color-border-subtle)] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    <Languages className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={labelClass}>Aparência</p>
              <div className="flex flex-wrap gap-2">
                {([{ id: 'light', label: 'Claro', icon: Sun }, { id: 'dark', label: 'Escuro', icon: Moon }, { id: 'auto', label: 'Sistema', icon: MonitorSmartphone }] as Array<{ id: ThemeMode; label: string; icon: typeof Sun }>).map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onThemeModeChange?.(option.id)}
                      disabled={!onThemeModeChange}
                      aria-pressed={currentThemeMode === option.id}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${currentThemeMode === option.id ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-[var(--color-border-subtle)] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                    >
                      <Icon className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {notificationPreferences && onNotificationPreferencesChange ? (
              <NotificationPreferencesPanel
                role="business"
                value={notificationPreferences}
                onChange={onNotificationPreferencesChange}
              />
            ) : (
              <p className="rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                As preferências de notificação não estão disponíveis nesta sessão.
              </p>
            )}
          </div>
        </section>
      )}

      {section === 'configuracoes' && (
        <section className={panelClass}>
          <header className="mb-3">
            <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-100">
              <Settings className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Funcionamento e visibilidade
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Horário, idiomas de atendimento e os campos que os clientes vêem no perfil público.
            </p>
          </header>

          <div className="space-y-5">
            <div>
              <label className={labelClass} htmlFor="settings-opening-hours">Horário de funcionamento</label>
              <textarea
                id="settings-opening-hours"
                className={`${inputClass} min-h-[70px]`}
                value={draft.openingHours}
                onChange={(event) => updateDraft('openingHours', event.target.value)}
                placeholder="Segunda a sexta, 08:00–18:00"
              />
              <button
                type="button"
                disabled={saving || !onSaveBusiness}
                onClick={() => void persist({ openingHours: draft.openingHours.trim() }, 'Horário guardado.')}
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Guardar horário
              </button>
            </div>

            <div>
              <p className={labelClass}>Idiomas de atendimento</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleLanguage(option.id)}
                    disabled={saving || !onSaveBusiness}
                    aria-pressed={preferredLanguages.includes(option.id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${preferredLanguages.includes(option.id) ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-[var(--color-border-subtle)] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={labelClass}>Campos mostrados no perfil público</p>
              <p className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Desligar um campo remove-o da ficha pública sem apagar os dados guardados.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {OPTIONAL_PUBLIC_FIELDS.map((field) => {
                  const visible = !notApplicable.includes(field.id);
                  return (
                    <li key={field.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] px-3 py-2 dark:border-slate-700">
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-slate-900 dark:text-slate-100">{field.label}</span>
                        <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">{field.help}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={visible}
                        aria-label={`Mostrar ${field.label} no perfil público`}
                        onClick={() => togglePublicField(field.id)}
                        disabled={saving || !onSaveBusiness}
                        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border transition disabled:opacity-60 ${visible ? 'border-emerald-500 bg-emerald-500' : 'border-[var(--color-border-default)] bg-slate-200 dark:border-slate-600 dark:bg-slate-700'}`}
                      >
                        <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${visible ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="flex items-start gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              O perfil público é actualizado assim que guardares; os clientes vêem sempre a versão mais recente.
            </p>
          </div>
        </section>
      )}

      {section === 'seguranca' && (
        <SecuritySection accountEmail={accountEmail} />
      )}
    </div>
  );
};

function SecuritySection({ accountEmail }: { accountEmail?: string }) {
  const [sessions, setSessions] = useState<StaffSession[] | null>(null);
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsResponse, eventsResponse] = await Promise.all([
        fetch('/api/auth/sessions', { headers: { Accept: 'application/json' } }),
        fetch('/api/security/events?limit=8', { headers: { Accept: 'application/json' } }),
      ]);
      if (sessionsResponse.ok) {
        const payload = await sessionsResponse.json() as { sessions?: StaffSession[] };
        setSessions(payload.sessions ?? []);
      } else {
        setSessions([]);
      }
      if (eventsResponse.ok) {
        const payload = await eventsResponse.json() as { events?: SecurityEvent[] };
        setEvents(payload.events ?? []);
      } else {
        setEvents([]);
      }
    } catch {
      setSessions([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const revokeSession = async (sessionId: string) => {
    setBusyId(sessionId);
    setMessage(null);
    try {
      const response = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível terminar esta sessão.');
      setSessions((previous) => (previous ?? []).filter((session) => session.id !== sessionId));
      setMessage({ type: 'success', text: 'Sessão terminada.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao terminar a sessão.' });
    } finally {
      setBusyId(null);
    }
  };

  const revokeAll = async () => {
    setBusyId('all');
    setMessage(null);
    try {
      const response = await fetch('/api/auth/sessions/revoke-all', { method: 'POST' });
      if (!response.ok) throw new Error('Não foi possível terminar as sessões.');
      setMessage({ type: 'success', text: 'Todas as sessões foram terminadas. Volta a iniciar sessão para continuar.' });
      setSessions([]);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao terminar as sessões.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={panelClass}>
      <header className="mb-3">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-100">
          <Shield className="h-4 w-4 text-rose-600" aria-hidden="true" />
          Segurança e privacidade
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Sessões activas, palavra-passe e histórico de segurança da conta empresarial.
        </p>
      </header>

      {message && (
        <p role="status" className={`mb-3 rounded-xl border px-3 py-2 text-xs font-bold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'}`}>
          {message.text}
        </p>
      )}

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className={labelClass}>Sessões activas</p>
            <button
              type="button"
              onClick={() => void revokeAll()}
              disabled={busyId !== null || !sessions?.length}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Terminar todas
            </button>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> A carregar sessões…
            </p>
          ) : sessions && sessions.length > 0 ? (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border-subtle)] px-3 py-2 dark:border-slate-700">
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900 dark:text-slate-100">
                      {deviceLabel(session.userAgent)}
                      {session.current ? ' · esta sessão' : ''}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Início {formatDateTime(session.createdAt)} · expira {formatDateTime(session.expiresAt)}
                      {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                    </span>
                  </span>
                  {!session.current && (
                    <button
                      type="button"
                      onClick={() => void revokeSession(session.id)}
                      disabled={busyId !== null}
                      aria-label="Terminar esta sessão"
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" /> Terminar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Não há sessões activas registadas.</p>
          )}
        </div>

        <ChangePasswordCard accountEmail={accountEmail} />

        <div>
          <p className={labelClass}>Actividade recente de segurança</p>
          {loading ? (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">A carregar…</p>
          ) : events && events.length > 0 ? (
            <ul className="space-y-1.5">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] px-3 py-1.5 text-[11px] dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{event.action.replace(/_/g, ' ')}</span>
                  <span className={`font-black uppercase tracking-wide ${event.result === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                    {event.result}
                  </span>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{formatDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Sem eventos de segurança disponíveis para esta conta.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default ClientSettingsHub;
