import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

export default defineConfig({
  testDir: "./tests",
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
      testDir: "./tests/platform-health",
      testMatch: "platform-health.spec.ts",
      use: {
        baseURL: BASE_URL,
      },
    },
    {
      name: "real-stack",
      testDir: "./tests/e2e-real",
      testMatch: "**/*.spec.ts",
      use: {
        baseURL: BASE_URL,
      },
    },
    {
      name: "scenario-pack",
      testDir: "./tests/platform-health",
      testMatch: "scenario-pack-smoke.spec.ts",
      use: {
        baseURL: BASE_URL,
      },
    },
    {
      name: "topology",
      testDir: "./tests/platform-health",
      testMatch: "topology-smoke.spec.ts",
      use: {
        baseURL: BASE_URL,
      },
    },
    {
      name: "analytics",
      testDir: "./tests/platform-health",
      testMatch: "analytics-smoke.spec.ts",
      use: {
        baseURL: BASE_URL,
      },
    },
  ],
});
