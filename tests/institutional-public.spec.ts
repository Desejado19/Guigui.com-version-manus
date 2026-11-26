import { expect, test } from './fixtures';

// O estado de publicação é global: os testes deste ficheiro têm de correr em
// série para que a despublicação não apanhe os testes públicos a meio.
test.describe.configure({ mode: 'serial' });

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

/**
 * Despublicação: o site deixa de servir contactos/canais e a API pública 404.
 * Fica no mesmo ficheiro dos testes públicos para correr em série com eles
 * (o estado de publicação é global) e repõe sempre a publicação no fim.
 */
test.describe('Despublicação do site institucional', () => {
  test('despublicar retira os dados do site e publicar repõe', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' },
    });
    expect(login.ok(), await login.text()).toBeTruthy();

    const before = await page.request.get('/api/admin/institutional');
    const metaBefore = (await before.json()).meta;
    expect(metaBefore.published).not.toBe(false);

    try {
      const unpublish = await page.request.post('/api/admin/institutional/unpublish');
      expect(unpublish.ok(), await unpublish.text()).toBeTruthy();
      expect((await unpublish.json()).published).toBe(false);

      const publicApi = await page.request.get('/api/institutional');
      expect(publicApi.status()).toBe(404);
      expect((await publicApi.json()).code).toBe('INSTITUTIONAL_NOT_PUBLISHED');

      const metaAfter = (await (await page.request.get('/api/admin/institutional')).json()).meta;
      expect(metaAfter.published).toBe(false);
      expect(metaAfter.releases.length).toBe(metaBefore.releases.length);

      await page.goto('/sobre-nos');
      const footer = page.locator('footer');
      await expect(footer).toBeVisible({ timeout: 20000 });
      await expect(footer.getByRole('link', { name: 'info@guigui.com' })).toHaveCount(0);
      await expect(footer.getByRole('link', { name: /Facebook/i })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Contactos oficiais' })).toHaveCount(0);
    } finally {
      const republish = await page.request.post('/api/admin/institutional/publish');
      expect(republish.ok(), await republish.text()).toBeTruthy();
    }

    expect((await page.request.get('/api/institutional')).ok()).toBeTruthy();
    await page.goto('/sobre-nos');
    await expect(page.locator('footer').getByRole('link', { name: 'info@guigui.com' })).toBeVisible({ timeout: 20000 });
  });

  test('Navbar mostra contactos e canais oficiais publicados', async ({ page }) => {
    await page.goto('/');
    const navbar = page.locator('header.guigui-navbar');
    await expect(navbar).toBeVisible({ timeout: 30000 });
    await navbar.getByRole('button', { name: 'Abrir Menu Principal' }).click();
    await expect(page.getByText('Contactos oficiais').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('link', { name: 'suporte@guigui.com' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Facebook/i }).first()).toBeVisible();
  });
});
