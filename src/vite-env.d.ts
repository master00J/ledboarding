/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARENACUE_FEED_URL?: string;
}

interface LedboardingDesktopApi {
  openOutput(zoneId: string): Promise<boolean>;
  focusOutput(zoneId: string): Promise<boolean>;
  closeOutput(zoneId: string): Promise<boolean>;
  listOutputWindows(): Promise<string[]>;
  selectMediaFiles(): Promise<string[]>;
  onOutputWindowsChanged(callback: (zoneIds: string[]) => void): () => void;
}

interface Window {
  ledboarding?: LedboardingDesktopApi;
}
