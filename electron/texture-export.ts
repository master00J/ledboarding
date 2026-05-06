import fs from "node:fs";
import sharp from "sharp";
import { extractVideoFirstFrameToPngPath, isVideoPath } from "./video-frame";

export type TextureFitMode = "cover" | "contain";
export type TextureLayoutMode = "stacked" | "wrapped";

export type TextureBuildInput = {
  inputPath: string;
  stripWidth: number;
  stripHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  fit: TextureFitMode;
  layout: TextureLayoutMode;
  /** Horizontale verschuiving per rij (alleen layout `wrapped`). */
  wrappedShiftPx: number;
  background?: { r: number; g: number; b: number; alpha?: number };
};

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export function validateTextureBuildInput(raw: unknown): { ok: true; value: TextureBuildInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Ongeldige parameters." };
  }
  const o = raw as Record<string, unknown>;
  const inputPath = typeof o.inputPath === "string" ? o.inputPath.trim() : "";
  if (!inputPath) return { ok: false, error: "Geen bronbestand gekozen." };

  const stripWidth = clampInt(Number(o.stripWidth), 2, 16384);
  const stripHeight = clampInt(Number(o.stripHeight), 2, 16384);
  const canvasWidth = clampInt(Number(o.canvasWidth), 2, 16384);
  const canvasHeight = clampInt(Number(o.canvasHeight), 2, 16384);

  if (stripWidth > canvasWidth) {
    return { ok: false, error: "Stripbreedte mag niet groter zijn dan canvasbreedte." };
  }
  if (stripHeight > canvasHeight) {
    return { ok: false, error: "Striphoogte mag niet groter zijn dan canvashoogte (minstens één rij nodig)." };
  }

  const fit = o.fit === "contain" ? "contain" : "cover";
  const layout = o.layout === "wrapped" ? "wrapped" : "stacked";
  const wrappedShiftPx = clampInt(Number(o.wrappedShiftPx), 0, 16384);

  let background: TextureBuildInput["background"];
  if (o.background && typeof o.background === "object") {
    const b = o.background as Record<string, unknown>;
    const r = clampInt(Number(b.r), 0, 255);
    const g = clampInt(Number(b.g), 0, 255);
    const bl = clampInt(Number(b.b), 0, 255);
    const alpha = typeof b.alpha === "number" && Number.isFinite(b.alpha) ? Math.min(1, Math.max(0, b.alpha)) : 1;
    background = { r, g, b: bl, alpha };
  }

  return {
    ok: true,
    value: {
      inputPath,
      stripWidth,
      stripHeight,
      canvasWidth,
      canvasHeight,
      fit,
      layout,
      wrappedShiftPx,
      background,
    },
  };
}

export async function buildTexturePngBuffer(input: TextureBuildInput): Promise<Buffer> {
  const v = validateTextureBuildInput(input);
  if (!v.ok) throw new Error(v.error);
  const opts = v.value;

  if (!fs.existsSync(opts.inputPath)) {
    throw new Error("Bronbestand bestaat niet (meer).");
  }

  const bg = opts.background ?? { r: 0, g: 0, b: 0, alpha: 1 };
  const bgSharp = {
    r: bg.r,
    g: bg.g,
    b: bg.b,
    alpha: bg.alpha ?? 1,
  };

  const stripW = opts.stripWidth;
  const stripH = opts.stripHeight;
  const canvasW = opts.canvasWidth;
  const canvasH = opts.canvasHeight;

  let rasterPath = opts.inputPath;
  let unlinkRaster: string | null = null;
  if (isVideoPath(opts.inputPath)) {
    unlinkRaster = await extractVideoFirstFrameToPngPath(opts.inputPath);
    rasterPath = unlinkRaster;
  }

  try {
    const stripBuf = await sharp(rasterPath, {
      failOn: "none",
      limitInputPixels: 268_402_689,
      animated: false,
    })
      .rotate()
      .resize(stripW, stripH, {
        fit: opts.fit === "cover" ? "cover" : "contain",
        position: "centre",
        background: opts.fit === "contain" ? bgSharp : undefined,
      })
      .png()
      .toBuffer();

    const composites: sharp.OverlayOptions[] = [];
    const maxX = Math.max(0, canvasW - stripW);
    let row = 0;
    while ((row + 1) * stripH <= canvasH) {
      const y = row * stripH;
      let x = 0;
      if (opts.layout === "wrapped") {
        const span = maxX + 1;
        x = maxX === 0 ? 0 : (row * opts.wrappedShiftPx) % span;
      }
      composites.push({ input: stripBuf, left: x, top: y });
      row += 1;
    }

    return sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 4,
        background: bgSharp,
      },
    })
      .composite(composites)
      .png({ compressionLevel: 6 })
      .toBuffer();
  } finally {
    if (unlinkRaster) {
      try {
        fs.unlinkSync(unlinkRaster);
      } catch {
        /* ignore */
      }
    }
  }
}
