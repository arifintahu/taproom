import { defineConfig, devices } from '@playwright/test'

// Records the demo video's footage: pnpm demo (see screens/demo.spec.ts).
export default defineConfig({
  testDir: 'screens',
  testMatch: 'demo.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://localhost:4174',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
  },
  webServer: { command: 'pnpm build && pnpm preview --port 4174 --strictPort', port: 4174, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, channel: process.env.PW_CHANNEL } }],
})
