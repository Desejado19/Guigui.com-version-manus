import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

const ACCOUNTS = {
  business: { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' },
  admin: { email: 'admin.teste@guigui.com', password: 'Guigui2026!' },
};

async function run(role) {
  const { email, password } = ACCOUNTS[role];
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const failures = [];
  const all = [];
  page.on('response', (res) => {
    const status = res.status();
    all.push(`${status} ${res.request().method()} ${res.url()}`);
    if (status >= 400) {
      const header = `${status} ${res.request().method()} ${res.url()}`;
      const withBody = res.text().then(
        (text) => `${header}\n    BODY: ${text.slice(0, 500)}`,
        () => `${header}\n    BODY: (unreadable)`,
      );
      const timeout = new Promise((resolve) => setTimeout(() => resolve(`${header}\n    BODY: (timeout)`), 4000));
      Promise.race([withBody, timeout]).then((entry) => failures.push(entry));
    }
  });
  page.on('requestfailed', (req) => {
    all.push(`FAILED ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });
  page.on('request', (req) => {
    if (req.url().includes('/api/events') && req.method() === 'POST') {
      const data = req.postData();
      all.push(`REQUEST BODY /api/events => ${String(data).slice(0, 1200)}`);
    }
  });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.stack || String(err)));

  const login = await page.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  const payload = await login.json().catch(() => ({}));
  if (!login.ok()) {
    console.log(`[${role}] LOGIN FAILED`, JSON.stringify(payload).slice(0, 300));
    await browser.close();
    return;
  }
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  console.log(`\n================ ${role.toUpperCase()} FAILED RESPONSES ================`);
  console.log(failures.join('\n') || '(none)');

  console.log(`\n================ ${role.toUpperCase()} ALL RESPONSES ================`);
  console.log(all.join('\n') || '(none)');

  console.log(`\n---- ${role} PAGE ERRORS ----`);
  console.log(pageErrors.join('\n---\n') || '(none)');

  await browser.close();
}

await run('business');
await run('admin');
