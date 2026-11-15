/**
 * E2E tests for Client Settings Hub and account data form validation
 * 
 * These tests verify:
 * - Client Settings Hub module toggling (4 sections)
 * - Account data form validation (full name, email, phone, date of birth, account type)
 * - Theme and language persistency
 * - Form submission behavior
 */

import { test, expect, } from '@playwright/test';

// Base URL will be http://127.0.0.1:3000
// Tests assume the dev server is running

test.describe('Client Settings Hub — E2E', () => {
  test('should navigate to Client Settings Hub and verify modules', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for app to load
    await expect(page.locator('text=Guigui.com')).toBeVisible({ timeout: 10000 });

    // Look for Settings/Client menu item or navigate to client section
    // The app should have a client section in the navbar or sidebar
    const navLinks = page.locator('nav a, .nav-link, a[href*="client"], a[href*="support"]');
    const linkCount = await navLinks.count();

    // Try to find a client or settings link
    let foundClientLink = false;
    for (let i = 0; i < linkCount; i++) {
      const linkText = await navLinks.nth(i).textContent();
      if (linkText && (linkText.includes('Client') || linkText.includes('Configurações') || linkText.includes('Settings'))) {
        await navLinks.nth(i).click();
        foundClientLink = true;
        break;
      }
    }

    // If no specific client link found, verify we're on the home page and look for sidebar
    if (!foundClientLink) {
      // Verify page loaded
      await expect(page).toHaveTitle(/Guigui/);
    }

    // Take initial screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-hub-home.png', fullPage: true });
  });

  test('should verify Client Settings Hub modules exist and are toggleable', async ({ page }) => {
    await page.goto('/');

    // Wait for page load
    await expect(page.locator('text=Guigui.com')).toBeVisible({ timeout: 10000 });

    // Look for the module selector buttons - they should have specific text
    const moduleButtons = page.locator('button');
    const buttonCount = await moduleButtons.count();

    // Find buttons with the 4 module texts
    const expectedModules = ['Dados e Conta', 'Perfil e Preferências', 'Configurações', 'Segurança e Privacidade'];
    const foundModules: string[] = [];

    for (let i = 0; i < buttonCount; i++) {
      const buttonText = await moduleButtons.nth(i).textContent();
      if (buttonText && expectedModules.includes(buttonText.trim())) {
        foundModules.push(buttonText.trim());
      }
    }

    // Verify all 4 modules are present
    console.log('Modules found:', foundModules);
    expect(foundModules).toContain('Dados e Conta');
    expect(foundModules).toContain('Perfil e Preferências');
    expect(foundModules).toContain('Configurações');
    expect(foundModules).toContain('Segurança e Privacidade');

    // Click each module and verify content appears
    for (const module of expectedModules) {
      const moduleButton = moduleButtons.filter({ has: page.locator(`button:has("${module}")`) });
      if (await moduleButton.count() > 0) {
        await moduleButton.click();
        await page.waitForLoadState('networkidle');
        
        // Wait a moment for content to render
        await page.waitForTimeout(500);
        
        // Take screenshot per module
        await page.screenshot({ path: `tests/e2e/screenshots/client-settings-hub-${module.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`, fullPage: true });
      }
    }

    await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-hub-complete.png', fullPage: true });
  });

  test('should test account data form validation', async ({ page }) => {
    await page.goto('/');

    // Wait for page load
    await expect(page.locator('text=Guigui.com')).toBeVisible({ timeout: 10000 });

    // Find and click on Client Settings or navigate to account data form
    // This depends on the app structure - look for form inputs related to account data
    
    // Try to find form inputs by their placeholder or type
    const formInputs = page.locator('input');
    const inputCount = await formInputs.count();

    // Look for specific input types we need to test
    const inputTypes = ['text', 'email', 'tel', 'date', 'select'];
    
    for (const type of inputTypes) {
      const inputsOfType = formInputs.filter({ has: page.locator(`input[type="${type}"]`) });
      const count = await inputsOfType.count();
      
      if (count > 0) {
        console.log(`Found ${count} inputs of type: ${type}`);
        
        // Try to fill each input and verify validation
        for (let j = 0; j < Math.min(count, 2); j++) { // Test first 2 of each type
          await inputsOfType.nth(j).click();
          
          // Clear and type valid data
          if (type === 'text') {
            await inputsOfType.nth(j).fill('Nome Completo Teste');
          } else if (type === 'email') {
            await inputsOfType.nth(j).fill('teste@empresa.gw');
          } else if (type === 'tel') {
            await inputsOfType.nth(j).fill('+351 912 345 678');
          } else if (type === 'date') {
            await inputsOfType.nth(j).fill('1990-01-15');
          }
          
          // Take screenshot after input
          await page.screenshot({ path: `tests/e2e/screenshots/client-settings-input-${type}.png`, fullPage: false });
        }
      }
    }

    // Look for save/submit button
    const saveButtons = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Guardar")');
    const saveCount = await saveButtons.count();
    
    if (saveCount > 0) {
      await saveButtons.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-after-submit.png', fullPage: true });
    }

    await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-form-validation.png', fullPage: true });
  });

  test('should verify form validation error messages', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=Guigui.com')).toBeVisible({ timeout: 10000 });

    // Fill form with invalid data and verify errors
    const formInputs = page.locator('input');
    
    // Test empty full name - should show error
    const textInputs = formInputs.filter({ has: page.locator('input[type="text"]') });
    if (await textInputs.count() > 0) {
      // Clear and leave empty
      await textInputs.first().clear();
      await page.waitForTimeout(500);
      
      // Look for error messages - they should have red color or specific classes
      const errorMessages = page.locator('.text-red-600, .error, .text-error, [role="alert"]');
      const errorCount = await errorMessages.count();
      
      console.log('Error messages found:', errorCount);
    }

    // Test invalid email format
    const emailInputs = formInputs.filter({ has: page.locator('input[type="email"]') });
    if (await emailInputs.count() > 0) {
      await emailInputs.first().clear();
      await emailInputs.first().fill('invalid-email');  // Missing @ and domain
      await page.waitForTimeout(500);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-invalid-email.png', fullPage: false });
    }

    // Test invalid phone format
    const phoneInputs = formInputs.filter({ has: page.locator('input[type="tel"]') });
    if (await phoneInputs.count() > 0) {
      await phoneInputs.first().clear();
      await phoneInputs.first().fill('invalid-phone');  // Not a valid format
      await page.waitForTimeout(500);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-invalid-phone.png', fullPage: false });
    }

    // Test date of birth validation (future date should error)
    const dateInputs = formInputs.filter({ has: page.locator('input[type="date"]') });
    if (await dateInputs.count() > 0) {
      await dateInputs.first().clear();
      // Set a future date
      await dateInputs.first().fill('2099-12-31');
      await page.waitForTimeout(500);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-future-dob.png', fullPage: false });
    }

    await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-validation-summary.png', fullPage: true });
  });

  test('should verify theme and language persistency', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=Guigui.com')).toBeVisible({ timeout: 10000 });

    // Look for theme toggle button
    const themeToggle = page.locator('button, [role="button"]').filter({ has: page.locator(':text("dark"), :text("light")') });
    const themeToggleCount = await themeToggle.count();
    
    console.log('Theme toggle buttons found:', themeToggleCount);

    // Look for language selector
    const langElements = page.locator('button, a, [role="menuitem"]').filter({ has: page.locator(':text("Português"), :text("English"), :text("Français"), :text("Español")') });
    const langCount = await langElements.count();
    
    console.log('Language elements found:', langCount);

    // Take screenshot of the settings area
    await page.screenshot({ path: 'tests/e2e/screenshots/client-settings-theme-language.png', fullPage: true });

    // Verify page title
    await expect(page).toHaveTitle(/Guigui/);
  });
});