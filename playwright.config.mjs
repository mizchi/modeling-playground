import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: process.env.CI ? 'list' : undefined,
  use: {
    baseURL: 'http://127.0.0.1:5188',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_SOFTWARE_RENDERING
      ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
      : {},
  },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:5188', reuseExistingServer: true },
});
