import type { LedContentState, ResolvedPlaylistEntry } from "@/types";

export function resolvePlaylist(content: LedContentState): ResolvedPlaylistEntry[] {
  const map = new Map(content.sponsors.map((s) => [s.id, s]));
  const out: ResolvedPlaylistEntry[] = [];
  for (const row of content.playlist) {
    const sponsor = map.get(row.sponsorId);
    if (!sponsor) continue;
    out.push({ sponsor, durationSec: row.durationSec });
  }
  return out;
}
