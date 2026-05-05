import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ledboarding", {
  openOutput: (zoneId: string) => ipcRenderer.invoke("ledboarding:open-output", zoneId),
  focusOutput: (zoneId: string) => ipcRenderer.invoke("ledboarding:focus-output", zoneId),
  closeOutput: (zoneId: string) => ipcRenderer.invoke("ledboarding:close-output", zoneId),
  listOutputWindows: () => ipcRenderer.invoke("ledboarding:list-output-windows"),
  selectMediaFiles: () => ipcRenderer.invoke("ledboarding:select-media-files"),
  onOutputWindowsChanged: (callback: (zoneIds: string[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, zoneIds: string[]) => callback(zoneIds);
    ipcRenderer.on("ledboarding:output-windows", listener);
    return () => ipcRenderer.removeListener("ledboarding:output-windows", listener);
  },
});
