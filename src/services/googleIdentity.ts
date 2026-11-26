// Login com Google por redireccionamento (OAuth 2.0 authorization code).
//
// O browser apenas navega para /api/auth/google/start. A Google devolve o
// utilizador a /api/auth/google/callback com um código de autorização de uso
// único, e é o servidor que troca esse código pelo ID token usando o client
// secret (GOOGLE_CLIENT_SECRET). Nenhum token do Google passa pelo JavaScript
// da página e o secret nunca é exposto ao browser.
//
// A autorização da Google depende agora do URI de redireccionamento registado
// no cliente OAuth, em vez das "origens JavaScript" usadas pelo botão GIS.
//
// Requer VITE_GOOGLE_CLIENT_ID (client ID público) apenas para a UI saber se o
// login está configurado.

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

// Um Client ID real termina em .apps.googleusercontent.com. Valores de exemplo
// (000000000000-placeholder…) são tratados como "por configurar" em vez de
// enviar o utilizador para um fluxo condenado a falhar.
const PLACEHOLDER_CLIENT_ID = /(placeholder|example|your[-_]?client|changeme)/i;

export const isGoogleSignInConfigured = () =>
  /\.apps\.googleusercontent\.com$/i.test(googleClientId) && !PLACEHOLDER_CLIENT_ID.test(googleClientId);

/** Início do fluxo: navega para a Google e regressa ao callback do servidor. */
export const GOOGLE_SIGN_IN_URL = '/api/auth/google/start';

/**
 * Mensagem mostrada quando o callback devolve `?google_login=error` com um
 * motivo. Os motivos vêm do resultado de autenticação do servidor.
 */
export function googleLoginErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'cancelled':
      return 'O início de sessão com a Google foi cancelado.';
    case 'state':
    case 'exchange':
      return 'A sessão de login com a Google expirou. Tente novamente.';
    case 'unavailable':
      return 'O login com Google está por configurar no servidor.';
    case 'server':
      return 'A conta Google foi confirmada, mas o servidor não conseguiu concluir o registo. Tente novamente em instantes.';
    case 'google_failed':
      return 'A Google não devolveu uma identidade válida. Tente novamente e aceite o pedido de e-mail na janela da Google.';
    case 'mfa_required':
      return 'Esta conta exige verificação MFA. Entre com o e-mail e a palavra-passe para introduzir o código.';
    case 'google_link_required':
      return 'Não foi possível ligar esta conta Google ao e-mail indicado. Tente novamente ou contacte o suporte.';
    case 'google_link_conflict':
      return 'Este e-mail já está ligado a outra conta Google. Contacte o suporte.';
    case 'deactivated':
      return 'Esta conta foi desactivada.';
    case 'suspended':
      return 'O seu acesso está suspenso. Contacte o responsável da empresa.';
    case 'disabled':
      return 'O acesso desta conta foi revogado.';
    default:
      return 'Não foi possível concluir o login com a Google. Tente novamente.';
  }
}
