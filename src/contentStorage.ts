import type { LedContentState, PlaybackMode, PlaylistEntry, Sponsor } from "@/types";

const STORAGE_KEY = "ledboarding.content.v1";

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function defaultContent(): LedContentState {
  const s1: Sponsor = {
    id: rid("s"),
    label: "ArenaCue LED",
    bgColor: "#064e3b",
    textColor: "#ecfdf5",
  };
  const s2: Sponsor = {
    id: rid("s"),
    label: "Sound & Vision",
    bgColor: "#3f3f46",
    textColor: "#fafafa",
  };
  const s3: Sponsor = {
    id: rid("s"),
    label: "Welkom in het stadion",
    bgColor: "#1e3a8a",
    textColor: "#eff6ff",
  };
  const sponsors = [s1, s2, s3];
  const playlist: PlaylistEntry[] = sponsors.map((s) => ({
    sponsorId: s.id,
    durationSec: 10,
  }));
  return {
    settings: {
      playbackMode: "scroll",
      scrollLoopDurationSec: 42,
    },
    sponsors,
    playlist,
  };
}

export function loadContent(): LedContentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = defaultContent();
      saveContent(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeContent(parsed);
    return normalized;
  } catch {
    const initial = defaultContent();
    saveContent(initial);
    return initial;
  }
}

export function saveContent(state: LedContentState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent("ledboarding-update"));
  });
}

function normalizeContent(raw: unknown): LedContentState {
  const base = defaultContent();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  const settings =
    o.settings && typeof o.settings === "object"
      ? normalizeSettings(o.settings as Record<string, unknown>)
      : base.settings;

  const sponsorsRaw = Array.isArray(o.sponsors) ? o.sponsors : [];
  const sponsors = sponsorsRaw.map(normalizeSponsor).filter(Boolean) as Sponsor[];
  const playlistRaw = Array.isArray(o.playlist) ? o.playlist : [];
  const playlist = playlistRaw.map(normalizePlaylistEntry).filter(Boolean) as PlaylistEntry[];

  const sponsorIds = new Set(sponsors.map((s) => s.id));
  const playlistFiltered = playlist.filter((p) => sponsorIds.has(p.sponsorId));

  const merged: LedContentState = {
    settings,
    sponsors: sponsors.length > 0 ? sponsors : base.sponsors,
    playlist: playlistFiltered.length > 0 ? playlistFiltered : base.playlist,
  };
  return merged;
}

function normalizeSettings(o: Record<string, unknown>): LedContentState["settings"] {
  const mode: PlaybackMode = o.playbackMode === "hold" ? "hold" : "scroll";
  const scrollLoopDurationSec = clampNum(o.scrollLoopDurationSec, 12, 240, 42);
  return { playbackMode: mode, scrollLoopDurationSec };
}

function normalizeSponsor(x: unknown): Sponsor | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : rid("s");
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;
  const bgColor = normalizeHexOrNull(o.bgColor);
  const textColor = normalizeHexOrNull(o.textColor);
  return { id, label, bgColor, textColor };
}

function normalizePlaylistEntry(x: unknown): PlaylistEntry | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const sponsorId = typeof o.sponsorId === "string" ? o.sponsorId : "";
  if (!sponsorId) return null;
  const durationSec = clampNum(o.durationSec, 2, 600, 10);
  return { sponsorId, durationSec };
}

function normalizeHexOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
