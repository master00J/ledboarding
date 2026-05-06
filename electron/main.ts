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
    filters: [
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
    ],
  };
  const res =
    controlWindow && !controlWindow.isDestroyed()
      ? await dialog.showOpenDialog(controlWindow, options)
      : await dialog.showOpenDialog(options);
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

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
      const defaultPath = path.join(dir, suggested.replace(/[/\\?%*:|"<>]/g, "_"));

      const win =
        controlWindow && !controlWindow.isDestroyed() ? controlWindow : BrowserWindow.getFocusedWindow();
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
