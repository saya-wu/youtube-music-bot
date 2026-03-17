import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { getAppMetadata } from "../src/utils/app-metadata.ts";

const metadata = getAppMetadata();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(metadata.appVersion),
    "import.meta.env.VITE_APP_GIT_SHA": JSON.stringify(metadata.gitSha),
    "import.meta.env.VITE_APP_BUILD_VERSION": JSON.stringify(
      metadata.buildVersion,
    ),
    "import.meta.env.VITE_APP_ENVIRONMENT": JSON.stringify(metadata.environment),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, "/ws"),
      },
    },
  },
});
