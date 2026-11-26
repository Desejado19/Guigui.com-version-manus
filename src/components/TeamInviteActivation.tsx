import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

/**
 * Página de ativação de convite de colaborador.
 *
 * Aberta por `/ativar-convite?token=…`, o token vem do e-mail enviado pelo
 * responsável. A página apenas apresenta os módulos atribuídos (leitura) e
 * envia a palavra-passe escolhida; nunca permite alterar módulos ou cargo.
 */

interface InvitationModule {
  id: string;
  label: string;
  actions: string[];
}

interface PublicInvitation {
  name: string;
  email: string;
  scope: 'admin' | 'business';
  organizationName: string;
  jobTitle?: string;
  roleLabel: string;
  modules: InvitationModule[];
  status: 'pending' | 'sent' | 'expired' | 'accepted' | 'revoked';
  expiresAt: string;
}

interface TeamInviteActivationProps {
  token: string;
}

const STATUS_EXPLANATION: Record<string, string> = {
  expired: 'Este convite expirou. Peça ao responsável da equipa que o reenvie.',
  accepted: 'Este convite já foi utilizado. Inicie sessão com a palavra-passe que definiu.',
  revoked: 'Este convite foi revogado pelo responsável da equipa.',
};

export const TeamInviteActivation: React.FC<TeamInviteActivationProps> = ({ token }) => {
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error' | 'done'>('loading');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('Bissau');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`/api/team/invitations/token/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { invitation?: PublicInvitation; error?: string };
      if (!response.ok || !payload.invitation) {
        setState('unavailable');
        setError(payload.error || 'Convite inválido ou já utilizado.');
        return;
      }
      setInvitation(payload.invitation);
      setState(payload.invitation.status === 'pending' || payload.invitation.status === 'sent' ? 'ready' : 'unavailable');
    } catch {
      setState('error');
      setError('Não foi possível validar o convite. Verifique a ligação e tente novamente.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('A palavra-passe precisa de pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As palavras-passe não coincidem.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/team/invitations/token/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, phone, neighborhood }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error || 'Não foi possível ativar a conta.');
        if (response.status === 410 || response.status === 409) {
          await load();
        }
        return;
      }
      setState('done');
    } catch {
      setError('Falha de rede ao ativar a conta. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100" data-testid="team-invite-activation">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="text-lg font-black leading-none">Guigui.com</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ativação de convite</p>
          </div>
        </header>

        {state === 'loading' && (
          <p role="status" className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-5 text-sm font-bold dark:border-slate-700 dark:bg-slate-900">
            <Loader2 className="h-4 w-4 animate-spin" /> A validar o convite…
          </p>
        )}

        {(state === 'unavailable' || state === 'error') && (
          <section className="rounded-2xl border border-rose-200 bg-white p-5 dark:border-rose-900 dark:bg-slate-900">
            <h1 className="flex items-center gap-2 text-sm font-black text-rose-700 dark:text-rose-300">
              <XCircle className="h-4 w-4" /> Convite indisponível
            </h1>
            <p role="alert" className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {STATUS_EXPLANATION[invitation?.status || ''] || error || 'Convite inválido ou já utilizado.'}
            </p>
            <a href="/" className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white">
              Voltar ao Guigui.com
            </a>
          </section>
        )}

        {state === 'done' && (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 dark:border-emerald-900 dark:bg-slate-900" data-testid="team-invite-success">
            <h1 className="flex items-center gap-2 text-sm font-black text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Conta ativada
            </h1>
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              A tua conta está pronta. Inicia sessão com o e-mail <strong>{invitation?.email}</strong> e a palavra-passe que acabaste de definir.
            </p>
            <a href="/" className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white" data-testid="team-invite-go-login">
              Iniciar sessão
            </a>
          </section>
        )}

        {state === 'ready' && invitation && (
          <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-base font-black">Olá, {invitation.name}!</h1>
            <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Foste convidado para integrar a equipa de <strong>{invitation.organizationName}</strong>.
            </p>
            <dl className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-[11px] dark:bg-slate-800">
              <div className="flex justify-between gap-3"><dt className="font-bold text-slate-500">E-mail</dt><dd className="font-black">{invitation.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="font-bold text-slate-500">Cargo</dt><dd className="font-black">{invitation.roleLabel}</dd></div>
            </dl>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Módulos atribuídos</p>
              <ul className="mt-1.5 flex flex-wrap gap-1" data-testid="team-invite-modules">
                {invitation.modules.map((module) => (
                  <li key={module.id} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {module.label}
                  </li>
                ))}
              </ul>
            </div>
            <form className="mt-4 space-y-2" onSubmit={submit}>
              <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Palavra-passe
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] px-2.5 text-xs font-bold dark:border-slate-600 dark:bg-slate-950"
                  data-testid="team-invite-password"
                />
              </label>
              <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Confirmar palavra-passe
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] px-2.5 text-xs font-bold dark:border-slate-600 dark:bg-slate-950"
                  data-testid="team-invite-password-confirm"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Telefone (opcional)
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] px-2.5 text-xs font-bold dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
                <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Bairro
                  <input
                    value={neighborhood}
                    onChange={(event) => setNeighborhood(event.target.value)}
                    className="mt-1 min-h-9 w-full rounded-xl border border-[var(--color-border-default)] px-2.5 text-xs font-bold dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
              </div>
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
              <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-[11px] font-black text-white disabled:opacity-60" data-testid="team-invite-submit">
                <CheckCircle2 className="h-4 w-4" /> {busy ? 'A ativar…' : 'Aceitar convite e ativar conta'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
};

export default TeamInviteActivation;
