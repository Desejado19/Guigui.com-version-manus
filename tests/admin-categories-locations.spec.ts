import { expect, test, type Page } from './fixtures';

/**
 * Módulo "Categorias e Etiquetas" do painel administrativo.
 *
 * O painel chamava `/api/admin/locations`, que não existia: o servidor devolvia
 * o index.html e o componente mostrava "Unexpected token '<'… is not valid
 * JSON". Estes testes garantem que a rota responde, que a página carrega sem
 * erro e que categorias/localidades são realmente gravadas na base de dados.
 */

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const DEMO_PASSWORD = 'Guigui@2026!';

async function signInAdmin(page: Page) {
  const login = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: DEMO_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const payload = await login.json();
  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

async function openCategoriesTab(page: Page) {
  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Sessão Iniciada').click();
  await page.getByRole('button', { name: /Administração Guigui/ }).first().click();
  await page.getByRole('button', { name: /Categorias e Etiquetas/i }).first().click();
  await expect(page.getByText('Gestão da Estrutura de Categorias', { exact: false })).toBeVisible({ timeout: 20_000 });
}

test.describe('Categorias e Etiquetas (admin)', () => {
  test.setTimeout(240_000);

  test('a página carrega categorias e localidades sem erro de JSON', async ({ page }) => {
    await signInAdmin(page);
    await openCategoriesTab(page);

    // O erro anterior era este alerta com o parser JSON na cara do utilizador.
    await expect(page.getByText(/is not valid JSON/i)).toHaveCount(0);
    await expect(page.getByText(/Unexpected token/i)).toHaveCount(0);
    const alertTexts = await page.getByRole('alert').allInnerTexts();
    expect(alertTexts.filter((text) => /JSON|Unexpected token|Failed to fetch/i.test(text))).toEqual([]);

    // Localidades reais: a tabela deixa de mostrar "0 de 0".
    await expect(page.getByText('Catálogo de localidades de Bissau')).toBeVisible();
    await expect.poll(async () => {
      const label = await page.getByText(/\d+ de \d+/).first().innerText();
      return Number.parseInt(label.split(' de ')[1], 10);
    }, { timeout: 20_000 }).toBeGreaterThan(10);

    // Categorias principais com subcategorias reais (não "Geral").
    const firstSubcategories = page.getByText(/Subcategorias \(\d+\)/).first();
    await expect(firstSubcategories).toBeVisible();
    await expect(firstSubcategories).not.toHaveText('Subcategorias (0)');

    const categories = await (await page.request.get('/api/admin/categories')).json();
    expect(categories.categories.length).toBeGreaterThanOrEqual(16);
    expect(categories.categories[0].subcategories.length).toBeGreaterThan(0);
  });

  test('cria categoria e subcategoria e persiste na base de dados', async ({ page }) => {
    await signInAdmin(page);
    await openCategoriesTab(page);
    const name = `Categoria QA ${Date.now()}`;

    await page.getByRole('button', { name: /Nova Categoria Principal/i }).click();
    await page.getByPlaceholder('Ex: Serviços de Energia & Solar').fill(name);
    await page.getByPlaceholder(/Painéis Solares/).fill('Sub A, Sub B');
    await page.getByRole('button', { name: 'Criar Categoria' }).click();

    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 20_000 });

    const created = await (await page.request.get('/api/admin/categories')).json();
    const category = created.categories.find((entry: { name: string }) => entry.name === name);
    expect(category).toBeTruthy();
    expect(category.subcategories.sort()).toEqual(['Sub A', 'Sub B']);

    // Adicionar uma subcategoria pela própria ficha do cartão.
    const card = page.getByRole('heading', { name, exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await card.getByRole('button', { name: /Adicionar Subcategoria/i }).click();
    await card.getByPlaceholder('Nome da subcategoria...').fill('Sub C');
    await card.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(card.getByText('Sub C', { exact: true })).toBeVisible({ timeout: 20_000 });

    const updated = await (await page.request.get('/api/admin/categories')).json();
    const updatedCategory = updated.categories.find((entry: { name: string }) => entry.name === name);
    expect(updatedCategory.subcategories).toEqual(expect.arrayContaining(['Sub A', 'Sub B', 'Sub C']));

    // Limpeza: arquivar remove da lista ativa.
    page.once('dialog', (dialog) => void dialog.accept());
    await card.getByTitle('Arquivar categoria').click();
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0, { timeout: 20_000 });
  });

  test('cria e arquiva uma localidade através do painel', async ({ page }) => {
    await signInAdmin(page);
    await openCategoriesTab(page);
    const name = `Localidade QA ${Date.now()}`;

    await page.getByPlaceholder('Nome do bairro ou zona').fill(name);
    await page.getByPlaceholder('Separadas por vírgulas').fill('QA Alias');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 20_000 });

    const catalog = await (await page.request.get('/api/admin/locations')).json();
    const created = catalog.locations.find((entry: { name: string }) => entry.name === name);
    expect(created).toBeTruthy();
    expect(created.aliases).toContain('QA Alias');
    expect(created.isActive).toBe(true);

    const row = page.locator('tr', { has: page.getByText(name, { exact: true }) });
    await row.getByRole('button', { name: /Arquivar/ }).click();
    await expect(row.getByText('Arquivada', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Arquivar mantém o registo e permite reativar.
    await row.getByRole('button', { name: /Reativar/ }).click();
    await expect(row.getByText('Ativa', { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
