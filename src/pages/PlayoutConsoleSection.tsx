import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import { loadContent, saveContent, setActiveSegment } from "@/contentStorage";
import {
  LIVE_PLAYBACK_EVENT,
  loadLivePlayback,
  pauseLivePlayback,
  playLivePlayback,
  restartLivePlayback,
  setLinkedZoneIds,
  setLiveOverrideMode,
  updateLivePlayback,
} from "@/livePlaybackStorage";
import {
  effectivePlayback,
  effectiveSegmentId,
  resolveActivePlaylist,
  segmentsForShortcuts,
} from "@/playlistResolve";
import {
  SPONSOR_BUDGET_LEDGER_EVENT,
  addSponsorPlayedSeconds,
  loadSponsorBudgetLedger,
  resetSponsorBudgetLedger,
} from "@/sponsorBudgetLedger";
import type { LedZone, LivePlaybackState, ResolvedPlaylistEntry } from "@/types";
import { loadZones } from "@/zoneStorage";

export function PlayoutConsoleSection() {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const [clock, setClock] = useState(() => Date.now());
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [secondaryZoneId, setSecondaryZoneId] = useState<string>("");
  const [openOutputs, setOpenOutputs] = useState<string[]>([]);
  const [displays, setDisplays] = useState<LedDisplayInfoForWindow[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onChange() {
      bump();
    }
    window.addEventListener("ledboarding-update", onChange);
    window.addEventListener(LIVE_PLAYBACK_EVENT, onChange);
    window.addEventListener(SPONSOR_BUDGET_LEDGER_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("ledboarding-update", onChange);
      window.removeEventListener(LIVE_PLAYBACK_EVENT, onChange);
      window.removeEventListener(SPONSOR_BUDGET_LEDGER_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void window.ledboarding?.listOutputWindows().then((ids) => {
      if (!cancelled) setOpenOutputs(ids);
    });
    void window.ledboarding?.listDisplays().then((items) => {
      if (!cancelled) setDisplays(items);
    });
    const unsubscribe = window.ledboarding?.onOutputWindowsChanged(setOpenOutputs);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const content = useMemo(() => loadContent(), [tick]);
  const zones = useMemo(() => loadZones(), [tick]);
  const live = useMemo(() => loadLivePlayback(), [tick]);
  const budgetLedger = useMemo(() => loadSponsorBudgetLedger(), [tick]);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null;
  const secondaryZone =
    zones.find((zone) => zone.id === secondaryZoneId) ??
    zones.find((zone) => zone.id !== selectedZone?.id) ??
    selectedZone ??
    null;
  const selectedEntries = useMemo(
    () => resolveActivePlaylist(content, selectedZone),
    [content, selectedZone],
  );
  const secondaryEntries = useMemo(
    () => resolveActivePlaylist(content, secondaryZone),
    [content, secondaryZone],
  );
  const playback = useMemo(() => effectivePlayback(content, selectedZone), [content, selectedZone]);
  const segmentButtons = useMemo(() => segmentsForShortcuts(content), [content]);
  const safeIndex = selectedEntries.length > 0 ? live.itemIndex % selectedEntries.length : 0;
  const current = selectedEntries[safeIndex] ?? null;
  const next = selectedEntries.length > 0 ? selectedEntries[(safeIndex + 1) % selectedEntries.length] : null;
  const elapsedMs = live.status === "paused" ? live.pausedElapsedMs : Math.max(0, clock - live.itemStartedAtMs);
  const durationMs = Math.max(1, (current?.durationSec ?? 0) * 1000);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const progress = current ? Math.min(100, (elapsedMs / durationMs) * 100) : 0;

  useEffect(() => {
    if (!selectedZoneId && zones[0]) {
      setSelectedZoneId(zones[0].id);
    }
    if (!secondaryZoneId && zones[1]) {
      setSecondaryZoneId(zones[1].id);
    }
  }, [secondaryZoneId, selectedZoneId, zones]);

  function refreshOutputs() {
    void window.ledboarding?.listOutputWindows().then(setOpenOutputs);
  }

  async function openOutput(zoneId: string) {
    const zone = zones.find((item) => item.id === zoneId);
    if (window.ledboarding) {
      await window.ledboarding.openOutput(zoneId, {
        displayId: zone?.outputDisplayId ?? null,
        fullscreen: true,
      });
      refreshOutputs();
      return;
    }
    window.open(`#/display/${encodeURIComponent(zoneId)}`, "_blank", "noopener,noreferrer");
  }

  async function startAllOutputs() {
    const ids = live.linkedZoneIds.length > 0 ? live.linkedZoneIds : zones.map((zone) => zone.id);
    for (const id of ids) {
      await openOutput(id);
    }
    restartLivePlayback(safeIndex);
    refreshOutputs();
  }

  function startSegment(segmentId: string) {
    setActiveSegment(segmentId);
    restartLivePlayback(0);
    bump();
  }

  function goToItem(index: number) {
    if (current && elapsedMs >= 1000) {
      addSponsorPlayedSeconds(current.sponsor.id, Math.round(elapsedMs / 1000));
    }
    updateLivePlayback((state) => ({
      ...state,
      status: "playing",
      itemIndex: index,
      itemStartedAtMs: Date.now(),
      pausedElapsedMs: 0,
      updatedAtMs: Date.now(),
    }));
    bump();
  }

  function setOverride(nextMode: LivePlaybackState["overrideMode"]) {
    if (nextMode === "blackout" && live.overrideMode !== "blackout") {
      const ok = window.confirm("Blackout activeert zwart beeld op alle outputvensters. Doorgaan?");
      if (!ok) return;
    }
    setLiveOverrideMode(live.overrideMode === nextMode ? "normal" : nextMode);
    bump();
  }

  function setBrightnessPercent(value: number) {
    saveContent({
      ...content,
      settings: {
        ...content.settings,
        brightnessPercent: Math.min(100, Math.max(1, Math.round(value))),
      },
    });
    bump();
  }

  function toggleLinkedZone(zoneId: string) {
    const next = live.linkedZoneIds.includes(zoneId)
      ? live.linkedZoneIds.filter((id) => id !== zoneId)
      : [...live.linkedZoneIds, zoneId];
    setLinkedZoneIds(next);
    bump();
  }

  return (
    <div className="space-y-4 overflow-hidden">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)_minmax(300px,0.65fr)]">
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            <PlaylistPanel
              title="Perimeter playlist"
              zone={selectedZone}
              zones={zones}
              entries={selectedEntries}
              safeIndex={safeIndex}
              budgetLedger={budgetLedger}
              onSelectZone={setSelectedZoneId}
              onPlayItem={goToItem}
            />
            <PlaylistPanel
              title="Mid-tier playlist"
              zone={secondaryZone}
              zones={zones}
              entries={secondaryEntries}
              safeIndex={secondaryEntries.length > 0 ? live.itemIndex % secondaryEntries.length : 0}
              budgetLedger={budgetLedger}
              onSelectZone={setSecondaryZoneId}
              onPlayItem={goToItem}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
                Player
              </p>
              <h2 className="mt-2 truncate text-3xl font-black text-white">
                {current?.sponsor.label ?? "Geen actief item"}
              </h2>
              <p className="mt-2 min-w-0 text-sm text-zinc-400">
                Segment: <strong className="inline-block max-w-full align-bottom text-zinc-200">{segmentLabel(content, selectedZone)}</strong>
                {" · "}
                Modus: <strong className="text-zinc-200">{playback.mode === "hold" ? "Vast" : "Scroll"}</strong>
                {" · "}
                Status: <strong className={live.status === "playing" ? "text-emerald-300" : "text-amber-300"}>
                  {live.overrideMode === "normal" ? live.status : live.overrideMode}
                </strong>
              </p>

              <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
                <PlayerCard title="Nu" entry={current} />
                <PlayerCard title="Volgende" entry={next} />
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Timer</div>
                  <div className="mt-3 truncate font-mono text-2xl font-black text-white lg:text-3xl">{formatClock(remainingMs)}</div>
                  <div className="mt-1 truncate text-xs text-zinc-500">
                    {formatClock(elapsedMs)} van {current ? `${current.durationSec}s` : "0s"}
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                <ActionButton tone="green" onClick={() => playLivePlayback()}>Play</ActionButton>
                <ActionButton tone="amber" onClick={() => pauseLivePlayback()}>Pause</ActionButton>
                <ActionButton
                  tone="neutral"
                  disabled={selectedEntries.length === 0}
                  onClick={() => selectedEntries.length > 0 && goToItem((safeIndex - 1 + selectedEntries.length) % selectedEntries.length)}
                >
                  Prev
                </ActionButton>
                <ActionButton
                  tone="neutral"
                  disabled={selectedEntries.length === 0}
                  onClick={() => selectedEntries.length > 0 && goToItem((safeIndex + 1) % selectedEntries.length)}
                >
                  Next
                </ActionButton>
              </div>
              <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
                <ActionButton tone="neutral" onClick={() => restartLivePlayback(safeIndex)}>Restart item</ActionButton>
                <ActionButton tone="green" onClick={() => void startAllOutputs()}>
                  Start output
                </ActionButton>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Brightness</div>
                  <div className="mt-1 text-sm text-zinc-300">
                    Output: <strong className="text-white">{content.settings.brightnessPercent}%</strong>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ActionButton tone="neutral" onClick={() => setBrightnessPercent(content.settings.brightnessPercent - 5)}>-5</ActionButton>
                  <ActionButton tone="neutral" onClick={() => setBrightnessPercent(content.settings.brightnessPercent + 5)}>+5</ActionButton>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={content.settings.brightnessPercent}
                onChange={(e) => setBrightnessPercent(Number(e.target.value) || 100)}
                className="mt-4 w-full accent-emerald-500"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <ActionButton tone="red" onClick={() => setOverride("blackout")}>
                {live.overrideMode === "blackout" ? "Blackout uit" : "Blackout"}
              </ActionButton>
              <ActionButton tone="amber" onClick={() => setOverride("testPattern")}>
                {live.overrideMode === "testPattern" ? "Test uit" : "Testbeeld"}
              </ActionButton>
            </div>

            <Panel title="Segmenten">
              <div className="grid gap-2">
                {segmentButtons.map((segment, index) => (
                  <button
                    key={segment.id}
                    type="button"
                    onClick={() => startSegment(segment.id)}
                    className={`min-w-0 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm ${
                      segment.id === content.activeSegmentId
                        ? "border-emerald-500 bg-emerald-500/15 text-white"
                        : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <span className="block truncate text-[10px] uppercase tracking-wide text-zinc-500">
                      {index < 9 ? `Sneltoets ${index + 1}` : "Segment"}
                    </span>
                    <span className="block truncate font-semibold">{segment.label}</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Outputs / zones">
              <div className="grid gap-2">
                {zones.map((zone) => {
                  const open = openOutputs.includes(zone.id);
                  return (
                    <div key={zone.id} className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedZoneId(zone.id)}
                          className="min-w-0 flex-1 overflow-hidden text-left"
                        >
                          <span className="block truncate text-sm font-semibold text-zinc-100" title={zone.name}>{zone.name}</span>
                          <span className="block truncate text-xs text-zinc-500" title={`${zone.widthPx}x${zone.heightPx} - ${displayLabel(displays, zone.outputDisplayId)}`}>
                            {zone.widthPx}×{zone.heightPx} · {displayLabel(displays, zone.outputDisplayId)}
                          </span>
                          <span className="block truncate text-xs text-zinc-600" title={zone.processorName ?? "geen processorlabel"}>
                            {zone.processorName ?? "geen processorlabel"}
                          </span>
                        </button>
                        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${open ? "bg-emerald-500" : "bg-zinc-700"}`} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void openOutput(zone.id)}
                          className="rounded border border-zinc-600 px-2 py-1 text-[10px] font-bold uppercase text-zinc-100 hover:bg-zinc-800"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          disabled={!open || !window.ledboarding}
                          onClick={() => void window.ledboarding?.focusOutput(zone.id)}
                          className="rounded border border-zinc-600 px-2 py-1 text-[10px] font-bold uppercase text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
                        >
                          Focus
                        </button>
                        <label className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                          Link
                          <input
                            type="checkbox"
                            checked={live.linkedZoneIds.includes(zone.id)}
                            onChange={() => toggleLinkedZone(zone.id)}
                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-emerald-600"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Budget">
              <div className="space-y-2">
                {content.sponsors
                  .filter((sponsor) => sponsor.targetMinutesPerMatch > 0)
                  .map((sponsor) => {
                    const playedSec = budgetLedger.playedSecBySponsorId[sponsor.id] ?? 0;
                    const targetSec = sponsor.targetMinutesPerMatch * 60;
                    const pct = Math.min(100, Math.round((playedSec / targetSec) * 100));
                    return (
                      <div key={sponsor.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                        <div className="flex min-w-0 justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-semibold text-zinc-200" title={sponsor.label}>{sponsor.label}</span>
                          <span className={`shrink-0 ${pct >= 100 ? "text-emerald-300" : "text-amber-300"}`}>{pct}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                <button
                  type="button"
                  onClick={() => {
                    const ok = window.confirm("Sponsorbudget-teller resetten voor een nieuwe wedstrijd?");
                    if (ok) resetSponsorBudgetLedger();
                  }}
                  className="mt-2 w-full rounded border border-zinc-600 px-3 py-2 text-xs font-bold uppercase text-zinc-100 hover:bg-zinc-800"
                >
                  Budget resetten
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlayerCard({ title, entry }: { title: string; entry: ResolvedPlaylistEntry | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-3 truncate text-lg font-black text-white" title={entry?.sponsor.label ?? "Geen item"}>
        {entry?.sponsor.label ?? "Geen item"}
      </div>
      <div className="mt-1 truncate text-xs text-zinc-500">
        {entry ? `${entry.durationSec}s · ${entry.sponsor.contentKind}` : "Geen sponsor gekoppeld"}
      </div>
    </div>
  );
}

function PlaylistPanel({
  title,
  zone,
  zones,
  entries,
  safeIndex,
  budgetLedger,
  onSelectZone,
  onPlayItem,
}: {
  title: string;
  zone: LedZone | null;
  zones: LedZone[];
  entries: ResolvedPlaylistEntry[];
  safeIndex: number;
  budgetLedger: ReturnType<typeof loadSponsorBudgetLedger>;
  onSelectZone: (zoneId: string) => void;
  onPlayItem: (index: number) => void;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
            {title}
          </p>
          <h2 className="mt-1 truncate text-lg font-black text-white" title={zone?.name ?? "Geen zone"}>
            {zone?.name ?? "Geen zone"}
          </h2>
        </div>
        <select
          className="max-w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
          value={zone?.id ?? ""}
          onChange={(e) => onSelectZone(e.target.value)}
        >
          {zones.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-lg border border-zinc-800">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-2 py-2">Naam</th>
              <th className="w-12 px-2 py-2 text-right">Cnt</th>
              <th className="w-12 px-2 py-2 text-right">Dur</th>
              <th className="w-16 px-2 py-2 text-right">Bud</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const playedSec = budgetLedger.playedSecBySponsorId[entry.sponsor.id] ?? 0;
              const count = budgetLedger.playCountBySponsorId[entry.sponsor.id] ?? 0;
              const targetSec = entry.sponsor.targetMinutesPerMatch * 60;
              const pct = targetSec > 0 ? Math.min(100, Math.round((playedSec / targetSec) * 100)) : 0;
              const active = index === safeIndex;
              const budgetTitle =
                targetSec > 0 ? `${formatBudgetTime(playedSec)} / ${formatBudgetTime(targetSec)} (${pct}%)` : "Geen budget";
              return (
                <tr
                  key={`${entry.sponsor.id}-${index}`}
                  className={active ? "bg-emerald-500/15 text-white" : "border-t border-zinc-900 text-zinc-300"}
                >
                  <td className="px-2 py-2 font-mono text-zinc-500">{index + 1}</td>
                  <td className="truncate px-2 py-2 font-semibold" title={entry.sponsor.label}>
                    {entry.sponsor.label}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{count}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{entry.durationSec}</td>
                  <td className="truncate px-2 py-2 text-right tabular-nums" title={budgetTitle}>
                    {targetSec > 0 ? `${pct}%` : "-"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onPlayItem(index)}
                      className="max-w-full rounded border border-zinc-600 px-1.5 py-1 text-[10px] font-bold uppercase text-zinc-100 hover:bg-zinc-800"
                    >
                      Play
                    </button>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  Geen playlist-items voor deze zone.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  tone,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  tone: "green" | "amber" | "red" | "neutral";
  disabled?: boolean;
  onClick: () => void;
}) {
  const cls = {
    green: "bg-emerald-600 text-white hover:bg-emerald-500",
    amber: "bg-amber-600 text-white hover:bg-amber-500",
    red: "bg-red-700 text-white hover:bg-red-600",
    neutral: "border border-zinc-600 text-zinc-100 hover:bg-zinc-800",
  }[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-w-0 overflow-hidden rounded-xl px-2 py-3 text-xs font-black uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm ${cls}`}
    >
      <span className="block truncate">{children}</span>
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <h3 className="mb-3 truncate text-xs font-black uppercase tracking-[0.18em] text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function segmentLabel(content: ReturnType<typeof loadContent>, zone: LedZone | null): string {
  const id = zone ? effectiveSegmentId(content, zone) : content.activeSegmentId;
  return content.segments.find((segment) => segment.id === id)?.label ?? id;
}

function displayLabel(displays: LedDisplayInfoForWindow[], displayId: number | null | undefined): string {
  if (displayId === null || displayId === undefined) return "geen scherm";
  const display = displays.find((item) => item.id === displayId);
  if (!display) return `scherm ${displayId}`;
  return `${display.label} ${display.bounds.width}×${display.bounds.height}`;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatBudgetTime(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const min = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${min}m` : `${min}m ${rest}s`;
}
