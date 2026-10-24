export type PlatformRuntimeConfig = {
  port: number;
  host: string;
  isProduction: boolean;
  isVercel: boolean;
  appUrl: string | undefined;
  allowedOrigins: string[];
};

export function loadPlatformRuntimeConfig(
  env: NodeJS.ProcessEnv,
): PlatformRuntimeConfig {
  return {
    port: Number(env.PORT) || 3000,
    host: env.HOST?.trim() || '0.0.0.0',
    isProduction: env.NODE_ENV === 'production',
    isVercel: Boolean(env.VERCEL),
    appUrl: env.APP_URL,
    allowedOrigins: (env.CORS_ALLOWED_ORIGINS || env.APP_URL || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
