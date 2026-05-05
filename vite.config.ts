import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Relatieve paden voor `file://` in Electron; output zoals scoreboard-renderer in `renderer-dist`. */
export default defineConfig({
  base: "./",
  build: {
    outDir: "renderer-dist",
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
