import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-identity-infrastructure-'));
process.env.GUIGUI_DATA_DIR = tempDir;

type IdentityRepositoryModule = typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
let identityRepository: IdentityRepositoryModule;

beforeEach(async () => {
  for (const file of ['auth.json', 'demo-passwords.json', 'password-reset-tokens.json', 'team-invitations.json']) {
    const fullPath = path.join(tempDir, file);
    if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { force: true });
  }
  vi.resetModules();
  identityRepository = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('JSON identity repository', () => {
  it('normalizes absent account lookups to null', async () => {
    const repository = identityRepository.createJsonIdentityRepository();

    await expect(repository.findByEmail('missing@guigui.com')).resolves.toBeNull();
    await expect(repository.findById('missing-user')).resolves.toBeNull();
  });

  it('returns boolean results for unsuccessful account mutations', async () => {
    const repository = identityRepository.createJsonIdentityRepository();

    await expect(repository.changePassword('missing@guigui.com', 'old-pass', 'new-pass')).resolves.toBe(false);
    await expect(repository.deactivate('missing@guigui.com')).resolves.toBe(false);
    await expect(repository.delete('missing@guigui.com')).resolves.toBe(false);
  });

  it('fails to load malformed invitation storage instead of treating it as empty', async () => {
    fs.writeFileSync(path.join(tempDir, 'team-invitations.json'), '{invalid json', 'utf8');
    vi.resetModules();

    await expect(
      import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository'),
    ).rejects.toThrow(SyntaxError);
  });
});
