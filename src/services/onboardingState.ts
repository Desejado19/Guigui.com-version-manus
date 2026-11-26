/**
 * Estado do guia de boas-vindas guardado na conta.
 *
 * O `localStorage` só conhece o browser onde o guia foi visto; guardar o mesmo
 * estado no servidor garante que o guia abre uma única vez por utilizador,
 * independentemente do browser ou dispositivo onde inicia sessão.
 */

export type OnboardingAudience = 'citizen' | 'business' | 'team' | 'admin';
export type OnboardingStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface AccountOnboardingRecord {
  status: OnboardingStatus;
  step: number;
}

export type AccountOnboardingState = Record<string, AccountOnboardingRecord>;

const ENDPOINT = '/api/account/onboarding';

/**
 * Devolve o estado da conta ou `null` quando não foi possível consultá-lo
 * (servidor antigo, sem base de dados ou rede em baixo). Nesse caso o guia
 * mantém o comportamento local.
 */
export async function getAccountOnboardingState(): Promise<AccountOnboardingState | null> {
  try {
    const response = await fetch(ENDPOINT, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as { onboarding?: unknown } | null;
    const onboarding = payload?.onboarding;
    if (!onboarding || typeof onboarding !== 'object') return {};
    return onboarding as AccountOnboardingState;
  } catch {
    return null;
  }
}

/** Regista na conta que o guia foi apresentado, concluído ou saltado. */
export async function saveAccountOnboardingState(
  audience: OnboardingAudience,
  status: OnboardingStatus,
  step = 0,
): Promise<void> {
  try {
    await fetch(ENDPOINT, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience, status, step }),
    });
  } catch {
    // Falha silenciosa: o localStorage continua a evitar reaberturas no browser.
  }
}
