import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // `server-only` throws outside the react-server condition; tests run server modules directly.
      "server-only": new URL("./node_modules/server-only/empty.js", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "evals/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./tests/setup/network-guard.ts", "./tests/setup/jest-dom.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**"],
    },
  },
});
