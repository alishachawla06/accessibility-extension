import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  retries: 0,
  workers: 1, // Chrome extension tests must run sequentially
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['html', { open: 'never' }]],
  projects: [
    {
      name: 'a11ylens',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
