import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ledboarding", {
  openOutput: (zoneId: string, options?: OutputOpenOptions) =>
    ipcRenderer.invoke("ledboarding:open-output", zoneId, options),
  focusOutput: (zoneId: string) => ipcRenderer.invoke("ledboarding:focus-output", zoneId),
  closeOutput: (zoneId: string) => ipcRenderer.invoke("ledboarding:close-output", zoneId),
  listOutputWindows: () => ipcRenderer.invoke("ledboarding:list-output-windows"),
  listDisplays: () => ipcRenderer.invoke("ledboarding:list-displays"),
  selectMediaFiles: () => ipcRenderer.invoke("ledboarding:select-media-files"),
  importMediaFiles: () => ipcRenderer.invoke("ledboarding:import-media-files"),
  textureSelectSource: () => ipcRenderer.invoke("ledboarding:texture-select-source"),
  texturePreview: (build: TextureBuildPayload) =>
    ipcRenderer.invoke("ledboarding:texture-preview", build),
  textureExportPng: (payload: TextureExportPayload) =>
    ipcRenderer.invoke("ledboarding:texture-export-png", payload),
  onOutputWindowsChanged: (callback: (zoneIds: string[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, zoneIds: string[]) => callback(zoneIds);
    ipcRenderer.on("ledboarding:output-windows", listener);
    return () => ipcRenderer.removeListener("ledboarding:output-windows", listener);
  },
});

type OutputOpenOptions = {
  displayId?: number | null;
  fullscreen?: boolean;
};

type TextureFitMode = "cover" | "contain";
type TextureLayoutMode = "stacked" | "wrapped";

type TextureBuildPayload = {
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

type TextureExportPayload = {
  build: TextureBuildPayload;
  suggestedName?: string;
  defaultDirectory?: string | null;
};
