import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import type { Language } from '../types';
import { getTranslation } from '../utils/i18n';

/**
 * Barreira de erro para os painéis (cidadão, empresa e administração).
 *
 * Sem isto, uma excepção num componente deixa o ecrã branco e o utilizador
 * não tem forma de recuperar sem recarregar. Em Bissau, onde a ligação é
 * intermitente, recarregar significa perder o trabalho em curso — por isso a
 * tela de erro explica o que aconteceu e deixa recuperar sem sair.
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  currentLang?: Language;
  /** Nome do painel, usado na mensagem para saber onde occurred. */
  area?: string;
  /** Se false, um erro volta a subir — usado para não mascarar bugs de teste. */
  isolate?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Em produção isto deve chegar ao registo de erros do servidor.
    console.error('[Guigui.com] erro de interface:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.isolate === false) throw error;

    const lang = this.props.currentLang || 'pt';
    const t = (key: string) => getTranslation(lang, key);

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300">
          <AlertOctagon className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('errorScreenTitle')}</h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {this.props.area ? t('errorScreenWithArea').replace('{area}', this.props.area) : t('errorScreenBody')}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            {t('errorScreenCode')}: {error.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t('errorScreenRetry')}
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--color-border-default)] dark:border-slate-600 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {t('backHome')}
          </button>
        </div>
      </div>
    );
  }
}
