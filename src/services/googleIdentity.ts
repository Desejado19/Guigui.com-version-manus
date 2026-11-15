// Integração com o Google Identity Services (botão "Continuar com Google").
//
// O backend (/api/auth/login) recebe o ID token do Google em `googleIdToken`.
// O ID token só pode ser obtido pelo script oficial do Google, por isso este
// módulo carrega https://accounts.google.com/gsi/client uma única vez e monta
// o botão oficial dentro do contentor indicado.
//
// Requer VITE_GOOGLE_CLIENT_ID (client ID público do mesmo OAuth client usado
// pelo backend). Sem essa variável o botão não é montado e a UI explica que a
// integração está por configurar.

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        ux_mode?: 'popup' | 'redirect';
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number | boolean>): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const SCRIPT_ID = 'google-identity-services';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export const isGoogleSignInConfigured = () => googleClientId.length > 0;

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('O início de sessão da Google só está disponível no browser.'));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const failure = () => {
      scriptPromise = null;
      reject(new Error('Não foi possível carregar o início de sessão da Google.'));
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', failure);
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', failure);
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export type MountGoogleButtonOptions = {
  locale?: string;
  onCredential: (credential: string) => void;
};

/**
 * Monta o botão oficial do Google dentro de `container`. Rejeita quando o
 * client ID não está configurado ou o script do Google não carrega.
 */
export async function mountGoogleSignInButton(
  container: HTMLElement,
  options: MountGoogleButtonOptions,
): Promise<void> {
  if (!isGoogleSignInConfigured()) {
    throw new Error('O login com Google não está configurado (falta VITE_GOOGLE_CLIENT_ID).');
  }
  await loadGoogleScript();
  const identity = window.google?.accounts?.id;
  if (!identity) {
    throw new Error('Não foi possível carregar o início de sessão da Google.');
  }

  identity.initialize({
    client_id: googleClientId,
    callback: (response) => {
      if (response.credential) options.onCredential(response.credential);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    ux_mode: 'popup',
  });

  container.innerHTML = '';
  // Largura entre 200 e 400 px, ajustada à largura real do contentor.
  const width = Math.min(400, Math.max(240, Math.round(container.clientWidth) || 320));
  identity.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width,
    locale: options.locale || 'pt-PT',
  });
}
