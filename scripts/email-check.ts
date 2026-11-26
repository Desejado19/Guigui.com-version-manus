/**
 * `npm run email:check`
 *
 * Valida a configuração de email do ambiente atual e, quando existe
 * BREVO_API_KEY, confirma a chave contra a API da Brevo sem enviar emails:
 * apenas GET /v3/account. Não imprime a chave nem qualquer segredo.
 *
 * Códigos de saída:
 *   0 — configuração pronta e chave Brevo válida (ou não aplicável)
 *   1 — faltam variáveis, a chave foi recusada ou a Brevo não respondeu
 */
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { resolveEmailConfig } from '../server/email/config';

const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';
const BREVO_TIMEOUT_MS = 10_000;

export type BrevoKeyProbe =
  | { status: 'skipped'; detail: string }
  | { status: 'valid'; detail: string }
  | { status: 'invalid'; detail: string }
  | { status: 'unreachable'; detail: string };

export async function probeBrevoKey(
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<BrevoKeyProbe> {
  const key = (apiKey || '').trim();
  if (!key) return { status: 'skipped', detail: 'BREVO_API_KEY não está definida.' };

  try {
    const response = await fetchImpl(BREVO_ACCOUNT_URL, {
      method: 'GET',
      headers: { 'api-key': key, accept: 'application/json' },
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });
    if (response.ok) {
      return { status: 'valid', detail: `chave aceite pela Brevo (HTTP ${response.status}).` };
    }
    if (response.status === 401 || response.status === 403) {
      return { status: 'invalid', detail: `a Brevo recusou a chave (HTTP ${response.status}).` };
    }
    return { status: 'unreachable', detail: `resposta inesperada da Brevo (HTTP ${response.status}).` };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'erro de rede';
    return { status: 'unreachable', detail: `não foi possível contactar a Brevo (${name}).` };
  }
}

async function main(): Promise<number> {
  const environment = (process.env.NODE_ENV || 'development').trim();
  const resolution = resolveEmailConfig(process.env);
  const config = resolution.config;

  console.log(`Guigui.com — verificação de email (${environment})`);
  const intendedProvider = config?.provider ?? ((process.env.EMAIL_PROVIDER || 'brevo').trim() || 'brevo');
  console.log(`Fornecedor: ${intendedProvider}${config ? ` (${config.mode})` : ' (configuração incompleta)'}`);
  if (config) {
    console.log(`Remetente visível: ${config.from.name} <${config.from.email}>`);
    if (config.replyTo) console.log(`Reply-To: ${config.replyTo.email}`);
  }
  console.log(`Configuração: ${resolution.ready ? 'PRONTA' : 'INCOMPLETA'}`);

  if (!resolution.ready) {
    console.log('Variáveis/pendências em falta:');
    for (const issue of resolution.issues) console.log(` - ${issue}`);
  }
  for (const warning of config?.warnings ?? []) console.log(`Aviso: ${warning}`);

  const probe = await probeBrevoKey(process.env.BREVO_API_KEY);
  console.log(`Brevo: ${probe.detail}`);
  if (config?.provider === 'smtp' && probe.status !== 'skipped') {
    console.log('Nota: EMAIL_PROVIDER=smtp; a chave Brevo não é usada no envio.');
  }

  // Uma chave Brevo inválida só bloqueia quando o Brevo é o fornecedor ativo.
  const brevoRelevant = config?.provider === 'brevo';
  const brevoFailed = brevoRelevant && (probe.status === 'invalid' || probe.status === 'unreachable');
  const ready = resolution.ready && !brevoFailed;

  console.log(ready ? 'RESULTADO: tudo pronto.' : 'RESULTADO: há pendências.');
  return ready ? 0 : 1;
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('Falha inesperada:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
