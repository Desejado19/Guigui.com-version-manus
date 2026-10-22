import { chromium } from '@playwright/test';

// Mede a geometria do dashboard do cidadão a 768x1024 e 1440x900 para
// confirmar por que é que os filhos do aside fixo "estouram" para a
// esquerda do contentor .guigui-profile-dashboard (overflow-x: clip).
const EMAIL = 'cidadao.teste@guigui.com';
const PASSWORD = 'Guigui@2026!';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
const page = await context.newPage();

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

for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  await page.setViewportSize(viewport);
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Entrar na área pessoal tal como o teste faz.
  const conta = page.locator('button', { hasText: 'Conta' }).filter({ visible: true });
  if (await conta.count()) {
    await conta.first().click({ timeout: 10000 }).catch(() => {});
  } else {
    const menu = page.locator('button[aria-label="Abrir Menu Principal"]').filter({ visible: true }).first();
    if (await menu.count()) {
      await menu.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.locator('button', { hasText: 'Conta' }).filter({ visible: true }).first().click({ timeout: 10000 }).catch(() => {});
    }
  }
  await page.waitForSelector('.guigui-profile-dashboard', { timeout: 15000 });
  await page.waitForTimeout(1200);

  const report = await page.evaluate(() => {
    const dash = document.querySelector('.guigui-profile-dashboard');
    const aside = document.querySelector('.guigui-profile-dashboard aside');
    if (!dash || !aside) return { error: 'dashboard/aside não encontrado' };
    const inner = aside.querySelector('div.flex.h-full.min-h-0');
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), width: +r.width.toFixed(1) };
    };
    const style = (el, props) => {
      const s = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
    };
    const chain = [];
    let node = aside.parentElement;
    while (node && node !== document.documentElement) {
      const r = node.getBoundingClientRect();
      chain.push({
        el: `${node.tagName.toLowerCase()}.${String(node.className).split(/\s+/).filter(Boolean).slice(0, 3).join('.')}`,
        left: +r.left.toFixed(1),
        width: +r.width.toFixed(1),
        ...style(node, ['position', 'transform', 'padding-left', 'margin-left', 'overflow-x']),
      });
      node = node.parentElement;
    }
    return {
      win: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dash: { ...rect(dash), ...style(dash, ['overflow-x']) },
      aside: { ...rect(aside), ...style(aside, ['position', 'left', 'transform']) },
      asideInner: inner ? { ...rect(inner), ...style(inner, ['position', 'transform']) } : null,
      chain,
    };
  });
  console.log(`\n=== VIEWPORT ${viewport.width}x${viewport.height} ===`);
  console.log(JSON.stringify(report, null, 2));
}

await browser.close();