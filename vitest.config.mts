import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["**/*.test.ts"],
    // admin/ is a separate app with its own tests.
    exclude: ["node_modules", ".next", "admin"],
  },
});
