/**
 * Zelfde pipeline als scoreboard/scripts/ensure-windows-icon.mjs:
 * schrijft `build/icon.ico` en `public/app-icon.png` voor electron-builder + venster.
 *
 * Volgorde: eerst een vindbare PNG (lokaal of `../` monorepo); anders kopiëren van `../build/icon.ico`
 * als je het scoreboard al gebouwd hebt.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const toIco = require("to-ico");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function copyParentIco(): boolean {
  const parentIco = path.join(root, "..", "build", "icon.ico");
  const outIco = path.join(root, "build", "icon.ico");
  if (!fs.existsSync(parentIco)) return false;
  fs.mkdirSync(path.join(root, "build"), { recursive: true });
  fs.copyFileSync(parentIco, outIco);
  console.log("[icon] gekopieerd van scoreboard:", path.relative(root, parentIco));
  return true;
}

function pickSourcePng(): string | null {
  const candidates = [
    path.join(root, "public", "arenacue-icon.png"),
    path.join(root, "public", "app-icon.png"),
    path.join(root, "..", "Website", "public", "assets", "arenacue-icon.png"),
    path.join(root, "..", "public", "app-icon.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function generateFromPng(src: string) {
  const outIco = path.join(root, "build", "icon.ico");
  const outPng = path.join(root, "public", "app-icon.png");
  const outDir = path.join(root, "build");

  const sizes = [256, 128, 64, 48, 32, 16];
  const buffers = [];
  for (const s of sizes) {
    const buf = await sharp(src)
      .resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    buffers.push(buf);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const ico = await toIco(buffers);
  fs.writeFileSync(outIco, ico);

  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  await sharp(src)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPng);

  console.log("[icon] bron:", path.relative(root, src));
  console.log("[icon] geschreven:", path.relative(root, outIco), path.relative(root, outPng));
}

async function main() {
  const png = pickSourcePng();
  if (png) {
    await generateFromPng(png);
    return;
  }
  if (copyParentIco()) return;

  throw new Error(
    "[icon] Geen bron: plaats arenacue-icon.png in ledboarding/public/, of bouw eerst het scoreboard (genereert ../build/icon.ico), of werk in de volledige monorepo.",
  );
}

await main();
