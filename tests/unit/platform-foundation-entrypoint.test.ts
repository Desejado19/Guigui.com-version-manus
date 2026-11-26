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
      GUIGUI_DATA_DIR: destination,
    };
    const application = { loaded: true };

    const result = await runPlatformEntrypoint(env, source, async () => {
      expect(env.NODE_ENV).toBe('production');
      expect(env.APP_URL).toBe('https://guigui.example');
      expect(fs.readFileSync(path.join(destination, 'seed.json'), 'utf8')).toBe('{"ready":true}');
      return application;
    });

    expect(result).toBe(application);
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
});
