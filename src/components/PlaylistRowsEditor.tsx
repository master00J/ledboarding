import { useState } from "react";
import type { PlaylistEntry, Sponsor } from "@/types";

export function PlaylistRowsEditor({
  sponsors,
  playlist,
  onChange,
  disabled,
}: {
  sponsors: Sponsor[];
  playlist: PlaylistEntry[];
  onChange: (next: PlaylistEntry[]) => void;
  disabled?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function durationForSponsor(sponsor: Sponsor | undefined): number {
    return sponsor?.contentKind === "video" && sponsor.mediaDurationSec ? sponsor.mediaDurationSec : 10;
  }

  function sponsorForRow(row: PlaylistEntry): Sponsor | undefined {
    return sponsors.find((s) => s.id === row.sponsorId);
  }

  function updateRow(idx: number, patch: Partial<PlaylistEntry>) {
    onChange(playlist.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function removeRow(idx: number) {
    onChange(playlist.filter((_, i) => i !== idx));
  }

  function moveRow(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= playlist.length) return;
    const copy = [...playlist];
    const tmp = copy[idx]!;
    copy[idx] = copy[j]!;
    copy[j] = tmp;
    onChange(copy);
  }

  function moveRowTo(idx: number, targetIdx: number) {
    if (idx === targetIdx || idx < 0 || targetIdx < 0 || idx >= playlist.length || targetIdx >= playlist.length) {
      return;
    }
    const copy = [...playlist];
    const [row] = copy.splice(idx, 1);
    if (!row) return;
    copy.splice(targetIdx, 0, row);
    onChange(copy);
  }

  function addRow() {
    const first = sponsors[0];
    if (!first) return;
    onChange([...playlist, { sponsorId: first.id, durationSec: durationForSponsor(first) }]);
  }

  if (sponsors.length === 0) {
    return <p className="text-sm text-zinc-500">Voeg eerst sponsors toe.</p>;
  }

  return (
    <div className="space-y-3">
      {playlist.length === 0 ? (
        <p className="text-sm text-zinc-500">Nog geen rijen in dit segment.</p>
      ) : (
        <ul className="space-y-2">
          {playlist.map((row, idx) => {
            const sponsor = sponsorForRow(row);
            const videoDurationSec = sponsor?.contentKind === "video" ? sponsor.mediaDurationSec : null;
            const isVideo = typeof videoDurationSec === "number" && videoDurationSec > 0;
            const effectiveDurationSec = isVideo ? videoDurationSec : row.durationSec;
            return (
              <li
              key={`${row.sponsorId}-${idx}`}
              draggable={!disabled}
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => {
                if (!disabled) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) moveRowTo(dragIndex, idx);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                dragIndex === idx
                  ? "border-emerald-500 bg-emerald-950/30"
                  : "border-zinc-800 bg-zinc-950/60"
              } ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
            >
              <span className="w-7 text-center font-mono text-[10px] text-zinc-500">{idx + 1}</span>
              <select
                disabled={disabled}
                className="min-w-[160px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                value={row.sponsorId}
                onChange={(e) => {
                  const nextSponsor = sponsors.find((s) => s.id === e.target.value);
                  updateRow(idx, {
                    sponsorId: e.target.value,
                    durationSec: durationForSponsor(nextSponsor),
                  });
                }}
              >
                {sponsors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Sec</span>
                <input
                  type="number"
                  disabled={disabled || Boolean(isVideo)}
                  min={2}
                  max={7200}
                  className="w-[4.5rem] rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  value={effectiveDurationSec}
                  onChange={(e) =>
                    updateRow(idx, { durationSec: Number(e.target.value) || 10 })
                  }
                />
                {isVideo ? <span className="text-[10px] text-zinc-500">auto video</span> : null}
              </label>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  onClick={() => moveRow(idx, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  onClick={() => moveRow(idx, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded border border-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                  onClick={() => removeRow(idx)}
                >
                  ✕
                </button>
              </div>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        disabled={disabled || sponsors.length === 0}
        onClick={addRow}
        className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Rij toevoegen
      </button>
    </div>
  );
}
