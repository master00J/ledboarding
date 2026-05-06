/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARENACUE_FEED_URL?: string;
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

interface LedboardingDesktopApi {
  openOutput(zoneId: string): Promise<boolean>;
  focusOutput(zoneId: string): Promise<boolean>;
  closeOutput(zoneId: string): Promise<boolean>;
  listOutputWindows(): Promise<string[]>;
  selectMediaFiles(): Promise<string[]>;
  textureSelectSource(): Promise<string | null>;
  texturePreview(build: TextureBuildPayloadForWindow): Promise<TexturePreviewResult>;
  textureExportPng(payload: TextureExportPayloadForWindow): Promise<TextureExportResult>;
  onOutputWindowsChanged(callback: (zoneIds: string[]) => void): () => void;
}

interface Window {
  ledboarding?: LedboardingDesktopApi;
}
