import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
