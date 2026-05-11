import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LedCanvas } from "@/components/LedCanvas";
import { SponsorPlayback } from "@/components/SponsorPlayback";
import { loadContent, setActiveSegment } from "@/contentStorage";
import { useArenaCueFeed } from "@/hooks/useArenaCueFeed";
import { LIVE_PLAYBACK_EVENT, loadLivePlayback, restartLivePlayback } from "@/livePlaybackStorage";
import {
  effectiveSegmentId,
  segmentsForShortcuts,
} from "@/playlistResolve";
import { loadZones, patchZoneSegment } from "@/zoneStorage";

const FOLLOW_GLOBAL_VALUE = "__follow_global__";

export function DisplayPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fullError, setFullError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [syncTick, bumpSync] = useReducer((n: number) => n + 1, 0);

  const zone = useMemo(() => loadZones().find((z) => z.id === zoneId), [zoneId, syncTick]);
  const boardContent = useMemo(() => loadContent(), [syncTick]);

  useArenaCueFeed(boardContent.settings.feedFollowSegment === true);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    function onLocal() {
      bumpSync();
    }
    window.addEventListener("ledboarding-update", onLocal);
    window.addEventListener(LIVE_PLAYBACK_EVENT, onLocal);
    return () => {
      window.removeEventListener("ledboarding-update", onLocal);
      window.removeEventListener(LIVE_PLAYBACK_EVENT, onLocal);
    };
  }, []);

  useEffect(() => {
    const observedEl = wrapRef.current;
    if (!observedEl) return;

    function updateSize() {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setViewportSize({
        width: Math.max(0, rect.width),
        height: Math.max(0, rect.height),
      });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(observedEl);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const effectiveSegId = useMemo(
    () => (zone ? effectiveSegmentId(boardContent, zone) : ""),
    [boardContent, zone],
  );

  const effectiveSegLabel = useMemo(() => {
    const s = boardContent.segments.find((x) => x.id === effectiveSegId);
    return s?.label ?? effectiveSegId;
  }, [boardContent.segments, effectiveSegId]);
  const live = useMemo(() => loadLivePlayback(), [syncTick]);

  const shortcutLegend = useMemo(() => {
    return segmentsForShortcuts(boardContent)
      .slice(0, 9)
      .map((s, i) => `${i + 1}=${s.label}`)
      .join(" · ");
  }, [boardContent]);

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
    if (!zone) return;
    const z = zone;

    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;

      const digit = /^Digit(\d)$/.exec(e.code);
      if (digit) {
        const n = Number(digit[1]);
        if (n >= 1 && n <= 9) {
          const list = segmentsForShortcuts(boardContent);
          const seg = list[n - 1];
          if (seg) {
            e.preventDefault();
            if (z.segmentId?.trim()) {
              patchZoneSegment(z.id, seg.id);
            } else {
              setActiveSegment(seg.id);
            }
            restartLivePlayback(0);
            bumpSync();
            return;
          }
        }
      }

      if (e.key === "f" || e.key === "F") void goFullscreen();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goFullscreen, boardContent, zone, bumpSync]);

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

  const zoneSegmentLocked = !!zone.segmentId?.trim();
  const lockedValid =
    zoneSegmentLocked &&
    boardContent.segments.some((s) => s.id === zone.segmentId!.trim());

  const segmentSelectValue = zoneSegmentLocked
    ? lockedValid
      ? zone.segmentId!.trim()
      : boardContent.activeSegmentId
    : boardContent.activeSegmentId;
  const showOutputControls = !window.ledboarding;
  const outputScale =
    viewportSize.width > 0 && viewportSize.height > 0
      ? Math.max(
          0.01,
          Math.min(viewportSize.width / zone.widthPx, viewportSize.height / zone.heightPx),
        )
      : 1;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white">
      <div
        ref={wrapRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
      >
        <div style={{ width: zone.widthPx * outputScale, height: zone.heightPx * outputScale }}>
          <div
            style={{
              width: zone.widthPx,
              height: zone.heightPx,
              filter: `brightness(${Math.max(1, Math.min(100, boardContent.settings.brightnessPercent))}%)`,
              transform: `scale(${outputScale})`,
              transformOrigin: "top left",
            }}
          >
            <LedCanvas widthPx={zone.widthPx} heightPx={zone.heightPx}>
              {zone.regions && zone.regions.length > 0 ? (
                <div className="relative h-full w-full bg-black">
                  {zone.regions.map((region) => (
                    <div
                      key={region.id}
                      className="absolute overflow-hidden bg-black ring-1 ring-white/10"
                      style={{
                        left: region.xPx,
                        top: region.yPx,
                        width: region.widthPx,
                        height: region.heightPx,
                      }}
                      title={`${region.name} · ${region.widthPx}×${region.heightPx}`}
                    >
                      <SponsorPlayback
                        zone={{
                          id: `${zone.id}:${region.id}`,
                          name: region.name,
                          widthPx: region.widthPx,
                          heightPx: region.heightPx,
                          segmentId: region.segmentId ?? zone.segmentId ?? null,
                          regions: [],
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <SponsorPlayback zone={zone} />
              )}
            </LedCanvas>
          </div>
        </div>
      </div>

      {showOutputControls && (
      <footer className="shrink-0 border-t border-zinc-900 bg-zinc-950 px-4 py-3 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <strong className="text-zinc-300">{zone.name}</strong> — {zone.widthPx}×{zone.heightPx}px
              <span className="ml-2 text-zinc-600">
                · nu: <strong className="text-zinc-400">{effectiveSegLabel}</strong>
                {zoneSegmentLocked ? (
                  lockedValid ? (
                    <span className="text-amber-600/90"> (vast op zone)</span>
                  ) : (
                    <span className="text-red-500/85"> (onbekend segment-id)</span>
                  )
                ) : null}
                <span className="ml-2 text-zinc-600">
                  · live:{" "}
                  <strong className={live.status === "playing" ? "text-emerald-500" : "text-amber-500"}>
                    {live.overrideMode === "blackout"
                      ? "blackout"
                      : live.overrideMode === "testPattern"
                        ? "testbeeld"
                        : live.status}
                  </strong>
                </span>
              </span>
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
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-900/80 pt-2">
            <label className="flex flex-wrap items-center gap-2 text-zinc-400">
              <span className="shrink-0">{zoneSegmentLocked ? "Zone-segment" : "Globaal segment"}</span>
              <select
                className="max-w-[14rem] rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-600/50 sm:max-w-md"
                value={zoneSegmentLocked ? segmentSelectValue : boardContent.activeSegmentId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === FOLLOW_GLOBAL_VALUE) {
                    patchZoneSegment(zone.id, null);
                  } else if (zoneSegmentLocked) {
                    patchZoneSegment(zone.id, v);
                  } else {
                    setActiveSegment(v);
                  }
                  restartLivePlayback(0);
                  bumpSync();
                }}
              >
                {zoneSegmentLocked ? (
                  <option value={FOLLOW_GLOBAL_VALUE}>Volg globaal segment…</option>
                ) : null}
                {boardContent.segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {shortcutLegend ? (
              <span className="text-[10px] leading-snug text-zinc-600 sm:text-[11px]">
                Sneltoetsen 1–9: {shortcutLegend}
                {zoneSegmentLocked ? (
                  <span className="ml-1 text-amber-700/90">(wijzigen zone-segment)</span>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>
        {fullError && <p className="mx-auto mt-2 max-w-4xl text-red-400">{fullError}</p>}
      </footer>
      )}
    </div>
  );
}
