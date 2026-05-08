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

type TextureQuickExportPayloadForWindow = {
  build: TextureBuildPayloadForWindow;
  outputDirectory: string;
  fileName?: string;
  revealInFolder?: boolean;
};

type TextureQuickExportResult =
  | { ok: true; filePath: string }
  | { ok: false; error: string };

type TextureBatchExportPayloadForWindow = {
  build: TextureBuildPayloadForWindow;
  inputPaths: string[];
  outputDirectory: string;
  filenameTemplateRendered?: string[];
};

type TextureBatchExportResult =
  | {
      ok: true;
      outputDirectory: string;
      results: Array<{ inputPath: string; ok: boolean; filePath?: string; error?: string }>;
    }
  | { ok: false; error: string };

interface LedboardingDesktopApi {
  openOutput(zoneId: string): Promise<boolean>;
  focusOutput(zoneId: string): Promise<boolean>;
  closeOutput(zoneId: string): Promise<boolean>;
  listOutputWindows(): Promise<string[]>;
  selectMediaFiles(): Promise<string[]>;
  textureSelectSource(): Promise<string | null>;
  textureSelectSources(): Promise<string[]>;
  pickDirectory(defaultPath?: string): Promise<string | null>;
  openFolder(path: string): Promise<boolean>;
  texturePreview(build: TextureBuildPayloadForWindow): Promise<TexturePreviewResult>;
  textureExportPng(payload: TextureExportPayloadForWindow): Promise<TextureExportResult>;
  textureQuickExportPng(payload: TextureQuickExportPayloadForWindow): Promise<TextureQuickExportResult>;
  textureBatchExportPng(payload: TextureBatchExportPayloadForWindow): Promise<TextureBatchExportResult>;
  onOutputWindowsChanged(callback: (zoneIds: string[]) => void): () => void;
}

interface Window {
  ledboarding?: LedboardingDesktopApi;
}
