import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  // PW_CHANNEL=chrome uses the installed Chrome instead of a downloaded browser build.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL } }],
})
