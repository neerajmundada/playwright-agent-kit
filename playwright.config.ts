import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Explicitly initialize and load the .env file from your project root directory
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Chromium honors --start-maximized and genuinely maximizes the OS window
// (requires viewport: null on the project below, so Playwright doesn't clamp
// the page back down to a fixed virtual size).
//
// Firefox has no equivalent launch flag - Playwright's patched Firefox build
// manages its own window through an internal automation protocol, and extra
// CLI args like -width/-height conflict with that instead of resizing it
// (observed: a second, unreachable window spawns alongside the real one). So
// for Firefox the closest safe approximation is a fixed viewport sized to
// the primary display's resolution, rather than a true OS-level maximize.
const CHROMIUM_MAXIMIZED = { args: ["--start-maximized"] };
const FIREFOX_MAXIMIZED_VIEWPORT = { width: 1920, height: 1080 };

export default defineConfig({
  testDir: "./tests",
  expect: {
    timeout: 15000,
  },
  // globalSetup: require.resolve("./fixtures/global-setup"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : Number(process.env.MAX_RETRIES ?? 0),
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["json", { outputFile: "reports/results.json" }],
  ],
  use: {
    baseURL:
      process.env.BASE_URL ||
      "https://react-shopping-cart-67954.firebaseapp.com",
    actionTimeout: 15 * 1000,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
    headless: false,
  },
  projects: [
    // Priority gate: runs @smoke and @critical UI tests first as a fast-fail
    // check. The chromium/firefox suites below depend on this passing before
    // they run, so a broken build fails in seconds instead of at the end of
    // a full regression pass. Scoped to tests/ui only - this project (and
    // the two below it) are what the auto-triggered CI pipeline runs on
    // every push/PR; the "api" project is deliberately separate and never
    // included in that automatic run (see .github/workflows/api-tests.yml,
    // which is manual-dispatch only).
    {
      name: "priority-gate",
      testDir: "./tests/ui",
      grep: /@smoke|@critical/,
      use:
        process.env.BROWSER === "chromium"
          ? {
              ...devices["Desktop Chrome"],
              viewport: null,
              deviceScaleFactor: undefined,
              launchOptions: CHROMIUM_MAXIMIZED,
            }
          : {
              ...devices["Desktop Firefox"],
              viewport: FIREFOX_MAXIMIZED_VIEWPORT,
            },
    },
    {
      name: "chromium",
      testDir: "./tests/ui",
      dependencies: ["priority-gate"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: null,
        deviceScaleFactor: undefined,
        launchOptions: CHROMIUM_MAXIMIZED,
      },
    },
    {
      name: "firefox",
      testDir: "./tests/ui",
      dependencies: ["priority-gate"],
      use: {
        ...devices["Desktop Firefox"],
        viewport: FIREFOX_MAXIMIZED_VIEWPORT,
      },
    },
    // {
    //   name: "webkit",
    //   use: {
    //     ...devices["Desktop Safari"],
    //   },
    // },
    // API tests are pure HTTP (Playwright's `request` fixture) - no browser
    // needed. Kept as its own project, entirely independent of the UI
    // priority-gate, so it only ever runs when explicitly targeted
    // (--project=api) and is never swept up by the auto-triggered pipeline.
    {
      name: "api",
      testDir: "./tests/api",
    },
  ],
  outputDir: "reports/test-artifacts",
});
