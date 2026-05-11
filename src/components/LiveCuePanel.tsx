import { useEffect, useMemo, useState } from "react";
import { clearLiveCue, startLiveCue } from "@/livePlaybackStorage";
import { cueLabelOptions, DEFAULT_CUE_DURATION_SEC, resolveLiveCue } from "@/liveCueResolve";
import type { LedContentState, LivePlaybackState } from "@/types";

export function LiveCuePanel({
  content,
  live,
  nowMs,
  compact = false,
  onChange,
}: {
  content: LedContentState;
  live: LivePlaybackState;
  nowMs: number;
  compact?: boolean;
  onChange?: () => void;
}) {
  const sponsors = content.sponsors;
  const [sponsorId, setSponsorId] = useState(() => sponsors[0]?.id ?? "");
  const [label, setLabel] = useState("Goal");
  const [durationSec, setDurationSec] = useState(DEFAULT_CUE_DURATION_SEC);
  const cue = useMemo(() => resolveLiveCue(content, live, nowMs), [content, live, nowMs]);

  useEffect(() => {
    if (!sponsorId || !sponsors.some((sponsor) => sponsor.id === sponsorId)) {
      setSponsorId(sponsors[0]?.id ?? "");
    }
  }, [sponsorId, sponsors]);

  function startCue(nextLabel = label, nextDurationSec = durationSec) {
    if (!sponsorId) return;
    startLiveCue({
      label: nextLabel,
      sponsorId,
      durationSec: nextDurationSec,
      returnToSegmentId: content.activeSegmentId,
    });
    onChange?.();
  }

  function stopCue() {
    clearLiveCue();
    onChange?.();
  }

  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
            Wedstrijdmomenten
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-white">
            {cue ? `${cue.cue.label}: ${cue.sponsor.label}` : "Tijdelijke cue starten"}
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
            Toon een sponsor of media-item tijdelijk over alle outputs. Na de countdown keert de boarding automatisch terug naar de normale playlist.
          </p>
        </div>
        {cue ? (
          <button
            type="button"
            onClick={stopCue}
            className="rounded-lg border border-amber-700 px-3 py-2 text-xs font-black uppercase text-amber-200 hover:bg-amber-950/40"
          >
            Stop cue
          </button>
        ) : null}
      </div>

      {cue ? (
        <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-emerald-100">
              Nu live: {cue.sponsor.label}
            </span>
            <span className="shrink-0 font-mono text-lg font-black text-white">
              {formatClock(cue.remainingMs)}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-emerald-500" style={{ width: `${cue.progress}%` }} />
          </div>
        </div>
      ) : null}

      <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-[1fr_10rem]"}`}>
        <label className="min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Sponsor/media</span>
          <select
            value={sponsorId}
            onChange={(e) => setSponsorId(e.target.value)}
            disabled={sponsors.length === 0}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
          >
            {sponsors.length === 0 ? <option value="">Geen sponsors</option> : null}
            {sponsors.map((sponsor) => (
              <option key={sponsor.id} value={sponsor.id}>
                {sponsor.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Duur sec</span>
          <input
            type="number"
            min={3}
            max={600}
            value={durationSec}
            onChange={(e) => setDurationSec(Math.min(600, Math.max(3, Math.round(Number(e.target.value) || DEFAULT_CUE_DURATION_SEC))))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cueLabelOptions().map((option) => (
          <button
            key={option}
            type="button"
            disabled={!sponsorId}
            onClick={() => {
              setLabel(option);
              startCue(option, durationSec);
            }}
            className="min-w-0 rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-xs font-bold text-zinc-200 hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[15, 30, 60].map((seconds) => (
          <button
            key={seconds}
            type="button"
            disabled={!sponsorId}
            onClick={() => startCue(label, seconds)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black uppercase text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {seconds}s live
          </button>
        ))}
      </div>

      {sponsors.length === 0 ? (
        <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Voeg eerst content toe. Elk sponsor- of media-item kan daarna als wedstrijdmoment worden gebruikt.
        </p>
      ) : null}
    </div>
  );
}

function formatClock(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
