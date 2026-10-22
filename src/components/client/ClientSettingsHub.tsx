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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountEmail) {
      setSettingsNoticeIsError(true);
      setSettingsNotice('Não foi possível identificar o e-mail de acesso desta conta.');
      return;
    }
    if (newPassword.length < 6) {
      setSettingsNoticeIsError(true);
      setSettingsNotice('A nova palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSettingsNoticeIsError(true);
      setSettingsNotice('A confirmação da nova palavra-passe não coincide.');
      return;
    }
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountEmail, currentPassword, newPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSettingsNoticeIsError(true);
        setSettingsNotice(typeof result.error === 'string' ? result.error : 'Não foi possível actualizar a palavra-passe.');
        return;
      }
      setPasswordSuccess(true);
      setSettingsNoticeIsError(false);
      setSettingsNotice('Palavra-passe actualizada com sucesso e protegida pelo servidor.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.setTimeout(() => setPasswordSuccess(false), 4000);
    } catch {
      setSettingsNoticeIsError(true);
      setSettingsNotice('Não foi possível contactar o servidor de autenticação.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. STAFF & OPERATORS */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{t('businessOperators')}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('businessOperatorsDescription')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {staffMembers.map((member) => (
            <div
              key={member.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  {member.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-bold text-xs text-slate-900">{member.name}</h4>
                  <span className="block truncate text-[11px] text-slate-500 font-mono">{member.email}</span>
                </div>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="max-w-[150px] truncate text-[11px] font-bold px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg">
                  {member.role}
                </span>
                {staffMembers.length > 1 && (
                  <button type="button"
                    onClick={() => handleRemoveStaff(member.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    aria-label={`Remover ${member.name}`}
                    title="Remover operador"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Operator Form */}
        <form onSubmit={handleAddStaff} className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
          <span className="text-xs font-bold text-slate-800 block">{t('addNewStaff')}:</span>
          <div className="grid min-w-0 grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Nome do operador"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              required
              placeholder="email@empresa.gw"
              value={newStaffEmail}
              onChange={(e) => setNewStaffEmail(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex min-w-0 gap-2">
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value)}
                className="min-w-0 flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Validador de Vouchers">Validador de Vouchers (Portaria)</option>
                <option value="Gerente Comercial">Gerente Comercial</option>
                <option value="Editor de Conteúdo">Editor de Conteúdo</option>
              </select>
              <button
                type="submit"
                className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition"
              >
                + {t('add')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 2. NOTIFICATION PREFERENCES */}
      {notificationPreferences && onNotificationPreferencesChange && (
        <NotificationPreferencesPanel
          role="business"
          value={notificationPreferences}
          onChange={onNotificationPreferencesChange}
        />
      )}

      {/* 3. PASSWORD & SECURITY */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>{t('passwordSecurity')}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('passwordSecurityDescription')}
            </p>
          </div>

          {(passwordSuccess || settingsNotice) && (
            <div className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold ${settingsNoticeIsError ? 'border border-red-300 bg-red-50 text-red-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`} role="status">
              {settingsNoticeIsError ? <AlertCircle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              <span>{settingsNotice || t('passwordUpdated')}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Palavra-passe Atual:</label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite a palavra-passe atual (ex: 123456)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nova Palavra-passe:</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar Nova Senha:</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-pressed={showPassword}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-medium"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPassword ? 'Ocultar carateres' : 'Mostrar carateres'}</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
            >
              Atualizar Palavra-passe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
