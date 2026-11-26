import { expect, test } from './fixtures';

const openFilter = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: /filtrar por localização/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Localidades de Bissau' }).first();
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe('Catálogo e filtro de localidades de Bissau', () => {
  test('1. API devolve o catálogo central e o botão Todos abre a lista', async ({ page, request }) => {
    const response = await request.get('/api/locations');
    expect(response.ok(), await response.text()).toBeTruthy();
    const catalog = await response.json();
    expect(catalog.locations.length).toBeGreaterThanOrEqual(50);
    expect(catalog.groups.length).toBeGreaterThanOrEqual(8);

    await page.goto('/');
    const dialog = await openFilter(page);
    await expect(dialog.getByPlaceholder('Pesquisar bairro ou localidade...')).toBeVisible();
    await expect(dialog.getByRole('option').first()).toBeVisible();
  });

  test('2. todas as localidades ativas aparecem agrupadas por sector', async ({ page, request }) => {
    const catalog = await (await request.get('/api/locations')).json();
    await page.goto('/');
    const dialog = await openFilter(page);
    // O catálogo chega de forma assíncrona: esperar pela primeira opção.
    await expect(dialog.getByRole('option').first()).toBeVisible();
    await expect.poll(async () => dialog.getByRole('option').count()).toBe(catalog.locations.length);
    await expect(dialog.getByText(catalog.groups[0].sector, { exact: true })).toBeVisible();
  });

  test('3. pesquisa encontra bairros por nome e por grafia antiga', async ({ page }) => {
    await page.goto('/');
    const dialog = await openFilter(page);
    const search = dialog.getByPlaceholder('Pesquisar bairro ou localidade...');
    await search.fill('bandim');
    await expect(dialog.getByRole('option', { name: /Bandim/ })).toBeVisible();
    await search.fill('Praca dos Herois');
    await expect(dialog.getByRole('option', { name: /Praça dos Heróis/ })).toBeVisible();
  });

  test('4. selecionar um bairro filtra os resultados e indica a seleção', async ({ page }) => {
    await page.goto('/');
    const dialog = await openFilter(page);
    await dialog.getByPlaceholder('Pesquisar bairro ou localidade...').fill('Santa Luzia');
    await dialog.getByRole('option', { name: /Santa Luzia/ }).click();
    await expect(page.getByRole('button', { name: /filtrar por localização/i }).first()).toContainText('Santa Luzia');
    await expect(page.getByText(/A filtrar publicações na zona/i).first()).toBeVisible();
  });

  test('5. Ver todos remove o filtro geográfico', async ({ page }) => {
    await page.goto('/');
    let dialog = await openFilter(page);
    await dialog.getByRole('option', { name: /^Bandim/ }).click();
    dialog = await openFilter(page);
    await dialog.getByRole('button', { name: 'Ver todos' }).click();
    await expect(page.getByRole('button', { name: /filtrar por localização/i }).first()).toContainText('Todos');
    await expect(page.getByText(/A filtrar publicações na zona/i)).toHaveCount(0);
  });

  test('6. pesquisa geral e localização funcionam em simultâneo', async ({ page }) => {
    await page.goto('/');
    const search = page.locator('.guigui-search input').first();
    await search.fill('Bissau');
    const dialog = await openFilter(page);
    await dialog.getByPlaceholder('Pesquisar bairro ou localidade...').fill('Bandim');
    await dialog.getByRole('option', { name: /^Bandim/ }).click();
    await expect(page.getByRole('button', { name: /filtrar por localização/i }).first()).toContainText('Bandim');
    await expect(search).toHaveValue('Bissau');
  });

  test('7. seleção mantém-se ao navegar para o diretório', async ({ page }) => {
    await page.goto('/');
    const dialog = await openFilter(page);
    await dialog.getByRole('option', { name: /^Bandim/ }).click();
    await page.getByRole('button', { name: /business directory|diret[oó]rio de empresas/i }).first().click();
    await expect(page.getByRole('button', { name: /filtrar por localização/i }).first()).toContainText('Bandim');
  });

  test('8. painel funciona em telemóvel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const dialog = await openFilter(page);
    await expect(dialog.getByPlaceholder('Pesquisar bairro ou localidade...')).toBeVisible();
    await dialog.getByPlaceholder('Pesquisar bairro ou localidade...').fill('Hafia');
    await dialog.getByRole('option', { name: /Hafia/ }).click();
    await expect(page.getByRole('button', { name: /filtrar por localização/i }).first()).toContainText('Hafia');
  });

  test('9. catálogo não contém bairros duplicados', async ({ request }) => {
    const catalog = await (await request.get('/api/locations')).json();
    const names = catalog.locations.map((entry: { name: string }) => entry.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const ids = catalog.locations.map((entry: { id: string }) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('10. filtros usam os dados reais da base de dados', async ({ request }) => {
    const [catalogResponse, businessesResponse, eventsResponse] = await Promise.all([
      request.get('/api/locations'),
      request.get('/api/businesses'),
      request.get('/api/events'),
    ]);
    expect(catalogResponse.ok()).toBeTruthy();
    expect(businessesResponse.ok()).toBeTruthy();
    expect(eventsResponse.ok()).toBeTruthy();
    const catalog = await catalogResponse.json();
    const businesses = (await businessesResponse.json()).businesses || [];
    const events = (await eventsResponse.json()).events || [];
    const known = new Set<string>();
    for (const entry of catalog.locations) {
      known.add(entry.name.toLowerCase());
      for (const alias of entry.aliases) known.add(alias.toLowerCase());
    }
    const values = [...businesses, ...events]
      .map((entry: { neighborhood?: string }) => (entry.neighborhood || '').trim().toLowerCase())
      .filter((value) => value && value !== 'bissau');
    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((value) => !known.has(value))).toEqual([]);
  });
});
