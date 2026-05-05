import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LedCanvas } from "@/components/LedCanvas";
import { SponsorPlayback } from "@/components/SponsorPlayback";
import { loadZones } from "@/zoneStorage";

export function DisplayPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fullError, setFullError] = useState<string | null>(null);
  const [geoTick, bumpGeo] = useReducer((n: number) => n + 1, 0);

  const zone = useMemo(() => loadZones().find((z) => z.id === zoneId), [zoneId, geoTick]);

  useEffect(() => {
    function onLocal() {
      bumpGeo();
    }
    window.addEventListener("ledboarding-update", onLocal);
    return () => window.removeEventListener("ledboarding-update", onLocal);
  }, []);

  const goFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    setFullError(null);
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setFullError("Fullscreen niet beschikbaar. Probeer F11 of browsermachtigingen.");
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") void goFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goFullscreen]);

  if (!zone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-zinc-400">Zone niet gevonden.</p>
        <Link to="/" className="text-emerald-400 underline hover:text-emerald-300">
          Terug naar instellingen
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div
        ref={wrapRef}
        className="flex min-h-0 flex-1 items-center justify-center bg-black"
      >
        <LedCanvas widthPx={zone.widthPx} heightPx={zone.heightPx}>
          <SponsorPlayback zone={zone} />
        </LedCanvas>
      </div>

      <footer className="shrink-0 border-t border-zinc-900 bg-zinc-950 px-4 py-3 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-zinc-300">{zone.name}</strong> — {zone.widthPx}×{zone.heightPx}px
          </span>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void goFullscreen()}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
            >
              Fullscreen (F)
            </button>
            <Link to="/" className="rounded-md px-3 py-1.5 text-emerald-400 hover:text-emerald-300">
              Instellingen
            </Link>
          </div>
        </div>
        {fullError && <p className="mx-auto mt-2 max-w-4xl text-red-400">{fullError}</p>}
      </footer>
    </div>
  );
}
