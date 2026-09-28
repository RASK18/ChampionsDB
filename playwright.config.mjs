import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4173/ChampionsDB/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node scripts/serve-site.mjs",
    url: "http://127.0.0.1:4173/ChampionsDB/",
    reuseExistingServer: !process.env.CI,
  },
});
