import { useEffect } from "react";
import { loadContent, setActiveSegment } from "@/contentStorage";

/**
 * Pollt optioneel een JSON-feed (`VITE_ARENACUE_FEED_URL`) met `{ "segmentId": "<id>" }`
 * en schakelt het actieve LED-segment bij (alleen als ids bestaan).
 */
export function useArenaCueFeed(enabled: boolean, pollMs = 5000): void {
  const url = import.meta.env.VITE_ARENACUE_FEED_URL?.trim();

  useEffect(() => {
    if (!enabled || !url) return;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { segmentId?: string };
        const id = typeof data.segmentId === "string" ? data.segmentId.trim() : "";
        if (!id) return;
        const c = loadContent();
        if (c.segments.some((s) => s.id === id)) setActiveSegment(id);
      } catch {
        /* netwerk/fetch-fouten negeren */
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, url, pollMs]);
}
