import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Compass,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { Language, UserRole } from '../../types';
import { getTranslation } from '../../utils/i18n';
import {
  getTourSteps,
  readTourState,
  resetTourState,
  shouldAutoOpenTour,
  writeTourState,
  type TourIconKey,
} from './tourSteps';

const ICONS: Record<TourIconKey, React.ComponentType<{ className?: string }>> = {
  layout: LayoutDashboard,
  compass: Compass,
  ticket: Ticket,
  bell: Bell,
  message: MessageSquare,
  lifebuoy: LifeBuoy,
  user: UserRound,
  shield: ShieldCheck,
  store: Store,
  package: Package,
  calendar: Calendar,
  wallet: Wallet,
  users: Users,
  settings: Settings,
};

interface WelcomeTourProps {
  role: UserRole;
  userId: string | null | undefined;
  currentLang: Language;
}

/**
 * Guia de boas-vindas.
 *
 * Abre automaticamente na primeira utilização de cada conta, com um percurso
 * diferente para cidadãos e empresas. O progresso fica guardado por utilizador,
 * pelo que concluir ou saltar o guia impede que ele volte a aparecer sozinho —
 * mas o botão flutuante permite consultá-lo outra vez a qualquer momento.
 */
export const WelcomeTour: React.FC<WelcomeTourProps> = ({ role, userId, currentLang }) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const steps = useMemo(() => getTourSteps(role), [role]);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Estado inicial: só abre sozinho se a conta ainda não concluiu nem saltou.
  useEffect(() => {
    if (!userId) {
      setOpen(false);
      return;
    }
    const stored = readTourState(userId);
    setStepIndex(stored?.step && stored.step < steps.length ? stored.step : 0);
    setOpen(shouldAutoOpenTour(userId));
  }, [userId, steps.length, role]);

  const persist = useCallback((status: 'in_progress' | 'completed' | 'skipped', index: number) => {
    if (!userId) return;
    writeTourState(userId, { status, step: index });
  }, [userId]);

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    setStepIndex(clamped);
    persist('in_progress', clamped);
  }, [persist, steps.length]);

  const close = useCallback((status: 'completed' | 'skipped') => {
    persist(status, status === 'completed' ? steps.length - 1 : stepIndex);
    setOpen(false);
  }, [persist, stepIndex, steps.length]);

  const replay = useCallback(() => {
    if (userId) resetTourState(userId);
    setStepIndex(0);
    setOpen(true);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close('skipped');
      if (event.key === 'ArrowRight') goTo(stepIndex + 1);
      if (event.key === 'ArrowLeft') goTo(stepIndex - 1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close, goTo, stepIndex]);

  if (!userId || role === 'admin') return null;

  const step = steps[stepIndex];
  const Icon = ICONS[step.icon] ?? Sparkles;
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const isLast = stepIndex === steps.length - 1;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={replay}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3.5 py-2.5 text-[11px] font-black text-[var(--color-text-strong)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-green-400)] hover:text-[var(--color-green-700)] sm:bottom-6 sm:right-6"
          title={t('onboardingReplay')}
          aria-label={t('onboardingReplay')}
        >
          <Compass className="h-4 w-4 text-[var(--color-green-600)]" aria-hidden="true" />
          {t('onboardingReplayShort')}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--color-bg-canvas)]/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-tour-title"
          onClick={(event) => { if (event.target === event.currentTarget) close('skipped'); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-md)]">
            {/* Progresso */}
            <div className="h-1.5 w-full bg-[var(--color-bg-subtle)]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('onboardingProgress')}>
              <div className="h-full bg-[var(--color-green-600)] transition-all" style={{ width: `${progress}%` }} />
            </div>

            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-green-700)]">
                  {role === 'business' ? t('onboardingBusinessKicker') : t('onboardingCitizenKicker')}
                </p>
                <p className="mt-1 text-[11px] font-bold text-[var(--color-text-muted)]">
                  {t('onboardingStepOf')
                    .replace('{{current}}', String(stepIndex + 1))
                    .replace('{{total}}', String(steps.length))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => close('skipped')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-border-subtle)]"
                aria-label={t('onboardingSkip')}
                title={t('onboardingSkip')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="px-5 py-6">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-green-100)] text-[var(--color-green-700)] dark:bg-[var(--color-green-900)]/45 dark:text-[var(--color-green-200)]">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 id="welcome-tour-title" className="text-lg font-black leading-tight text-[var(--color-text-strong)]">
                  {step.copy[currentLang]?.title || step.copy.pt.title}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {step.copy[currentLang]?.description || step.copy.pt.description}
              </p>

              {/* Marcadores dos passos: mostram onde se está sem ocupar espaço */}
              <ol className="mt-5 flex flex-wrap gap-1.5" aria-label={t('onboardingProgress')}>
                {steps.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-label={`${index + 1}. ${item.copy[currentLang]?.title || item.copy.pt.title}`}
                      aria-current={index === stepIndex ? 'step' : undefined}
                      className={`h-2 rounded-full transition-all ${index === stepIndex ? 'w-6 bg-[var(--color-green-600)]' : index < stepIndex ? 'w-2 bg-[var(--color-green-300)]' : 'w-2 bg-[var(--color-border-subtle)]'}`}
                    />
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-5 py-4">
              <button
                type="button"
                onClick={() => close('skipped')}
                className="min-h-10 rounded-xl px-3 text-[11px] font-black text-[var(--color-text-muted)] transition hover:text-[var(--color-text-strong)]"
              >
                {t('onboardingSkip')}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(stepIndex - 1)}
                  disabled={stepIndex === 0}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 text-[11px] font-black text-[var(--color-text-strong)] transition enabled:hover:border-[var(--color-green-400)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('onboardingBack')}
                </button>
                <button
                  type="button"
                  onClick={() => (isLast ? close('completed') : goTo(stepIndex + 1))}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--color-green-600)] px-4 text-[11px] font-black text-white transition hover:bg-[var(--color-green-700)]"
                >
                  {isLast ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('onboardingFinish')}
                    </>
                  ) : (
                    <>
                      {t('onboardingNext')}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

WelcomeTour.displayName = 'WelcomeTour';
