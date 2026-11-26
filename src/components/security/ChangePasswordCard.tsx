import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { evaluatePassword, PASSWORD_MIN_LENGTH } from '../../../shared/passwordPolicy';
import { suggestPasswords } from '../../utils/passwordSuggestions';

/**
 * Cartão de alteração da própria palavra-passe, partilhado por cidadão,
 * empresa e administração.
 *
 * O pedido vai para `POST /api/auth/change-password` sem e-mail: o servidor usa
 * a conta da sessão, pelo que ninguém consegue mudar credenciais de outra
 * pessoa. As sugestões são geradas localmente e cumprem a política do servidor.
 */
interface ChangePasswordCardProps {
  accountEmail?: string;
  accountName?: string;
  className?: string;
  title?: string;
  description?: string;
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-[var(--color-border-input)] bg-white px-3 py-2 pr-11 text-xs font-bold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[var(--color-green-600)] focus:ring-2 focus:ring-[var(--color-focus-ring)]/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white';

const STRENGTH_COLORS = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label htmlFor={id} className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
      {label}
      <span className="relative mt-1 block">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}

export const ChangePasswordCard: React.FC<ChangePasswordCardProps> = ({
  accountEmail,
  accountName,
  className = '',
  title = 'Alterar a minha palavra-passe',
  description = 'Pode alterar a palavra-passe sempre que quiser. A conta e o e-mail ficam os mesmos.',
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>(() => suggestPasswords(3));
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setNotice(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
  }, [accountEmail]);

  const policy = useMemo(
    () => evaluatePassword({ password: newPassword, currentPassword, email: accountEmail, name: accountName }),
    [newPassword, currentPassword, accountEmail, accountName],
  );

  const confirmationMatches = confirmation.length > 0 && confirmation === newPassword;
  const canSubmit = Boolean(currentPassword) && policy.ok && confirmationMatches && !submitting;
  const missingConfirmation = confirmation.length > 0 && !confirmationMatches;

  const applySuggestion = (suggestion: string) => {
    setNewPassword(suggestion);
    setConfirmation(suggestion);
    setNotice(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword) {
      setNotice({ tone: 'error', text: 'Indique a palavra-passe atual.' });
      return;
    }
    if (!policy.ok) {
      setNotice({ tone: 'error', text: policy.issues[0] || 'A palavra-passe nova não cumpre os requisitos.' });
      return;
    }
    if (!confirmationMatches) {
      setNotice({ tone: 'error', text: 'A confirmação não coincide com a nova palavra-passe.' });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; issues?: string[] } | null;
      if (!response.ok) {
        setNotice({ tone: 'error', text: payload?.error || payload?.issues?.[0] || 'Não foi possível alterar a palavra-passe.' });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setSuggestions(suggestPasswords(3));
      setNotice({ tone: 'success', text: 'Palavra-passe atualizada com sucesso. Use a nova palavra-passe no próximo início de sessão.' });
    } catch {
      setNotice({ tone: 'error', text: 'Falha de rede ao alterar a palavra-passe. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const checklist = [
    { done: newPassword.length >= PASSWORD_MIN_LENGTH, label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres` },
    { done: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword), label: 'Letras maiúsculas e minúsculas' },
    { done: /[0-9]/.test(newPassword), label: 'Pelo menos um número' },
    { done: /[^A-Za-z0-9]/.test(newPassword), label: 'Pelo menos um símbolo (! # % & *)' },
    { done: Boolean(newPassword) && newPassword !== currentPassword, label: 'Diferente da palavra-passe atual' },
  ];

  return (
    <section className={`rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-xs)] dark:bg-[var(--color-bg-surface-dark)] sm:p-5 ${className}`}>
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-green-100)] text-[var(--color-green-700)] dark:bg-[var(--color-green-900)] dark:text-[var(--color-green-100)]">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-[var(--color-text-strong)]">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{description}</p>
        </div>
      </header>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <PasswordField
            id="change-password-current"
            label="Palavra-passe atual"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="A palavra-passe que usa hoje"
          />
          <PasswordField
            id="change-password-new"
            label="Nova palavra-passe"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
          />
          <PasswordField
            id="change-password-confirm"
            label="Repetir nova palavra-passe"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            placeholder="Escreva outra vez a nova palavra-passe"
          />
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Força</span>
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">{newPassword ? policy.label : '—'}</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${newPassword && policy.score > index ? STRENGTH_COLORS[policy.score] : 'bg-slate-200 dark:bg-slate-700'}`}
                />
              ))}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-slate-500 dark:text-slate-300">
              {newPassword && !policy.ok ? policy.issues[0] : confirmation.length > 0 && !confirmationMatches ? 'A confirmação não coincide.' : 'Boa escolha: longa e variada é mais segura.'}
            </p>
          </div>
        </div>

        <ul className="grid gap-1 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item.label} className={`flex items-center gap-1.5 text-[11px] font-semibold ${item.done ? 'text-[var(--color-green-700)] dark:text-[var(--color-green-100)]' : 'text-slate-500 dark:text-slate-400'}`}>
              {item.done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
              {item.label}
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-gold-600)]" aria-hidden="true" /> Sugestões seguras
            </p>
            <button
              type="button"
              onClick={() => setSuggestions(suggestPasswords(3))}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-white px-2 py-1 text-[10px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" /> Outras
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => applySuggestion(suggestion)}
                className="rounded-lg border border-[var(--color-border-subtle)] bg-white px-2.5 py-1.5 font-mono text-[11px] font-bold text-slate-800 transition hover:border-[var(--color-green-600)] hover:text-[var(--color-green-700)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                title="Usar esta sugestão"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            As sugestões são criadas no seu dispositivo e não são guardadas. Pode copiar uma e guardá-la no seu gestor de palavras-passe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-green-700)] px-4 py-2 text-xs font-black text-white transition hover:bg-[var(--color-green-800)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'A atualizar...' : 'Atualizar palavra-passe'}
          </button>
          {missingConfirmation && <span className="text-[11px] font-bold text-rose-600 dark:text-rose-300">A confirmação não coincide.</span>}
        </div>

        {notice && (
          <p
            role="status"
            className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'}`}
          >
            {notice.text}
          </p>
        )}
      </form>
    </section>
  );
};
