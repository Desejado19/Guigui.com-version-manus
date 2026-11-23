import { expect, test, type Page } from './fixtures';

test('GET /sobre-nos página pública carrega', async ({ page }) => {
  await page.goto('/sobre-nos');
  // Page loads successfully without timeout
  await expect(page).toHaveURL('/sobre-nos');
});

test('GET /sobre-nos tem metadados institucionais', async ({ page }) => {
  await page.goto('/sobre-nos');
  // Meta description exists with institutional content
  const description = page.locator('meta[name="description"]');
  // Get the content attribute (may be hidden but present)
  const descContent = await description.getAttribute('content');
  expect(descContent).toBeTruthy();
  expect(descContent).toContain('Guigui');
});

test('GET /sobre-nos tem body visível', async ({ page }) => {
  await page.goto('/sobre-nos');
  await expect(page.locator('body')).toBeVisible();
});

test('GET /sobre-nos tem footer', async ({ page }) => {
  await page.goto('/sobre-nos');
  await expect(page.locator('footer')).toBeVisible({ timeout: 10_000 });
});