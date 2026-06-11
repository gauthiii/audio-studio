import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            console.info(`[vite proxy] ${req.method} ${req.url} -> ${API_PROXY_TARGET}${proxyReq.path}`);
          });
          proxy.on("error", (err, req) => {
            console.error(`[vite proxy] ${req.method} ${req.url} failed: ${err.message}`);
          });
        },
      },
    },
  },
});
