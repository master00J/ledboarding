import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import { LiveCuePanel } from "@/components/LiveCuePanel";
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
  MATCH_PLAN_EVENT,
  activeMatchBlock,
  loadMatchPlan,
  matchElapsedMs,
  saveMatchPlan,
} from "@/matchPlanStorage";
import { resolveLiveCue } from "@/liveCueResolve";
import { effectivePlayback, resolveActivePlaylist, segmentsForShortcuts } from "@/playlistResolve";
import {
  SPONSOR_BUDGET_LEDGER_EVENT,
  addSponsorPlayedSeconds,
  loadSponsorBudgetLedger,
  resetSponsorBudgetLedger,
} from "@/sponsorBudgetLedger";
import type { LivePlaybackState, PlaylistSegment, ResolvedPlaylistEntry } from "@/types";
import { loadZones } from "@/zoneStorage";

export function LiveConsoleSection() {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const [clock, setClock] = useState(() => Date.now());
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
    window.addEventListener(MATCH_PLAN_EVENT, onChange);
    window.addEventListener(SPONSOR_BUDGET_LEDGER_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("ledboarding-update", onChange);
      window.removeEventListener(LIVE_PLAYBACK_EVENT, onChange);
      window.removeEventListener(MATCH_PLAN_EVENT, onChange);
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
  const matchPlan = useMemo(() => loadMatchPlan(), [tick]);
  const matchBlock = useMemo(() => activeMatchBlock(matchPlan, clock), [clock, matchPlan]);
  const matchElapsed = useMemo(() => matchElapsedMs(matchPlan, clock), [clock, matchPlan]);
  const segmentButtons = useMemo(() => segmentsForShortcuts(content), [content]);
  const primaryZone = zones.find((z) => !z.segmentId?.trim()) ?? zones[0] ?? null;
  const activeEntries = useMemo(
    () => resolveActivePlaylist(content, primaryZone),
    [content, primaryZone],
  );
  const playback = useMemo(() => effectivePlayback(content, primaryZone), [content, primaryZone]);
  const safeIndex = activeEntries.length > 0 ? live.itemIndex % activeEntries.length : 0;
  const current = activeEntries[safeIndex] ?? null;
  const next = activeEntries.length > 0 ? activeEntries[(safeIndex + 1) % activeEntries.length] : null;
  const elapsedMs = live.status === "paused" ? live.pausedElapsedMs : Math.max(0, clock - live.itemStartedAtMs);
  const durationMs = Math.max(1, (current?.durationSec ?? 0) * 1000);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const progress = current ? Math.min(100, (elapsedMs / durationMs) * 100) : 0;
  const activeCue = useMemo(() => resolveLiveCue(content, live, clock), [content, live, clock]);
  const visibleCurrent = activeCue?.entry ?? current;
  const visibleNext = activeCue ? current : next;
  const visibleElapsedMs = activeCue?.elapsedMs ?? elapsedMs;
  const visibleRemainingMs = activeCue?.remainingMs ?? remainingMs;
  const visibleDurationSec = activeCue?.entry.durationSec ?? current?.durationSec ?? 0;
  const visibleProgress = activeCue?.progress ?? progress;
  const activeSegment = content.segments.find((s) => s.id === content.activeSegmentId) ?? content.segments[0];
  const linkedCount = live.linkedZoneIds.length;

  useEffect(() => {
    if (!matchPlan.enabled || !matchPlan.running || !matchBlock) return;
    if (content.activeSegmentId === matchBlock.segmentId && matchPlan.activeBlockId === matchBlock.id) return;
    setActiveSegment(matchBlock.segmentId);
    restartLivePlayback(0);
    saveMatchPlan({
      ...matchPlan,
      activeBlockId: matchBlock.id,
      updatedAtMs: Date.now(),
    });
    bump();
  }, [content.activeSegmentId, matchBlock, matchPlan]);

  function refreshOutputs() {
    void window.ledboarding?.listOutputWindows().then(setOpenOutputs);
  }

  function startSegment(segmentId: string) {
    setActiveSegment(segmentId);
    restartLivePlayback(0);
    bump();
  }

  function goToItem(itemIndex: number) {
    if (current && elapsedMs >= 1000) {
      addSponsorPlayedSeconds(current.sponsor.id, Math.round(elapsedMs / 1000));
    }
    updateLivePlayback((state) => ({
      ...state,
      status: "playing",
      activeCue: null,
      itemIndex,
      itemStartedAtMs: Date.now(),
      pausedElapsedMs: 0,
      updatedAtMs: Date.now(),
    }));
    bump();
  }

  function toggleZoneLink(zoneId: string) {
    const linked = live.linkedZoneIds.includes(zoneId)
      ? live.linkedZoneIds.filter((id) => id !== zoneId)
      : [...live.linkedZoneIds, zoneId];
    setLinkedZoneIds(linked);
    bump();
  }

  async function openOutput(zoneId: string) {
    const zone = zones.find((z) => z.id === zoneId);
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

  async function startLinkedOutputs() {
    const ids = live.linkedZoneIds.length > 0 ? live.linkedZoneIds : zones.map((z) => z.id);
    for (const id of ids) {
      await openOutput(id);
    }
    restartLivePlayback(safeIndex);
    refreshOutputs();
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  Live operator-console
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
                  {live.overrideMode === "blackout"
                    ? "BLACKOUT"
                    : live.overrideMode === "testPattern"
                      ? "TESTBEELD"
                      : visibleCurrent?.sponsor.label ?? "Geen actief item"}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {activeCue ? (
                    <>
                      Cue: <strong className="text-emerald-300">{activeCue.cue.label}</strong>
                      {" · "}
                    </>
                  ) : null}
                  Segment: <strong className="text-zinc-200">{activeSegment?.label ?? "Onbekend"}</strong>
                  {" · "}
                  Modus: <strong className="text-zinc-200">{playback.mode === "hold" ? "Vast" : "Scroll"}</strong>
                  {" · "}
                  Status: <strong className={live.status === "playing" ? "text-emerald-300" : "text-amber-300"}>
                    {live.status === "playing" ? "Playing" : "Pauze"}
                  </strong>
                  {matchPlan.enabled ? (
                    <>
                      {" · "}
                      Planning:{" "}
                      <strong className={matchPlan.running ? "text-emerald-300" : "text-amber-300"}>
                        {matchPlan.running ? `${formatTime(matchElapsed)} · ${matchBlock?.label ?? "geen blok"}` : "gepauzeerd"}
                      </strong>
                    </>
                  ) : null}
                </p>
              </div>
              <StatusPill live={live} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <NowNextCard title={activeCue ? "Cue live" : "Nu"} entry={visibleCurrent} fallback="Geen playlist actief" />
              <NowNextCard title={activeCue ? "Na cue" : "Volgende"} entry={visibleNext} fallback="Geen volgend item" />
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Timer</div>
                <div className="mt-3 font-mono text-3xl font-black text-white">{formatTime(visibleRemainingMs)}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {formatTime(visibleElapsedMs)} verstreken van {visibleDurationSec ? `${visibleDurationSec}s` : "0s"}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full bg-emerald-500" style={{ width: `${visibleProgress}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap gap-2">
                <ConsoleButton tone="green" onClick={() => playLivePlayback()}>
                  Play
                </ConsoleButton>
                <ConsoleButton tone="amber" onClick={() => pauseLivePlayback()}>
                  Pauze
                </ConsoleButton>
                <ConsoleButton
                  tone="neutral"
                  onClick={() => activeEntries.length > 0 && goToItem((safeIndex - 1 + activeEntries.length) % activeEntries.length)}
                  disabled={activeEntries.length === 0}
                >
                  Vorige
                </ConsoleButton>
                <ConsoleButton
                  tone="neutral"
                  onClick={() => activeEntries.length > 0 && goToItem((safeIndex + 1) % activeEntries.length)}
                  disabled={activeEntries.length === 0}
                >
                  Volgende
                </ConsoleButton>
                <ConsoleButton tone="neutral" onClick={() => restartLivePlayback(safeIndex)}>
                  Restart item
                </ConsoleButton>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <ConsoleButton tone="red" onClick={() => setOverride("blackout")}>
                  {live.overrideMode === "blackout" ? "Blackout uit" : "Blackout"}
                </ConsoleButton>
                <ConsoleButton tone="amber" onClick={() => setOverride("testPattern")}>
                  {live.overrideMode === "testPattern" ? "Testbeeld uit" : "Testbeeld"}
                </ConsoleButton>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Output brightness</div>
                  <div className="mt-1 text-sm text-zinc-300">
                    Helderheid: <strong className="text-white">{content.settings.brightnessPercent}%</strong>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ConsoleButton
                    tone="neutral"
                    onClick={() => setBrightnessPercent(content.settings.brightnessPercent - 5)}
                  >
                    -5
                  </ConsoleButton>
                  <ConsoleButton
                    tone="neutral"
                    onClick={() => setBrightnessPercent(content.settings.brightnessPercent + 5)}
                  >
                    +5
                  </ConsoleButton>
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

          <div className="space-y-4">
          <LiveCuePanel content={content} live={live} nowMs={clock} onChange={bump} />
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Segment start</h3>
                <p className="mt-1 text-xs text-zinc-500">Start direct een wedstrijdmoment of sponsorblok.</p>
              </div>
              <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                {segmentButtons.length} segmenten
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {segmentButtons.map((seg, i) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => startSegment(seg.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    seg.id === content.activeSegmentId
                      ? "border-emerald-500 bg-emerald-500/15 text-white"
                      : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {i < 9 ? `Sneltoets ${i + 1}` : "Segment"}
                  </span>
                  <span className="mt-1 block truncate font-semibold">{seg.label}</span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {segmentInfo(seg)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Sponsorbudget per wedstrijd</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Teller voor afgespeelde schermtijd tegenover het ingestelde budget per sponsor.
            </p>
          </div>
          <ConsoleButton
            tone="neutral"
            onClick={() => {
              const ok = window.confirm("Sponsorbudget-teller resetten voor een nieuwe wedstrijd?");
              if (ok) resetSponsorBudgetLedger();
            }}
          >
            Budget resetten
          </ConsoleButton>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {content.sponsors
            .filter((sponsor) => sponsor.targetMinutesPerMatch > 0)
            .map((sponsor) => {
              const targetSec = sponsor.targetMinutesPerMatch * 60;
              const playedSec = budgetLedger.playedSecBySponsorId[sponsor.id] ?? 0;
              const remainingSec = Math.max(0, targetSec - playedSec);
              const pct = targetSec > 0 ? Math.min(100, Math.round((playedSec / targetSec) * 100)) : 0;
              return (
                <div key={sponsor.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-zinc-100">{sponsor.label}</div>
                    <span className={remainingSec > 0 ? "text-xs text-amber-300" : "text-xs text-emerald-300"}>
                      {remainingSec > 0 ? `${formatBudgetTime(remainingSec)} rest` : "budget gehaald"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {formatBudgetTime(playedSec)} gespeeld van {formatBudgetTime(targetSec)} ({pct}%)
                  </div>
                </div>
              );
            })}
          {content.sponsors.every((sponsor) => sponsor.targetMinutesPerMatch <= 0) ? (
            <p className="text-sm text-zinc-500">
              Nog geen sponsorbudgetten ingesteld. Vul bij Content per sponsor “Budget min.” in.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Gekoppelde zones</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Selecteer zones die je samen wilt openen en starten. Zonder selectie gebruikt Start alle zones.
              </p>
            </div>
            <ConsoleButton tone="green" onClick={() => void startLinkedOutputs()}>
              Start {linkedCount > 0 ? `${linkedCount} linked` : "alle"}
            </ConsoleButton>
          </div>
          <div className="mt-4 space-y-2">
            {zones.map((zone) => (
              <label
                key={zone.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
              >
                <span>
                  <span className="block text-sm font-medium text-zinc-200">{zone.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {zone.widthPx} × {zone.heightPx}px · {zone.segmentId ? "vast segment" : "volgt globaal"}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-600">
                    {zone.processorName ?? "Geen processorlabel"} · {displayLabel(displays, zone.outputDisplayId)}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={live.linkedZoneIds.includes(zone.id)}
                  onChange={() => toggleZoneLink(zone.id)}
                  className="h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Outputvensters</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Open, focus of sluit Electron-output per zone. In browsermodus opent dit een nieuwe tab.
              </p>
            </div>
            <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
              {openOutputs.length}/{zones.length} open
            </span>
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {zones.map((zone) => {
              const isOpen = openOutputs.includes(zone.id);
              return (
                <div key={zone.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-zinc-100">{zone.name}</div>
                      <div className={isOpen ? "mt-1 text-xs text-emerald-400" : "mt-1 text-xs text-zinc-500"}>
                        {isOpen ? "Output actief" : "Output gesloten"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        {zone.processorName ?? "Geen processorlabel"} · {displayLabel(displays, zone.outputDisplayId)}
                      </div>
                    </div>
                    <span className={`h-3 w-3 rounded-full ${isOpen ? "bg-emerald-500" : "bg-zinc-700"}`} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openOutput(zone.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Open fullscreen
                    </button>
                    <button
                      type="button"
                      disabled={!isOpen || !window.ledboarding}
                      onClick={() => void window.ledboarding?.focusOutput(zone.id)}
                      className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      disabled={!isOpen || !window.ledboarding}
                      onClick={async () => {
                        await window.ledboarding?.closeOutput(zone.id);
                        refreshOutputs();
                      }}
                      className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sluit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ live }: { live: LivePlaybackState }) {
  const label =
    live.overrideMode === "blackout"
      ? "BLACKOUT ACTIEF"
      : live.overrideMode === "testPattern"
        ? "TESTBEELD ACTIEF"
        : live.status === "playing"
          ? "LIVE"
          : "PAUZE";
  const cls =
    live.overrideMode === "blackout"
      ? "border-red-500/70 bg-red-950/70 text-red-100"
      : live.overrideMode === "testPattern"
        ? "border-amber-500/70 bg-amber-950/60 text-amber-100"
        : live.status === "playing"
          ? "border-emerald-500/70 bg-emerald-950/60 text-emerald-100"
          : "border-amber-500/70 bg-amber-950/60 text-amber-100";
  return (
    <span className={`rounded-full border px-4 py-2 text-sm font-black tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function NowNextCard({
  title,
  entry,
  fallback,
}: {
  title: string;
  entry: ResolvedPlaylistEntry | null;
  fallback: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-3 truncate text-xl font-black text-white">{entry?.sponsor.label ?? fallback}</div>
      <div className="mt-1 truncate text-xs text-zinc-500">
        {entry ? `${entry.durationSec}s · ${entry.sponsor.contentKind}` : "Geen sponsor gekoppeld"}
      </div>
    </div>
  );
}

function ConsoleButton({
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
      className={`rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

function formatTime(ms: number): string {
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

function displayLabel(displays: LedDisplayInfoForWindow[], displayId: number | null | undefined): string {
  if (displayId === null || displayId === undefined) return "geen scherm gekoppeld";
  const display = displays.find((item) => item.id === displayId);
  if (!display) return `scherm ${displayId} niet gevonden`;
  const primary = display.isPrimary ? " · hoofdscherm" : "";
  return `${display.label} ${display.bounds.width}×${display.bounds.height}${primary}`;
}

function segmentInfo(seg: PlaylistSegment): string {
  const count = seg.playlist.length;
  const duration = seg.playlist.reduce((sum, row) => sum + row.durationSec, 0);
  return `${count} items · ${duration}s`;
}
