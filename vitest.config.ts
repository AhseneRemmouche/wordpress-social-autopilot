import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirror the tsconfig `@/* -> src/*` path alias so tests import like app code.
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    // Two projects: node-env for lib/API tests (.test.ts), jsdom for UI component
    // tests (.test.tsx under tests/ui). `vitest run` runs both.
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          setupFiles: ["./tests/setup/env.ts"],
          globals: false,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.tsx"],
          setupFiles: ["./tests/setup/env.ts", "./tests/setup/ui.ts"],
          globals: false,
        },
      },
    ],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        // App Router pages/layouts are exercised via integration tests, not unit coverage.
        "src/app/**",
        "src/worker/**",
      ],
      // Regression gate (buffered just below current: ~86% lines / 75% branch).
      // `test:ci` fails if coverage drops below these.
      thresholds: {
        lines: 84,
        statements: 83,
        functions: 88,
        branches: 72,
      },
    },
  },
});
