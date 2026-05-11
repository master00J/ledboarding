import type { LiveOverrideMode, LivePlaybackCue, LivePlaybackState } from "@/types";

const STORAGE_KEY = "ledboarding.livePlayback.v1";
export const LIVE_PLAYBACK_EVENT = "ledboarding-live-playback-update";

function now(): number {
  return Date.now();
}

export function defaultLivePlayback(): LivePlaybackState {
  const t = now();
  return {
    status: "playing",
    overrideMode: "normal",
    activeCue: null,
    itemIndex: 0,
    itemStartedAtMs: t,
    pausedElapsedMs: 0,
    linkedZoneIds: [],
    updatedAtMs: t,
  };
}

export function loadLivePlayback(): LivePlaybackState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = defaultLivePlayback();
      saveLivePlayback(initial);
      return initial;
    }
    return normalizeLivePlayback(JSON.parse(raw));
  } catch {
    const initial = defaultLivePlayback();
    saveLivePlayback(initial);
    return initial;
  }
}

export function saveLivePlayback(state: LivePlaybackState): void {
  const normalized = normalizeLivePlayback(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(LIVE_PLAYBACK_EVENT));
    window.dispatchEvent(new CustomEvent("ledboarding-update"));
    window.ledboarding?.notifyStateChanged();
  });
}

export function updateLivePlayback(
  updater: (state: LivePlaybackState) => LivePlaybackState,
): LivePlaybackState {
  const next = normalizeLivePlayback(updater(loadLivePlayback()));
  saveLivePlayback(next);
  return next;
}

export function restartLivePlayback(itemIndex = 0): LivePlaybackState {
  return updateLivePlayback((state) => ({
    ...state,
    status: "playing",
    activeCue: null,
    itemIndex: clampIndex(itemIndex),
    itemStartedAtMs: now(),
    pausedElapsedMs: 0,
    updatedAtMs: now(),
  }));
}

export function playLivePlayback(): LivePlaybackState {
  return updateLivePlayback((state) => {
    const t = now();
    return {
      ...state,
      status: "playing",
      itemStartedAtMs: t - state.pausedElapsedMs,
      pausedElapsedMs: 0,
      updatedAtMs: t,
    };
  });
}

export function pauseLivePlayback(): LivePlaybackState {
  return updateLivePlayback((state) => {
    const t = now();
    return {
      ...state,
      status: "paused",
      pausedElapsedMs: Math.max(0, t - state.itemStartedAtMs),
      updatedAtMs: t,
    };
  });
}

export function setLiveOverrideMode(overrideMode: LiveOverrideMode): LivePlaybackState {
  return updateLivePlayback((state) => ({
    ...state,
    overrideMode,
    activeCue: overrideMode === "normal" ? state.activeCue : null,
    updatedAtMs: now(),
  }));
}

export function startLiveCue(input: {
  label: string;
  sponsorId: string;
  durationSec: number;
  returnToSegmentId?: string | null;
}): LivePlaybackState {
  const t = now();
  const cue: LivePlaybackCue = {
    id: `cue_${t}_${Math.random().toString(36).slice(2, 8)}`,
    label: input.label.trim().slice(0, 80) || "Wedstrijdmoment",
    sponsorId: input.sponsorId.trim(),
    durationSec: clampNumber(input.durationSec, 3, 600, 30),
    startedAtMs: t,
    returnToSegmentId: input.returnToSegmentId?.trim() || null,
    scope: "all",
  };
  return updateLivePlayback((state) => ({
    ...state,
    status: "playing",
    overrideMode: "normal",
    activeCue: cue,
    updatedAtMs: t,
  }));
}

export function clearLiveCue(): LivePlaybackState {
  return updateLivePlayback((state) => {
    const t = now();
    return {
      ...state,
      activeCue: null,
      itemStartedAtMs: t,
      pausedElapsedMs: 0,
      updatedAtMs: t,
    };
  });
}

export function setLinkedZoneIds(linkedZoneIds: string[]): LivePlaybackState {
  return updateLivePlayback((state) => ({
    ...state,
    linkedZoneIds: Array.from(new Set(linkedZoneIds.map((id) => id.trim()).filter(Boolean))).slice(0, 50),
    updatedAtMs: now(),
  }));
}

function normalizeLivePlayback(raw: unknown): LivePlaybackState {
  const base = defaultLivePlayback();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const status = o.status === "paused" ? "paused" : "playing";
  const overrideMode = normalizeOverride(o.overrideMode);
  const activeCue = normalizeCue(o.activeCue);
  const itemStartedAtMs = normalizeMs(o.itemStartedAtMs, base.itemStartedAtMs);
  const pausedElapsedMs = Math.max(0, normalizeMs(o.pausedElapsedMs, 0));
  const updatedAtMs = normalizeMs(o.updatedAtMs, base.updatedAtMs);
  const linkedZoneIds = Array.isArray(o.linkedZoneIds)
    ? Array.from(
        new Set(
          o.linkedZoneIds
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ).slice(0, 50)
    : [];
  return {
    status,
    overrideMode,
    activeCue: overrideMode === "normal" ? activeCue : null,
    itemIndex: clampIndex(Number(o.itemIndex)),
    itemStartedAtMs,
    pausedElapsedMs,
    linkedZoneIds,
    updatedAtMs,
  };
}

function normalizeCue(value: unknown): LivePlaybackCue | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const sponsorId = typeof o.sponsorId === "string" ? o.sponsorId.trim().slice(0, 160) : "";
  if (!sponsorId) return null;
  const startedAtMs = normalizeMs(o.startedAtMs, 0);
  if (startedAtMs <= 0) return null;
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 80) : "Wedstrijdmoment";
  const id =
    typeof o.id === "string" && o.id.trim()
      ? o.id.trim().slice(0, 120)
      : `cue_${startedAtMs}`;
  const returnToSegmentId =
    typeof o.returnToSegmentId === "string" && o.returnToSegmentId.trim()
      ? o.returnToSegmentId.trim().slice(0, 128)
      : null;
  return {
    id,
    label,
    sponsorId,
    durationSec: clampNumber(o.durationSec, 3, 600, 30),
    startedAtMs,
    returnToSegmentId,
    scope: "all",
  };
}

function normalizeOverride(value: unknown): LiveOverrideMode {
  if (value === "blackout" || value === "testPattern") return value;
  return "normal";
}

function normalizeMs(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampIndex(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}
