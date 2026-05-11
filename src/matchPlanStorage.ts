import type { MatchPlanBlock, MatchPlanState } from "@/types";
import { LIVE_SEGMENT_ID } from "@/types";

const STORAGE_KEY = "ledboarding.matchPlan.v1";
export const MATCH_PLAN_EVENT = "ledboarding-match-plan-update";

function rid(): string {
  return `mp_${Math.random().toString(36).slice(2, 11)}`;
}

function now(): number {
  return Date.now();
}

export function defaultMatchPlan(): MatchPlanState {
  const t = now();
  return {
    enabled: false,
    running: false,
    startedAtMs: null,
    pausedElapsedMs: 0,
    activeBlockId: null,
    updatedAtMs: t,
    blocks: [
      createBlock("Pre-match", -30, 0, LIVE_SEGMENT_ID),
      createBlock("Eerste helft", 0, 45, LIVE_SEGMENT_ID),
      createBlock("Rust", 45, 60, "halftime"),
      createBlock("Tweede helft", 60, 105, LIVE_SEGMENT_ID),
      createBlock("Post-match", 105, 120, LIVE_SEGMENT_ID),
    ],
  };
}

export function createBlock(
  label: string,
  startMinute: number,
  endMinute: number,
  segmentId = LIVE_SEGMENT_ID,
): MatchPlanBlock {
  return {
    id: rid(),
    label,
    startMinute,
    endMinute: Math.max(startMinute + 1, endMinute),
    segmentId,
  };
}

export function loadMatchPlan(): MatchPlanState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = defaultMatchPlan();
      saveMatchPlan(initial);
      return initial;
    }
    return normalizeMatchPlan(JSON.parse(raw));
  } catch {
    const initial = defaultMatchPlan();
    saveMatchPlan(initial);
    return initial;
  }
}

export function saveMatchPlan(state: MatchPlanState): void {
  const normalized = normalizeMatchPlan(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(MATCH_PLAN_EVENT));
    window.dispatchEvent(new CustomEvent("ledboarding-update"));
  });
}

export function updateMatchPlan(updater: (state: MatchPlanState) => MatchPlanState): MatchPlanState {
  const next = normalizeMatchPlan(updater(loadMatchPlan()));
  saveMatchPlan(next);
  return next;
}

export function startMatchPlan(): MatchPlanState {
  return updateMatchPlan((state) => {
    const t = now();
    return {
      ...state,
      enabled: true,
      running: true,
      startedAtMs: t - state.pausedElapsedMs,
      updatedAtMs: t,
    };
  });
}

export function pauseMatchPlan(): MatchPlanState {
  return updateMatchPlan((state) => {
    const t = now();
    return {
      ...state,
      running: false,
      pausedElapsedMs: state.startedAtMs ? Math.max(0, t - state.startedAtMs) : state.pausedElapsedMs,
      updatedAtMs: t,
    };
  });
}

export function resetMatchPlan(): MatchPlanState {
  return updateMatchPlan((state) => ({
    ...state,
    running: false,
    startedAtMs: null,
    pausedElapsedMs: 0,
    activeBlockId: null,
    updatedAtMs: now(),
  }));
}

export function matchElapsedMs(state: MatchPlanState, atMs = now()): number {
  if (state.running && state.startedAtMs) return Math.max(0, atMs - state.startedAtMs);
  return Math.max(0, state.pausedElapsedMs);
}

export function matchMinute(state: MatchPlanState, atMs = now()): number {
  return matchElapsedMs(state, atMs) / 60_000;
}

export function activeMatchBlock(state: MatchPlanState, atMs = now()): MatchPlanBlock | null {
  const minute = matchMinute(state, atMs);
  return (
    sortedBlocks(state.blocks).find((block) => minute >= block.startMinute && minute < block.endMinute) ?? null
  );
}

export function sortedBlocks(blocks: MatchPlanBlock[]): MatchPlanBlock[] {
  return [...blocks].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
}

function normalizeMatchPlan(raw: unknown): MatchPlanState {
  const base = defaultMatchPlan();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const blocksRaw = Array.isArray(o.blocks) ? o.blocks : [];
  const blocks = blocksRaw.map(normalizeBlock).filter(Boolean) as MatchPlanBlock[];
  const startedAtMs =
    typeof o.startedAtMs === "number" && Number.isFinite(o.startedAtMs) && o.startedAtMs > 0
      ? Math.round(o.startedAtMs)
      : null;
  const activeBlockId =
    typeof o.activeBlockId === "string" && blocks.some((block) => block.id === o.activeBlockId)
      ? o.activeBlockId
      : null;
  return {
    enabled: o.enabled === true,
    running: o.running === true,
    startedAtMs,
    pausedElapsedMs: clampNumber(o.pausedElapsedMs, 0, 24 * 60 * 60 * 1000, 0),
    activeBlockId,
    blocks: blocks.length > 0 ? sortedBlocks(blocks) : base.blocks,
    updatedAtMs: clampNumber(o.updatedAtMs, 1, Number.MAX_SAFE_INTEGER, base.updatedAtMs),
  };
}

function normalizeBlock(raw: unknown): MatchPlanBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 120) : "Tijdblok";
  const startMinute = clampNumber(o.startMinute, -180, 360, 0);
  const endMinute = clampNumber(o.endMinute, startMinute + 1, 420, startMinute + 15);
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 80) : rid();
  const segmentId =
    typeof o.segmentId === "string" && o.segmentId.trim() ? o.segmentId.trim().slice(0, 128) : LIVE_SEGMENT_ID;
  return {
    id,
    label,
    startMinute,
    endMinute: Math.max(startMinute + 1, endMinute),
    segmentId,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
