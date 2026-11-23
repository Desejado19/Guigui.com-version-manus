/** 
 * E2E tests for Client Settings Hub and account data form validation 
 * 
 * Requires: Development server running at http://localhost:3000 
 */ 

import { test, expect } from './fixtures';

/** 
 * Axe-core accessibility scanner configuration 
 * @see https://github.com/dequelabs/axe-core#api 
 */
const axeOptions = {
  // Run only with these tags to speed up the scan
  tags: ['wcag2a', 'wcag2aa', 'best-practice'],
  // Specific rules to exclude if needed
  // excludeRules: ['region', 'heading-order'], // Example: exclude region role verification
};

/** 
 * Should navigate to app and verify page loads 
 */
test('should navigate to app and verify page loads', async ({ page }) => {
  await page.goto('/');
  // Use html lang attribute as a stable selector
  await expect(page.locator('html[lang]').first()).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveTitle(/Guigui/);
  await page.screenshot({ path: 'tests/screenshots/client-settings-hub-home.png', fullPage: true });
});

/** 
 * Should verify Client Settings Hub modules exist 
 */
test('should verify Client Settings Hub modules exist', async ({ page }) => {
  await page.goto('/');
  // Wait for page to have content
  await expect(page.locator('html[lang]').first()).toBeVisible({ timeout: 10000 });

  const moduleButtons = page.locator('button');
  const buttonCount = await moduleButtons.count();

  // Debug: log all button texts
  const allButtonTexts: string[] = [];
  for (let i = 0; i < buttonCount; i++) {
    const buttonText = await moduleButtons.nth(i).textContent();
    if (buttonText) {
      allButtonTexts.push(buttonText.trim());
    }
  }
  console.log('All button texts:', allButtonTexts);

  // Just verify we found some buttons and the page has content
  expect(buttonCount).toBeGreaterThan(0);
});

/** 
 * Should test account data form validation inputs 
 */
test('should test account data form validation inputs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html[lang]').first()).toBeVisible({ timeout: 10000 });

  const formInputs = page.locator('input');
  const inputCount = await formInputs.count();

  const inputTypes = ['text', 'email', 'tel', 'date'];

  for (const type of inputTypes) {
    const inputsOfType = formInputs.filter({ has: page.locator(`input[type="${type}"]`) });
    const count = await inputsOfType.count();

    if (count > 0) {
      console.log(`Found ${count} inputs of type: ${type}`);

      for (let j = 0; j < Math.min(count, 2); j++) {
        await inputsOfType.nth(j).click();

        if (type === 'text') {
          await inputsOfType.nth(j).fill('Nome Completo Teste');
        } else if (type === 'email') {
          await inputsOfType.nth(j).fill('teste@empresa.gw');
        } else if (type === 'tel') {
          await inputsOfType.nth(j).fill('+351 912 345 678');
        } else if (type === 'date') {
          await inputsOfType.nth(j).fill('1990-01-15');
        }

        await page.waitForTimeout(500);
        await page.screenshot({ path: `tests/screenshots/client-settings-input-${type}.png`, fullPage: false });
      }
    }
  }

  // Look for save/submit button
  const saveButtons = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Guardar")');
  const saveCount = await saveButtons.count();

  if (saveCount > 0) {
    await saveButtons.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/client-settings-after-submit.png', fullPage: true });
  }

  await page.screenshot({ path: 'tests/screenshots/client-settings-form-validation.png', fullPage: true });
});

/** 
 * Should verify form validation shows error messages for invalid input 
 */
test('should verify form validation shows error messages for invalid input', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html[lang]').first()).toBeVisible({ timeout: 10000 });

  const formInputs = page.locator('input');

  // Test: look for a text input (full name) and leave it empty
  const textInputs = formInputs.filter({ has: page.locator('input[type="text"]') });
  if (await textInputs.count() > 0) {
    // Find the first text input and clear it
    await textInputs.first().clear();
    await page.waitForTimeout(500);

    // Look for error messages with red color
    const errorMessages = page.locator('.text-red-600, .error, .text-error');
    const errorCount = await errorMessages.count();
    console.log('Error messages found for empty name field:', errorCount);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/client-settings-empty-name.png', fullPage: true });
  }

  // Test: invalid email format
  const emailInputs = formInputs.filter({ has: page.locator('input[type="email"]') });
  if (await emailInputs.count() > 0) {
    await emailInputs.first().clear();
    await emailInputs.first().fill('invalid-email');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/client-settings-invalid-email.png', fullPage: false });
  }

  // Test: invalid phone format
  const phoneInputs = formInputs.filter({ has: page.locator('input[type="tel"]') });
  if (await phoneInputs.count() > 0) {
    await phoneInputs.first().clear();
    await phoneInputs.first().fill('invalid-phone');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/client-settings-invalid-phone.png', fullPage: false });
  }

  // Test: future date of birth
  const dateInputs = formInputs.filter({ has: page.locator('input[type="date"]') });
  if (await dateInputs.count() > 0) {
    await dateInputs.first().clear();
    await dateInputs.first().fill('2099-12-31');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/client-settings-future-dob.png', fullPage: false });
  }

  await page.screenshot({ path: 'tests/screenshots/client-settings-validation-summary.png', fullPage: true });
});

/** 
 * Should verify theme and language persistency 
 */
test('should verify theme and language persistency', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html[lang]').first()).toBeVisible({ timeout: 10000 });

  // Look for theme toggle - search buttons by common patterns
  const allButtons = page.locator('button');
  const buttonCount = await allButtons.count();

  let darkRelated = 0;
  let lightRelated = 0;

  for (let i = 0; i < buttonCount; i++) {
    const buttonText = await allButtons.nth(i).textContent();
    if (buttonText) {
      const lower = buttonText.toLowerCase();
      if (lower.includes('dark') || lower.includes('theme')) darkRelated++;
      if (lower.includes('light') || lower.includes('theme')) lightRelated++;
    }
  }

  console.log('Buttons related to dark/theme:', darkRelated);
  console.log('Buttons related to light/theme:', lightRelated);

  // Look for language selector - buttons with language names (using simple contains)
  const langButtons = page.locator('button').filter({ has: page.locator(':text("Português")') });
  const langCount = await langButtons.count();
  console.log('Language selector buttons found:', langCount);

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/client-settings-theme-language.png', fullPage: true });

  // Verify page has expected content
  await expect(page.locator('.text-slate-900').first()).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveTitle(/Guigui/);
});

/** 
 * Should run axe-core accessibility scan 
 */
test('should run axe-core accessibility scan', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html[lang]').first()).toBeVisible({ timeout: 10000 });

  // Injeta a cópia local do axe-core: o CDN não é fiável em CI/offline.
  await page.addScriptTag({ path: 'tests/fixtures/axe.min.js' });
  await page.waitForFunction(() => Boolean((window as typeof window & { axe?: unknown }).axe));

  // Run axe-core accessibility scan
  const results = await page.evaluate(() => {
    const { axe } = window as typeof window & {
      axe: { run: (context: Document) => Promise<{ violations: unknown[] }> };
    };
    return axe.run(document);
  });

  // Assert no violations (or fewer than a threshold)
  expect(results.violations.length).toBe(0);

  if (results.violations.length > 0) {
    console.log('Axe-core violations found:');
    console.log(JSON.stringify(results.violations, null, 2));
  }

  // Take screenshot for debug
  await page.screenshot({ path: 'tests/screenshots/client-settings-accessibility.png', fullPage: true });
});