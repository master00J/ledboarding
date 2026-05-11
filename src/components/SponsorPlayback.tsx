import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { LedZone, ResolvedPlaylistEntry, Sponsor } from "@/types";
import { loadContent } from "@/contentStorage";
import {
  LIVE_PLAYBACK_EVENT,
  loadLivePlayback,
  updateLivePlayback,
} from "@/livePlaybackStorage";
import { resolveLiveCue } from "@/liveCueResolve";
import { mediaSourceUrl } from "@/mediaSource";
import { effectivePlayback, resolveActivePlaylist } from "@/playlistResolve";

export function SponsorPlayback({ zone }: { zone: LedZone }) {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key?.startsWith("ledboarding.")) bump();
    }
    function onLocal() {
      bump();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("ledboarding-update", onLocal);
    window.addEventListener(LIVE_PLAYBACK_EVENT, onLocal);
    const unsubscribeStateChanged = window.ledboarding?.onStateChanged(onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ledboarding-update", onLocal);
      window.removeEventListener(LIVE_PLAYBACK_EVENT, onLocal);
      unsubscribeStateChanged?.();
    };
  }, []);

  const content = useMemo(() => loadContent(), [tick]);
  const live = useMemo(() => loadLivePlayback(), [tick]);
  const entries = useMemo(() => resolveActivePlaylist(content, zone), [content, zone]);
  const playback = useMemo(() => effectivePlayback(content, zone), [content, zone]);
  const activeCue = useMemo(() => resolveLiveCue(content, live), [content, live]);
  const fadeTransitionMs = content.settings.fadeTransitionMs;
  const containsVideo = entries.some((entry) => entry.sponsor.contentKind === "video" && entry.sponsor.mediaSrc);

  if (live.overrideMode === "blackout") {
    return <BlackoutCanvas />;
  }

  if (live.overrideMode === "testPattern") {
    return <TestPatternCanvas zone={zone} />;
  }

  if (activeCue) {
    return (
      <SponsorFullFrame
        zone={zone}
        sponsor={activeCue.sponsor}
        fadeTransitionMs={fadeTransitionMs}
        animationKey={activeCue.cue.id}
        paused={live.status === "paused"}
      />
    );
  }

  if (entries.length === 0) {
    return <FallbackCanvas zone={zone} message="Geen playlist — voeg sponsors toe in instellingen." />;
  }

  if (playback.mode === "hold" || containsVideo) {
    return <HoldCarousel zone={zone} entries={entries} live={live} fadeTransitionMs={fadeTransitionMs} />;
  }

  return (
    <ScrollMarquee
      zone={zone}
      entries={entries}
      loopDurationSec={playback.scrollLoopDurationSec}
      paused={live.status === "paused"}
    />
  );
}

function SponsorFullFrame({
  zone,
  sponsor,
  fadeTransitionMs,
  animationKey,
  paused,
}: {
  zone: LedZone;
  sponsor: Sponsor;
  fadeTransitionMs: number;
  animationKey: string;
  paused: boolean;
}) {
  const fontSize = Math.max(18, Math.round(zone.heightPx * 0.34));
  const logoMax = Math.round(zone.heightPx * 0.42);
  const bg = sponsor.bgColor ?? "#0f172a";
  const fg = sponsor.textColor ?? "#f8fafc";
  const mediaSrc = mediaSourceUrl(sponsor.mediaSrc);
  const objectFit = sponsor.mediaFit === "cover" ? "cover" : "contain";
  const animationStyle =
    fadeTransitionMs > 0 ? { animation: `sponsor-hold-fade ${fadeTransitionMs}ms ease-out` } : undefined;

  if (sponsor.contentKind === "image" && mediaSrc) {
    return (
      <div key={animationKey} className="relative h-full w-full bg-black" style={animationStyle}>
        <HoldFadeStyle />
        <MediaFrame src={mediaSrc} kind="image" objectFit={objectFit} />
      </div>
    );
  }

  if (sponsor.contentKind === "video" && mediaSrc) {
    return (
      <div key={animationKey} className="relative h-full w-full bg-black" style={animationStyle}>
        <HoldFadeStyle />
        <MediaFrame src={mediaSrc} kind="video" objectFit={objectFit} loop paused={paused} />
      </div>
    );
  }

  return (
    <div
      key={animationKey}
      className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ backgroundColor: bg, color: fg, ...animationStyle }}
    >
      <HoldFadeStyle />
      {sponsor.logoDataUrl ? (
        <img
          src={sponsor.logoDataUrl}
          alt=""
          className="object-contain"
          style={{ maxHeight: logoMax, maxWidth: Math.min(zone.widthPx * 0.85, logoMax * 3) }}
          draggable={false}
        />
      ) : null}
      <div
        className="line-clamp-2 max-w-full px-4 font-black uppercase leading-tight tracking-wide"
        style={{ fontSize }}
      >
        {sponsor.label}
      </div>
    </div>
  );
}

