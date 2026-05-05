import type {
  LedContentState,
  MediaFit,
  PlaybackMode,
  PlaylistEntry,
  PlaylistSegment,
  Sponsor,
  SponsorContentKind,
} from "@/types";
import { LIVE_SEGMENT_ID } from "@/types";

const STORAGE_KEY = "ledboarding.content.v1";

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createDefaultSegments(playlist: PlaylistEntry[]): PlaylistSegment[] {
  return [
    {
      id: LIVE_SEGMENT_ID,
      label: "Volledige wedstrijd",
      playlist,
      useGlobalSettings: true,
      playbackMode: "scroll",
      scrollLoopDurationSec: 42,
    },
    {
      id: "halftime",
      label: "Rust / pauze",
      playlist: [],
      useGlobalSettings: true,
      playbackMode: "scroll",
      scrollLoopDurationSec: 42,
    },
    {
      id: "goal",
      label: "Na goal",
      playlist: [],
      useGlobalSettings: true,
      playbackMode: "hold",
      scrollLoopDurationSec: 42,
    },
  ];
}

export function defaultContent(): LedContentState {
  const s1: Sponsor = {
    id: rid("s"),
    label: "ArenaCue LED",
    bgColor: "#064e3b",
    textColor: "#ecfdf5",
    logoDataUrl: null,
    contentKind: "text",
    mediaSrc: null,
    mediaTitle: null,
    mediaFit: "contain",
  };
  const s2: Sponsor = {
    id: rid("s"),
    label: "Sound & Vision",
    bgColor: "#3f3f46",
    textColor: "#fafafa",
    logoDataUrl: null,
    contentKind: "text",
    mediaSrc: null,
    mediaTitle: null,
    mediaFit: "contain",
  };
  const s3: Sponsor = {
    id: rid("s"),
    label: "Welkom in het stadion",
    bgColor: "#1e3a8a",
    textColor: "#eff6ff",
    logoDataUrl: null,
    contentKind: "text",
    mediaSrc: null,
    mediaTitle: null,
    mediaFit: "contain",
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
      feedFollowSegment: false,
    },
    sponsors,
    segments: createDefaultSegments(playlist),
    activeSegmentId: LIVE_SEGMENT_ID,
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
    return normalizeContent(parsed);
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

export function setActiveSegment(segmentId: string): void {
  const c = loadContent();
  if (!c.segments.some((s) => s.id === segmentId)) return;
  if (c.activeSegmentId === segmentId) return;
  saveContent({ ...c, activeSegmentId: segmentId });
}

export function applyImportedContent(next: unknown): LedContentState {
  const normalized = normalizeContent(next);
  saveContent(normalized);
  return normalized;
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
  const mergedSponsors = sponsors.length > 0 ? sponsors : base.sponsors;
  const sponsorIds = new Set(mergedSponsors.map((s) => s.id));

  let segments: PlaylistSegment[] = [];

  if (Array.isArray(o.segments) && o.segments.length > 0) {
    segments = o.segments.map((x) => normalizeSegment(x, sponsorIds)).filter(Boolean) as PlaylistSegment[];
  }

  const legacyPlaylist = Array.isArray(o.playlist) ? o.playlist : [];
  if (segments.length === 0) {
    const fromLegacy = legacyPlaylist.map(normalizePlaylistEntry).filter(Boolean) as PlaylistEntry[];
    const filteredLegacy = fromLegacy.filter((p) => sponsorIds.has(p.sponsorId));
    const filler =
      filteredLegacy.length > 0
        ? filteredLegacy
        : mergedSponsors.map((s) => ({ sponsorId: s.id, durationSec: 10 }));
    segments = createDefaultSegments(
      filler.length > 0 ? filler : [{ sponsorId: mergedSponsors[0]!.id, durationSec: 10 }],
    );
  }

  segments = ensureCoreSegments(segments, mergedSponsors);

  const activeSegmentId =
    typeof o.activeSegmentId === "string" && segments.some((s) => s.id === o.activeSegmentId)
      ? o.activeSegmentId
      : LIVE_SEGMENT_ID;

  return {
    settings,
    sponsors: mergedSponsors,
    segments,
    activeSegmentId,
  };
}

/** Zorgt dat `live` bestaat en playlists verwijzen naar bestaande sponsors. */
function ensureCoreSegments(segments: PlaylistSegment[], sponsors: Sponsor[]): PlaylistSegment[] {
  const sponsorIds = new Set(sponsors.map((s) => s.id));
  let list = segments.map((seg) => ({
    ...seg,
    playlist: seg.playlist.filter((p) => sponsorIds.has(p.sponsorId)),
  }));

  if (!list.some((s) => s.id === LIVE_SEGMENT_ID)) {
    const filler = sponsors.map((s) => ({ sponsorId: s.id, durationSec: 10 }));
    list = [
      {
        id: LIVE_SEGMENT_ID,
        label: "Volledige wedstrijd",
        playlist: filler.length > 0 ? filler : [],
        useGlobalSettings: true,
        playbackMode: "scroll",
        scrollLoopDurationSec: 42,
      },
      ...list,
    ];
  }

  const live = list.find((s) => s.id === LIVE_SEGMENT_ID)!;
  if (live.playlist.length === 0 && sponsors.length > 0) {
    live.playlist = sponsors.map((s) => ({ sponsorId: s.id, durationSec: 10 }));
  }

  return list;
}

function normalizeSettings(o: Record<string, unknown>): LedContentState["settings"] {
  const mode: PlaybackMode = o.playbackMode === "hold" ? "hold" : "scroll";
  const scrollLoopDurationSec = clampNum(o.scrollLoopDurationSec, 12, 240, 42);
  return {
    playbackMode: mode,
    scrollLoopDurationSec,
    feedFollowSegment: o.feedFollowSegment === true,
  };
}

function normalizeSegment(x: unknown, sponsorIds: Set<string>): PlaylistSegment | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : rid("seg");
  const label = typeof o.label === "string" ? o.label.trim() : "Segment";
  const playlistRaw = Array.isArray(o.playlist) ? o.playlist : [];
  const playlist = playlistRaw.map(normalizePlaylistEntry).filter(Boolean) as PlaylistEntry[];
  const playlistFiltered = playlist.filter((p) => sponsorIds.has(p.sponsorId));
  const useGlobalSettings = o.useGlobalSettings !== false;
  const playbackMode: PlaybackMode = o.playbackMode === "hold" ? "hold" : "scroll";
  const scrollLoopDurationSec = clampNum(o.scrollLoopDurationSec, 12, 240, 42);
  return {
    id,
    label: label || "Segment",
    playlist: playlistFiltered,
    useGlobalSettings,
    playbackMode,
    scrollLoopDurationSec,
  };
}

