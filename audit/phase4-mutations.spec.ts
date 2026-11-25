import { expect, test, type Page } from '../tests/fixtures';
import fs from 'node:fs';
import path from 'node:path';

const DEMO = {
  citizen: { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' },
  business: { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' },
} as const;

const ENTRY_LABEL = {
  citizen: 'A minha área pessoal',
  business: 'Área da Minha Empresa',
} as const;

const OUTPUT_FILE = path.resolve('audit-evidence/phase4-mutations.json');

async function loginApi(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account });
  const payload = await response.json().catch(() => ({} as any));
  expect(response.ok()).toBeTruthy();
  return payload.user as { id: string; role: string; name: string; email: string; businessId?: string };
}

test.describe('Fase 4 — Mutações controladas', () => {
  test.setTimeout(300_000);

  test('cidadão cria pedido de suporte e persiste na API', async ({ page }) => {
    const user = await loginApi(page, DEMO.citizen);
    const subject = `audit-phase4-support-${Date.now()}`;
    const response = await page.request.post('/api/support/tickets', {
      data: { subject, description: 'Pedido criado pela Fase 4 da auditoria.', category: 'technical' },
    });
    expect(response.ok(), `criação de suporte falhou: ${response.status()}`).toBeTruthy();

    const mine = await page.request.get('/api/support/tickets/mine');
    expect(mine.ok()).toBeTruthy();
    const payload = await mine.json();
    const list = payload.tickets ?? payload;
    const found = Array.isArray(list) && list.some((item: any) => String(item.subject || '').includes(subject));
    expect(found, 'o pedido criado deve aparecer na lista do cidadão').toBeTruthy();

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ kind: 'citizen-support', subject, created: true, found, at: new Date().toISOString() }, null, 2), 'utf8');
  });

  test('empresa cria evento publicado e aparece na API pública', async ({ page }) => {
    const user = await loginApi(page, DEMO.business);
    const companyId = (user as any).businessId;
    expect(companyId).toBeTruthy();
    const title = `audit-phase4-event-${Date.now()}`;
    const id = `evt-audit-phase4-${Date.now()}`;
    const response = await page.request.post('/api/events', {
      data: { id, businessId: companyId, title, status: 'published', date: '2026-12-28', time: '20:00', category: 'Concertos & Festivais', location: 'Bissau' },
    });
    expect(response.ok(), `criação de evento falhou: ${response.status()} ${await response.text()}`).toBeTruthy();

    const publicEvents = await page.request.get('/api/events');
    const publicPayload = await publicEvents.json();
    const stored = (publicPayload.events ?? []).find((event: any) => event.title === title);
    expect(stored, 'o evento criado deve estar na API pública').toBeDefined();
    expect(stored.businessId).toBe(companyId);

    const current = fs.existsSync(OUTPUT_FILE) ? JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')) : {};
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ ...current, kind: 'business-event', title, id, companyId, publicVisible: true, at: new Date().toISOString() }, null, 2), 'utf8');
  });

  test('cidadão edita perfil, persiste após reload e restaura', async ({ page }) => {
    await loginApi(page, DEMO.citizen);
    await page.goto('/');
    await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
    await page.getByTitle('Sessão Iniciada').click();
    const entry = page.locator('button').filter({ hasText: ENTRY_LABEL.citizen }).first();
    await entry.click();
    await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });

    const aside = page.locator('aside').first();
    await aside.getByRole('button', { name: /conta e perfil/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('tab', { name: 'Perfil e preferências' }).click();

    const nameInput = page.locator('label', { hasText: /^Nome/ }).locator('input').first();
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    const original = await nameInput.inputValue();
    const updated = `${original.split(' [audit-phase4]')[0]} [audit-phase4]`;

    await nameInput.fill(updated);
    await page.getByRole('button', { name: /guardar dados pessoais/i }).click();
    await expect(page.getByText('Dados guardados.').first()).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
    await page.getByTitle('Sessão Iniciada').click();
    await page.locator('button').filter({ hasText: ENTRY_LABEL.citizen }).first().click();
    await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
    await page.locator('aside').first().getByRole('button', { name: /conta e perfil/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('tab', { name: 'Perfil e preferências' }).click();
    const persisted = page.locator('label', { hasText: /^Nome/ }).locator('input').first();
    await expect(persisted).toHaveValue(updated, { timeout: 15_000 });

    await persisted.fill(original);
    await page.getByRole('button', { name: /guardar dados pessoais/i }).click();
    await expect(page.getByText('Dados guardados.').first()).toBeVisible({ timeout: 15_000 });

    const current = fs.existsSync(OUTPUT_FILE) ? JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')) : {};
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ ...current, kind: 'citizen-profile', persistedAfterReload: true, restored: true, at: new Date().toISOString() }, null, 2), 'utf8');
  });
});