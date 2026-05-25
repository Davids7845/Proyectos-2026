import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ['tests/e2e/**', 'node_modules', 'dist'],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
