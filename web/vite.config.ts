import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev server proxies the playground API to the zero-dep Node backend on :5173.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/run": "http://localhost:5173",
      "/control": "http://localhost:5173",
      "/config": "http://localhost:5173",
      "/events": { target: "http://localhost:5173", changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