function BlackoutCanvas() {
  return <div className="h-full w-full bg-black" />;
}

function TestPatternCanvas({ zone }: { zone: LedZone }) {
  const fontSize = Math.max(12, Math.round(zone.heightPx * 0.1));
  return (
    <div
      className="relative grid h-full w-full grid-cols-8 overflow-hidden bg-black text-white"
      style={{ fontSize }}
    >
      {["#ffffff", "#facc15", "#06b6d4", "#22c55e", "#ec4899", "#ef4444", "#2563eb", "#000000"].map(
        (color) => (
          <div key={color} style={{ backgroundColor: color }} />
        ),
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-center font-black uppercase tracking-[0.25em] drop-shadow">
        Testbeeld · {zone.widthPx}×{zone.heightPx}
      </div>
    </div>
  );
}

function FallbackCanvas({ zone, message }: { zone: LedZone; message: string }) {
  const fontSize = Math.max(16, Math.round(zone.heightPx * 0.12));
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-zinc-900 px-6 text-center font-medium text-white/85"
      style={{ fontSize }}
    >
      {message}
    </div>
  );
}

function MediaFrame({
  src,
  kind,
  objectFit,
  loop,
  paused = false,
}: {
  src: string;
  kind: "image" | "video";
  objectFit: "contain" | "cover";
  loop?: boolean;
  paused?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      /* Autoplay can fail briefly while Chromium initializes the file source. */
    });
  }, [paused, src]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black px-4 text-center text-white/75">
        Media kan niet geladen worden. Controleer of het bestand nog bestaat en afspeelbaar is.
      </div>
    );
  }

  if (kind === "video") {
    return (
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full"
        style={{ objectFit }}
        muted
        autoPlay
        loop={loop}
        playsInline
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="h-full w-full"
      style={{ objectFit }}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/** Eén slide in de scroll-marquee: volledige zone (breedte × hoogte) per sponsor — beeld/video vullen de lint zoals bij hold. */
function SponsorScrollSlide({ sponsor, zone, paused }: { sponsor: Sponsor; zone: LedZone; paused: boolean }) {
  const w = zone.widthPx;
  const h = zone.heightPx;
  const mediaSrc = mediaSourceUrl(sponsor.mediaSrc);
  const objectFit = sponsor.mediaFit === "cover" ? "cover" : "contain";
  const bg = sponsor.bgColor ?? "#0f172a";
  const fg = sponsor.textColor ?? "#f8fafc";
  const fontSize = Math.max(16, Math.round(h * 0.22));
  const logoMax = Math.round(h * 0.38);

  if (sponsor.contentKind === "image" && mediaSrc) {
    return (
      <div className="relative shrink-0 overflow-hidden bg-black" style={{ width: w, height: h }}>
        <MediaFrame src={mediaSrc} kind="image" objectFit={objectFit} />
      </div>
    );
  }

  if (sponsor.contentKind === "video" && mediaSrc) {
    return (
      <div className="relative shrink-0 overflow-hidden bg-black" style={{ width: w, height: h }}>
        <MediaFrame src={mediaSrc} kind="video" objectFit={objectFit} loop paused={paused} />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-2 overflow-hidden px-4 text-center"
      style={{ width: w, height: h, backgroundColor: bg, color: fg }}
    >
      {sponsor.logoDataUrl ? (
        <img
          src={sponsor.logoDataUrl}
          alt=""
          className="object-contain"
          style={{
            maxHeight: logoMax,
            maxWidth: Math.min(w * 0.88, logoMax * 4),
          }}
          draggable={false}
        />
      ) : null}
      <div
        className="line-clamp-2 max-w-full px-2 font-bold uppercase leading-tight tracking-wide"
        style={{ fontSize }}
      >
        {sponsor.label}
      </div>
    </div>
  );
}

function ScrollMarquee({
  zone,
  entries,
  loopDurationSec,
  paused,
}: {
  zone: LedZone;
  entries: ResolvedPlaylistEntry[];
  loopDurationSec: number;
  paused: boolean;
}) {
  const gap = Math.max(4, Math.round(zone.heightPx * 0.04));
  const dur = Math.max(12, Number.isFinite(loopDurationSec) ? loopDurationSec : 42);

  const half = (suffix: string) =>
    entries.map((e, i) => (
      <SponsorScrollSlide
        key={`${suffix}-${e.sponsor.id}-${i}`}
        sponsor={e.sponsor}
        zone={zone}
        paused={paused}
      />
    ));

  return (
    <div className="flex h-full w-full items-stretch overflow-hidden bg-black">
      <div
        className="marquee-led flex h-full w-max shrink-0 items-stretch"
        style={{ gap, animationPlayState: paused ? "paused" : "running" }}
      >
        <div className="flex h-full shrink-0 items-stretch" style={{ gap }}>
          {half("a")}
        </div>
        <div className="flex h-full shrink-0 items-stretch" style={{ gap }}>
          {half("b")}
        </div>
      </div>
      <style>{`
        @keyframes marquee-led-x {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-led {
          animation: marquee-led-x ${dur}s linear infinite;
        }
      `}</style>
    </div>
  );
}

function HoldCarousel({
  zone,
  entries,
  live,
  fadeTransitionMs,
}: {
  zone: LedZone;
  entries: ResolvedPlaylistEntry[];
  live: ReturnType<typeof loadLivePlayback>;
  fadeTransitionMs: number;
}) {
  const sig = entries.map((e) => `${e.sponsor.id}:${e.durationSec}`).join("|");

  useEffect(() => {
    updateLivePlayback((state) => ({
      ...state,
      itemIndex: Math.min(state.itemIndex, Math.max(0, entries.length - 1)),
      updatedAtMs: Date.now(),
    }));
  }, [sig]);

  const safeIdx = live.itemIndex % entries.length;
  const sponsor = entries[safeIdx]!.sponsor;
  const fontSize = Math.max(18, Math.round(zone.heightPx * 0.34));
  const logoMax = Math.round(zone.heightPx * 0.42);
  const bg = sponsor.bgColor ?? "#0f172a";
  const fg = sponsor.textColor ?? "#f8fafc";
  const mediaSrc = mediaSourceUrl(sponsor.mediaSrc);
  const objectFit = sponsor.mediaFit === "cover" ? "cover" : "contain";
  const animationStyle = fadeTransitionMs > 0
    ? { animation: `sponsor-hold-fade ${fadeTransitionMs}ms ease-out` }
    : undefined;

  if (sponsor.contentKind === "image" && mediaSrc) {
    return (
      <div
        key={`${sig}-${safeIdx}-${live.itemStartedAtMs}`}
        className="relative h-full w-full bg-black"
        style={animationStyle}
      >
        <HoldFadeStyle />
        <MediaFrame src={mediaSrc} kind="image" objectFit={objectFit} />
      </div>
    );
  }

  if (sponsor.contentKind === "video" && mediaSrc) {
    return (
      <div
        key={`${sig}-${safeIdx}-${live.itemStartedAtMs}`}
        className="relative h-full w-full bg-black"
        style={animationStyle}
      >
        <HoldFadeStyle />
        <MediaFrame src={mediaSrc} kind="video" objectFit={objectFit} loop paused={live.status === "paused"} />
      </div>
    );
  }

  return (
    <div
      key={`${sig}-${safeIdx}-${live.itemStartedAtMs}`}
      className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ backgroundColor: bg, color: fg, ...animationStyle }}
    >
      <HoldFadeStyle />
      {sponsor.logoDataUrl ? (
        <img
          src={sponsor.logoDataUrl}
          alt=""
          className="object-contain"
          style={{ maxHeight: logoMax, maxWidth: Math.min(zone.widthPx * 0.85, logoMax * 3) }}
          draggable={false}
        />
      ) : null}
      <div className="font-black uppercase leading-tight tracking-tight" style={{ fontSize }}>
        {sponsor.label}
      </div>
    </div>
  );
}

function HoldFadeStyle() {
  return (
    <style>{`
      @keyframes sponsor-hold-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `}</style>
  );
}

