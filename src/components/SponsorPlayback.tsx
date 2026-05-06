import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { LedZone, ResolvedPlaylistEntry, Sponsor } from "@/types";
import { loadContent } from "@/contentStorage";
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
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ledboarding-update", onLocal);
    };
  }, []);

  const content = useMemo(() => loadContent(), [tick]);
  const entries = useMemo(() => resolveActivePlaylist(content, zone), [content, zone]);
  const playback = useMemo(() => effectivePlayback(content, zone), [content, zone]);

  if (entries.length === 0) {
    return <FallbackCanvas zone={zone} message="Geen playlist — voeg sponsors toe in instellingen." />;
  }

  if (playback.mode === "hold") {
    return <HoldCarousel zone={zone} entries={entries} />;
  }

  return (
    <ScrollMarquee
      zone={zone}
      entries={entries}
      loopDurationSec={playback.scrollLoopDurationSec}
    />
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

/** Eén slide in de scroll-marquee: volledige zone (breedte × hoogte) per sponsor — beeld/video vullen de lint zoals bij hold. */
function SponsorScrollSlide({ sponsor, zone }: { sponsor: Sponsor; zone: LedZone }) {
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
        <img
          src={mediaSrc}
          alt=""
          className="h-full w-full"
          style={{ objectFit }}
          draggable={false}
        />
        <SponsorOverlayLabel sponsor={sponsor} />
      </div>
    );
  }

  if (sponsor.contentKind === "video" && mediaSrc) {
    return (
      <div className="relative shrink-0 overflow-hidden bg-black" style={{ width: w, height: h }}>
        <video
          src={mediaSrc}
          className="h-full w-full"
          style={{ objectFit }}
          muted
          autoPlay
          loop
          playsInline
        />
        <SponsorOverlayLabel sponsor={sponsor} />
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
}: {
  zone: LedZone;
  entries: ResolvedPlaylistEntry[];
  loopDurationSec: number;
}) {
  const gap = Math.max(4, Math.round(zone.heightPx * 0.04));
  const dur = Math.max(12, Number.isFinite(loopDurationSec) ? loopDurationSec : 42);

  const half = (suffix: string) =>
    entries.map((e, i) => (
      <SponsorScrollSlide
        key={`${suffix}-${e.sponsor.id}-${i}`}
        sponsor={e.sponsor}
        zone={zone}
      />
    ));

  return (
    <div className="flex h-full w-full items-stretch overflow-hidden bg-black">
      <div className="marquee-led flex h-full w-max shrink-0 items-stretch" style={{ gap }}>
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

function HoldCarousel({ zone, entries }: { zone: LedZone; entries: ResolvedPlaylistEntry[] }) {
  const sig = entries.map((e) => `${e.sponsor.id}:${e.durationSec}`).join("|");
  const [index, setIndex] = useState(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    setIndex(0);
  }, [sig]);

  useEffect(() => {
    const list = entriesRef.current;
    if (list.length === 0) return;

    let i = 0;
    let cancelled = false;
    let tid: ReturnType<typeof setTimeout>;

    function arm() {
      const cur = entriesRef.current;
      const ms = Math.max(2000, (cur[i]?.durationSec ?? 8) * 1000);
      tid = setTimeout(() => {
        if (cancelled) return;
        i = (i + 1) % cur.length;
        setIndex(i);
        arm();
      }, ms);
    }

    arm();
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [sig]);

  const safeIdx = index % entries.length;
  const sponsor = entries[safeIdx]!.sponsor;
  const fontSize = Math.max(18, Math.round(zone.heightPx * 0.34));
  const logoMax = Math.round(zone.heightPx * 0.42);
  const bg = sponsor.bgColor ?? "#0f172a";
  const fg = sponsor.textColor ?? "#f8fafc";
  const mediaSrc = mediaSourceUrl(sponsor.mediaSrc);
  const objectFit = sponsor.mediaFit === "cover" ? "cover" : "contain";

  if (sponsor.contentKind === "image" && mediaSrc) {
    return (
      <div key={`${sig}-${safeIdx}`} className="relative h-full w-full bg-black sponsor-hold-pop">
        <img
          src={mediaSrc}
          alt=""
          className="h-full w-full"
          style={{ objectFit }}
          draggable={false}
        />
        <SponsorOverlayLabel sponsor={sponsor} />
      </div>
    );
  }

  if (sponsor.contentKind === "video" && mediaSrc) {
    return (
      <div key={`${sig}-${safeIdx}`} className="relative h-full w-full bg-black sponsor-hold-pop">
        <video
          src={mediaSrc}
          className="h-full w-full"
          style={{ objectFit }}
          muted
          autoPlay
          loop
          playsInline
        />
        <SponsorOverlayLabel sponsor={sponsor} />
      </div>
    );
  }

  return (
    <div
      key={`${sig}-${safeIdx}`}
      className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center sponsor-hold-pop"
      style={{ backgroundColor: bg, color: fg }}
    >
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
      <style>{`
        @keyframes sponsor-hold-pop {
          from { opacity: 0; transform: scale(0.985); }
          to { opacity: 1; transform: scale(1); }
        }
        .sponsor-hold-pop {
          animation: sponsor-hold-pop 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

function SponsorOverlayLabel({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-2">
      <div className="truncate text-center text-sm font-semibold uppercase tracking-wide text-white/90">
        {sponsor.label}
      </div>
    </div>
  );
}
