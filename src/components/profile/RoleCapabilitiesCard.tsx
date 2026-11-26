import React from 'react';
import { CheckCircle2, Compass, Lock, ShieldCheck } from 'lucide-react';
import { getRoleProfilePlan, type RoleTone } from '../../config/roleCapabilities';
import type { UserRole } from '../../types';
import { Card } from '../ui';

interface RoleCapabilitiesCardProps {
  role: UserRole;
  className?: string;
}

/**
 * Estilos por acento de perfil. Só tokens de tema: o texto acompanha o tema
 * claro, escuro e sistema (contraste AA em todos).
 */
const toneStyles: Record<RoleTone, { tile: string; eyebrow: string; chip: string; icon: string }> = {
  green: {
    tile: 'border-[var(--color-green-200)] bg-[var(--color-green-50)] text-[var(--color-green-700)] dark:border-[var(--color-green-900)] dark:bg-[var(--color-green-950)]/40 dark:text-[var(--color-green-200)]',
    eyebrow: 'text-[var(--color-green-700)] dark:text-[var(--color-green-300)]',
    chip: 'border-[var(--color-green-200)] bg-[var(--color-green-50)] text-[var(--color-green-800)] dark:border-[var(--color-green-900)] dark:bg-[var(--color-green-950)]/40 dark:text-[var(--color-green-200)]',
    icon: 'text-[var(--color-green-600)] dark:text-[var(--color-green-300)]',
  },
  gold: {
    tile: 'border-[var(--color-gold-200)] bg-[var(--color-gold-50)] text-[var(--color-gold-800)] dark:border-[var(--color-gold-900)] dark:bg-[var(--color-gold-950)]/40 dark:text-[var(--color-gold-200)]',
    eyebrow: 'text-[var(--color-gold-800)] dark:text-[var(--color-gold-300)]',
    chip: 'border-[var(--color-gold-200)] bg-[var(--color-gold-50)] text-[var(--color-gold-800)] dark:border-[var(--color-gold-900)] dark:bg-[var(--color-gold-950)]/40 dark:text-[var(--color-gold-200)]',
    icon: 'text-[var(--color-gold-600)] dark:text-[var(--color-gold-300)]',
  },
  blue: {
    tile: 'border-[var(--color-blue-200)] bg-[var(--color-blue-50)] text-[var(--color-blue-700)] dark:border-[var(--color-blue-900)] dark:bg-[var(--color-blue-950)]/40 dark:text-[var(--color-blue-200)]',
    eyebrow: 'text-[var(--color-blue-700)] dark:text-[var(--color-blue-300)]',
    chip: 'border-[var(--color-blue-200)] bg-[var(--color-blue-50)] text-[var(--color-blue-800)] dark:border-[var(--color-blue-900)] dark:bg-[var(--color-blue-950)]/40 dark:text-[var(--color-blue-200)]',
    icon: 'text-[var(--color-blue-600)] dark:text-[var(--color-blue-300)]',
  },
};

/**
 * Cartão partilhado de permissões, presente no perfil de cada modo de
 * utilizador. Mostra a missão do perfil, o âmbito de acesso, o que a conta pode
 * fazer e o que é reservado a outro papel.
 *
 * Todas as cores vêm dos tokens de tema (`--color-text-*`, `--color-bg-*`,
 * `--color-green/gold/blue-*`), pelo que o texto fica legível nos temas claro,
 * escuro e sistema.
 */
export const RoleCapabilitiesCard: React.FC<RoleCapabilitiesCardProps> = ({ role, className = '' }) => {
  const plan = getRoleProfilePlan(role);
  const tone = toneStyles[plan.tone];

  return (
    <Card
      className={`overflow-hidden rounded-[var(--radius-xl)] border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-0 shadow-[var(--shadow-xs)] ${className}`}
      aria-label={`Permissões do perfil ${plan.name}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tone.tile}`} aria-hidden="true">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${tone.eyebrow}`}>Perfil · {plan.name}</p>
            <h2 className="mt-1 text-base font-black leading-tight text-[var(--color-text-strong)] sm:text-lg">
              O que esta conta pode fazer
            </h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-[var(--color-text-default)]">{plan.mission}</p>
          </div>
        </div>
        <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${tone.chip}`}>
          <Compass className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`} aria-hidden="true" />
          <span className="truncate">{plan.scope}</span>
        </span>
      </header>

      <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${tone.eyebrow}`}>
              <CheckCircle2 className={`h-3.5 w-3.5 ${tone.icon}`} aria-hidden="true" />
              Pode fazer
            </p>
            <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black tabular-nums text-[var(--color-text-muted)]">
              {plan.can.length}
            </span>
          </div>
          <ul className="space-y-2.5">
            {plan.can.map((item) => (
              <li key={item.id} className="flex gap-2">
                <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone.icon}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs font-black leading-snug text-[var(--color-text-strong)]">{item.label}</span>
                  <span className="block text-[11px] font-semibold leading-snug text-[var(--color-text-default)]">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Reservado a outros perfis
            </p>
            <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black tabular-nums text-[var(--color-text-muted)]">
              {plan.cannot.length}
            </span>
          </div>
          <ul className="space-y-2.5">
            {plan.cannot.map((item) => (
              <li key={item.id} className="flex gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs font-black leading-snug text-[var(--color-text-strong)]">{item.label}</span>
                  <span className="block text-[11px] font-semibold leading-snug text-[var(--color-text-muted)]">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-4 py-3 text-[10px] font-semibold leading-relaxed text-[var(--color-text-muted)] sm:px-5">
        Estes limites são verificados também no servidor: o que está reservado não pode ser executado por esta conta, mesmo por pedido directo à API.
      </p>
    </Card>
  );
};

export default RoleCapabilitiesCard;
