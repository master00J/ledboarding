import type { LedContentState, LivePlaybackCue, LivePlaybackState, ResolvedPlaylistEntry, Sponsor } from "@/types";

export type LiveCueTiming = {
  cue: LivePlaybackCue;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  expired: boolean;
};

export type ResolvedLiveCue = LiveCueTiming & {
  sponsor: Sponsor;
  entry: ResolvedPlaylistEntry;
};

export const DEFAULT_CUE_DURATION_SEC = 30;

export function liveCueTiming(live: LivePlaybackState, atMs = Date.now()): LiveCueTiming | null {
  const cue = live.activeCue;
  if (!cue) return null;
  const durationMs = Math.max(1, cue.durationSec * 1000);
  const elapsedMs = Math.max(0, atMs - cue.startedAtMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  return {
    cue,
    elapsedMs,
    remainingMs,
    progress: Math.min(100, (elapsedMs / durationMs) * 100),
    expired: elapsedMs >= durationMs,
  };
}

export function resolveLiveCue(
  content: LedContentState,
  live: LivePlaybackState,
  atMs = Date.now(),
): ResolvedLiveCue | null {
  const timing = liveCueTiming(live, atMs);
  if (!timing || timing.expired) return null;
  const sponsor = content.sponsors.find((item) => item.id === timing.cue.sponsorId);
  if (!sponsor) return null;
  return {
    ...timing,
    sponsor,
    entry: {
      sponsor,
      durationSec: timing.cue.durationSec,
    },
  };
}

export function cueLabelOptions(): string[] {
  return ["Goal", "Penalty", "VAR", "Blessure", "Sponsor takeover", "Rustmoment"];
}
