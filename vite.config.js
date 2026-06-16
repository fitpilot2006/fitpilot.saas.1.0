import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT) || 5000;
const basePath = process.env.BASE_PATH || "/";

export default {
  base: basePath,
  plugins: [react(), tailwindcss()],
  root: path.resolve(__dirname, "artifacts/gym-app"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "artifacts/gym-app/src"),
      "@assets": path.resolve(__dirname, "attached_assets"),
      "@workspace/api-client-react": path.resolve(__dirname, "lib/api-client-react/src/index.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "artifacts/gym-app/dist/public"),
    emptyOutDir: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
};
