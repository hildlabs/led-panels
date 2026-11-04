import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": process.env.LED_DASHBOARD_URL ?? "http://127.0.0.1:8787",
    },
  },
});
