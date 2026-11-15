import React, { useEffect, useState } from 'react';
import {
  Settings,
  User,
  Shield,
  Key,
  Users,
  CheckCircle2,
  AlertCircle,
  Lock,
  Plus,
  Trash2,
  Smartphone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Business, Language, NotificationPreferences } from '../../types';
import { NotificationPreferencesPanel } from '../NotificationPreferencesPanel';
import { getTranslation } from '../../utils/i18n';

interface ClientSettingsHubProps {
  business: Business;
  currentLang?: Language;
  accountEmail?: string;
  notificationPreferences?: NotificationPreferences;
  onNotificationPreferencesChange?: (next: NotificationPreferences) => void;
}

export const ClientSettingsHub: React.FC<ClientSettingsHubProps> = ({
  business,
  currentLang = 'pt' as Language,
  accountEmail,
  notificationPreferences,
  onNotificationPreferencesChange,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [settingsNoticeIsError, setSettingsNoticeIsError] = useState(false);
  const staffStorageKey = `guigui_business_staff_${business.id}`;

  // Authorized operators/staff members. The list is persisted per business in the demo.
  const [staffMembers, setStaffMembers] = useState(() => {
    try {
      const saved = localStorage.getItem(staffStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore malformed local data
    }
    return [
      { id: 'st-1', name: 'Gerente Principal', email: 'gerente@coqueiros.gw', role: 'Administrador da Loja' },
      { id: 'st-2', name: 'Caixa / Scanner Portaria', email: 'caixa@coqueiros.gw', role: 'Validador de Vouchers' },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(staffStorageKey, JSON.stringify(staffMembers));
    } catch {
      // ignore storage quota errors
    }
  }, [staffMembers, staffStorageKey]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Validador de Vouchers');

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newStaffName.trim();
    const cleanEmail = newStaffEmail.trim().toLowerCase();
    if (!cleanName || !cleanEmail) return;
    if (staffMembers.some((member) => member.email.toLowerCase() === cleanEmail)) {
      setSettingsNoticeIsError(true);
      setSettingsNotice('Este e-mail já está associado a um colaborador desta empresa.');
      return;
    }
    setStaffMembers((previous) => [
      ...previous,
      { id: `st-${Date.now()}`, name: cleanName, email: cleanEmail, role: newStaffRole },
    ]);
    setNewStaffName('');
    setNewStaffEmail('');
    setSettingsNoticeIsError(false);
    setSettingsNotice('Colaborador adicionado e guardado nesta empresa.');
  };

  const handleRemoveStaff = (id: string) => {
    setStaffMembers((previous) => previous.filter((member) => member.id !== id));
    setSettingsNoticeIsError(false);
    setSettingsNotice('Colaborador removido e lista actualizada.');
  };

  // ===== Account Data Form Validation =====
  interface AccountFormValues {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    accountType: string;
  }

  interface AccountFormErrors {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    accountType: string;
  }

  const [accountForm, setAccountForm] = useState<AccountFormValues>({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    accountType: 'active',
  });

  const [accountFormErrors, setAccountFormErrors] = useState<AccountFormErrors>({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    accountType: '',
  });

  const validateFullName = (name: string) => {
    if (!name.trim()) {
      setAccountFormErrors((prev) => ({ ...prev, fullName: 'Nome completo é obrigatório.' }));
      return false;
    }
    if (name.trim().length < 2) {
      setAccountFormErrors((prev) => ({ ...prev, fullName: 'Nome deve ter pelo menos 2 caracteres.' }));
      return false;
    }
    setAccountFormErrors((prev) => ({ ...prev, fullName: '' }));
    return true;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim()) {
      setAccountFormErrors((prev) => ({ ...prev, email: 'E-mail é obrigatório.' }));
      return false;
    }
    if (!emailRegex.test(email)) {
      setAccountFormErrors((prev) => ({ ...prev, email: 'Por favor, insira um e-mail válido.' }));
      return false;
    }
    setAccountFormErrors((prev) => ({ ...prev, email: '' }));
    return true;
  };

  const validatePhone = (phone: string) => {
    if (!phone.trim()) {
      setAccountFormErrors((prev) => ({ ...prev, phone: 'Telefone é obrigatório.' }));
      return false;
    }
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      setAccountFormErrors((prev) => ({ ...prev, phone: 'Por favor, insira um número de telefone válido.' }));
      return false;
    }
    setAccountFormErrors((prev) => ({ ...prev, phone: '' }));
    return true;
  };

  const validateDateOfBirth = (dob: string) => {
    if (!dob.trim()) {
      setAccountFormErrors((prev) => ({ ...prev, dateOfBirth: 'Data de nascimento é obrigatória.' }));
      return false;
    }
    const date = new Date(dob);
    if (isNaN(date.getTime())) {
      setAccountFormErrors((prev) => ({ ...prev, dateOfBirth: 'Data de nascimento inválida.' }));
      return false;
    }
    const today = new Date();
    if (date >= today) {
      setAccountFormErrors((prev) => ({ ...prev, dateOfBirth: 'Data de nascimento deve ser no passado.' }));
      return false;
    }
    setAccountFormErrors((prev) => ({ ...prev, dateOfBirth: '' }));
    return true;
  };

  const validateAccountType = (type: string) => {
    if (!type) {
      setAccountFormErrors((prev) => ({ ...prev, accountType: 'Tipo de conta é obrigatório.' }));
      return false;
    }
    setAccountFormErrors((prev) => ({ ...prev, accountType: '' }));
    return true;
  };

  const handleAccountFormChange = (e: React.ChangeEvent) => {
    const { name, value } = e.target as HTMLInputElement | HTMLSelectElement;
    setAccountForm((prev) => ({ ...prev, [name]: value }));

    // Validate on change
    switch (name) {
      case 'fullName':
        validateFullName(value);
        break;
      case 'email':
        validateEmail(value);
        break;
      case 'phone':
        validatePhone(value);
        break;
      case 'dateOfBirth':
        validateDateOfBirth(value);
        break;
      case 'accountType':
        validateAccountType(value);
        break;
    }
  };

  const handleSaveAccountData = () => {
    const isFullNameValid = validateFullName(accountForm.fullName);
    const isEmailValid = validateEmail(accountForm.email);
    const isPhoneValid = validatePhone(accountForm.phone);
    const isDateOfBirthValid = validateDateOfBirth(accountForm.dateOfBirth);
    const isAccountTypeValid = validateAccountType(accountForm.accountType);

    if (isFullNameValid && isEmailValid && isPhoneValid && isDateOfBirthValid && isAccountTypeValid) {
      setSettingsNoticeIsError(false);
      setSettingsNotice('Dados da conta guardados com sucesso.');
      window.setTimeout(() => setSettingsNotice(null), 4000);
      setAccountForm({
        fullName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        accountType: 'active',
      });
      setAccountFormErrors({
        fullName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        accountType: '',
      });
    }
  };

  // ===== Theme & Language =====
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [theme]);

  const [preferredLanguage, setPreferredLanguage] = useState<Language>('pt');
  useEffect(() => {
    const saved = localStorage.getItem('guigui_preferred_language');
    if (saved && ['pt', 'en', 'fr', 'es'].includes(saved as Language)) {
      setPreferredLanguage(saved as Language);
    }
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setPreferredLanguage(lang);
    try {
      localStorage.setItem('guigui_preferred_language', lang);
    } catch {
      // ignore storage quota errors
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // ===== Module selector =====
  const [selectedModule, setSelectedModule] = useState<'conta' | 'preferencias' | 'configuracoes' | 'seguranca'>('conta');

  return (
    <div className="space-y-4">
      {/* Module selector */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-3 p-3.5 sm:p-4">
        <div className="flex gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setSelectedModule('conta')}
            className={`flex-1 rounded-t-xl px-4 py-2 text-xs font-bold transition ${selectedModule === 'conta' ? 'bg-[var(--color-green-700)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-strong)]'}`}
          >
            Dados e Conta
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule('preferencias')}
            className={`flex-1 rounded-t-xl px-4 py-2 text-xs font-bold transition ${selectedModule === 'preferencias' ? 'bg-[var(--color-green-700)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-strong)]'}`}
          >
            Perfil e Preferências
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule('configuracoes')}
            className={`flex-1 rounded-t-xl px-4 py-2 text-xs font-bold transition ${selectedModule === 'configuracoes' ? 'bg-[var(--color-green-700)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-strong)]'}`}
          >
            Configurações
          </button>
          <button
            type="button"
            onClick={() => setSelectedModule('seguranca')}
            className={`flex-1 rounded-t-xl px-4 py-2 text-xs font-bold transition ${selectedModule === 'seguranca' ? 'bg-[var(--color-green-700)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-strong)]'}`}
          >
            Segurança e Privacidade
          </button>
        </div>
      </div>

      {/* Module content - Dados e Conta */}
      {selectedModule === 'conta' && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-3.5 sm:p-4">
          <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            <span>{t('businessAccountData')}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('businessAccountDataDescription')}
          </p>

          <form className="space-y-4 max-w-xl" onSubmit={handleSaveAccountData}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('fullName')}
                {accountFormErrors.fullName && (
                  <span className="text-xs text-red-600 mt-1 block">{accountFormErrors.fullName}</span>
                )}
              </label>
              <input
                type="text"
                name="fullName"
                value={accountForm.fullName}
                onChange={handleAccountFormChange}
                placeholder="Nome completo"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('email')}
                  {accountFormErrors.email && (
                    <span className="text-xs text-red-600 mt-1 block">{accountFormErrors.email}</span>
                  )}
                </label>
                <input
                  type="email"
                  name="email"
                  value={accountForm.email}
                  onChange={handleAccountFormChange}
                  placeholder="email@empresa.gw"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('phone')}
                  {accountFormErrors.phone && (
                    <span className="text-xs text-red-600 mt-1 block">{accountFormErrors.phone}</span>
                  )}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={accountForm.phone}
                  onChange={handleAccountFormChange}
                  placeholder="+351 912 345 678"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('dateOfBirth')}
                {accountFormErrors.dateOfBirth && (
                  <span className="text-xs text-red-600 mt-1 block">{accountFormErrors.dateOfBirth}</span>
                )}
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={accountForm.dateOfBirth}
                onChange={handleAccountFormChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('accountType')}
                {accountFormErrors.accountType && (
                  <span className="text-xs text-red-600 mt-1 block">{accountFormErrors.accountType}</span>
                )}
              </label>
              <select
                name="accountType"
                value={accountForm.accountType}
                onChange={handleAccountFormChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="active">{t('active')}</option>
                <option value="expired">{t('expired')}</option>
                <option value="suspended">{t('suspended')}</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
            >
              {t('saveChanges')}
            </button>
          </form>
        </div>
      )}

      {selectedModule === 'preferencias' && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-3.5 sm:p-4">
          <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>{t('profileAndPreferences')}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('profileAndPreferencesDescription')}
          </p>
        </div>
      )}

      {selectedModule === 'configuracoes' && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-3.5 sm:p-4">
          <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <span>{t('systemSettings')}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('systemSettingsDescription')}
          </p>
        </div>
      )}

      {selectedModule === 'seguranca' && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-3.5 sm:p-4">
          <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-600" />
            <span>{t('securityAndPrivacy')}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('securityAndPrivacyDescription')}
          </p>
        </div>
      )}
    </div>
  );
};
