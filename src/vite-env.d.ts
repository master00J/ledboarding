/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARENACUE_FEED_URL?: string;
  readonly VITE_ARENACUE_AI_BASE_URL?: string;
}

type TextureFitMode = "cover" | "contain";
type TextureLayoutMode = "stacked" | "wrapped";

type TextureBuildPayloadForWindow = {
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

type TextureExportPayloadForWindow = {
  build: TextureBuildPayloadForWindow;
  suggestedName?: string;
  defaultDirectory?: string | null;
};

type TexturePreviewResult =
  | { ok: true; dataUrl: string; width: number; height: number }
  | { ok: false; error: string };

type TextureExportResult =
  | { ok: true; filePath: string }
  | { ok: false; error: string; canceled?: boolean };

type OutputOpenOptionsForWindow = {
  displayId?: number | null;
  fullscreen?: boolean;
};

type LedDisplayInfoForWindow = {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  rotation: number;
  isPrimary: boolean;
};

type ImportedMediaFileForWindow = {
  path: string;
  title: string;
  kind: "image" | "video";
};

interface LedboardingDesktopApi {
  openOutput(zoneId: string, options?: OutputOpenOptionsForWindow): Promise<boolean>;
  focusOutput(zoneId: string): Promise<boolean>;
  closeOutput(zoneId: string): Promise<boolean>;
  listOutputWindows(): Promise<string[]>;
  listDisplays(): Promise<LedDisplayInfoForWindow[]>;
  selectMediaFiles(): Promise<string[]>;
  importMediaFiles(): Promise<ImportedMediaFileForWindow[]>;
  textureSelectSource(): Promise<string | null>;
  texturePreview(build: TextureBuildPayloadForWindow): Promise<TexturePreviewResult>;
  textureExportPng(payload: TextureExportPayloadForWindow): Promise<TextureExportResult>;
  onOutputWindowsChanged(callback: (zoneIds: string[]) => void): () => void;
}

interface Window {
  ledboarding?: LedboardingDesktopApi;
}
