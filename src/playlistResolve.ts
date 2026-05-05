import type {
  LedContentState,
  PlaybackMode,
  ResolvedPlaylistEntry,
} from "@/types";
import { LIVE_SEGMENT_ID } from "@/types";

export function resolveActivePlaylist(content: LedContentState): ResolvedPlaylistEntry[] {
  const map = new Map(content.sponsors.map((s) => [s.id, s]));
  const live = content.segments.find((s) => s.id === LIVE_SEGMENT_ID);
  const active =
    content.segments.find((s) => s.id === content.activeSegmentId) ?? live ?? content.segments[0];

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

export function effectivePlayback(content: LedContentState): {
  mode: PlaybackMode;
  scrollLoopDurationSec: number;
} {
  const live = content.segments.find((s) => s.id === LIVE_SEGMENT_ID);
  const seg =
    content.segments.find((s) => s.id === content.activeSegmentId) ?? live ?? content.segments[0];
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
