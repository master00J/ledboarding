import { app, BrowserWindow, shell } from "electron";
import path from "node:path";

const IS_DEV = !app.isPackaged;

function appRoot(): string {
  return IS_DEV ? path.join(__dirname, "..") : app.getAppPath();
}

function rendererIndex(): string {
  return path.join(appRoot(), "renderer-dist", "index.html");
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: "ArenaCue LED boarding",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void win.loadFile(rendererIndex());

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
