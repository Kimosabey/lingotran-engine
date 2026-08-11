import { defineConfig, devices } from "@playwright/test";

// Runs against a production build (never `next dev` -- dev-mode timings and
// warnings aren't representative) on a fixed port, per 12_PLAYWRIGHT.md.
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // The site now runs continuous animation on every route -- the hero's
  // verification loop (11 CSS tracks) plus the byline's requestAnimationFrame
  // sweep. Ten parallel WebKit contexts each driving that starved one another
  // enough to blow the default 5s expect timeout, producing failures that were
  // load artefacts rather than real defects (the same tests pass at low
  // concurrency and a solo WebKit run reports zero console errors). Cap the
  // workers and give assertions realistic headroom so a red run means a real
  // regression.
  workers: process.env.CI ? 2 : 3,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `next build && next start -p ${PORT}`,
    // Isolated tree so an e2e run never corrupts a live `next dev` Turbopack
    // cache (see the distDir note in next.config.ts).
    env: { NEXT_DIST_DIR: ".next-prod" },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
