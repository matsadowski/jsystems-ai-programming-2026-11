import { defineConfig, devices } from "@playwright/test";

// E2E runs against the real production build (ADR 000 TAC-07). No request mocking.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run start -- --port 3000",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      // The RULES-path specs (expired return/complaint, validation, layout, a11y) never call a
      // model, so a placeholder key is enough and no secret is needed. With E2E_REAL_LLM=1
      // (part b) the server reads the real app/.env instead.
      env:
        process.env.E2E_REAL_LLM === "1"
          ? {}
          : {
              OPENROUTER_API_KEY: "placeholder-not-a-key",
              VISION_MODEL: "anthropic/claude-sonnet-5.5",
              DECISION_MODEL: "anthropic/claude-opus-5.5",
            },
      timeout: 120_000,
    },
  ],
});
