import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Relatieve paden voor `file://` in Electron; output zoals scoreboard-renderer in `renderer-dist`. */
export default defineConfig({
  base: "./",
  build: {
    outDir: "renderer-dist",
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      /** Geen oude Tailwind v3 uit bovenliggende scoreboard/node_modules gebruiken. */
      tailwindcss: path.resolve(__dirname, "node_modules/tailwindcss"),
    },
  },
});
