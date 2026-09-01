/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    // Formatting is done with Intl, so the assertions only hold under a known
    // locale and zone. CI would otherwise run in UTC and a laptop would not.
    env: { TZ: "Asia/Kolkata" },
  },
  server: {
    // Proxying in dev means the browser only ever talks to one origin, so CORS
    // never applies locally and API paths are identical in dev and production.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
