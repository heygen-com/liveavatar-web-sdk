import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude],
    coverage: {
      provider: "v8", // or 'istanbul'
      reporter: ["text", "text-summary"],
      reportsDirectory: "./coverage", // default
      include: ["src/**/*.ts"],
      exclude: ["src/test/**"],
    },
  },
});
