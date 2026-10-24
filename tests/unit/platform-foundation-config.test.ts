import { describe, expect, it } from 'vitest';
import { loadPlatformRuntimeConfig } from '../../server/modules/platform-foundation/config/platformRuntimeConfig';

describe('loadPlatformRuntimeConfig', () => {
  it('uses local defaults when no shared runtime variables are configured', () => {
    expect(loadPlatformRuntimeConfig({})).toEqual({
      port: 3000,
      host: '0.0.0.0',
      isProduction: false,
      isVercel: false,
      appUrl: undefined,
      allowedOrigins: [],
    });
  });

  it('binds QA to loopback when configured and preserves the existing default', () => {
    expect(loadPlatformRuntimeConfig({ HOST: '127.0.0.1' }).host).toBe('127.0.0.1');
    expect(loadPlatformRuntimeConfig({}).host).toBe('0.0.0.0');
  });

  it('preserves the existing port fallback', () => {
    expect(loadPlatformRuntimeConfig({}).port).toBe(3000);
    expect(loadPlatformRuntimeConfig({ PORT: '0' }).port).toBe(3000);
    expect(loadPlatformRuntimeConfig({ PORT: 'invalid' }).port).toBe(3000);
    expect(loadPlatformRuntimeConfig({ PORT: '3102' }).port).toBe(3102);
  });

  it('parses configured CORS origins and APP_URL fallback', () => {
    expect(loadPlatformRuntimeConfig({
      CORS_ALLOWED_ORIGINS: ' https://one.example, ,https://two.example ',
      APP_URL: 'https://app.example',
    }).allowedOrigins).toEqual(['https://one.example', 'https://two.example']);
    expect(loadPlatformRuntimeConfig({
      APP_URL: 'https://app.example',
    }).allowedOrigins).toEqual(['https://app.example']);
    expect(loadPlatformRuntimeConfig({}).allowedOrigins).toEqual([]);
  });

  it('reports production and Vercel modes from the supplied environment', () => {
    expect(loadPlatformRuntimeConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
    })).toMatchObject({ isProduction: true, isVercel: true });
    expect(loadPlatformRuntimeConfig({
      NODE_ENV: 'Production',
      VERCEL: '',
    })).toMatchObject({ isProduction: false, isVercel: false });
  });

  it('preserves the configured APP_URL value', () => {
    expect(loadPlatformRuntimeConfig({
      APP_URL: ' https://app.example/ ',
    }).appUrl).toBe(' https://app.example/ ');
  });
});
