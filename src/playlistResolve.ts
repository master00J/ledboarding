import type { LedContentState, LedZone, PlaybackMode, PlaylistSegment, ResolvedPlaylistEntry } from "@/types";
import { LIVE_SEGMENT_ID } from "@/types";

function pickSegment(content: LedContentState, segmentId: string): PlaylistSegment | undefined {
  return (
    content.segments.find((s) => s.id === segmentId) ??
    content.segments.find((s) => s.id === LIVE_SEGMENT_ID) ??
    content.segments[0]
  );
}

/** Welk segment-id daadwerkelijk voor deze zone geldt (zone-lock of globaal actief). */
export function effectiveSegmentId(content: LedContentState, zone?: LedZone | null): string {
  const locked = zone?.segmentId?.trim();
  if (locked && content.segments.some((s) => s.id === locked)) return locked;
  if (content.segments.some((s) => s.id === content.activeSegmentId)) return content.activeSegmentId;
  return LIVE_SEGMENT_ID;
}

/** Volgorde voor sneltoetsen 1–9: `live` eerst, daarna alfabetisch op label. */
export function segmentsForShortcuts(content: LedContentState): PlaylistSegment[] {
  const live = content.segments.find((s) => s.id === LIVE_SEGMENT_ID);
  const rest = [...content.segments]
    .filter((s) => s.id !== LIVE_SEGMENT_ID)
    .sort((a, b) => a.label.localeCompare(b.label, "nl"));
  return live ? [live, ...rest] : rest;
}

export function resolveActivePlaylist(
  content: LedContentState,
  zone?: LedZone | null,
): ResolvedPlaylistEntry[] {
  const map = new Map(content.sponsors.map((s) => [s.id, s]));
  const sid = effectiveSegmentId(content, zone);
  const live = content.segments.find((s) => s.id === LIVE_SEGMENT_ID);
  const active = pickSegment(content, sid);

  let rows = active?.playlist.filter((p) => map.has(p.sponsorId)) ?? [];
  if (rows.length === 0 && active?.id !== LIVE_SEGMENT_ID && live) {
    rows = live.playlist.filter((p) => map.has(p.sponsorId));
  }

  const out: ResolvedPlaylistEntry[] = [];
  for (const row of rows) {
    const sponsor = map.get(row.sponsorId);
    if (!sponsor) continue;
    out.push({ sponsor, durationSec: row.durationSec });
  }
  return out;
}

export function effectivePlayback(content: LedContentState, zone?: LedZone | null): {
  mode: PlaybackMode;
  scrollLoopDurationSec: number;
} {
  const sid = effectiveSegmentId(content, zone);
  const seg = pickSegment(content, sid);
  if (!seg || seg.useGlobalSettings) {
    return {
      mode: content.settings.playbackMode,
      scrollLoopDurationSec: content.settings.scrollLoopDurationSec,
    };
  }
  return {
    mode: seg.playbackMode,
    scrollLoopDurationSec: seg.scrollLoopDurationSec,
  };
}
