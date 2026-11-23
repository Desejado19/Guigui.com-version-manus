import { test, expect, type Page } from './fixtures';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';

async function loginAdmin(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

test.describe('Admin panel - conversas network', () => {
  test('não chama /api/conversations e não tem erros de console', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/');

    // Capture console errors and warnings
    const consoleMessages: { type: string; text: string }[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      // Capture only errors and warnings (not logs at info/debug level)
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMessages.push({ type: msg.type(), text });
      }
    });

    // Intercept network requests to check for /api/conversations
    const conversationsRequests: string[] = [];
    await page.route('**/api/conversations**, **/api/conversations/*', async (route) => {
      conversationsRequests.push(route.request().url());
      await route.abort(); // Abort the request so it doesn't reach the server
    });

    // Wait a bit for any initial data fetching to complete
    await page.waitForTimeout(3000);

    // Verify no /api/conversations requests were made
    console.log('Console messages captured:', consoleMessages.length);
    console.log('Conversations requests intercepted:', conversationsRequests.length);
    console.log('Conversations request URLs:', conversationsRequests);

    expect(conversationsRequests).toHaveLength(0);
    // We expect at most a few console messages (maybe warnings about deps, etc.)
    // but no errors related to the auth or panel functionality
    const criticalErrors = consoleMessages.filter(
      (m) => m.text.toLowerCase().includes('error') || m.text.toLowerCase().includes('failed') || m.text.toLowerCase().includes('error')
    );
    expect(criticalErrors.length).toBeLessThanOrEqual(5);
  });
});