const LS_KEY = "ledboarding.textureExport.v1";

export type TextureFitMode = "cover" | "contain";
export type TextureLayoutMode = "stacked" | "wrapped";

/** Payload naar Electron main (zelfde als `validateTextureBuildInput`). */
export type TextureBuildPayload = {
  inputPath: string;
  stripWidth: number;
  stripHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  fit: TextureFitMode;
  layout: TextureLayoutMode;
  wrappedShiftPx: number;
  background?: { r: number; g: number; b: number; alpha?: number };
};

export type TextureExportRequest = {
  build: TextureBuildPayload;
  suggestedName?: string;
  defaultDirectory?: string | null;
};

export type TextureExportPrefs = {
  stripWidth: number;
  stripHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  fit: TextureFitMode;
  layout: TextureLayoutMode;
  wrappedShiftPx: number;
  /** Alleen Electron: absoluut pad naar laatst gekozen bron. */
  lastSourcePath: string;
  /** Map van laatste succesvolle export (voor standaard in save dialog). */
  lastExportDirectory: string;
};

const DEFAULTS: TextureExportPrefs = {
  stripWidth: 1920,
  stripHeight: 72,
  canvasWidth: 1920,
  canvasHeight: 990,
  fit: "cover",
  layout: "stacked",
  wrappedShiftPx: 96,
  lastSourcePath: "",
  lastExportDirectory: "",
};

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function parsePrefs(raw: string | null): TextureExportPrefs {
  if (!raw) return { ...DEFAULTS };
  try {
    const o = JSON.parse(raw) as Partial<TextureExportPrefs>;
    return {
      stripWidth: clampInt(Number(o.stripWidth), 2, 16384) || DEFAULTS.stripWidth,
      stripHeight: clampInt(Number(o.stripHeight), 2, 16384) || DEFAULTS.stripHeight,
      canvasWidth: clampInt(Number(o.canvasWidth), 2, 16384) || DEFAULTS.canvasWidth,
      canvasHeight: clampInt(Number(o.canvasHeight), 2, 16384) || DEFAULTS.canvasHeight,
      fit: o.fit === "contain" ? "contain" : "cover",
      layout: o.layout === "wrapped" ? "wrapped" : "stacked",
      wrappedShiftPx: clampInt(Number(o.wrappedShiftPx), 0, 16384),
      lastSourcePath: typeof o.lastSourcePath === "string" ? o.lastSourcePath : "",
      lastExportDirectory:
        typeof o.lastExportDirectory === "string" ? o.lastExportDirectory : "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function loadTextureExportPrefs(): TextureExportPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS };
  return parsePrefs(window.localStorage.getItem(LS_KEY));
}

export function saveTextureExportPrefs(prefs: TextureExportPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota */
  }
}

export function applyPerimeterPreset(): TextureExportPrefs {
  const cur = loadTextureExportPrefs();
  return {
    ...DEFAULTS,
    lastSourcePath: cur.lastSourcePath,
    lastExportDirectory: cur.lastExportDirectory,
  };
}

export { DEFAULTS as textureExportDefaultPrefs };
