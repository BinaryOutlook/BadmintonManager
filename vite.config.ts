import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    exclude: ["e2e/**", "node_modules/**", ".git/**"],
    coverage: {
      provider: "v8",
      include: [
        "game/core/**/*.ts",
        "game/store/**/*.ts",
        "game/career/**/*.ts",
        "game/tournament/**/*.ts"
      ],
      reporter: ["text", "json-summary", "html"],
      reportOnFailure: true,
      thresholds: {
        "game/core/**/*.ts": {
          statements: 90.65,
          branches: 87.12,
          functions: 89.62,
          lines: 90.95
        },
        "game/store/**/*.ts": {
          statements: 69.05,
          branches: 67.35,
          functions: 68.87,
          lines: 69.21
        },
        "game/career/**/*.ts": {
          statements: 92.85,
          branches: 77.13,
          functions: 95.22,
          lines: 92.67
        },
        "game/tournament/**/*.ts": {
          statements: 93.83,
          branches: 81.44,
          functions: 100,
          lines: 93.12
        }
      }
    }
  }
});
