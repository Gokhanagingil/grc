import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

export default defineConfig({
  testDir: "./tests/platform-health",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/platform-health-report.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  projects: [
    {
      name: "smoke",
      testMatch: "platform-health.spec.ts",
    },
  ],
});
