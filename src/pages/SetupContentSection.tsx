import { useMemo, useEffect, useState } from "react";
import type { LedContentState, PlaylistEntry, PlaylistSegment, Sponsor } from "@/types";
import { LIVE_SEGMENT_ID } from "@/types";
import {
  applyImportedContent,
  loadContent,
  saveContent,
} from "@/contentStorage";
import { PlaylistRowsEditor } from "@/components/PlaylistRowsEditor";
import { contentKindFromPath, mediaTitleFromPath } from "@/mediaSource";

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

const MAX_LOGO_CHARS = 720_000;

export function SetupContentSection({
  view = "all",
}: {
  view?: "all" | "content" | "playlists" | "backup";
}) {
  const [draft, setDraft] = useState<LedContentState>(() => loadContent());
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const feedUrlConfigured = Boolean(import.meta.env.VITE_ARENACUE_FEED_URL?.trim());

  useEffect(() => {
    saveContent(draft);
  }, [draft]);

  const sortedSegments = useMemo(
    () =>
      [...draft.segments].sort((a, b) => {
        if (a.id === LIVE_SEGMENT_ID) return -1;
        if (b.id === LIVE_SEGMENT_ID) return 1;
        return a.label.localeCompare(b.label, "nl");
      }),
    [draft.segments],
  );

  function setSettings(patch: Partial<LedContentState["settings"]>) {
    setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }

  function patchSegment(id: string, patch: Partial<PlaylistSegment>) {
    setDraft((d) => ({
      ...d,
      segments: d.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function setSegmentPlaylist(id: string, playlist: PlaylistEntry[]) {
    patchSegment(id, { playlist });
  }

  function addSponsor() {
    const s: Sponsor = {
      id: rid("s"),
      label: `Sponsor ${draft.sponsors.length + 1}`,
      bgColor: "#27272a",
      textColor: "#fafafa",
      logoDataUrl: null,
      contentKind: "text",
      mediaSrc: null,
      mediaTitle: null,
      mediaFit: "contain",
    };
    setDraft((d) => ({
      ...d,
      sponsors: [...d.sponsors, s],
      segments: d.segments.map((seg) =>
        seg.id === LIVE_SEGMENT_ID
          ? { ...seg, playlist: [...seg.playlist, { sponsorId: s.id, durationSec: 10 }] }
          : seg,
      ),
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
      segments: d.segments.map((seg) => ({
        ...seg,
        playlist: seg.playlist.filter((p) => p.sponsorId !== id),
      })),
    }));
  }

  function readLogoFile(sponsorId: string, file: File | null) {
    setLogoErr(null);
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (url.length > MAX_LOGO_CHARS) {
        setLogoErr("Logo te groot (max. ~500KB). Gebruik een kleiner PNG/JPEG.");
        return;
      }
      updateSponsor(sponsorId, { logoDataUrl: url });
    };
    reader.readAsDataURL(file);
  }

  function clearLogo(sponsorId: string) {
    updateSponsor(sponsorId, { logoDataUrl: null });
  }

  async function pickLocalMedia(sponsorId: string) {
    const paths = await window.ledboarding?.selectMediaFiles();
    const first = paths?.[0];
    if (!first) return;
    updateSponsor(sponsorId, {
      contentKind: contentKindFromPath(first),
      mediaSrc: first,
      mediaTitle: mediaTitleFromPath(first),
    });
  }

  function readMediaFile(sponsorId: string, file: File | null) {
    setLogoErr(null);
    if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (url.length > 1_500_000) {
        setLogoErr("Media te groot voor browser-opslag. Gebruik de desktop-app en kies het lokale bestand.");
        return;
      }
      updateSponsor(sponsorId, {
        contentKind: file.type.startsWith("video/") ? "video" : "image",
        mediaSrc: url,
        mediaTitle: file.name,
      });
    };
    reader.readAsDataURL(file);
  }

  function clearSponsorMedia(sponsorId: string) {
    updateSponsor(sponsorId, {
      contentKind: "text",
      mediaSrc: null,
      mediaTitle: null,
      mediaFit: "contain",
    });
  }

  function addSegment() {
    const seg: PlaylistSegment = {
      id: rid("seg"),
      label: `Segment ${draft.segments.length + 1}`,
      playlist: [],
      useGlobalSettings: true,
      playbackMode: "scroll",
      scrollLoopDurationSec: 42,
    };
    setDraft((d) => ({ ...d, segments: [...d.segments, seg] }));
  }

  function removeSegment(id: string) {
    if (id === LIVE_SEGMENT_ID) return;
    setDraft((d) => {
      const segments = d.segments.filter((s) => s.id !== id);
      let activeSegmentId = d.activeSegmentId;
      if (activeSegmentId === id) activeSegmentId = LIVE_SEGMENT_ID;
      return { ...d, segments, activeSegmentId };
    });
  }

  function duplicateSegment(sourceId: string) {
    const src = draft.segments.find((s) => s.id === sourceId);
    if (!src) return;
    const copy: PlaylistSegment = {
      ...src,
      id: rid("seg"),
      label: `${src.label} (kopie)`,
      playlist: src.playlist.map((p) => ({ ...p })),
    };
    setDraft((d) => ({ ...d, segments: [...d.segments, copy] }));
  }

  function copyPlaylistFromLive(targetSegmentId: string) {
    if (targetSegmentId === LIVE_SEGMENT_ID) return;
    const live = draft.segments.find((s) => s.id === LIVE_SEGMENT_ID);
    if (!live) return;
    patchSegment(targetSegmentId, {
      playlist: live.playlist.map((p) => ({ ...p })),
    });
  }

  function exportJson() {
    const payload = {
      exportVersion: 2,
      exportedAt: new Date().toISOString(),
      ...draft,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const u = URL.createObjectURL(blob);
    a.href = u;
    a.download = `ledboarding-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(u);
  }

  function importJson(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        applyImportedContent(parsed);
        setDraft(loadContent());
      } catch {
        alert("Ongeldig JSON-bestand.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-10">
      {(view === "all" || view === "backup") && (
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Backup</h2>
          <p className="mt-1 max-w-xl text-xs text-zinc-400">
            Export/import van sponsors, segmenten en playlists als één JSON-bestand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportJson}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Exporteren
          </button>
          <label className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Importeren
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                importJson(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
      )}

      {logoErr && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          {logoErr}
        </p>
      )}

      {(view === "all" || view === "playlists") && (
      <section>
        <h2 className="text-lg font-semibold text-white">Globale weergave</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Standaard voor alle segmenten die “globaal” gebruiken. Per segment kun je dit overschrijven.
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
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 rounded border-border"
            checked={draft.settings.feedFollowSegment === true}
            onChange={(e) => setSettings({ feedFollowSegment: e.target.checked })}
          />
          <span className="text-sm leading-snug text-zinc-300">
            <span className="font-medium text-white">Extern segment volgen (ArenaCue-feed)</span>
            <span className="mt-1 block text-xs text-zinc-500">
              Vereist <code className="rounded bg-zinc-900 px-1">VITE_ARENACUE_FEED_URL</code> bij build.
              De feed moet JSON teruggeven, bv. <code className="rounded bg-zinc-900 px-1">{`{"segmentId":"halftime"}`}</code>.
              {feedUrlConfigured ? (
                <span className="mt-1 block text-emerald-500/90"> Feed-URL is geconfigureerd.</span>
              ) : (
                <span className="mt-1 block text-zinc-600"> Geen feed-URL in deze build.</span>
              )}
            </span>
          </span>
        </label>
      </section>
      )}

      {(view === "all" || view === "content") && (
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
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Logo</span>
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => readLogoFile(s.id, e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {s.logoDataUrl ? (
                        <button
                          type="button"
                          onClick={() => clearLogo(s.id)}
                          className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
                        >
                          Logo verwijderen
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="min-w-[260px] flex-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        LED content
                      </span>
                      <select
                        className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={s.contentKind}
                        onChange={(e) =>
                          updateSponsor(s.id, {
                            contentKind: e.target.value === "video" ? "video" : e.target.value === "image" ? "image" : "text",
                          })
                        }
                      >
                        <option value="text">Tekst/logo</option>
                        <option value="image">Afbeelding</option>
                        <option value="video">Video</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {window.ledboarding ? (
                        <button
                          type="button"
                          onClick={() => void pickLocalMedia(s.id)}
                          className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          Media kiezen…
                        </button>
                      ) : (
                        <label className="cursor-pointer rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800">
                          Media uploaden
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => {
                              readMediaFile(s.id, e.target.files?.[0] ?? null);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                      <select
                        className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={s.mediaFit}
                        onChange={(e) =>
                          updateSponsor(s.id, { mediaFit: e.target.value === "cover" ? "cover" : "contain" })
                        }
                      >
                        <option value="contain">Volledig tonen</option>
                        <option value="cover">Vullen/croppen</option>
                      </select>
                      {s.mediaSrc ? (
                        <button
                          type="button"
                          onClick={() => clearSponsorMedia(s.id)}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
                        >
                          Media wissen
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-[11px] text-zinc-500">
                      {s.mediaSrc
                        ? `${s.contentKind === "video" ? "Video" : "Afbeelding"}: ${s.mediaTitle ?? s.mediaSrc}`
                        : "Geen media gekoppeld; dit item toont tekst/logo."}
                    </p>
                  </div>
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
      )}

      {(view === "all" || view === "playlists") && (
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Segmenten</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Elk segment heeft een eigen playlist. Leeg = fallback naar <strong className="text-zinc-300">Volledige wedstrijd</strong>.
              Het globaal actieve segment kies je op het output-scherm of via de feed; met een <strong className="text-zinc-300">zone-lock</strong> (tab Zones) kan een tweede uitgang een ander segment tonen.
              Sneltoetsen <strong className="text-zinc-300">1–9</strong> schakelen het globaal segment of — bij een zone-lock — dat van die zone.
            </p>
          </div>
          <button
            type="button"
            onClick={addSegment}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Segment toevoegen
          </button>
        </div>

        <ul className="mt-6 space-y-6">
          {sortedSegments.map((seg) => (
            <li
              key={seg.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-inner"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex flex-1 flex-wrap items-end gap-3">
                  <label className="min-w-[200px] flex-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Naam</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                      value={seg.label}
                      onChange={(e) => patchSegment(seg.id, { label: e.target.value })}
                    />
                  </label>
                  <span className="font-mono text-[10px] text-zinc-600">{seg.id}</span>
                </div>
                {seg.id !== LIVE_SEGMENT_ID ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateSegment(seg.id)}
                      className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      Dupliceren
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPlaylistFromLive(seg.id)}
                      className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      Playlist van live
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSegment(seg.id)}
                      className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"
                    >
                      Verwijderen
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateSegment(seg.id)}
                      className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      Dupliceren
                    </button>
                    <span className="text-xs text-zinc-600">Basissegment</span>
                  </div>
                )}
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600"
                  checked={seg.useGlobalSettings}
                  onChange={(e) => patchSegment(seg.id, { useGlobalSettings: e.target.checked })}
                />
                <span className="text-sm text-zinc-300">
                  Gebruik <strong className="text-white">globale</strong> scroll/vast-instellingen
                </span>
              </label>

              {!seg.useGlobalSettings && (
                <div className="mt-3 flex flex-wrap gap-6 border-t border-zinc-800/80 pt-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={seg.playbackMode === "scroll"}
                      onChange={() => patchSegment(seg.id, { playbackMode: "scroll" })}
                      className="h-4 w-4 border-zinc-600 bg-zinc-950 text-emerald-600"
                    />
                    <span className="text-sm">Scroll</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={seg.playbackMode === "hold"}
                      onChange={() => patchSegment(seg.id, { playbackMode: "hold" })}
                      className="h-4 w-4 border-zinc-600 bg-zinc-950 text-emerald-600"
                    />
                    <span className="text-sm">Vast</span>
                  </label>
                  {seg.playbackMode === "scroll" && (
                    <label className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Ronde (sec)</span>
                      <input
                        type="number"
                        min={12}
                        max={240}
                        className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={seg.scrollLoopDurationSec}
                        onChange={(e) =>
                          patchSegment(seg.id, {
                            scrollLoopDurationSec: Number(e.target.value) || 42,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="mt-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Playlist dit segment
                </h3>
                <PlaylistRowsEditor
                  sponsors={draft.sponsors}
                  playlist={seg.playlist}
                  onChange={(pl) => setSegmentPlaylist(seg.id, pl)}
                  disabled={draft.sponsors.length === 0}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}
    </div>
  );
}

function normalizeSponsorPatch(s: Sponsor): Sponsor {
  let logoDataUrl = s.logoDataUrl;
  if (logoDataUrl && (!logoDataUrl.startsWith("data:image/") || logoDataUrl.length > MAX_LOGO_CHARS)) {
    logoDataUrl = null;
  }
  return {
    ...s,
    label: s.label.trim() || "Sponsor",
    bgColor: /^#[0-9a-fA-F]{6}$/.test(s.bgColor ?? "") ? (s.bgColor as string).toLowerCase() : null,
    textColor: /^#[0-9a-fA-F]{6}$/.test(s.textColor ?? "") ? (s.textColor as string).toLowerCase() : null,
    logoDataUrl,
    contentKind: s.mediaSrc ? s.contentKind : "text",
    mediaSrc: s.mediaSrc?.trim() || null,
    mediaTitle: s.mediaTitle?.trim() || null,
    mediaFit: s.mediaFit === "cover" ? "cover" : "contain",
  };
}
