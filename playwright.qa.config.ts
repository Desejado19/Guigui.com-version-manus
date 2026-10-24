import { defineConfig, devices } from '@playwright/test';

const qaBaseUrl = process.env.QA_BASE_URL?.trim();
if (!qaBaseUrl) {
  throw new Error('QA_BASE_URL must be set to the approved local QA origin before Playwright runs.');
}

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  testIgnore: ['**/unit/**'],
  fullyParallel: true,
  workers: 2,
  outputDir: 'test-results/qa-playwright/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/qa', open: 'never' }],
    ['json', { outputFile: 'test-results/qa-playwright/results.json' }],
  ],
  globalSetup: './scripts/qa/playwright-global-setup.ts',
  use: {
    baseURL: qaBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
