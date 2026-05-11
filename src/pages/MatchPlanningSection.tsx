import { useEffect, useMemo, useReducer, useState } from "react";
import { loadContent } from "@/contentStorage";
import {
  MATCH_PLAN_EVENT,
  activeMatchBlock,
  createBlock,
  loadMatchPlan,
  matchElapsedMs,
  pauseMatchPlan,
  resetMatchPlan,
  saveMatchPlan,
  sortedBlocks,
  startMatchPlan,
} from "@/matchPlanStorage";
import type { MatchPlanBlock, MatchPlanState, PlaylistSegment, Sponsor } from "@/types";

export function MatchPlanningSection() {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const [clock, setClock] = useState(() => Date.now());
  const content = useMemo(() => loadContent(), [tick]);
  const plan = useMemo(() => loadMatchPlan(), [tick]);
  const blocks = useMemo(() => sortedBlocks(plan.blocks), [plan.blocks]);
  const activeBlock = activeMatchBlock(plan, clock);
  const elapsedMs = matchElapsedMs(plan, clock);
  const exposure = useMemo(
    () => calculateExposure(blocks, content.segments, content.sponsors),
    [blocks, content.segments, content.sponsors],
  );

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onChange() {
      bump();
    }
    window.addEventListener(MATCH_PLAN_EVENT, onChange);
    window.addEventListener("ledboarding-update", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(MATCH_PLAN_EVENT, onChange);
      window.removeEventListener("ledboarding-update", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  function patchPlan(patch: Partial<MatchPlanState>) {
    saveMatchPlan({ ...plan, ...patch, updatedAtMs: Date.now() });
    bump();
  }

  function patchBlock(id: string, patch: Partial<MatchPlanBlock>) {
    patchPlan({
      blocks: plan.blocks.map((block) =>
        block.id === id
          ? {
              ...block,
              ...patch,
              endMinute:
                patch.startMinute !== undefined && block.endMinute <= patch.startMinute
                  ? patch.startMinute + 1
                  : patch.endMinute ?? block.endMinute,
            }
          : block,
      ),
    });
  }

  function addBlock() {
    const lastEnd = blocks.at(-1)?.endMinute ?? 0;
    patchPlan({
      blocks: [...plan.blocks, createBlock(`Tijdblok ${plan.blocks.length + 1}`, lastEnd, lastEnd + 15)],
    });
  }

  function removeBlock(id: string) {
    if (plan.blocks.length <= 1) return;
    patchPlan({
      blocks: plan.blocks.filter((block) => block.id !== id),
      activeBlockId: plan.activeBlockId === id ? null : plan.activeBlockId,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Match planning
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Wedstrijd vooraf instellen
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Plan per wedstrijdblok welk segment actief moet zijn. De Live Console kan deze planning automatisch volgen;
              spontane cues zoals goal of VAR toon je daar tijdelijk bovenop zonder deze planning te wijzigen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                startMatchPlan();
                bump();
              }}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-emerald-500"
            >
              Start planning
            </button>
            <button
              type="button"
              onClick={() => {
                pauseMatchPlan();
                bump();
              }}
              className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-amber-500"
            >
              Pauze
            </button>
            <button
              type="button"
              onClick={() => {
                resetMatchPlan();
                bump();
              }}
              className="rounded-xl border border-zinc-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-zinc-100 hover:bg-zinc-800"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <InfoCard label="Planning" value={plan.enabled ? "Aan" : "Uit"} />
          <InfoCard label="Status" value={plan.running ? "Loopt" : "Pauze/stop"} />
          <InfoCard label="Matchtijd" value={formatClock(elapsedMs)} />
          <InfoCard label="Actief blok" value={activeBlock?.label ?? "Geen"} />
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <input
            type="checkbox"
            checked={plan.enabled}
            onChange={(e) => patchPlan({ enabled: e.target.checked })}
            className="mt-1 h-5 w-5 rounded border-zinc-600 bg-zinc-950 text-emerald-600"
          />
          <span className="text-sm text-zinc-300">
            <span className="font-semibold text-white">Live Console volgt deze matchplanning automatisch</span>
            <span className="mt-1 block text-xs text-zinc-500">
              Wanneer de planning loopt, wisselt de app automatisch naar het segment van het actieve tijdblok.
              Tijdelijke wedstrijdmomenten keren daarna terug naar het segment dat de planning op dat moment aanwijst.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Tijdblokken</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Gebruik minuten op de matchtijdlijn. Negatieve minuten zijn pre-match.
            </p>
          </div>
          <button
            type="button"
            onClick={addBlock}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Blok toevoegen
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {blocks.map((block) => {
            const active = activeBlock?.id === block.id;
            return (
              <div
                key={block.id}
                className={`grid gap-3 rounded-xl border p-3 lg:grid-cols-[minmax(180px,1fr)_7rem_7rem_minmax(220px,1fr)_auto] ${
                  active ? "border-emerald-500 bg-emerald-950/20" : "border-zinc-800 bg-zinc-950/60"
                }`}
              >
                <label>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Naam</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                    value={block.label}
                    onChange={(e) => patchBlock(block.id, { label: e.target.value })}
                  />
                </label>
                <NumberField
                  label="Start min"
                  value={block.startMinute}
                  onChange={(value) => patchBlock(block.id, { startMinute: value })}
                />
                <NumberField
                  label="Eind min"
                  value={block.endMinute}
                  onChange={(value) => patchBlock(block.id, { endMinute: value })}
                />
                <label>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Segment</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                    value={block.segmentId}
                    onChange={(e) => patchBlock(block.id, { segmentId: e.target.value })}
                  >
                    {content.segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={plan.blocks.length <= 1}
                  onClick={() => removeBlock(block.id)}
                  className="self-end rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Verwijder
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="font-semibold text-white">Geplande sponsor exposure</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Schatting op basis van blokduur en playlistverhoudingen. Dit is de planning, geen achteraf-log.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {exposure.map((row) => (
            <div key={row.label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="truncate font-semibold text-zinc-100">{row.label}</div>
              <div className="mt-1 font-mono text-2xl font-black text-emerald-300">
                {formatMinutes(row.seconds)}
              </div>
            </div>
          ))}
          {exposure.length === 0 ? (
            <p className="text-sm text-zinc-500">Nog geen sponsor-exposure berekend.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function calculateExposure(
  blocks: MatchPlanBlock[],
  segments: PlaylistSegment[],
  sponsors: Sponsor[],
): { label: string; seconds: number }[] {
  const bySponsor = new Map<string, number>();
  const segmentMap = new Map(segments.map((segment) => [segment.id, segment]));
  const sponsorMap = new Map(sponsors.map((sponsor) => [sponsor.id, sponsor.label]));

  for (const block of blocks) {
    const segment = segmentMap.get(block.segmentId);
    if (!segment) continue;
    const playlistTotal = segment.playlist.reduce((sum, row) => sum + row.durationSec, 0);
    const blockSeconds = Math.max(0, (block.endMinute - block.startMinute) * 60);
    if (playlistTotal <= 0 || blockSeconds <= 0) continue;
    for (const row of segment.playlist) {
      bySponsor.set(row.sponsorId, (bySponsor.get(row.sponsorId) ?? 0) + blockSeconds * (row.durationSec / playlistTotal));
    }
  }

  return Array.from(bySponsor.entries())
    .map(([sponsorId, seconds]) => ({ label: sponsorMap.get(sponsorId) ?? sponsorId, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 truncate text-xl font-black text-white">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatMinutes(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}m ${String(sec).padStart(2, "0")}s`;
}
