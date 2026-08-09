import { defineConfig, devices } from "@playwright/test";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3_117);
const localBaseURL = `http://${host}:${port}`;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || localBaseURL;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: `${npmCommand} run dev -- --hostname ${host} --port ${port}`,
        url: localBaseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          SUPABASE_SUPPORT_USER_IDS: "",
          NEXT_PUBLIC_SITE_URL: localBaseURL,
        },
      },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