function normalizeSponsor(x: unknown): Sponsor | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : rid("s");
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;
  const bgColor = normalizeHexOrNull(o.bgColor);
  const textColor = normalizeHexOrNull(o.textColor);
  let logoDataUrl: string | null = null;
  if (typeof o.logoDataUrl === "string" && o.logoDataUrl.startsWith("data:image/")) {
    logoDataUrl = o.logoDataUrl.length <= 750_000 ? o.logoDataUrl : null;
  }
  const contentKind: SponsorContentKind =
    o.contentKind === "image" || o.contentKind === "video" ? o.contentKind : "text";
  const mediaSrc =
    typeof o.mediaSrc === "string" && o.mediaSrc.trim().length > 0 && o.mediaSrc.length <= 2_000_000
      ? o.mediaSrc.trim()
      : null;
  const mediaTitle =
    typeof o.mediaTitle === "string" && o.mediaTitle.trim().length > 0
      ? o.mediaTitle.trim().slice(0, 180)
      : null;
  const mediaFit: MediaFit = o.mediaFit === "cover" ? "cover" : "contain";
  return {
    id,
    label,
    bgColor,
    textColor,
    logoDataUrl,
    contentKind: mediaSrc ? contentKind : "text",
    mediaSrc,
    mediaTitle,
    mediaFit,
  };
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
