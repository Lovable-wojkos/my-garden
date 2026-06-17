import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Both Astro virtual modules resolve to the same mock file since they're only used together
      // in tests and share minimal exports. Split if tests need different behaviors per module.
      "astro:env/server": fileURLToPath(new URL("./src/test/mocks/astro-virtual.ts", import.meta.url)),
      "astro:middleware": fileURLToPath(new URL("./src/test/mocks/astro-virtual.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "playwright/**"],
  },
});
