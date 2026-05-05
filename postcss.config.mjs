/**
 * Voorkomt dat Vite de parent `scoreboard/postcss.config.mjs` (Tailwind v3) laadt
 * bij builds in deze submap. CSS-pipeline staat op @tailwindcss/vite in vite.config.ts.
 */
export default {
  plugins: {},
};
