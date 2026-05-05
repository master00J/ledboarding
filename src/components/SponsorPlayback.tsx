import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { LedZone, ResolvedPlaylistEntry } from "@/types";
import { loadContent } from "@/contentStorage";
import { resolvePlaylist } from "@/playlistResolve";

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
  const entries = useMemo(() => resolvePlaylist(content), [content]);

  if (entries.length === 0) {
    return <FallbackCanvas zone={zone} message="Geen playlist — voeg sponsors toe in instellingen." />;
  }

  if (content.settings.playbackMode === "hold") {
    return <HoldCarousel zone={zone} entries={entries} />;
  }

  return (
    <ScrollMarquee
      zone={zone}
      entries={entries}
      loopDurationSec={content.settings.scrollLoopDurationSec}
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

function ScrollMarquee({
  zone,
  entries,
  loopDurationSec,
}: {
  zone: LedZone;
  entries: ResolvedPlaylistEntry[];
  loopDurationSec: number;
}) {
  const fontSize = Math.max(14, Math.round(zone.heightPx * 0.26));
  const gap = Math.round(fontSize * 1.75);
  const dur = Math.max(12, Number.isFinite(loopDurationSec) ? loopDurationSec : 42);

  const half = (suffix: string) =>
    entries.map((e, i) => {
      const { sponsor } = e;
      const bg = sponsor.bgColor ?? "#18181b";
      const fg = sponsor.textColor ?? "#fafafa";
      return (
        <span
          key={`${suffix}-${sponsor.id}-${i}`}
          className="inline-flex shrink-0 items-center rounded-md px-4 py-2 font-semibold tracking-wide"
          style={{ fontSize, backgroundColor: bg, color: fg }}
        >
          {sponsor.label}
        </span>
      );
    });

  return (
    <div
      className="flex h-full w-full items-center overflow-hidden bg-black"
      style={{ paddingInline: Math.round(zone.heightPx * 0.06) }}
    >
      <div className="marquee-led flex w-max shrink-0 items-center" style={{ gap }}>
        <div className="flex shrink-0 items-center" style={{ gap }}>
          {half("a")}
        </div>
        <div className="flex shrink-0 items-center" style={{ gap }}>
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
  const current = entries[safeIdx]!;
  const sponsor = current.sponsor;
  const fontSize = Math.max(18, Math.round(zone.heightPx * 0.34));
  const bg = sponsor.bgColor ?? "#0f172a";
  const fg = sponsor.textColor ?? "#f8fafc";

  return (
    <div
      key={`${sig}-${safeIdx}`}
      className="flex h-full w-full flex-col items-center justify-center px-6 text-center sponsor-hold-pop"
      style={{ backgroundColor: bg, color: fg }}
    >
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
