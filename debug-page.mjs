import { chromium } from '@playwright/test';

const EMAIL = 'admin.teste@guigui.com';
const PASSWORD = 'Guigui@2026!';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
const page = await context.newPage();

const pageErrors = [];
const consoleErrs = [];
page.on('pageerror', (err) => pageErrors.push(err.stack || String(err)));
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrs.push(msg.text()); });

// Login via API and inject the session like the tests do.
const login = await page.request.post('http://127.0.0.1:3000/api/auth/login', {
  data: { email: EMAIL, password: PASSWORD },
});
const payload = await login.json();
if (!login.ok()) {
  console.log('LOGIN FAILED', JSON.stringify(payload));
  process.exit(1);
}
await page.addInitScript((account) => {
  window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
  window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
}, payload.user);

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

// Enter the admin panel the same way responsive.spec.ts does.
await page.getByTitle('Sessão Iniciada').click();
await page.waitForTimeout(400);
const candidates = page.locator('button', { hasText: 'Administração Guigui.com' }).filter({ visible: true });
await candidates.first().click();
await page.waitForTimeout(2500);

const entries = page.locator('.guigui-profile-dashboard aside button');
const total = await entries.count();
console.log(`SIDEBAR ENTRIES: ${total}`);

for (let index = 0; index < total; index += 1) {
  const entry = entries.nth(index);
  let name = `secção ${index}`;
  try {
    name = (await entry.getAttribute('aria-label')) || (await entry.innerText()).split('\n')[0] || name;
  } catch {}
  // O primeiro botão é o toggle "Recolher menu"; clicar faz o menu desaparecer
  // e deixa as medições seguintes instáveis. Saltar.
  if (/recolher menu/i.test(name)) { console.log(`[${index}] "${name}" (toggle, skip)`); continue; }
  const before = pageErrors.length;
  try {
    await entry.click({ timeout: 5000 });
  } catch (err) {
    console.log(`[${index}] "${name}" CLICK FAILED: ${String(err).split('\n')[0]}`);
    // O menu pode ter colapsado; tentar reabrir e continuar.
    try {
      const toggle = page.locator('button[aria-label="Abrir menu lateral"]').filter({ visible: true }).first();
      if (await toggle.count()) { await toggle.click({ timeout: 3000 }); await page.waitForTimeout(350); }
    } catch {}
    continue;
  }
  await page.waitForTimeout(600);
  const crashed = await page.getByText('Algo correu mal').count();
  if (crashed) {
    console.log(`>>> CRASH on section [${index}] "${name}"`);
    console.log('=== NEW PAGE ERRORS ===\n' + pageErrors.slice(before).join('\n---\n'));
    console.log('=== CONSOLE ERRORS ===\n' + consoleErrs.join('\n'));
    const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
    console.log('=== BODY ===\n' + body);
    break;
  }
  console.log(`[${index}] "${name}" ok`);
}

console.log('=== ALL PAGE ERRORS ===\n' + (pageErrors.join('\n---\n') || '(none)'));
await browser.close();
