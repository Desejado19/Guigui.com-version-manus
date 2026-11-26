export type ModerationDecisionAction = 'approve' | 'reject' | 'appeal' | 'simulate-appeal';

export type ModerationDecisionPayload = {
  success?: boolean;
  log?: unknown;
  error?: string;
};

/**
 * Persiste uma decisão de moderação e só resolve quando o servidor confirma.
 * Uma resposta HTTP falhada, um corpo sem `success` ou uma falha de rede
 * resultam sempre em erro — a UI nunca deve assumir a operação como concluída.
 */
export async function persistModerationDecision(
  id: string,
  action: ModerationDecisionAction,
  notes?: string,
): Promise<ModerationDecisionPayload> {
  const response = await fetch('/api/moderation/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, notes }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      (payload as { error?: string }).error || `Falha ao persistir decisão (${response.status}).`,
    );
  }
  const payload = await response.json().catch(() => null) as ModerationDecisionPayload | null;
  if (!payload?.success) {
    throw new Error('O servidor não confirmou a operação de moderação.');
  }
  return payload;
}
