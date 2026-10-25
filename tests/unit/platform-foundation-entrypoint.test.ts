import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPlatformEntrypoint } from '../../server/modules/platform-foundation/hosting/runPlatformEntrypoint';

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-platform-entrypoint-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('runPlatformEntrypoint', () => {
  it('prepares runtime before loading the application', async () => {
    const root = createTemporaryDirectory();
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'seed.json'), '{"ready":true}', 'utf8');
    const env: NodeJS.ProcessEnv = {
      VERCEL: '1',
      VERCEL_URL: 'guigui.example',
      DATABASE_URL: 'postgres://synthetic@127.0.0.1/guigui_test',
      GUIGUI_DATA_DIR: destination,
    };
    const application = { loaded: true };
    const startupSteps: string[] = [];

    const result = await runPlatformEntrypoint(env, source, async () => {
      expect(env.NODE_ENV).toBe('production');
      expect(env.APP_URL).toBe('https://guigui.example');
      expect(fs.readFileSync(path.join(destination, 'seed.json'), 'utf8')).toBe('{"ready":true}');
      startupSteps.push('application');
      return application;
    }, async () => {
      expect(env.NODE_ENV).toBe('production');
      startupSteps.push('database');
    });

    expect(result).toBe(application);
    expect(startupSteps).toEqual(['database', 'application']);
  });

  it('does not load the application when preparation fails', async () => {
    const root = createTemporaryDirectory();
    const destination = path.join(root, 'not-a-directory');
    fs.writeFileSync(destination, 'blocking file', 'utf8');
    const loadApplication = vi.fn(async () => ({ loaded: true }));

    await expect(runPlatformEntrypoint({
      VERCEL: '1',
      GUIGUI_DATA_DIR: destination,
    }, path.join(root, 'source'), loadApplication)).rejects.toThrow();

    expect(loadApplication).not.toHaveBeenCalled();
  });

  it('failsWhenProductionDatabaseUrlIsMissing', async () => {
    const root = createTemporaryDirectory();
    const loadApplication = vi.fn(async () => ({ loaded: true }));
    const checkConnection = vi.fn(async () => undefined);

    await expect(runPlatformEntrypoint({
      NODE_ENV: 'production',
    }, root, loadApplication, checkConnection)).rejects.toThrow('DATABASE_URL');

    expect(checkConnection).not.toHaveBeenCalled();
    expect(loadApplication).not.toHaveBeenCalled();
  });

  it('failsWhenProductionDatabaseIsUnreachable', async () => {
    const root = createTemporaryDirectory();
    const loadApplication = vi.fn(async () => ({ loaded: true }));
    const checkConnection = vi.fn(async () => {
      throw new Error('database unavailable');
    });

    await expect(runPlatformEntrypoint({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://synthetic@127.0.0.1/guigui_test',
    }, root, loadApplication, checkConnection)).rejects.toThrow(
      'Production PostgreSQL connectivity check failed',
    );

    expect(checkConnection).toHaveBeenCalledOnce();
    expect(loadApplication).not.toHaveBeenCalled();
  });

  it('startsProductionOnlyAfterDatabaseCheck', async () => {
    const root = createTemporaryDirectory();
    const startupSteps: string[] = [];

    await runPlatformEntrypoint({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://synthetic@127.0.0.1/guigui_test',
    }, root, async () => {
      startupSteps.push('application');
      return { loaded: true };
    }, async () => {
      startupSteps.push('database');
    });

    expect(startupSteps).toEqual(['database', 'application']);
  });

  it('allowsExplicitLocalModeWithoutDatabase', async () => {
    const root = createTemporaryDirectory();
    const checkConnection = vi.fn(async () => undefined);

    await expect(runPlatformEntrypoint({
      NODE_ENV: 'test',
    }, root, async () => ({ loaded: true }), checkConnection)).resolves.toEqual({ loaded: true });

    expect(checkConnection).not.toHaveBeenCalled();
  });
});
