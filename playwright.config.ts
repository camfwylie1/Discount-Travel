import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

const PORT = 3100
const baseURL = `http://127.0.0.1:${PORT}`

/**
 * Use a Chromium that is already on the machine when one is provided, rather
 * than downloading a second copy. Set PLAYWRIGHT_CHROMIUM_PATH to override;
 * leave it unset on a normal developer machine and Playwright manages its
 * own browsers as usual (`npx playwright install`).
 */
const CHROMIUM =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined)

/**
 * Chromium refuses to start its sandbox when the process is running as root,
 * which is the normal case inside a CI container. On a developer machine this
 * list stays empty and the sandbox is left on.
 */
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
const launchOptions = {
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  ...(isRoot ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
}

/**
 * END-TO-END TESTS
 *
 * These drive a real browser against a real server and a real database.
 * They are the only tests that prove the product works as a product, rather
 * than as a collection of functions.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop',
      // The mobile suite sets its own viewports and asserts on the phone
      // layout, so running it at desktop width proves nothing.
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      /**
       * Mobile emulation. The device descriptor supplies the mobile user
       * agent, touch support and device pixel ratio; the specs then set their
       * own viewport for each screen size they check.
       *
       * A Chromium-backed descriptor (Pixel 7) is used rather than an iPhone
       * one because iPhone descriptors declare `defaultBrowserType: 'webkit'`,
       * and the project would silently try to launch WebKit. Safari-specific
       * rendering therefore is NOT covered by this suite - that needs a real
       * WebKit build and is tracked in ROADMAP.md.
       */
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], browserName: 'chromium', launchOptions },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
