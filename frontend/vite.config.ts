import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      port: 5173,
      // En desarrollo, /api y /media se envían al backend Django (mismo origen → cookies seguras)
      proxy: {
        "/api": { target: env.VITE_DEV_API_TARGET || "http://127.0.0.1:8000", changeOrigin: true },
        "/media": { target: env.VITE_DEV_API_TARGET || "http://127.0.0.1:8000", changeOrigin: true },
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: { vendor: ["react", "react-dom", "react-router-dom"], query: ["@tanstack/react-query", "axios"] },
        },
      },
    },
    test: { environment: "node" },
  };
});
