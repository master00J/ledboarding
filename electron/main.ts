import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { OpenDialogOptions } from "electron";
import fs from "node:fs";
import path from "node:path";
import { buildTexturePngBuffer, validateTextureBuildInput } from "./texture-export";

const IS_DEV = !app.isPackaged;

function appRoot(): string {
  return IS_DEV ? path.join(__dirname, "..") : app.getAppPath();
}

function rendererIndex(): string {
  return path.join(appRoot(), "renderer-dist", "index.html");
}

function windowIconPath(): string | undefined {
  const p = path.join(appRoot(), "build", "icon.ico");
  try {
    if (fs.existsSync(p)) return p;
  } catch {
    /* ignore */
  }
  return undefined;
}

const outputWindows = new Map<string, BrowserWindow>();
let controlWindow: BrowserWindow | null = null;

const SOURCE_FILE_FILTERS: OpenDialogOptions["filters"] = [
  {
    name: "Afbeelding of video",
    extensions: [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "bmp",
      "tif",
      "tiff",
      "mp4",
      "webm",
      "mov",
      "avi",
      "mkv",
      "m4v",
      "wmv",
      "mpeg",
      "mpg",
    ],
  },
  { name: "Afbeelding", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"] },
  { name: "Video", extensions: ["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv", "mpeg", "mpg"] },
];

function dialogParent(): BrowserWindow | null {
  if (controlWindow && !controlWindow.isDestroyed()) return controlWindow;
  return BrowserWindow.getFocusedWindow();
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : "banner.png";
}

function basenameNoExt(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const file = norm.slice(norm.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

function configureWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

function broadcastOutputWindows(): void {
  const payload = Array.from(outputWindows.keys());
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("ledboarding:output-windows", payload);
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: "ArenaCue LED boarding",
    icon: windowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  controlWindow = win;
  configureWindow(win);

  void win.loadFile(rendererIndex());

  win.on("closed", () => {
    if (controlWindow === win) controlWindow = null;
  });

  return win;
}

function createOutputWindow(zoneId: string): BrowserWindow {
  const existing = outputWindows.get(zoneId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 360,
    minWidth: 640,
    minHeight: 160,
    title: `ArenaCue LED output · ${zoneId}`,
    icon: windowIconPath(),
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  configureWindow(win);
  outputWindows.set(zoneId, win);
  void win.loadFile(rendererIndex(), { hash: `/display/${encodeURIComponent(zoneId)}` });

  win.on("closed", () => {
    outputWindows.delete(zoneId);
    broadcastOutputWindows();
  });

  broadcastOutputWindows();
  return win;
}

ipcMain.handle("ledboarding:open-output", (_event, zoneId: unknown) => {
  if (typeof zoneId !== "string" || !zoneId.trim()) return false;
  createOutputWindow(zoneId.trim());
  return true;
});

ipcMain.handle("ledboarding:focus-output", (_event, zoneId: unknown) => {
  if (typeof zoneId !== "string" || !zoneId.trim()) return false;
  const win = outputWindows.get(zoneId.trim());
  if (!win || win.isDestroyed()) return false;
  win.focus();
  return true;
});

ipcMain.handle("ledboarding:close-output", (_event, zoneId: unknown) => {
  if (typeof zoneId !== "string" || !zoneId.trim()) return false;
  const win = outputWindows.get(zoneId.trim());
  if (!win || win.isDestroyed()) return false;
  win.close();
  return true;
});

ipcMain.handle("ledboarding:list-output-windows", () => Array.from(outputWindows.keys()));

ipcMain.handle("ledboarding:select-media-files", async () => {
  const options: OpenDialogOptions = {
    title: "Selecteer LED boarding media",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Media", extensions: ["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "mov", "avi"] },
      { name: "Afbeeldingen", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      { name: "Video", extensions: ["mp4", "webm", "mov", "avi"] },
    ],
  };
  const res =
    controlWindow && !controlWindow.isDestroyed()
      ? await dialog.showOpenDialog(controlWindow, options)
      : await dialog.showOpenDialog(options);
  return res.canceled ? [] : res.filePaths;
});

ipcMain.handle("ledboarding:texture-select-source", async () => {
  const options: OpenDialogOptions = {
    title: "Kies sponsorbanner (afbeelding of video)",
    properties: ["openFile"],
    filters: SOURCE_FILE_FILTERS,
  };
  const parent = dialogParent();
  const res = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle("ledboarding:texture-select-sources", async () => {
  const options: OpenDialogOptions = {
    title: "Kies één of meerdere banners (batch)",
    properties: ["openFile", "multiSelections"],
    filters: SOURCE_FILE_FILTERS,
  };
  const parent = dialogParent();
  const res = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);
  if (res.canceled) return [];
  return res.filePaths;
});

ipcMain.handle("ledboarding:pick-directory", async (_event, raw: unknown) => {
  const initial =
    raw && typeof raw === "object" && typeof (raw as { defaultPath?: unknown }).defaultPath === "string"
      ? ((raw as { defaultPath: string }).defaultPath || "").trim()
      : "";
  const options: OpenDialogOptions = {
    title: "Kies outputmap (LED boarding)",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: initial || undefined,
  };
  const parent = dialogParent();
  const res = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle("ledboarding:open-folder", async (_event, raw: unknown) => {
  if (typeof raw !== "string" || !raw.trim()) return false;
  const dir = raw.trim();
  try {
    if (!fs.existsSync(dir)) return false;
    await shell.openPath(dir);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle(
  "ledboarding:texture-quick-export-png",
  async (
    _event,
    payload: unknown,
  ): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> => {
    try {
      const p = payload as {
        build: unknown;
        outputDirectory?: string;
        fileName?: string;
        revealInFolder?: boolean;
      };
      const v = validateTextureBuildInput(p?.build);
      if (!v.ok) return { ok: false, error: v.error };
      const dir = typeof p.outputDirectory === "string" ? p.outputDirectory.trim() : "";
      if (!dir) return { ok: false, error: "Geen outputmap ingesteld." };
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        return {
          ok: false,
          error: `Outputmap kon niet aangemaakt worden: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      const fileName = sanitizeFilename(
        typeof p.fileName === "string" && p.fileName.trim().length > 0
          ? p.fileName.trim()
          : `${basenameNoExt(v.value.inputPath) || "banner"}-${v.value.canvasWidth}x${v.value.canvasHeight}.png`,
      );
      const filePath = path.join(dir, fileName);
      const buf = await buildTexturePngBuffer(v.value);
      fs.writeFileSync(filePath, buf);
      if (p.revealInFolder) {
        try {
          await shell.showItemInFolder(filePath);
        } catch {
          /* ignore */
        }
      }
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
);

ipcMain.handle(
  "ledboarding:texture-batch-export-png",
  async (
    _event,
    payload: unknown,
  ): Promise<
    | {
        ok: true;
        outputDirectory: string;
        results: Array<{ inputPath: string; ok: boolean; filePath?: string; error?: string }>;
      }
    | { ok: false; error: string }
  > => {
    try {
      const p = payload as {
        build: unknown;
        inputPaths?: unknown;
        outputDirectory?: string;
        filenameTemplateRendered?: unknown;
      };
      const dir = typeof p.outputDirectory === "string" ? p.outputDirectory.trim() : "";
      if (!dir) return { ok: false, error: "Geen outputmap ingesteld." };
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        return {
          ok: false,
          error: `Outputmap kon niet aangemaakt worden: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      const inputPaths = Array.isArray(p.inputPaths)
        ? p.inputPaths.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [];
      if (inputPaths.length === 0) return { ok: false, error: "Geen bronbestanden meegegeven." };

      const renderedNames = Array.isArray(p.filenameTemplateRendered)
        ? p.filenameTemplateRendered.map((s) => (typeof s === "string" ? s : ""))
        : [];

      const results: Array<{ inputPath: string; ok: boolean; filePath?: string; error?: string }> = [];
      const usedNames = new Set<string>();

      for (let i = 0; i < inputPaths.length; i += 1) {
        const inputPath = inputPaths[i]!;
        try {
          const v = validateTextureBuildInput({ ...(p.build as object), inputPath });
          if (!v.ok) {
            results.push({ inputPath, ok: false, error: v.error });
            continue;
          }
          const requested =
            typeof renderedNames[i] === "string" && renderedNames[i]!.trim().length > 0
              ? renderedNames[i]!
              : `${basenameNoExt(inputPath) || "banner"}-${v.value.canvasWidth}x${v.value.canvasHeight}.png`;
          let fileName = sanitizeFilename(requested);
          if (usedNames.has(fileName.toLowerCase())) {
            const dot = fileName.lastIndexOf(".");
            const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
            const ext = dot > 0 ? fileName.slice(dot) : ".png";
            let suffix = 2;
            let candidate = `${stem}-${suffix}${ext}`;
            while (usedNames.has(candidate.toLowerCase())) {
              suffix += 1;
              candidate = `${stem}-${suffix}${ext}`;
            }
            fileName = candidate;
          }
          usedNames.add(fileName.toLowerCase());
          const filePath = path.join(dir, fileName);
          const buf = await buildTexturePngBuffer(v.value);
          fs.writeFileSync(filePath, buf);
          results.push({ inputPath, ok: true, filePath });
        } catch (err) {
          results.push({
            inputPath,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return { ok: true, outputDirectory: dir, results };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
);

ipcMain.handle("ledboarding:texture-preview", async (_event, raw: unknown) => {
  try {
    const v = validateTextureBuildInput(raw);
    if (!v.ok) return { ok: false as const, error: v.error };
    const buf = await buildTexturePngBuffer(v.value);
    const maxPreviewBytes = 40 * 1024 * 1024;
    if (buf.length > maxPreviewBytes) {
      return {
        ok: false as const,
        error: "Voorbeeld te groot — verklein het canvas of exporteer direct naar bestand.",
      };
    }
    return {
      ok: true as const,
      dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
      width: v.value.canvasWidth,
      height: v.value.canvasHeight,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: msg };
  }
});

ipcMain.handle(
  "ledboarding:texture-export-png",
  async (
    _event,
    payload: unknown,
  ): Promise<
    | { ok: true; filePath: string }
    | { ok: false; error: string; canceled?: boolean }
  > => {
    try {
      const p = payload as {
        build: unknown;
        suggestedName?: string;
        defaultDirectory?: string | null;
      };
      const v = validateTextureBuildInput(p?.build);
      if (!v.ok) return { ok: false, error: v.error };
      const buf = await buildTexturePngBuffer(v.value);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const suggested =
        typeof p.suggestedName === "string" && p.suggestedName.trim().length > 0
          ? p.suggestedName.trim()
          : `led-boarding-texture-${stamp}.png`;
      const dir =
        typeof p.defaultDirectory === "string" && p.defaultDirectory.trim().length > 0
          ? p.defaultDirectory.trim()
          : app.getPath("documents");
      const defaultPath = path.join(dir, sanitizeFilename(suggested));

      const win = dialogParent();
      const save = win
        ? await dialog.showSaveDialog(win, {
            title: "Texture opslaan als PNG",
            defaultPath,
            filters: [{ name: "PNG", extensions: ["png"] }],
          })
        : await dialog.showSaveDialog({
            title: "Texture opslaan als PNG",
            defaultPath,
            filters: [{ name: "PNG", extensions: ["png"] }],
          });
      if (save.canceled || !save.filePath) {
        return { ok: false, error: "Geannuleerd.", canceled: true };
      }
      fs.writeFileSync(save.filePath, buf);
      await shell.showItemInFolder(save.filePath);
      return { ok: true, filePath: save.filePath };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
);

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
