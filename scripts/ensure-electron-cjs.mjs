/**
 * Hoofd-package.json staat op "type": "module" (voor Vite). Electron laadt
 * `electron-dist/main.js` (CommonJS van tsc) anders als ESM en crasht op `exports`.
 * Schrijf hier een minimale package.json met `"type": "commonjs"` zodat Node/Electron
 * de gecompileerde main als CJS behandelt.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "electron-dist");
const pkg = path.join(dir, "package.json");

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(
  pkg,
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
  "utf8",
);
console.log("[electron-cjs] geschreven:", path.relative(root, pkg));
