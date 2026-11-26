import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.PW_PORT?.trim() || '3100';
const baseURL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './audit',
  testMatch: 'audit/*.spec.ts',
  testIgnore: ['**/unit/**'],
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});