import { defineConfig, devices } from '@playwright/test'

// Regenerates the README screenshots in ../media: pnpm screenshots
export default defineConfig({
  testDir: 'screens',
  testIgnore: 'demo.spec.ts',
  use: { baseURL: 'http://localhost:4173', reducedMotion: 'reduce' },
  webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL } }],
})
