import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "astro:env/server": fileURLToPath(new URL("./src/test/mocks/astro-virtual.ts", import.meta.url)),
      "astro:middleware": fileURLToPath(new URL("./src/test/mocks/astro-virtual.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
