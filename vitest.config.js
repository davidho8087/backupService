import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    global: true,
    environment: "node",
    setupFiles: [],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
