import { test, expect, type Page } from './fixtures';

/**
 * Base setup for admin/business/team specs.
 * - Remove onboarding tour state so the welcome modal does not auto-open and block pointers.
 * - Logs in with the specified role.
 * - Guarantees we start from a clean onboarding state every test.
 */

test.beforeEach(async ({ page }, testInfo) => {
  // Remove onboarding tour state from localStorage to prevent WelcomeTour from opening and blocking clicks.
  await page.evaluate(() => {
    if (typeof localStorage === 'undefined') return;
    // Remove all keys that start with guigui_onboarding_v1
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('guigui_onboarding_v1')) {
        localStorage.removeItem(key);
      }
    }
    // Also clear the full prefix in case of old format
    localStorage.removeItem('guigui_onboarding_v1');
  });

  // Ensure no WelcomeTour overlay is present by removing any residual dialog
  await page.evaluate(() => {
    const overlay = document.querySelector('div.fixed.inset-0.z-5');
    if (overlay) overlay.remove();
  });
});

/**
 * Helper: login as admin
 */
export async function signInAdmin(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

/**
 * Helper: login as business
 */
export async function signInBusiness(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login business falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

/**
 * Helper: login as citizen
 */
export async function signInCitizen(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login citizen falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

/**
 * Helper: go to home and wait for dashboard
 */
export async function goToHome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible({ timeout: 30000 });
}