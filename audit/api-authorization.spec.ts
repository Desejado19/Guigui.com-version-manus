import { expect, test, type Page } from '../tests/fixtures';
import fs from 'node:fs';
import path from 'node:path';

const DEMO = {
  citizen: { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' },
  business: { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' },
  admin: { email: 'admin.teste@guigui.com', password: 'Guigui2026!' },
} as const;

type Role = 'citizen' | 'business' | 'admin';

const ENDPOINTS_FILE = path.resolve('audit-evidence/api-endpoints.json');
const PROFILE = (process.env.AUDIT_PROFILE || 'all').toLowerCase();

async function loginApi(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account, timeout: 15000 });
  const payload = await response.json().catch(() => ({} as any));
  expect(response.ok(), `login falhou para ${account.email}: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload.user as { id: string; role: string; name: string; email: string };
}

async function signIn(page: Page, role: Role) {
  const user = await loginApi(page, DEMO[role]);
  const setCookie = (await page.request.storageState()).cookies.find((cookie) => cookie.name === 'guigui_session');
  if (setCookie) {
    const base = test.info().project.use.baseURL ?? 'http://localhost:3100';
    await page.context().addCookies([
      { name: 'guigui_session', value: setCookie.value, url: base, httpOnly: true, sameSite: 'Lax', secure: false },
    ]);
  }
  await page.addInitScript((current: { user: object; role: string }) => {
    let stored: any = null;
    try { stored = JSON.parse(window.localStorage.getItem('guigui_current_user') || 'null'); } catch { stored = null; }
    if (!stored || stored.role !== current.role) {
      window.localStorage.setItem('guigui_current_user', JSON.stringify(current.user));
    }
    if (!window.localStorage.getItem('guigui_current_lang')) {
      window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
    }
  }, { user, role: user.role });
  return user;
}

test.describe(`Fase 3 — Autorização (${PROFILE})`, () => {
  test.setTimeout(900_000);

  test(`sonda ${PROFILE}`, async ({ page }) => {
    const manifest = JSON.parse(fs.readFileSync(ENDPOINTS_FILE, 'utf8')) as Array<{ method: string; path: string; source: string }>;
    const getEndpoints = manifest.filter((entry) => entry.method === 'GET');
    const results: Array<{ method: string; path: string; source: string; profile: string; status: number; error?: string }> = [];

    const probe = async (profile: string) => {
      for (const endpoint of getEndpoints) {
        try {
          const response = await page.request.get(endpoint.path, { timeout: 10000 });
          results.push({ method: endpoint.method, path: endpoint.path, source: endpoint.source, profile, status: response.status() });
        } catch (error) {
          results.push({ method: endpoint.method, path: endpoint.path, source: endpoint.source, profile, status: 0, error: String(error).slice(0, 200) });
        }
      }
    };

    const profiles = PROFILE === 'all' ? ['anonymous', 'citizen', 'business', 'admin'] : [PROFILE];
    for (const profile of profiles) {
      if (profile === 'anonymous') {
        await probe('anonymous');
      } else {
        await signIn(page, profile as Role);
        await probe(profile);
        await page.context().clearCookies();
      }
    }

    const suffix = PROFILE === 'all' ? 'all' : PROFILE;
    const outputFile = path.resolve(`audit-evidence/api-authorization-${suffix}.json`);
    fs.writeFileSync(outputFile, JSON.stringify({ capturedAt: new Date().toISOString(), profile: PROFILE, totalEndpoints: getEndpoints.length, results }, null, 2), 'utf8');
    console.log(`wrote ${results.length} results to ${outputFile}`);
  });
});