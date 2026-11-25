export type PlatformRuntimeConfig = {
  port: number;
  host: string;
  isProduction: boolean;
  isVercel: boolean;
  appUrl: string | undefined;
  allowedOrigins: string[];
  trustProxy: boolean | number | string;
};

/**
 * Valor para `app.set('trust proxy')`. Em produção confia num único proxy
 * (o balanceador/render); em desenvolvimento confia apenas em loopback. Nunca
 * se confia em todos por omissão, porque isso permitiria forjar X-Forwarded-For.
 */
function parseTrustProxy(value: string | undefined, isProduction: boolean): boolean | number | string {
  const raw = value?.trim();
  if (!raw) return isProduction ? 1 : 'loopback';
  const lowered = raw.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

export function loadPlatformRuntimeConfig(
  env: NodeJS.ProcessEnv,
): PlatformRuntimeConfig {
  const isProduction = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT) || 3000,
    host: env.HOST?.trim() || '0.0.0.0',
    isProduction,
    isVercel: Boolean(env.VERCEL),
    appUrl: env.APP_URL,
    allowedOrigins: (env.CORS_ALLOWED_ORIGINS || env.APP_URL || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: parseTrustProxy(env.TRUST_PROXY, isProduction),
  };
}
