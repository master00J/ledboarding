import { useEffect, useState } from "react";
import type { LedContentState, PlaylistEntry, Sponsor } from "@/types";
import { loadContent, saveContent } from "@/contentStorage";

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function SetupContentSection() {
  const [draft, setDraft] = useState<LedContentState>(() => loadContent());

  useEffect(() => {
    saveContent(draft);
  }, [draft]);

  function setSettings(patch: Partial<LedContentState["settings"]>) {
    setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }

  function addSponsor() {
    const s: Sponsor = {
      id: rid("s"),
      label: `Sponsor ${draft.sponsors.length + 1}`,
      bgColor: "#27272a",
      textColor: "#fafafa",
    };
    setDraft((d) => ({
      ...d,
      sponsors: [...d.sponsors, s],
      playlist: [...d.playlist, { sponsorId: s.id, durationSec: 10 }],
    }));
  }

  function updateSponsor(id: string, patch: Partial<Sponsor>) {
    setDraft((d) => ({
      ...d,
      sponsors: d.sponsors.map((s) => (s.id === id ? normalizeSponsorPatch({ ...s, ...patch }) : s)),
    }));
  }

  function removeSponsor(id: string) {
    setDraft((d) => ({
      ...d,
      sponsors: d.sponsors.filter((s) => s.id !== id),
      playlist: d.playlist.filter((p) => p.sponsorId !== id),
    }));
  }

  function addPlaylistRow() {
    const first = draft.sponsors[0]?.id;
    if (!first) return;
    setDraft((d) => ({
      ...d,
      playlist: [...d.playlist, { sponsorId: first, durationSec: 10 }],
    }));
  }

  function updatePlaylistRow(idx: number, patch: Partial<PlaylistEntry>) {
    setDraft((d) => ({
      ...d,
      playlist: d.playlist.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  }

  function removePlaylistRow(idx: number) {
    setDraft((d) => ({
      ...d,
      playlist: d.playlist.filter((_, i) => i !== idx),
    }));
  }

  function movePlaylist(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    setDraft((d) => {
      if (j < 0 || j >= d.playlist.length) return d;
      const copy = [...d.playlist];
      const tmp = copy[idx]!;
      copy[idx] = copy[j]!;
      copy[j] = tmp;
      return { ...d, playlist: copy };
    });
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-white">Weergave</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          <strong className="text-zinc-300">Scroll</strong>: doorlopende crawl langs alle playlist-items.
          <strong className="text-zinc-300"> Vast</strong>: elk item fullscreen voor het ingestelde aantal seconden
          (geschikt voor segment-sponsors).
        </p>
        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="playback"
              checked={draft.settings.playbackMode === "scroll"}
              onChange={() => setSettings({ playbackMode: "scroll" })}
              className="h-4 w-4 border-zinc-600 bg-zinc-950 text-emerald-600"
            />
            <span className="text-sm">Scroll (doorlopend)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="playback"
              checked={draft.settings.playbackMode === "hold"}
              onChange={() => setSettings({ playbackMode: "hold" })}
              className="h-4 w-4 border-zinc-600 bg-zinc-950 text-emerald-600"
            />
            <span className="text-sm">Vast per sponsor</span>
          </label>
        </div>
        {draft.settings.playbackMode === "scroll" && (
          <label className="mt-4 block max-w-xs">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Scroll: seconden per volledige ronde
            </span>
            <input
              type="number"
              min={12}
              max={240}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
              value={draft.settings.scrollLoopDurationSec}
              onChange={(e) =>
                setSettings({ scrollLoopDurationSec: Number(e.target.value) || 42 })
              }
            />
          </label>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Sponsors</h2>
          <button
            type="button"
            onClick={addSponsor}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Sponsor toevoegen
          </button>
        </div>
        {draft.sponsors.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nog geen sponsors — voeg er minstens één toe.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {draft.sponsors.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-inner"
              >
                <div className="flex flex-wrap items-end gap-4">
                  <label className="min-w-[200px] flex-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tekst</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                      value={s.label}
                      onChange={(e) => updateSponsor(s.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="w-28">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Achtergrond</span>
                    <input
                      type="color"
                      className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
                      value={s.bgColor ?? "#27272a"}
                      onChange={(e) => updateSponsor(s.id, { bgColor: e.target.value })}
                    />
                  </label>
                  <label className="w-28">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tekstkleur</span>
                    <input
                      type="color"
                      className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
                      value={s.textColor ?? "#fafafa"}
                      onChange={(e) => updateSponsor(s.id, { textColor: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSponsor(s.id)}
                    className="rounded-lg border border-red-900/60 px-3 py-2 text-sm text-red-300 hover:bg-red-950/40"
                  >
                    Verwijderen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Playlist</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Volgorde op de boarding. Bij <strong className="text-zinc-300">vast</strong> bepaalt elke rij hoe lang
              die sponsor getoond wordt (seconden).
            </p>
          </div>
          <button
            type="button"
            disabled={draft.sponsors.length === 0}
            onClick={addPlaylistRow}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Rij toevoegen
          </button>
        </div>

        {draft.playlist.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Playlist is leeg — voeg sponsors toe en minstens één playlist-rij.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {draft.playlist.map((row, idx) => (
              <li
                key={`${row.sponsorId}-${idx}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3"
              >
                <span className="w-8 text-center font-mono text-xs text-zinc-500">{idx + 1}</span>
                <select
                  className="min-w-[180px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={row.sponsorId}
                  onChange={(e) => updatePlaylistRow(idx, { sponsorId: e.target.value })}
                >
                  {draft.sponsors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Sec</span>
                  <input
                    type="number"
                    min={2}
                    max={600}
                    className="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                    value={row.durationSec}
                    onChange={(e) =>
                      updatePlaylistRow(idx, { durationSec: Number(e.target.value) || 10 })
                    }
                  />
                </label>
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    onClick={() => movePlaylist(idx, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    onClick={() => movePlaylist(idx, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                    onClick={() => removePlaylistRow(idx)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function normalizeSponsorPatch(s: Sponsor): Sponsor {
  return {
    ...s,
    label: s.label.trim() || "Sponsor",
    bgColor: /^#[0-9a-fA-F]{6}$/.test(s.bgColor ?? "") ? (s.bgColor as string).toLowerCase() : null,
    textColor: /^#[0-9a-fA-F]{6}$/.test(s.textColor ?? "") ? (s.textColor as string).toLowerCase() : null,
  };
}
