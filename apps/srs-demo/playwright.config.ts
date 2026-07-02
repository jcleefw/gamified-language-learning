import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: 'e2e/steps/**/*.ts',
});

export default defineConfig({
  testDir,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5174',
  },
  webServer: [
    {
      command: 'pnpm --filter @gll/server dev',
      port: 6060,
      env: { GLL_DB_PATH: '.data/srs-demo-e2e.db' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @gll/srs-demo dev --port 5174',
      port: 5174,
      env: { VITE_CHEAT_MODE: 'true' },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
