import { expect, test } from './fixtures';

/**
 * Integração pública da Identidade Institucional.
 * Prova que o site consome a última publicação: contactos e canais oficiais no
 * Footer, documentos legais na área de termos e apenas conteúdo publicado.
 */

test('API pública expõe contactos e canais da última publicação', async ({ request }) => {
  const response = await request.get('/api/institutional');
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  const entities = payload.data.entities;

  expect(entities.contacts.length).toBeGreaterThan(0);
  const emails = entities.contacts.map((contact: { email: string }) => contact.email);
  expect(emails).toContain('info@guigui.com');
  expect(entities.social_links.length).toBeGreaterThan(0);
  expect(entities.social_links.some((link: { network: string }) => link.network === 'facebook')).toBe(true);

  // Nada em rascunho pode chegar ao site.
  for (const doc of entities.documents ?? []) {
    expect(['', 'published']).toContain(doc.status || '');
  }
  for (const item of entities.communications ?? []) {
    expect(item.status).toBe('published');
  }
});

test('Footer mostra os contactos oficiais da publicação', async ({ page }) => {
  await page.goto('/sobre-nos');
  const footer = page.locator('footer');
  await expect(footer).toBeVisible({ timeout: 20000 });
  await expect(footer.getByRole('link', { name: 'info@guigui.com' })).toBeVisible();
  await expect(footer.getByText(/\+245 955 00 00 00/).first()).toBeVisible();
  await expect(footer.getByRole('link', { name: /Facebook/i }).first()).toBeVisible();
});

test('Termos públicos mostram os documentos oficiais publicados', async ({ page }) => {
  await page.goto('/sobre-nos');
  await expect(page.getByRole('heading', { name: 'Sobre o Guigui.com' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /Termos/i }).first().click();
  await expect(page.getByText('Documentos oficiais')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Estatutos Sociais').first()).toBeVisible();
  await expect(page.getByText('Termos de Uso').first()).toBeVisible();
});

test('Sobre o Guigui.com mostra contactos e canais oficiais', async ({ page }) => {
  await page.goto('/sobre-nos');
  await expect(page.getByRole('heading', { name: 'Sobre o Guigui.com' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Contactos oficiais' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('link', { name: 'suporte@guigui.com' }).first()).toBeVisible();
});
