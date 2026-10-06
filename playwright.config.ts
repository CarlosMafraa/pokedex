import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/ios.spec.ts',
    },
    // iPhone: WebKit (motor de todo navegador no iOS), só as verificações de ios.spec.ts
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] }, testMatch: '**/ios.spec.ts' },
    { name: 'iPhone SE', use: { ...devices['iPhone SE'] }, testMatch: '**/ios.spec.ts' },
  ],
  webServer: {
    command: `npm start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
