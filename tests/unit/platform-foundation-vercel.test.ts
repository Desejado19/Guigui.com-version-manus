import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareVercelRuntime } from '../../server/modules/platform-foundation/hosting/prepareVercelRuntime';

const environmentKeys = [
  'VERCEL',
  'NODE_ENV',
  'VERCEL_URL',
  'APP_URL',
  'CORS_ALLOWED_ORIGINS',
  'GUIGUI_DATA_DIR',
] as const;

let originalEnvironment: Record<typeof environmentKeys[number], string | undefined>;
const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-platform-vercel-'));
  temporaryDirectories.push(directory);
  return directory;
}

beforeEach(() => {
  originalEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  ) as Record<typeof environmentKeys[number], string | undefined>;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('prepareVercelRuntime', () => {
  it('does nothing when Vercel is not enabled', () => {
    const root = createTemporaryDirectory();
    const destination = path.join(root, 'destination');
    const env = { APP_URL: 'https://app.example', GUIGUI_DATA_DIR: destination };

    prepareVercelRuntime(env, path.join(root, 'source'));

    expect(env).toEqual({
      APP_URL: 'https://app.example',
      GUIGUI_DATA_DIR: destination,
    });
    expect(fs.existsSync(destination)).toBe(false);
  });

  it('sets Vercel defaults when values are absent', () => {
    const makeDirectory = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const env = { VERCEL: '1', VERCEL_URL: 'guigui.example' };

    prepareVercelRuntime(env, path.join(os.tmpdir(), 'missing-guigui-seed-data'));

    expect(env).toMatchObject({
      NODE_ENV: 'production',
      APP_URL: 'https://guigui.example',
      CORS_ALLOWED_ORIGINS: 'https://guigui.example',
      GUIGUI_DATA_DIR: '/tmp/guigui-data',
    });
    expect(makeDirectory).toHaveBeenCalledWith('/tmp/guigui-data', { recursive: true });
  });

  it('preserves explicit Vercel URL and CORS settings', () => {
    const root = createTemporaryDirectory();
    const destination = path.join(root, 'destination');
    const env = {
      VERCEL: '1',
      VERCEL_URL: 'derived.example',
      APP_URL: ' https://explicit.example/ ',
      CORS_ALLOWED_ORIGINS: 'https://trusted.example',
      GUIGUI_DATA_DIR: destination,
    };

    prepareVercelRuntime(env, path.join(root, 'missing-source'));

    expect(env.APP_URL).toBe(' https://explicit.example/ ');
    expect(env.CORS_ALLOWED_ORIGINS).toBe('https://trusted.example');
    expect(env.GUIGUI_DATA_DIR).toBe(destination);
    expect(fs.existsSync(destination)).toBe(true);
  });

  it('copies only missing JSON files without overwriting destination data', () => {
    const root = createTemporaryDirectory();
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    fs.mkdirSync(source);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(source, 'existing.json'), '{"source":true}', 'utf8');
    fs.writeFileSync(path.join(source, 'missing.json'), '{"copied":true}', 'utf8');
    fs.writeFileSync(path.join(source, 'notes.txt'), 'ignore me', 'utf8');
    fs.writeFileSync(path.join(destination, 'existing.json'), '{"destination":true}', 'utf8');
    const env = { VERCEL: '1', GUIGUI_DATA_DIR: destination };

    prepareVercelRuntime(env, source);

    expect(fs.readFileSync(path.join(destination, 'existing.json'), 'utf8')).toBe('{"destination":true}');
    expect(fs.readFileSync(path.join(destination, 'missing.json'), 'utf8')).toBe('{"copied":true}');
    expect(fs.existsSync(path.join(destination, 'notes.txt'))).toBe(false);
  });

  it('is safe to run twice', () => {
    const root = createTemporaryDirectory();
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    fs.mkdirSync(source);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(source, 'state.json'), '{"version":1}', 'utf8');
    const env = { VERCEL: '1', GUIGUI_DATA_DIR: destination };

    prepareVercelRuntime(env, source);
    fs.writeFileSync(path.join(source, 'state.json'), '{"version":2}', 'utf8');
    prepareVercelRuntime(env, source);

    expect(fs.readFileSync(path.join(destination, 'state.json'), 'utf8')).toBe('{"version":1}');
  });

  it('propagates filesystem errors', () => {
    const root = createTemporaryDirectory();
    const destination = path.join(root, 'not-a-directory');
    fs.writeFileSync(destination, 'blocking file', 'utf8');

    expect(() => prepareVercelRuntime({
      VERCEL: '1',
      GUIGUI_DATA_DIR: destination,
    }, path.join(root, 'source'))).toThrow();
  });

  it('has no import-time filesystem or environment side effects', async () => {
    const root = createTemporaryDirectory();
    const destination = path.join(root, 'destination');
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'development';
    process.env.GUIGUI_DATA_DIR = destination;
    vi.resetModules();

    await import('../../server/modules/platform-foundation/hosting/prepareVercelRuntime');

    expect(process.env.NODE_ENV).toBe('development');
    expect(fs.existsSync(destination)).toBe(false);
  });

  it('re-exports Vercel preparation without running it on import', async () => {
    const root = createTemporaryDirectory();
    const destination = path.join(root, 'destination');
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'development';
    process.env.GUIGUI_DATA_DIR = destination;
    vi.resetModules();

    const bootstrap = await import('../../server/bootstrapVercel');

    expect(process.env.NODE_ENV).toBe('development');
    expect(fs.existsSync(destination)).toBe(false);

    const source = path.join(root, 'source');
    const preparedDestination = path.join(root, 'prepared');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'seed.json'), '{"ready":true}', 'utf8');
    const env: NodeJS.ProcessEnv = {
      VERCEL: '1',
      VERCEL_URL: 'compat.example',
      GUIGUI_DATA_DIR: preparedDestination,
    };
    bootstrap.prepareVercelRuntime(env, source);

    expect(env.NODE_ENV).toBe('production');
    expect(env.APP_URL).toBe('https://compat.example');
    expect(fs.readFileSync(path.join(preparedDestination, 'seed.json'), 'utf8')).toBe('{"ready":true}');
  });
});
